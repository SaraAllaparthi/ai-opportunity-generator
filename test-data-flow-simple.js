/**
 * Simple test to check competitor data in database
 * Run with: node test-data-flow-simple.js <slug>
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read .env.local
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
    }
  })
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDataFlow() {
  const slug = process.argv[2]
  
  if (!slug) {
    console.log('Usage: node test-data-flow-simple.js <slug>')
    console.log('\nTo find a slug, check your database or use a recent brief slug')
    process.exit(1)
  }
  
  console.log(`\n🔍 Testing data flow for slug: ${slug}\n`)
  console.log('='.repeat(80))
  
  // 1. Fetch from database
  console.log('\n1. Fetching from database...')
  const { data, error } = await supabase
    .from('briefs')
    .select('id, share_slug, created_at, data')
    .eq('share_slug', slug)
    .maybeSingle()
  
  if (error) {
    console.error('❌ Database error:', error)
    process.exit(1)
  }
  
  if (!data) {
    console.error(`❌ No brief found with slug: ${slug}`)
    process.exit(1)
  }
  
  console.log('✅ Brief found')
  console.log('   ID:', data.id)
  console.log('   Created:', data.created_at)
  
  // 2. Check data structure
  console.log('\n2. Checking data structure...')
  const briefData = data.data
  
  console.log('   Company:', briefData?.company?.name || 'MISSING')
  console.log('   Website:', briefData?.company?.website || 'MISSING')
  console.log('   Has competitors field:', 'competitors' in briefData)
  console.log('   Competitors type:', Array.isArray(briefData?.competitors) ? 'array' : typeof briefData?.competitors)
  console.log('   Competitors count:', briefData?.competitors?.length || 0)
  
  // 3. Check competitors
  console.log('\n3. Competitor details...')
  if (!briefData?.competitors || briefData.competitors.length === 0) {
    console.log('⚠️  NO COMPETITORS IN DATABASE')
    console.log('   This is why the component is blank!')
  } else {
    briefData.competitors.forEach((comp, i) => {
      console.log(`\n   Competitor ${i + 1}:`)
      console.log('     Name:', comp.name || 'MISSING')
      console.log('     Website:', comp.website || 'MISSING')
      console.log('     HQ:', comp.hq || 'not provided')
      console.log('     Evidence Pages:', comp.evidence_pages?.length || 0)
      
      // Check if component can use this
      const isValid = comp.name && comp.name.trim() && comp.website && comp.website.trim()
      console.log('     ✅ Valid for component:', isValid ? 'YES' : 'NO')
    })
  }
  
  // 4. Simulate component filtering
  console.log('\n4. Simulating component filtering...')
  const filtered = (briefData?.competitors || [])
    .filter(c => c && c.name && c.name.trim())
    .slice(0, 3)
  
  console.log('   After filtering:', filtered.length, 'competitor(s)')
  if (filtered.length > 0) {
    console.log('   ✅ Component should render')
    filtered.forEach((c, i) => console.log(`     ${i + 1}. ${c.name}`))
  } else {
    console.log('   ❌ Component will be blank')
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY:')
  if (briefData?.competitors && briefData.competitors.length > 0) {
    console.log('✅ Competitors exist in database')
    console.log('✅ Schema is correct')
    console.log('💡 Issue is likely in component rendering or data passing')
  } else {
    console.log('❌ ROOT CAUSE: No competitors in database')
    console.log('💡 Check pipeline logs to see why competitors are not being saved')
  }
  console.log('='.repeat(80))
}

testDataFlow().catch(console.error)

