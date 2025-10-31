import { createClient } from '@supabase/supabase-js'

// Server-side client using service role for simplicity in MVP.
// TODO: Migrate to RLS policies and anon key for read-only operations on public pages.
let _supabase: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (_supabase) return _supabase
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return _supabase
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return getSupabase()[prop as keyof ReturnType<typeof createClient>]
  }
})


