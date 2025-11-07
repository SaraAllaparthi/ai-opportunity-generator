// OpenAI-based research module to replace Tavily
// Returns the same ResearchSnippet structure for compatibility

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
 * OpenAI-based search that returns structured snippets matching Tavily's format
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
      timeoutMs: 45000 // Reduced to prevent overall timeout
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
    // Return empty array on error to match Tavily behavior
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
  const system = `You are a business research analyst. Provide factual, structured information about companies.
Base all information on real, verifiable sources. Never fabricate URLs or company details.
Return ONLY valid JSON matching the required schema.`

  const userPrompt = `Research company: ${companyName} (${website})

Provide comprehensive research in this JSON structure:
{
  "company": {
    "summary": "Comprehensive 4-8 sentence overview (minimum 100 characters) covering: business model, products/services, target markets, market position, operations, strategic focus",
    "size": "Employee count in format 'X employees' or 'X-Y employees' (if available)",
    "industry": "Primary industry sector",
    "headquarters": "City, Country",
    "founded": "Founded in YYYY" format (if available)",
    "ceo": "CEO/Founder name (if available)",
    "market_position": "Market position/leadership info (if available)",
    "latest_news": "One recent news point (if available)"
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
    "summary": "One paragraph (20-300 characters) summarizing how intelligent automation, data analytics, and AI adoption are transforming the industry. Focus on business transformation, not technical details.",
    "trends": [
      "AI-driven predictive maintenance reduces downtime by 20%",
      "Smart factories use ML to optimize production schedules",
      "AI forecasting improves inventory accuracy by 30%",
      "Sustainability analytics help meet compliance faster",
      "Digital twins enable real-time process optimization"
    ]
  }
}

Requirements:
- company.summary: MUST be ≥100 characters
- industry.summary: MUST be 20-300 characters
- industry.trends: MUST be exactly 4-5 items (max 15 words each)
- competitors: Return 2-3 real companies from same industry/geography (≤500 employees). All must have valid website URLs.
- Never fabricate URLs - use real company websites
- Focus on SMB/mid-market companies (≤500 employees)

Return ONLY the JSON object, no markdown, no explanations.`

  try {
    const response = await llmGenerateJson(system, userPrompt, {
      model: 'gpt-4o-mini',
      timeoutMs: 60000 // Reduced from 90s to 60s to prevent overall timeout
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

    // Ensure minimum lengths
    if (result.company.summary.length < 100) {
      result.company.summary = result.company.summary + ' ' + 
        'The company focuses on delivering quality solutions to its customers while maintaining operational excellence and continuous improvement in its market segment.'
    }

    if (result.industry.summary.length < 20) {
      result.industry.summary = 'The industry is being reshaped by AI, automation, and data analytics, improving efficiency, quality, and speed while enabling smarter operations and faster decisions.'
    }

    if (result.industry.trends.length < 4) {
      const defaultTrends = [
        'AI-driven predictive maintenance reduces downtime',
        'Smart factories use ML to optimize production',
        'AI forecasting improves inventory accuracy',
        'Sustainability analytics help meet compliance',
        'Digital twins enable real-time process optimization'
      ]
      result.industry.trends = [...result.industry.trends, ...defaultTrends].slice(0, 5)
    }

    return result
  } catch (err: any) {
    console.error('[OpenAI Research] Company research error:', err?.message || String(err))
    throw err
  }
}

