// lib/search/perplexity.ts
// Perplexity search helper for competitor discovery

export type SearchResult = {
  url: string
  title: string
  snippet: string
}

export type SearchOptions = {
  companyName: string
  industry?: string
  headquarters?: string
  country?: string
  max?: number
}

/**
 * Search for competitors using Perplexity API
 * Returns a list of search results with URL, title, and snippet
 */
export async function searchCompetitors(options: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured')
  }

  const { companyName, industry, headquarters, country, max = 30 } = options

  // Build tiered queries
  const queries = buildQueries(companyName, industry, headquarters, country)

  const allResults: SearchResult[] = []

  for (const query of queries) {
    try {
      const results = await performSearch(query, apiKey)
      allResults.push(...results)
      
      // Stop if we have enough results
      if (allResults.length >= max) break
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      console.error(`[Perplexity] Query failed: "${query}":`, err)
      // Continue to next query
      continue
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = allResults.filter(r => {
    try {
      const url = new URL(r.url.startsWith('http') ? r.url : `https://${r.url}`)
      const origin = url.origin
      if (seen.has(origin)) return false
      seen.add(origin)
      return true
    } catch {
      return false
    }
  })

  return unique.slice(0, max)
}

function buildQueries(
  companyName: string,
  industry?: string,
  headquarters?: string,
  country?: string
): string[] {
  const queries: string[] = []
  
  // Extract country from headquarters if not provided
  const detectedCountry = country || extractCountryFromHQ(headquarters)
  const city = extractCity(headquarters)
  const industryTerms = industry || 'industry'
  const countryCode = detectedCountry ? getCountryCode(detectedCountry) : undefined

  // Tier 1: Country focus (prefer ccTLD)
  if (detectedCountry) {
    if (countryCode) {
      queries.push(
        `${industryTerms} competitors ${detectedCountry} site:.${countryCode}`
      )
    }
    queries.push(
      `${companyName} competitors ${detectedCountry}`
    )
    queries.push(
      `top ${industryTerms} in ${detectedCountry}`
    )
  }

  // Tier 2: Region/state/canton (if HQ contains one)
  if (city) {
    queries.push(
      `${industryTerms} companies ${city}`
    )
  }

  // Tier 3: DACH/EU fallback
  if (isDACHCountry(detectedCountry)) {
    queries.push(
      `${industryTerms} competitors Switzerland OR Germany OR Austria`
    )
  }

  // Tier 4: Generic "near me"
  if (city) {
    queries.push(
      `${industryTerms} firms near ${city}`
    )
  }

  return queries.filter(q => q.trim().length > 0)
}

async function performSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = 'https://api.perplexity.ai/chat/completions'
  
  const response = await fetch(url, {
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
          content: 'You are a web search assistant. For each search result, provide: 1) A clear title or company name, 2) The source URL, 3) A detailed summary or excerpt (2-3 sentences) of the content. Format your response with clear sections and include URLs inline with the relevant information.'
        },
        {
          role: 'user',
          content: `${query}\n\nPlease provide detailed information with source URLs. Include specific facts, data, and company names from the sources.`
        }
      ]
    }),
    signal: AbortSignal.timeout(30000) // 30 seconds
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // Perplexity may return citations in different formats
  let citations: string[] = []
  if (Array.isArray(data.citations)) {
    citations = data.citations
  } else if (data.citations && typeof data.citations === 'object') {
    citations = Object.values(data.citations).filter((c: any) => typeof c === 'string') as string[]
  }
  
  console.log(`[Perplexity] Query "${query.substring(0, 60)}..." - content length: ${content.length}, citations: ${citations.length}`)
  
  // Extract results from content and citations (similar to perplexitySearch provider)
  const results: SearchResult[] = []
  const seen = new Set<string>()
  
  // Split content into paragraphs for better extraction
  const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 20)
  
  // Process citations first (more reliable)
  for (const citation of citations) {
    if (!citation || seen.has(citation)) continue
    
    try {
      const urlObj = new URL(citation.startsWith('http') ? citation : `https://${citation}`)
      const hostname = urlObj.hostname.toLowerCase()
      
      // Exclude non-content domains
      if (hostname.includes('linkedin.com') || 
          hostname.includes('wikipedia.org') ||
          hostname.includes('facebook.com') ||
          hostname.includes('twitter.com') ||
          hostname.includes('x.com') ||
          hostname.includes('instagram.com')) {
        continue
      }
      
      seen.add(citation)
      
      // Find the paragraph that mentions this URL
      let bestParagraph = ''
      let bestTitle = hostname.replace(/^www\./, '').split('.')[0] || 'Web Page'
      
      for (const para of paragraphs) {
        if (para.toLowerCase().includes(citation.toLowerCase()) || 
            para.toLowerCase().includes(hostname)) {
          bestParagraph = para.trim()
          // Extract title from first sentence or line
          const firstLine = para.split('\n')[0] || para.split('.')[0]
          bestTitle = firstLine.replace(/^[-•*\d.\s]+/, '').trim().substring(0, 200) || bestTitle
          break
        }
      }
      
      // If no paragraph found, use content around the citation
      if (!bestParagraph) {
        const citationIndex = content.toLowerCase().indexOf(citation.toLowerCase())
        if (citationIndex >= 0) {
          const context = content.substring(
            Math.max(0, citationIndex - 200), 
            citationIndex + 400
          ).trim()
          bestParagraph = context
          const lines = context.split('\n').filter((l: string) => l.trim())
          if (lines.length > 0) {
            bestTitle = lines[0].replace(/^[-•*\d.\s]+/, '').trim().substring(0, 200) || bestTitle
          }
        }
      }
      
      // Use the paragraph content as snippet, or fallback to title
      const snippet = bestParagraph || bestTitle
      
      results.push({
        url: citation,
        title: bestTitle.substring(0, 200),
        snippet: snippet.substring(0, 500)
      })
      
      if (results.length >= 10) break // Limit to 10 results per query
    } catch {
      continue
    }
  }
  
  // Also extract URLs from content text
  if (results.length < 10) {
    const urlRegex = /https?:\/\/[^\s\)]+/gi
    const urlMatches = content.match(urlRegex) || []
    
    for (const match of urlMatches) {
      if (results.length >= 10) break
      
      const url = match.replace(/[.,;!?]+$/, '')
      if (seen.has(url)) continue
      
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        const hostname = urlObj.hostname.toLowerCase()
        
        // Exclude non-content domains
        if (hostname.includes('linkedin.com') || 
            hostname.includes('wikipedia.org') ||
            hostname.includes('facebook.com') ||
            hostname.includes('twitter.com') ||
            hostname.includes('x.com')) {
          continue
        }
        
        seen.add(url)
        
        // Find paragraph containing this URL
        let bestParagraph = ''
        let bestTitle = hostname.replace(/^www\./, '').split('.')[0] || 'Web Page'
        
        for (const para of paragraphs) {
          if (para.toLowerCase().includes(url.toLowerCase()) || 
              para.toLowerCase().includes(hostname)) {
            bestParagraph = para.trim()
            const firstLine = para.split('\n')[0] || para.split('.')[0]
            bestTitle = firstLine.replace(/^[-•*\d.\s]+/, '').trim().substring(0, 200) || bestTitle
            break
          }
        }
        
        if (!bestParagraph) {
          const urlIndex = content.toLowerCase().indexOf(url.toLowerCase())
          if (urlIndex >= 0) {
            bestParagraph = content.substring(
              Math.max(0, urlIndex - 200),
              urlIndex + 400
            ).trim()
            const lines = bestParagraph.split('\n').filter((l: string) => l.trim())
            if (lines.length > 0) {
              bestTitle = lines[0].replace(/^[-•*\d.\s]+/, '').trim().substring(0, 200) || bestTitle
            }
          }
        }
        
        const snippet = bestParagraph || bestTitle
        
        results.push({
          url: url,
          title: bestTitle.substring(0, 200),
          snippet: snippet.substring(0, 500)
        })
      } catch {
        continue
      }
    }
  }
  
  console.log(`[Perplexity] Query "${query.substring(0, 60)}..." returned ${results.length} valid results`)
  return results
}

function extractCountryFromHQ(headquarters?: string): string | undefined {
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
  if (hq.includes('france') || hq.includes('france')) {
    return 'France'
  }
  if (hq.includes('italy') || hq.includes('italia')) {
    return 'Italy'
  }
  
  return undefined
}

function extractCity(headquarters?: string): string | undefined {
  if (!headquarters) return undefined
  
  const parts = headquarters.split(',').map(s => s.trim())
  if (parts.length > 0) {
    const first = parts[0].toLowerCase()
    // Skip if first part is a country keyword
    if (!['switzerland', 'schweiz', 'germany', 'deutschland', 'austria', 'österreich'].includes(first)) {
      return parts[0]
    }
  }
  
  return undefined
}

function getCountryCode(country?: string): string | undefined {
  if (!country) return undefined
  
  const countryMap: Record<string, string> = {
    'switzerland': 'ch',
    'schweiz': 'ch',
    'germany': 'de',
    'deutschland': 'de',
    'austria': 'at',
    'österreich': 'at',
    'france': 'fr',
    'italy': 'it',
    'italia': 'it'
  }
  
  return countryMap[country.toLowerCase()]
}

function isDACHCountry(country?: string): boolean {
  if (!country) return false
  const dach = ['switzerland', 'schweiz', 'germany', 'deutschland', 'austria', 'österreich']
  return dach.includes(country.toLowerCase())
}

