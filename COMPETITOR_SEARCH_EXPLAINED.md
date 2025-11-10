# Competitor Search Logic - Explained

## Overview
The competitor search uses **Perplexity AI** to find local competitors for a company. The search uses a **progressive expansion strategy** (local → country → regional) and leverages crawled website data to understand the company's niche for more accurate competitor matching.

## Flow Diagram

```
API Request
    ↓
Research Pipeline (lib/research/pipeline.ts)
    ↓
1. Crawl company website (extract niche: products, services, target markets)
    ↓
2. Extract company data (industry, headquarters, size, business description)
    ↓
3. Call findLocalCompetitors (lib/providers/perplexity.ts)
    ↓
4. Progressive search: local → country → regional
    ↓
5. Parse & validate Perplexity response (multiple strategies)
    ↓
6. Deduplicate competitors
    ↓
7. Return top 5-8 competitors
```

## Step-by-Step Breakdown

### Step 1: Company Niche Analysis
**Location:** `lib/research/pipeline.ts` (lines ~700-800)

The pipeline first crawls the company website to extract:
- Business description
- Products/Services
- Target markets
- Industry
- Headquarters
- Company size

This niche information is crucial for finding competitors in the **same niche**, not just the same industry.

---

### Step 2: Progressive Competitor Search
**Location:** `lib/providers/perplexity.ts` - `findLocalCompetitors()` (lines 408-753)

**Function:** `findLocalCompetitors(companyName, companyWebsite, crawledData, companySize)`

**Progressive Search Strategy:**

1. **Stage 1: Local (City/Region)**
   - Searches in same city/region as company
   - Minimum: 3 competitors
   - Priority: Same city/region

2. **Stage 2: Country**
   - Expands to entire country
   - Minimum: 5 competitors
   - Priority: Same country

3. **Stage 3: Regional (Europe)**
   - Expands to neighboring countries
   - Minimum: 5 competitors
   - Priority: Same region

**Search stops early if 5+ competitors found.**

---

### Step 3: Enhanced Perplexity Query

**Key Features:**
- **Niche Understanding:** Uses business description, products, services, and target markets to understand company's specific niche
- **Comprehensive Context:** Includes company name, website, industry, location, size
- **Explicit Instructions:** Finds competitors in the **same niche** (similar products/services, same target markets)

**Query Structure:**
```
Find direct competitors for {companyName} (website: {companyWebsite}) that operate in the same niche and market.

COMPANY INFORMATION:
- Company Name: {companyName}
- Industry: {industry}
- Location: {headquarters}
- Company Size: {size}
- Business Description: {businessDescription}
- Products: {products}
- Services: {services}
- Target Markets: {targetMarkets}

CRITICAL NICHE UNDERSTANDING:
Use the business description, products, services, and target markets to understand this company's specific niche. Find competitors that operate in the SAME niche - companies that:
- Make similar products OR provide similar services
- Serve similar target markets
- Have similar business models
- Compete for the same customers
```

---

### Step 4: Response Parsing (Multiple Strategies)

**Location:** `lib/providers/perplexity.ts` (lines ~1100-1150)

1. **Strategy 1: Code Blocks**
   - Extract JSON from ```json ... ``` blocks

2. **Strategy 2: Largest JSON Array**
   - Find all JSON arrays in response
   - Parse the largest one (most likely to be the answer)

3. **Strategy 3: Parse Entire Content**
   - Try parsing entire response as JSON
   - Check for `competitors`, `data`, or root array

---

### Step 5: Validation & Normalization

**For each competitor:**

1. **Required Fields:**
   - `name` (string, non-empty)
   - `website` (string, valid URL)

2. **URL Normalization:**
   - Remove `www.` prefix
   - Remove trailing slashes
   - Add `https://` if missing
   - Validate URL format

3. **Self-Exclusion:**
   - Compare competitor name with company name (case-insensitive)
   - Exclude if names overlap significantly
   - Exclude exact matches

4. **Deduplication:**
   - Track seen competitor names (case-insensitive)
   - Skip duplicates across search stages

---

### Step 6: Final Output Format

**Location:** `lib/providers/perplexity.ts` (lines ~690-710)

Each competitor object:
```typescript
{
  name: string              // Required
  website: string            // Required (normalized URL)
  hq?: string               // Optional: "City, Country"
  size_band?: string         // Optional: "X employees" or "X-Y employees"
  positioning?: string        // Optional: Brief description (max 140 chars)
  evidence_pages: string[]   // Required: At least [website]
  source_url?: string        // Optional: Where info was found
}
```

**Final Result:**
- Maximum 8 competitors (top results from all stages)
- Ranked by search stage (local first)
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
- Warning logged: "No valid competitors found after all search stages"

### If < 2 competitors found:
- Brief still generated
- Warning logged but proceeding

---

## Key Design Decisions

1. **Progressive Expansion:** Starts local, expands only if needed. More efficient and finds most relevant competitors first.

2. **Niche-First Matching:** Uses business description, products, services, and target markets to find competitors in the **same niche**, not just same industry.

3. **Website Data Priority:** Leverages crawled website data (most reliable) to understand company's specific niche.

4. **Multiple Parsing Strategies:** Handles different Perplexity response formats for resilience.

5. **Strict Validation:** Must have valid website URL and exclude the company itself.

6. **Deduplication Across Stages:** Prevents duplicate competitors from different search stages.

---

## Example Flow

**Input:**
- Company: "De Martin"
- Website: "https://demartin.com/en/"
- Industry: "Manufacturing" (from crawled data)
- Headquarters: "Switzerland" (from crawled data)
- Business Description: "Precision manufacturing for automotive industry"
- Products: ["Precision components", "Automotive parts"]
- Target Markets: ["Automotive OEMs", "Tier 1 suppliers"]

**Stage 1 (Local - Switzerland):**
```
Find competitors in Switzerland that:
- Make precision components for automotive
- Serve automotive OEMs and Tier 1 suppliers
- Similar business model to De Martin
```

**Stage 2 (Country - Switzerland):**
```
Find competitors in Switzerland (expanded search)
```

**Stage 3 (Regional - Europe):**
```
Find competitors in Switzerland and neighboring countries
```

**Final Result:**
- 0-8 competitors added to brief
- Ranked by location proximity (Switzerland first)
- All in same niche (precision automotive manufacturing)
- Brief generated successfully even if 0 competitors

---

## Migration Notes

**Old Implementation (Removed):**
- `perplexitySearchCompetitors()` - Required too many fields (ai_maturity, innovation_focus)
- `perplexitySearchCompetitorsSimple()` - Simpler but less accurate
- `lib/providers/competitors.ts` - Entire file unused

**New Implementation:**
- `findLocalCompetitors()` - Enhanced with progressive search and niche understanding
- Uses crawled website data for better accuracy
- More flexible (fewer required fields)
- Better validation and deduplication
