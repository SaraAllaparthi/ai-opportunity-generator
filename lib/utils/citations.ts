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

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const u of urls) {
    const n = normalizeUrl(u)
    if (!seen.has(n)) {
      seen.add(n)
      result.push(n)
    }
  }
  return result
}

export function getDomain(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    return host
  } catch {
    return url
  }
}

export function confidenceFromCount(count: number): 'High' | 'Medium' | 'Low' {
  if (count >= 3) return 'High'
  if (count >= 1) return 'Medium'
  return 'Low'
}


