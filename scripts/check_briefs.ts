import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env.local', 'utf-8')
const env: Record<string, string> = {}

envFile.split('\n').forEach(line => {
  if (line.trim() && !line.trim().startsWith('#')) {
    const [key, ...val] = line.split('=')
    if (key && val.length) env[key.trim()] = val.join('=').trim()
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { count } = await supabase.from('briefs').select('*', { count: 'exact', head: true })
  console.log('Database URL:', env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('Briefs in ACTIVE database:', count)
}

check()
