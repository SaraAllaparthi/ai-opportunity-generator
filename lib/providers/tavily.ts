// Tavily provider wrapper with retries/backoff (server-side only)
type TavilySearchResult = {
  title: string
  url: string
  content: string
}

export async function tavilySearch(query: string, opts?: { maxResults?: number; timeoutMs?: number }): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('Missing TAVILY_API_KEY')

  const maxResults = opts?.maxResults ?? 8
  const timeoutMs = opts?.timeoutMs ?? 25000

  const body = {
    query,
    search_depth: 'basic',
    max_results: maxResults,
    // Some Tavily setups expect api_key in body; include for compatibility
    api_key: apiKey
  }

  const url = 'https://api.tavily.com/search'

  let attempt = 0
  const maxAttempts = 3
  const baseDelay = 400

  while (attempt < maxAttempts) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`Tavily error: ${res.status}`)
      const json = await res.json()
      clearTimeout(t)
      const results: TavilySearchResult[] = (json.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content || r.snippet || ''
      }))
      return results
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        // surface clearer message on timeout
        throw new Error('Tavily request timed out')
      }
      attempt += 1
      if (attempt >= maxAttempts) throw err
      await new Promise((r) => setTimeout(r, baseDelay * attempt))
    }
  }

  return []
}


