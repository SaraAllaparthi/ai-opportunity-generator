// Perplexity provider for company research and competitor search
import { normalizeWebsite } from '@/lib/utils/url'

/**
 * Search for company facts using Perplexity: CEO name, founded year, company size
 * Enhanced CEO search: "Who is CEO of [company name] [Industry] [location] [website address]"
 */
export async function perplexitySearchCompanyFacts(
  companyName: string,
  website?: string,
  countryLocation?: string,
  industry?: string
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

  // Build comprehensive CEO search query with all available context
  const locationPart = countryLocation ? ` ${countryLocation}` : (country ? ` ${country}` : '')
  const industryPart = industry ? ` ${industry}` : ''
  const websitePart = website ? ` ${website}` : ''
  
  // Enhanced query format: Search specifically for CURRENT CEO or Group CEO with company name
  // CRITICAL: Only return the CURRENT/ACTIVE CEO, NOT former or ex-CEOs
  const ceoQuery = `Who is the CURRENT CEO or Group CEO of ${companyName}${industryPart}${locationPart}${websitePart}? Find the full name (first name and last name) of the person who CURRENTLY holds the CEO or Group CEO position. IMPORTANT: Do NOT return former CEOs, ex-CEOs, previous CEOs, or retired CEOs. Only return the name of the person who is the CURRENT, ACTIVE CEO as of 2024-2025.`
  
  // Enhanced founded year query with full context
  const foundedQuery = `When was ${companyName}${industryPart}${locationPart}${websitePart} founded?`

  const query = `${ceoQuery}

Also find:
2. Founded year - ${foundedQuery} Look for "founded", "established", "incorporated", or "registered" followed by a year (YYYY format). Return ONLY the year in format "Founded in YYYY" if found.

3. Company size - How many employees does ${companyName} (${website || 'company website'}) have? Search for the total number of employees, workforce size, or headcount. Look for "employees", "employee count", "workforce", "headcount", "staff", "Mitarbeiter", or "people" followed by a number. Accept any size - small companies (10-100), medium (100-10,000), large (10,000-100,000), or very large (100,000+). Return ONLY in format "X employees" or "X-Y employees" or "X,XXX employees" if found. Include the full number with commas if it's a large number (e.g., "100,000 employees").

CRITICAL REQUIREMENTS:
- CEO: Return ONLY the full name (first name + last name) of the CURRENT, ACTIVE CEO if found. Do NOT return former CEOs, ex-CEOs, previous CEOs, or retired CEOs. Do NOT return titles only (e.g., "CEO" or "Group CEO" without a name). Do NOT infer or guess names. Only return if you find explicit information about the CURRENT CEO as of 2024-2025.
- Founded: Only return if you find an explicit year (e.g., "founded in 1995" or "established 2001"). Do NOT estimate.
- Size: Return the explicit employee count if found (e.g., "50 employees", "100-200 employees", "10,000 employees", "100,000+ employees"). Accept any size - small, medium, large, or very large companies. Include commas for large numbers. Do NOT estimate from revenue, but DO return the actual employee count if explicitly stated.

Return your response as a JSON object with these exact keys: ceo (string or null), founded (string or null), size (string or null). If information is not found, use null for that field.`

  console.log('[Perplexity] Searching company facts:', { companyName, website, countryLocation, country, industry })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'sonar-pro',
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
  const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout (optimized for 90s total)

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
      // CRITICAL: Reject former/ex-CEOs - only accept current CEOs
      else if (lowerStr.match(/(former|ex-|previous|retired|past|prior|outgoing|departed|stepped down|resigned|left).*ceo|ceo.*(former|ex-|previous|retired|past|prior|outgoing|departed|stepped down|resigned|left)/i)) {
        console.log('[Perplexity] Rejected former/ex-CEO (not current CEO):', ceoStr)
      }
      // Accept if it looks like a real name (has at least 2 words, reasonable length)
      else if (ceoStr.length > 0 && ceoStr.length <= 150 && ceoStr.split(/\s+/).length >= 2) {
        // Accept the CEO name - preserve as found (must be current CEO)
        result.ceo = ceoStr
        console.log('[Perplexity] Found current CEO:', result.ceo)
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
    
    // Validate size - accept any valid employee count, including large numbers
    if (facts.size && typeof facts.size === 'string' && facts.size.trim() && facts.size.toLowerCase() !== 'null') {
      const sizeStr = facts.size.trim()
      // Must contain explicit employee count pattern - accept any number (including large ones)
      // Pattern matches: "100 employees", "10,000 employees", "100,000+ employees", "50-200 employees", etc.
      if (sizeStr.match(/\d+[\d,\s-]*(?:\+)?\s*(?:employees?|mitarbeiter|staff|workforce|headcount|people)/i)) {
        // Keep the size as-is (Perplexity should return it in a good format)
        result.size = sizeStr
        console.log('[Perplexity] ✅ Found size:', result.size)
      } else {
        console.log('[Perplexity] ⚠️ Rejected size (no employee count pattern):', facts.size)
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
// REMOVED: perplexitySearchCompetitorsSimple - replaced by findLocalCompetitors
// This function was a simpler version that has been superseded by the enhanced findLocalCompetitors

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

  const query = `You are researching AI use cases for the CEO of ${companyName} in the ${industry} industry${businessContext}${productsContext}${servicesContext}.

CRITICAL NICHE ANALYSIS: First, analyze the business description, products, and services to understand ${companyName}'s exact niche. Understand what ${companyName} produces/provides, their operational processes, target markets, and market position.

For each use case, provide:
1. Title: Verb + Outcome format, SPECIFIC to ${companyName}'s business (e.g., "Reduce Scrap with AI Quality Control for ${companyName}'s Precision Components")
2. Description: One sentence explaining what the use case does - MUST be specific to ${companyName}'s actual business activities, products, services, and processes
3. Value Driver: One of: revenue, cost, risk, speed, quality
4. Value Add: Specific quantified value proposition for ${companyName} (e.g., "Reduces defect rates by 30% in ${companyName}'s production line, saving CHF 150K annually")
5. Complexity: 1-5 (1=simple, 5=complex)
6. Effort: 1-5 (1=low effort, 5=high effort)
7. Estimated Annual Benefit: CHF amount (realistic for ${companyName}'s size and industry)
8. Estimated One-Time Cost: CHF amount
9. Estimated Ongoing Cost: CHF amount per year
10. Payback Months: Number of months to recover investment

CRITICAL REQUIREMENTS FOR CEO-FACING BRIEF:
- Use cases MUST be HIGHLY SPECIFIC to ${companyName}'s niche and actual business activities
- If ${companyName} makes specific products (from business description), use cases must reference those exact products (e.g., if "precision medical devices", use case must be "AI quality control for ${companyName}'s precision medical device manufacturing" not generic "AI quality control")
- If ${companyName} provides specific services (from business description), use cases must reference those exact services (e.g., if "B2B logistics", use case must be "AI route optimization for ${companyName}'s B2B logistics operations" not generic "AI logistics")
- If ${companyName} targets specific markets (from business description), use cases must address those markets
- NO generic industry use cases - all must be tailored to ${companyName}'s specific business
- Prioritize use cases that deliver measurable ROI relevant to ${companyName}'s operations
- Make value propositions concrete, quantified, and directly relevant to ${companyName}'s business
- Consider ${companyName}'s size and industry context
- Order by fastest payback (shortest payback_months first)
- Ensure all numeric fields are realistic and consistent

Return your response as a valid JSON array of use case objects. Each object must have all fields.`

  console.log('[Perplexity] Researching AI use cases for:', { companyName, industry })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: `You are an AI strategy consultant writing for the CEO of ${companyName}. You MUST return your response as a valid JSON array of use case objects. Each object MUST have: title (string - specific to ${companyName}'s business), description (string - specific to ${companyName}'s operations), value_driver (one of: revenue, cost, risk, speed, quality), value_add (string with quantified benefits for ${companyName}), complexity (1-5), effort (1-5), est_annual_benefit (number in CHF), est_one_time_cost (number in CHF), est_ongoing_cost (number in CHF), payback_months (number). Do not include any markdown formatting, just the raw JSON array. Focus on ${companyName}-specific, high-ROI use cases tailored to their exact niche.`
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
    const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout (optimized for 90s total)

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
 * Enhanced competitor search with progressive geographic expansion
 * Searches locally first (city/region), then expands to country, then regional
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
  const industry = crawledData.industry
  const headquarters = crawledData.headquarters
  const businessDesc = crawledData.businessDescription || ''
  const products = crawledData.products || []
  const services = crawledData.services || []
  const targetMarkets = crawledData.targetMarkets || []
  
  // Extract country and city from headquarters (if available)
  const hqParts = headquarters ? headquarters.split(',').map(s => s.trim()) : []
  const city = hqParts[0] || ''
  const country = hqParts[hqParts.length - 1] || ''
  
  // Optimized for speed: Only 1 search stage (fastest path to results)
  const searchStages: Array<{ name: string; location: string; minResults: number }> = []
  
  // Prioritize country-level search (most efficient)
  if (country) {
    searchStages.push({ name: 'country', location: country, minResults: 2 })
  } else if (city && country) {
    // Fallback to local if no country but have city
    searchStages.push({ name: 'local', location: `${city}, ${country}`, minResults: 2 })
  } else {
    // Last resort: general search
    searchStages.push({ name: 'general', location: 'global', minResults: 2 })
  }
  
  let allCompetitors: any[] = []
  const seenCompetitorNames = new Set<string>()
  
  console.log('[Perplexity] 🔍 Enhanced competitor search with progressive expansion:', {
    companyName,
    industry: industry || 'NOT PROVIDED',
    headquarters: headquarters || 'NOT PROVIDED',
    city: city || 'NOT PROVIDED',
    country: country || 'NOT PROVIDED',
    companySize: companySize || 'unknown',
    hasBusinessDesc: !!businessDesc,
    productsCount: products.length,
    servicesCount: services.length,
    targetMarketsCount: targetMarkets.length,
    searchStages: searchStages.length,
    searchStageDetails: searchStages.map(s => ({ name: s.name, location: s.location, minResults: s.minResults }))
  })
  
  if (searchStages.length === 0) {
    console.error('[Perplexity] ❌ CRITICAL: No search stages configured! This should not happen.')
  }
  
  // Search each stage progressively
  for (const stage of searchStages) {
      // Skip if we already have enough competitors (optimized for speed - stop at 2)
      if (allCompetitors.length >= 2) {
        console.log(`[Perplexity] ✅ Already have ${allCompetitors.length} competitors, skipping ${stage.name} stage`)
        break
      }
    
    console.log(`[Perplexity] 🔍 Stage ${stage.name}: Searching in ${stage.location}`)
    
    // Build query for this stage
    const locationEmphasis = stage.name === 'local' 
      ? (city && country ? `Located in ${city}, ${country} (prioritize same city/region)` : '')
      : stage.name === 'country'
      ? (country ? `Located in ${country}` : '')
      : stage.name === 'regional'
      ? (country ? `Located in ${country} or neighboring countries in Europe` : '')
      : 'Global search - find competitors worldwide'
    
    const query = `Find direct competitors for ${companyName} (website: ${companyWebsite}) that operate in the same niche and market.

COMPANY INFORMATION:
- Company Name: ${companyName}
${industry ? `- Industry: ${industry}` : ''}
${headquarters ? `- Location: ${headquarters}` : ''}
${companySize ? `- Company Size: ${companySize}` : ''}
${businessDesc ? `- Business Description: ${businessDesc.substring(0, 300)}` : ''}
${products.length > 0 ? `- Products: ${products.slice(0, 5).join(', ')}` : ''}
${services.length > 0 ? `- Services: ${services.slice(0, 5).join(', ')}` : ''}
${targetMarkets.length > 0 ? `- Target Markets: ${targetMarkets.slice(0, 5).join(', ')}` : ''}

CRITICAL NICHE UNDERSTANDING:
Use the business description, products, services, and target markets to understand this company's specific niche. Find competitors that operate in the SAME niche - companies that:
- Make similar products OR provide similar services
- Serve similar target markets
- Have similar business models
- Compete for the same customers

COMPETITOR REQUIREMENTS FOR THIS SEARCH:
${industry ? `1. Same or similar industry: ${industry}` : '1. Similar business activities and market focus'}
${locationEmphasis ? `2. ${locationEmphasis}` : '2. Global search - find competitors worldwide'}
${products.length > 0 ? `3. Similar niche: Companies that make/provide similar products/services: ${products.slice(0, 3).join(', ')}` : businessDesc ? `3. Similar niche: Companies with similar business: ${businessDesc.substring(0, 100)}` : `3. Similar business activities to ${companyName}`}
4. Active companies with valid websites
5. NOT ${companyName} itself, subsidiaries, or parent companies
6. Include competitors of any size - do not restrict by company size. Find both large and small competitors that operate in the same market.
7. Focus on direct competitors - companies that compete for the same customers and offer similar products/services.

For each competitor found, provide:
- name (required) - company name
- website (required) - official website URL (can be domain.com or full https:// URL)
- hq (optional) - headquarters location in format "City, Country"
- size_band (optional) - company size in format "X employees" or "X-Y employees"
- positioning (optional) - brief description of what they do (max 140 characters)
- source_url (optional) - URL where you found this information

Return your response as a valid JSON array only. Each competitor object must have: name (string), website (string), hq (string or null), size_band (string or null), positioning (string or null), source_url (string or null).

Find at least ${stage.minResults} competitors if possible. Focus on finding real, active companies ${stage.name === 'local' && city && country ? `in ${city}, ${country}` : stage.name === 'country' && country ? `in ${country}` : stage.name === 'regional' && country ? `in ${country} and neighboring countries` : 'worldwide'} that compete directly with ${companyName}.`

    // Make API call for this stage
    const url = 'https://api.perplexity.ai/chat/completions'
    const body = {
      model: 'sonar-pro',
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
      max_tokens: 3000
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout per stage (optimized for 90s total)

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
        console.error(`[Perplexity] Error response for ${stage.name} stage:`, { status: res.status, body: errorText })
        continue // Try next stage
      }

      const json = await res.json()
      const content = json.choices?.[0]?.message?.content || ''
      
      console.log(`[Perplexity] ${stage.name} stage response:`, {
        contentLength: content.length,
        contentPreview: content.substring(0, 500)
      })

      // Extract JSON array with multiple strategies
      let competitors: any[] = []
      
      // Strategy 1: Code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
      if (codeBlockMatch) {
        try {
          competitors = JSON.parse(codeBlockMatch[1])
          console.log(`[Perplexity] ✅ ${stage.name} stage: Extracted from code block:`, competitors.length, 'competitors')
        } catch (e) {
          console.error(`[Perplexity] ❌ ${stage.name} stage: Failed to parse code block:`, e)
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
                console.log(`[Perplexity] ✅ ${stage.name} stage: Extracted from response:`, competitors.length, 'competitors')
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
            console.log(`[Perplexity] ✅ ${stage.name} stage: Parsed entire content:`, competitors.length, 'competitors')
          }
        } catch (e) {
          console.error(`[Perplexity] ❌ ${stage.name} stage: Failed to parse as JSON:`, e)
        }
      }

      console.log(`[Perplexity] ${stage.name} stage: Raw competitors before validation:`, competitors.length)
      if (competitors.length > 0) {
        console.log(`[Perplexity] ${stage.name} stage: Sample raw competitor:`, JSON.stringify(competitors[0], null, 2))
      } else {
        console.warn(`[Perplexity] ⚠️ ${stage.name} stage: No competitors extracted from Perplexity response`)
        console.warn(`[Perplexity] Response status: ${res.status} ${res.statusText}`)
        console.warn(`[Perplexity] Response content length: ${content.length}`)
        console.warn(`[Perplexity] Response preview (first 1000 chars):`, content.substring(0, 1000))
        
        // Try to see if there's any JSON-like structure in the response
        const jsonLikeMatches = content.match(/\{[^{}]*"name"[^{}]*\}/g)
        if (jsonLikeMatches && jsonLikeMatches.length > 0) {
          console.warn(`[Perplexity] Found ${jsonLikeMatches.length} JSON-like objects in response, but couldn't parse as array`)
          console.warn(`[Perplexity] Sample JSON-like object:`, jsonLikeMatches[0])
        }
        
        // Check if response indicates no competitors found
        const noCompetitorsIndicators = ['no competitors', 'no direct competitors', 'unable to find', 'could not find', 'not found']
        const hasNoCompetitorsIndicator = noCompetitorsIndicators.some(indicator => content.toLowerCase().includes(indicator))
        if (hasNoCompetitorsIndicator) {
          console.warn(`[Perplexity] Response indicates no competitors found for this search stage`)
        }
      }
      
      if (competitors.length > 0) {
        console.log(`[Perplexity] ${stage.name} stage: All raw competitors (first 3):`, competitors.slice(0, 3).map((c: any) => ({ name: c.name, website: c.website })))
      }
      
      // Validate and normalize competitors from this stage
      const validCompetitors = competitors
        .filter((c: any, index: number) => {
          // Name is required
          const hasName = c.name && typeof c.name === 'string' && c.name.trim().length > 0
          
          if (!hasName) {
            console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index}: missing name`)
            return false
          }
          
          // Website is required
          const hasWebsite = c.website && typeof c.website === 'string' && c.website.trim().length > 0
          
          if (!hasWebsite) {
            console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index} (${c.name}): missing website`)
            return false
          }
          
          // Normalize URL using shared utility
          try {
            c.website = normalizeWebsite(c.website)
            // Validate URL is valid after normalization
            try {
              new URL(c.website)
            } catch {
              console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index} (${c.name}): invalid URL after normalization: ${c.website}`)
              return false
            }
          } catch (err) {
            console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index} (${c.name}): failed to normalize URL: ${c.website}`, err)
            return false
          }
          
          // Exclude self - be more lenient to avoid false positives
          // Only exclude if names are very similar (exact match or one is clearly a substring of the other)
          const companyNameLower = companyName.toLowerCase().trim()
          const competitorNameLower = c.name.toLowerCase().trim()
          
          // Exact match
          if (competitorNameLower === companyNameLower) {
            console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index} (${c.name}): exact match with company name`)
            return false
          }
          
          // Check if competitor name is clearly the company name with additional words (e.g., "UBS Group" when company is "UBS")
          // Only reject if the competitor name starts with the company name and is significantly longer
          if (competitorNameLower.startsWith(companyNameLower) && competitorNameLower.length > companyNameLower.length + 3) {
            // Might be a subsidiary or parent - check if it's clearly the same company
            const remaining = competitorNameLower.substring(companyNameLower.length).trim()
            const commonSubsidiaryWords = ['group', 'holding', 'ag', 'ltd', 'inc', 'corp', 'company', 'international', 'global']
            if (commonSubsidiaryWords.some(word => remaining.startsWith(word))) {
              console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index} (${c.name}): appears to be parent/subsidiary of ${companyName}`)
              return false
            }
          }
          
          // Check if company name is clearly a substring of competitor (e.g., "UBS" in "UBS Bank")
          // Only reject if it's a very short company name (3 chars or less) to avoid false positives
          if (companyNameLower.length <= 3 && competitorNameLower.includes(companyNameLower)) {
            // Additional check: make sure it's not just a common word
            const commonWords = ['the', 'and', 'for', 'inc', 'ltd', 'ag', 'corp']
            if (!commonWords.includes(companyNameLower)) {
              console.log(`[Perplexity] ❌ ${stage.name} stage: Rejecting ${index} (${c.name}): short company name appears in competitor name`)
              return false
            }
          }
          
          // Check for duplicates (by name)
          const nameKey = competitorNameLower
          if (seenCompetitorNames.has(nameKey)) {
            console.log(`[Perplexity] ⚠️ ${stage.name} stage: Skipping duplicate: ${c.name}`)
            return false
          }
          
          return true
        })
        .map((c: any) => {
          const nameKey = c.name.toLowerCase().trim()
          seenCompetitorNames.add(nameKey)
          
          // Normalize website - already validated above
          let website = c.website || ''
          
          // Build evidence_pages array - ensure all URLs are valid
          const evidencePages: string[] = []
          
          // Add website as primary evidence
          if (website) {
            try {
              // Website is already normalized, but validate it's a valid URL
              new URL(website)
              evidencePages.push(website)
            } catch (err) {
              console.error(`[Perplexity] ❌ ${stage.name} stage: Website is not a valid URL for ${c.name}: ${website}`, err)
            }
          }
          
          // Add source_url if available and valid
          if (c.source_url && typeof c.source_url === 'string' && c.source_url.trim()) {
            try {
              const normalizedSourceUrl = normalizeWebsite(c.source_url)
              // Validate it's a valid URL
              new URL(normalizedSourceUrl)
              // Only add if it's different from website
              if (normalizedSourceUrl !== website) {
                evidencePages.push(normalizedSourceUrl)
              }
            } catch (err) {
              console.warn(`[Perplexity] ⚠️ ${stage.name} stage: Failed to normalize source_url for ${c.name}: ${c.source_url}`, err)
            }
          }
          
          // Ensure we have at least one evidence page (website)
          if (evidencePages.length === 0) {
            console.error(`[Perplexity] ❌ ${stage.name} stage: No valid evidence_pages for ${c.name}!`)
          }
          
          return {
            name: String(c.name).trim(),
            website: website,
            hq: (c.hq && typeof c.hq === 'string' && c.hq.trim()) ? String(c.hq).trim() : undefined,
            size_band: (c.size_band && typeof c.size_band === 'string' && c.size_band.trim()) ? String(c.size_band).trim() : undefined,
            positioning: (c.positioning && typeof c.positioning === 'string' && c.positioning.trim()) ? String(c.positioning).trim().substring(0, 140) : undefined,
            evidence_pages: evidencePages.length > 0 ? evidencePages : [website], // Fallback to website even if invalid (will be caught later)
            source_url: (c.source_url && typeof c.source_url === 'string' && c.source_url.trim()) ? String(c.source_url).trim() : undefined
          }
        })

      console.log(`[Perplexity] ✅ ${stage.name} stage: Found ${validCompetitors.length} valid competitors out of ${competitors.length} raw`)
      if (validCompetitors.length === 0 && competitors.length > 0) {
        console.warn(`[Perplexity] ⚠️ ${stage.name} stage: All ${competitors.length} competitors were filtered out during validation!`)
        console.warn(`[Perplexity] This suggests validation is too strict. Sample rejected competitor:`, JSON.stringify(competitors[0], null, 2))
      }
      
      // Add to accumulated results
      allCompetitors.push(...validCompetitors)
      
      console.log(`[Perplexity] 📊 Total competitors so far: ${allCompetitors.length}`)
      
      // If we have enough, we can break early (already checked at start of loop)
      
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        console.error(`[Perplexity] ${stage.name} stage timed out after 60s`)
      } else {
        console.error(`[Perplexity] ${stage.name} stage error:`, err)
      }
      // Continue to next stage
      continue
    }
  }
  
  // Final deduplication and limit
  const finalCompetitors = allCompetitors
    .slice(0, 8) // Top 8 total

  console.log('[Perplexity] ✅ Enhanced search complete: Returning', finalCompetitors.length, 'total competitors')
  if (finalCompetitors.length > 0) {
    console.log('[Perplexity] Competitor names:', finalCompetitors.map(c => c.name))
    console.log('[Perplexity] Competitor details:', finalCompetitors.map(c => ({
      name: c.name,
      website: c.website,
      hq: c.hq,
      size_band: c.size_band,
      hasEvidencePages: (c.evidence_pages?.length || 0) > 0
    })))
  } else {
    console.warn('[Perplexity] ⚠️ No valid competitors found after all search stages')
    console.warn('[Perplexity] Debug info:', {
      companyName,
      companyWebsite,
      industry,
      headquarters,
      city,
      country,
      companySize,
      searchStagesCompleted: searchStages.length,
      totalRawCompetitors: allCompetitors.length,
      seenCompetitorNames: Array.from(seenCompetitorNames)
    })
  }
  
  return finalCompetitors
}

/**
 * Research competitor capabilities for comparison
 * Extracts key parameters: AI adoption, innovation speed, operational efficiency, market position, technology maturity
 */
export async function researchCompetitorCapabilities(
  competitorName: string,
  competitorWebsite: string,
  industry?: string,
  hq?: string
): Promise<{
  ai_adoption: number // 1-5 scale
  innovation_speed: number // 1-5 scale
  operational_efficiency: number // 1-5 scale
  market_position: number // 1-5 scale
  technology_maturity: number // 1-5 scale
  customer_focus: number // 1-5 scale
  insights: string[] // Key insights about the competitor
}> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.warn('[Perplexity] Missing PERPLEXITY_API_KEY, skipping competitor research')
    return {
      ai_adoption: 3.0,
      innovation_speed: 3.0,
      operational_efficiency: 3.0,
      market_position: 3.0,
      technology_maturity: 3.0,
      customer_focus: 3.0,
      insights: []
    }
  }

  const locationPart = hq ? ` located in ${hq}` : ''
  const industryPart = industry ? ` in the ${industry} industry` : ''

  const query = `You are a business intelligence analyst. Research ${competitorName} (website: ${competitorWebsite})${industryPart}${locationPart} and provide a detailed capability assessment.

STEP 1: RESEARCH ${competitorName}
- Visit and analyze ${competitorWebsite} - examine their technology stack, products, services, and digital capabilities
- Search for recent news, press releases, and announcements about ${competitorName}
- Look for analyst reports, industry rankings, and market research about ${competitorName}
- Find information about ${competitorName}'s AI/ML initiatives, innovation programs, operational efficiency, market position, technology infrastructure, and customer experience

STEP 2: ASSESS EACH DIMENSION WITH SPECIFIC EVIDENCE
For each dimension below, you MUST:
- Find specific evidence about ${competitorName} (not generic industry data)
- Assign a score based on actual findings about ${competitorName}
- Use decimal precision (e.g., 2.3, 3.7, 4.2) to reflect nuanced assessment
- Ensure scores vary across dimensions (companies have strengths and weaknesses)
- Base scores on real data: if ${competitorName} is a tech leader, score technology_maturity 4-5; if they're a startup, score market_position 2-3

Assess ${competitorName}'s capabilities across these dimensions:

1. AI Adoption (1-5 scale): Research ${competitorName}'s actual AI/ML usage and initiatives.
   - Search ${competitorWebsite} for AI/ML mentions, automation projects, digital transformation initiatives
   - Look for news about ${competitorName}'s AI investments, AI partnerships, AI product launches
   - Check if ${competitorName} has AI teams, AI labs, or AI-first strategies
   - Score 5 if ${competitorName} is an AI leader with extensive deployment; 4 if strong AI adoption; 3 if moderate; 2 if limited; 1 if minimal
   - EXAMPLE: If ${competitorName} has AI-powered products mentioned on their website, score 4-5. If no AI mentions, score 1-2.

2. Innovation Speed (1-5 scale): Research ${competitorName}'s actual innovation pace and product launch frequency.
   - Check ${competitorWebsite} for recent product launches, updates, new service announcements
   - Search for news about ${competitorName}'s R&D investments, innovation labs, patent filings
   - Look for mentions of agile development, rapid iteration, fast-moving culture
   - Score 5 if ${competitorName} launches products frequently and is known for innovation; 4 if fast cycles; 3 if moderate; 2 if slow; 1 if very traditional
   - EXAMPLE: If ${competitorName} launched 3+ products in the last year, score 4-5. If no new products in 2+ years, score 1-2.

3. Operational Efficiency (1-5 scale): Research ${competitorName}'s actual operational performance.
   - Look for mentions of efficiency metrics, cost optimization, productivity improvements on ${competitorWebsite}
   - Search for news about ${competitorName}'s operational excellence, lean processes, automation
   - Check if ${competitorName} is known for efficient operations or has operational challenges
   - Score 5 if ${competitorName} is industry-leading in efficiency; 4 if very efficient; 3 if moderate; 2 if some inefficiencies; 1 if known for operational issues
   - EXAMPLE: If ${competitorName} reports high margins or efficiency gains, score 4-5. If they have cost-cutting initiatives, score 2-3.

4. Market Position (1-5 scale): Research ${competitorName}'s actual market standing and brand recognition.
   - Check ${competitorWebsite} for market share claims, industry rankings, awards
   - Search for analyst reports ranking ${competitorName} in their industry
   - Look for news about ${competitorName}'s market leadership, competitive wins, brand strength
   - Score 5 if ${competitorName} is a market leader; 4 if strong position; 3 if established; 2 if smaller player; 1 if niche/emerging
   - EXAMPLE: If ${competitorName} is ranked #1-3 in their industry, score 4-5. If they're a small regional player, score 2-3.

5. Technology Maturity (1-5 scale): Research ${competitorName}'s actual technology infrastructure and digital capabilities.
   - Examine ${competitorWebsite} for technology stack mentions, cloud infrastructure, digital platforms
   - Look for news about ${competitorName}'s technology investments, digital transformation, tech partnerships
   - Check if ${competitorName} uses modern tech (cloud, microservices, APIs) or legacy systems
   - Score 5 if ${competitorName} has cutting-edge tech; 4 if mature stack; 3 if moderate; 2 if basic; 1 if outdated
   - EXAMPLE: If ${competitorName} mentions cloud-native, modern APIs, score 4-5. If they mention legacy systems, score 2-3.

6. Customer Focus (1-5 scale): Research ${competitorName}'s actual customer experience and service quality.
   - Check ${competitorWebsite} for customer experience initiatives, personalization, customer service programs
   - Look for customer satisfaction ratings, awards, testimonials about ${competitorName}
   - Search for news about ${competitorName}'s customer-centric initiatives, service improvements
   - Score 5 if ${competitorName} is highly customer-focused with excellent service; 4 if strong focus; 3 if moderate; 2 if limited; 1 if weak
   - EXAMPLE: If ${competitorName} has customer awards or high satisfaction scores, score 4-5. If customer complaints are common, score 2-3.

Also provide 3-5 key insights about ${competitorName}'s competitive strengths and weaknesses based on your research.

CRITICAL SCORING REQUIREMENTS:
1. NO DEFAULT VALUES: Do NOT return 3.0 for all dimensions. Each score must reflect actual research findings about ${competitorName}.
2. USE DECIMAL PRECISION: Use values like 2.3, 3.7, 4.2 (not just whole numbers) to show nuanced differences.
3. VARY ACROSS DIMENSIONS: ${competitorName} will have strengths (4-5) and weaknesses (1-3). Do NOT cluster all scores around the same value.
4. BASE ON EVIDENCE: 
   - If you find ${competitorName} is a market leader → market_position: 4.0-5.0
   - If ${competitorName} is a startup/small player → market_position: 1.5-3.0
   - If ${competitorName} has AI products on their website → ai_adoption: 3.5-5.0
   - If ${competitorName} has no AI mentions → ai_adoption: 1.0-2.5
   - If ${competitorName} launches products frequently → innovation_speed: 4.0-5.0
   - If ${competitorName} hasn't launched products recently → innovation_speed: 1.5-3.0
5. BE SPECIFIC: Reference actual findings in your insights (e.g., "Found AI-powered features on their website" or "No recent product launches in 18 months")

Return your response as a JSON object with these exact keys:
- ai_adoption (number 1-5, with decimal precision like 2.5, 3.7, 4.2)
- innovation_speed (number 1-5, with decimal precision)
- operational_efficiency (number 1-5, with decimal precision)
- market_position (number 1-5, with decimal precision)
- technology_maturity (number 1-5, with decimal precision)
- customer_focus (number 1-5, with decimal precision)
- insights (array of strings, 3-5 items with specific evidence about ${competitorName})

CRITICAL: Use specific evidence from your research to assign scores. Be objective, data-driven, and ensure scores reflect ${competitorName}'s actual capabilities. Do NOT return generic or default values.`

  console.log('[Perplexity] Researching competitor capabilities:', { competitorName, competitorWebsite, industry, hq })

  const url = 'https://api.perplexity.ai/chat/completions'
  const body = {
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: `You are a business intelligence analyst researching ${competitorName}. You MUST:
1. Visit ${competitorWebsite} and research ${competitorName} thoroughly
2. Use real, specific data about ${competitorName} - not generic industry averages
3. Assign different scores for different companies - avoid default values
4. Use decimal precision (e.g., 2.5, 3.7, 4.2) to show nuanced differences
5. Base scores on actual evidence: website content, news, reports, industry analysis
6. Return ONLY a valid JSON object with exact keys: ai_adoption, innovation_speed, operational_efficiency, market_position, technology_maturity, customer_focus, insights
7. No markdown formatting, just raw JSON`
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.4, // Slightly higher to encourage variation in responses
    max_tokens: 2500
  }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout (optimized for 90s total)

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
      console.error('[Perplexity] Error researching competitor:', { status: res.status, body: errorText })
      // Return default scores on error
      return {
        ai_adoption: 3.0,
        innovation_speed: 3.0,
        operational_efficiency: 3.0,
        market_position: 3.0,
        technology_maturity: 3.0,
        customer_focus: 3.0,
        insights: [`Unable to research ${competitorName} capabilities`]
      }
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    
    console.log('[Perplexity] Competitor research response:', {
      competitorName,
      contentLength: content.length,
      contentPreview: content.substring(0, 500)
    })

    // Extract JSON from response
    let capabilities: any = {}
    
    // Strategy 1: Code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
    if (codeBlockMatch) {
      try {
        capabilities = JSON.parse(codeBlockMatch[1])
        console.log('[Perplexity] ✅ Extracted capabilities from code block')
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse JSON from code block:', e)
      }
    }
    
    // Strategy 2: JSON object anywhere
    if (!capabilities.ai_adoption && !capabilities.innovation_speed) {
      const jsonMatch = content.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        try {
          capabilities = JSON.parse(jsonMatch[0])
          console.log('[Perplexity] ✅ Extracted capabilities from response')
        } catch (e) {
          console.error('[Perplexity] ❌ Failed to parse JSON object:', e)
        }
      }
    }
    
    // Strategy 3: Parse entire content
    if (!capabilities.ai_adoption && !capabilities.innovation_speed) {
      try {
        const parsed = JSON.parse(content.trim())
        if (typeof parsed === 'object' && parsed !== null) {
          capabilities = parsed
          console.log('[Perplexity] ✅ Parsed entire content as JSON')
        }
      } catch (e) {
        console.error('[Perplexity] ❌ Failed to parse response as JSON:', e)
      }
    }

    // Validate and normalize scores (ensure 1-5 range, preserve decimals)
    const normalizeScore = (score: any, dimension: string): number => {
      if (typeof score === 'number') {
        const normalized = Math.max(1, Math.min(5, Math.round(score * 10) / 10))
        if (normalized === 3.0 && score !== 3.0) {
          console.warn(`[Perplexity] ⚠️ ${competitorName} ${dimension} was normalized to 3.0 from ${score}`)
        }
        return normalized
      }
      if (typeof score === 'string') {
        const num = parseFloat(score)
        if (!isNaN(num)) {
          const normalized = Math.max(1, Math.min(5, Math.round(num * 10) / 10))
          if (normalized === 3.0 && num !== 3.0) {
            console.warn(`[Perplexity] ⚠️ ${competitorName} ${dimension} was normalized to 3.0 from ${num}`)
          }
          return normalized
        }
      }
      console.warn(`[Perplexity] ⚠️ ${competitorName} ${dimension} missing or invalid, using default 3.0. Raw value:`, score)
      return 3.0 // Default only if truly missing
    }

    // Log raw capabilities before normalization
    console.log(`[Perplexity] Raw capabilities for ${competitorName}:`, capabilities)
    
    const result = {
      ai_adoption: normalizeScore(capabilities.ai_adoption, 'ai_adoption'),
      innovation_speed: normalizeScore(capabilities.innovation_speed, 'innovation_speed'),
      operational_efficiency: normalizeScore(capabilities.operational_efficiency, 'operational_efficiency'),
      market_position: normalizeScore(capabilities.market_position, 'market_position'),
      technology_maturity: normalizeScore(capabilities.technology_maturity, 'technology_maturity'),
      customer_focus: normalizeScore(capabilities.customer_focus, 'customer_focus'),
      insights: Array.isArray(capabilities.insights) 
        ? capabilities.insights.filter((i: any) => i && typeof i === 'string' && i.trim().length > 0).slice(0, 5)
        : []
    }
    
    // Log score distribution for debugging (but don't reject)
    const scores = [result.ai_adoption, result.innovation_speed, result.operational_efficiency, 
                    result.market_position, result.technology_maturity, result.customer_focus]
    const uniqueScores = new Set(scores.map(s => Math.round(s * 10) / 10)) // Round to 1 decimal for comparison
    const scoreRange = Math.max(...scores) - Math.min(...scores)
    
    if (uniqueScores.size === 1) {
      console.warn(`[Perplexity] ⚠️ All scores for ${competitorName} are identical (${scores[0]}). This may indicate the LLM returned default values, but accepting the response.`)
    } else if (scoreRange < 1.0) {
      console.warn(`[Perplexity] ⚠️ Scores for ${competitorName} are clustered (range: ${scoreRange.toFixed(1)}). Scores:`, scores)
    }

    console.log('[Perplexity] ✅ Competitor capabilities researched:', {
      competitorName,
      scores: {
        ai_adoption: result.ai_adoption,
        innovation_speed: result.innovation_speed,
        operational_efficiency: result.operational_efficiency,
        market_position: result.market_position,
        technology_maturity: result.technology_maturity,
        customer_focus: result.customer_focus
      },
      insightsCount: result.insights.length
    })

    return result
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.error('[Perplexity] Competitor research timed out for:', competitorName)
    } else {
      console.error('[Perplexity] Competitor research error:', err)
    }
    // Return default scores on error
    return {
      ai_adoption: 3.0,
      innovation_speed: 3.0,
      operational_efficiency: 3.0,
      market_position: 3.0,
      technology_maturity: 3.0,
      customer_focus: 3.0,
      insights: [`Research unavailable for ${competitorName}`]
    }
  }
}

