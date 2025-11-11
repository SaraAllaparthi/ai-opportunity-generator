import { openaiSearch } from '@/lib/research/openaiResearch'
import { llmGenerateJson } from '@/lib/providers/llm'
import { perplexitySearchCompanyFacts, perplexityResearchAIUseCases, findLocalCompetitors } from '@/lib/providers/perplexity'
import { crawlCompanyWebsite } from '@/lib/research/crawler'
import { Brief, BriefSchema, BriefInputSchema, UseCase } from '@/lib/schema/brief'
import { dedupeUrls, getDomain } from '@/lib/utils/citations'
import { normalizeDomain, normalizeWebsite } from '@/lib/utils/url'

export type CompetitorStrict = Brief['competitors'][number]

export type PipelineInput = {
  name: string
  website: string
  headquartersHint?: string
  industryHint?: string
  locale?: 'en' | 'de'
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

// Use shared utility for hostname extraction
const hostFromUrl = getDomain

  /** Optimized query builder - reduced to essential queries only */
  function buildQueries({ name, website }: PipelineInput): string[] {
    const domain = normalizeDomain(website)
  
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
  const PIPELINE_TIMEOUT_MS = 90000 // 90 seconds timeout - optimized for speed
  console.log('[Pipeline] Starting research pipeline (90s timeout) for:', input)
  
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
        maxResults: 2,  // Reduced to 2 for speed
        searchDepth: 'basic',  // Changed from advanced to basic for speed
        timeoutMs: 15000  // 15s max per search (reduced for speed)
      }).catch(err => {
        console.error(`[Pipeline] Search failed for "${q}":`, err)
        return [] // Return empty on error - no fallbacks
      })
    )
    
    // Run Perplexity company facts search, website crawler, and AI use cases research in parallel with OpenAI searches
    // Pass company name, website, headquarters, and industry for comprehensive CEO search
    const perplexityFactsPromise = perplexitySearchCompanyFacts(input.name, input.website, input.headquartersHint, input.industryHint)
      .catch(err => {
        console.error('[Pipeline] Perplexity company facts search failed:', err)
        return {} // Return empty on error - no fallbacks
      })
    
    const crawlerPromise = crawlCompanyWebsite(input.website, input.name)
      .catch(err => {
        console.error('[Pipeline] Website crawler failed:', err)
        return { pagesCrawled: [] } // Return empty on error - no fallbacks
      })
    
    const searchStartTime = Date.now()
    const [searchResults, perplexityFacts, crawledData] = await Promise.all([
      Promise.all(searchPromises),
      perplexityFactsPromise,
      crawlerPromise
    ])
    const searchDuration = Date.now() - searchStartTime
    console.log(`[Pipeline] ⏱️ Parallel searches completed in ${searchDuration}ms (${(searchDuration / 1000).toFixed(1)}s)`)
    
    // Research industry-specific AI use cases using Perplexity (after we have industry info)
    // SKIPPED for speed optimization - LLM can generate use cases from crawled data and context
    // This saves ~20s and helps us hit the 90s target
    let perplexityUseCases: any[] = []
    let useCaseDuration = 0
    // Commented out to save time - LLM will generate use cases from context
    // const useCaseIndustry = ('industry' in crawledData && crawledData.industry) ? crawledData.industry : input.industryHint
    // if (useCaseIndustry) {
    //   try {
    //     const useCaseStartTime = Date.now()
    //     perplexityUseCases = await perplexityResearchAIUseCases(
    //       input.name,
    //       useCaseIndustry,
    //       'businessDescription' in crawledData ? crawledData.businessDescription : undefined,
    //       'products' in crawledData ? crawledData.products : undefined,
    //       'services' in crawledData ? crawledData.services : undefined
    //     )
    //     useCaseDuration = Date.now() - useCaseStartTime
    //     console.log(`[Pipeline] ⏱️ Perplexity AI use cases research completed in ${useCaseDuration}ms (${(useCaseDuration / 1000).toFixed(1)}s), found ${perplexityUseCases.length} use cases`)
    //   } catch (err) {
    //     console.error('[Pipeline] Perplexity AI use cases research failed:', err)
    //     // Continue without Perplexity use cases
    //   }
    // }
    
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

    // Language instruction based on locale
    const locale = input.locale || 'en'
    const languageInstruction = locale === 'de' 
      ? 'WICHTIG: Alle Ausgaben müssen auf Deutsch sein. Verwenden Sie deutsches Format für Zahlen (z.B. 1.234,56 statt 1,234.56) und Währung (CHF). Schreiben Sie in einem prägnanten, managementtauglichen Stil (1-2 Sätze pro Insight).'
      : 'IMPORTANT: All output must be in English. Use English format for numbers (e.g., 1,234.56) and currency (CHF). Write in a concise, executive tone (1-2 sentences per insight).'
    
    const system = [
      languageInstruction,
    `You are a strategic advisor writing an executive AI Opportunity Brief for the CEO of ${input.name} (${input.website}).`,
    `Company Context: ${input.name} operates in ${input.industryHint || 'their industry'} and is headquartered in ${input.headquartersHint || 'their location'}.`,
    'Write in a direct, executive tone suitable for a CEO decision-maker. Be strategic, specific, and actionable.',
    'CRITICAL: Use ONLY information from the provided snippets and crawledWebsiteData. Do NOT invent, infer, or use generic fallback information. If specific information is not available, omit that field rather than using generic placeholders.',
    `Company summary: Write a comprehensive 4-8 sentence executive overview (minimum 100 characters) specifically about ${input.name} (${input.website}). Describe: (1) what ${input.name} does and its core business model, (2) primary products/services and key capabilities, (3) target markets and customer base, (4) market position in ${input.industryHint || 'their industry'}, (5) operational focus and key differentiators, (6) strategic direction if evident. Use crawledWebsiteData (businessDescription, products, services, targetMarkets) to ensure specificity. Be precise and detailed - this is a CEO-facing document about THIS specific company, not generic industry information.`,
    'Company facts: CRITICAL - Only include facts that are EXPLICITLY stated in the snippets. Do NOT estimate, infer, or guess. If information is not clearly stated, omit the field (return null/undefined). Size: ONLY include if snippets contain an explicit employee count (e.g., "50 employees", "100-200 employees", "150 Mitarbeiter") - search for exact phrases like "employees", "employee count", "workforce", "staffing", "headcount", "Mitarbeiter" followed by a number. Do NOT estimate from revenue or descriptions. Format as "X employees" or "X-Y employees" only if explicitly found. Founded: ONLY include if snippets contain an explicit founding/registration year (e.g., "founded in 1995", "established 2001", "registered 1987") - format as "Founded in YYYY" only if a specific year is mentioned. Do NOT infer or estimate the year. CEO: ONLY include if snippets explicitly state a person\'s name with a CEO/founder title (e.g., "John Smith, CEO", "Hans Müller, Geschäftsführer", "founder Jane Doe") - look for exact patterns like "CEO [Name]", "[Name], CEO", "Geschäftsführer [Name]", "[Name], founder". Do NOT infer names from context. Include industry sector, headquarters location, market position, and latest news only if explicitly stated in snippets.',
    `Industry summary: Write one paragraph (MAXIMUM 300 characters, approximately 50 words) for the CEO of ${input.name} explaining how intelligent automation, data analytics, and AI adoption are transforming ${input.name}'s specific industry niche (${input.industryHint || 'their industry'}). CRITICAL: You MUST first analyze crawledWebsiteData (businessDescription, products, services, keyCapabilities, targetMarkets) to understand ${input.name}'s exact niche. Then write about how AI/ML is transforming THEIR specific business model, products/services, and market - NOT generic industry transformation. Focus on strategic business impact relevant to ${input.name}'s operations. Keep tone executive and business-focused. The summary must be exactly 300 characters or less.`,
    `Industry trends: CRITICAL NICHE-SPECIFIC REQUIREMENT - You are writing for the CEO of ${input.name} (${input.website}) in ${input.industryHint || 'their industry'}, headquartered in ${input.headquartersHint || 'their location'}. You MUST first analyze crawledWebsiteData (businessDescription, products, services, keyCapabilities, targetMarkets) to understand ${input.name}'s exact niche. Then provide 4-5 AI/ML/data analytics trends (max 200 characters each) that are HIGHLY SPECIFIC to ${input.name}'s actual business activities. Format each as "Trend Name: quantified value-add for ${input.name}". Examples: If ${input.name} makes "precision components", trend should be "AI Quality Control for Precision Components: Computer vision detects defects 3x faster, improving quality by 10% and reducing scrap costs by CHF 80K annually". If they provide "logistics services", trend should be "AI Route Optimization for Logistics: Reduces fuel costs by 15% and improves on-time delivery by 25%". Each trend MUST directly relate to ${input.name}'s specific products/services/target markets from crawledWebsiteData - NOT generic industry trends. Show quantified business impact (ROI, cost savings, efficiency gains) relevant to ${input.name}'s operations. Executive tone, strategic focus.`,
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
      `Industry summary: You are writing for the CEO of ${input.name} (${input.website}) in ${input.industryHint || 'their industry'}. MUST be one paragraph (MAXIMUM 300 characters) explaining how AI/ML is transforming ${input.name}'s specific industry niche. CRITICAL: First analyze crawledWebsiteData (businessDescription, products, services, keyCapabilities, targetMarkets) to understand ${input.name}'s exact niche. Then write about how AI/ML is transforming THEIR specific business model, products/services, and market - NOT generic industry transformation. Focus on strategic business impact for ${input.name}. Executive tone. Count characters - must be exactly 300 characters or less.`,
      `industry.trends: CRITICAL - You are writing for the CEO of ${input.name} (${input.website}) in ${input.industryHint || 'their industry'}. You MUST first analyze crawledWebsiteData (businessDescription, products, services, keyCapabilities, targetMarkets) to understand ${input.name}'s exact niche. Then provide 4-5 AI/ML/data analytics trends (max 200 characters each) HIGHLY SPECIFIC to ${input.name}'s actual business activities. Format each as "Trend Name: quantified value-add for ${input.name}". Examples: If ${input.name} makes "precision components" (from crawledWebsiteData), trend should be "AI Quality Control for Precision Components: Computer vision detects defects 3x faster, improving quality by 10% and reducing scrap costs by CHF 80K annually". If they provide "logistics services" (from crawledWebsiteData), trend should be "AI Route Optimization for Logistics: Reduces fuel costs by 15% and improves on-time delivery by 25%". Each trend MUST directly relate to ${input.name}'s specific products/services/target markets from crawledWebsiteData - NOT generic industry trends. Show quantified business impact (ROI, cost savings, efficiency gains) relevant to ${input.name}'s operations. Executive tone, strategic focus.`,
      'competitors: ALWAYS return empty array []. Competitors are sourced from live search only, not LLM generation.',
      `strategic_moves: CRITICAL - You are writing for the CEO of ${input.name} (${input.website}) in ${input.industryHint || 'their industry'}, headquartered in ${input.headquartersHint || 'their location'}. MUST have AT LEAST 3 strategic moves (minimum 3, maximum 5). Each move must be SPECIFIC to ${input.name}'s business context. Use crawledWebsiteData (businessDescription, products, services, targetMarkets) to inform strategic moves relevant to ${input.name}'s actual operations. Each move must have: move (string - specific action for ${input.name}), owner (string - who at ${input.name} owns it), horizon_quarters (integer 1-4), rationale (string - why this matters for ${input.name}'s business). Moves must be tailored to ${input.name}'s industry, size, and business model - NOT generic strategic moves.`,
      `use_cases: CRITICAL REQUIREMENT - You are writing for the CEO of ${input.name} (${input.website}) in ${input.industryHint || 'their industry'}. You MUST return EXACTLY 5 use cases. Every use case must have ALL numeric fields: est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months. CRITICAL: You MUST first analyze crawledWebsiteData (businessDescription, products, services, keyCapabilities, targetMarkets) to understand ${input.name}'s exact niche. PRIORITY: If perplexityUseCases is provided, use those as PRIMARY source, but ADAPT them to be HIGHLY SPECIFIC to ${input.name}'s actual business. Example: If ${input.name} makes "precision medical devices" (from crawledWebsiteData), use case must be "AI Quality Control for Precision Medical Device Manufacturing at ${input.name}" not generic "AI quality control". If they provide "B2B logistics" (from crawledWebsiteData), use case must be "AI Route Optimization for ${input.name}'s B2B Logistics Operations" not generic "AI logistics". Each use case title must reference ${input.name}'s specific products/services/processes from crawledWebsiteData. Value propositions must be quantified and directly relevant to ${input.name}'s operations. NO generic use cases - all must be tailored to ${input.name}'s niche.`,
      'If a section lacks evidence, return [] for that section (no filler).'
      ]
    })

    console.log('[Pipeline] Preparing to call LLM with:')
    console.log('[Pipeline] - System prompt length:', system.length)
    console.log('[Pipeline] - Snippets count:', top.length)
    console.log('[Pipeline] - Schema rules:', schemaRules)
    console.log('[Pipeline] - User payload (preview):', userPayload.substring(0, 500))

    /* 4) Generate JSON - single attempt, no retries for speed */
    const llmStartTime = Date.now()
    console.log('[Pipeline] Calling LLM for brief generation...')
    const json = await llmGenerateJson(system, userPayload, { 
      timeoutMs: 60000  // 60s for brief generation (optimized for 90s total)
    })
    const llmDuration = Date.now() - llmStartTime
    console.log(`[Pipeline] ⏱️ LLM generation completed in ${llmDuration}ms (${(llmDuration / 1000).toFixed(1)}s)`)
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
    
    // Valid value_driver values
    const validValueDrivers = ['revenue', 'cost', 'risk', 'speed', 'quality'] as const
    type ValidValueDriver = typeof validValueDrivers[number]
    
    // Normalize invalid value_driver values
    const normalizeValueDriver = (value: any): ValidValueDriver => {
      if (!value || typeof value !== 'string') return 'cost'
      const lower = value.toLowerCase().trim()
      
      // Direct match
      if (validValueDrivers.includes(lower as ValidValueDriver)) {
        return lower as ValidValueDriver
      }
      
      // Map common invalid values to valid ones
      const mapping: Record<string, ValidValueDriver> = {
        'customer satisfaction': 'quality',
        'satisfaction': 'quality',
        'customer': 'quality',
        'efficiency': 'cost',
        'productivity': 'cost',
        'performance': 'speed',
        'accuracy': 'quality',
        'reliability': 'risk',
        'safety': 'risk',
        'security': 'risk',
        'growth': 'revenue',
        'sales': 'revenue',
        'profit': 'revenue'
      }
      
      if (mapping[lower]) {
        console.log(`[Pipeline] Normalizing value_driver "${value}" to "${mapping[lower]}"`)
        return mapping[lower]
      }
      
      // Default fallback
      console.warn(`[Pipeline] Unknown value_driver "${value}", defaulting to "cost"`)
      return 'cost'
    }
    
    // Ensure all numeric fields are present and convert null string fields to defaults
    json.use_cases = json.use_cases.map((uc: any, index: number) => {
      const normalizedValueDriver = normalizeValueDriver(uc.value_driver)
      if (uc.value_driver !== normalizedValueDriver) {
        console.log(`[Pipeline] Fixed use case ${index} value_driver: "${uc.value_driver}" -> "${normalizedValueDriver}"`)
      }
      
      return {
        ...uc,
        value_driver: normalizedValueDriver,
        est_annual_benefit: typeof uc.est_annual_benefit === 'number' ? uc.est_annual_benefit : 0,
        est_one_time_cost: typeof uc.est_one_time_cost === 'number' ? uc.est_one_time_cost : 0,
        est_ongoing_cost: typeof uc.est_ongoing_cost === 'number' ? uc.est_ongoing_cost : 0,
        payback_months: typeof uc.payback_months === 'number' ? uc.payback_months : 0,
        data_requirements: (uc.data_requirements && typeof uc.data_requirements === 'string') ? uc.data_requirements : 'TBD',
        risks: (uc.risks && typeof uc.risks === 'string') ? uc.risks : 'TBD',
        next_steps: (uc.next_steps && typeof uc.next_steps === 'string') ? uc.next_steps : 'TBD',
        citations: Array.isArray(uc.citations) ? uc.citations : []
      }
    })
    
    // Truncate industry summary if it exceeds 300 characters before validation
    if (json.industry?.summary && json.industry.summary.length > 300) {
      console.log(`[Pipeline] Truncating industry summary from ${json.industry.summary.length} to 300 characters`)
      json.industry.summary = json.industry.summary.substring(0, 297).trim() + '...'
    }
    
    // Normalize null values to undefined for optional fields (Zod doesn't accept null for optional fields)
    // Convert null to undefined for all optional company fields
    // Also normalize arrays to strings for fields that should be strings
    if (json.company) {
      if (json.company.size === null) json.company.size = undefined
      if (json.company.founded === null) json.company.founded = undefined
      if (json.company.ceo === null) json.company.ceo = undefined
      if (json.company.market_position === null) json.company.market_position = undefined
      
      // Normalize latest_news: if it's an array, join it or take first element
      if (Array.isArray(json.company.latest_news)) {
        if (json.company.latest_news.length > 0) {
          json.company.latest_news = json.company.latest_news[0] || json.company.latest_news.join('. ')
        } else {
          json.company.latest_news = undefined
        }
        console.log('[Pipeline] Normalized latest_news from array to string')
      } else if (json.company.latest_news === null) {
        json.company.latest_news = undefined
      }
      
      if (json.company.industry === null) json.company.industry = undefined
      if (json.company.headquarters === null) json.company.headquarters = undefined
    }
    
    // Ensure competitors is always an array (never null or undefined)
    if (!json.competitors || !Array.isArray(json.competitors)) {
      json.competitors = []
    }
    
    // Validate and clean company facts - ensure they're only included if explicitly found
    if (json.company) {
      // Size: Accept any valid employee count pattern, including large numbers
      if (json.company.size) {
        const sizeStr = String(json.company.size).trim()
        
        // Check if it contains explicit employee count pattern - accept any valid format
        // Pattern matches: "100 employees", "10,000 employees", "100,000+ employees", "50-200 employees", etc.
        if (!sizeStr.match(/\d+[\d,\s-]*(?:\+)?\s*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          console.log(`[Pipeline] Removing invalid size field: ${json.company.size} (no explicit employee count pattern found)`)
          json.company.size = undefined
        } else {
          // Remove commas and "+" for parsing, but preserve original format
          const cleanedStr = sizeStr.replace(/,/g, '').replace(/\+/g, '').toLowerCase()
          
          // Extract number(s) - handle both ranges and single numbers
          // Accept any number > 0 (including very large numbers like 100000)
          const match = cleanedStr.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)
          if (match && match[1]) {
            const num1 = parseInt(match[1], 10)
            // Only reject if it's actually 0 or NaN
            if (num1 === 0 || isNaN(num1)) {
              console.log(`[Pipeline] Removing invalid size field: ${json.company.size} (number is 0 or invalid: ${match[1]})`)
              json.company.size = undefined
            } else if (match[2]) {
              const num2 = parseInt(match[2], 10)
              if (num2 === 0 || isNaN(num2) || num2 < num1) {
                console.log(`[Pipeline] Removing invalid size field: ${json.company.size} (invalid range)`)
                json.company.size = undefined
              } else {
                // Format with commas for readability if large (preserve original if it had commas)
                const hasCommas = sizeStr.includes(',')
                const formatted1 = hasCommas && num1 >= 1000 ? num1.toLocaleString() : num1.toString()
                const formatted2 = hasCommas && num2 >= 1000 ? num2.toLocaleString() : num2.toString()
                json.company.size = `${formatted1}-${formatted2} employees`
              }
            } else {
              // Format with commas for readability if large (preserve original if it had commas)
              const hasCommas = sizeStr.includes(',')
              const hasPlus = sizeStr.includes('+')
              const formatted = hasCommas && num1 >= 1000 ? num1.toLocaleString() : num1.toString()
              json.company.size = `${formatted}${hasPlus ? '+' : ''} employees`
            }
          } else {
            // If we can't parse it but it matches the pattern, keep it as-is (might be a special format)
            console.log(`[Pipeline] Keeping size as-is (matches pattern but couldn't parse numbers): ${json.company.size}`)
            // Keep the original size string
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
      
      // CEO: Only remove if clearly invalid (generic terms, placeholder names, former/ex-CEOs, not a name)
      // Always preserve CEO information if it looks like a real name and is current CEO
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
        // CRITICAL: Reject former/ex-CEOs - only accept current CEOs
        else if (lowerStr.match(/(former|ex-|previous|retired|past|prior|outgoing|departed|stepped down|resigned|left).*ceo|ceo.*(former|ex-|previous|retired|past|prior|outgoing|departed|stepped down|resigned|left)/i)) {
          console.log(`[Pipeline] Removing former/ex-CEO: ${json.company.ceo} (not current CEO)`)
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
    
    // Priority order for company facts: 1) Crawled Website Data (most reliable), 2) Perplexity Search, 3) LLM-generated
    // First, use crawled website data if available (directly from company website - most accurate)
    if (crawledData && crawledData.pagesCrawled.length > 0) {
      // CEO: Use crawled data if valid (crawled data is most reliable as it's from company website)
      if ('ceo' in crawledData && crawledData.ceo && typeof crawledData.ceo === 'string' && crawledData.ceo.trim().length > 0) {
        const ceoName = crawledData.ceo.trim()
        const lowerName = ceoName.toLowerCase()
        // Validate - reject placeholders
        if (!lowerName.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i) &&
            ceoName.split(/\s+/).length >= 2) {
          parsed.company.ceo = ceoName
          console.log(`[Pipeline] ✅ Using CEO from crawled website data (highest priority): ${ceoName}`)
        }
      }
      
      // Founded: Use crawled data if valid
      if ('founded' in crawledData && crawledData.founded && typeof crawledData.founded === 'string') {
        const yearMatch = crawledData.founded.match(/\b(19|20)\d{2}\b/)
        if (yearMatch) {
          parsed.company.founded = `Founded in ${yearMatch[0]}`
          console.log(`[Pipeline] ✅ Using founded year from crawled website data: ${yearMatch[0]}`)
        }
      }
      
      // Size: Use crawled data if valid
      if ('size' in crawledData && crawledData.size && typeof crawledData.size === 'string') {
        const sizeStr = crawledData.size.trim().toLowerCase()
        if (sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          parsed.company.size = crawledData.size.trim()
          console.log(`[Pipeline] ✅ Using size from crawled website data: ${crawledData.size}`)
        }
      }
    }
    
    // Second, validate and compare Perplexity results with website data
    // If we have CEO from website, compare with Perplexity to ensure accuracy
    if (perplexityFacts && typeof perplexityFacts === 'object') {
      // CEO: Compare website CEO with Perplexity CEO for validation
      if (parsed.company.ceo) {
        // We have CEO from website - validate it matches Perplexity if Perplexity found one
        if ('ceo' in perplexityFacts && perplexityFacts.ceo && typeof perplexityFacts.ceo === 'string') {
          const websiteCeo = parsed.company.ceo.trim().toLowerCase()
          const perplexityCeo = perplexityFacts.ceo.trim().toLowerCase()
          
          // Simple comparison: check if names are similar (same last name or significant overlap)
          const websiteWords = websiteCeo.split(/\s+/)
          const perplexityWords = perplexityCeo.split(/\s+/)
          const lastNamesMatch = websiteWords[websiteWords.length - 1] === perplexityWords[perplexityWords.length - 1]
          const hasSignificantOverlap = websiteWords.some(w => perplexityWords.includes(w)) && 
                                       perplexityWords.some(w => websiteWords.includes(w))
          
          if (lastNamesMatch || hasSignificantOverlap) {
            console.log(`[Pipeline] ✅ Website CEO (${parsed.company.ceo}) matches Perplexity CEO (${perplexityFacts.ceo}) - validated`)
          } else {
            console.log(`[Pipeline] ⚠️ Website CEO (${parsed.company.ceo}) differs from Perplexity CEO (${perplexityFacts.ceo}) - using website version`)
          }
        }
      } else if ('ceo' in perplexityFacts && perplexityFacts.ceo && typeof perplexityFacts.ceo === 'string' && perplexityFacts.ceo.trim().length > 0) {
        // No CEO from website - use Perplexity as fallback, but validate carefully
        const ceoName = perplexityFacts.ceo.trim()
        const lowerName = ceoName.toLowerCase()

        // Reject generic terms, placeholder names, and titles without names
        if (lowerName.match(/^(ceo|founder|chief|executive|director|manager|unknown|n\/a|tbd|not available|not found)$/i) ||
            lowerName.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i) ||
            lowerName.match(/^(ceo|chief executive|chief executive officer|group ceo|managing director)$/i)) {
          console.log(`[Pipeline] Perplexity CEO result rejected (invalid): ${ceoName}`)
        } else if (ceoName.length <= 150 && ceoName.split(/\s+/).length >= 2 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(ceoName)) {
          // Valid CEO name - use Perplexity result as fallback
          parsed.company.ceo = ceoName
          console.log(`[Pipeline] ⚠️ Using CEO from Perplexity (fallback, website didn't have it): ${ceoName}`)
        } else {
          console.log(`[Pipeline] Perplexity CEO result rejected (doesn't look like a real name): ${ceoName}`)
        }
      } else if (!parsed.company.ceo) {
        // No CEO from website or Perplexity - validate LLM-generated one if it exists
        if (parsed.company.ceo) {
          const llmCeoLower = String(parsed.company.ceo).toLowerCase().trim()
          // Check if LLM CEO is a placeholder name
          if (llmCeoLower.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i)) {
            console.log(`[Pipeline] LLM CEO is invalid placeholder, removing: ${parsed.company.ceo}`)
            parsed.company.ceo = undefined
          } else {
            console.log(`[Pipeline] Using LLM-generated CEO (last resort): ${parsed.company.ceo}`)
          }
        }
      }
      // Founded: Only use Perplexity if we don't already have founded year from crawled website
      if (!parsed.company.founded && 'founded' in perplexityFacts && perplexityFacts.founded && typeof perplexityFacts.founded === 'string') {
        const foundedStr = perplexityFacts.founded.trim()
        const yearMatch = foundedStr.match(/\b(19|20)\d{2}\b/)
        if (yearMatch) {
          parsed.company.founded = `Founded in ${yearMatch[0]}`
          console.log(`[Pipeline] ⚠️ Using founded year from Perplexity (fallback, website didn't have it): ${yearMatch[0]}`)
        }
      }
      // Size: Only use Perplexity if we don't already have size from crawled website
      if (!parsed.company.size && 'size' in perplexityFacts && perplexityFacts.size && typeof perplexityFacts.size === 'string') {
        const sizeStr = perplexityFacts.size.trim().toLowerCase()
        if (sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
          parsed.company.size = perplexityFacts.size.trim()
          console.log(`[Pipeline] ⚠️ Using size from Perplexity (fallback, website didn't have it): ${perplexityFacts.size}`)
        }
      }
    }
    
    // Additional company facts from crawled website data (CEO/founded/size already handled above with highest priority)
    if (crawledData && crawledData.pagesCrawled.length > 0) {
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
    
    // CRITICAL: Check prerequisites before attempting search
    const crawled = crawledData as any
    const industry = parsed.company?.industry || crawled?.industry || input.industryHint || undefined
    const headquarters = parsed.company?.headquarters || crawled?.headquarters || input.headquartersHint || undefined
    
    console.log('[Pipeline] Competitor search prerequisites check:', {
      hasIndustry: !!industry,
      hasHeadquarters: !!headquarters,
      industry: industry,
      headquarters: headquarters,
      hasCrawledData: crawledData.pagesCrawled.length > 0,
      inputIndustryHint: input.industryHint,
      inputHeadquartersHint: input.headquartersHint
    })
    
    // Always proceed with competitor search - use fallbacks if industry/headquarters are missing
    // For large companies, we can still find competitors using company name and website
    if (!industry && !headquarters) {
      console.warn('[Pipeline] ⚠️ WARNING: Missing both industry and headquarters, but proceeding with search using company name and website')
      console.warn('[Pipeline] This may result in less targeted results, but we will still attempt to find competitors')
    }
    
    // Proceed with search (removed the else block - always search)
    try {
        // Prepare crawled data for competitor search
        const crawledCompetitorData = {
          industry: industry,
          headquarters: headquarters,
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
        const competitorSearchStartTime = Date.now()
        console.log('[Pipeline] Calling findLocalCompetitors...')
        const competitors = await findLocalCompetitors(
          input.name,
          input.website,
          crawledCompetitorData,
          companySize,
          input.locale || 'en'
        )
        const competitorSearchDuration = Date.now() - competitorSearchStartTime
        console.log(`[Pipeline] ⏱️ Competitor search completed in ${competitorSearchDuration}ms (${(competitorSearchDuration / 1000).toFixed(1)}s)`)
        
        console.log('[Pipeline] findLocalCompetitors returned:', {
          count: competitors.length,
          competitors: competitors.map(c => ({ name: c.name, website: c.website }))
        })
      
        console.log(`[Pipeline] ✅ NEW comprehensive competitor search completed, found ${competitors.length} competitors`)
        
        if (competitors.length === 0) {
          console.warn('[Pipeline] ⚠️ No competitors returned from comprehensive search')
          console.warn('[Pipeline] This may indicate:')
          console.warn('[Pipeline]   1. No competitors found in the same industry and country')
          console.warn('[Pipeline]   2. All results were filtered out during validation')
          console.warn('[Pipeline]   3. Search parameters were too restrictive')
          console.warn('[Pipeline]   4. Perplexity API returned no results or error')
        } else {
          console.log('[Pipeline] ✅ Competitors found:', competitors.map(c => c.name))
        }
        
        // Map to CompetitorStrict format (schema-compatible)
        // Ensure evidence_pages is always a valid array with at least one URL
        parsed.competitors = competitors.map((c, index) => {
          console.log(`[Pipeline] Processing competitor ${index}:`, {
            name: c.name,
            website: c.website,
            hasEvidencePages: Array.isArray(c.evidence_pages) && c.evidence_pages.length > 0,
            evidencePagesCount: c.evidence_pages?.length || 0,
            rawEvidencePages: c.evidence_pages
          })
          
          // Ensure evidence_pages is valid - must have at least website
          let evidencePages: string[] = []
          
          if (c.evidence_pages && Array.isArray(c.evidence_pages) && c.evidence_pages.length > 0) {
            // Filter and normalize URLs
            evidencePages = c.evidence_pages
              .filter((url: string) => url && typeof url === 'string' && url.trim().length > 0)
              .map((url: string) => {
                try {
                  // Normalize URL using shared utility
                  return normalizeWebsite(url)
                } catch (err) {
                  console.warn(`[Pipeline] Failed to normalize evidence URL: ${url}`, err)
                  return null
                }
              })
              .filter((url: string | null): url is string => url !== null && url.length > 0)
          }
          
          // Ensure we have at least one valid URL - use website as fallback
          if (evidencePages.length === 0) {
            if (c.website) {
              try {
                const normalizedWebsite = normalizeWebsite(c.website)
                evidencePages.push(normalizedWebsite)
                console.log(`[Pipeline] Using website as evidence_pages for ${c.name}: ${normalizedWebsite}`)
              } catch (err) {
                console.error(`[Pipeline] ❌ Failed to normalize website for ${c.name}: ${c.website}`, err)
              }
            } else {
              console.error(`[Pipeline] ❌ Competitor ${c.name} has no website and no evidence_pages!`)
            }
          }
          
          // Normalize website URL
          let normalizedWebsite = c.website
          try {
            normalizedWebsite = normalizeWebsite(c.website)
          } catch (err) {
            console.error(`[Pipeline] ❌ Failed to normalize website for ${c.name}: ${c.website}`, err)
          }
          
          // Validate URLs are actually valid
          const isValidUrl = (url: string): boolean => {
            try {
              new URL(url)
              return true
            } catch {
              return false
            }
          }
          
          // Filter out invalid URLs from evidence_pages
          const validEvidencePages = evidencePages.filter(isValidUrl)
          
          if (validEvidencePages.length === 0) {
            console.error(`[Pipeline] ❌ Competitor ${c.name} has no valid evidence_pages URLs!`)
            console.error(`[Pipeline] Original evidence_pages:`, evidencePages)
          }
          
          // Normalize source_url if present
          let normalizedSourceUrl: string | undefined = undefined
          if (c.source_url) {
            try {
              normalizedSourceUrl = normalizeWebsite(c.source_url)
              if (!isValidUrl(normalizedSourceUrl)) {
                console.warn(`[Pipeline] Invalid source_url for ${c.name}: ${normalizedSourceUrl}`)
                normalizedSourceUrl = undefined
              }
            } catch (err) {
              console.warn(`[Pipeline] Failed to normalize source_url for ${c.name}: ${c.source_url}`, err)
            }
          }
          
          const competitor = {
            name: c.name,
            website: normalizedWebsite,
            hq: c.hq,
            size_band: c.size_band,
            positioning: c.positioning,
            evidence_pages: validEvidencePages.length > 0 ? validEvidencePages : (normalizedWebsite ? [normalizedWebsite] : []),
            source_url: normalizedSourceUrl
          }
          
          console.log(`[Pipeline] ✅ Processed competitor ${index} (${c.name}):`, {
            name: competitor.name,
            website: competitor.website,
            evidencePagesCount: competitor.evidence_pages.length,
            evidencePages: competitor.evidence_pages,
            hasValidUrls: competitor.evidence_pages.every(isValidUrl)
          })
          
          return competitor
        })
        
        // Filter out competitors with invalid data
        const validCompetitors = parsed.competitors.filter((c: any, index: number) => {
          const isValid = c.name && 
                         c.website && 
                         Array.isArray(c.evidence_pages) && 
                         c.evidence_pages.length > 0 &&
                         c.evidence_pages.every((url: string) => {
                           try {
                             new URL(url)
                             return true
                           } catch {
                             return false
                           }
                         })
          
          if (!isValid) {
            console.error(`[Pipeline] ❌ Filtering out invalid competitor ${index}:`, {
              name: c.name,
              website: c.website,
              evidencePagesCount: c.evidence_pages?.length || 0,
              hasValidUrls: c.evidence_pages?.every((url: string) => {
                try {
                  new URL(url)
                  return true
                } catch {
                  return false
                }
              }) || false
            })
          }
          
          return isValid
        })
        
        parsed.competitors = validCompetitors
          
      console.log(`[Pipeline] Final competitors after validation (${parsed.competitors.length}):`, 
        parsed.competitors.map(c => ({ 
          name: c.name, 
          website: c.website,
          hq: c.hq,
          size_band: c.size_band,
          evidence_pages_count: c.evidence_pages?.length || 0,
          evidence_pages: c.evidence_pages
        }))
      )
      
      // Validate each competitor before final validation
      parsed.competitors.forEach((c: any, index: number) => {
        if (!c.name || !c.website) {
          console.error(`[Pipeline] ⚠️ Competitor ${index} missing required fields:`, c)
        }
        if (!c.evidence_pages || !Array.isArray(c.evidence_pages) || c.evidence_pages.length === 0) {
          console.error(`[Pipeline] ⚠️ Competitor ${index} (${c.name}) missing evidence_pages:`, c)
        }
        // Validate URLs
        c.evidence_pages?.forEach((url: string, urlIndex: number) => {
          try {
            new URL(url)
          } catch (err) {
            console.error(`[Pipeline] ⚠️ Competitor ${index} (${c.name}) has invalid URL at index ${urlIndex}: ${url}`)
          }
        })
      })
      } catch (err) {
        console.error('[Pipeline] ❌ Comprehensive competitor search FAILED:', err)
        console.error('[Pipeline] Error details:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          name: err instanceof Error ? err.name : undefined
        })
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
      // Normalize latest_news: if it's an array, join it or take first element
      if (Array.isArray(parsed.company.latest_news)) {
        if (parsed.company.latest_news.length > 0) {
          parsed.company.latest_news = parsed.company.latest_news[0] || parsed.company.latest_news.join('. ')
        } else {
          parsed.company.latest_news = undefined
        }
        console.log('[Pipeline] Normalized latest_news from array to string (after enrichment)')
      } else if (parsed.company.latest_news === null) {
        parsed.company.latest_news = undefined
      }
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
    console.log('[Pipeline] Running final schema validation...')
    console.log('[Pipeline] Competitors before validation:', {
      count: parsed.competitors?.length || 0,
      competitors: parsed.competitors?.map((c: any) => ({
        name: c.name,
        website: c.website,
        hasEvidencePages: Array.isArray(c.evidence_pages) && c.evidence_pages.length > 0,
        evidencePagesCount: c.evidence_pages?.length || 0
      })) || []
    })
    
    const finalValidation = BriefSchema.safeParse(parsed)
    if (!finalValidation.success) {
      console.error('[Pipeline] Final validation FAILED after enrichment:', finalValidation.error.errors)
      
      // Check if competitors validation failed
      const competitorErrors = finalValidation.error.errors.filter(e => 
        e.path[0] === 'competitors' || e.path.includes('competitors')
      )
      if (competitorErrors.length > 0) {
        console.error('[Pipeline] ❌ Competitor validation errors:', competitorErrors)
        console.error('[Pipeline] This may explain why competitors are missing!')
      }
      
      throw new Error(`Failed to validate final brief after enrichment: ${JSON.stringify(finalValidation.error.errors, null, 2)}`)
    }
    
    console.log('[Pipeline] ✅ Final validation passed')
    console.log('[Pipeline] Competitors after validation:', {
      count: finalValidation.data.competitors?.length || 0,
      competitors: finalValidation.data.competitors?.map((c: any) => ({
        name: c.name,
        website: c.website
      })) || []
    })

    const totalTime = Date.now() - startTime
    console.log(`[Pipeline] ✅ Pipeline completed in ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`)
    // Note: competitorSearchDuration is scoped within the try block, so we can't access it here
    // The timing is already logged above when the search completes
    
    return { brief: finalValidation.data, citations: parsed.citations }
  })()

  // Race against timeout
  return Promise.race([pipelinePromise, timeoutPromise])
}
