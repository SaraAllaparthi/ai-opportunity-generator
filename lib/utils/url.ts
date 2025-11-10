/**
 * Shared URL normalization utilities
 * Consolidates all URL/domain normalization logic
 */

/**
 * Normalize a website URL for input validation
 * - Adds https:// if no protocol
 * - Removes trailing slashes
 * - Validates URL format
 */
export function normalizeWebsite(url: string): string {
  if (!url) return url
  let normalized = url.trim()
  
  // Remove trailing slashes for consistency
  normalized = normalized.replace(/\/+$/, '')
  
  // Add https:// if no protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }
  
  // Validate it's a proper URL
  try {
    const urlObj = new URL(normalized)
    // Return without trailing slash for consistency
    return urlObj.toString().replace(/\/+$/, '')
  } catch (e) {
    // If URL parsing fails, return as-is (Zod will catch it)
    return normalized
  }
}

/**
 * Extract domain (hostname) from URL
 * - Removes www. prefix
 * - Returns just the hostname
 */
export function normalizeDomain(url?: string): string {
  if (!url) return ''
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    // Fallback: try to extract domain manually
    const cleaned = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    return cleaned.toLowerCase()
  }
}

/**
 * Normalize URL to origin (protocol + hostname, no path)
 */
export function normalizeToOrigin(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${urlObj.protocol}//${urlObj.hostname}`
  } catch {
    return url
  }
}

/**
 * Normalize URL for citation deduplication
 * - Removes hash fragments
 * - Sorts query parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.searchParams.sort()
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Get domain from URL (for citations/confidence)
 * - Removes www. prefix
 * - Returns hostname only
 */
export function getDomain(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    return host
  } catch {
    return url
  }
}

