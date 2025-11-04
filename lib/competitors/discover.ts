// lib/competitors/discover.ts
// Main competitor discovery function for server-side pipeline

import { searchCompetitors } from '@/lib/search/perplexity'
import { extractCandidatesFromSearch, type Candidate } from '@/lib/extract/competitor'
import { normalizeUrlToOrigin, getETLDPlus1, buildEvidencePages, rankByLocality } from './normalize'
import { Brief } from '@/lib/schema/brief'

type DiscoverInput = {
  company: {
    name: string
    headquarters?: string
    website?: string
  }
  industry?: string
}

/**
 * Extract country from headquarters string
 */
function extractCountry(headquarters?: string): string | undefined {
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
  if (hq.includes('france')) {
    return 'France'
  }
  if (hq.includes('italy') || hq.includes('italia')) {
    return 'Italy'
  }
  
  return undefined
}

/**
 * Get company eTLD+1 for self-exclusion
 */
function getCompanyETLD(website?: string): string | null {
  if (!website) return null
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return getETLDPlus1(url.hostname)
  } catch {
    return null
  }
}

/**
 * Discover competitors using Perplexity + OpenAI
 * Returns validated competitors ready for Brief['competitors']
 */
export async function discoverCompetitors(input: DiscoverInput): Promise<Brief['competitors']> {
  // Check API keys
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('[Competitor Discovery] PERPLEXITY_API_KEY not configured - skipping competitor discovery')
    console.error('[Competitor Discovery] Please set PERPLEXITY_API_KEY in your environment variables')
    return []
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('[Competitor Discovery] OPENAI_API_KEY not configured - skipping competitor discovery')
    console.error('[Competitor Discovery] Please set OPENAI_API_KEY in your environment variables')
    return []
  }
  
  console.log('[Competitor Discovery] API keys configured - proceeding with discovery')

  const { company, industry } = input
  const companyHQ = company.headquarters || ''
  const country = extractCountry(companyHQ)
  const companyETLD = getCompanyETLD(company.website)

  console.log('[Competitor Discovery] Starting for:', company.name)
  console.log('[Competitor Discovery] Industry:', industry || 'not specified')
  console.log('[Competitor Discovery] HQ:', companyHQ, 'Country:', country)

  try {
    // Step 1: Search using Perplexity
    const searchResults = await searchCompetitors({
      companyName: company.name,
      industry: industry,
      headquarters: companyHQ,
      country: country,
      max: 40
    })

    console.log('[Competitor Discovery] Found', searchResults.length, 'search results')

    if (searchResults.length === 0) {
      console.log('[Competitor Discovery] No search results - returning empty array')
      return []
    }

    // Step 2: Extract structured data using OpenAI
    const candidates = await extractCandidatesFromSearch(searchResults, {
      companyName: company.name,
      headquarters: companyHQ,
      country: country,
      industry: industry
    })

    console.log('[Competitor Discovery] Extracted', candidates.length, 'candidates')

    if (candidates.length === 0) {
      console.log('[Competitor Discovery] No candidates extracted - returning empty array')
      return []
    }

    // Step 3: Validate and normalize each candidate
    const validated: Brief['competitors'] = []
    let droppedCount = 0

    for (const c of candidates) {
      // Validate website
      const origin = normalizeUrlToOrigin(c.website)
      if (!origin) {
        droppedCount++
        continue
      }

      // Exclude self (by eTLD+1)
      if (companyETLD) {
        try {
          const url = new URL(origin)
          const candidateETLD = getETLDPlus1(url.hostname)
          if (candidateETLD === companyETLD) {
            console.log(`[Competitor Discovery] Excluding self: ${c.name} (${candidateETLD})`)
            droppedCount++
            continue
          }
        } catch {
          // Skip if URL parsing fails
        }
      }

      // Build evidence pages
      const evidencePages = buildEvidencePages(origin)
      if (evidencePages.length < 2) {
        console.log(`[Competitor Discovery] Dropping ${c.name} - cannot build 2 evidence pages`)
        droppedCount++
        continue
      }

      // Build citations
      const citations = [origin]

      // Convert size to employee_band
      const employeeBand = c.size
        ? (typeof c.size === 'number' ? `${c.size} employees` : String(c.size))
        : 'Unknown'

      // Build geo_fit
      const geoFit = c.headquarters || c.country || companyHQ || 'Unknown'

      validated.push({
        name: c.name,
        website: origin,
        positioning: c.positioning || '',
        ai_maturity: c.ai_maturity || '',
        innovation_focus: c.innovation_focus || '',
        employee_band: employeeBand,
        geo_fit: geoFit,
        evidence_pages: evidencePages,
        citations
      })
    }

    console.log('[Competitor Discovery] Validated', validated.length, 'competitors (dropped', droppedCount, ')')

    if (validated.length === 0) {
      console.warn('[Competitor Discovery] All candidates failed validation')
      console.warn('[Competitor Discovery] Reasons: invalid websites, missing evidence pages, or self-exclusion')
      console.warn('[Competitor Discovery] Candidates received:', candidates.length)
      if (candidates.length > 0) {
        console.warn('[Competitor Discovery] Sample candidate:', JSON.stringify(candidates[0], null, 2))
      }
      return []
    }

    // Step 4: Deduplicate by name + eTLD+1
    const seen = new Set<string>()
    const unique: Brief['competitors'] = []

    for (const c of validated) {
      try {
        const url = new URL(c.website)
        const key = `${c.name.toLowerCase().trim()}|${getETLDPlus1(url.hostname)}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(c)
        }
      } catch {
        // Skip invalid URLs
        continue
      }
    }

    console.log('[Competitor Discovery] After deduplication:', unique.length)

    // Step 5: Rank by locality
    const ranked = unique
      .map(c => ({
        competitor: c,
        score: rankByLocality(companyHQ, c.geo_fit)
      }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.competitor)

    // Step 6: Filter by country priority (same country first, then region, then DACH/EU)
    const sameCountry: Brief['competitors'] = []
    const sameRegion: Brief['competitors'] = []
    const others: Brief['competitors'] = []

    for (const c of ranked) {
      const compCountry = extractCountry(c.geo_fit)
      const score = rankByLocality(companyHQ, c.geo_fit)
      
      if (score >= 80 && compCountry === country) {
        sameCountry.push(c)
      } else if (score >= 60) {
        sameRegion.push(c)
      } else {
        others.push(c)
      }
    }

    // Combine: same country → region → others, ensure ≥ 3 when available
    let result: Brief['competitors'] = [...sameCountry]
    
    if (result.length < 3 && sameRegion.length > 0) {
      const needed = Math.min(3 - result.length, sameRegion.length)
      result = [...result, ...sameRegion.slice(0, needed)]
    }
    
    if (result.length < 3 && others.length > 0) {
      const needed = Math.min(3 - result.length, others.length)
      result = [...result, ...others.slice(0, needed)]
    }

    // Take top 8 max
    const final = result.slice(0, Math.min(8, result.length))

    console.log('[Competitor Discovery] Final result:', final.length, 'competitors')
    console.log('[Competitor Discovery] Competitor names:', final.map(c => c.name))

    return final
  } catch (err: any) {
    console.error('[Competitor Discovery] Error:', err)
    // Return empty array on error - pipeline will continue
    return []
  }
}

