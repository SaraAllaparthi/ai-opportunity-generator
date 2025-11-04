// Perplexity provider wrapper for web search (server-side only)
// Replaces Tavily for all research queries

export type PerplexitySearchResult = {
  title: string
  url: string
  content: string
}

/**
 * Search Perplexity for web content
 * Compatible interface with tavilySearch
 */
export async function perplexitySearch(
  query: string,
  opts?: { maxResults?: number; timeoutMs?: number; searchDepth?: 'basic' | 'advanced' }
): Promise<PerplexitySearchResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('Missing PERPLEXITY_API_KEY')
  }

  const maxResults = opts?.maxResults ?? 8
  const timeoutMs = opts?.timeoutMs ?? 25000

  console.log('[Perplexity] Sending search request:', {
    query,
    maxResults
  })

  const url = 'https://api.perplexity.ai/chat/completions'

  let attempt = 0
  const maxAttempts = 3
  const baseDelay = 400

  while (attempt < maxAttempts) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
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
              content: 'You are a web search assistant. For each search result, provide: 1) A clear title or heading, 2) The source URL, 3) A detailed summary or excerpt (2-3 sentences) of the content. Format your response with clear sections and include URLs inline with the relevant information.'
            },
            {
              role: 'user',
              content: `${query}\n\nPlease provide detailed information with source URLs. Include specific facts, data, and quotes from the sources.`
            }
          ]
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Perplexity error: ${response.status}`
        
        try {
          const errorDetails = JSON.parse(errorText)
          if (response.status === 401) {
            errorMessage = `Perplexity Unauthorized (${response.status}): Invalid API key. Check your PERPLEXITY_API_KEY in .env.local. Error details: ${errorDetails.message || errorText}`
          } else if (response.status === 429) {
            errorMessage = `Perplexity Rate Limited (${response.status}): Too many requests. Please wait before retrying. Error details: ${errorDetails.message || errorText}`
          } else {
            errorMessage = `Perplexity error ${response.status}: ${errorDetails.message || errorText || response.statusText}`
          }
        } catch {
          errorMessage = `Perplexity error ${response.status}: ${errorText || response.statusText}`
        }
        
        console.error('[Perplexity] Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        throw new Error(errorMessage)
      }

      const data = await response.json()
      clearTimeout(t)
      
      const content = data.choices?.[0]?.message?.content || ''
      // Perplexity may return citations in different formats
      let citations: string[] = []
      if (Array.isArray(data.citations)) {
        citations = data.citations
      } else if (data.citations && typeof data.citations === 'object') {
        // Sometimes citations are in an object format
        citations = Object.values(data.citations).filter((c: any) => typeof c === 'string') as string[]
      }
      
      console.log('[Perplexity] Raw response:', {
        contentLength: content.length,
        citationsCount: citations.length,
        citations: citations.slice(0, 3)
      })
      
      // Extract results from content and citations
      const results: PerplexitySearchResult[] = []
      const seen = new Set<string>()
      
      // Split content into paragraphs/sections for better extraction
      const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 20)
      
      // Process citations first (more reliable)
      for (const citation of citations.slice(0, maxResults * 2)) {
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
            title: bestTitle.substring(0, 200),
            url: citation,
            content: snippet.substring(0, 1000)
          })
          
          if (results.length >= maxResults) break
        } catch {
          continue
        }
      }
      
      // Also extract URLs from content text and create results from paragraphs
      if (results.length < maxResults) {
        const urlRegex = /https?:\/\/[^\s\)]+/gi
        const urlMatches = content.match(urlRegex) || []
        
        for (const match of urlMatches) {
          if (results.length >= maxResults) break
          
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
                hostname.includes('x.com') ||
                hostname.includes('instagram.com')) {
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
              title: bestTitle.substring(0, 200),
              url: url,
              content: snippet.substring(0, 1000)
            })
          } catch {
            continue
          }
        }
      }
      
      // If we still don't have enough results, create results from content paragraphs
      if (results.length < maxResults && paragraphs.length > 0) {
        for (const para of paragraphs.slice(0, maxResults - results.length)) {
          if (results.length >= maxResults) break
          
          // Extract URL from paragraph if present
          const urlMatch = para.match(/https?:\/\/[^\s\)]+/i)
          let url = urlMatch ? urlMatch[0].replace(/[.,;!?]+$/, '') : ''
          
          // If no URL, try to infer from context or use a placeholder
          if (!url || seen.has(url)) {
            // Skip paragraphs without URLs to maintain quality
            continue
          }
          
          try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
            const hostname = urlObj.hostname.toLowerCase()
            
            if (hostname.includes('linkedin.com') || 
                hostname.includes('wikipedia.org') ||
                hostname.includes('facebook.com') ||
                hostname.includes('twitter.com') ||
                hostname.includes('x.com')) {
              continue
            }
            
            seen.add(url)
            
            const firstLine = para.split('\n')[0] || para.split('.')[0]
            const title = firstLine.replace(/^[-•*\d.\s]+/, '').trim().substring(0, 200) || hostname
            
            results.push({
              title: title.substring(0, 200),
              url: url,
              content: para.trim().substring(0, 1000)
            })
          } catch {
            continue
          }
        }
      }
      
      console.log('[Perplexity] Received response:', {
        resultCount: results.length,
        results: results.map(r => ({
          title: r.title,
          url: r.url,
          contentLength: r.content.length,
          contentPreview: r.content.substring(0, 200)
        }))
      })
      
      console.log('[Perplexity] Returning', results.length, 'results for query:', query)
      return results.slice(0, maxResults)
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        throw new Error('Perplexity request timed out')
      }
      attempt += 1
      if (attempt >= maxAttempts) throw err
      await new Promise((r) => setTimeout(r, baseDelay * attempt))
    }
  }

  return []
}

