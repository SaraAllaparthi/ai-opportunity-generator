import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    // Check env
    const have = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    
    // Check Vercel environment
    const vercelInfo = {
      isVercel: process.env.VERCEL === '1',
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      nodeEnv: process.env.NODE_ENV || 'unknown',
      // Note: maxDuration is set in route.ts, but we can't read it here
      runtime: 'nodejs' // Should match route.ts
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
    
    const allGood = !dbError && have.OPENAI_API_KEY && have.SUPABASE_URL && have.SUPABASE_SERVICE_ROLE_KEY
    
    return new Response(JSON.stringify({ 
      ok: allGood, 
      env: have, 
      dbError,
      vercel: vercelInfo,
      warnings: [
        !have.OPENAI_API_KEY && 'Missing OPENAI_API_KEY',
        !have.SUPABASE_URL && 'Missing SUPABASE_URL',
        !have.SUPABASE_SERVICE_ROLE_KEY && 'Missing SUPABASE_SERVICE_ROLE_KEY',
        vercelInfo.isVercel && vercelInfo.vercelEnv === 'production' && 'Running on Vercel - ensure you have Pro plan for 300s timeout'
      ].filter(Boolean)
    }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err) }), { status: 200 })
  }
}


