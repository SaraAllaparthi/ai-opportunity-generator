// Perplexity provider wrapper for competitor search
type PerplexitySearchResult = {
  name: string
  website: string
  headquarters?: string
  positioning?: string
  ai_maturity?: string
  innovation_focus?: string
  source?: string
}

export async function perplexitySearchCompetitors(
  companyName: string,
  industry: string,
  headquarters: string,
  size: string
): Promise<PerplexitySearchResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('Missing PERPLEXITY_API_KEY')

  const query = `Find 2-3 local competitors for ${companyName} in the ${industry} industry. 
Company details:
- Headquarters: ${headquarters}
- Size: ${size}

For each competitor, provide:
- Company name
- Official website URL
- Headquarters location (city, country)
- Brief positioning (one sentence: what they do and for whom)
- Digital/AI focus (one short phrase)
- One source link

Return only companies with valid website URLs and at least one source link. Exclude the company itself (${companyName}).`

  console.log('[Perplexity] Searching competitors:', {
    companyName,
    industry,
    headquarters,
    size
  })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant that finds local competitors for companies. You MUST return your response as a valid JSON array of competitor objects. Each object must have: name (string), website (string with http:// or https://), headquarters (string, optional), positioning (string, optional), ai_maturity (string, optional), innovation_focus (string, optional), source (string, optional). Do not include any markdown formatting, just the raw JSON array.'
    },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.2,
    max_tokens: 2000
  }

  let attempt = 0
  const maxAttempts = 3
  const baseDelay = 500
  const timeoutMs = 30000

  while (attempt < maxAttempts) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
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

      if (!res.ok) {
        const errorText = await res.text()
        console.error('[Perplexity] Error response:', { status: res.status, statusText: res.statusText, body: errorText })
        throw new Error(`Perplexity error: ${res.status}`)
      }

      const json = await res.json()
      clearTimeout(t)

      const content = json.choices?.[0]?.message?.content || ''
      console.log('[Perplexity] Received response:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 1000),
        fullContent: content // Log full content for debugging
      })

      // Try to extract JSON from the response
      let competitors: PerplexitySearchResult[] = []
      
      // Strategy 1: Look for JSON array in code blocks (```json ... ```)
      const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
      if (codeBlockMatch) {
        try {
          competitors = JSON.parse(codeBlockMatch[1])
          console.log('[Perplexity] Extracted JSON from code block:', competitors.length, 'competitors')
        } catch (e) {
          console.error('[Perplexity] Failed to parse JSON from code block:', e)
        }
      }
      
      // Strategy 2: Look for JSON array anywhere in the response
      if (competitors.length === 0) {
        const jsonMatch = content.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
          try {
            competitors = JSON.parse(jsonMatch[0])
            console.log('[Perplexity] Extracted JSON array from response:', competitors.length, 'competitors')
          } catch (e) {
            console.error('[Perplexity] Failed to parse JSON array:', e, 'Match:', jsonMatch[0].substring(0, 200))
          }
        }
      }
      
      // Strategy 3: Try to parse the entire content as JSON
      if (competitors.length === 0) {
        try {
          const parsed = JSON.parse(content.trim())
          if (Array.isArray(parsed)) {
            competitors = parsed
            console.log('[Perplexity] Parsed entire content as JSON array:', competitors.length, 'competitors')
          } else if (parsed.competitors && Array.isArray(parsed.competitors)) {
            competitors = parsed.competitors
            console.log('[Perplexity] Found competitors array in JSON object:', competitors.length, 'competitors')
          } else if (parsed.competitor && Array.isArray(parsed.competitor)) {
            competitors = parsed.competitor
            console.log('[Perplexity] Found competitor array in JSON object:', competitors.length, 'competitors')
          }
        } catch (e) {
          console.error('[Perplexity] Failed to parse response as JSON:', e)
        }
      }
      
      // Strategy 4: Try to extract from markdown list or structured text
      if (competitors.length === 0) {
        console.log('[Perplexity] Attempting to extract competitors from text format')
        // Look for patterns like "1. Company Name - website: ..."
        const textMatches = content.match(/(?:^|\n)\d+\.\s*([^\n]+?)\s*(?:-|:|\n).*?(?:website|url)[:\s]+(https?:\/\/[^\s\n]+)/gi)
        if (textMatches && textMatches.length > 0) {
          console.log('[Perplexity] Found', textMatches.length, 'text-formatted competitors')
          // This is a fallback - we'd need more sophisticated parsing
        }
      }
      
      console.log('[Perplexity] Extracted', competitors.length, 'competitors before validation')

      // Filter and validate results - normalize URLs that are missing protocol
      const validCompetitors = competitors.map((c: any) => {
        // Normalize website URL - add https:// if missing
        let website = c.website
        if (website && typeof website === 'string') {
          website = website.trim()
          // Remove leading www. if present (we'll add protocol)
          if (website.startsWith('www.')) {
            website = website.substring(4)
          }
          // Add https:// if no protocol
          if (!website.startsWith('http://') && !website.startsWith('https://')) {
            website = `https://${website}`
          }
          // Validate it's a proper URL
          try {
            new URL(website)
            c.website = website
          } catch (e) {
            console.log('[Perplexity] Invalid URL format after normalization:', website)
            c.website = null
          }
        }
        return c
      }).filter((c: any) => {
        const hasName = c.name && typeof c.name === 'string' && c.name.trim().length > 0
        const hasWebsite = c.website && typeof c.website === 'string' && 
                          (c.website.startsWith('http://') || c.website.startsWith('https://'))
        const notSelf = !c.name.toLowerCase().includes(companyName.toLowerCase()) &&
                       !companyName.toLowerCase().includes(c.name.toLowerCase())
        
        if (!hasName) {
          console.log('[Perplexity] Rejecting competitor - missing name:', c)
        } else if (!hasWebsite) {
          console.log('[Perplexity] Rejecting competitor - invalid website:', c.name, c.website)
        } else if (!notSelf) {
          console.log('[Perplexity] Rejecting competitor - is self:', c.name)
        }
        
        return hasName && hasWebsite && notSelf
      }).slice(0, 3) // Limit to 3

      console.log('[Perplexity] Returning', validCompetitors.length, 'valid competitors out of', competitors.length, 'total')
      if (validCompetitors.length > 0) {
        console.log('[Perplexity] Valid competitors:', validCompetitors.map(c => ({ name: c.name, website: c.website })))
      }
      return validCompetitors.map((c: any) => ({
        name: String(c.name || '').trim(),
        website: String(c.website || '').trim(),
        headquarters: c.headquarters ? String(c.headquarters).trim() : undefined,
        positioning: c.positioning ? String(c.positioning).trim() : undefined,
        ai_maturity: c.ai_maturity || c['ai_maturity'] || c['digital/AI focus'] ? String(c.ai_maturity || c['ai_maturity'] || c['digital/AI focus']).trim() : undefined,
        innovation_focus: c.innovation_focus || c['innovation_focus'] ? String(c.innovation_focus || c['innovation_focus']).trim() : undefined,
        source: c.source || c['source link'] ? String(c.source || c['source link']).trim() : undefined
      }))
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        throw new Error('Perplexity request timed out')
      }
      attempt += 1
      if (attempt >= maxAttempts) {
        console.error('[Perplexity] Failed after', maxAttempts, 'attempts:', err)
        throw err
      }
      await new Promise((r) => setTimeout(r, baseDelay * attempt))
    }
  }

  return []
}

