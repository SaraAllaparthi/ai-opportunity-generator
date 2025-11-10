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

/**
 * Search for company facts using Perplexity: CEO name, founded year, company size
 * Simplified CEO search: Just ask "Who is the CEO of [company] in [country]"
 */
export async function perplexitySearchCompanyFacts(
  companyName: string,
  website?: string,
  countryLocation?: string
): Promise<{
  ceo?: string
  founded?: string
  size?: string
}> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.warn('[Perplexity] Missing PERPLEXITY_API_KEY, skipping company facts search')
    return {}
  }

  // Extract country from location if provided (e.g., "Zurich, Switzerland" -> "Switzerland")
  const country = countryLocation 
    ? countryLocation.split(',').map(s => s.trim()).pop() || countryLocation
    : undefined

  // Simple, direct CEO query
  const ceoQuery = country 
    ? `Who is the CEO of ${companyName} in ${country}?`
    : `Who is the CEO of ${companyName}?`

  const query = `${ceoQuery}

Also find:
2. Founded year - When was ${companyName}${country ? ` in ${country}` : ''} founded? Look for "founded", "established", "incorporated", or "registered" followed by a year (YYYY format). Return ONLY the year in format "Founded in YYYY" if found.

3. Company size - How many employees does ${companyName}${country ? ` in ${country}` : ''} have? Look for "employees", "employee count", "workforce", "headcount", or "Mitarbeiter" followed by a number. Return ONLY in format "X employees" or "X-Y employees" if found.

CRITICAL REQUIREMENTS:
- CEO: Return ONLY the full name (first name + last name) if found. Do NOT return titles only (e.g., "CEO" or "Group CEO" without a name). Do NOT infer or guess names.
- Founded: Only return if you find an explicit year (e.g., "founded in 1995" or "established 2001"). Do NOT estimate.
- Size: Only return if you find an explicit employee count (e.g., "50 employees" or "100-200 employees"). Do NOT estimate from revenue.

Return your response as a JSON object with these exact keys: ceo (string or null), founded (string or null), size (string or null). If information is not found, use null for that field.`

  console.log('[Perplexity] Searching company facts:', { companyName, website, countryLocation, country })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are a business intelligence researcher. Answer the question directly and return your response as a valid JSON object with these exact keys: ceo (string or null), founded (string or null), size (string or null). For CEO: Return ONLY the full name (first name + last name) if found. Do NOT return titles only. Do NOT infer or guess names. If information is not found, use null for that field. Do not include any markdown formatting, just the raw JSON object.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.1,
    max_tokens: 1000
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000) // 25s timeout

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

    clearTimeout(timeout)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Perplexity] Error response for company facts:', { status: res.status, body: errorText })
      return {}
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    
    console.log('[Perplexity] Company facts response:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 500)
    })

    // Try to extract JSON from response
    let facts: any = {}
    
    // Strategy 1: Look for JSON object in code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
    if (codeBlockMatch) {
      try {
        facts = JSON.parse(codeBlockMatch[1])
        console.log('[Perplexity] Extracted JSON from code block')
      } catch (e) {
        console.error('[Perplexity] Failed to parse JSON from code block:', e)
      }
    }
    
    // Strategy 2: Look for JSON object anywhere
    if (!facts.ceo && !facts.founded && !facts.size) {
      const jsonMatch = content.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        try {
          facts = JSON.parse(jsonMatch[0])
          console.log('[Perplexity] Extracted JSON from response')
        } catch (e) {
          console.error('[Perplexity] Failed to parse JSON object:', e)
        }
      }
    }
    
    // Strategy 3: Try parsing entire content
    if (!facts.ceo && !facts.founded && !facts.size) {
      try {
        const parsed = JSON.parse(content.trim())
        if (typeof parsed === 'object' && parsed !== null) {
          facts = parsed
          console.log('[Perplexity] Parsed entire content as JSON object')
        }
      } catch (e) {
        console.error('[Perplexity] Failed to parse response as JSON:', e)
      }
    }

    // Validate and clean results
    const result: { ceo?: string; founded?: string; size?: string } = {}
    
    // Validate CEO - reject placeholder names and generic terms
    if (facts.ceo && typeof facts.ceo === 'string' && facts.ceo.trim() && facts.ceo.toLowerCase() !== 'null') {
      const ceoStr = facts.ceo.trim()
      const lowerStr = ceoStr.toLowerCase()
      
      // Reject generic terms
      if (lowerStr.match(/^(ceo|founder|chief|executive|director|manager|unknown|n\/a|tbd|not available|not found)$/i)) {
        console.log('[Perplexity] Rejected generic CEO term:', ceoStr)
      }
      // Reject common placeholder/test names
      else if (lowerStr.match(/^(john doe|jane doe|test user|test name|example name|sample name|placeholder|demo|test|user|name|ceo name|company ceo|the ceo|our ceo)$/i)) {
        console.log('[Perplexity] Rejected placeholder CEO name:', ceoStr)
      }
      // Reject if it's just a title with no actual name
      else if (lowerStr.match(/^(ceo|chief executive|chief executive officer|group ceo|managing director)$/i)) {
        console.log('[Perplexity] Rejected CEO (title only, no name):', ceoStr)
      }
      // Accept if it looks like a real name (has at least 2 words, reasonable length)
      else if (ceoStr.length > 0 && ceoStr.length <= 150 && ceoStr.split(/\s+/).length >= 2) {
        // Accept the CEO name - preserve as found
        result.ceo = ceoStr
        console.log('[Perplexity] Found CEO:', result.ceo)
      } else {
        console.log('[Perplexity] Rejected CEO (doesn\'t look like a real name):', ceoStr)
      }
    }
    
    // Validate founded year
    if (facts.founded && typeof facts.founded === 'string' && facts.founded.trim() && facts.founded.toLowerCase() !== 'null') {
      const foundedStr = facts.founded.trim()
      // Must contain a 4-digit year (1900-2099)
      const yearMatch = foundedStr.match(/\b(19|20)\d{2}\b/)
      if (yearMatch) {
        result.founded = `Founded in ${yearMatch[0]}`
        console.log('[Perplexity] Found founded year:', result.founded)
      } else {
        console.log('[Perplexity] Rejected founded (no valid year):', foundedStr)
      }
    }
    
    // Validate size
    if (facts.size && typeof facts.size === 'string' && facts.size.trim() && facts.size.toLowerCase() !== 'null') {
      const sizeStr = facts.size.trim().toLowerCase()
      // Must contain explicit employee count pattern
      if (sizeStr.match(/\d+[\s-]*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
        result.size = facts.size.trim()
        console.log('[Perplexity] Found size:', result.size)
      } else {
        console.log('[Perplexity] Rejected size (no employee count):', facts.size)
      }
    }

    return result
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.error('[Perplexity] Company facts search timed out')
    } else {
      console.error('[Perplexity] Company facts search error:', err)
    }
    return {}
  }
}

/**
 * Simple competitor search using Perplexity based on industry, headquarters, and size
 */
export async function perplexitySearchCompetitorsSimple(
  companyName: string,
  industry: string,
  headquarters: string,
  size?: string
): Promise<Array<{
  name: string
  website: string
  hq?: string
  size_band?: string
  positioning?: string
  evidence_pages: string[]
  source_url?: string
}>> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.warn('[Perplexity] Missing PERPLEXITY_API_KEY, skipping competitor search')
    return []
  }

  // More lenient: allow search with just industry OR just headquarters
  if (!industry && !headquarters) {
    console.warn('[Perplexity] Missing both industry and headquarters, skipping competitor search')
    return []
  }

  // Extract country from headquarters if available (e.g., "Zurich, Switzerland" -> "Switzerland")
  const countryMatch = headquarters ? headquarters.match(/,\s*([^,]+)$/) : null
  const country = countryMatch ? countryMatch[1].trim() : (headquarters || 'same country')
  
  const sizeContext = size ? `Similar size: ${size}. ` : ''
  const industryContext = industry ? `Industry: ${industry}. ` : ''
  const locationContext = headquarters ? `Location: ${headquarters} (country: ${country}). ` : `Country: ${country}. `
  
  const query = `Find 3-5 direct competitors for ${companyName} that:
${industryContext}${locationContext}${sizeContext}
CRITICAL REQUIREMENTS:
1. MUST be in the same industry or very similar industry: ${industry || 'similar business sector'}
2. MUST be located in the same country: ${country} (prioritize same country over exact city match)
3. MUST be direct competitors (similar products/services, target similar customers)
4. MUST NOT be ${companyName} itself or subsidiaries of ${companyName}
5. Prefer companies with similar size (${size || '50-500 employees'}) but include larger/smaller if needed to find 3-5 competitors

SEARCH STRATEGY:
- If industry is "${industry}", search for companies in that exact industry
- If industry is not specific, search for companies offering similar products/services
- Prioritize companies in ${country} (same country is more important than exact city)
- Look for companies in business directories, industry associations, trade publications, and company registries
- Include both local and national competitors in ${country}

For each competitor, provide:
- Company name (required) - must be a real, active company
- Official website URL with http:// or https:// (required) - must be the company's actual website
- Headquarters location in format "City, Country" (optional but preferred)
- Company size in format "X employees" or "X-Y employees" (optional)
- Brief positioning: one sentence describing what they do and who they serve (optional, max 140 characters)
- One source URL where you found this information (optional) - can be company website, directory, or industry source

Return your response as a valid JSON array. Each competitor object should have: name (string), website (string), hq (string or null), size_band (string or null), positioning (string or null), source_url (string or null).`

  console.log('[Perplexity] Searching competitors:', { companyName, industry, headquarters, size })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that finds competitors for companies. You MUST return your response as a valid JSON array of competitor objects. Each object MUST have: name (string, required), website (string with http:// or https://, required), hq (string or null), size_band (string or null), positioning (string or null, max 140 chars), source_url (string or null). Do not include any markdown formatting, just the raw JSON array. PRIORITY: Find competitors in the same industry and same country. Use multiple search strategies: business directories, industry associations, trade publications, company registers. Always return at least 3-5 competitors if possible. Be thorough and search multiple sources.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.3,
    max_tokens: 4000
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

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

    clearTimeout(timeout)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Perplexity] Error response for competitors:', { status: res.status, body: errorText })
      return []
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    
    console.log('[Perplexity] Competitors response:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 1000)
    })

    // Try to extract JSON array from response
    let competitors: any[] = []
    
    // Strategy 1: Look for JSON array in code blocks (most common)
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
    if (codeBlockMatch) {
      try {
        competitors = JSON.parse(codeBlockMatch[1])
        console.log('[Perplexity] ✅ Extracted JSON array from code block:', competitors.length, 'competitors')
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse JSON from code block:', e)
      }
    }
    
    // Strategy 2: Look for JSON array anywhere (multiline)
    if (competitors.length === 0) {
      const jsonArrayMatches = content.match(/\[[\s\S]{10,}?\]/g)
      if (jsonArrayMatches) {
        const sortedMatches = jsonArrayMatches.sort((a: string, b: string) => b.length - a.length)
        for (const match of sortedMatches) {
          try {
            const parsed = JSON.parse(match)
            if (Array.isArray(parsed) && parsed.length > 0) {
              competitors = parsed
              console.log('[Perplexity] ✅ Extracted JSON array from response:', competitors.length, 'competitors')
              break
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }
    }
    
    // Strategy 3: Try parsing entire content
    if (competitors.length === 0) {
      try {
        const parsed = JSON.parse(content.trim())
        if (Array.isArray(parsed)) {
          competitors = parsed
          console.log('[Perplexity] ✅ Parsed entire content as JSON array:', competitors.length, 'competitors')
        } else if (parsed.competitors && Array.isArray(parsed.competitors)) {
          competitors = parsed.competitors
          console.log('[Perplexity] ✅ Found competitors array in JSON object:', competitors.length, 'competitors')
        } else if (parsed.data && Array.isArray(parsed.data)) {
          competitors = parsed.data
          console.log('[Perplexity] ✅ Found competitors in data array:', competitors.length, 'competitors')
        }
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse response as JSON:', e)
      }
    }

    console.log('[Perplexity] Raw competitors before validation:', competitors.length)
    
    // Validate and normalize results
    const validCompetitors = competitors
      .filter((c: any, index: number) => {
        // Basic validation - must have name and website
        const hasName = c.name && typeof c.name === 'string' && c.name.trim().length > 0
        const hasWebsite = c.website && typeof c.website === 'string' && c.website.trim().length > 0
        
        if (!hasName) {
          console.log(`[Perplexity] Rejecting competitor ${index}: missing or invalid name`)
          return false
        }
        
        if (!hasWebsite) {
          console.log(`[Perplexity] Rejecting competitor ${index} (${c.name}): missing or invalid website`)
          return false
        }
        
        // Normalize website URL
        let website = c.website.trim()
        if (!website.startsWith('http://') && !website.startsWith('https://')) {
          website = `https://${website}`
        }
        try {
          new URL(website)
          c.website = website
        } catch {
          console.log(`[Perplexity] Rejecting competitor ${index} (${c.name}): invalid URL format: ${c.website}`)
          return false // Invalid URL
        }
        
        // Don't include the company itself (more lenient check)
        const companyNameLower = companyName.toLowerCase().trim()
        const competitorNameLower = c.name.toLowerCase().trim()
        const notSelf = !competitorNameLower.includes(companyNameLower) &&
                       !companyNameLower.includes(competitorNameLower) &&
                       competitorNameLower !== companyNameLower
        
        if (!notSelf) {
          console.log(`[Perplexity] Rejecting competitor ${index} (${c.name}): appears to be the same company`)
          return false
        }
        
        return true
      })
      .map((c: any) => {
        // Normalize website
        let website = c.website.trim()
        if (!website.startsWith('http://') && !website.startsWith('https://')) {
          website = `https://${website}`
        }
        
        // Build evidence pages (at least homepage)
        const evidencePages = [website]
        if (c.source_url && typeof c.source_url === 'string' && c.source_url.trim()) {
          const sourceUrl = c.source_url.trim()
          if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) {
            evidencePages.push(`https://${sourceUrl}`)
          } else {
            evidencePages.push(sourceUrl)
          }
        }
        
        return {
          name: String(c.name).trim(),
          website: website,
          hq: (c.hq && typeof c.hq === 'string' && c.hq.trim()) ? String(c.hq).trim() : undefined,
          size_band: (c.size_band && typeof c.size_band === 'string' && c.size_band.trim()) ? String(c.size_band).trim() : undefined,
          positioning: (c.positioning && typeof c.positioning === 'string' && c.positioning.trim()) ? String(c.positioning).trim().substring(0, 140) : undefined,
          evidence_pages: evidencePages,
          source_url: (c.source_url && typeof c.source_url === 'string' && c.source_url.trim()) ? String(c.source_url).trim() : undefined
        }
      })
      .slice(0, 6) // Limit to 6 competitors

    console.log('[Perplexity] ✅ Returning', validCompetitors.length, 'valid competitors')
    if (validCompetitors.length > 0) {
      console.log('[Perplexity] Competitor names:', validCompetitors.map(c => c.name))
    } else {
      console.warn('[Perplexity] ⚠️ No valid competitors found after validation')
      console.log('[Perplexity] Raw competitors count:', competitors.length)
      if (competitors.length > 0) {
        console.log('[Perplexity] First raw competitor:', JSON.stringify(competitors[0], null, 2))
      }
    }
    return validCompetitors
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.error('[Perplexity] Competitor search timed out')
    } else {
      console.error('[Perplexity] Competitor search error:', err)
    }
    return []
  }
}

/**
 * Research industry-specific AI use cases using Perplexity
 */
export async function perplexityResearchAIUseCases(
  companyName: string,
  industry: string,
  businessDescription?: string,
  products?: string[],
  services?: string[]
): Promise<Array<{
  title: string
  description: string
  value_driver: 'revenue' | 'cost' | 'risk' | 'speed' | 'quality'
  value_add: string // Specific value proposition
  complexity: number
  effort: number
  est_annual_benefit: number
  est_one_time_cost: number
  est_ongoing_cost: number
  payback_months: number
}>> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.warn('[Perplexity] Missing PERPLEXITY_API_KEY, skipping AI use cases research')
    return []
  }

  const businessContext = businessDescription 
    ? `\n\nCompany Business: ${businessDescription}` 
    : ''
  const productsContext = products && products.length > 0
    ? `\n\nProducts: ${products.join(', ')}`
    : ''
  const servicesContext = services && services.length > 0
    ? `\n\nServices: ${services.join(', ')}`
    : ''

  const query = `Research the top 5-7 AI use cases for companies in the ${industry} industry${businessContext}${productsContext}${servicesContext}.

For each use case, provide:
1. Title: Verb + Outcome format (e.g., "Reduce Scrap with AI Quality Control")
2. Description: One sentence explaining what the use case does
3. Value Driver: One of: revenue, cost, risk, speed, quality
4. Value Add: Specific quantified value proposition (e.g., "Reduces defect rates by 30%, saving CHF 150K annually")
5. Complexity: 1-5 (1=simple, 5=complex)
6. Effort: 1-5 (1=low effort, 5=high effort)
7. Estimated Annual Benefit: CHF amount (realistic for Swiss SMBs in this industry)
8. Estimated One-Time Cost: CHF amount
9. Estimated Ongoing Cost: CHF amount per year
10. Payback Months: Number of months to recover investment

CRITICAL REQUIREMENTS:
- Focus on AI/ML/data analytics use cases that are SPECIFIC to the ${industry} industry
- Prioritize use cases that deliver measurable ROI (cost savings, revenue growth, risk reduction)
- Make value propositions concrete and quantified where possible
- Consider Swiss SMB context (50-500 employees, typical budgets)
- Order by fastest payback (shortest payback_months first)
- Ensure all numeric fields are realistic and consistent

Return your response as a valid JSON array of use case objects. Each object must have all fields.`

  console.log('[Perplexity] Researching AI use cases for:', { companyName, industry })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are an AI strategy consultant specializing in industry-specific AI use cases. You MUST return your response as a valid JSON array of use case objects. Each object MUST have: title (string), description (string), value_driver (one of: revenue, cost, risk, speed, quality), value_add (string with quantified benefits), complexity (1-5), effort (1-5), est_annual_benefit (number in CHF), est_one_time_cost (number in CHF), est_ongoing_cost (number in CHF), payback_months (number). Do not include any markdown formatting, just the raw JSON array. Focus on industry-specific, high-ROI use cases.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.4,
    max_tokens: 4000
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

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

    clearTimeout(timeout)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Perplexity] Error response for AI use cases:', { status: res.status, body: errorText })
      return []
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    
    console.log('[Perplexity] AI use cases response:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 500)
    })

    // Extract JSON array
    let useCases: any[] = []
    
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
    if (codeBlockMatch) {
      try {
        useCases = JSON.parse(codeBlockMatch[1])
        console.log('[Perplexity] ✅ Extracted use cases from code block:', useCases.length)
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse JSON from code block:', e)
      }
    }
    
    if (useCases.length === 0) {
      const jsonMatch = content.match(/\[[\s\S]{20,}?\]/)
      if (jsonMatch) {
        try {
          useCases = JSON.parse(jsonMatch[0])
          console.log('[Perplexity] ✅ Extracted use cases from response:', useCases.length)
        } catch (e) {
          console.error('[Perplexity] ❌ Failed to parse JSON array:', e)
        }
      }
    }

    if (useCases.length === 0) {
      try {
        const parsed = JSON.parse(content.trim())
        if (Array.isArray(parsed)) {
          useCases = parsed
        } else if (parsed.use_cases && Array.isArray(parsed.use_cases)) {
          useCases = parsed.use_cases
        }
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse response as JSON:', e)
      }
    }

    // Validate and normalize
    const validUseCases = useCases
      .filter((uc: any) => {
        return uc.title && uc.description && uc.value_driver && 
               typeof uc.complexity === 'number' && typeof uc.effort === 'number' &&
               typeof uc.est_annual_benefit === 'number' && typeof uc.est_one_time_cost === 'number' &&
               typeof uc.est_ongoing_cost === 'number' && typeof uc.payback_months === 'number'
      })
      .map((uc: any) => ({
        title: String(uc.title).trim(),
        description: String(uc.description).trim(),
        value_driver: uc.value_driver as 'revenue' | 'cost' | 'risk' | 'speed' | 'quality',
        value_add: String(uc.value_add || '').trim(),
        complexity: Math.max(1, Math.min(5, Math.round(uc.complexity))),
        effort: Math.max(1, Math.min(5, Math.round(uc.effort))),
        est_annual_benefit: Math.max(0, Math.round(uc.est_annual_benefit)),
        est_one_time_cost: Math.max(0, Math.round(uc.est_one_time_cost)),
        est_ongoing_cost: Math.max(0, Math.round(uc.est_ongoing_cost)),
        payback_months: Math.max(1, Math.round(uc.payback_months))
      }))
      .sort((a: { payback_months: number }, b: { payback_months: number }) => a.payback_months - b.payback_months) // Sort by fastest payback
      .slice(0, 7) // Top 7

    console.log('[Perplexity] ✅ Returning', validUseCases.length, 'valid AI use cases')
    return validUseCases
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.error('[Perplexity] AI use cases research timed out')
    } else {
      console.error('[Perplexity] AI use cases research error:', err)
    }
    return []
  }
}

/**
 * NEW: Comprehensive competitor search using crawler and Perplexity data
 * Uses all available company information to find local competitors in the same industry
 */
export async function findLocalCompetitors(
  companyName: string,
  companyWebsite: string,
  crawledData: {
    industry?: string
    headquarters?: string
    businessDescription?: string
    products?: string[]
    services?: string[]
    targetMarkets?: string[]
  },
  companySize?: string
): Promise<Array<{
  name: string
  website: string
  hq?: string
  size_band?: string
  positioning?: string
  evidence_pages: string[]
  source_url?: string
}>> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.warn('[Perplexity] Missing PERPLEXITY_API_KEY, skipping competitor search')
    return []
  }

  // Extract key information from crawled data
  const industry = crawledData.industry || 'similar companies'
  const headquarters = crawledData.headquarters || 'Switzerland'
  const businessDesc = crawledData.businessDescription || ''
  const products = crawledData.products || []
  const services = crawledData.services || []
  const targetMarkets = crawledData.targetMarkets || []
  
  // Extract country and city from headquarters
  const hqParts = headquarters.split(',').map(s => s.trim())
  const city = hqParts[0] || ''
  const country = hqParts[hqParts.length - 1] || 'Switzerland'
  
  // Build rich context from crawled data
  const productsText = products.length > 0 ? `\n\nProducts/Services: ${products.join(', ')}` : ''
  const servicesText = services.length > 0 ? `\n\nServices: ${services.join(', ')}` : ''
  const marketsText = targetMarkets.length > 0 ? `\n\nTarget Markets: ${targetMarkets.join(', ')}` : ''
  const businessText = businessDesc ? `\n\nBusiness Description: ${businessDesc.substring(0, 300)}` : ''
  
  // Simplified query - let Perplexity use its own search capabilities
  const query = `Find 5-8 direct competitors for ${companyName} (website: ${companyWebsite}) that operate in the same market.

COMPANY INFORMATION:
- Industry: ${industry}
- Location: ${headquarters}
- Company Size: ${companySize || '50-500 employees'}
${businessDesc ? `- Business: ${businessDesc.substring(0, 200)}` : ''}
${products.length > 0 ? `- Products/Services: ${products.slice(0, 5).join(', ')}` : ''}
${services.length > 0 ? `- Services: ${services.slice(0, 5).join(', ')}` : ''}

COMPETITOR REQUIREMENTS:
1. Same or similar industry: ${industry}
2. Located in ${country} (prefer ${city || country} region, but include all ${country} competitors)
3. Similar products/services: ${products.length > 0 ? products.slice(0, 3).join(', ') : 'similar business activities'}
4. Active companies with valid websites
5. NOT ${companyName} itself, subsidiaries, or parent companies
6. Prefer companies of similar size (${companySize || '50-500 employees'}) but include all relevant competitors

For each competitor found, provide:
- name (required) - company name
- website (required) - official website URL (can be domain.com or full https:// URL)
- hq (optional) - headquarters location in format "City, Country"
- size_band (optional) - company size in format "X employees" or "X-Y employees"
- positioning (optional) - brief description of what they do (max 140 characters)
- source_url (optional) - URL where you found this information

Return your response as a valid JSON array only. Each competitor object must have: name (string), website (string), hq (string or null), size_band (string or null), positioning (string or null), source_url (string or null).

Find at least 3-5 competitors if possible. Focus on finding real, active companies in ${country} that compete directly with ${companyName}.`

  console.log('[Perplexity] 🔍 NEW: Comprehensive competitor search:', {
    companyName,
    industry,
    headquarters,
    city,
    country,
    hasBusinessDesc: !!businessDesc,
    productsCount: products.length,
    servicesCount: services.length
  })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are a business intelligence researcher specializing in finding competitors for companies. Use your search capabilities to find direct competitors based on the company information provided. Return ONLY a valid JSON array of competitor objects. Each object: name (string, required), website (string, required - can be domain.com or full URL), hq (string or null), size_band (string or null), positioning (string or null, max 140 chars), source_url (string or null). No markdown, just JSON array. Search thoroughly using all available sources. Return at least 3-5 competitors if possible.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.3,
    max_tokens: 3000 // Reduced for faster response
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000) // Increased to 60s timeout

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

    clearTimeout(timeout)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Perplexity] Error response for comprehensive competitor search:', { status: res.status, body: errorText })
      return []
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    
    console.log('[Perplexity] Comprehensive competitor search response:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 1000)
    })

    // Extract JSON array with multiple strategies
    let competitors: any[] = []
    
    // Strategy 1: Code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
    if (codeBlockMatch) {
      try {
        competitors = JSON.parse(codeBlockMatch[1])
        console.log('[Perplexity] ✅ Extracted from code block:', competitors.length, 'competitors')
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse code block:', e)
      }
    }
    
    // Strategy 2: Find largest JSON array
    if (competitors.length === 0) {
      const jsonArrayMatches = content.match(/\[[\s\S]{20,}?\]/g)
      if (jsonArrayMatches) {
        const sortedMatches = jsonArrayMatches.sort((a: string, b: string) => b.length - a.length)
        for (const match of sortedMatches) {
          try {
            const parsed = JSON.parse(match)
            if (Array.isArray(parsed) && parsed.length > 0) {
              competitors = parsed
              console.log('[Perplexity] ✅ Extracted from response:', competitors.length, 'competitors')
              break
            }
          } catch (e) {
            // Continue
          }
        }
      }
    }
    
    // Strategy 3: Parse entire content
    if (competitors.length === 0) {
      try {
        const parsed = JSON.parse(content.trim())
        if (Array.isArray(parsed)) {
          competitors = parsed
        } else if (parsed.competitors && Array.isArray(parsed.competitors)) {
          competitors = parsed.competitors
        } else if (parsed.data && Array.isArray(parsed.data)) {
          competitors = parsed.data
        }
        if (competitors.length > 0) {
          console.log('[Perplexity] ✅ Parsed entire content:', competitors.length, 'competitors')
        }
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse as JSON:', e)
      }
    }

    console.log('[Perplexity] Raw competitors before validation:', competitors.length)
    
    // Less strict validation - still relevant but more lenient
    const validCompetitors = competitors
      .filter((c: any, index: number) => {
        // Name is required
        const hasName = c.name && typeof c.name === 'string' && c.name.trim().length > 0
        
        if (!hasName) {
          console.log(`[Perplexity] ❌ Rejecting ${index}: missing name`)
          return false
        }
        
        // Website is required but we'll be more lenient with format
        const hasWebsite = c.website && typeof c.website === 'string' && c.website.trim().length > 0
        
        if (!hasWebsite) {
          console.log(`[Perplexity] ❌ Rejecting ${index} (${c.name}): missing website`)
          return false
        }
        
        // More lenient URL normalization - accept domain.com or full URLs
        let website = c.website.trim()
        // Remove common prefixes/suffixes that might cause issues
        website = website.replace(/^www\./i, '')
        website = website.replace(/\/$/, '') // Remove trailing slash
        
        // If it doesn't start with http, add https://
        if (!website.startsWith('http://') && !website.startsWith('https://')) {
          website = `https://${website}`
        }
        
        // More lenient URL validation - just check it has a domain-like structure
        const domainPattern = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(\.[a-zA-Z]{2,})/i
        if (!domainPattern.test(website)) {
          console.log(`[Perplexity] ⚠️ Warning: ${c.name} has unusual URL format: ${website}, but accepting it`)
          // Don't reject - just log a warning
        }
        
        c.website = website
        
        // Exclude self (more lenient check)
        const companyNameLower = companyName.toLowerCase().trim()
        const competitorNameLower = c.name.toLowerCase().trim()
        const notSelf = !competitorNameLower.includes(companyNameLower) &&
                       !companyNameLower.includes(competitorNameLower) &&
                       competitorNameLower !== companyNameLower &&
                       !competitorNameLower.startsWith(companyNameLower) &&
                       !companyNameLower.startsWith(competitorNameLower)
        
        if (!notSelf) {
          console.log(`[Perplexity] ❌ Rejecting ${index} (${c.name}): appears to be self`)
          return false
        }
        
        return true
      })
      .map((c: any) => {
        // Website already normalized in filter step
        let website = c.website || ''
        
        // Ensure evidence pages array
        const evidencePages = [website]
        if (c.source_url && typeof c.source_url === 'string' && c.source_url.trim()) {
          let sourceUrl = c.source_url.trim()
          if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) {
            sourceUrl = `https://${sourceUrl}`
          }
          evidencePages.push(sourceUrl)
        }
        
        return {
          name: String(c.name).trim(),
          website: website,
          hq: (c.hq && typeof c.hq === 'string' && c.hq.trim()) ? String(c.hq).trim() : undefined,
          size_band: (c.size_band && typeof c.size_band === 'string' && c.size_band.trim()) ? String(c.size_band).trim() : undefined,
          positioning: (c.positioning && typeof c.positioning === 'string' && c.positioning.trim()) ? String(c.positioning).trim().substring(0, 140) : undefined,
          evidence_pages: evidencePages,
          source_url: (c.source_url && typeof c.source_url === 'string' && c.source_url.trim()) ? String(c.source_url).trim() : undefined
        }
      })
      .slice(0, 8) // Top 8 competitors

    console.log('[Perplexity] ✅ NEW: Returning', validCompetitors.length, 'valid competitors')
    if (validCompetitors.length > 0) {
      console.log('[Perplexity] Competitor names:', validCompetitors.map(c => c.name))
    } else {
      console.warn('[Perplexity] ⚠️ No valid competitors found')
      if (competitors.length > 0) {
        console.log('[Perplexity] Sample raw competitor:', JSON.stringify(competitors[0], null, 2))
      }
    }
    
    return validCompetitors
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.error('[Perplexity] Comprehensive competitor search timed out')
    } else {
      console.error('[Perplexity] Comprehensive competitor search error:', err)
    }
    return []
  }
}

