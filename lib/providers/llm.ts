// OpenAI LLM provider wrapper (server-side only) with retries/backoff
export type LlmJsonResponse = any

type GenerateOptions = {
  model?: string
  timeoutMs?: number
}

export async function llmGenerateJson(system: string, user: string, options?: GenerateOptions): Promise<LlmJsonResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

  const model = options?.model ?? 'gpt-4o-mini'
  const timeoutMs = options?.timeoutMs ?? 60000
  const url = 'https://api.openai.com/v1/chat/completions'
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  }

  let attempt = 0
  const maxAttempts = 3
  const baseDelay = 500

  while (attempt < maxAttempts) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
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
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
      const json = await res.json()
      clearTimeout(t)
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI returned empty content')
      return JSON.parse(content)
    } catch (err) {
      // If aborted, provide clearer message
      if ((err as any)?.name === 'AbortError') {
        throw new Error('OpenAI request timed out')
      }
      attempt += 1
      if (attempt >= maxAttempts) throw err
      await new Promise((r) => setTimeout(r, baseDelay * attempt))
    }
  }

  throw new Error('LLM generation failed')
}


