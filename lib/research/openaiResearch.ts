// OpenAI-based research module (replaces Tavily - not currently used)
// Returns structured ResearchSnippet format for compatibility

import { llmGenerateJson } from '@/lib/providers/llm'

export type ResearchSnippet = {
  title: string
  url: string
  content: string
  publishedAt?: string
}

type SearchOptions = {
  maxResults?: number
  timeoutMs?: number
  searchDepth?: 'basic' | 'advanced'
}

/**
 * OpenAI-based search that returns structured research snippets
 * Uses GPT-4o-mini to generate research results based on web knowledge
 */
export async function openaiSearch(
  query: string,
  opts?: SearchOptions
): Promise<ResearchSnippet[]> {
  const maxResults = opts?.maxResults ?? 8
  const searchDepth = opts?.searchDepth ?? 'basic'
  
  console.log('[OpenAI Research] Searching:', {
    query,
    maxResults,
    searchDepth
  })

  const system = `You are a research assistant that provides factual, web-based information with citations.
Your task is to search your knowledge base and return structured research results.
Return ONLY valid JSON matching the required schema.`

  const userPrompt = `Research query: "${query}"

Provide ${maxResults} relevant research results. Each result must include:
- title: A descriptive title for the source/page
- url: A valid, real URL for the source (use actual company websites, LinkedIn profiles, news sites, etc. - never fabricate URLs)
- content: A comprehensive summary (150-300 words) of the information found
- publishedAt: Publication date if available (YYYY-MM-DD format) or omit if unknown

Focus on:
1. Official company websites and verified sources
2. Recent information (2023-2025 when available)
3. Specific, factual content - not generic statements
4. Real URLs only - never create fictional domains

Return a JSON object with a "results" array containing the research results:
{
  "results": [
    {
      "title": "Company Name - About Page",
      "url": "https://example.com/about",
      "content": "Detailed summary of the information...",
      "publishedAt": "2024-01-15"
    },
    ...
  ]
}

Return ONLY the JSON object, no markdown, no explanations.`

  try {
    const response = await llmGenerateJson(system, userPrompt, {
      model: 'gpt-4o-mini',
      timeoutMs: 25000 // Reduced to 25s for speed optimization
    })

    // Handle JSON object responses (OpenAI with json_object format returns an object)
    let results: any[] = []
    if (response.results && Array.isArray(response.results)) {
      results = response.results
    } else if (response.data && Array.isArray(response.data)) {
      results = response.data
    } else if (Array.isArray(response)) {
      results = response
    } else {
      console.warn('[OpenAI Research] Unexpected response format:', response)
      return []
    }

    // Validate and map to ResearchSnippet format
    const snippets: ResearchSnippet[] = results
      .slice(0, maxResults)
      .filter((r: any) => r && r.title && r.url && r.content)
      .map((r: any) => ({
        title: String(r.title || '').trim(),
        url: String(r.url || '').trim(),
        content: String(r.content || '').trim(),
        publishedAt: r.publishedAt ? String(r.publishedAt).trim() : undefined
      }))
      .filter(s => s.title && s.url && s.content)

    console.log(`[OpenAI Research] Returning ${snippets.length} results for query: ${query}`)
    return snippets
  } catch (err: any) {
    console.error('[OpenAI Research] Error:', err?.message || String(err))
    // Return empty array on error for graceful degradation
    return []
  }
}

/**
 * Enhanced search for company-specific research
 * Returns structured data about the company, competitors, and industry
 */
export async function openaiCompanyResearch(
  companyName: string,
  website: string
): Promise<{
  company: {
    summary: string
    size?: string
    industry?: string
    headquarters?: string
    founded?: string
    ceo?: string
    market_position?: string
    latest_news?: string
  }
  competitors: Array<{
    name: string
    website: string
    positioning: string
    ai_maturity: string
    innovation_focus: string
    employee_band?: string
    geo_fit?: string
  }>
  industry: {
    summary: string
    trends: string[]
  }
}> {
  const system = `You are a business research analyst writing for the CEO of ${companyName} (${website}).
Provide factual, structured information about ${companyName} based on real, verifiable sources.
Never fabricate URLs or company details. Return ONLY valid JSON matching the required schema.
Do NOT use generic fallback information - if specific information is not available, omit that field.`

  const userPrompt = `Research company: ${companyName} (${website})

You are writing an executive brief for the CEO of ${companyName}. Provide comprehensive research SPECIFIC to ${companyName} in this JSON structure:
{
  "company": {
    "summary": "Comprehensive 4-8 sentence executive overview (minimum 100 characters) specifically about ${companyName}. Cover: business model, products/services, target markets, market position, operations, strategic focus. Be specific to ${companyName}, not generic industry information.",
    "size": "Employee count in format 'X employees' or 'X-Y employees' (ONLY if explicitly found - do NOT estimate)",
    "industry": "Primary industry sector for ${companyName} (if explicitly stated)",
    "headquarters": "City, Country for ${companyName} (if explicitly stated)",
    "founded": "Founded in YYYY format (ONLY if explicit year found - do NOT infer)",
    "ceo": "CEO/Founder name (ONLY if explicitly stated with title - do NOT infer)",
    "market_position": "Market position/leadership info for ${companyName} (if explicitly stated)",
    "latest_news": "One recent news point about ${companyName} (if available)"
  },
  "competitors": [
    {
      "name": "Real company name",
      "website": "Valid homepage URL (https://...)",
      "positioning": "One sentence: what they do and for whom",
      "ai_maturity": "One short phrase (e.g., 'Basic automation', 'Digital process monitoring')",
      "innovation_focus": "One short phrase (e.g., 'Process efficiency', 'Customer-specific solutions')",
      "employee_band": "50-200 employees" format (if available)",
      "geo_fit": "Country/region match"
    }
  ],
  "industry": {
    "summary": "One paragraph (20-300 characters) for the CEO of ${companyName} explaining how intelligent automation, data analytics, and AI adoption are transforming ${companyName}'s specific industry niche. Focus on business transformation relevant to ${companyName}'s operations, not generic industry statements.",
    "trends": [
      "AI-driven predictive maintenance reduces downtime by 20%",
      "Smart factories use ML to optimize production schedules",
      "AI forecasting improves inventory accuracy by 30%",
      "Sustainability analytics help meet compliance faster",
      "Digital twins enable real-time process optimization"
    ]
  }
}

CRITICAL REQUIREMENTS:
- company.summary: MUST be ≥100 characters, SPECIFIC to ${companyName}
- industry.summary: MUST be 20-300 characters, SPECIFIC to ${companyName}'s industry niche
- industry.trends: MUST be exactly 4-5 items (max 15 words each), SPECIFIC to ${companyName}'s industry
- competitors: Return 2-3 real companies from same industry/geography (≤500 employees). All must have valid website URLs.
- Never fabricate URLs - use real company websites
- Focus on SMB/mid-market companies (≤500 employees)
- Do NOT use generic fallback information - if specific information is not available, omit that field

Return ONLY the JSON object, no markdown, no explanations.`

  try {
    const response = await llmGenerateJson(system, userPrompt, {
      model: 'gpt-4o-mini',
      timeoutMs: 120000 // 2 minutes for research queries
    })

    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format from OpenAI')
    }

    const result = {
      company: {
        summary: String(response.company?.summary || '').trim(),
        size: response.company?.size ? String(response.company.size).trim() : undefined,
        industry: response.company?.industry ? String(response.company.industry).trim() : undefined,
        headquarters: response.company?.headquarters ? String(response.company.headquarters).trim() : undefined,
        founded: response.company?.founded ? String(response.company.founded).trim() : undefined,
        ceo: response.company?.ceo ? String(response.company.ceo).trim() : undefined,
        market_position: response.company?.market_position ? String(response.company.market_position).trim() : undefined,
        latest_news: response.company?.latest_news ? String(response.company.latest_news).trim() : undefined
      },
      competitors: Array.isArray(response.competitors)
        ? response.competitors
            .filter((c: any) => c && c.name && c.website && c.positioning && c.ai_maturity && c.innovation_focus)
            .map((c: any) => ({
              name: String(c.name).trim(),
              website: String(c.website).trim(),
              positioning: String(c.positioning).trim(),
              ai_maturity: String(c.ai_maturity).trim(),
              innovation_focus: String(c.innovation_focus).trim(),
              employee_band: c.employee_band ? String(c.employee_band).trim() : undefined,
              geo_fit: c.geo_fit ? String(c.geo_fit).trim() : undefined
            }))
            .slice(0, 3)
        : [],
      industry: {
        summary: String(response.industry?.summary || '').trim(),
        trends: Array.isArray(response.industry?.trends)
          ? response.industry.trends
              .map((t: any) => String(t).trim())
              .filter((t: string) => t.length > 0)
              .slice(0, 5)
          : []
      }
    }

    // CRITICAL: Do NOT add generic fallback information
    // If summary is too short or trends are missing, the pipeline will handle it
    // We want specific information only, not generic placeholders

    return result
  } catch (err: any) {
    console.error('[OpenAI Research] Company research error:', err?.message || String(err))
    throw err
  }
}

