# Competitor Search Logic - Explained

## Overview
The competitor search uses **Perplexity AI** to find 2-3 local competitors for a company. The search happens **after** the main company research is complete, using extracted company data (industry, headquarters, size) to find relevant competitors.

## Flow Diagram

```
API Request
    ↓
Research Pipeline (lib/research/pipeline.ts)
    ↓
1. Extract company data (industry, headquarters, size)
    ↓
2. Check prerequisites (need industry OR headquarters)
    ↓
3. Call Perplexity API (lib/providers/perplexity.ts)
    ↓
4. Parse & validate Perplexity response
    ↓
5. Transform to CompetitorStrict format
    ↓
6. Deduplicate & rank by location
    ↓
7. Return top 3 competitors
```

## Step-by-Step Breakdown

### Step 1: Prerequisites Check
**Location:** `lib/research/pipeline.ts` (lines 1417-1433)

```typescript
// Extract company data from LLM research
const headquarters = parsed.company?.headquarters
const companyIndustry = parsed.company?.industry
const companySize = parsed.company?.size

// Need at least industry OR headquarters to search
if (!companyIndustry && !headquarters) {
  // Skip search, return empty array
  parsed.competitors = []
} else {
  // Proceed with search using fallbacks if needed
  const searchIndustry = companyIndustry || input.industryHint || 'Professional Services'
  const searchHeadquarters = headquarters || 'Switzerland'
  const searchSize = companySize || '50-200 employees (estimated)'
}
```

**Key Points:**
- Requires either `industry` OR `headquarters` (not both)
- Uses fallbacks: industry hint from input or "Professional Services"
- Defaults headquarters to "Switzerland" if missing
- Defaults size to "50-200 employees (estimated)" if missing

---

### Step 2: Perplexity API Call
**Location:** `lib/providers/perplexity.ts` (lines 12-223)

**Function:** `perplexitySearchCompetitors(companyName, industry, headquarters, size)`

**What it does:**
1. **Builds a natural language query:**
   ```
   Find 2-3 local competitors for {companyName} in the {industry} industry.
   Company details:
   - Headquarters: {headquarters}
   - Size: {size}
   
   For each competitor, provide:
   - Company name
   - Official website URL
   - Headquarters location
   - Brief positioning
   - Digital/AI focus
   - One source link
   ```

2. **Calls Perplexity API:**
   - Model: `llama-3.1-sonar-large-128k-online`
   - Temperature: 0.2 (low for more factual results)
   - Max tokens: 2000
   - Timeout: 30 seconds
   - Retries: Up to 3 attempts with exponential backoff

3. **Parses JSON from response** (multiple strategies):
   - Strategy 1: Extract from code blocks (```json ... ```)
   - Strategy 2: Find JSON array anywhere in response
   - Strategy 3: Parse entire content as JSON
   - Strategy 4: Try to extract from markdown/text (fallback)

4. **Validates results:**
   - Must have `name` (non-empty string)
   - Must have `website` (valid URL with http:// or https://)
   - Must NOT be the company itself (name matching check)
   - Normalizes website URLs (adds https:// if missing)

**Returns:** Array of `PerplexitySearchResult[]` (max 3)

---

### Step 3: Transform to CompetitorStrict Format
**Location:** `lib/research/pipeline.ts` (lines 1463-1548)

For each Perplexity result:

1. **Validate & Normalize Website:**
   ```typescript
   // Add https:// if missing
   // Normalize to origin (protocol + hostname only)
   // Validate it's a parseable URL
   ```

2. **Exclude Self:**
   ```typescript
   // Compare normalized domains
   // Skip if competitor domain === company domain
   ```

3. **Build Evidence Pages:**
   ```typescript
   evidencePages = [website] // Always include homepage
   if (result.source && same domain) {
     evidencePages.push(result.source)
   }
   // Ensure at least 2 pages (duplicate homepage if needed)
   ```

4. **Create Competitor Object:**
   ```typescript
   {
     name: result.name.trim(),
     website: normalizedWebsite,
     positioning: result.positioning || fallback,
     ai_maturity: result.ai_maturity || 'Digital transformation initiatives',
     innovation_focus: result.innovation_focus || 'Process optimization',
     employee_band: companySize, // From input company
     geo_fit: result.headquarters || searchHeadquarters,
     evidence_pages: [website, ...], // At least 2
     citations: [result.source] || []
   }
   ```

---

### Step 4: Deduplication
**Location:** `lib/research/pipeline.ts` (lines 1552-1562)

```typescript
// Create unique key: "normalized_name|normalized_domain"
const key = `${c.name.toLowerCase().trim()}|${normalizeDomain(c.website)}`

// Filter out duplicates using Set
const seen = new Set<string>()
// Only keep first occurrence of each key
```

**Purpose:** Remove competitors with same name + domain (different variations)

---

### Step 5: Ranking by Location
**Location:** `lib/research/pipeline.ts` (lines 1564-1579)

Competitors are ranked by geographic proximity:

```typescript
// Priority scoring:
// - Same city: 3 points
// - Same country: 2 points  
// - Same region: 1 point
// - Other: 0 points

// Sort by score (highest first)
// Then alphabetically by name if scores equal
```

**Result:** Most local competitors appear first

---

### Step 6: Final Selection
**Location:** `lib/research/pipeline.ts` (line 1581)

```typescript
parsed.competitors = rankedCompetitors.slice(0, 3) // Top 3 only
```

**Final Output:**
- Maximum 3 competitors
- Ranked by location proximity
- All duplicates removed
- All validated (name, website, not self)

---

## Error Handling

### If Perplexity fails:
- Returns empty array `[]`
- Pipeline continues (brief generated without competitors)
- Warning logged but no error thrown

### If no competitors found:
- `parsed.competitors = []`
- Brief still generated (schema allows 0-6 competitors)
- Warning logged: "No competitors found - brief will be generated without competitors"

### If < 2 competitors found:
- Brief still generated
- Warning logged: "Only found X competitor(s) (preferred: 2-3, but proceeding)"

---

## Key Design Decisions

1. **Separate from LLM Research:** Competitors are NOT generated by the LLM. They come from live Perplexity search only.

2. **Flexible Requirements:** 
   - Can work with just industry OR headquarters
   - Uses fallbacks when data missing
   - Allows 0 competitors (doesn't fail)

3. **Strict Validation:**
   - Must have valid website URL
   - Must exclude the company itself
   - Must have at least 2 evidence pages

4. **Location-First Ranking:**
   - Prioritizes local competitors (same city/country)
   - Better for SMB market analysis

5. **Multiple Parsing Strategies:**
   - Handles different Perplexity response formats
   - More resilient to API variations

---

## Example Flow

**Input:**
- Company: "Acme Corp"
- Industry: "Manufacturing" (from LLM research)
- Headquarters: "Zurich, Switzerland" (from LLM research)
- Size: "150 employees" (from LLM research)

**Perplexity Query:**
```
Find 2-3 local competitors for Acme Corp in the Manufacturing industry.
Company details:
- Headquarters: Zurich, Switzerland
- Size: 150 employees
```

**Perplexity Returns:**
```json
[
  {
    "name": "Swiss Manufacturing Co",
    "website": "https://swissmfg.ch",
    "headquarters": "Zurich, Switzerland",
    "positioning": "Provides precision manufacturing services",
    "ai_maturity": "Uses digital process monitoring",
    "innovation_focus": "Quality analytics"
  },
  ...
]
```

**After Processing:**
- Validated websites
- Excluded if same domain as Acme Corp
- Ranked by location (Zurich companies first)
- Deduplicated
- Top 3 selected

**Final Result:**
- 0-3 competitors added to brief
- Brief generated successfully even if 0 competitors

