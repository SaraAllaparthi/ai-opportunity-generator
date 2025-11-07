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
  const timeoutMs = options?.timeoutMs ?? 45000 // Reduced from 60s to 45s to prevent overall timeout
  const url = 'https://api.openai.com/v1/chat/completions'
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  }

  console.log('[LLM] Sending request to OpenAI:', {
    model,
    systemLength: system.length,
    userLength: user.length,
    systemPreview: system.substring(0, 500),
    userPreview: user.substring(0, 500)
  })
  
  // Log full system and user prompts (may be long)
  console.log('[LLM] Full system prompt:', system)
  console.log('[LLM] Full user payload:', user)

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
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[LLM] Error response:', { status: res.status, statusText: res.statusText, body: errorText })
        throw new Error(`OpenAI error: ${res.status}`)
      }
      const json = await res.json()
      clearTimeout(t)
      const content = json.choices?.[0]?.message?.content
      if (!content) {
        console.error('[LLM] OpenAI returned empty content. Full response:', JSON.stringify(json, null, 2))
        throw new Error('OpenAI returned empty content')
      }
      
      console.log('[LLM] Received response:', {
        model: json.model,
        usage: json.usage,
        contentLength: content.length,
        contentPreview: content.substring(0, 500)
      })
      
      const parsed = JSON.parse(content)
      console.log('[LLM] Parsed JSON response:', JSON.stringify(parsed, null, 2))
      
      return parsed
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


