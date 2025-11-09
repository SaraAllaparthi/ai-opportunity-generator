import { tavilySearch } from '@/lib/providers/tavily'
import { llmGenerateJson } from '@/lib/providers/llm'
import { perplexitySearchCompetitors } from '@/lib/providers/perplexity'
import { Brief, BriefSchema, BriefInputSchema, UseCase } from '@/lib/schema/brief'
import { dedupeUrls } from '@/lib/utils/citations'

export type CompetitorStrict = Brief['competitors'][number]

export type PipelineInput = { name: string; website: string }

export type ResearchSnippet = {
  title: string
  url: string
  content: string
  publishedAt?: string
}

type CompetitorCandidate = {
  name: string
  website?: string
  snippet: ResearchSnippet
  industryMatch: number
  geographyMatch: number
  sizeEstimate?: number
  isReferenceMajor?: boolean
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
  
  /** Extract industry tokens from company website snippets */
  function extractIndustryTokens(snippets: ResearchSnippet[], companyName: string): string[] {
    const companyLower = companyName.toLowerCase()
    const combinedText = snippets
      .filter(s => {
        const url = s.url.toLowerCase()
        return url.includes(companyLower.replace(/\s+/g, '')) || 
               url.includes(normalizeDomain(snippets[0]?.url || ''))
      })
      .map(s => `${s.title} ${s.content}`)
      .join(' ')
      .toLowerCase()

    // Extract technical terms and industry keywords (3-6 tokens)
    const tokens: Set<string> = new Set()
    
    // Common patterns for industrial/manufacturing companies
    const patterns = [
      /\b(pvd\s+coating|pvd\s+beschichtung)\b/gi,
      /\b(surface\s+engineering|oberflächenbeschichtung)\b/gi,
      /\b(functional\s+surfaces|funktionale\s+oberflächen)\b/gi,
      /\b(electroplating|galvanisier|galvanotechnik)\b/gi,
      /\b(coating|beschichtung)\b/gi,
      /\b(surface\s+treatment|oberflächenbehandlung)\b/gi,
      /\b(thin\s+film|dünnschicht)\b/gi,
      /\b(mobility|mobilität)\b/gi,
      /\b(energy|energie)\b/gi,
      /\b(semiconductor|halbleiter)\b/gi,
      /\b(manufacturing|fertigung)\b/gi,
      /\b(industrial|industriell)\b/gi
    ]

    patterns.forEach(pattern => {
      const matches = combinedText.match(pattern)
      if (matches) {
        matches.forEach(m => tokens.add(m.trim().toLowerCase()))
      }
    })

    // Also extract 2-3 word technical phrases
    const words = combinedText.split(/\s+/)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`
      if (bigram.length > 8 && bigram.length < 30 && 
          !bigram.includes('the ') && !bigram.includes('and ') &&
          !bigram.match(/^(is|are|was|were|has|have|had|will|would|could|should)\s/i)) {
        // Check if it's a technical term
        if (bigram.match(/(surface|coating|engineering|process|technology|solution|system|equipment|material)/i)) {
          tokens.add(bigram.toLowerCase())
        }
      }
    }

    const result = Array.from(tokens).slice(0, 6)
    console.log('[Pipeline] Extracted industry tokens:', result)
    return result
  }

  /** Extract specialization keywords from company data (products, services, focus areas) */
  function extractSpecializationTokens(
    companySummary: string,
    industryTokens: string[],
    useCases?: any[]
  ): string[] {
    const tokens: Set<string> = new Set()
    const combined = companySummary.toLowerCase()
    
    // Extract product/service keywords from summary
    const specializationPatterns = [
      // Manufacturing/process terms
      /\b(custom|specialized|tailored|bespoke|precision|specialized)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/gi,
      // Service/product offerings
      /\b(offers?|provides?|specializes?\s+in|focuses?\s+on|manufactures?|produces?)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/gi,
      // Technical focus areas
      /\b(niche|specialization|expertise|core\s+competency|main\s+focus)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/gi,
      // Product/service types
      /\b(solutions?|services?|products?|systems?)\s+(?:for|in|of)\s+([a-z]+(?:\s+[a-z]+){0,2})\b/gi,
    ]
    
    specializationPatterns.forEach(pattern => {
      const matches = combined.matchAll(pattern)
      for (const match of matches) {
        if (match[2] && match[2].length > 3 && match[2].length < 25) {
          const term = match[2].toLowerCase().trim()
          // Filter out generic words
          if (!term.match(/^(the|and|for|with|from|this|that|these|those|company|business|customers?|clients?)$/)) {
            tokens.add(term)
          }
        }
      }
    })
    
    // Extract from use cases if available
    if (useCases && useCases.length > 0) {
      useCases.forEach((uc: any) => {
        const title = (uc.title || '').toLowerCase()
        const desc = (uc.description || '').toLowerCase()
        const combinedUC = `${title} ${desc}`
        
        // Extract key technical terms from use cases
        const ucWords = combinedUC.split(/\s+/)
        for (let i = 0; i < ucWords.length - 1; i++) {
          const bigram = `${ucWords[i]} ${ucWords[i + 1]}`
          if (bigram.length > 8 && bigram.length < 30) {
            // Look for technical terms
            if (bigram.match(/(quality|process|production|manufacturing|automation|monitoring|analytics|optimization|efficiency)/i)) {
              tokens.add(bigram.toLowerCase())
            }
          }
        }
      })
    }
    
    // Add industry tokens as specialization context
    industryTokens.forEach(token => {
      tokens.add(token.toLowerCase())
    })
    
    const result = Array.from(tokens).slice(0, 8)
    console.log('[Pipeline] Extracted specialization tokens:', result)
    return result
  }

  /** Extract location hierarchy from headquarters */
  function extractLocationHierarchy(headquarters?: string): {
    city?: string
    country?: string
    region?: string
    isDACH?: boolean
    isEurope?: boolean
  } {
    if (!headquarters) {
      return { region: 'Europe', isEurope: true }
    }

    const hqLower = headquarters.toLowerCase()
    
    // Extract city (usually first part before comma)
    const cityMatch = hqLower.match(/^([^,]+)/)
    const city = cityMatch ? cityMatch[1].trim() : undefined

    // Extract country
    let country: string | undefined
    const countryPatterns = [
      { pattern: /switzerland|schweiz/i, country: 'Switzerland' },
      { pattern: /germany|deutschland/i, country: 'Germany' },
      { pattern: /austria|österreich/i, country: 'Austria' },
      { pattern: /france/i, country: 'France' },
      { pattern: /italy|italia/i, country: 'Italy' },
      { pattern: /spain|españa/i, country: 'Spain' },
      { pattern: /united\s+kingdom|uk|britain/i, country: 'United Kingdom' },
      { pattern: /poland|polska/i, country: 'Poland' },
      { pattern: /netherlands|nederland/i, country: 'Netherlands' }
    ]
    
    for (const { pattern, country: c } of countryPatterns) {
      if (pattern.test(hqLower)) {
        country = c
        break
      }
    }

    // Determine region
    const isDACH = /(switzerland|schweiz|germany|deutschland|austria|österreich|liechtenstein)/i.test(hqLower)
    const isEurope = !/(usa|united\s+states|america|canada|mexico|asia|china|japan)/i.test(hqLower)

    return {
      city,
      country,
      region: isDACH ? 'DACH' : isEurope ? 'Europe' : undefined,
      isDACH,
      isEurope
    }
  }

  /** Build geo-anchored, sector-specific competitor queries using company industry, size, location, and specialization */
  function buildCompetitorQueries(
    companyName: string,
    industryTokens: string[],
    headquarters?: string,
    companyIndustry?: string,
    companySize?: string,
    specializationTokens?: string[]
  ): string[] {
    const queries: string[] = []
    const location = extractLocationHierarchy(headquarters)
    console.log('[Pipeline] Location hierarchy for competitor search:', location)
    console.log('[Pipeline] Company industry:', companyIndustry)
    console.log('[Pipeline] Company size:', companySize)

    // Build industry keywords - MUST use parsed industry or tokens, NO generic defaults
    let coreIndustryTerms = ''
    if (companyIndustry && companyIndustry.trim()) {
      // Use the parsed industry as primary term - be specific
      const industryClean = companyIndustry.replace(/"/g, '').trim()
      if (industryTokens.length > 0) {
        // Combine specific industry with relevant tokens only
        coreIndustryTerms = `"${industryClean}" AND (${industryTokens.slice(0, 3).map(t => `"${t.replace(/"/g, '')}"`).join(' OR ')})`
      } else {
        coreIndustryTerms = `"${industryClean}"`
      }
    } else if (industryTokens.length > 0) {
      // Use only the specific industry tokens - no generic terms
      coreIndustryTerms = industryTokens.slice(0, 5).map(t => `"${t.replace(/"/g, '')}"`).join(' AND ')
    } else {
      // If no industry info, skip competitor search (don't use generic terms)
      console.log('[Pipeline] No specific industry information available - skipping generic competitor search')
      return []
    }

    // Parse company size to create size-specific queries
    let sizeTerms: string[] = []
    let sizeTermsGerman: string[] = []
    if (companySize) {
      const sizeLower = companySize.toLowerCase()
      // Extract employee count if present
      const employeeMatch = sizeLower.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:employees?|mitarbeiter|staff)/)
      if (employeeMatch) {
        const minEmp = parseInt(employeeMatch[1])
        const maxEmp = employeeMatch[2] ? parseInt(employeeMatch[2]) : minEmp
        const avgEmp = Math.round((minEmp + maxEmp) / 2)
        
        // Create size range queries (similar size companies)
        const sizeRange = Math.max(50, Math.round(avgEmp * 0.5)) // ±50% range
        const minSize = Math.max(10, avgEmp - sizeRange)
        const maxSize = Math.min(500, avgEmp + sizeRange)
        
        sizeTerms = [
          `"${minSize}-${maxSize} employees"`,
          `"${Math.round(minSize * 0.8)}-${Math.round(maxSize * 1.2)} employees"`,
          `"under ${maxSize} employees"`,
          'SMB OR SME'
        ]
        sizeTermsGerman = [
          `"${minSize}-${maxSize} Mitarbeiter"`,
          `"${Math.round(minSize * 0.8)}-${Math.round(maxSize * 1.2)} Mitarbeiter"`,
          `"bis ${maxSize} Mitarbeiter"`,
          'KMU'
        ]
      } else if (sizeLower.includes('employee') || sizeLower.includes('mitarbeiter')) {
        // Generic SMB size terms
        sizeTerms = ['"under 500 employees"', '"100-500 employees"', 'SMB OR SME']
        sizeTermsGerman = ['"bis 500 Mitarbeiter"', '"100-500 Mitarbeiter"', 'KMU']
      }
    } else {
      // Default to SMB size if no size info
      sizeTerms = ['"under 500 employees"', '"100-500 employees"', 'SMB OR SME']
      sizeTermsGerman = ['"bis 500 Mitarbeiter"', '"100-500 Mitarbeiter"', 'KMU']
    }

    // Hard exclusions (add to every query)
    const hardExclusions = '-market-research -report -news -press -SaaS -software -agency -advertising -retail -jobs -recruiting -Wikipedia -LinkedIn -CBInsights -Owler -G2 -ZoomInfo -directories-only -Oerlikon -voestalpine -Bühler'
    
    // Query 1: Industry + competitors + city + size (most specific - REQUIRES headquarters and size)
    if (location.city && companySize) {
      const sizePart = location.isDACH 
        ? `(${sizeTermsGerman.slice(0, 2).join(' OR ')})`
        : `(${sizeTerms.slice(0, 2).join(' OR ')})`
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter OR Hersteller) ${location.city} ${sizePart} ${hardExclusions}`)
      console.log(`[Pipeline] Query 1: Using city (${location.city}) and size (${companySize})`)
    }
    
    // Query 2: Industry + competitors + country + size (broader geographic - REQUIRES headquarters and size)
    if (location.country && companySize) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      const sizePart = location.isDACH 
        ? `(${sizeTermsGerman.slice(0, 2).join(' OR ')})`
        : `(${sizeTerms.slice(0, 2).join(' OR ')})`
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter) ${countryTerm} ${sizePart} ${hardExclusions}`)
      console.log(`[Pipeline] Query 2: Using country (${countryTerm}) and size (${companySize})`)
    }
    
    // Query 2b: Industry + competitors + country (if size not available, still use headquarters)
    if (location.country && !companySize) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter) ${countryTerm} ${hardExclusions}`)
      console.log(`[Pipeline] Query 2b: Using country (${countryTerm}) without size filter`)
    }
    
    // Query 3: Industry + size-specific + country (focus on similar size - REQUIRES both)
    if (location.country && companySize) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      if (location.isDACH) {
        queries.push(`(${coreIndustryTerms}) (${sizeTermsGerman.join(' OR ')}) ${countryTerm} ${hardExclusions}`)
      } else {
        queries.push(`(${coreIndustryTerms}) (${sizeTerms.join(' OR ')}) ${location.country} ${hardExclusions}`)
      }
      console.log(`[Pipeline] Query 3: Using country (${countryTerm}) and size-specific terms`)
    }
    
    // Query 4: Industry-specific service terms + location + size (REQUIRES both)
    if (location.isDACH && location.country && companySize) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      queries.push(`(${coreIndustryTerms}) (Dienstleister OR Lohnbeschichtung OR Auftragsfertigung) ${countryTerm} (${sizeTermsGerman.slice(0, 2).join(' OR ')}) ${hardExclusions}`)
      console.log(`[Pipeline] Query 4: Using DACH location (${countryTerm}) and size`)
    } else if (location.country && companySize) {
      queries.push(`(${coreIndustryTerms}) (services OR solutions OR manufacturing) ${location.country} (${sizeTerms.slice(0, 2).join(' OR ')}) ${hardExclusions}`)
      console.log(`[Pipeline] Query 4: Using country (${location.country}) and size`)
    }
    
    // Query 5: Adjacent regions for border areas (within 150km, same language) - REQUIRES size
    if (location.isDACH && location.city && companySize) {
      // For Swiss companies, also check Germany/Austria border regions
      if (location.country === 'Switzerland') {
        queries.push(`(${coreIndustryTerms}) (Unternehmen OR Anbieter) (Baden-Württemberg OR Bayern OR Vorarlberg) (${sizeTermsGerman.slice(0, 2).join(' OR ')}) ${hardExclusions}`)
        console.log(`[Pipeline] Query 5: Using adjacent DACH regions with size filter`)
      }
    }
    
    // Query 6: Industry name directly if we have a specific industry - REQUIRES headquarters and size
    if (companyIndustry && companyIndustry.trim() && location.country && companySize) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      const sizePart = location.isDACH 
        ? `(${sizeTermsGerman.slice(0, 1).join(' OR ')})`
        : `(${sizeTerms.slice(0, 1).join(' OR ')})`
      queries.push(`"${companyIndustry}" ${countryTerm} ${sizePart} (companies OR Unternehmen) ${hardExclusions}`)
      console.log(`[Pipeline] Query 6: Using specific industry (${companyIndustry}), country (${countryTerm}), and size`)
    }
    
    // Query 7: Specialization-focused queries (if we have specialization tokens) - REQUIRES headquarters and size
    if (specializationTokens && specializationTokens.length > 0 && location.country && companySize) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      const topSpecializations = specializationTokens.slice(0, 3).filter(t => t.length > 5) // Filter out very short tokens
      if (topSpecializations.length > 0) {
        const specializationPart = topSpecializations.map(t => `"${t}"`).join(' OR ')
        const sizePart = location.isDACH 
          ? `(${sizeTermsGerman.slice(0, 1).join(' OR ')})`
          : `(${sizeTerms.slice(0, 1).join(' OR ')})`
        queries.push(`(${specializationPart}) ${countryTerm} ${sizePart} (companies OR Unternehmen OR Anbieter) ${hardExclusions}`)
        console.log(`[Pipeline] Query 7: Using specialization (${topSpecializations.join(', ')}), country (${countryTerm}), and size`)
      }
    }

    console.log('[Pipeline] Built geo-anchored competitor queries using industry, size, location, and specialization:', queries)
    return queries
  }

  /** SMB/industrial-focused query builder */
  function buildQueries({ name, website }: PipelineInput): string[] {
    const domain = stripProtocol(website)
  
    return [
      // Company-anchored (primary)
      `${name} site:${domain} company overview OR about`,
      `${name} site:${domain} products OR solutions OR industries`,
      `${name} site:${domain} press OR news OR media 2024..today`,
      
      // Company facts (founding year, CEO, leadership, employee count)
      `${name} founded OR established OR incorporated OR registered OR since`,
      `${name} CEO OR "Chief Executive Officer" OR founder OR leadership OR management team`,
      `${name} LinkedIn CEO OR executive OR "managing director" OR "Geschäftsführer" OR "CEO"`,
      `${name} employees OR "number of employees" OR "employee count" OR workforce OR staffing OR headcount`,
  
      // Industry/operations (SMB bias)
      `${name} manufacturing operations capabilities quality control`,
      `${name} industry trends manufacturing OR industrial automation 2023..today`,
      `${name} sustainability energy efficiency supply chain 2023..today`,
  
      // Strategy/moves/customers
      `${name} partnerships clients investments expansion 2024..today`,
      `${name} customer case study 2023..today`,
  
      // Competitive & challenges (will be replaced by focused competitor search)
      `${name} competitors peers alternatives comparison`,
      `${name} operational bottlenecks downtime scrap rework issues`,
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
  unique.sort((a, b) => scoreSnippet(b, input) - scoreSnippet(a, input))

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

/** Filter and score competitor candidates from search results */
function filterAndScoreCompetitorCandidates(
  snippets: ResearchSnippet[],
  companyName: string,
  companyWebsite: string,
  industryTokens: string[],
  headquarters?: string,
  companySize?: string,
  specializationTokens?: string[]
): CompetitorCandidate[] {
  const company = (companyName || '').trim().toLowerCase()
  const companyDom = normalizeDomain(companyWebsite)
  const candidates: CompetitorCandidate[] = []

  // Hard negatives - domains/patterns to exclude (from specification)
  const junkDomains = [
    /market-research|report|news|press|saas|software|agency|advertising|retail|jobs|recruiting|wikipedia|linkedin|cbinsights|owler|g2|zoominfo|directories-only/i,
    /owler\.com/i, /softwaresuggest\.com/i, /softwareadvice\.com/i, 
    /g2\.com/i, /crunchbase\.com/i, /linkedin\.com/i, /wikipedia\.org/i,
    /indeed\.com/i, /glassdoor\.com/i
  ]
  const negativePatterns = [
    /oerlikon|voestalpine|bühler/i, // Global leaders/OEMs to exclude
    /advertising|marketing\s+agency|retail|food|restaurant|music|guitar|martin\s+guitar/i,
    /consulting|consultant|advisor|advisory/i, // Too generic
    /DNB|Bouncewatch/i, // Specific exclusions
    /analytics\s+tools?|data\s+broker|software\s+platform/i, // Not actual competitors
    /global\s+group|holding\s+company|oem\s+manufacturer/i // Exclude global groups
  ]
  
  // Exclude generic "Martin" entries that aren't surface engineering
  const excludedNames = ['martin guitar', 'martin guitars', 'martin agency', 'martin consulting']

  for (const snippet of snippets) {
    const url = snippet.url.toLowerCase()
    const content = `${snippet.title} ${snippet.content}`.toLowerCase()

    // Skip junk domains
    if (junkDomains.some(rx => rx.test(url))) continue
    
    // Skip if matches negative patterns
    if (negativePatterns.some(rx => rx.test(content))) continue

    // Extract company name from title/URL
    let candidateName = snippet.title
    
    // Try to extract company name from URL
    try {
      const urlObj = new URL(snippet.url)
      const hostParts = urlObj.hostname.replace(/^www\./, '').split('.')
      if (hostParts.length >= 2) {
        candidateName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1)
      }
    } catch {}
    
    // Skip excluded generic names
    const candidateLower = candidateName.toLowerCase()
    if (excludedNames.some(name => candidateLower.includes(name))) continue

    // Skip if it's the same company
    if (candidateName.toLowerCase().includes(company) || 
        company.includes(candidateName.toLowerCase())) continue
    if (url.includes(companyDom)) continue

    // Score industry match - MUST match specific industry tokens, not generic terms
    // Require at least 2 industry token matches to ensure relevance
    let industryMatch = 0
    let industryTokenMatches = 0
    
    // Check for matches with specific industry tokens (required)
    if (industryTokens.length > 0) {
      industryTokens.forEach(token => {
        const tokenLower = token.toLowerCase().trim()
        if (tokenLower.length > 3) { // Only check meaningful tokens
          // Exact word match (higher weight)
          if (content.includes(` ${tokenLower} `) || 
              content.includes(` ${tokenLower},`) || 
              content.includes(` ${tokenLower}.`) ||
              content.includes(` ${tokenLower}`)) {
            industryTokenMatches += 1
          }
        }
      })
      
      // Require at least 2 industry token matches for relevance
      if (industryTokenMatches < 2) {
        industryMatch = 0 // Not a true competitor - doesn't match specific industry
        console.log(`[Pipeline] Rejecting ${candidateName} - insufficient industry token matches (${industryTokenMatches}/${industryTokens.length})`)
      } else {
        // Score based on token matches
        industryMatch = Math.min(1, industryTokenMatches / Math.max(2, industryTokens.length))
      }
    } else {
      // If no industry tokens, cannot determine relevance - reject
      industryMatch = 0
      console.log(`[Pipeline] Rejecting ${candidateName} - no industry tokens available for matching`)
    }
    
    // Score specialization match (products, services, focus areas)
    let specializationMatch = 0.5 // Default neutral score
    if (specializationTokens && specializationTokens.length > 0) {
      let specializationMatches = 0
      specializationTokens.forEach(token => {
        const tokenLower = token.toLowerCase()
        // Exact match
        if (content.includes(` ${tokenLower} `) || content.includes(` ${tokenLower},`) || content.includes(` ${tokenLower}.`)) {
          specializationMatches += 1
        }
        // Partial match (within phrase)
        else if (content.includes(tokenLower)) {
          specializationMatches += 0.5
        }
      })
      // Calculate specialization match score (0-1)
      specializationMatch = Math.min(1, 0.5 + (specializationMatches / Math.max(1, specializationTokens.length)) * 0.5)
    }

    // Score geography match with hierarchy: city > country > region
    let geographyMatch = 0
    const location = extractLocationHierarchy(headquarters)
    
    if (headquarters) {
      const hqLower = headquarters.toLowerCase()
      
      // Exact match: same city (highest priority)
      if (location.city && (content.includes(location.city.toLowerCase()) || url.includes(location.city.toLowerCase()))) {
        geographyMatch = 1.0
      }
      // Country match: same country (high priority)
      else if (location.country) {
        const countryLower = location.country.toLowerCase()
        const countryVariants = {
          'switzerland': ['switzerland', 'schweiz', 'ch', 'zurich', 'bern', 'basel'],
          'germany': ['germany', 'deutschland', 'de', 'berlin', 'munich', 'hamburg'],
          'austria': ['austria', 'österreich', 'at', 'vienna', 'wien'],
          'france': ['france', 'french', 'paris', 'lyon'],
          'italy': ['italy', 'italia', 'rome', 'milan', 'milano']
        }
        
        const variants = countryVariants[countryLower as keyof typeof countryVariants] || [countryLower]
        const hasCountryMatch = variants.some(v => content.includes(v) || url.includes(v))
        
        if (hasCountryMatch) {
          geographyMatch = 0.8
        } else if (location.isDACH && /dach|switzerland|germany|austria|schweiz|deutschland/i.test(content)) {
          geographyMatch = 0.6 // Same region
        } else if (location.isEurope && /europe|europa/i.test(content)) {
          geographyMatch = 0.4 // Same broader region
        }
      } else if (location.isEurope) {
        // Default Europe match
        if (/europe|europa/i.test(content)) {
          geographyMatch = 0.6
        }
      }
    } else {
      // Default Europe
      if (/europe|europa/i.test(content)) {
        geographyMatch = 0.5
      }
    }

    // Estimate size (look for employee counts from LinkedIn/Craft/Owler/Growjo)
    let sizeEstimate: number | undefined
    let isReferenceMajor = false
    let sizeMatchScore = 0.5 // Default neutral score
    
    // Try multiple patterns for employee count
    const sizePatterns = [
      /(\d+)[\s-]*(employees|staff|workforce|people|headcount)/i,
      /employ[^\d]*(\d+)/i,
      /workforce[^\d]*(\d+)/i,
      /team[^\d]*of[^\d]*(\d+)/i
    ]
    
    for (const pattern of sizePatterns) {
      const sizeMatch = content.match(pattern)
      if (sizeMatch) {
        sizeEstimate = parseInt(sizeMatch[1])
        break
      }
    }
    
    // If we have company size, calculate size match score
    if (companySize && sizeEstimate) {
      const sizeLower = companySize.toLowerCase()
      const employeeMatch = sizeLower.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:employees?|mitarbeiter|staff)/)
      if (employeeMatch) {
        const minEmp = parseInt(employeeMatch[1])
        const maxEmp = employeeMatch[2] ? parseInt(employeeMatch[2]) : minEmp
        const avgEmp = Math.round((minEmp + maxEmp) / 2)
        
        // Score based on how close the competitor size is to company size
        const sizeDiff = Math.abs(sizeEstimate - avgEmp)
        const sizeRange = Math.max(50, Math.round(avgEmp * 0.5))
        
        if (sizeDiff <= sizeRange * 0.5) {
          sizeMatchScore = 1.0 // Very similar size (within 25% of range)
        } else if (sizeDiff <= sizeRange) {
          sizeMatchScore = 0.8 // Similar size (within 50% of range)
        } else if (sizeDiff <= sizeRange * 2) {
          sizeMatchScore = 0.6 // Somewhat similar (within 100% of range)
        } else {
          sizeMatchScore = 0.3 // Different size
        }
      }
    }
    
    // If > 500 but highly relevant, tag as reference major (only one allowed)
    if (sizeEstimate && sizeEstimate > 500) {
      if (industryMatch > 0.7 && geographyMatch > 0.7) {
        isReferenceMajor = true
        sizeMatchScore = 0.2 // Penalize large companies
      } else {
        continue // Skip if not highly relevant
      }
    }

    // STRICT FILTERING: Must have clear industry match AND geography match AND size constraint
    // Only keep if:
    // 1. Clear industry match (MUST match at least 2 industry tokens - industryMatch > 0)
    // 2. Same geography (headquarters region)
    // 3. Size estimate is ≤500 employees (or unknown, but never >500 unless reference major)
    const isValidSize = !sizeEstimate || sizeEstimate <= 500 || isReferenceMajor
    
    // Require industryMatch > 0 (which means at least 2 industry token matches)
    if (industryMatch > 0 && geographyMatch > 0.3 && isValidSize) {
      // Extract clean website URL
      let websiteUrl: string | undefined = undefined
      try {
        const urlObj = new URL(snippet.url)
        websiteUrl = `${urlObj.protocol}//${urlObj.hostname}`
      } catch {
        websiteUrl = snippet.url
      }
      
      candidates.push({
        name: candidateName.trim(),
        website: websiteUrl,
        snippet,
        industryMatch,
        geographyMatch,
        sizeEstimate,
        isReferenceMajor,
        sizeMatchScore,
        specializationMatch
      } as CompetitorCandidate & { isReferenceMajor?: boolean; sizeMatchScore?: number; specializationMatch?: number })
    }
  }

  // Rank by: geography (headquarters region) > size match > industry match > specialization match
  // STRICT: Prioritize competitors from same headquarters region, similar size, same industry, similar specialization
  candidates.sort((a, b) => {
    // First, separate reference majors (limit to 1) - they go to bottom
    const aIsRef = (a as any).isReferenceMajor || false
    const bIsRef = (b as any).isReferenceMajor || false
    
    if (aIsRef && !bIsRef) return 1
    if (!aIsRef && bIsRef) return -1
    
    // Priority 1: Geography match (headquarters region) - MOST IMPORTANT
    // Same city (1.0) > same country (0.8) > same region (0.6) > broader region (0.4)
    if (Math.abs(a.geographyMatch - b.geographyMatch) > 0.15) {
      return b.geographyMatch - a.geographyMatch
    }
    
    // Priority 2: Size proximity - SECOND MOST IMPORTANT (after geography)
    // Prefer competitors with similar size to the input company
    const aSizeScore = (a as any).sizeMatchScore
    const bSizeScore = (b as any).sizeMatchScore
    
    if (aSizeScore !== undefined && bSizeScore !== undefined) {
      // Use size match scores (higher is better - similar size)
      if (Math.abs(aSizeScore - bSizeScore) > 0.1) {
        return bSizeScore - aSizeScore
      }
    } else {
      // Fallback to size estimate proximity
      const aSize = a.sizeEstimate || 1000
      const bSize = b.sizeEstimate || 1000
      const idealSize = 200 // Ideal SMB size
      const aSizeDiff = Math.abs(aSize - idealSize)
      const bSizeDiff = Math.abs(bSize - idealSize)
      
      // If both have size estimates, prefer closer to ideal
      if (a.sizeEstimate && b.sizeEstimate) {
        if (Math.abs(aSizeDiff - bSizeDiff) > 50) {
          return aSizeDiff - bSizeDiff
        }
      }
      // Prefer known size over unknown
      if (a.sizeEstimate && !b.sizeEstimate) return -1
      if (!a.sizeEstimate && b.sizeEstimate) return 1
    }
    
    // Priority 3: Industry match (must be same industry)
    if (Math.abs(a.industryMatch - b.industryMatch) > 0.15) {
      return b.industryMatch - a.industryMatch
    }
    
    // Priority 4: Specialization match (products/services/focus areas)
    const aSpecMatch = (a as any).specializationMatch || 0.5
    const bSpecMatch = (b as any).specializationMatch || 0.5
    if (Math.abs(aSpecMatch - bSpecMatch) > 0.15) {
      return bSpecMatch - aSpecMatch
    }
    
    // Default: prefer higher geography match (headquarters location)
    return b.geographyMatch - a.geographyMatch
  })

  // Limit reference majors to at most 1
  const referenceMajors = candidates.filter(c => (c as any).isReferenceMajor)
  const smbCandidates = candidates.filter(c => !(c as any).isReferenceMajor)
  
  const finalCandidates = [
    ...smbCandidates,
    ...referenceMajors.slice(0, 1)
  ].slice(0, 10)

  console.log('[Pipeline] Filtered competitor candidates:', finalCandidates.slice(0, 5).map(c => ({
    name: c.name,
    industryMatch: c.industryMatch,
    geographyMatch: c.geographyMatch,
    sizeEstimate: c.sizeEstimate,
    isReferenceMajor: (c as any).isReferenceMajor
  })))

  return finalCandidates
}

/** Enrich competitor with additional details and collect evidence pages */
async function enrichCompetitor(
  candidate: CompetitorCandidate,
  industryTokens: string[],
  headquarters?: string
): Promise<CompetitorStrict | null> {
  // Extract website from snippet URL
  let website = candidate.website
  if (!website || website === candidate.snippet.url) {
    try {
      const urlObj = new URL(candidate.snippet.url)
      website = `${urlObj.protocol}//${urlObj.hostname}`
    } catch {
      website = candidate.snippet.url
    }
  }

  // Ensure website is a valid URL format
  if (website && !website.match(/^https?:\/\//)) {
    website = `https://${website}`
  }

  // Validate website is parseable (not example.com or invalid)
  if (!website) {
    console.log(`[Pipeline] No website found for ${candidate.name}, rejecting competitor`)
    return null
  }
  
  try {
    const urlObj = new URL(website)
    // Reject example.com or invalid domains
    if (urlObj.hostname.includes('example.com') || urlObj.hostname.includes('localhost')) {
      console.log(`[Pipeline] Invalid website domain for ${candidate.name}: ${urlObj.hostname}`)
      return null
    }
    // Normalize to origin
    website = `${urlObj.protocol}//${urlObj.hostname}`
  } catch (err) {
    console.log(`[Pipeline] Website URL not parseable for ${candidate.name}: ${website}`, err)
    return null
  }

  // Collect evidence pages from company domain (homepage + services/about/team)
  const domain = normalizeDomain(website)
  const evidencePageQueries = [
    `site:${domain} homepage OR start OR "Willkommen" OR "Home"`,
    `site:${domain} ("Über uns" OR "About" OR "Entreprise" OR "Chi siamo" OR "Company")`,
    `site:${domain} ("Leistungen" OR "Services" OR "Solutions" OR "Dienstleistungen")`,
    `site:${domain} (Mitarbeiter OR employees OR team OR "KMU" OR "SME" OR "Über uns")`,
  ]

  const evidencePages: string[] = [website] // Always include homepage
  let allEvidenceContent = candidate.snippet.content

  for (const query of evidencePageQueries.slice(0, 3)) {
    try {
      const results = await tavilySearch(query, {
        maxResults: 2,
        searchDepth: 'advanced'
      })
      for (const result of results) {
        const resultDomain = normalizeDomain(result.url)
        if (resultDomain === domain && !evidencePages.includes(result.url)) {
          evidencePages.push(result.url)
          allEvidenceContent += ' ' + result.content
        }
      }
    } catch (err) {
      console.log(`[Pipeline] Evidence page search failed for ${query}:`, err)
    }
  }

  // Require at least 2 evidence pages from the domain
  if (evidencePages.length < 2) {
    console.log(`[Pipeline] Insufficient evidence pages (${evidencePages.length}) for ${candidate.name}, rejecting competitor`)
    return null
  }

  const allContent = allEvidenceContent.toLowerCase()
  
  // Extract employee band (e.g., "50-200 employees")
  let employeeBand = ''
  const sizePatterns = [
    /(\d+)[\s-]*to[\s-]*(\d+)[\s-]*(employees|mitarbeiter|staff|people)/i,
    /(\d+)[\s-]*-[\s-]*(\d+)[\s-]*(employees|mitarbeiter|staff|people)/i,
    /(\d+)[\s-]+(employees|mitarbeiter|staff|people|team)/i,
    /(family-owned|klein|small|KMU|SME|SMB).*?(\d+)/i
  ]
  
  for (const pattern of sizePatterns) {
    const match = allContent.match(pattern)
    if (match) {
      if (match[2] && match[1] && match[3]) {
        // Range format
        employeeBand = `${match[1]}-${match[2]} employees`
      } else if (match[1] && match[2] && !match[3]) {
        // Single number
        const num = parseInt(match[1])
        if (num <= 500) {
          employeeBand = `${num} employees`
        } else {
          return null // Too large
        }
      }
      break
    }
  }

  // Validate size - must be ≤500 employees
  if (!employeeBand) {
    // Try one more focused query
    try {
      const sizeQuery = `site:${domain} (Mitarbeiter OR employees OR team OR "KMU" OR "SME" OR headcount)`
      const sizeResults = await tavilySearch(sizeQuery, {
        maxResults: 3,
        searchDepth: 'advanced'
      })
      for (const result of sizeResults) {
        const sizeMatch = result.content.match(/(\d+)[\s-]*(employees|mitarbeiter|staff|people)/i)
        if (sizeMatch) {
          const num = parseInt(sizeMatch[1])
          if (num <= 500) {
            employeeBand = `${num} employees`
            break
          } else {
            return null // Too large
          }
        }
      }
    } catch {}
  }

  // Require employee size - no fallbacks
  if (!employeeBand) {
    console.log(`[Pipeline] No employee size found for ${candidate.name}, rejecting competitor`)
    return null
  }

  // Extract geo_fit (country/region match) - require valid location
  const location = extractLocationHierarchy(headquarters)
  let geoFit = ''
  if (location.country) {
    geoFit = location.country
    if (location.city) {
      geoFit = `${location.city}, ${location.country}`
    }
  } else if (location.region) {
    geoFit = location.region
  } else {
    // Use input company HQ as fallback only if API missing
    geoFit = headquarters || ''
  }
  
  // Require geo_fit - no "Unknown" fallbacks
  if (!geoFit || geoFit.trim() === '') {
    console.log(`[Pipeline] No geo_fit found for ${candidate.name}, rejecting competitor`)
    return null
  }

  // Extract positioning - plain sentence: what they do and for whom
  let positioning = ''
  const positioningSentences = allEvidenceContent.split(/[.!?]\s+/).filter(s => {
    const lower = s.toLowerCase()
    return s.length > 40 && s.length < 200 &&
           (lower.includes('provide') || lower.includes('offer') || lower.includes('specializ') ||
            lower.includes('produces') || lower.includes('manufactur') || lower.includes('serves') ||
            lower.includes('leistungen') || lower.includes('dienstleistungen'))
  })
  if (positioningSentences.length > 0) {
    positioning = positioningSentences[0].replace(/\s+/g, ' ').substring(0, 180).trim()
  }

  // Require positioning - no fallbacks
  if (!positioning || positioning.length < 20) {
    console.log(`[Pipeline] Positioning too short or missing for ${candidate.name}, rejecting competitor`)
    return null
  }

  // Extract AI maturity - require from content, no fallbacks
  let aiMaturity = ''
  if (allContent.match(/(predictive\s+maintenance|digital\s+process\s+monitoring|mes\s+analytics)/i)) {
    aiMaturity = 'Uses digital process monitoring and predictive maintenance'
  } else if (allContent.match(/(mes|manufacturing\s+execution|process\s+monitoring)/i)) {
    aiMaturity = 'Uses MES analytics and process monitoring'
  } else if (allContent.match(/(digital\s+process|data\s+analytics|ai|machine\s+learning)/i)) {
    aiMaturity = 'Uses digital process monitoring and data analytics'
  } else if (allContent.match(/(automation|digital|software|system)/i)) {
    aiMaturity = 'Some digital transformation initiatives'
  }
  
  // Require AI maturity - no fallbacks
  if (!aiMaturity || aiMaturity.trim() === '') {
    console.log(`[Pipeline] No AI maturity found for ${candidate.name}, rejecting competitor`)
    return null
  }

  // Extract innovation focus - require from content, no fallbacks
  let innovationFocus = ''
  if (allContent.match(/(quality\s+analytics|customer-specific|custom\s+coatings|tailored)/i)) {
    innovationFocus = 'Quality analytics and customer-specific coatings'
  } else if (allContent.match(/(quality|custom|specific|tailored)/i)) {
    innovationFocus = 'Quality and customer-specific solutions'
  } else if (allContent.match(/(process\s+efficiency|optimization|productivity)/i)) {
    innovationFocus = 'Process efficiency'
  } else if (allContent.match(/(sustainability|environmental|green)/i)) {
    innovationFocus = 'Sustainability and environmental compliance'
  }
  
  // Require innovation focus - no fallbacks
  if (!innovationFocus || innovationFocus.trim() === '') {
    console.log(`[Pipeline] No innovation focus found for ${candidate.name}, rejecting competitor`)
    return null
  }

  return {
    name: candidate.name.trim(),
    website: website,
    positioning: positioning.substring(0, 200).trim(),
    ai_maturity: aiMaturity.trim(),
    innovation_focus: innovationFocus.trim(),
    employee_band: employeeBand,
    geo_fit: geoFit,
    evidence_pages: evidencePages.slice(0, 5), // Limit to 5
    citations: [candidate.snippet.url, ...evidencePages.slice(1, 4)]
  }
}

/** Competitor filter: remove self, defunct/acquired brands, junk */
function filterCompetitors(
  comps: unknown[] | undefined,
  companyName: string,
  companyWebsite: string,
  opts?: {
    defunctNames?: RegExp[]          // e.g., [/credit\s*suisse/i]
    junkDomains?: RegExp[]           // e.g., [/owler\.com/i]
    minNameLength?: number
    maxCount?: number
  }
): CompetitorStrict[] {
  if (!Array.isArray(comps) || comps.length === 0) {
    return []
  }
  const company = (companyName || '').trim().toLowerCase()
  const companyDom = normalizeDomain(companyWebsite)
  const {
    defunctNames = [],
    junkDomains = [/owler\.com/i, /softwaresuggest\.com/i, /softwareadvice\.com/i, /g2\.com/i],
    minNameLength = 0,
    maxCount = 5,
  } = opts || {}

  const good: CompetitorStrict[] = []
  for (const item of comps) {
    // Coerce name: String(item.name || '').trim() - drop if empty
    const name = String((item as any)?.name || '').trim()
    if (!name) continue

    // Coerce website: normalized or undefined
    const websiteRaw = (item as any)?.website
    const website = websiteRaw ? normalizeDomain(String(websiteRaw)) : undefined

    // Coerce positioning: trimmed or undefined
    const positioningRaw = (item as any)?.positioning
    const positioning = positioningRaw ? String(positioningRaw).trim() : undefined

    // Coerce ai_maturity: trimmed or undefined
    const aiMaturityRaw = (item as any)?.ai_maturity
    const aiMaturity = aiMaturityRaw ? String(aiMaturityRaw).trim() : undefined

    // Coerce innovation_focus: trimmed or undefined
    const innovationFocusRaw = (item as any)?.innovation_focus
    const innovationFocus = innovationFocusRaw ? String(innovationFocusRaw).trim() : undefined

    // Coerce citations: Array.isArray(item.citations) ? (strings only) : []
    const citationsRaw = (item as any)?.citations
    const citations = Array.isArray(citationsRaw)
      ? citationsRaw.filter((c): c is string => typeof c === 'string')
      : []

    // Apply removal rules - exclude self
    const lowerN = name.toLowerCase()
    const normalizedCompany = company.toLowerCase().trim()
    // Exclude if name matches company name (case/space-insensitive)
    if (normalizedCompany && (lowerN.includes(normalizedCompany) || normalizedCompany.includes(lowerN))) continue
    // Exclude if domain (eTLD+1) matches input company domain
    if (website && companyDom) {
      const competitorDomain = normalizeDomain(website)
      if (competitorDomain === companyDom) continue
    }
    if (defunctNames.some(rx => rx.test(name))) continue
    if (website && junkDomains.some(rx => rx.test(website))) continue
    if (minNameLength) {
      const words = name.split(/\s+/).filter(Boolean)
      if (words.length < 2 && name.length < 4) continue
    }

    // Only add if all required fields are present (new schema requires all fields)
    if (!website || !positioning || !aiMaturity || !innovationFocus) {
      continue // Skip if missing required fields
    }

    // Extract new required fields from item
    const employeeBand = (item as any)?.employee_band || ''
    const geoFit = (item as any)?.geo_fit || ''
    const evidencePages = Array.isArray((item as any)?.evidence_pages) 
      ? (item as any).evidence_pages.filter((url: any): url is string => typeof url === 'string')
      : []

    // Only add if all new required fields are present
    if (!employeeBand || !geoFit || evidencePages.length < 2) {
      continue // Skip if missing new required fields
    }

    // Build valid CompetitorStrict with all required fields
    good.push({
      name,
      website: website, // Now required, not optional
      positioning: positioning, // Now required
      ai_maturity: aiMaturity, // Now required
      innovation_focus: innovationFocus, // Now required
      employee_band: employeeBand,
      geo_fit: geoFit,
      evidence_pages: evidencePages.slice(0, 5), // At least 2, max 5
      citations,
    })
  }
  return good.slice(0, maxCount)
}

/* =========================
   Main pipeline
   ========================= */
export async function runResearchPipeline(input: PipelineInput): Promise<{ brief: Brief; citations: string[] }> {
  console.log('[Pipeline] Starting research pipeline for:', input)
  
  /* 1) Queries */
  const queries = buildQueries(input)
  console.log('[Pipeline] Generated', queries.length, 'search queries:', queries)

  /* 2) Retrieve */
  const all: ResearchSnippet[] = []
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]
    console.log(`[Pipeline] Searching Tavily [${i + 1}/${queries.length}]:`, q)
    const res = await tavilySearch(q, {
      maxResults: 5,          // tighter focus for SMBs
      //freshness: 'year',      // prefer recent
      //includeDomains: [input.website], // bias to company site if your provider supports it
    })
    console.log(`[Pipeline] Tavily returned ${res.length} results for query ${i + 1}`)
    all.push(...res)
  }

  console.log('[Pipeline] Total snippets collected:', all.length)
  console.log('[Pipeline] Snippet URLs:', all.map(s => s.url))

  /* 3) CEO-specific search for Swiss/German companies */
  const inferredCountry = input.website ? (() => {
    // Try to infer from website domain or previous snippets
    const domain = normalizeDomain(input.website)
    if (/\.ch|schweiz|switzerland/i.test(domain)) return 'Switzerland'
    if (/\.de|germany|deutschland/i.test(domain)) return 'Germany'
    if (/\.at|austria|österreich/i.test(domain)) return 'Austria'
    return undefined
  })() : undefined

  const isDACH = inferredCountry === 'Switzerland' || inferredCountry === 'Germany' || inferredCountry === 'Austria'
  
  if (isDACH) {
    // Add CEO-specific queries with German terms for DACH companies
    const ceoQueries = [
      `${input.name} LinkedIn CEO OR Geschäftsführer OR Vorstand`,
      `${input.name} "Handelsregister" OR "Commercial Register" CEO OR Geschäftsführer`,
      `${input.name} "Unternehmensregister" OR "Company Register" leadership`,
      `${input.name} site:linkedin.com/in/ CEO OR "Chief Executive" OR Geschäftsführer`,
      `${input.name} site:linkedin.com/company/ leadership OR management OR CEO`,
    ]
    
    console.log('[Pipeline] Adding CEO-specific queries (DACH with German terms):', ceoQueries)
    for (const q of ceoQueries) {
      const res = await tavilySearch(q, {
        maxResults: 5,
        searchDepth: 'advanced'
      })
      all.push(...res)
      console.log(`[Pipeline] CEO search "${q}" returned ${res.length} results`)
    }
  } else {
    // For non-DACH companies, use English CEO queries
    const ceoQueries = [
      `${input.name} LinkedIn CEO OR "Chief Executive Officer"`,
      `${input.name} site:linkedin.com/in/ CEO OR executive`,
      `${input.name} site:linkedin.com/company/ leadership OR management`,
      `${input.name} "company register" OR "commercial register" CEO OR director`,
    ]
    
    console.log('[Pipeline] Adding CEO-specific queries:', ceoQueries)
    for (const q of ceoQueries) {
      const res = await tavilySearch(q, {
        maxResults: 5,
        searchDepth: 'advanced'
      })
      all.push(...res)
      console.log(`[Pipeline] CEO search "${q}" returned ${res.length} results`)
    }
  }

  // Deduplicate by URL after CEO searches
  const allUnique = Array.from(
    new Map(all.map(s => [s.url, s])).values()
  )
  console.log('[Pipeline] Total snippets after CEO search:', allUnique.length)

  /* 3) Select */
  const top = selectTopSnippets(allUnique, input, 20) // Increased to 20 to include CEO results
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
  /* 4) Generate strictly validated JSON (no fallbacks / no invention) */
  const schemaRules = [
    'Top-level keys: company, industry, strategic_moves, competitors, use_cases, citations',
    'company: { name, website, summary (required, 100+ chars), size?, industry?, headquarters?, founded?, ceo?, market_position?, latest_news? } (summary: comprehensive 4-8 sentence overview covering business model, key products/services, market position, operations, and strategic focus; size: employee count in format "X employees" or "X-Y employees" or revenue estimate if employees not found - prioritize employee count from snippets; industry: primary sector; headquarters: city/country; founded: format as "Founded in YYYY" using company registration/founding year from snippets; ceo: CEO/founder name extracted from snippets; market_position: market leadership/position info; latest_news: one recent news/announcement point)',
    'industry: { summary (required, under 50 words), trends: string[] (4-5 items, each max 15 words) } (summary: one paragraph summarizing how intelligent automation, data analytics, and AI adoption are changing the industry - focus on business transformation, not technical details; trends: 4-5 AI/ML/data-driven technology trends that directly reference AI or emerging tech like predictive maintenance, smart factories, AI forecasting, sustainability analytics - each trend must clearly connect business impact and technology value in one short sentence)',
    'strategic_moves: [{ title, dateISO?, impact?, citations: string[] }] (citations defaults to [] if not provided)',
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
    'Company facts: Extract and include size (PRIORITIZE employee count in format "X employees" or "X-Y employees" - search for "employees", "employee count", "workforce", "staffing", "headcount" in snippets; if employee count not found, estimate from revenue or company descriptions, format as "X employees" or approximate range; only include if verifiable from snippets), industry sector, headquarters location, founding year (format as "Founded in YYYY" using the company registration/incorporation year from snippets), CEO/founder name (extract from snippets - PRIORITIZE LinkedIn profiles, company register entries, and leadership pages; look for "CEO", "Chief Executive Officer", "Geschäftsführer", "Vorstand", "founder", "founder and CEO", "managing director"; for Swiss/German companies, also check for German terms like "Geschäftsführer", "Vorstandsvorsitzender"; extract full name format like "John Smith" or "Hans Müller" from verified sources like LinkedIn or company registers), market position/leadership information, and one point from latest news/announcements if available in snippets. Only include facts you can verify from snippets.',
    'Industry summary: Write one paragraph (MAXIMUM 300 characters, approximately 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the company\'s industry. Focus on business transformation and competitive advantage - not technical details. Explain how AI/ML/data-driven technologies are changing how companies operate, compete, and create value. Keep tone strategic and business-oriented for SMB leaders. CRITICAL: The summary must be 300 characters or less - count carefully.',
    'Industry trends: Provide 4-5 trends (max 15 words each) that directly reference AI, ML, or data-driven technologies transforming the industry. Examples: "AI-driven predictive maintenance reduces downtime by 20%", "Smart factories use ML to optimize production schedules", "AI forecasting improves inventory accuracy by 30%", "Sustainability analytics help meet compliance faster". Each trend must clearly connect business impact and technology value in one short sentence. Focus on what SMB leaders can act on now or in the near future. Keep tone strategic, not technical.',
    'Use-case titles must be Verb + Outcome (e.g., "Cut Scrap with AI QC").',
    'use_cases: CRITICAL - You MUST return EXACTLY 5 use cases. Count them carefully. If you have fewer than 5, create additional realistic use cases based on the company and industry. If you somehow have more than 5, return only the first 5. This is a hard requirement - the array must contain exactly 5 elements.',
    'All use_cases MUST include ALL numeric fields (est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months); use 0 or reasonable estimates when uncertain. Every use case must have all four numeric fields present.',
    'data_requirements, risks, and next_steps must be strings (not null). If you don\'t have specific values, use "TBD" as the string value. These fields cannot be null.',
    'Competitors: ALWAYS return empty array []. Competitors are sourced from live search results only, not from LLM generation. Do not generate competitor data.',
    'Strategic moves: citations array is optional and defaults to [] if not provided.',
    'Produce STRICT JSON matching schema_rules. No extra text.'
  ].join(' ')

  const userPayload = JSON.stringify({
    input,
    snippets: top,
    schema_rules: schemaRules,
    rules: [
      'Company summary: MUST provide a comprehensive 4-8 sentence overview (minimum 100 characters) covering business model, products/services, target markets, market position, operations, and strategic focus. Be thorough and specific. This is required.',
      'Company facts: Include size (PRIORITIZE employee count from snippets - search for "employees", "employee count", "workforce", "staffing", "headcount" - format as "X employees" or "X-Y employees"; estimate if needed from revenue or descriptions), industry, headquarters, founded (format as "Founded in YYYY" from company registration year in snippets), CEO (PRIORITIZE LinkedIn profiles and company registers - extract CEO/founder name from snippets - search for "CEO", "Chief Executive Officer", "Geschäftsführer", "Vorstand", "founder", "managing director" in both English and German; look for full names from LinkedIn or Handelsregister/Unternehmensregister entries), market_position, and latest_news if available in snippets. Extract specific factual information only.',
      'Include citations arrays (URLs) for each claim in sections. Citations default to [] if not provided.',
      'Industry summary: MUST be one paragraph (MAXIMUM 300 characters, approximately 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the company\'s industry. Focus on business transformation and competitive advantage - strategic and business-oriented, not technical. CRITICAL: Count characters - the summary must be exactly 300 characters or less.',
      'industry.trends: MUST provide 4-5 AI/ML/data-driven technology trends (max 15 words each) that directly reference AI or emerging tech. Each trend must clearly connect business impact and technology value. Examples: predictive maintenance, smart factories, AI forecasting, sustainability analytics. Focus on what SMB leaders can act on now or in the near future.',
      'competitors: ALWAYS return empty array []. Competitors are sourced from live search only, not LLM generation.',
      'strategic_moves: citations array defaults to [] if not provided.',
      'use_cases: CRITICAL REQUIREMENT - You MUST return EXACTLY 5 use cases in the array. Count them before returning. This is a hard validation requirement - the array must have exactly 5 elements, no more, no less. Every use case must have ALL numeric fields present: est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months (use 0 if uncertain).',
      'If a section lacks evidence, return [] for that section (no filler).'
    ]
  })

  console.log('[Pipeline] Preparing to call LLM with:')
  console.log('[Pipeline] - System prompt length:', system.length)
  console.log('[Pipeline] - Snippets count:', top.length)
  console.log('[Pipeline] - Schema rules:', schemaRules)
  console.log('[Pipeline] - User payload (preview):', userPayload.substring(0, 500))

  let parsed: any = null
  let firstError: any | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    console.log(`[Pipeline] LLM attempt ${attempt + 1}/2`)
    const payload =
      attempt === 0
        ? userPayload
        : JSON.stringify({
            input,
            snippets: top,
            schema_rules: schemaRules,
            fix: {
              message: 'Previous output failed validation. Return valid JSON only.',
              validation_error: firstError?.issues ?? String(firstError),
              critical: [
                'Return a JSON object (no markdown) matching schema_rules',
                'company.summary is REQUIRED - provide a comprehensive 4-8 sentence overview (100+ characters) covering business model, products/services, markets, position, and operations based on snippets',
                'Include company facts (size: PRIORITIZE employee count - search snippets for "employees", "employee count", "workforce", "staffing", "headcount" and format as "X employees" or "X-Y employees"; estimate from revenue if needed; industry, headquarters, founded as "Founded in YYYY" from registration year, ceo: PRIORITIZE LinkedIn profiles and company register entries - extract from search results looking for "CEO", "Chief Executive Officer", "Geschäftsführer", "Vorstand", "founder", "managing director" in both English and German sources, market_position, latest_news) if available in snippets',
                'industry.summary is REQUIRED - one paragraph (MAXIMUM 300 characters, approximately 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the industry. Focus on business transformation, not technical details. CRITICAL: The summary must be 300 characters or less - verify the character count before returning.',
                'industry.trends: 4-5 AI/ML/data-driven trends (max 15 words each) that directly reference AI or emerging tech. Each must connect business impact and technology value. Focus on what SMB leaders can act on now or near future.',
                'competitors: ALWAYS return empty array []. Competitors are sourced from live search only, not LLM generation.',
                'strategic_moves: citations defaults to [] if not provided',
                'use_cases: CRITICAL - MUST have EXACTLY 5 items in the array. Count them. This is a hard requirement. If you returned fewer, create additional realistic use cases. If more, keep only the first 5.',
                'Each use case must have: value_driver MUST be exactly one of [revenue|cost|risk|speed|quality] - NO OTHER VALUES. If unsure, use "cost" for cost reduction, "revenue" for revenue growth, "risk" for risk mitigation, "speed" for process acceleration, or "quality" for quality improvement. complexity (integer 1..5), effort (integer 1..5)',
                'ALL numeric fields MUST be present for EVERY use case: est_annual_benefit (number), est_one_time_cost (number), est_ongoing_cost (number), payback_months (number). Use 0 if uncertain, but all four must be present.',
                'data_requirements, risks, and next_steps MUST be strings (not null). Use "TBD" if value is not available, but they must be strings.',
                'Verify: use_cases.length === 5 before returning JSON'
              ]
            }
          })

    console.log(`[Pipeline] Calling LLM (attempt ${attempt + 1})...`)
    if (attempt === 0) {
      console.log('[Pipeline] Full user payload being sent to LLM:', payload)
    } else {
      console.log('[Pipeline] Retry payload (with fix instructions):', payload.substring(0, 1000))
    }
    
    const json = await llmGenerateJson(system, payload, { timeoutMs: 180000 }) // 3 minutes for complex research pipeline
    console.log('[Pipeline] LLM returned JSON, validating with input schema...')
    
    // Ensure exactly 5 use cases before validation (safety net)
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
    
    // Ignore any LLM-generated competitors - always set to empty array
    if (json.competitors && Array.isArray(json.competitors) && json.competitors.length > 0) {
      console.log(`[Pipeline] LLM returned ${json.competitors.length} competitors - ignoring (using live search only)`)
      json.competitors = []
    }
    
    // Use BriefInputSchema for initial validation (competitors will be enriched later)
    const result = BriefInputSchema.safeParse(json)
    if (result.success) {
      console.log('[Pipeline] Schema validation PASSED')
      parsed = result.data
      // Ensure competitors array is empty (live search will populate it)
      parsed.competitors = []
      break
    } else {
      console.error('[Pipeline] Schema validation FAILED:', result.error.errors)
      console.error('[Pipeline] Validation errors details:', JSON.stringify(result.error.errors, null, 2))
      console.error('[Pipeline] LLM response that failed:', JSON.stringify(json, null, 2))
      firstError = result.error
      if (attempt === 0) {
        console.log('[Pipeline] Retrying with more explicit rules...')
      }
    }
  }

  if (!parsed) {
    const errorDetails = firstError?.errors 
      ? `Validation errors: ${JSON.stringify(firstError.errors, null, 2)}`
      : 'Unknown validation error'
    throw new Error(`Failed to validate model output after 2 attempts. ${errorDetails}`)
  }

  /* 5) Simplified competitor search using Perplexity */
  console.log('[Pipeline] Starting simplified competitor search with Perplexity...')
  
  const headquarters = parsed.company?.headquarters
  const companyIndustry = parsed.company?.industry
  const companySize = parsed.company?.size
  
  // Require at least industry and headquarters for competitor search (size is optional)
  if (!headquarters || !companyIndustry) {
    console.warn('[Pipeline] Missing required parameters for competitor search:', {
      hasHeadquarters: !!headquarters,
      hasIndustry: !!companyIndustry,
      hasSize: !!companySize,
      companyName: input.name
    })
    parsed.competitors = []
  } else {
    // Use a default size if not provided
    const searchSize = companySize || '50-200 employees (estimated)'
    console.log('[Pipeline] Competitor search parameters:', {
      companyName: input.name,
      industry: companyIndustry,
      headquarters: headquarters,
      size: searchSize
    })
    try {
      // Search for competitors using Perplexity
      const perplexityResults = await perplexitySearchCompetitors(
        input.name,
        companyIndustry,
        headquarters,
        searchSize
      )
      
      console.log(`[Pipeline] Perplexity returned ${perplexityResults.length} competitors`)
      console.log('[Pipeline] Perplexity results:', JSON.stringify(perplexityResults, null, 2))
      
      if (perplexityResults.length === 0) {
        console.warn('[Pipeline] Perplexity returned no competitors - check Perplexity logs above')
        parsed.competitors = []
      } else {
        // Transform Perplexity results to CompetitorStrict format
        const competitors: CompetitorStrict[] = []
        
        for (const result of perplexityResults.slice(0, 3)) {
          console.log(`[Pipeline] Processing competitor result:`, JSON.stringify(result, null, 2))
          
          // Validate name
          if (!result.name || !result.name.trim()) {
            console.log(`[Pipeline] Skipping competitor - missing name:`, result)
            continue
          }
          
          // Validate website URL - normalize if needed
          let website = result.website
          if (!website) {
            console.log(`[Pipeline] Skipping ${result.name} - missing website`)
            continue
          }
          
          // Normalize website URL
          website = website.trim()
          if (!website.startsWith('http://') && !website.startsWith('https://')) {
            // Add https:// if missing
            if (website.startsWith('www.')) {
              website = `https://${website}`
            } else {
              website = `https://${website}`
            }
            console.log(`[Pipeline] Normalized website for ${result.name}: ${website}`)
          }
        
        // Normalize website to origin
        try {
          const urlObj = new URL(website)
          website = `${urlObj.protocol}//${urlObj.hostname}`
        } catch (e) {
          console.log(`[Pipeline] Skipping ${result.name} - unparseable website: ${website}`)
          continue
        }
        
        // Exclude self
        const competitorDomain = normalizeDomain(website)
        const companyDomain = normalizeDomain(input.website)
        if (competitorDomain === companyDomain) {
          console.log(`[Pipeline] Skipping ${result.name} - same domain as input company`)
          continue
        }
        
        // Get evidence pages (homepage + about if available)
        const evidencePages = [website]
        if (result.source && result.source.startsWith('http')) {
          const sourceDomain = normalizeDomain(result.source)
          if (sourceDomain === competitorDomain && !evidencePages.includes(result.source)) {
            evidencePages.push(result.source)
          }
        }
        // Ensure at least 2 evidence pages (use homepage twice if needed)
        if (evidencePages.length < 2) {
          evidencePages.push(website)
        }
        
        // Use geo_fit from Perplexity result or fallback to input company HQ
        const geoFit = result.headquarters || headquarters
        
        // Build competitor object
        const competitor: CompetitorStrict = {
          name: result.name.trim(),
          website: website,
          positioning: result.positioning && result.positioning.length >= 20 
            ? result.positioning.substring(0, 200).trim()
            : `${result.name} operates in the ${companyIndustry} sector.`,
          ai_maturity: result.ai_maturity && result.ai_maturity.trim()
            ? result.ai_maturity.trim()
            : 'Digital transformation initiatives',
          innovation_focus: result.innovation_focus && result.innovation_focus.trim()
            ? result.innovation_focus.trim()
            : 'Process optimization',
          employee_band: companySize, // Use input company size as estimate
          geo_fit: geoFit,
          evidence_pages: evidencePages.slice(0, 5),
          citations: result.source ? [result.source] : []
        }
        
          competitors.push(competitor)
          console.log(`[Pipeline] Added competitor: ${competitor.name} (${normalizeDomain(competitor.website)})`)
        }
        
        console.log(`[Pipeline] Transformed ${competitors.length} competitors from Perplexity results`)
        
        // Deduplicate by normalized name + domain
      const seen = new Set<string>()
      const dedupedCompetitors = competitors.filter(c => {
        const key = `${c.name.toLowerCase().trim()}|${normalizeDomain(c.website)}`
        if (seen.has(key)) {
          console.log(`[Pipeline] Deduplicating competitor: ${c.name}`)
          return false
        }
        seen.add(key)
        return true
      })
      
      // Rank by locality: same city/country > same region > other
      const inputLocation = extractLocationHierarchy(headquarters)
      const rankedCompetitors = dedupedCompetitors.sort((a, b) => {
        const aLoc = extractLocationHierarchy(a.geo_fit)
        const bLoc = extractLocationHierarchy(b.geo_fit)
        
        const aScore = aLoc.city === inputLocation.city ? 3 :
                       aLoc.country === inputLocation.country ? 2 :
                       aLoc.region === inputLocation.region ? 1 : 0
        const bScore = bLoc.city === inputLocation.city ? 3 :
                       bLoc.country === inputLocation.country ? 2 :
                       bLoc.region === inputLocation.region ? 1 : 0
        
        if (aScore !== bScore) return bScore - aScore
        return a.name.localeCompare(b.name)
      })
      
        parsed.competitors = rankedCompetitors.slice(0, 3)
        
        console.log(`[Pipeline] Final competitors (${parsed.competitors.length}):`, 
          parsed.competitors.map((c: CompetitorStrict) => ({ name: c.name, website: normalizeDomain(c.website), geo_fit: c.geo_fit }))
        )
      }
      
    } catch (err) {
      console.error('[Pipeline] Error searching competitors with Perplexity:', err)
      console.error('[Pipeline] Error details:', err instanceof Error ? err.message : String(err))
      console.error('[Pipeline] Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      parsed.competitors = []
    }
  }
  
  if (parsed.competitors.length === 0) {
    console.warn(`[Pipeline] WARNING: No competitors found after all attempts`)
  } else if (parsed.competitors.length < 2) {
    console.warn(`[Pipeline] WARNING: Only found ${parsed.competitors.length} competitors (target: 2-3)`)
  } else {
    console.log(`[Pipeline] Successfully found ${parsed.competitors.length} competitors`)
  }

  console.log(`[Pipeline] Final competitors (${parsed.competitors.length}):`, parsed.competitors.map((c: CompetitorStrict) => ({
    name: c.name,
    hasWebsite: !!c.website,
    hasPositioning: !!c.positioning,
    hasAiMaturity: !!c.ai_maturity,
    hasInnovationFocus: !!c.innovation_focus
  })))

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

  // Log final brief structure before returning
  console.log('[Pipeline] Final brief structure:', {
    company: parsed.company?.name,
    competitors: {
      count: parsed.competitors?.length || 0,
      names: parsed.competitors?.map((c: any) => c.name) || [],
      withAiMaturity: parsed.competitors?.filter((c: any) => c.ai_maturity).length || 0,
      withInnovationFocus: parsed.competitors?.filter((c: any) => c.innovation_focus).length || 0
    },
    useCasesCount: parsed.use_cases?.length || 0,
    industryTrendsCount: parsed.industry?.trends?.length || 0
  })

  // Final validation with full schema to ensure enriched data is correct
  const finalValidation = BriefSchema.safeParse(parsed)
  if (!finalValidation.success) {
    console.error('[Pipeline] Final validation FAILED after enrichment:', finalValidation.error.errors)
    throw new Error(`Failed to validate final brief after enrichment: ${JSON.stringify(finalValidation.error.errors, null, 2)}`)
  }

  return { brief: finalValidation.data, citations: parsed.citations }
}




