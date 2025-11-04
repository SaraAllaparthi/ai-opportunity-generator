import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    // Check env
    const have = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      PERPLEXITY_API_KEY: !!process.env.PERPLEXITY_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    // Check DB connectivity (lightweight RPC) - lazy import to avoid build-time errors
    let dbError: string | null = null
    if (have.SUPABASE_URL && have.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { supabase } = await import('@/lib/db/supabase')
        const { error } = await supabase.from('briefs').select('id').limit(1)
        dbError = error?.message || null
      } catch (err: any) {
        dbError = err?.message || 'Connection failed'
      }
    }
    return new Response(JSON.stringify({ ok: !dbError, env: have, dbError }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), { status: 200 })
  }
}


