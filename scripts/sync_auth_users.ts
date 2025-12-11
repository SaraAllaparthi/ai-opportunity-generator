import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Manually load environment variables from .env.local
const envPath = join(process.cwd(), '.env.local')
const envFile = readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}

envFile.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function syncAuthUsersToAppUsers() {
  console.log('--- Syncing Auth Users to App Users ---\n')

  // Get all auth users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error fetching auth users:', authError)
    return
  }

  console.log(`Found ${authData.users.length} auth users\n`)

  // Get existing app users
  const { data: appUsers, error: appError } = await supabase
    .from('app_users')
    .select('auth_user_id, email')

  if (appError) {
    console.error('Error fetching app users:', appError)
    return
  }

  const existingAuthIds = new Set(appUsers?.map(u => u.auth_user_id) || [])

  // Find auth users without app_users records
  const missingUsers = authData.users.filter(u => !existingAuthIds.has(u.id))

  if (missingUsers.length === 0) {
    console.log('✅ All auth users have corresponding app_users records!')
    return
  }

  console.log(`Found ${missingUsers.length} auth users without app_users records:\n`)

  // Create app_users records for missing users
  for (const user of missingUsers) {
    console.log(`Creating app_users record for: ${user.email}`)
    
    const { error: insertError } = await supabase
      .from('app_users')
      .insert({
        auth_user_id: user.id,
        email: user.email!,
        role: user.email?.includes('rakesh') ? 'admin' : 'user', // Make rakesh admin
        status: 'active', // Set as active since they were created with password
        activated_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error(`  ❌ Error creating app_users record for ${user.email}:`, insertError)
    } else {
      console.log(`  ✅ Created app_users record for ${user.email}`)
    }
  }

  console.log('\n--- Sync Complete ---')
}

syncAuthUsersToAppUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
