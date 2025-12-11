
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env vars manually from .env.local because dotenv might not be installed
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8')
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '') // remove quotes
      process.env[key] = value
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkUsers() {
  console.log('--- Checking Auth Users vs App Users ---')

  // 1. Fetch all Auth Users
  const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers()
  if (authError) {
    console.error('Error fetching auth users:', authError)
    return
  }
  console.log(`Found ${authUsers.length} Auth Users`)

  // 2. Fetch all App Users
  const { data: appUsers, error: dbError } = await adminClient
    .from('app_users')
    .select('*')
  
  if (dbError) {
    console.error('Error fetching app users:', dbError)
    return
  }
  console.log(`Found ${appUsers.length} App Users`)

  // 3. Compare
  console.log('\n--- Analysis ---')
  const authIds = new Set(authUsers.map(u => u.id))
  const appIds = new Set(appUsers.map(u => u.auth_user_id)) // Assuming auth_user_id link

  // Check for App Users without Auth User
  const appWithoutAuth = appUsers.filter(u => !authIds.has(u.auth_user_id))
  if (appWithoutAuth.length > 0) {
    console.error(`CRITICAL: Found ${appWithoutAuth.length} App Users without corresponding Auth User:`)
    appWithoutAuth.forEach(u => console.log(` - Email: ${u.email}, ID: ${u.id}, AuthID: ${u.auth_user_id}`))
  } else {
    console.log('OK: All App Users have corresponding Auth IDs.')
  }

  // Check for Auth Users without App User
  const authWithoutApp = authUsers.filter(u => !appIds.has(u.id))
  if (authWithoutApp.length > 0) {
    console.warn(`WARNING: Found ${authWithoutApp.length} Auth Users without corresponding App User (might be fine if not fully registered):`)
    authWithoutApp.forEach(u => console.log(` - Email: ${u.email}, ID: ${u.id}`))
  }

  // Check Email mismatches
  console.log('\n--- Email Consistency Check ---')
  appUsers.forEach(appUser => {
    const authUser = authUsers.find(u => u.id === appUser.auth_user_id)
    if (authUser && authUser.email !== appUser.email) {
      console.warn(`MISMATCH: Email differs for ID ${appUser.id}`)
      console.warn(`  App: ${appUser.email}`)
      console.warn(`  Auth: ${authUser.email}`)
    }
  })
}

checkUsers().catch(console.error)
