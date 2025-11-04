// app/api/competitors/route.ts
// Perplexity + OpenAI competitor discovery endpoint
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

type Candidate = {
  name: string
  website: string
  headquarters?: string
  country?: string
  size?: string | number
  ai_maturity?: string
  innovation_focus?: string
  positioning?: string
}

type RequestBody = {
  company: {
    name: string
    headquarters?: string
    website?: string
    country?: string
  }
  industry?: {
    name?: string
  }
}

type ApiResponse = {
  competitors: Candidate[]
}

type Hit = {
  url: string
  title: string
  snippet: string
}

/**
 * Extract country from headquarters string
 */
function extractCountry(headquarters?: string): string | undefined {
  if (!headquarters) return undefined
  
  const hq = headquarters.toLowerCase()
  if (hq.includes('switzerland') || hq.includes('schweiz') || hq.includes('suisse')) {
    return 'Switzerland'
  }
  if (hq.includes('germany') || hq.includes('deutschland')) {
    return 'Germany'
  }
  if (hq.includes('austria') || hq.includes('österreich')) {
    return 'Austria'
  }
  if (hq.includes('france')) {
    return 'France'
  }
  if (hq.includes('italy') || hq.includes('italia')) {
    return 'Italy'
  }
  
  return undefined
}

/**
 * Get country TLD code
 */
function getCountryTLD(country?: string): string | undefined {
  if (!country) return undefined
  
  const tldMap: Record<string, string> = {
    'Switzerland': 'ch',
    'Germany': 'de',
    'Austria': 'at',
    'France': 'fr',
    'Italy': 'it'
  }
  
  return tldMap[country]
}

/**
 * Get eTLD+1 from hostname
 */
function getETLDPlus1(hostname: string): string {
  const parts = hostname.toLowerCase().split('.')
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }
  return hostname.toLowerCase()
}

/**
 * Normalize URL to origin
 */
function normalizeUrlToOrigin(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.origin
  } catch {
    return null
  }
}

/**
 * Build evidence pages from origin
 */
function buildEvidencePages(origin: string): string[] {
  return [origin, `${origin}/about`]
}

/**
 * Check if URL is a corporate domain (not LinkedIn, Wikipedia, etc.)
 */
function isCorporateDomain(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const hostname = parsed.hostname.toLowerCase()
    
    // Exclude known non-corporate domains
    const excluded = [
      'linkedin.com',
      'wikipedia.org',
      'wikimedia.org',
      'crunchbase.com',
      'zoominfo.com',
      'owler.com',
      'bloomberg.com',
      'reuters.com',
      'news',
      'blog',
      'press',
      'media'
    ]
    
    return !excluded.some(ex => hostname.includes(ex))
  } catch {
    return false
  }
}

/**
 * Search Perplexity with retry logic
 * Returns both content and citations
 */
async function searchPerplexity(query: string, retries = 1): Promise<{ content: string; citations?: string[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured')
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'sonar-large-online',
          temperature: 0,
          return_citations: true,
          messages: [
            {
              role: 'system',
              content: 'Return a concise bulleted list of company candidates with URL, short description, and location if present.'
            },
            {
              role: 'user',
              content: query
            }
          ]
        }),
        signal: AbortSignal.timeout(12000) // 12s timeout
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const citations = data.citations || []
      
      return { content, citations }
    } catch (err: any) {
      if (attempt < retries && (err?.name === 'AbortError' || err?.message?.includes('timeout'))) {
        // Retry with jittered backoff
        const delay = 500 + Math.random() * 700 // 500-1200ms
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
  
  throw new Error('Perplexity search failed after retries')
}

/**
 * Extract hits from Perplexity response (content + citations)
 */
function extractHitsFromPerplexity(content: string, citations: string[] = []): Hit[] {
  const hits: Hit[] = []
  const seen = new Set<string>()
  
  // First, extract URLs from citations (these are more reliable)
  for (const citation of citations) {
    if (!citation || !isCorporateDomain(citation)) continue
    
    try {
      const origin = normalizeUrlToOrigin(citation)
      if (!origin || seen.has(origin)) continue
      seen.add(origin)
      
      // Try to find a company name in the content near this URL
      const urlIndex = content.toLowerCase().indexOf(citation.toLowerCase())
      let title = ''
      let snippet = ''
      
      if (urlIndex >= 0) {
        // Look for text before the URL (likely company name)
        const beforeText = content.substring(Math.max(0, urlIndex - 200), urlIndex).trim()
        const afterText = content.substring(urlIndex, urlIndex + 200).trim()
        
        // Extract potential company name from bullet points or lines before URL
        const lines = beforeText.split('\n').filter(l => l.trim())
        const lastLine = lines[lines.length - 1] || ''
        
        // Clean up bullet points
        title = lastLine.replace(/^[-•*\d.\s]+/, '').trim() || citation.split('/')[2] || 'Company'
        snippet = afterText.substring(0, 200).trim() || title
      } else {
        // Fallback: use domain name
        try {
          const url = new URL(citation.startsWith('http') ? citation : `https://${citation}`)
          title = url.hostname.replace(/^www\./, '').split('.')[0] || 'Company'
          snippet = title
        } catch {
          title = 'Company'
          snippet = 'Company'
        }
      }
      
      hits.push({
        url: origin,
        title: title.substring(0, 200),
        snippet: snippet.substring(0, 300)
      })
    } catch {
      continue
    }
  }
  
  // Also extract from content text (fallback)
  const lines = content.split('\n')
  let currentUrl: string | null = null
  let currentTitle: string | null = null
  let currentSnippet: string | null = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Extract URLs
    const urlMatch = trimmed.match(/https?:\/\/[^\s\)]+/i)
    if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;!?]+$/, '')
      if (isCorporateDomain(url)) {
        try {
          const origin = normalizeUrlToOrigin(url)
          if (origin && !seen.has(origin)) {
            // Save previous hit if we have one
            if (currentUrl && currentTitle) {
              const prevOrigin = normalizeUrlToOrigin(currentUrl)
              if (prevOrigin && !seen.has(prevOrigin)) {
                seen.add(prevOrigin)
                hits.push({
                  url: prevOrigin,
                  title: currentTitle,
                  snippet: currentSnippet || currentTitle
                })
              }
            }
            currentUrl = url
            currentTitle = null
            currentSnippet = null
          }
        } catch {
          continue
        }
      }
    }
    
    // Extract company names/titles
    if (trimmed.match(/^[-•*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      const text = trimmed.replace(/^[-•*\d.\s]+/, '').trim()
      if (text && !text.startsWith('http')) {
        if (!currentTitle) {
          currentTitle = text
        } else {
          currentSnippet = (currentSnippet ? currentSnippet + ' ' : '') + text
        }
      }
    } else if (trimmed && !trimmed.startsWith('http') && currentUrl && !currentTitle) {
      currentTitle = trimmed.substring(0, 200)
    } else if (trimmed && currentUrl && currentTitle) {
      currentSnippet = (currentSnippet ? currentSnippet + ' ' : '') + trimmed.substring(0, 300)
    }
  }
  
  // Save last hit
  if (currentUrl && currentTitle) {
    try {
      const origin = normalizeUrlToOrigin(currentUrl)
      if (origin && !seen.has(origin)) {
        seen.add(origin)
        hits.push({
          url: origin,
          title: currentTitle,
          snippet: currentSnippet || currentTitle
        })
      }
    } catch {
      // Skip
    }
  }
  
  return hits.slice(0, 50) // Limit to 50 hits
}

/**
 * Extract competitors using OpenAI GPT-5
 */
async function extractCompetitorsWithOpenAI(hits: Hit[], context: {
  companyName: string
  headquarters?: string
  country?: string
  industry?: string
}): Promise<Candidate[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  if (hits.length === 0) {
    return []
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

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

  const hitsJson = JSON.stringify(hits.slice(0, 40), null, 2)
  
  const USER_PROMPT = `TARGET COMPANY CONTEXT
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
  
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
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
            { role: 'user', content: USER_PROMPT }
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 3000
        }),
        signal: AbortSignal.timeout(20000) // 20s timeout
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        // Retry on 429/5xx
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || '{}'

      try {
        const parsed = JSON.parse(content)
        const competitors = parsed.competitors || (Array.isArray(parsed) ? parsed : [])
        
        if (!Array.isArray(competitors)) {
          return []
        }

        return competitors.map((c: any) => ({
          name: String(c.name || '').trim(),
          website: String(c.website || '').trim(),
          headquarters: c.headquarters ? String(c.headquarters).trim() : undefined,
          country: c.country ? String(c.country).trim() : undefined,
          size: c.size,
          ai_maturity: c.ai_maturity ? String(c.ai_maturity).trim() : undefined,
          innovation_focus: c.innovation_focus ? String(c.innovation_focus).trim() : undefined,
          positioning: c.positioning ? String(c.positioning).trim() : undefined
        })).filter((c: Candidate) => c.name && c.website)
      } catch (err) {
        console.error('[OpenAI] Failed to parse JSON:', err)
        console.error('[OpenAI] Raw content:', content.substring(0, 500))
        return []
      }
    } catch (err: any) {
      if (attempt === 0 && (err?.name === 'AbortError' || err?.message?.includes('timeout'))) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      throw err
    }
  }
  
  return []
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse | { error: string }>> {
  try {
    // Validate API keys
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'PERPLEXITY_API_KEY is not configured' },
        { status: 400 }
      )
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 400 }
      )
    }

    const body: RequestBody = await req.json()

    if (!body.company?.name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    const { company, industry } = body
    
    // Normalize inputs
    const companyName = company.name.trim()
    const companyHQ = company.headquarters || ''
    const country = company.country || extractCountry(companyHQ)
    const industryName = industry?.name || ''
    const countryTLD = getCountryTLD(country)

    console.log('[Competitors API] Starting discovery for:', companyName)
    console.log('[Competitors API] Country:', country, 'Industry:', industryName || 'not specified')

    // Build queries
    const queries: string[] = []
    
    if (country && industryName) {
      queries.push(`Top competitors of ${companyName} in ${country} (same industry: ${industryName}) — corporate websites only`)
    } else if (country) {
      queries.push(`Top competitors of ${companyName} in ${country} — corporate websites only`)
    }
    
    queries.push(`Companies similar to ${companyName} in ${country || ''} — exclude news, Wikipedia, LinkedIn`)
    
    if (industryName && country) {
      queries.push(`${industryName} firms in ${country} that compete with ${companyName} — show homepages`)
    }
    
    if (countryTLD && companyName) {
      queries.push(`${companyName} competitors site:*.${countryTLD}`)
    }

    console.log('[Competitors API] Executing', queries.length, 'Perplexity queries in parallel...')

    // Execute Perplexity searches in parallel
    const searchPromises = queries.map(q => 
      searchPerplexity(q).catch(err => {
        console.error(`[Competitors API] Perplexity query failed: "${q.substring(0, 60)}..."`, err)
        return { content: '', citations: [] }
      })
    )
    
    const searchResults = await Promise.all(searchPromises)
    
    // Extract hits from all responses
    const allHits: Hit[] = []
    for (const result of searchResults) {
      if (result.content || (result.citations && result.citations.length > 0)) {
        const hits = extractHitsFromPerplexity(result.content, result.citations)
        allHits.push(...hits)
      }
    }

    console.log('[Competitors API] Extracted', allHits.length, 'hits from Perplexity')

    if (allHits.length === 0) {
      console.log('[Competitors API] No hits found - returning empty array')
      return NextResponse.json({ competitors: [] })
    }

    // Extract competitors using OpenAI
    const candidates = await extractCompetitorsWithOpenAI(allHits, {
      companyName,
      headquarters: companyHQ,
      country,
      industry: industryName
    })

    console.log('[Competitors API] OpenAI extracted', candidates.length, 'candidates')

    if (candidates.length === 0) {
      return NextResponse.json({ competitors: [] })
    }

    // Validate and normalize
    const validated: Candidate[] = []
    const companyNameLower = companyName.toLowerCase().trim()
    const companyETLD = company.website ? (() => {
      try {
        const url = new URL(company.website.startsWith('http') ? company.website : `https://${company.website}`)
        return getETLDPlus1(url.hostname)
      } catch {
        return null
      }
    })() : null

    for (const c of candidates) {
      // Validate website
      const origin = normalizeUrlToOrigin(c.website)
      if (!origin) {
        continue
      }

      // Exclude self
      try {
        const url = new URL(origin)
        const candidateETLD = getETLDPlus1(url.hostname)
        if (candidateETLD === companyETLD) {
          continue
        }
        if (c.name.toLowerCase().trim() === companyNameLower) {
          continue
        }
      } catch {
        continue
      }

      validated.push({
        name: c.name,
        website: origin,
        headquarters: c.headquarters,
        country: c.country,
        size: c.size,
        ai_maturity: c.ai_maturity,
        innovation_focus: c.innovation_focus,
        positioning: c.positioning
      })
    }

    console.log('[Competitors API] Validated', validated.length, 'competitors')

    // Deduplicate by name + eTLD+1
    const seen = new Set<string>()
    const unique: Candidate[] = []

    for (const c of validated) {
      try {
        const url = new URL(c.website)
        const key = `${c.name.toLowerCase().trim()}|${getETLDPlus1(url.hostname)}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(c)
        }
      } catch {
        continue
      }
    }

    console.log('[Competitors API] After deduplication:', unique.length)

    // Rank by country priority (same country first)
    const sameCountry: Candidate[] = []
    const others: Candidate[] = []

    for (const c of unique) {
      if (c.country === country) {
        sameCountry.push(c)
      } else {
        others.push(c)
      }
    }

    // Combine: same country first, then others
    let result = [...sameCountry, ...others]

    // Ensure at least 3 when available, but prefer same country
    if (sameCountry.length < 3 && result.length >= 3) {
      result = result.slice(0, Math.max(3, sameCountry.length + (3 - sameCountry.length)))
    } else {
      result = result.slice(0, 8) // Max 8
    }

    console.log('[Competitors API] Returning', result.length, 'competitors')
    console.log('[Competitors API] Competitor names:', result.map(c => c.name))

    return NextResponse.json({ competitors: result })
  } catch (err: any) {
    console.error('[Competitors API] Error:', err)
    
    // Return empty array on error
    return NextResponse.json({ competitors: [] })
  }
}
