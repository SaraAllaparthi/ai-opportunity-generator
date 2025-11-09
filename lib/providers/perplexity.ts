// Perplexity provider wrapper for competitor search
type PerplexitySearchResult = {
  name: string
  website: string
  headquarters: string // REQUIRED - no optional
  positioning: string // REQUIRED - no optional
  ai_maturity: string // REQUIRED - no optional
  innovation_focus: string // REQUIRED - no optional
  source?: string
}

type LocationHierarchy = {
  city?: string
  country?: string
  region?: string
  isDACH?: boolean
  isEurope?: boolean
}

export async function perplexitySearchCompetitors(
  companyName: string,
  industry: string,
  headquarters: string,
  size: string,
  location: LocationHierarchy
): Promise<PerplexitySearchResult[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('Missing PERPLEXITY_API_KEY')

  // Build location context for query
  const locationContext = [
    location.city ? `City: ${location.city}` : null,
    location.country ? `Country: ${location.country}` : null,
    location.region ? `Region: ${location.region}` : null
  ].filter(Boolean).join(', ')

  const query = `Find 2-3 local competitors for ${companyName} in the ${industry} industry. 
Company details:
- Headquarters: ${headquarters} (${locationContext})
- Size: ${size}

CRITICAL REQUIREMENTS - For each competitor, you MUST provide ALL of the following:
- Company name (required)
- Official website URL with http:// or https:// (required)
- Headquarters location in format "City, Country" (required)
- Brief positioning: one sentence describing what they do and for whom (required, minimum 20 characters)
- Digital/AI focus: one short phrase describing their AI/digital maturity (required)
- Innovation focus: one short phrase describing their innovation focus (required)
- One source link (optional but preferred)

Return only companies that:
1. Are in the same industry (${industry})
2. Are located in the same geographic area (${locationContext})
3. Have similar size (${size})
4. Have valid website URLs
5. Are NOT the company itself (${companyName})

Return your response as a valid JSON array. Each competitor object MUST include: name, website, headquarters, positioning, ai_maturity, innovation_focus, and source (if available).`

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
      content: 'You are a helpful assistant that finds local competitors for companies. You MUST return your response as a valid JSON array of competitor objects. Each object MUST have ALL of the following REQUIRED fields: name (string), website (string with http:// or https://), headquarters (string in format "City, Country"), positioning (string, minimum 20 characters), ai_maturity (string), innovation_focus (string). Optional field: source (string). Do not include any markdown formatting, just the raw JSON array. If you cannot find all required fields for a competitor, do not include that competitor in the results.'
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

      // Filter and validate results - STRICT validation, no fallbacks
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
        // STRICT validation - all fields required
        const hasName = c.name && typeof c.name === 'string' && c.name.trim().length > 0
        const hasWebsite = c.website && typeof c.website === 'string' && 
                          (c.website.startsWith('http://') || c.website.startsWith('https://'))
        const hasHeadquarters = c.headquarters && typeof c.headquarters === 'string' && 
                               c.headquarters.trim().length > 0 &&
                               /,/.test(c.headquarters) // Must have city, country format
        const hasPositioning = c.positioning && typeof c.positioning === 'string' && 
                             c.positioning.trim().length >= 20
        const hasAiMaturity = c.ai_maturity && typeof c.ai_maturity === 'string' && 
                             c.ai_maturity.trim().length > 0
        const hasInnovationFocus = c.innovation_focus && typeof c.innovation_focus === 'string' && 
                                  c.innovation_focus.trim().length > 0
        const notSelf = !c.name.toLowerCase().includes(companyName.toLowerCase()) &&
                       !companyName.toLowerCase().includes(c.name.toLowerCase())
        
        if (!hasName) {
          console.log('[Perplexity] Rejecting competitor - missing name:', c)
        } else if (!hasWebsite) {
          console.log('[Perplexity] Rejecting competitor - invalid website:', c.name, c.website)
        } else if (!hasHeadquarters) {
          console.log('[Perplexity] Rejecting competitor - missing or invalid headquarters:', c.name, c.headquarters)
        } else if (!hasPositioning) {
          console.log('[Perplexity] Rejecting competitor - missing or invalid positioning:', c.name, c.positioning?.length || 0, 'chars')
        } else if (!hasAiMaturity) {
          console.log('[Perplexity] Rejecting competitor - missing AI maturity:', c.name)
        } else if (!hasInnovationFocus) {
          console.log('[Perplexity] Rejecting competitor - missing innovation focus:', c.name)
        } else if (!notSelf) {
          console.log('[Perplexity] Rejecting competitor - is self:', c.name)
        }
        
        return hasName && hasWebsite && hasHeadquarters && hasPositioning && hasAiMaturity && hasInnovationFocus && notSelf
      }).slice(0, 3) // Limit to 3

      console.log('[Perplexity] Returning', validCompetitors.length, 'valid competitors out of', competitors.length, 'total')
      if (validCompetitors.length > 0) {
        console.log('[Perplexity] Valid competitors:', validCompetitors.map(c => ({ name: c.name, website: c.website })))
      }
      // All fields are required at this point (filtered above)
      return validCompetitors.map((c: any) => ({
        name: String(c.name).trim(),
        website: String(c.website).trim(),
        headquarters: String(c.headquarters).trim(), // REQUIRED
        positioning: String(c.positioning).trim(), // REQUIRED
        ai_maturity: String(c.ai_maturity || c['ai_maturity'] || c['digital/AI focus'] || '').trim(), // REQUIRED
        innovation_focus: String(c.innovation_focus || c['innovation_focus'] || '').trim(), // REQUIRED
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

