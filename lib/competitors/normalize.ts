// lib/competitors/normalize.ts
// Utilities for normalizing competitor data

/**
 * Normalize URL to origin (scheme + hostname + port if non-standard)
 * Returns null if URL is invalid
 */
export function normalizeUrlToOrigin(input: string): string | null {
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`)
    return url.origin
  } catch {
    return null
  }
}

/**
 * Get eTLD+1 from hostname (e.g., "example.com" from "www.example.com")
 */
export function getETLDPlus1(hostname: string): string {
  const parts = hostname.toLowerCase().split('.')
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }
  return hostname.toLowerCase()
}

/**
 * Build evidence pages from origin
 * Returns up to 2 URLs from the same origin, prioritized by common paths
 */
export function buildEvidencePages(origin: string): string[] {
  const pages: string[] = []
  
  // Priority order for evidence pages
  const paths = [
    '/',
    '/about',
    '/en/about',
    '/about-us',
    '/en/about-us',
    '/company',
    '/en/company',
    '/who-we-are',
    '/en/who-we-are'
  ]
  
  // Always include origin root
  pages.push(origin)
  
  // Add second page if available
  if (pages.length < 2) {
    for (const path of paths) {
      if (path !== '/') {
        pages.push(`${origin}${path}`)
        if (pages.length >= 2) break
      }
    }
  }
  
  // Ensure we have at least 2 (duplicate origin if needed for schema)
  if (pages.length < 2) {
    pages.push(origin)
  }
  
  return pages.slice(0, 2)
}

/**
 * Rank competitors by geographic proximity to company HQ
 * Returns score: 100 (city), 90 (canton/state), 80 (country), 60 (DACH), 0 (other)
 */
export function rankByLocality(
  companyHQ?: string,
  competitorGeo?: string
): number {
  if (!companyHQ || !competitorGeo) return 0

  const hqLower = companyHQ.toLowerCase()
  const compLower = competitorGeo.toLowerCase()

  // Tokenize
  const hqTokens = hqLower.split(/[\s,/\|–-]+/).filter(Boolean)
  const compTokens = compLower.split(/[\s,/\|–-]+/).filter(Boolean)

  // Extract city (first token that's not a country/canton keyword)
  const countryKeywords = ['switzerland', 'schweiz', 'suisse', 'ch', 'germany', 'deutschland', 'de', 'austria', 'österreich', 'at']
  const hqCity = hqTokens.find(t => !countryKeywords.includes(t) && t.length > 2)
  
  // City match (100)
  if (hqCity && compTokens.includes(hqCity)) {
    return 100
  }

  // Canton/state match (90) - check Swiss cantons
  const swissCantons = ['thurgau', 'tg', 'zürich', 'zurich', 'zh', 'bern', 'be', 'basel', 'bs', 'geneva', 'ge', 'lausanne', 'vd', 'aargau', 'ag']
  const hqCanton = hqTokens.find(t => swissCantons.includes(t))
  if (hqCanton && compTokens.some(t => swissCantons.includes(t))) {
    return 90
  }

  // Country match (80)
  const countryMap: Record<string, string[]> = {
    'switzerland': ['switzerland', 'schweiz', 'suisse', 'ch'],
    'germany': ['germany', 'deutschland', 'de'],
    'austria': ['austria', 'österreich', 'at']
  }
  
  for (const [country, variants] of Object.entries(countryMap)) {
    const hqHasCountry = hqTokens.some(t => variants.includes(t))
    const compHasCountry = compTokens.some(t => variants.includes(t))
    if (hqHasCountry && compHasCountry) {
      return 80
    }
  }

  // DACH region match (60)
  const dachCountries = ['switzerland', 'schweiz', 'germany', 'deutschland', 'austria', 'österreich']
  const hqInDACH = hqTokens.some(t => dachCountries.includes(t))
  const compInDACH = compTokens.some(t => dachCountries.includes(t))
  if (hqInDACH && compInDACH) {
    return 60
  }

  return 0
}

