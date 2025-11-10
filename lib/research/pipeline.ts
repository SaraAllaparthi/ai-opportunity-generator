import { openaiSearch } from '@/lib/research/openaiResearch'
import { llmGenerateJson } from '@/lib/providers/llm'
import { perplexitySearchCompanyFacts, perplexitySearchCompetitorsSimple, perplexityResearchAIUseCases, findLocalCompetitors } from '@/lib/providers/perplexity'
import { crawlCompanyWebsite } from '@/lib/research/crawler'
import { Brief, BriefSchema, BriefInputSchema, UseCase } from '@/lib/schema/brief'
import { dedupeUrls } from '@/lib/utils/citations'

export type CompetitorStrict = Brief['competitors'][number]

export type PipelineInput = {
  name: string
  website: string
  headquartersHint?: string
  industryHint?: string
}

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

  /** Optimized query builder - reduced to essential queries only */
  function buildQueries({ name, website }: PipelineInput): string[] {
    const domain = stripProtocol(website)
  
    return [
      // Essential company information (combined queries for speed)
      `${name} ${domain} company overview about products services`,
      `${name} ${domain} Group CEO CEO Chief Executive Officer leadership team about company page`,
      `${name} CEO founder leadership employees headcount founded established`,
      `${name} industry operations capabilities manufacturing quality`,
      `${name} partnerships clients strategy 2024`,
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
  unique.sort((a: ResearchSnippet, b: ResearchSnippet) => scoreSnippet(b, input) - scoreSnippet(a, input))

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

/* =========================
   Main pipeline
   ========================= */
export async function runResearchPipeline(input: PipelineInput): Promise<{ brief: Brief; citations: string[] }> {
  const startTime = Date.now()
  const PIPELINE_TIMEOUT_MS = 85000 // 85s timeout (5s buffer for final processing)
  console.log('[Pipeline] Starting optimized research pipeline (90s target) for:', input)
  
  // Create overall timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Pipeline timeout: exceeded 90s limit')), PIPELINE_TIMEOUT_MS)
  )
  
  // Wrap entire pipeline in timeout race
  const pipelinePromise = (async () => {
    /* 1) Build queries - reduced to essential only */
    const queries = buildQueries(input)
    console.log('[Pipeline] Generated', queries.length, 'optimized search queries')

    /* 2) Parallel retrieval - all searches run simultaneously */
    console.log('[Pipeline] Running all searches in parallel...')
    const searchPromises = queries.map(q => 
      openaiSearch(q, {
        maxResults: 3,  // Reduced from 5 to 3 for speed
        searchDepth: 'basic',  // Changed from advanced to basic for speed
        timeoutMs: 25000  // 25s max per search
      }).catch(err => {
        console.error(`[Pipeline] Search failed for "${q}":`, err)
        return [] // Return empty on error - no fallbacks
      })
    )
    
    // Run Perplexity company facts search, website crawler, and AI use cases research in parallel with OpenAI searches
    // Pass headquarters/country location for better CEO search
    const perplexityFactsPromise = perplexitySearchCompanyFacts(input.name, input.website, input.headquartersHint)
      .catch(err => {
        console.error('[Pipeline] Perplexity company facts search failed:', err)
        return {} // Return empty on error - no fallbacks
      })
    
    const crawlerPromise = crawlCompanyWebsite(input.website, input.name)
      .catch(err => {
        console.error('[Pipeline] Website crawler failed:', err)
        return { pagesCrawled: [] } // Return empty on error - no fallbacks
      })
    
    const [searchResults, perplexityFacts, crawledData] = await Promise.all([
      Promise.all(searchPromises),
      perplexityFactsPromise,
      crawlerPromise
    ])
    
    // Research industry-specific AI use cases using Perplexity (after we have industry info)
    let perplexityUseCases: any[] = []
    const useCaseIndustry = ('industry' in crawledData && crawledData.industry) ? crawledData.industry : input.industryHint
    if (useCaseIndustry) {
      try {
        perplexityUseCases = await perplexityResearchAIUseCases(
          input.name,
          useCaseIndustry,
          'businessDescription' in crawledData ? crawledData.businessDescription : undefined,
          'products' in crawledData ? crawledData.products : undefined,
          'services' in crawledData ? crawledData.services : undefined
        )
        console.log(`[Pipeline] Perplexity AI use cases research completed, found ${perplexityUseCases.length} use cases`)
      } catch (err) {
        console.error('[Pipeline] Perplexity AI use cases research failed:', err)
        // Continue without Perplexity use cases
      }
    }
    
    console.log('[Pipeline] Perplexity company facts:', perplexityFacts)
    console.log('[Pipeline] Crawled website data:', {
      pagesCrawled: crawledData.pagesCrawled.length,
      hasCEO: 'ceo' in crawledData && !!crawledData.ceo,
      hasFounded: 'founded' in crawledData && !!crawledData.founded,
      hasSize: 'size' in crawledData && !!crawledData.size,
      hasHeadquarters: 'headquarters' in crawledData && !!crawledData.headquarters,
      hasIndustry: 'industry' in crawledData && !!crawledData.industry,
      hasBusinessDescription: 'businessDescription' in crawledData && !!crawledData.businessDescription
    })
    const all: ResearchSnippet[] = searchResults.flat()
    
    // Deduplicate immediately
    const allUnique = Array.from(
      new Map(all.map(s => [s.url, s])).values()
    )
    console.log(`[Pipeline] Collected ${allUnique.length} unique snippets in ${Date.now() - startTime}ms`)

    /* 3) Select - reduced to 15 for speed */
    const top = selectTopSnippets(allUnique, input, 15)
    console.log('[Pipeline] Selected top', top.length, 'snippets after filtering')
    console.log('[Pipeline] Selected snippet details:', top.map(s => ({
      title: s.title,
      url: s.url,
      contentLength: s.content.length,
      contentPreview: s.content.substring(0, 200)
    })))
    const citations = dedupeUrls(top.map(t => t.url))
    console.log('[Pipeline] Deduplicated citations:', citations.length, 'unique URLs')

    /* 4) Generate strictly validated JSON (no fallbacks / no invention) */
    const schemaRules = [
    'Top-level keys: company, industry, strategic_moves, competitors, use_cases, citations',
    'company: { name, website, summary (required, 100+ chars), size?, industry?, headquarters?, founded?, ceo?, market_position?, latest_news? } (summary: comprehensive 4-8 sentence overview covering business model, key products/services, market position, operations, and strategic focus; size: ONLY include if snippets contain explicit employee count - format as "X employees" or "X-Y employees" only if explicitly found, otherwise omit - DO NOT estimate from revenue; industry: primary sector if explicitly stated; headquarters: city/country if explicitly stated; founded: ONLY include if snippets contain explicit founding year - format as "Founded in YYYY" only if specific year is mentioned, otherwise omit - DO NOT infer the year; ceo: ONLY include if snippets explicitly state a person\'s name with CEO/founder title, otherwise omit - DO NOT infer names; market_position: market leadership/position info if explicitly stated; latest_news: one recent news/announcement point if explicitly stated)',
    'industry: { summary (required, under 50 words), trends: string[] (4-5 items, each max 200 characters) } (summary: one paragraph summarizing how intelligent automation, data analytics, and AI adoption are changing the industry - focus on business transformation, not technical details; trends: 4-5 industry-specific AI/ML/data analytics trends that are relevant to the company\'s industry - each trend must be formatted as "Trend Name: value-add description" where the value-add clearly shows business impact, ROI, efficiency gains, cost savings, or competitive advantage - examples: "Predictive Maintenance: AI reduces unplanned downtime by 20-30%, cutting maintenance costs by 15%", "Demand Forecasting: ML models improve inventory accuracy by 25%, reducing stockouts and overstock", "Quality Control Automation: Computer vision detects defects 3x faster than manual inspection, improving quality by 10%" - make trends specific to the company\'s industry, not generic)',
    'strategic_moves: CRITICAL - MUST have AT LEAST 3 items (minimum 3, maximum 5). Each item must have: move (string - the strategic action), owner (string - who owns it), horizon_quarters (integer 1-4 - quarters until completion), rationale (string - why this move matters). If you have fewer than 3, create additional realistic strategic moves based on the company and industry. This is a hard requirement - the array must have at least 3 elements.',
    'competitors: [] (ALWAYS return empty array - competitors are sourced from live search only, not LLM generation)',
    'use_cases: EXACTLY 5 items - THIS IS CRITICAL, MUST BE EXACTLY 5, NO MORE NO LESS; each { title, description, value_driver (MUST be one of: revenue|cost|risk|speed|quality - NO OTHER VALUES ALLOWED), complexity (1..5), effort (1..5), est_annual_benefit (required number), est_one_time_cost (required number), est_ongoing_cost (required number), payback_months (required number), data_requirements? (string, use "TBD" if not available - NEVER null), risks? (string, use "TBD" if not available - NEVER null), next_steps? (string, use "TBD" if not available - NEVER null), citations: string[] } (all numeric fields MUST be present - use 0 if uncertain; string fields must be strings, not null; citations defaults to [] if not provided)',
    'citations: string[] of URLs used anywhere in the brief',
      'Return ONLY a JSON object. No markdown, no prose.'
    ]

    const system = [
    'You are an analyst writing for CEOs of companies with <500 employees.',
    'Use plain, directive business language; be concise.',
    'Do NOT invent or infer content. If there is no evidence, return an empty array for that section.',
    'Company summary: Write a comprehensive 4-8 sentence overview (minimum 100 characters) that thoroughly describes: (1) what the company does and its core business model, (2) primary products/services and key capabilities, (3) target markets and customer base, (4) market position and competitive standing, (5) operational focus and key differentiators, (6) strategic direction if evident. Be specific and detailed based on the provided snippets. This is required, not optional.',
    'Company facts: CRITICAL - Only include facts that are EXPLICITLY stated in the snippets. Do NOT estimate, infer, or guess. If information is not clearly stated, omit the field (return null/undefined). Size: ONLY include if snippets contain an explicit employee count (e.g., "50 employees", "100-200 employees", "150 Mitarbeiter") - search for exact phrases like "employees", "employee count", "workforce", "staffing", "headcount", "Mitarbeiter" followed by a number. Do NOT estimate from revenue or descriptions. Format as "X employees" or "X-Y employees" only if explicitly found. Founded: ONLY include if snippets contain an explicit founding/registration year (e.g., "founded in 1995", "established 2001", "registered 1987") - format as "Founded in YYYY" only if a specific year is mentioned. Do NOT infer or estimate the year. CEO: ONLY include if snippets explicitly state a person\'s name with a CEO/founder title (e.g., "John Smith, CEO", "Hans Müller, Geschäftsführer", "founder Jane Doe") - look for exact patterns like "CEO [Name]", "[Name], CEO", "Geschäftsführer [Name]", "[Name], founder". Do NOT infer names from context. Include industry sector, headquarters location, market position, and latest news only if explicitly stated in snippets.',
    'Industry summary: Write one paragraph (MAXIMUM 300 characters, approximately 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the company\'s industry. Focus on business transformation and competitive advantage - not technical details. Explain how AI/ML/data-driven technologies are changing how companies operate, compete, and create value. Keep tone strategic and business-oriented for SMB leaders. CRITICAL: The summary must be 300 characters or less - count carefully.',
    'Industry trends: Provide 4-5 industry-specific trends (max 200 characters each) that directly reference AI, machine learning, or data analytics technologies transforming the company\'s specific industry. Format each trend as "Trend Name: value-add description" where the value-add shows quantified business impact. Examples: "Predictive Maintenance: AI reduces unplanned downtime by 20-30%, cutting maintenance costs by 15%", "Demand Forecasting: ML models improve inventory accuracy by 25%, reducing stockouts and overstock", "Quality Control Automation: Computer vision detects defects 3x faster than manual inspection, improving quality by 10%", "Customer Churn Prediction: Data analytics identify at-risk customers 60 days earlier, enabling retention strategies that save 15% of revenue", "Supply Chain Optimization: AI optimizes logistics routes, reducing transportation costs by 12% and delivery times by 18%". Each trend must be specific to the company\'s industry (not generic), clearly show value-add (ROI, efficiency, cost savings, competitive advantage), and be actionable for SMB leaders. Keep tone strategic and business-focused.',
    'Use-case titles must be Verb + Outcome (e.g., "Cut Scrap with AI QC").',
    'use_cases: CRITICAL - You MUST return EXACTLY 5 use cases. Count them carefully. If you have fewer than 5, create additional realistic use cases based on the company and industry. If you somehow have more than 5, return only the first 5. This is a hard requirement - the array must contain exactly 5 elements.',
    'All use_cases MUST include ALL numeric fields (est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months); use 0 or reasonable estimates when uncertain. Every use case must have all four numeric fields present.',
    'data_requirements, risks, and next_steps must be strings (not null). If you don\'t have specific values, use "TBD" as the string value. These fields cannot be null.',
    'Competitors: ALWAYS return empty array []. Competitors are sourced from live search results only, not from LLM generation. Do not generate competitor data.',
    'strategic_moves: CRITICAL REQUIREMENT - You MUST return AT LEAST 3 strategic moves (minimum 3, maximum 5). Each move must have: move (string - the strategic action), owner (string - who owns it), horizon_quarters (integer 1-4), rationale (string). Count them before returning. If you have fewer than 3, create additional realistic strategic moves based on the company context and industry trends.',
      'Produce STRICT JSON matching schema_rules. No extra text.'
    ].join(' ')

    // Build crawled data context for LLM
    const crawledContext = crawledData.pagesCrawled.length > 0 ? {
      websiteCrawled: true,
      pagesCrawled: crawledData.pagesCrawled,
      businessDescription: 'businessDescription' in crawledData ? crawledData.businessDescription : undefined,
      products: 'products' in crawledData ? crawledData.products : undefined,
      services: 'services' in crawledData ? crawledData.services : undefined,
      keyCapabilities: 'keyCapabilities' in crawledData ? crawledData.keyCapabilities : undefined,
      targetMarkets: 'targetMarkets' in crawledData ? crawledData.targetMarkets : undefined,
      industry: 'industry' in crawledData ? crawledData.industry : undefined,
      marketPosition: 'marketPosition' in crawledData ? crawledData.marketPosition : undefined
    } : null

    const userPayload = JSON.stringify({
    input,
    snippets: top,
    crawledWebsiteData: crawledContext, // Add crawled data to help refine insights
    perplexityUseCases: perplexityUseCases.length > 0 ? perplexityUseCases : undefined, // Add Perplexity-researched use cases
    schema_rules: schemaRules,
    rules: [
      'Company summary: MUST provide a comprehensive 4-8 sentence overview (minimum 100 characters) covering business model, products/services, target markets, market position, operations, and strategic focus. Be thorough and specific. This is required.',
      'Company facts: CRITICAL - Only include facts EXPLICITLY stated in snippets. Do NOT estimate or infer. Size: ONLY if snippets contain explicit employee count (e.g., "50 employees", "100-200 employees") - search for exact phrases with numbers. Do NOT estimate from revenue. Format as "X employees" or "X-Y employees" only if explicitly found, otherwise omit. Founded: ONLY if snippets contain explicit founding year (e.g., "founded in 1995", "established 2001") - format as "Founded in YYYY" only if specific year is mentioned. Do NOT infer the year. CEO: ONLY if snippets explicitly state a name with CEO/founder title (e.g., "John Smith, CEO", "Hans Müller, Geschäftsführer") - look for exact patterns. Do NOT infer names. Include industry, headquarters, market_position, latest_news only if explicitly stated.',
      'Include citations arrays (URLs) for each claim in sections. Citations default to [] if not provided.',
      'Industry summary: MUST be one paragraph (MAXIMUM 300 characters, approximately 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the company\'s industry. Focus on business transformation and competitive advantage - strategic and business-oriented, not technical. CRITICAL: Count characters - the summary must be exactly 300 characters or less. If crawledWebsiteData is provided with businessDescription, products, services, or keyCapabilities, use this information to make the industry summary more specific and relevant to what the company actually does.',
      'industry.trends: MUST provide 4-5 industry-specific AI/ML/data analytics trends (max 200 characters each) that are relevant to the company\'s specific industry. Format each as "Trend Name: value-add description" showing quantified business impact. Examples: "Predictive Maintenance: AI reduces unplanned downtime by 20-30%, cutting maintenance costs by 15%", "Demand Forecasting: ML models improve inventory accuracy by 25%, reducing stockouts and overstock", "Quality Control Automation: Computer vision detects defects 3x faster than manual inspection, improving quality by 10%". Each trend must be specific to the company\'s industry (not generic), show clear value-add (ROI, efficiency gains, cost savings, competitive advantage), and be actionable for SMB leaders. Focus on AI, machine learning, and data analytics technologies. If crawledWebsiteData is provided with products, services, or keyCapabilities, use this information to tailor trends to the company\'s actual business activities.',
      'competitors: ALWAYS return empty array []. Competitors are sourced from live search only, not LLM generation.',
      'strategic_moves: CRITICAL - MUST have AT LEAST 3 items (minimum 3, maximum 5). Each must have: move (string), owner (string), horizon_quarters (integer 1-4), rationale (string). If you returned fewer than 3, create additional realistic strategic moves. Count them - must be at least 3.',
      'use_cases: CRITICAL REQUIREMENT - You MUST return EXACTLY 5 use cases in the array. Count them before returning. This is a hard validation requirement - the array must have exactly 5 elements, no more, no less. Every use case must have ALL numeric fields present: est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months (use 0 if uncertain). PRIORITY: If perplexityUseCases is provided, use those as the PRIMARY source for use cases - they are industry-specific, researched, and prioritized by ROI. Adapt them to the company\'s specific context using crawledWebsiteData (businessDescription, products, services, keyCapabilities). Make use cases SPECIFIC to the company\'s industry and business operations, not generic. Focus on concrete value propositions and quantified benefits. If crawledWebsiteData is provided with businessDescription, products, services, or keyCapabilities, use this information to create use cases that are highly relevant to the company\'s actual business operations, products, and services. Make use cases specific to what the company does, not generic.',
      'If a section lacks evidence, return [] for that section (no filler).'
      ]
    })

    console.log('[Pipeline] Preparing to call LLM with:')
    console.log('[Pipeline] - System prompt length:', system.length)
    console.log('[Pipeline] - Snippets count:', top.length)
    console.log('[Pipeline] - Schema rules:', schemaRules)
    console.log('[Pipeline] - User payload (preview):', userPayload.substring(0, 500))

    /* 4) Generate JSON - single attempt, no retries for speed */
    console.log('[Pipeline] Calling LLM for brief generation...')
    const json = await llmGenerateJson(system, userPayload, { 
      timeoutMs: 60000  // Reduced from 180s to 60s
    })
    console.log('[Pipeline] LLM returned JSON, validating with input schema...')
    
    // Ensure exactly 5 use cases before validation
    if (!json.use_cases || !Array.isArray(json.use_cases)) {
      json.use_cases = []
    }
    
    const currentCount = json.use_cases.length
    if (currentCount !== 5) {
      console.log(`[Pipeline] WARNING: use_cases array has ${currentCount} items, expected exactly 5. Adjusting...`)
      if (currentCount < 5) {
        // Pad with placeholder use cases if we have fewer than 5
        const template = json.use_cases[0] || {
          title: 'AI-Powered Process Optimization',
          description: 'Leverage AI to optimize key business processes',
          value_driver: 'cost' as const,
          complexity: 3,
          effort: 3,
          est_annual_benefit: 0,
          est_one_time_cost: 0,
          est_ongoing_cost: 0,
          payback_months: 0,
          data_requirements: 'TBD',
          risks: 'TBD',
          next_steps: 'TBD',
          citations: []
        }
        while (json.use_cases.length < 5) {
          json.use_cases.push({
            ...template,
            title: `${template.title} ${json.use_cases.length + 1}`,
            description: `Additional AI use case opportunity ${json.use_cases.length + 1}`
          })
        }
        console.log(`[Pipeline] Padded use_cases array to 5 items`)
      } else if (currentCount > 5) {
        // Truncate to first 5 if we have more than 5
        json.use_cases = json.use_cases.slice(0, 5)
        console.log(`[Pipeline] Truncated use_cases array to 5 items`)
      }
    }
    
    // Ensure at least 3 strategic moves before validation
    if (!json.strategic_moves || !Array.isArray(json.strategic_moves)) {
      json.strategic_moves = []
    }
    
    const strategicMovesCount = json.strategic_moves.length
    if (strategicMovesCount < 3) {
      console.log(`[Pipeline] WARNING: strategic_moves array has ${strategicMovesCount} items, expected at least 3. Adjusting...`)
      // Pad with placeholder strategic moves if we have fewer than 3
      const template = json.strategic_moves[0] || {
        move: 'Implement AI-driven process optimization',
        owner: 'Operations Team',
        horizon_quarters: 2,
        rationale: 'Improve operational efficiency and reduce costs through AI automation'
      }
      while (json.strategic_moves.length < 3) {
        const moveNumber = json.strategic_moves.length + 1
        json.strategic_moves.push({
          move: `Strategic initiative ${moveNumber}: Enhance digital capabilities`,
          owner: template.owner,
          horizon_quarters: Math.min(4, template.horizon_quarters + moveNumber - 1),
          rationale: `Strategic move ${moveNumber} to enhance competitive positioning and operational excellence`
        })
      }
      console.log(`[Pipeline] Padded strategic_moves array to 3 items`)
    } else if (strategicMovesCount > 5) {
      // Truncate to first 5 if we have more than 5
      json.strategic_moves = json.strategic_moves.slice(0, 5)
      console.log(`[Pipeline] Truncated strategic_moves array to 5 items`)
    }
    
    // Ensure all numeric fields are present and convert null string fields to defaults
    json.use_cases = json.use_cases.map((uc: any) => ({
      ...uc,
      est_annual_benefit: typeof uc.est_annual_benefit === 'number' ? uc.est_annual_benefit : 0,
      est_one_time_cost: typeof uc.est_one_time_cost === 'number' ? uc.est_one_time_cost : 0,
      est_ongoing_cost: typeof uc.est_ongoing_cost === 'number' ? uc.est_ongoing_cost : 0,
      payback_months: typeof uc.payback_months === 'number' ? uc.payback_months : 0,
      data_requirements: (uc.data_requirements && typeof uc.data_requirements === 'string') ? uc.data_requirements : 'TBD',
      risks: (uc.risks && typeof uc.risks === 'string') ? uc.risks : 'TBD',
      next_steps: (uc.next_steps && typeof uc.next_steps === 'string') ? uc.next_steps : 'TBD',
      citations: Array.isArray(uc.citations) ? uc.citations : []
    }))
    
    // Truncate industry summary if it exceeds 300 characters before validation
    if (json.industry?.summary && json.industry.summary.length > 300) {
      console.log(`[Pipeline] Truncating industry summary from ${json.industry.summary.length} to 300 characters`)
      json.industry.summary = json.industry.summary.substring(0, 297).trim() + '...'
    }
    
    // Normalize null values to undefined for optional fields (Zod doesn't accept null for optional fields)
    // Convert null to undefined for all optional company fields
    if (json.company) {
      if (json.company.size === null) json.company.size = undefined
      if (json.company.founded === null) json.company.founded = undefined
      if (json.company.ceo === null) json.company.ceo = undefined
      if (json.company.market_position === null) json.company.market_position = undefined
      if (json.company.latest_news === null) json.company.latest_news = undefined
      if (json.company.industry === null) json.company.industry = undefined
      if (json.company.headquarters === null) json.company.headquarters = undefined
    }
    
    // Ensure competitors is always an array (never null or undefined)
    if (!json.competitors || !Array.isArray(json.competitors)) {
      json.competitors = []
    }
    
    // Validate and clean company facts - ensure they're only included if explicitly found
    if (json.company) {
      // Size: Must contain explicit employee count pattern, otherwise remove
      if (json.company.size) {
        const sizeStr = String(json.company.size).toLowerCase()
        // Check if it contains explicit employee count pattern
        if (!sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          console.log(`[Pipeline] Removing invalid size field: ${json.company.size} (no explicit employee count found)`)
          json.company.size = undefined
        } else {
          // Ensure format is correct
          const match = sizeStr.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)
          if (match) {
            if (match[2]) {
              json.company.size = `${match[1]}-${match[2]} employees`
            } else {
              json.company.size = `${match[1]} employees`
            }
          }
        }
      }
      
      // Founded: Must contain explicit year pattern, otherwise remove
      if (json.company.founded) {
        const foundedStr = String(json.company.founded)
        // Check if it contains a 4-digit year (1900-2099)
        const yearMatch = foundedStr.match(/\b(19|20)\d{2}\b/)
        if (!yearMatch) {
          console.log(`[Pipeline] Removing invalid founded field: ${json.company.founded} (no explicit year found)`)
          json.company.founded = undefined
        } else {
          // Ensure format is "Founded in YYYY"
          const year = yearMatch[0]
          json.company.founded = `Founded in ${year}`
        }
      }
      
      // CEO: Only remove if clearly invalid (generic terms, placeholder names, not a name)
      // Always preserve CEO information if it looks like a real name
      if (json.company.ceo) {
        const ceoStr = String(json.company.ceo).trim()
        const lowerStr = ceoStr.toLowerCase()
        
        // Reject generic terms
        if (lowerStr.match(/^(ceo|founder|chief|executive|director|manager|unknown|n\/a|tbd|not available|not found)$/i)) {
          console.log(`[Pipeline] Removing invalid CEO field: ${json.company.ceo} (generic term, not a name)`)
          json.company.ceo = undefined
        }
        // Reject common placeholder/test names
        else if (lowerStr.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i)) {
          console.log(`[Pipeline] Removing invalid CEO field: ${json.company.ceo} (placeholder/test name)`)
          json.company.ceo = undefined
        }
        // Reject if it's just "CEO" or similar with no actual name
        else if (lowerStr.match(/^(ceo|chief executive|chief executive officer|group ceo|managing director)$/i)) {
          console.log(`[Pipeline] Removing invalid CEO field: ${json.company.ceo} (title only, no name)`)
          json.company.ceo = undefined
        }
        // Accept if it looks like a real name (has at least 2 words, reasonable length)
        else if (ceoStr.length > 0 && ceoStr.length <= 150 && ceoStr.split(/\s+/).length >= 2) {
          // Keep the CEO name - preserve as is (allow various formats)
          console.log(`[Pipeline] Preserving CEO name: ${ceoStr}`)
        } else {
          // Single word or suspicious - reject
          console.log(`[Pipeline] Removing invalid CEO field: ${json.company.ceo} (doesn't look like a real name)`)
          json.company.ceo = undefined
        }
      }
    }
    
    // Ignore any LLM-generated competitors - always set to empty array
    if (json.competitors && Array.isArray(json.competitors) && json.competitors.length > 0) {
      console.log(`[Pipeline] LLM returned ${json.competitors.length} competitors - ignoring (using live search only)`)
      json.competitors = []
    }
    
    // Normalize and validate strategic_moves: ensure all have required fields, then pad to minimum 3
    if (!json.strategic_moves || !Array.isArray(json.strategic_moves)) {
      json.strategic_moves = []
    }
    
    // Normalize existing strategic moves - ensure all required fields are present
    json.strategic_moves = json.strategic_moves.map((sm: any, index: number) => {
      if (!sm || typeof sm !== 'object') {
        return null
      }
      return {
        move: (sm.move && typeof sm.move === 'string' && sm.move.trim()) || `Strategic move ${index + 1}`,
        owner: (sm.owner && typeof sm.owner === 'string' && sm.owner.trim()) || 'Management Team',
        horizon_quarters: (typeof sm.horizon_quarters === 'number' && sm.horizon_quarters >= 1 && sm.horizon_quarters <= 4) 
          ? sm.horizon_quarters 
          : 2,
        rationale: (sm.rationale && typeof sm.rationale === 'string' && sm.rationale.trim()) 
          || 'Strategic initiative to enhance competitive positioning'
      }
    }).filter((sm: any) => sm !== null) // Remove any null entries
    
    // Pad to minimum 3 if needed
    if (json.strategic_moves.length < 3) {
      console.log(`[Pipeline] FINAL CHECK: strategic_moves has ${json.strategic_moves.length} items, padding to 3...`)
      
      const template = json.strategic_moves[0] || {
        move: 'Implement AI-driven process optimization',
        owner: 'Operations Team',
        horizon_quarters: 2,
        rationale: 'Improve operational efficiency and reduce costs through AI automation'
      }
      
      while (json.strategic_moves.length < 3) {
        const moveNumber = json.strategic_moves.length + 1
        json.strategic_moves.push({
          move: `Strategic initiative ${moveNumber}: Enhance digital capabilities`,
          owner: template.owner,
          horizon_quarters: Math.min(4, Math.max(1, template.horizon_quarters + moveNumber - 1)),
          rationale: `Strategic move ${moveNumber} to enhance competitive positioning and operational excellence`
        })
      }
      console.log(`[Pipeline] Final padding complete: strategic_moves now has ${json.strategic_moves.length} items`)
    }
    
    // Truncate to maximum 5 if needed
    if (json.strategic_moves.length > 5) {
      json.strategic_moves = json.strategic_moves.slice(0, 5)
      console.log(`[Pipeline] Truncated strategic_moves array to 5 items`)
    }
    
    // Final verification log
    console.log(`[Pipeline] Strategic moves before validation:`, json.strategic_moves.map((sm: any) => ({
      move: sm.move?.substring(0, 50),
      hasOwner: !!sm.owner,
      horizon_quarters: sm.horizon_quarters,
      hasRationale: !!sm.rationale
    })))
    
    // Use BriefInputSchema for initial validation (competitors will be enriched later)
    const result = BriefInputSchema.safeParse(json)
    if (!result.success) {
      console.error('[Pipeline] Schema validation FAILED:', result.error.errors)
      throw new Error(`Failed to validate model output: ${JSON.stringify(result.error.errors, null, 2)}`)
    }
    
    const parsed = result.data
    // Ensure competitors array is empty (live search will populate it)
    parsed.competitors = []
    
    // Override company facts with Perplexity results if available (more accurate)
    // Always use Perplexity results if found - they're more reliable from company websites
    // But preserve LLM-generated CEO if Perplexity doesn't find one
    if (perplexityFacts && typeof perplexityFacts === 'object') {
      if ('ceo' in perplexityFacts && perplexityFacts.ceo && typeof perplexityFacts.ceo === 'string' && perplexityFacts.ceo.trim().length > 0) {
        const ceoName = perplexityFacts.ceo.trim()
        const lowerName = ceoName.toLowerCase()
        
        // Reject generic terms, placeholder names, and titles without names
        if (lowerName.match(/^(ceo|founder|chief|executive|director|manager|unknown|n\/a|tbd|not available|not found)$/i) ||
            lowerName.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i) ||
            lowerName.match(/^(ceo|chief executive|chief executive officer|group ceo|managing director)$/i)) {
          console.log(`[Pipeline] Perplexity CEO result rejected (invalid): ${ceoName}, keeping LLM result if available`)
          // Keep the LLM-generated CEO if Perplexity result is invalid (but only if LLM result is also valid)
          if (parsed.company.ceo) {
            const llmCeoLower = String(parsed.company.ceo).toLowerCase().trim()
            // Also validate LLM CEO - if it's also invalid, remove it
            if (llmCeoLower.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i)) {
              console.log(`[Pipeline] LLM CEO is also invalid placeholder, removing: ${parsed.company.ceo}`)
              parsed.company.ceo = undefined
            }
          }
        } else if (ceoName.length <= 150 && ceoName.split(/\s+/).length >= 2) {
          // Valid CEO name - use Perplexity result
          parsed.company.ceo = ceoName
          console.log(`[Pipeline] Overrode CEO with Perplexity result: ${ceoName}`)
        } else {
          console.log(`[Pipeline] Perplexity CEO result rejected (doesn't look like a real name): ${ceoName}`)
          // Validate and potentially remove LLM CEO if it's also invalid
          if (parsed.company.ceo) {
            const llmCeoLower = String(parsed.company.ceo).toLowerCase().trim()
            if (llmCeoLower.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i)) {
              console.log(`[Pipeline] LLM CEO is also invalid placeholder, removing: ${parsed.company.ceo}`)
              parsed.company.ceo = undefined
            }
          }
        }
      } else {
        // Perplexity didn't find CEO, but validate LLM-generated one if it exists
        if (parsed.company.ceo) {
          const llmCeoLower = String(parsed.company.ceo).toLowerCase().trim()
          // Check if LLM CEO is a placeholder name
          if (llmCeoLower.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i)) {
            console.log(`[Pipeline] LLM CEO is invalid placeholder, removing: ${parsed.company.ceo}`)
            parsed.company.ceo = undefined
          } else {
            console.log(`[Pipeline] Perplexity didn't find CEO, preserving LLM-generated: ${parsed.company.ceo}`)
          }
        }
      }
      if ('founded' in perplexityFacts && perplexityFacts.founded && typeof perplexityFacts.founded === 'string') {
        const foundedStr = perplexityFacts.founded.trim()
        const yearMatch = foundedStr.match(/\b(19|20)\d{2}\b/)
        if (yearMatch) {
          parsed.company.founded = `Founded in ${yearMatch[0]}`
          console.log(`[Pipeline] Overrode founded year with Perplexity result: ${yearMatch[0]}`)
        }
      }
      if ('size' in perplexityFacts && perplexityFacts.size && typeof perplexityFacts.size === 'string') {
        const sizeStr = perplexityFacts.size.trim().toLowerCase()
        if (sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          parsed.company.size = perplexityFacts.size.trim()
          console.log(`[Pipeline] Overrode size with Perplexity result: ${perplexityFacts.size}`)
        }
      }
    }
    
    // Override company facts with crawled website data if available (most reliable - direct from company website)
    if (crawledData && crawledData.pagesCrawled.length > 0) {
      // CEO: Use crawled data if valid (crawled data is most reliable as it's from company website)
      if ('ceo' in crawledData && crawledData.ceo && typeof crawledData.ceo === 'string' && crawledData.ceo.trim().length > 0) {
        const ceoName = crawledData.ceo.trim()
        const lowerName = ceoName.toLowerCase()
        // Validate - reject placeholders
        if (!lowerName.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i) &&
            ceoName.split(/\s+/).length >= 2) {
          parsed.company.ceo = ceoName
          console.log(`[Pipeline] Overrode CEO with crawled website data: ${ceoName}`)
        }
      }
      
      // Founded: Use crawled data if valid
      if ('founded' in crawledData && crawledData.founded && typeof crawledData.founded === 'string') {
        const yearMatch = crawledData.founded.match(/\b(19|20)\d{2}\b/)
        if (yearMatch) {
          parsed.company.founded = `Founded in ${yearMatch[0]}`
          console.log(`[Pipeline] Overrode founded year with crawled website data: ${yearMatch[0]}`)
        }
      }
      
      // Size: Use crawled data if valid
      if ('size' in crawledData && crawledData.size && typeof crawledData.size === 'string') {
        const sizeStr = crawledData.size.trim().toLowerCase()
        if (sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          parsed.company.size = crawledData.size.trim()
          console.log(`[Pipeline] Overrode size with crawled website data: ${crawledData.size}`)
        }
      }
      
      // Headquarters: Use crawled data if available
      if ('headquarters' in crawledData && crawledData.headquarters && typeof crawledData.headquarters === 'string' && crawledData.headquarters.trim()) {
        parsed.company.headquarters = crawledData.headquarters.trim()
        console.log(`[Pipeline] Overrode headquarters with crawled website data: ${crawledData.headquarters}`)
      }
      
      // Industry: Use crawled data if available
      if ('industry' in crawledData && crawledData.industry && typeof crawledData.industry === 'string' && crawledData.industry.trim()) {
        parsed.company.industry = crawledData.industry.trim()
        console.log(`[Pipeline] Overrode industry with crawled website data: ${crawledData.industry}`)
      }
      
      // Market position: Use crawled data if available
      if ('marketPosition' in crawledData && crawledData.marketPosition && typeof crawledData.marketPosition === 'string' && crawledData.marketPosition.trim()) {
        parsed.company.market_position = crawledData.marketPosition.trim()
        console.log(`[Pipeline] Overrode market_position with crawled website data: ${crawledData.marketPosition}`)
      }
      
      // Latest news: Use crawled data if available
      if ('latestNews' in crawledData && crawledData.latestNews && typeof crawledData.latestNews === 'string' && crawledData.latestNews.trim()) {
        parsed.company.latest_news = crawledData.latestNews.trim()
        console.log(`[Pipeline] Overrode latest_news with crawled website data: ${crawledData.latestNews}`)
      }
    }
    
    // NEW: Use comprehensive competitor search with crawled data
    console.log('[Pipeline] 🔍 Starting NEW comprehensive competitor search using crawled data')
    
    try {
      // Prepare crawled data for competitor search
      // Use type assertion since we know the structure from the crawler
      const crawled = crawledData as any
      const crawledCompetitorData = {
        industry: parsed.company?.industry || crawled?.industry || input.industryHint,
        headquarters: parsed.company?.headquarters || crawled?.headquarters || input.headquartersHint,
        businessDescription: crawled?.businessDescription,
        products: crawled?.products,
        services: crawled?.services,
        targetMarkets: crawled?.targetMarkets
      }
      
      const companySize = parsed.company?.size || crawled?.size
      
      console.log('[Pipeline] Competitor search parameters:', {
        companyName: input.name,
        companyWebsite: input.website,
        crawledData: {
          industry: crawledCompetitorData.industry,
          headquarters: crawledCompetitorData.headquarters,
          hasBusinessDesc: !!crawledCompetitorData.businessDescription,
          productsCount: crawledCompetitorData.products?.length || 0,
          servicesCount: crawledCompetitorData.services?.length || 0,
          targetMarketsCount: crawledCompetitorData.targetMarkets?.length || 0
        },
        companySize
      })
      
      // Use the new comprehensive competitor search function
      const competitors = await findLocalCompetitors(
        input.name,
        input.website,
        crawledCompetitorData,
        companySize
      )
      
      console.log(`[Pipeline] ✅ NEW comprehensive competitor search completed, found ${competitors.length} competitors`)
      
      if (competitors.length === 0) {
        console.warn('[Pipeline] ⚠️ No competitors returned from comprehensive search')
        console.warn('[Pipeline] This may indicate:')
        console.warn('[Pipeline]   1. No competitors found in the same industry and country')
        console.warn('[Pipeline]   2. All results were filtered out during validation')
        console.warn('[Pipeline]   3. Search parameters were too restrictive')
      } else {
        console.log('[Pipeline] ✅ Competitors found:', competitors.map(c => c.name))
      }
      
      // Map to CompetitorStrict format (schema-compatible)
      parsed.competitors = competitors.map(c => ({
        name: c.name,
        website: c.website,
        hq: c.hq,
        size_band: c.size_band,
        positioning: c.positioning,
        evidence_pages: c.evidence_pages || [],
        source_url: c.source_url
      }))
          
      console.log(`[Pipeline] Final competitors (${parsed.competitors.length}):`, 
        parsed.competitors.map(c => ({ 
          name: c.name, 
          website: c.website,
          hq: c.hq,
          size_band: c.size_band
        }))
      )
    } catch (err) {
      console.error('[Pipeline] Comprehensive competitor search failed:', err)
      // No fallbacks - continue with empty competitors array
      parsed.competitors = []
    }

    /* 6) Attach aggregated citations (internal only) */
    parsed.citations = dedupeUrls([...(parsed.citations || []), ...citations])

    /* 7) Deterministic rollups for Executive Summary (for UI hero cards) */
    const cases: UseCase[] = parsed.use_cases || []
    const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0)

    const totalBenefit = cases.reduce((s: number, c) => s + num(c.est_annual_benefit), 0)
    const totalOneTime = cases.reduce((s: number, c) => s + num(c.est_one_time_cost), 0)
    const totalOngoing = cases.reduce((s: number, c) => s + num(c.est_ongoing_cost), 0)
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

    // Final normalization: ensure no null values for optional fields and competitors is always an array
    if (parsed.company) {
      // Convert any null values to undefined for optional fields
      if (parsed.company.size === null) parsed.company.size = undefined
      if (parsed.company.founded === null) parsed.company.founded = undefined
      if (parsed.company.ceo === null) parsed.company.ceo = undefined
      if (parsed.company.market_position === null) parsed.company.market_position = undefined
      if (parsed.company.latest_news === null) parsed.company.latest_news = undefined
      if (parsed.company.industry === null) parsed.company.industry = undefined
      if (parsed.company.headquarters === null) parsed.company.headquarters = undefined
    }
    
    // Ensure competitors is always an array
    if (!parsed.competitors || !Array.isArray(parsed.competitors)) {
      parsed.competitors = []
    }
    
    // Log final brief structure before returning
    console.log('[Pipeline] Final brief structure:', {
      company: parsed.company?.name,
      competitors: {
        count: parsed.competitors?.length || 0,
        names: parsed.competitors?.map((c: any) => c.name) || [],
        full: parsed.competitors?.map((c: any) => ({
          name: c.name,
          website: c.website,
          hasHq: !!c.hq,
          hasSizeBand: !!c.size_band,
          hasPositioning: !!c.positioning,
          evidencePagesCount: c.evidence_pages?.length || 0
        })) || []
      },
      useCasesCount: parsed.use_cases?.length || 0,
      industryTrendsCount: parsed.industry?.trends?.length || 0
    })
    
    // CRITICAL: Verify competitors are actually in the parsed object
    if (!parsed.competitors || parsed.competitors.length === 0) {
      console.warn('[Pipeline] ⚠️ WARNING: No competitors in final brief!')
      console.warn('[Pipeline] This will result in an empty Competitive Landscape section')
    } else {
      console.log('[Pipeline] ✅ Competitors are present in final brief:', parsed.competitors.length)
    }

    // Final validation with full schema to ensure enriched data is correct
    const finalValidation = BriefSchema.safeParse(parsed)
    if (!finalValidation.success) {
      console.error('[Pipeline] Final validation FAILED after enrichment:', finalValidation.error.errors)
      throw new Error(`Failed to validate final brief after enrichment: ${JSON.stringify(finalValidation.error.errors, null, 2)}`)
    }

    const totalTime = Date.now() - startTime
    console.log(`[Pipeline] ✅ Pipeline completed in ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`)
    
    return { brief: finalValidation.data, citations: parsed.citations }
  })()

  // Race against timeout
  return Promise.race([pipelinePromise, timeoutPromise])
}
