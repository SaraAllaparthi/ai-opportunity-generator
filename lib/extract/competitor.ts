// lib/extract/competitor.ts
// OpenAI extraction helper for competitor data

export type Candidate = {
  name: string
  website: string
  headquarters?: string | null
  country?: string | null
  size?: string | number | null
  ai_maturity?: string | null
  innovation_focus?: string | null
  positioning?: string | null
}

export type SearchResult = {
  url: string
  title: string
  snippet: string
}

const SYSTEM_PROMPT = `You are a meticulous competitive-intelligence extractor.

GOAL
From a set of web search hits, produce a clean, deduplicated list of direct competitors for the given company.

ABSOLUTE RULES
- Do NOT include the target company itself.
- Do NOT invent or guess websites, sizes, or locations.
- Only include companies with a real corporate website that matches the company (same brand/organization), not distributors, resellers, PR, or media.
- Prefer competitors headquartered in the same COUNTRY as the target. If fewer than 3, include nearby region/state; then broader DACH/EU.
- If a field is not clearly supported by the provided hits, omit it (do not guess).
- Output STRICT JSON (no prose, no comments), matching the schema below.

DEDUPLICATION
- Deduplicate by brand/name + eTLD+1 (example.com). If two hits point to the same organization, keep one.

OUTPUT SCHEMA (array of objects)
[
  {
    "name": string,                         // Company legal or brand name
    "website": string,                      // Canonical site; absolute URL. Use the root/home if available.
    "headquarters": string | null,          // City/region, Country (if stated in the hit). Null if unknown.
    "country": string | null,               // Country only (e.g., "Switzerland"). Null if unknown.
    "size": number | string | null,         // Employees if stated (e.g., 1200) or "100–250". Null if unknown.
    "ai_maturity": string | null,           // Short phrase grounded in the hits (e.g., "uses ML for risk scoring"). Null if unknown.
    "innovation_focus": string | null,      // Short phrase grounded in the hits (e.g., "wealth mgmt personalization"). Null if unknown.
    "positioning": string | null            // Short market positioning grounded in the hits. Null if unknown.
  }
]

VALIDATION
- "website" MUST be a parseable HTTP/HTTPS URL for the competitor's own domain (not LinkedIn, Wikipedia, marketplaces, or news).
- If the hit only contains a LinkedIn or directory page, include the company ONLY if the corporate domain is explicitly present in the snippet/preview.
- Use country names in English ("Switzerland", "Germany", "Austria", etc.).
- Keep strings concise (<= 120 chars each).

Return ONLY the JSON array.`

/**
 * Extract structured competitor data from search results using OpenAI
 */
export async function extractCandidatesFromSearch(
  hits: SearchResult[],
  context: {
    companyName: string
    headquarters?: string
    country?: string
    industry?: string
  }
): Promise<Candidate[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  if (hits.length === 0) {
    return []
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  // Build user prompt
  const hitsJson = JSON.stringify(hits.slice(0, 40), null, 2) // Limit to 40 hits
  
  const userPrompt = `TARGET COMPANY CONTEXT
- Name: ${context.companyName}
- Headquarters: ${context.headquarters || 'Unknown'}
- Country: ${context.country || 'Unknown'}
- Industry: ${context.industry || 'Unknown'}

TASK
From the search hits below, extract direct competitors of the target company (same/adjacent industry). Prioritize same-country peers; if fewer than 3, extend to region/state/canton; then DACH/EU.

SEARCH HITS (array of objects with url, title, snippet):
${hitsJson}

REMINDERS
- Exclude the target company "${context.companyName}".
- Only include companies with a valid corporate website on their own domain.
- Extract website from the url field in search hits.
- Do not guess; omit fields you cannot support.
- Return a JSON object with a "competitors" key containing an array.
- Output STRICT JSON per the schema. No comments or extra text.`

  const url = 'https://api.openai.com/v1/chat/completions'
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 3000
    }),
    signal: AbortSignal.timeout(60000)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'

  try {
    // OpenAI with json_object response_format returns an object with competitors array
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/i)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1])
      } else {
        console.error('[OpenAI] Failed to parse JSON from content:', content.substring(0, 500))
        throw new Error('Failed to parse JSON')
      }
    }
    
    // Handle both { competitors: [...] } and direct array
    const competitors = parsed.competitors || (Array.isArray(parsed) ? parsed : [])
    
    if (!Array.isArray(competitors)) {
      console.error('[OpenAI] Response is not an array:', parsed)
      return []
    }

    // Validate and normalize candidates
    const validated: Candidate[] = []
    for (const c of competitors) {
      if (!c.name || !c.website) continue
      
      // Normalize website URL
      try {
        const url = new URL(c.website.startsWith('http') ? c.website : `https://${c.website}`)
        // Normalize to origin
        const normalizedUrl = url.origin
        
        validated.push({
          name: String(c.name).trim(),
          website: normalizedUrl,
          headquarters: c.headquarters ? String(c.headquarters).trim() : null,
          country: c.country ? String(c.country).trim() : inferCountryFromTLD(normalizedUrl),
          size: c.size,
          ai_maturity: c.ai_maturity ? String(c.ai_maturity).trim() : null,
          innovation_focus: c.innovation_focus ? String(c.innovation_focus).trim() : null,
          positioning: c.positioning ? String(c.positioning).trim() : null
        })
      } catch {
        // Skip invalid URLs
        continue
      }
    }

    return validated
  } catch (err) {
    console.error('[OpenAI] Failed to parse JSON:', err)
    console.error('[OpenAI] Raw content:', content.substring(0, 500))
    return []
  }
}

function inferCountryFromTLD(url: string): string | undefined {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const hostname = parsed.hostname.toLowerCase()
    
    const tldMap: Record<string, string | undefined> = {
      '.ch': 'Switzerland',
      '.de': 'Germany',
      '.at': 'Austria',
      '.fr': 'France',
      '.it': 'Italy',
      '.uk': 'United Kingdom',
      '.com': undefined,
      '.org': undefined,
      '.net': undefined
    }
    
    for (const [tld, country] of Object.entries(tldMap)) {
      if (hostname.endsWith(tld) && country) {
        return country
      }
    }
    
    return undefined
  } catch {
    return undefined
  }
}
