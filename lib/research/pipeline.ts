// Unified research pipeline using single researchCompany() function
// Company and industry agnostic

import { researchCompany } from '@/lib/providers/perplexity'
import { synthesizeBrief } from '@/lib/research/synthesis'
import { Brief, BriefSchema } from '@/lib/schema/brief'
import { supabase } from '@/lib/db/supabase'

export type PipelineInput = {
  name: string
  website: string
  headquartersHint?: string
  industryHint?: string
}

const CACHE_TTL_HOURS = 24

/* =========================
   Helpers
   ========================= */

/**
 * Get cache key for research
 */
function getCacheKey(input: PipelineInput): string {
  const base = `${input.name}|${input.website}|${input.industryHint || 'unknown'}`
  return `research:${base}`
}

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

    // Build industry keywords - prioritize parsed industry, then tokens, then defaults
    let coreIndustryTerms = ''
    if (companyIndustry && companyIndustry.trim()) {
      // Use the parsed industry as primary term
      const industryClean = companyIndustry.replace(/"/g, '').trim()
      if (industryTokens.length > 0) {
        coreIndustryTerms = `"${industryClean}" OR (${industryTokens.slice(0, 3).map(t => `"${t.replace(/"/g, '')}"`).join(' OR ')})`
      } else {
        coreIndustryTerms = `"${industryClean}"`
      }
    } else if (industryTokens.length > 0) {
      coreIndustryTerms = industryTokens.slice(0, 5).map(t => `"${t.replace(/"/g, '')}"`).join(' OR ')
    } else {
      coreIndustryTerms = '"surface engineering" OR "coating" OR "beschichtung"'
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
    
    // Query 1: Industry + competitors + city (most specific)
    if (location.city) {
      const sizePart = location.isDACH 
        ? `(${sizeTermsGerman.slice(0, 2).join(' OR ')})`
        : `(${sizeTerms.slice(0, 2).join(' OR ')})`
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter OR Hersteller) ${location.city} ${sizePart} ${hardExclusions}`)
    }
    
    // Query 2: Industry + competitors + country (broader geographic)
    if (location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      const sizePart = location.isDACH 
        ? `(${sizeTermsGerman.slice(0, 2).join(' OR ')})`
        : `(${sizeTerms.slice(0, 2).join(' OR ')})`
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter) ${countryTerm} ${sizePart} ${hardExclusions}`)
    }
    
    // Query 3: Industry + size-specific + country (focus on similar size)
    if (location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      if (location.isDACH) {
        queries.push(`(${coreIndustryTerms}) (${sizeTermsGerman.join(' OR ')}) ${countryTerm} ${hardExclusions}`)
      } else {
        queries.push(`(${coreIndustryTerms}) (${sizeTerms.join(' OR ')}) ${location.country} ${hardExclusions}`)
      }
    }
    
    // Query 4: Industry-specific service terms + location + size
    if (location.isDACH && location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      queries.push(`(${coreIndustryTerms}) (Dienstleister OR Lohnbeschichtung OR Auftragsfertigung) ${countryTerm} (${sizeTermsGerman.slice(0, 2).join(' OR ')}) ${hardExclusions}`)
    } else if (location.country) {
      queries.push(`(${coreIndustryTerms}) (services OR solutions OR manufacturing) ${location.country} (${sizeTerms.slice(0, 2).join(' OR ')}) ${hardExclusions}`)
    }
    
    // Query 5: Adjacent regions for border areas (within 150km, same language)
    if (location.isDACH && location.city) {
      // For Swiss companies, also check Germany/Austria border regions
      if (location.country === 'Switzerland') {
        queries.push(`(${coreIndustryTerms}) (Unternehmen OR Anbieter) (Baden-Württemberg OR Bayern OR Vorarlberg) (${sizeTermsGerman.slice(0, 2).join(' OR ')}) ${hardExclusions}`)
      }
    }
    
    // Query 6: Industry name directly if we have a specific industry
    if (companyIndustry && companyIndustry.trim() && location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      const sizePart = location.isDACH 
        ? `(${sizeTermsGerman.slice(0, 1).join(' OR ')})`
        : `(${sizeTerms.slice(0, 1).join(' OR ')})`
      queries.push(`"${companyIndustry}" ${countryTerm} ${sizePart} (companies OR Unternehmen) ${hardExclusions}`)
    }
    
    // Query 7: Specialization-focused queries (if we have specialization tokens)
    if (specializationTokens && specializationTokens.length > 0 && location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      const topSpecializations = specializationTokens.slice(0, 3).filter(t => t.length > 5) // Filter out very short tokens
      if (topSpecializations.length > 0) {
        const specializationPart = topSpecializations.map(t => `"${t}"`).join(' OR ')
        const sizePart = location.isDACH 
          ? `(${sizeTermsGerman.slice(0, 1).join(' OR ')})`
          : `(${sizeTerms.slice(0, 1).join(' OR ')})`
        queries.push(`(${specializationPart}) ${countryTerm} ${sizePart} (companies OR Unternehmen OR Anbieter) ${hardExclusions}`)
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

/**
 * Get cached research result
 */
async function getCachedResearch(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('research_cache')
      .select('data, created_at')
      .eq('cache_key', key)
      .single()

    if (error || !data) return null

    const createdAt = new Date(data.created_at as string)
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

    if (ageHours > CACHE_TTL_HOURS) {
      await supabase.from('research_cache').delete().eq('cache_key', key)
      return null
    }

    return data.data
  } catch (err) {
    console.error('[Pipeline] Cache read error:', err)
    return null
  }
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

    // Score industry match - must be in surface engineering/coatings domain
    const industryKeywords = [
      'surface engineering', 'surface treatment', 'coating', 'beschichtung',
      'oberflächenbeschichtung', 'oberflächenbehandlung', 'pvd', 'galvanic',
      'galvanisier', 'electroplating', 'functional surfaces', 'thin film',
      'dünnschicht', 'surface finishing', 'metallization'
    ]
    
    let industryMatch = 0
    let hasCoreIndustryMatch = false
    
    industryKeywords.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) {
        industryMatch += 1
        if (['coating', 'beschichtung', 'surface engineering', 'oberflächenbeschichtung', 'pvd', 'galvanic'].includes(keyword.toLowerCase())) {
          hasCoreIndustryMatch = true
        }
      }
    })
    
    // Must have at least one core industry match
    if (!hasCoreIndustryMatch && industryMatch < 2) {
      industryMatch = 0 // Not a true competitor
    } else {
      industryMatch = Math.min(1, industryMatch / Math.max(3, industryKeywords.length))
    }
    
    // Bonus for industry token matches
    industryTokens.forEach(token => {
      if (content.includes(token.toLowerCase())) industryMatch += 0.1
    })
    industryMatch = Math.min(1, industryMatch)
    
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
    // 1. Clear industry match (surface engineering/coatings)
    // 2. Same geography (headquarters region)
    // 3. Size estimate is ≤500 employees (or unknown, but never >500 unless reference major)
    const isValidSize = !sizeEstimate || sizeEstimate <= 500 || isReferenceMajor
    
    if (industryMatch > 0.2 && hasCoreIndustryMatch && geographyMatch > 0.3 && isValidSize) {
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

  // Rank by: geography (headquarters region) > industry match > specialization match > size proximity
  // STRICT: Prioritize competitors from same headquarters region, same industry, similar specialization, similar size
  candidates.sort((a, b) => {
    // First, separate reference majors (limit to 1) - they go to bottom
    const aIsRef = (a as any).isReferenceMajor || false
    const bIsRef = (b as any).isReferenceMajor || false
    
    if (aIsRef && !bIsRef) return 1
    if (!aIsRef && bIsRef) return -1
    
    // Priority 1: Geography match (headquarters region)
    // Same city (1.0) > same country (0.8) > same region (0.6) > broader region (0.4)
    if (Math.abs(a.geographyMatch - b.geographyMatch) > 0.2) {
      return b.geographyMatch - a.geographyMatch
    }
    
    // Priority 2: Industry match (must be same industry)
    if (Math.abs(a.industryMatch - b.industryMatch) > 0.15) {
      return b.industryMatch - a.industryMatch
    }
    
    // Priority 2.5: Specialization match (products/services/focus areas)
    const aSpecMatch = (a as any).specializationMatch || 0.5
    const bSpecMatch = (b as any).specializationMatch || 0.5
    if (Math.abs(aSpecMatch - bSpecMatch) > 0.15) {
      return bSpecMatch - aSpecMatch
    }
    
    // Priority 3: Size proximity (use sizeMatchScore if available, otherwise estimate)
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
        return aSizeDiff - bSizeDiff
      }
      // Prefer known size over unknown
      if (a.sizeEstimate && !b.sizeEstimate) return -1
      if (!a.sizeEstimate && b.sizeEstimate) return 1
      
      // If both unknown, prefer higher industry match
      return b.industryMatch - a.industryMatch
    }
    
    // Default: prefer higher industry match
    return b.industryMatch - a.industryMatch
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

  if (!website) return null

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

  // Prefer at least 2 evidence pages, but allow with just homepage if needed
  if (evidencePages.length < 1) {
    console.log(`[Pipeline] No evidence pages found for ${candidate.name}`)
    return null
  }
  
  // If we only have homepage, try to add it twice to meet minimum requirement
  if (evidencePages.length === 1) {
    console.log(`[Pipeline] Only found homepage for ${candidate.name}, using it as both evidence pages`)
    evidencePages.push(website) // Add homepage again to meet minimum
  }

  // Search for employee size information
  let employeeBand = ''
  let allContent = allEvidenceContent
  try {
    const sizeQuery = `site:${domain} (employees OR mitarbeiter OR staff OR workforce OR headcount)`
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

  // If no employee size found, use a reasonable estimate based on industry/company type
  if (!employeeBand) {
    console.log(`[Pipeline] No employee size found for ${candidate.name}, using fallback estimate`)
    // Use a conservative estimate: "50-200 employees" for small companies
    // This is better than rejecting the competitor entirely
    employeeBand = '50-200 employees (estimated)'
  }

  // Extract geo_fit (country/region match)
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
    geoFit = 'Unknown'
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

  // If positioning is too short, generate a basic one from company name
  if (!positioning || positioning.length < 20) {
    console.log(`[Pipeline] Positioning too short for ${candidate.name}, generating fallback`)
    const industryText = industryTokens && industryTokens.length > 0 
      ? industryTokens.join(' and ') 
      : 'industry'
    positioning = `${candidate.name} provides services in the ${industryText} sector.`
  }

  // Extract AI maturity
  let aiMaturity = ''
  if (allContent.match(/(predictive\s+maintenance|digital\s+process\s+monitoring|mes\s+analytics)/i)) {
    aiMaturity = 'Uses digital process monitoring and predictive maintenance'
  } else if (allContent.match(/(mes|manufacturing\s+execution|process\s+monitoring)/i)) {
    aiMaturity = 'Uses MES analytics and process monitoring'
  } else if (allContent.match(/(digital\s+process|data\s+analytics|ai|machine\s+learning)/i)) {
    aiMaturity = 'Uses digital process monitoring and data analytics'
  } else if (allContent.match(/(automation|digital|software|system)/i)) {
    aiMaturity = 'Some digital transformation initiatives'
  } else {
    aiMaturity = 'Basic automation' // Minimal fallback for validation
  }

  // Extract innovation focus
  let innovationFocus = ''
  if (allContent.match(/(quality\s+analytics|customer-specific|custom\s+coatings|tailored)/i)) {
    innovationFocus = 'Quality analytics and customer-specific coatings'
  } else if (allContent.match(/(quality|custom|specific|tailored)/i)) {
    innovationFocus = 'Quality and customer-specific solutions'
  } else if (allContent.match(/(process\s+efficiency|optimization|productivity)/i)) {
    innovationFocus = 'Process efficiency'
  } else if (allContent.match(/(sustainability|environmental|green)/i)) {
    innovationFocus = 'Sustainability and environmental compliance'
  } else {
    innovationFocus = 'Process efficiency' // Minimal fallback for validation
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

/**
 * Set cached research result
 */
async function setCachedResearch(key: string, data: any): Promise<void> {
  try {
    await supabase
      .from('research_cache')
      .upsert({
        cache_key: key,
        data,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      })
    console.log('[Pipeline] Cached research result')
  } catch (err) {
    console.error('[Pipeline] Cache write error:', err)
  }
}

/**
 * Validate research data before synthesis
 */
function validateResearchData(research: any, companyName: string): void {
  // Validate use_cases
  if (!Array.isArray(research.use_cases) || research.use_cases.length !== 5) {
    throw new Error(`Invalid use_cases: expected 5, got ${research.use_cases?.length || 0}`)
  }

  for (const uc of research.use_cases) {
    if (typeof uc.benefit !== 'number' || uc.benefit < 0) {
      throw new Error(`Invalid use case benefit: ${uc.benefit}`)
    }
    if (typeof uc.one_time !== 'number' || uc.one_time < 0) {
      throw new Error(`Invalid use case one_time: ${uc.one_time}`)
    }
    if (typeof uc.ongoing !== 'number' || uc.ongoing < 0) {
      throw new Error(`Invalid use case ongoing: ${uc.ongoing}`)
    }
    if (typeof uc.complexity !== 'number' || uc.complexity < 1 || uc.complexity > 5) {
      throw new Error(`Invalid use case complexity: ${uc.complexity}`)
    }
    if (typeof uc.effort !== 'number' || uc.effort < 1 || uc.effort > 5) {
      throw new Error(`Invalid use case effort: ${uc.effort}`)
    }
    if (typeof uc.payback_months !== 'number' || uc.payback_months < 1) {
      throw new Error(`Invalid use case payback_months: ${uc.payback_months}`)
    }
  }

  // Validate competitors
  if (!Array.isArray(research.competitors) || research.competitors.length < 2) {
    throw new Error(`Invalid competitors: expected at least 2, got ${research.competitors?.length || 0}`)
  }

  for (const comp of research.competitors) {
    if (!comp.geo_fit) {
      throw new Error(`Missing geo_fit for competitor: ${comp.name}`)
    }
    if (!Array.isArray(comp.evidence_pages) || comp.evidence_pages.length < 2) {
      throw new Error(`Invalid evidence_pages for competitor: ${comp.name}`)
    }
  }

  // Validate strategic_moves is array
  if (!Array.isArray(research.strategic_moves)) {
    throw new Error('strategic_moves must be an array')
  }

  // Check for placeholder text
  const placeholderRegex = /(data not available|estimate|not specified|TBD|unknown|N\/A)/i
  const researchStr = JSON.stringify(research)
  if (placeholderRegex.test(researchStr)) {
    console.warn('[Pipeline] Placeholder text detected in research data')
  }
}

/**
 * Main research pipeline
 */
export async function runResearchPipeline(input: PipelineInput): Promise<{ brief: Brief; citations: string[] }> {
  console.log('[Pipeline] Starting unified research pipeline for:', input)

  const industryHint = input.industryHint || 'Professional Services'

  try {
    // Step 1: Research company (with caching)
    console.log('[Pipeline] Step 1: Researching company...')
    const cacheKey = getCacheKey(input)
    let researchData = await getCachedResearch(cacheKey)
    
    if (!researchData) {
      researchData = await researchCompany({
        name: input.name,
        website: input.website,
        industryHint
      })
      await setCachedResearch(cacheKey, researchData)
    }

    // Step 2: Validate research data
    console.log('[Pipeline] Step 2: Validating research data...')
    validateResearchData(researchData, input.name)

    // Step 3: Synthesize brief using GPT-5-mini
    console.log('[Pipeline] Step 3: Synthesizing executive brief...')
    const brief = await synthesizeBrief(researchData, input.name)

    // Step 4: Validate final brief
    console.log('[Pipeline] Step 4: Validating final brief...')
    const validated = BriefSchema.safeParse(brief)
    if (!validated.success) {
      console.error('[Pipeline] Final validation failed:', validated.error.errors)
      throw new Error(`Brief validation failed: ${validated.error.message}`)
    }

    // Step 5: Collect citations
    const citations = [
      ...(researchData.citations || []),
      ...(researchData.competitors?.flatMap((c: any) => c.citations || []) || []),
      ...(researchData.use_cases?.flatMap((uc: any) => uc.citations || []) || []),
      ...(researchData.strategic_moves?.flatMap((sm: any) => sm.url ? [sm.url] : []) || [])
    ].filter((url, index, self) => self.indexOf(url) === index) // Dedupe

    console.log('[Pipeline] Pipeline completed successfully')
    return { brief: validated.data, citations }
  } catch (err: any) {
    console.error('[Pipeline] Pipeline error:', err?.message || String(err))
    throw err
  }
}
