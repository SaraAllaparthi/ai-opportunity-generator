// Simplified competitor search using Perplexity only
// Fast, deterministic, minimal fields

type CompetitorQuery = {
  company_name: string
  company_website?: string
  industry_hint?: string
  hq_hint?: string // "City, Country" if available
}

export type Competitor = {
  name: string
  website: string // absolute, normalized origin
  hq?: string // "City, Country"
  size_band?: string // e.g., "10–50", "50–250", "250–1000", "1000+", "Unknown"
  positioning?: string // <= 140 chars; what they do/for whom
  evidence_pages: string[] // min 2 if possible; else [origin, source_url]
  source_url?: string // page used to infer positioning
}

type PerplexityCompetitorResult = {
  name: string
  website: string
  hq?: string
  size_band?: string
  positioning?: string
  source_url?: string
}

/** Normalize domain to eTLD+1 (e.g., example.com) */
function normalizeDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return urlObj.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
  }
}

/** Normalize URL to origin (protocol + hostname, no path) */
function normalizeToOrigin(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${urlObj.protocol}//${urlObj.hostname}`
  } catch {
    return url
  }
}

/** Check if URL resolves (HEAD request, 2s timeout) */
async function checkUrlResolves(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeout)
    return response.ok || response.status === 200 || response.status < 400
  } catch {
    return false
  }
}

/** Build evidence pages: try origin + /about, /company, etc. */
async function buildEvidencePages(origin: string, sourceUrl?: string): Promise<string[]> {
  const evidencePages: string[] = []
  
  // Always add origin
  if (await checkUrlResolves(origin)) {
    evidencePages.push(origin)
  }
  
  // Try common about pages
  const aboutPaths = ['/about', '/en/about', '/company', '/ueber-uns', '/en/company']
  for (const path of aboutPaths) {
    if (evidencePages.length >= 2) break
    const aboutUrl = `${origin}${path}`
    if (await checkUrlResolves(aboutUrl)) {
      evidencePages.push(aboutUrl)
    }
  }
  
  // If we only have origin and source_url is provided and different, use it
  if (evidencePages.length === 1 && sourceUrl) {
    const sourceOrigin = normalizeToOrigin(sourceUrl)
    if (sourceOrigin !== origin && await checkUrlResolves(sourceUrl)) {
      evidencePages.push(sourceUrl)
    }
  }
  
  // If still only one, reuse origin (minimum requirement)
  if (evidencePages.length === 0) {
    evidencePages.push(origin) // At least add origin even if it doesn't resolve
  }
  
  return evidencePages
}

/** Extract location hierarchy for scoring */
function extractLocationHierarchy(location?: string): {
  city?: string
  country?: string
  canton?: string
} {
  if (!location) return {}
  
  const parts = location.split(',').map(s => s.trim())
  const city = parts[0]
  const country = parts[parts.length - 1]
  const canton = parts.length > 2 ? parts[1] : undefined
  
  return { city, country, canton }
}

/** Score competitor for ranking */
function scoreCompetitor(
  competitor: Competitor,
  targetHq?: string,
  targetDomain?: string
): number {
  let score = 0
  
  // Location matching
  if (targetHq && competitor.hq) {
    const targetLoc = extractLocationHierarchy(targetHq)
    const compLoc = extractLocationHierarchy(competitor.hq)
    
    if (targetLoc.city && compLoc.city && targetLoc.city.toLowerCase() === compLoc.city.toLowerCase()) {
      score += 3 // Same city
    } else if (targetLoc.canton && compLoc.canton && targetLoc.canton.toLowerCase() === compLoc.canton.toLowerCase()) {
      score += 2 // Same canton/state
    } else if (targetLoc.country && compLoc.country && targetLoc.country.toLowerCase() === compLoc.country.toLowerCase()) {
      score += 1 // Same country
    }
  }
  
  // Data quality
  if (competitor.positioning && competitor.positioning.length > 0) {
    score += 1
  }
  
  if (competitor.evidence_pages.length >= 2) {
    score += 1
  }
  
  return score
}

/** Search competitors using Perplexity */
export async function searchCompetitors(query: CompetitorQuery): Promise<Competitor[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('Missing PERPLEXITY_API_KEY')
  
  const targetDomain = query.company_website ? normalizeDomain(query.company_website) : undefined
  const targetName = query.company_name.toLowerCase().trim()
  
  // Build user prompt
  const promptParts = [
    'Find 2–5 direct competitors that sell substantially the same products/services.',
    'Prefer same country; if city or state/canton is provided, prioritize local.',
    'Use official company sites; avoid directories/marketplaces unless needed to locate the official site.',
    '',
    'Output ONLY this JSON array:',
    '[',
    '  {',
    '    "name": "...",',
    '    "website": "https://...",',
    '    "hq": "City, Country",',
    '    "size_band": "10–50|50–250|250–1000|1000+|Unknown",',
    '    "positioning": "≤140 chars, factual, no slogans",',
    '    "source_url": "https://... (page used to infer positioning)"',
    '  }',
    ']',
    '',
    'Target company:',
    `- Name: "${query.company_name}"`,
    query.company_website ? `- Website: "${query.company_website}"` : '',
    query.industry_hint ? `- Industry: "${query.industry_hint}"` : '',
    query.hq_hint ? `- HQ: "${query.hq_hint}"` : ''
  ].filter(Boolean)
  
  const userPrompt = promptParts.join('\n')
  
  console.log('[Competitors] Searching with Perplexity:', {
    company_name: query.company_name,
    industry_hint: query.industry_hint,
    hq_hint: query.hq_hint
  })
  
  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: 'Return only JSON. No prose. Strict schema. You must return a valid JSON array of competitor objects.'
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    temperature: 0.2,
    max_tokens: 2000
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    
    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Competitors] Perplexity error:', { status: res.status, body: errorText })
      throw new Error(`Perplexity error: ${res.status}`)
    }
    
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    
    console.log('[Competitors] Perplexity response:', {
      contentLength: content.length,
      preview: content.substring(0, 500)
    })
    
    // Parse JSON from response
    let results: PerplexityCompetitorResult[] = []
    
    // Try to extract JSON array
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
    if (codeBlockMatch) {
      try {
        results = JSON.parse(codeBlockMatch[1])
      } catch (e) {
        console.error('[Competitors] Failed to parse JSON from code block:', e)
      }
    }
    
    // Try to find JSON array anywhere
    if (results.length === 0) {
      const jsonMatch = content.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        try {
          results = JSON.parse(jsonMatch[0])
        } catch (e) {
          console.error('[Competitors] Failed to parse JSON array:', e)
        }
      }
    }
    
    // Try parsing entire content
    if (results.length === 0) {
      try {
        const parsed = JSON.parse(content.trim())
        if (Array.isArray(parsed)) {
          results = parsed
        } else if (parsed.competitors && Array.isArray(parsed.competitors)) {
          results = parsed.competitors
        }
      } catch (e) {
        console.error('[Competitors] Failed to parse response as JSON:', e)
      }
    }
    
    console.log('[Competitors] Parsed', results.length, 'competitors from Perplexity')
    
    // Validate and normalize
    const validCompetitors: Competitor[] = []
    
    for (const result of results) {
      // Validate required fields
      if (!result.name || !result.website) {
        console.log('[Competitors] Skipping - missing name or website:', result)
        continue
      }
      
      // Normalize website to origin
      let website: string
      try {
        website = normalizeToOrigin(result.website)
      } catch (e) {
        console.log('[Competitors] Skipping - invalid website:', result.name, result.website)
        continue
      }
      
      const competitorDomain = normalizeDomain(website)
      
      // Exclude self
      if (targetDomain && competitorDomain === targetDomain) {
        console.log('[Competitors] Skipping - same domain as target:', result.name)
        continue
      }
      
      // Exclude if name matches target (case/space-insensitive)
      const resultName = result.name.toLowerCase().trim()
      if (resultName === targetName || 
          resultName.includes(targetName) || 
          targetName.includes(resultName)) {
        console.log('[Competitors] Skipping - name matches target:', result.name)
        continue
      }
      
      // Build evidence pages
      const evidencePages = await buildEvidencePages(website, result.source_url)
      
      if (evidencePages.length === 0) {
        console.log('[Competitors] Skipping - no evidence pages:', result.name)
        continue
      }
      
      // Truncate positioning to 140 chars
      const positioning = result.positioning 
        ? result.positioning.substring(0, 140).trim()
        : undefined
      
      validCompetitors.push({
        name: result.name.trim(),
        website,
        hq: result.hq?.trim(),
        size_band: result.size_band?.trim(),
        positioning,
        evidence_pages: evidencePages,
        source_url: result.source_url?.trim()
      })
    }
    
    console.log('[Competitors] Valid competitors after filtering:', validCompetitors.length)
    
    // Dedupe by (normalized name + eTLD+1)
    const seen = new Set<string>()
    const deduped = validCompetitors.filter(c => {
      const key = `${c.name.toLowerCase().trim()}|${normalizeDomain(c.website)}`
      if (seen.has(key)) {
        console.log('[Competitors] Deduplicating:', c.name)
        return false
      }
      seen.add(key)
      return true
    })
    
    // Rank and take top 3
    const ranked = deduped
      .map(c => ({
        competitor: c,
        score: scoreCompetitor(c, query.hq_hint, targetDomain)
      }))
      .sort((a: { competitor: Competitor; score: number }, b: { competitor: Competitor; score: number }) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.competitor)
    
    console.log('[Competitors] Final ranked competitors:', ranked.length)
    
    return ranked
    
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new Error('Competitor search timed out (15s limit)')
    }
    console.error('[Competitors] Error:', err)
    throw err
  }
}

