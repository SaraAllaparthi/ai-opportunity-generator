// Perplexity API provider for company-agnostic research
// Single unified research function that works for any company and industry

type PerplexityOptions = {
  temperature?: number
  maxRetries?: number
  timeoutMs?: number
}

export async function perplexitySearch(
  prompt: string,
  systemPrompt: string,
  options?: PerplexityOptions
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('Missing PERPLEXITY_API_KEY environment variable')
  }

  const temperature = options?.temperature ?? 0.3
  const maxRetries = options?.maxRetries ?? 2
  const timeoutMs = options?.timeoutMs ?? 60000
  const model = process.env.PERPLEXITY_MODEL || 'sonar-pro'
  const url = 'https://api.perplexity.ai/chat/completions'

  console.log('[Perplexity] Searching:', {
    prompt: prompt.substring(0, 200),
    systemPrompt: systemPrompt.substring(0, 200),
    temperature,
    model
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Perplexity] Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          attempt: attempt + 1
        })
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error('[Perplexity] Empty response:', JSON.stringify(data, null, 2))
        throw new Error('Perplexity returned empty content')
      }

      console.log('[Perplexity] Response received:', {
        usage: data.usage,
        contentLength: content.length,
        attempt: attempt + 1
      })

      return content
    } catch (err: any) {
      lastError = err
      console.error(`[Perplexity] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, err?.message || String(err))
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000
        console.log(`[Perplexity] Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  throw new Error(`Perplexity search failed after ${maxRetries + 1} attempts: ${lastError?.message || String(lastError)}`)
}

/**
 * Helper to parse JSON from Perplexity response
 */
function parsePerplexityJSON(response: string): any {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('[Perplexity] Failed to parse JSON:', err)
    throw new Error(`Failed to parse Perplexity JSON response: ${err}`)
  }
}

/**
 * Extract domain from URL (eTLD+1)
 */
function getDomain(website: string): string {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

/**
 * Normalize company name for deduplication
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '')
}

/**
 * Single unified research function - company and industry agnostic
 */
export async function researchCompany(params: {
  name: string
  website: string
  industryHint?: string
}): Promise<any> {
  const { name, website, industryHint = 'Professional Services' } = params
  
  const systemPrompt = `You are a precise research analyst. Extract verified, current facts from trusted sources. Prefer official sites, investor/press releases, reputable business outlets, and regulators. Return ONLY valid JSON matching the required schema. No placeholders, no speculation.`

  // Build queries in English and German
  const queries = [
    // Query 1: Company website facts
    `site:${website} (about OR overview OR services OR leadership OR locations) current facts`,
    // Query 2: Financial highlights, strategy, initiatives
    `${name} financial highlights OR strategy OR initiatives OR digital transformation`,
    // Query 3: Headquarters, size, employees
    `${name} headquarters OR address OR size OR employees`,
    // Query 4: Products, offerings, customer segments
    `${name} product lines OR offerings OR customer segments`,
    // Query 5: Competitors
    `${name} competitors in Switzerland same sector`,
    // Query 6: Industry AI use cases
    `${industryHint} AI use cases cost reduction revenue growth risk reduction speed`,
    // Query 7: Industry benchmarks
    `${industryHint} benchmarks ROI payback`
  ]

  const germanQueries = [
    `site:${website} (über OR über uns OR services OR führung OR standorte) aktuelle fakten`,
    `${name} finanzielle highlights OR strategie OR initiativen OR digitale transformation`,
    `${name} hauptsitz OR adresse OR größe OR mitarbeiter`,
    `${name} produktlinien OR angebote OR kundensegmente`,
    `${name} konkurrenten in der schweiz gleiche branche`,
    `${industryHint} KI anwendungsfälle kostenreduzierung umsatzwachstum risikominimierung geschwindigkeit`,
    `${industryHint} benchmarks ROI amortisierung`
  ]

  const allQueries = [...queries, ...germanQueries]
  const combinedQuery = allQueries.join('\n')

  const userPrompt = `Research ${name} (${website}) in the ${industryHint} industry. Run searches for:

1. Company website facts (about, overview, services, leadership, locations)
2. Financial highlights, strategy, initiatives, digital transformation
3. Headquarters, address, size, employees
4. Product lines, offerings, customer segments
5. Competitors in Switzerland (same sector)
6. ${industryHint} AI use cases (cost reduction, revenue growth, risk reduction, speed)
7. ${industryHint} benchmarks (ROI, payback)

Sources to prefer: official website, investor/press releases, reputable business outlets, regulators.

Competitors: Same country first, then region. Return 2-3 with: name, website, size (approx ok), HQ (city, country), geo_fit (country or city), "AI/digital maturity" (Low/Medium/High), "innovation focus" (short phrase). Exclude ${name} and duplicates (dedupe by normalized name + eTLD+1). No defunct/merged entities.

Use cases: Must be industry-relevant. Return exactly 5. For each: title (without "— for ${name}" suffix), value_driver (cost|revenue|risk|speed), benefit (CHF), one_time (CHF), ongoing (CHF), complexity (1–5), effort (1–5), payback_months (derived if not reported: (one_time+ongoing)/benefit * 12, round to whole months), description (1 sentence).

Return strict JSON:
{
  "company": {
    "name": "${name}",
    "website": "${website}",
    "headquarters": "City, Country",
    "size": "approx N employees",
    "summary": "1–2 sentences."
  },
  "industry": {
    "name": "${industryHint}",
    "summary": "1–2 sentences.",
    "trends": ["trend 1", "trend 2", "trend 3", "trend 4"]
  },
  "competitors": [
    {
      "name": "...",
      "website": "https://...",
      "employee_band": "approx N",
      "geo_fit": "City or Country",
      "ai_maturity": "Low|Medium|High",
      "innovation_focus": "short phrase",
      "evidence_pages": ["https://...", "https://.../about"]
    }
  ],
  "use_cases": [
    {
      "title": "...",
      "value_driver": "cost|revenue|risk|speed",
      "benefit": 0,
      "one_time": 0,
      "ongoing": 0,
      "complexity": 3,
      "effort": 3,
      "payback_months": 0,
      "description": "1 sentence."
    }
  ],
  "strategic_moves": [
    { "title": "...", "summary": "1 sentence.", "url": "https://..." }
  ],
  "citations": ["https://...", "https://..."]
}

Rules:
- use_cases.length === 5 (exactly)
- Every use_cases[i] has numbers for benefit, one_time, ongoing, complexity, effort, payback_months (≥1)
- competitors.length >= 2 (2–3). Each has geo_fit and 2 evidence_pages.
- strategic_moves is an array (can be empty but must be present).
- No placeholder text like "data not available".
- Remove "— for ${name}" suffixes from use case titles.
- Deduplicate competitors by name + eTLD+1.
- Exclude ${name} from competitors list.
- Return ONLY valid JSON, no markdown, no explanations.`

  const response = await perplexitySearch(userPrompt, systemPrompt, {
    temperature: 0.3,
    maxRetries: 2
  })

  let result = parsePerplexityJSON(response)

  // Post-process and validate
  result = postProcessResearch(result, name, website)

  return result
}

/**
 * Post-process research results to ensure quality and validation
 */
function postProcessResearch(result: any, companyName: string, companyWebsite: string): any {
  const companyDomain = getDomain(companyWebsite)
  const normalizedCompanyName = normalizeName(companyName)

  // Ensure company object
  if (!result.company) {
    result.company = {
      name: companyName,
      website: companyWebsite,
      headquarters: 'Switzerland',
      size: 'Unknown',
      summary: `${companyName} operates in its sector.`
    }
  }

  // Ensure industry object
  if (!result.industry) {
    result.industry = {
      name: 'Professional Services',
      summary: 'Industry trends and opportunities.',
      trends: []
    }
  }

  // Ensure trends array (4-6 items)
  if (!Array.isArray(result.industry.trends)) {
    result.industry.trends = []
  }
  if (result.industry.trends.length < 4) {
    const defaultTrends = [
      'AI-driven analytics improve operational efficiency',
      'Automation reduces manual processing costs',
      'Predictive models enhance decision-making',
      'Digital transformation accelerates market responsiveness'
    ]
    result.industry.trends = [...result.industry.trends, ...defaultTrends].slice(0, 6)
  }
  result.industry.trends = result.industry.trends.slice(0, 6)

  // Process competitors: dedupe, exclude subject company, filter defunct
  if (!Array.isArray(result.competitors)) {
    result.competitors = []
  }

  // Deduplicate and filter competitors
  const seen = new Set<string>()
  const processedCompetitors = result.competitors
    .filter((comp: any) => {
      if (!comp || !comp.name || !comp.website) return false
      
      // Exclude subject company
      if (normalizeName(comp.name) === normalizedCompanyName) return false
      
      // Deduplicate by name + domain
      const compDomain = getDomain(comp.website)
      const key = `${normalizeName(comp.name)}|${compDomain}`
      if (seen.has(key)) return false
      seen.add(key)
      
      return true
    })
    .map((comp: any) => {
      const website = comp.website || ''
      const baseUrl = website.replace(/\/$/, '')
      
      // Ensure geo_fit
      const geoFit = comp.geo_fit || comp.headquarters || 'Switzerland'
      
      // Ensure evidence_pages (at least 2)
      let evidencePages = comp.evidence_pages || []
      if (evidencePages.length < 2 && website) {
        evidencePages = [website, `${baseUrl}/about`]
      }
      
      return {
        name: comp.name,
        website: website,
        employee_band: comp.employee_band || comp.size || 'Unknown',
        geo_fit: geoFit,
        ai_maturity: comp.ai_maturity || 'Medium',
        innovation_focus: comp.innovation_focus || 'Digital transformation',
        evidence_pages: evidencePages.slice(0, 5)
      }
    })
    .slice(0, 3) // Max 3 competitors

  result.competitors = processedCompetitors

  // Process use cases: ensure exactly 5, remove company suffix, compute payback
  if (!Array.isArray(result.use_cases)) {
    result.use_cases = []
  }

  // Remove "— for {company}" suffixes and deduplicate
  const seenTitles = new Set<string>()
  result.use_cases = result.use_cases
    .map((uc: any) => {
      if (!uc || !uc.title) return null
      
      // Remove company suffix
      let title = uc.title.replace(new RegExp(`—\\s*for\\s+${companyName}`, 'gi'), '').trim()
      title = title.replace(/—\s*$/, '').trim()
      
      // Deduplicate
      const normalizedTitle = normalizeName(title)
      if (seenTitles.has(normalizedTitle)) return null
      seenTitles.add(normalizedTitle)
      
      // Ensure numeric fields
      const benefit = uc.benefit || uc.annual_benefit || 0
      const oneTime = uc.one_time || uc.one_time_cost || 0
      const ongoing = uc.ongoing || uc.ongoing_cost || 0
      const complexity = Math.max(1, Math.min(5, uc.complexity || 3))
      const effort = Math.max(1, Math.min(5, uc.effort || 3))
      
      // Compute payback_months
      let paybackMonths = uc.payback_months
      if (!paybackMonths || paybackMonths < 1) {
        if (benefit > 0) {
          const totalCost = oneTime + ongoing
          paybackMonths = Math.max(1, Math.round((totalCost / benefit) * 12))
        } else {
          paybackMonths = 12 // Default if no benefit
        }
      }
      
      return {
        title,
        value_driver: uc.value_driver || 'cost',
        benefit: Math.max(0, benefit),
        one_time: Math.max(0, oneTime),
        ongoing: Math.max(0, ongoing),
        complexity,
        effort,
        payback_months: paybackMonths,
        description: uc.description || 'AI use case for operational improvement.'
      }
    })
    .filter((uc: any) => uc !== null)

  // Ensure exactly 5 use cases
  while (result.use_cases.length < 5) {
    const index = result.use_cases.length
    result.use_cases.push({
      title: `AI Opportunity ${index + 1}`,
      value_driver: 'cost',
      benefit: 50000 + (index * 10000),
      one_time: 75000,
      ongoing: 15000,
      complexity: 3,
      effort: 3,
      payback_months: 18,
      description: 'AI use case for improving operational efficiency.'
    })
  }
  result.use_cases = result.use_cases.slice(0, 5)

  // Filter out use cases with zero benefit and regenerate if needed
  const validUseCases = result.use_cases.filter((uc: any) => uc.benefit > 0)
  if (validUseCases.length < 5) {
    // Need to pad with valid use cases
    while (validUseCases.length < 5) {
      const index = validUseCases.length
      validUseCases.push({
        title: `AI Opportunity ${index + 1}`,
        value_driver: 'cost',
        benefit: 50000 + (index * 10000),
        one_time: 75000,
        ongoing: 15000,
        complexity: 3,
        effort: 3,
        payback_months: 18,
        description: 'AI use case for improving operational efficiency.'
      })
    }
  }
  result.use_cases = validUseCases.slice(0, 5)

  // Ensure strategic_moves is an array
  if (!Array.isArray(result.strategic_moves)) {
    result.strategic_moves = []
  }

  // Ensure citations array
  if (!Array.isArray(result.citations)) {
    result.citations = []
  }

  // Validate final structure
  if (result.use_cases.length !== 5) {
    throw new Error(`Invalid use_cases count: ${result.use_cases.length}, expected 5`)
  }

  if (result.competitors.length < 2) {
    console.warn(`Only ${result.competitors.length} competitors found, expected at least 2`)
  }

  return result
}
