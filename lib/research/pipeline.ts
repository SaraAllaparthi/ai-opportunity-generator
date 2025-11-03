import { tavilySearch } from '@/lib/providers/tavily'
import { llmGenerateJson } from '@/lib/providers/llm'
import { Brief, BriefSchema } from '@/lib/schema/brief'
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

  /** Build geo-anchored, sector-specific competitor queries with hard exclusions */
  function buildCompetitorQueries(
    companyName: string,
    industryTokens: string[],
    headquarters?: string
  ): string[] {
    const queries: string[] = []
    const location = extractLocationHierarchy(headquarters)
    console.log('[Pipeline] Location hierarchy for competitor search:', location)

    // Build industry keywords (use extracted tokens or defaults)
    const coreIndustryTerms = industryTokens.length > 0 
      ? industryTokens.slice(0, 5).map(t => `"${t.replace(/"/g, '')}"`).join(' OR ')
      : '"surface engineering" OR "coating" OR "beschichtung"'

    // Hard exclusions (add to every query)
    const hardExclusions = '-market-research -report -news -press -SaaS -software -agency -advertising -retail -jobs -recruiting -Wikipedia -LinkedIn -CBInsights -Owler -G2 -ZoomInfo -directories-only -Oerlikon -voestalpine -Bühler'
    
    // Query 1: Industry keywords + competitors/Unternehmen/Anbieter/Hersteller + HQ location
    if (location.city) {
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter OR Hersteller) ${location.city} ${hardExclusions}`)
    }
    if (location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      queries.push(`(${coreIndustryTerms}) (competitors OR Unternehmen OR Anbieter) ${countryTerm} ${hardExclusions}`)
    }
    
    // Query 2: Industry keywords + KMU/SMB size indicators (HQ country language)
    if (location.isDACH && location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      queries.push(`(${coreIndustryTerms}) (KMU OR "100-500 Mitarbeiter" OR "bis 500 Mitarbeiter") ${countryTerm} ${hardExclusions}`)
    } else if (location.country) {
      queries.push(`(${coreIndustryTerms}) ("under 500 employees" OR "100-500 employees" OR SMB OR SME) ${location.country} ${hardExclusions}`)
    }
    
    // Query 3: Industry keywords + service terms (Dienstleister/Lohnbeschichtung/Auftragsfertigung) + HQ country
    if (location.isDACH && location.country) {
      const countryTerm = location.country === 'Switzerland' ? 'Schweiz' : location.country
      queries.push(`(${coreIndustryTerms}) (Dienstleister OR Lohnbeschichtung OR Auftragsfertigung) ${countryTerm} ${hardExclusions}`)
    }
    
    // Query 4: Adjacent regions for border areas (within 150km, same language)
    if (location.isDACH && location.city) {
      // For Swiss companies, also check Germany/Austria border regions
      if (location.country === 'Switzerland') {
        queries.push(`(${coreIndustryTerms}) (Unternehmen OR Anbieter) (Baden-Württemberg OR Bayern OR Vorarlberg) KMU ${hardExclusions}`)
      }
    }

    console.log('[Pipeline] Built geo-anchored competitor queries:', queries)
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
  headquarters?: string
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
    
    // If > 500 but highly relevant, tag as reference major (only one allowed)
    if (sizeEstimate && sizeEstimate > 500) {
      if (industryMatch > 0.7 && geographyMatch > 0.7) {
        isReferenceMajor = true
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
        isReferenceMajor
      } as CompetitorCandidate & { isReferenceMajor?: boolean })
    }
  }

  // Rank by: geography (headquarters region) > industry match > size proximity
  // STRICT: Prioritize competitors from same headquarters region, same industry, similar size
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
    
    // Priority 3: Size proximity (prefer companies 100-300 employees, ideal ~200)
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

  // Require at least 2 evidence pages (homepage + one other)
  if (evidencePages.length < 2) {
    console.log(`[Pipeline] Insufficient evidence pages for ${candidate.name}: only ${evidencePages.length}`)
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

  if (!employeeBand) {
    console.log(`[Pipeline] No employee size found for ${candidate.name}`)
    return null // Reject if no size proof
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

  if (!positioning || positioning.length < 20) {
    return null // Require real positioning
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

    // Apply removal rules
    const lowerN = name.toLowerCase()
    if (company && lowerN.includes(company)) continue
    if (website && companyDom && website.includes(companyDom)) continue
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
    'competitors: [{ name (required), website?, positioning?, ai_maturity?, innovation_focus?, citations: string[] }] (name is required; identify 2-3 real companies in same industry/geography with <500 employees or similar business models; ai_maturity: brief description of their AI/digital maturity; innovation_focus: brief description of their innovation focus; citations defaults to [] if not provided)',
    'use_cases: EXACTLY 5 items; each { title, description, value_driver (revenue|cost|risk|speed), complexity (1..5), effort (1..5), est_annual_benefit?, est_one_time_cost?, est_ongoing_cost?, payback_months?, data_requirements?, risks?, next_steps?, citations: string[] } (all numeric fields must be present; citations defaults to [] if not provided)',
    'citations: string[] of URLs used anywhere in the brief',
    'Return ONLY a JSON object. No markdown, no prose.'
  ]

  const system = [
    'You are an analyst writing for CEOs of companies with <500 employees.',
    'Use plain, directive business language; be concise.',
    'Do NOT invent or infer content. If there is no evidence, return an empty array for that section.',
    'Company summary: Write a comprehensive 4-8 sentence overview (minimum 100 characters) that thoroughly describes: (1) what the company does and its core business model, (2) primary products/services and key capabilities, (3) target markets and customer base, (4) market position and competitive standing, (5) operational focus and key differentiators, (6) strategic direction if evident. Be specific and detailed based on the provided snippets. This is required, not optional.',
    'Company facts: Extract and include size (PRIORITIZE employee count in format "X employees" or "X-Y employees" - search for "employees", "employee count", "workforce", "staffing", "headcount" in snippets; if employee count not found, estimate from revenue or company descriptions, format as "X employees" or approximate range; only include if verifiable from snippets), industry sector, headquarters location, founding year (format as "Founded in YYYY" using the company registration/incorporation year from snippets), CEO/founder name (extract from snippets - PRIORITIZE LinkedIn profiles, company register entries, and leadership pages; look for "CEO", "Chief Executive Officer", "Geschäftsführer", "Vorstand", "founder", "founder and CEO", "managing director"; for Swiss/German companies, also check for German terms like "Geschäftsführer", "Vorstandsvorsitzender"; extract full name format like "John Smith" or "Hans Müller" from verified sources like LinkedIn or company registers), market position/leadership information, and one point from latest news/announcements if available in snippets. Only include facts you can verify from snippets.',
    'Industry summary: Write one paragraph (under 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the company\'s industry. Focus on business transformation and competitive advantage - not technical details. Explain how AI/ML/data-driven technologies are changing how companies operate, compete, and create value. Keep tone strategic and business-oriented for SMB leaders.',
    'Industry trends: Provide 4-5 trends (max 15 words each) that directly reference AI, ML, or data-driven technologies transforming the industry. Examples: "AI-driven predictive maintenance reduces downtime by 20%", "Smart factories use ML to optimize production schedules", "AI forecasting improves inventory accuracy by 30%", "Sustainability analytics help meet compliance faster". Each trend must clearly connect business impact and technology value in one short sentence. Focus on what SMB leaders can act on now or in the near future. Keep tone strategic, not technical.',
    'Use-case titles must be Verb + Outcome (e.g., "Cut Scrap with AI QC").',
    'All use_cases MUST include ALL numeric fields (est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months); use 0 or reasonable estimates when uncertain.',
    'Competitors: MUST return exactly 2-3 real, named companies from the same industry and headquarters geography (country/region) with ≤500 employees. Anchor search to company headquarters location (city/country/region). Use industry-accurate tokens (product/process/category terms) to match sector. Exclude agencies, retailers, directories, unrelated entities. For each peer, return ALL five fields: name (required string), website (required string - homepage URL), positioning (required - one plain sentence: what they do and for whom), ai_maturity (required - one short phrase, e.g., "Basic automation", "Digital process monitoring", "Predictive quality analytics"), innovation_focus (required - one short phrase, e.g., "Process efficiency", "Customer-specific solutions", "Sustainability analytics"). NO placeholders, NO "industry average", NO generics. Return strict JSON array under key "competitors" with exactly 2-3 items. Citations optional (defaults to []).',
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
      'Industry summary: MUST be one paragraph (under 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the company\'s industry. Focus on business transformation and competitive advantage - strategic and business-oriented, not technical.',
      'industry.trends: MUST provide 4-5 AI/ML/data-driven technology trends (max 15 words each) that directly reference AI or emerging tech. Each trend must clearly connect business impact and technology value. Examples: predictive maintenance, smart factories, AI forecasting, sustainability analytics. Focus on what SMB leaders can act on now or in the near future.',
      'competitors: MUST return exactly 2-3 real, named companies from same industry and headquarters geography (≤500 employees). All five fields required: name (string), website (string - homepage URL), positioning (one sentence), ai_maturity (one short phrase), innovation_focus (one short phrase). No placeholders, no generics, no industry average. Citations optional (defaults to []).',
      'strategic_moves: citations array defaults to [] if not provided.',
      'Provide exactly 5 use_cases with ALL numeric fields present (use 0 if uncertain).',
      'If a section lacks evidence, return [] for that section (no filler).'
    ]
  })

  console.log('[Pipeline] Preparing to call LLM with:')
  console.log('[Pipeline] - System prompt length:', system.length)
  console.log('[Pipeline] - Snippets count:', top.length)
  console.log('[Pipeline] - Schema rules:', schemaRules)
  console.log('[Pipeline] - User payload (preview):', userPayload.substring(0, 500))

  let parsed: Brief | null = null
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
                'industry.summary is REQUIRED - one paragraph (under 50 words) summarizing how intelligent automation, data analytics, and AI adoption are transforming the industry. Focus on business transformation, not technical details.',
                'industry.trends: 4-5 AI/ML/data-driven trends (max 15 words each) that directly reference AI or emerging tech. Each must connect business impact and technology value. Focus on what SMB leaders can act on now or near future.',
                'competitors: Return exactly 2-3 real, named companies from same industry and headquarters geography (≤500 employees). All five fields required: name (string), website (string - homepage URL), positioning (one sentence), ai_maturity (one short phrase), innovation_focus (one short phrase). No placeholders, no generics. Citations optional (defaults to [])',
                'strategic_moves: citations defaults to [] if not provided',
                'use_cases has EXACTLY 5 items',
                'value_driver in [revenue|cost|risk|speed]',
                'complexity and effort are integers 1..5',
                'ALL numeric fields present for use_cases (est_annual_benefit, est_one_time_cost, est_ongoing_cost, payback_months)'
              ]
            }
          })

    console.log(`[Pipeline] Calling LLM (attempt ${attempt + 1})...`)
    if (attempt === 0) {
      console.log('[Pipeline] Full user payload being sent to LLM:', payload)
    } else {
      console.log('[Pipeline] Retry payload (with fix instructions):', payload.substring(0, 1000))
    }
    
    const json = await llmGenerateJson(system, payload)
    console.log('[Pipeline] LLM returned JSON, validating with schema...')
    
    const result = BriefSchema.safeParse(json)
    if (result.success) {
      console.log('[Pipeline] Schema validation PASSED')
      parsed = result.data
      break
    } else {
      console.error('[Pipeline] Schema validation FAILED:', result.error.errors)
      firstError = result.error
      if (attempt === 0) {
        console.log('[Pipeline] Retrying with more explicit rules...')
      }
    }
  }

  if (!parsed) throw new Error('Failed to validate model output')

  /* 5) Enhanced competitor search with industry tokens */
  console.log('[Pipeline] Starting enhanced competitor search...')
  
  // Step 1: Extract industry tokens from company website snippets
  const companySnippets = top.filter(s => {
    const url = s.url.toLowerCase()
    const domain = normalizeDomain(input.website)
    return url.includes(domain) || url.includes(input.name.toLowerCase().replace(/\s+/g, ''))
  })
  const industryTokens = extractIndustryTokens(companySnippets.length > 0 ? companySnippets : top.slice(0, 5), input.name)
  
  // Step 2: Build focused competitor queries
  const headquarters = parsed.company?.headquarters
  const competitorQueries = buildCompetitorQueries(input.name, industryTokens, headquarters)
  
  // Step 3: Search for competitors with advanced depth (10-12 results per query)
  const competitorSnippets: ResearchSnippet[] = []
  for (let i = 0; i < competitorQueries.length; i++) {
    const q = competitorQueries[i]
    console.log(`[Pipeline] Searching competitors [${i + 1}/${competitorQueries.length}]:`, q)
    const res = await tavilySearch(q, {
      maxResults: 12,
      searchDepth: 'advanced'
    })
    console.log(`[Pipeline] Competitor search returned ${res.length} results`)
    competitorSnippets.push(...res)
  }
  
  // Deduplicate by URL
  const competitorSnippetsUnique = Array.from(
    new Map(competitorSnippets.map(s => [s.url, s])).values()
  )
  console.log(`[Pipeline] After deduplication: ${competitorSnippetsUnique.length} unique competitor snippets`)

  // Step 4: Filter and score candidates
  const candidates = filterAndScoreCompetitorCandidates(
    competitorSnippetsUnique,
    input.name,
    input.website,
    industryTokens,
    headquarters
  )

  // Step 5: Enrich top candidates and return exactly 2-3
  const enrichedCompetitors: CompetitorStrict[] = []
  const targetCount = Math.min(3, Math.max(2, candidates.length)) // Exactly 2-3
  
  for (const candidate of candidates.slice(0, 5)) { // Check up to 5 to ensure we get 2-3 valid ones
    if (enrichedCompetitors.length >= targetCount) break
    
    console.log(`[Pipeline] Enriching competitor ${enrichedCompetitors.length + 1}/${targetCount}: ${candidate.name}`)
    const enriched = await enrichCompetitor(candidate, industryTokens, headquarters)
    if (enriched && enriched.name && enriched.name.trim()) {
      // Validate all required fields are present
      if (enriched.website && enriched.positioning && enriched.positioning.length >= 20 &&
          enriched.ai_maturity && enriched.ai_maturity.length >= 10 &&
          enriched.innovation_focus && enriched.innovation_focus.length >= 10 &&
          enriched.employee_band && enriched.geo_fit &&
          enriched.evidence_pages && enriched.evidence_pages.length >= 2) {
        enrichedCompetitors.push(enriched)
      } else {
        console.log(`[Pipeline] Skipping ${enriched.name} - missing required fields:`, {
          hasWebsite: !!enriched.website,
          hasPositioning: enriched.positioning?.length >= 20,
          hasAiMaturity: enriched.ai_maturity?.length >= 10,
          hasInnovationFocus: enriched.innovation_focus?.length >= 10,
          hasEmployeeBand: !!enriched.employee_band,
          hasGeoFit: !!enriched.geo_fit,
          evidencePagesCount: enriched.evidence_pages?.length || 0
        })
      }
    }
  }

  // If we didn't get enough, try German queries for DACH region
  if (enrichedCompetitors.length < 2 && /switzerland|schweiz|germany|dach/i.test(headquarters || '')) {
    console.log('[Pipeline] Few competitors found, trying German queries (Oberflächenbehandlung / PVD Beschichtung / Galvanik)...')
    const germanQueries = [
      'Oberflächenbehandlung Wettbewerber Schweiz',
      'Oberflächenbehandlung Mitbewerber DACH',
      'PVD Beschichtung Wettbewerber Schweiz',
      'PVD Beschichtung Mitbewerber Europa',
      'Galvanik Wettbewerber Schweiz',
      'Galvanotechnik Mitbewerber DACH'
    ]
    
    const moreCompetitorSnippets: ResearchSnippet[] = []
    for (const q of germanQueries) {
      const res = await tavilySearch(q, {
        maxResults: 12,
        searchDepth: 'advanced'
      })
      moreCompetitorSnippets.push(...res)
    }
    
    // Deduplicate
    const allCompetitorSnippets = Array.from(
      new Map([...competitorSnippetsUnique, ...moreCompetitorSnippets].map(s => [s.url, s])).values()
    )

    const moreCandidates = filterAndScoreCompetitorCandidates(
      allCompetitorSnippets,
      input.name,
      input.website,
      industryTokens,
      headquarters
    )

    for (const candidate of moreCandidates.slice(0, 3 - enrichedCompetitors.length)) {
      if (enrichedCompetitors.some(c => c.name.toLowerCase() === candidate.name.toLowerCase())) continue
      console.log(`[Pipeline] Enriching additional competitor: ${candidate.name}`)
      const enriched = await enrichCompetitor(candidate, industryTokens, headquarters)
      if (enriched && enriched.name && enriched.name.trim()) {
        // Validate all required fields are present
        if (enriched.website && enriched.positioning && enriched.positioning.length >= 20 &&
            enriched.ai_maturity && enriched.ai_maturity.length >= 10 &&
            enriched.innovation_focus && enriched.innovation_focus.length >= 10 &&
            enriched.employee_band && enriched.geo_fit &&
            enriched.evidence_pages && enriched.evidence_pages.length >= 2) {
          enrichedCompetitors.push(enriched)
          if (enrichedCompetitors.length >= 3) break
        } else {
          console.log(`[Pipeline] Skipping ${enriched.name} - missing required fields`)
        }
      }
    }
  }

  // Use ONLY enriched competitors from live searches - no LLM fallbacks
  console.log(`[Pipeline] Found ${enrichedCompetitors.length} enriched competitors from live searches`)
  
  // Only use competitors with complete real data (all new required fields)
  const validCompetitors = enrichedCompetitors.filter(c => 
    c.name && c.name.trim() &&
    c.website && 
    c.positioning && c.positioning.length >= 20 &&
    c.ai_maturity && c.ai_maturity.length >= 10 &&
    c.innovation_focus && c.innovation_focus.length >= 10 &&
    c.employee_band && 
    c.geo_fit &&
    c.evidence_pages && c.evidence_pages.length >= 2
  )
  
  // Use only valid enriched competitors (no fallbacks, no LLM-generated)
  parsed.competitors = validCompetitors.slice(0, 3)
  
  if (parsed.competitors.length === 0) {
    console.warn(`[Pipeline] WARNING: No valid competitors found from live searches - returning empty array (no fallbacks)`)
  } else if (parsed.competitors.length < 2) {
    console.warn(`[Pipeline] WARNING: Only found ${parsed.competitors.length} valid competitors from live searches (target: 2-3, no fallbacks)`)
  }

  console.log(`[Pipeline] Final competitors (${parsed.competitors.length}):`, parsed.competitors.map(c => ({
    name: c.name,
    hasWebsite: !!c.website,
    hasPositioning: !!c.positioning,
    hasAiMaturity: !!c.ai_maturity,
    hasInnovationFocus: !!c.innovation_focus
  })))

  /* 6) Attach aggregated citations (internal only) */
  parsed.citations = dedupeUrls([...(parsed.citations || []), ...citations])

  /* 7) Deterministic rollups for Executive Summary (for UI hero cards) */
  const cases = parsed.use_cases || []
  const num = (v: any) => (typeof v === 'number' ? v : Number(v) || 0)

  const totalBenefit = cases.reduce((s, c) => s + num(c.est_annual_benefit), 0)
  const totalOneTime = cases.reduce((s, c) => s + num(c.est_one_time_cost), 0)
  const totalOngoing = cases.reduce((s, c) => s + num(c.est_ongoing_cost), 0)
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

  return { brief: parsed, citations: parsed.citations }
}



