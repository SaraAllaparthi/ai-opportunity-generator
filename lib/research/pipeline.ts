import { tavilySearch } from '@/lib/providers/tavily'
import { llmGenerateJson } from '@/lib/providers/llm'
import { Brief, BriefSchema } from '@/lib/schema/brief'
import { dedupeUrls } from '@/lib/utils/citations'

export type CompetitorStrict = Brief['competitors'][number]

export type PipelineInput = { name: string; website: string }

export type ResearchSnippet = {
  title: string
  url: string
  content: string
  publishedAt?: string
}


/* =========================
   Helpers
   ========================= */

   function stripProtocol(url: string) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
  
  function hostFromUrl(u: string): string {
    try {
      const h = new URL(u).hostname.toLowerCase()
      return h.replace(/^www\./, '')
    } catch {
      return stripProtocol(u).toLowerCase().split('/')[0]
    }
  }
  
  function normalizeDomain(url?: string) {
    if (!url) return ''
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`)
      return u.hostname.replace(/^www\./, '')
    } catch {
      return stripProtocol(url)
    }
  }
  
  /** SMB/industrial-focused query builder */
  function buildQueries({ name, website }: PipelineInput): string[] {
    const domain = stripProtocol(website)
  
    return [
      // Company-anchored (primary)
      `${name} site:${domain} company overview OR about`,
      `${name} site:${domain} products OR solutions OR industries`,
      `${name} site:${domain} press OR news OR media 2024..today`,
  
      // Industry/operations (SMB bias)
      `${name} manufacturing operations capabilities quality control`,
      `${name} industry trends manufacturing OR industrial automation 2023..today`,
      `${name} sustainability energy efficiency supply chain 2023..today`,
  
      // Strategy/moves/customers
      `${name} partnerships clients investments expansion 2024..today`,
      `${name} customer case study 2023..today`,
  
      // Competitive & challenges
      `${name} competitors peers alternatives comparison`,
      `${name} operational bottlenecks downtime scrap rework issues`,
    ]
  }

  /** Light snippet scoring: prefer company site, tier-1 press, recency; demote directories */
function scoreSnippet(s: ResearchSnippet, input: PipelineInput): number {
  let score = 0
  const h = hostFromUrl(s.url)
  const companyHost = normalizeDomain(input.website)
  if (h.includes(companyHost)) score += 3

  const tier1 = [
    'reuters.com',
    'bloomberg.com',
    'ft.com',
    'wsj.com',
    'nytimes.com',
    'forbes.com',
    'economist.com',
  ]
  if (tier1.some(d => h.endsWith(d))) score += 2

  if (s.publishedAt) score += 1

  const demote = ['owler.com', 'g2.com', 'softwaresuggest.com', 'softwareadvice.com', 'crunchbase.com']
  if (demote.some(d => h.endsWith(d))) score -= 2

  return score
}

/** Pick top N with domain diversity */
function selectTopSnippets(all: ResearchSnippet[], input: PipelineInput, cap = 15): ResearchSnippet[] {
  const byUrl = new Map<string, ResearchSnippet>()
  for (const r of all) if (!byUrl.has(r.url)) byUrl.set(r.url, r)

  const unique = Array.from(byUrl.values())
  unique.sort((a, b) => scoreSnippet(b, input) - scoreSnippet(a, input))

  const seenHost = new Set<string>()
  const picked: ResearchSnippet[] = []
  for (const s of unique) {
    const h = hostFromUrl(s.url)
    if (seenHost.has(h)) continue
    seenHost.add(h)
    picked.push(s)
    if (picked.length >= cap) break
  }
  return picked
}

/** Competitor filter: remove self, defunct/acquired brands, junk */
function filterCompetitors(
  comps: unknown[] | undefined,
  companyName: string,
  companyWebsite: string,
  opts?: {
    defunctNames?: RegExp[]          // e.g., [/credit\s*suisse/i]
    junkDomains?: RegExp[]           // e.g., [/owler\.com/i]
    minNameLength?: number
    maxCount?: number
  }
): CompetitorStrict[] {
  if (!Array.isArray(comps) || comps.length === 0) return []
  const company = (companyName || '').trim().toLowerCase()
  const companyDom = normalizeDomain(companyWebsite)
  const {
    defunctNames = [],
    junkDomains = [/owler\.com/i, /softwaresuggest\.com/i, /softwareadvice\.com/i, /g2\.com/i],
    minNameLength = 0,
    maxCount = 5,
  } = opts || {}

  const good: CompetitorStrict[] = []
  for (const item of comps) {
    // Coerce name: String(item.name || '').trim() - drop if empty
    const name = String((item as any)?.name || '').trim()
    if (!name) continue

    // Coerce website: normalized or undefined
    const websiteRaw = (item as any)?.website
    const website = websiteRaw ? normalizeDomain(String(websiteRaw)) : undefined

    // Coerce positioning: trimmed or undefined
    const positioningRaw = (item as any)?.positioning
    const positioning = positioningRaw ? String(positioningRaw).trim() : undefined

    // Coerce citations: Array.isArray(item.citations) ? (strings only) : []
    const citationsRaw = (item as any)?.citations
    const citations = Array.isArray(citationsRaw)
      ? citationsRaw.filter((c): c is string => typeof c === 'string')
      : []

    // Apply removal rules
    const lowerN = name.toLowerCase()
    if (company && lowerN.includes(company)) continue
    if (website && companyDom && website.includes(companyDom)) continue
    if (defunctNames.some(rx => rx.test(name))) continue
    if (website && junkDomains.some(rx => rx.test(website))) continue
    if (minNameLength) {
      const words = name.split(/\s+/).filter(Boolean)
      if (words.length < 2 && name.length < 4) continue
    }

    // Build valid CompetitorStrict
    good.push({
      name,
      website,
      positioning,
      citations,
    })
  }
  return good.slice(0, maxCount)
}

/* =========================
   Main pipeline
   ========================= */
export async function runResearchPipeline(input: PipelineInput): Promise<{ brief: Brief; citations: string[] }> {
  /* 1) Queries */
  const queries = buildQueries(input)

  /* 2) Retrieve */
  const all: ResearchSnippet[] = []
  for (const q of queries) {
    const res = await tavilySearch(q, {
      maxResults: 5,          // tighter focus for SMBs
      //freshness: 'year',      // prefer recent
      //includeDomains: [input.website], // bias to company site if your provider supports it
    })
    all.push(...res)
  }

  /* 3) Select */
  const top = selectTopSnippets(all, input, 15)
  const citations = dedupeUrls(top.map(t => t.url))

  /* 4) Generate strictly validated JSON (no fallbacks / no invention) */
  /* 4) Generate strictly validated JSON (no fallbacks / no invention) */
  const schemaRules = [
    'Top-level keys: company, industry, strategic_moves, competitors, use_cases, citations',
    'company: { name, website, summary }',
    'industry: { summary, trends: string[] } (trends is an array of strings, max 5 items)',
    'strategic_moves: [{ title, dateISO?, impact?, citations: string[] }] (citations defaults to [] if not provided)',
    'competitors: [{ name (required), website?, positioning?, citations: string[] }] (name is required, others optional; citations defaults to [] if not provided)',
    'use_cases: EXACTLY 5 items; each { title, description, value_driver (revenue|cost|risk|speed), complexity (1..5), effort (1..5), est_annual_benefit?, est_one_time_cost?, est_ongoing_cost?, payback_months?, data_requirements?, risks?, next_steps?, citations: string[] } (all numeric fields must be present; citations defaults to [] if not provided)',
    'citations: string[] of URLs used anywhere in the brief',
    'Return ONLY a JSON object. No markdown, no prose.'
  ]

  const system = [
    'You are an analyst writing for CEOs of companies with <500 employees.',
    'Use plain, directive business language; be concise.',
    'Do NOT invent or infer content. If there is no evidence, return an empty array for that section.',
    'Industry trends: array of strings (not objects), max 5 items, each ≤12 words, concrete (no generic "digital transformation").',
    'Use-case titles must be Verb + Outcome (e.g., "Cut Scrap with AI QC").',
    'All use_cases MUST include ALL numeric fields (est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months); use 0 or reasonable estimates when uncertain.',
    'Competitors: name is required; website, positioning, citations are optional (citations defaults to []).',
    'Strategic moves: citations array is optional and defaults to [] if not provided.',
    'Produce STRICT JSON matching schema_rules. No extra text.'
  ].join(' ')

  const userPayload = JSON.stringify({
    input,
    snippets: top,
    schema_rules: schemaRules,
    rules: [
      'Include citations arrays (URLs) for each claim in sections. Citations default to [] if not provided.',
      'industry.trends must be an array of strings (not objects). Max 5 items.',
      'competitors: name is required; website, positioning, citations are optional (citations defaults to []).',
      'strategic_moves: citations array defaults to [] if not provided.',
      'Provide exactly 5 use_cases with ALL numeric fields present (use 0 if uncertain).',
      'If a section lacks evidence, return [] for that section (no filler).'
    ]
  })

  let parsed: Brief | null = null
  let firstError: any | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const payload =
      attempt === 0
        ? userPayload
        : JSON.stringify({
            input,
            snippets: top,
            schema_rules: schemaRules,
            fix: {
              message: 'Previous output failed validation. Return valid JSON only.',
              validation_error: firstError?.issues ?? String(firstError),
              critical: [
                'Return a JSON object (no markdown) matching schema_rules',
                'industry.trends must be an array of strings (not objects)',
                'competitors: name is required; website, positioning, citations optional (citations defaults to [])',
                'strategic_moves: citations defaults to [] if not provided',
                'use_cases has EXACTLY 5 items',
                'value_driver in [revenue|cost|risk|speed]',
                'complexity and effort are integers 1..5',
                'ALL numeric fields present for use_cases (est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months)'
              ]
            }
          })

    const json = await llmGenerateJson(system, payload)
    const result = BriefSchema.safeParse(json)
    if (result.success) {
      parsed = result.data
      break
    } else {
      firstError = result.error
    }
  }

  if (!parsed) throw new Error('Failed to validate model output')

  /* 5) Clean competitors (remove self/defunct/junk; do not invent) */
  if (parsed.competitors && parsed.competitors.length) {
    const filtered = filterCompetitors(parsed.competitors, input.name, input.website, {
      defunctNames: [/credit\s*suisse/i], // example of known acquired/defunct
      junkDomains: [/owler\.com/i, /softwaresuggest\.com/i, /softwareadvice\.com/i, /g2\.com/i, /crunchbase\.com/i],
      minNameLength: 0,
      maxCount: 5,
    })
    // Ensure citations is always an array of valid strings (never undefined) - matches z.array(z.string().url()).default([])
    parsed.competitors = filtered.map(c => ({
      ...c,
      citations: Array.isArray(c.citations) 
        ? c.citations.filter((url): url is string => typeof url === 'string')
        : []
    }))
  } else if (parsed.competitors) {
    // Even if empty array, ensure each item has valid citations array
    parsed.competitors = parsed.competitors.map(c => ({
      ...c,
      citations: Array.isArray(c.citations) && c.citations.every(url => typeof url === 'string')
        ? c.citations
        : []
    }))
  }

  /* 6) Attach aggregated citations (internal only) */
  parsed.citations = dedupeUrls([...(parsed.citations || []), ...citations])

  /* 7) Deterministic rollups for Executive Summary (for UI hero cards) */
  const cases = parsed.use_cases || []
  const num = (v: any) => (typeof v === 'number' ? v : Number(v) || 0)

  const totalBenefit = cases.reduce((s, c) => s + num(c.est_annual_benefit), 0)
  const totalOneTime = cases.reduce((s, c) => s + num(c.est_one_time_cost), 0)
  const totalOngoing = cases.reduce((s, c) => s + num(c.est_ongoing_cost), 0)
  const totalInvestment = totalOneTime + totalOngoing

  let weighted = 0
  let denom = 0
  for (const c of cases) {
    const b = num(c.est_annual_benefit)
    const p = num(c.payback_months)
    if (b > 0 && p > 0) {
      weighted += b * p
      denom += b
    }
  }
  const weightedPaybackMonths = denom > 0 ? Math.round(weighted / denom) : 0
  const ebitdaEstimate = Math.round(totalBenefit * 0.25) // conservative 25%

  /* 8) Confidence scoring (unique hostnames per section citations) */
  const uniqCount = (urls: string[]) => new Set((urls || []).map(hostFromUrl)).size
  const conf = (urls: string[]) => {
    const n = uniqCount(urls)
    if (n >= 5) return 'High'
    if (n >= 2) return 'Medium'
    return 'Low'
  }

  const sectionConfidence = {
    company: conf(parsed.citations || []),
    industry: conf((parsed.industry?.trends || []).flatMap((t: any) => t.citations || [])),
    strategic_moves: conf((parsed.strategic_moves || []).flatMap((m: any) => m.citations || [])),
    competitors: conf((parsed.competitors || []).flatMap((c: any) => c.citations || [])),
    use_cases: conf((parsed.use_cases || []).flatMap((u: any) => u.citations || [])),
  }

  // Non-breaking meta for the UI (you can ignore if undesired)
  ;(parsed as any)._rollup = {
    total_benefit: totalBenefit,
    total_investment: totalInvestment,
    weighted_payback_months: weightedPaybackMonths,
    ebitda_estimate: ebitdaEstimate,
  }
  ;(parsed as any)._confidence = sectionConfidence

  return { brief: parsed, citations: parsed.citations }
}


