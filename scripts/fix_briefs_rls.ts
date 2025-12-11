import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
const envFile = readFileSync('.env.local', 'utf-8')
const env: Record<string, string> = {}

envFile.split('\n').forEach(line => {
  if (line.trim() && !line.trim().startsWith('#')) {
    const [key, ...val] = line.split('=')
    if (key && val.length) env[key.trim()] = val.join('=').trim()
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function fixBriefsRLS() {
  console.log('Disabling RLS on briefs table...')
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE public.briefs DISABLE ROW LEVEL SECURITY;'
  })

  if (error) {
    console.error('Error disabling RLS:', error)
    console.log('\nPlease run this SQL manually in your Supabase dashboard:')
    console.log('ALTER TABLE public.briefs DISABLE ROW LEVEL SECURITY;')
    return
  }

  console.log('✅ RLS disabled on briefs table')
  
  // Verify by counting briefs
  const { count } = await supabase.from('briefs').select('*', { count: 'exact', head: true })
  console.log(`✅ Can now access ${count} briefs`)
}

fixBriefsRLS()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
