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
  const timeoutMs = options?.timeoutMs ?? 120000 // 2 minutes default for complex JSON generation
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
    const t = setTimeout(() => {
      console.error(`[LLM] Request timeout after ${timeoutMs}ms, aborting...`)
      controller.abort()
    }, timeoutMs)
    try {
      const startTime = Date.now()
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      const fetchTime = Date.now() - startTime
      console.log(`[LLM] Fetch completed in ${fetchTime}ms, status: ${res.status}`)
      
      if (!res.ok) {
        clearTimeout(t)
        const errorText = await res.text()
        console.error('[LLM] Error response:', { status: res.status, statusText: res.statusText, body: errorText })
        throw new Error(`OpenAI error: ${res.status}`)
      }
      
      const readStartTime = Date.now()
      const json = await res.json()
      const readTime = Date.now() - readStartTime
      console.log(`[LLM] Response body read in ${readTime}ms`)
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
      clearTimeout(t) // Always clear timeout in case of error
      // If aborted, provide clearer message
      if ((err as any)?.name === 'AbortError') {
        const timeoutSeconds = timeoutMs / 1000
        throw new Error(`OpenAI request timed out after ${timeoutSeconds} seconds. Try increasing the timeout or simplifying the request.`)
      }
      attempt += 1
      if (attempt >= maxAttempts) {
        console.error(`[LLM] Failed after ${maxAttempts} attempts:`, err)
        throw err
      }
      const delay = baseDelay * attempt
      console.log(`[LLM] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw new Error('LLM generation failed')
}

/**
 * Generate text (non-JSON) response from OpenAI
 */
export async function llmGenerateText(
  system: string,
  user: string,
  options?: {
    model?: string
    temperature?: number
    max_tokens?: number
    timeoutMs?: number
  }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

  const model = options?.model ?? 'gpt-4o-mini'
  const temperature = options?.temperature ?? 0.3
  const max_tokens = options?.max_tokens ?? 120
  const timeoutMs = options?.timeoutMs ?? 30000 // 30s default for text generation
  const url = 'https://api.openai.com/v1/chat/completions'
  const body = {
    model,
    temperature,
    max_tokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  }

  console.log('[LLM] Sending text generation request to OpenAI:', {
    model,
    temperature,
    max_tokens,
    systemLength: system.length,
    userLength: user.length
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    console.error(`[LLM] Text generation timeout after ${timeoutMs}ms`)
    controller.abort()
  }, timeoutMs)

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

    clearTimeout(timeout)

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[LLM] Error response:', { status: res.status, body: errorText })
      throw new Error(`OpenAI error: ${res.status}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) {
      console.error('[LLM] OpenAI returned empty content')
      throw new Error('OpenAI returned empty content')
    }

    console.log('[LLM] Text generation completed:', {
      model: json.model,
      usage: json.usage,
      contentLength: content.length
    })

    return content.trim()
  } catch (err) {
    clearTimeout(timeout)
    if ((err as any)?.name === 'AbortError') {
      throw new Error(`OpenAI request timed out after ${timeoutMs}ms`)
    }
    console.error('[LLM] Text generation error:', err)
    throw err
  }
}


