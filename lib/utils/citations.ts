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

export function getConfidenceColor(level: 'High' | 'Medium' | 'Low'): string {
  switch (level) {
    case 'High':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
    case 'Medium':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
    case 'Low':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
  }
}


