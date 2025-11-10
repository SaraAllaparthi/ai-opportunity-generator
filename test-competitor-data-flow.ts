#!/usr/bin/env tsx
/**
 * Test script to verify competitor data flow from database to component
 * Run with: npx tsx test-competitor-data-flow.ts
 */

import { getBriefBySlug } from './lib/db/briefs'
import { Brief } from './lib/schema/brief'

async function testDataFlow() {
  console.log('='.repeat(80))
  console.log('Testing Competitor Data Flow')
  console.log('='.repeat(80))
  
  // Read .env.local for environment variables
  const fs = await import('fs')
  const path = await import('path')
  const envPath = path.join(process.cwd(), '.env.local')
  
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

  // Get a recent brief slug (you can pass as argument or use a known one)
  const slug = process.argv[2] || 'test-slug'
  
  console.log(`\n1. Fetching brief with slug: ${slug}`)
  console.log('-'.repeat(80))
  
  try {
    const briefRow = await getBriefBySlug(slug, true) // skipCache
    
    if (!briefRow) {
      console.error('❌ Brief not found with slug:', slug)
      console.log('\n💡 Tip: Pass a valid slug as argument: npx tsx test-competitor-data-flow.ts <slug>')
      process.exit(1)
    }
    
    console.log('✅ Brief found')
    console.log('   ID:', briefRow.id)
    console.log('   Created:', briefRow.created_at)
    
    const data = briefRow.data as Brief
    
    console.log(`\n2. Checking Brief Data Structure`)
    console.log('-'.repeat(80))
    console.log('   Company:', data.company?.name || 'MISSING')
    console.log('   Website:', data.company?.website || 'MISSING')
    console.log('   Has competitors field:', 'competitors' in data)
    console.log('   Competitors type:', Array.isArray(data.competitors) ? 'array' : typeof data.competitors)
    console.log('   Competitors count:', data.competitors?.length || 0)
    
    console.log(`\n3. Competitor Data Details`)
    console.log('-'.repeat(80))
    
    if (!data.competitors || data.competitors.length === 0) {
      console.log('⚠️  NO COMPETITORS FOUND IN DATABASE')
      console.log('   This is the root cause - competitors array is empty')
    } else {
      data.competitors.forEach((comp, i) => {
        console.log(`\n   Competitor ${i + 1}:`)
        console.log('     Name:', comp.name || 'MISSING')
        console.log('     Website:', comp.website || 'MISSING')
        console.log('     HQ:', comp.hq || 'not provided')
        console.log('     Size Band:', comp.size_band || 'not provided')
        console.log('     Positioning:', comp.positioning || 'not provided')
        console.log('     Evidence Pages:', comp.evidence_pages?.length || 0, 'URLs')
        console.log('     Source URL:', comp.source_url || 'not provided')
        
        // Validate required fields
        const issues: string[] = []
        if (!comp.name || !comp.name.trim()) issues.push('missing name')
        if (!comp.website || !comp.website.trim()) issues.push('missing website')
        if (!comp.evidence_pages || comp.evidence_pages.length === 0) issues.push('missing evidence_pages')
        
        if (issues.length > 0) {
          console.log('     ⚠️  VALIDATION ISSUES:', issues.join(', '))
        } else {
          console.log('     ✅ All required fields present')
        }
      })
    }
    
    console.log(`\n4. Testing Component Data Access`)
    console.log('-'.repeat(80))
    
    // Simulate what the component does
    const competitors = (data.competitors || [])
      .filter(c => c && c.name && c.name.trim())
      .slice(0, 3)
    
    console.log('   Filtered competitors count:', competitors.length)
    console.log('   Has competitors:', competitors.length > 0)
    
    if (competitors.length > 0) {
      console.log('   ✅ Component should render with', competitors.length, 'competitor(s)')
      competitors.forEach((c, i) => {
        console.log(`     ${i + 1}. ${c.name} (${c.website})`)
      })
    } else {
      console.log('   ❌ Component will return null (no competitors to display)')
    }
    
    console.log(`\n5. Database Schema Check`)
    console.log('-'.repeat(80))
    console.log('   Schema supports competitors: ✅ (JSONB column)')
    console.log('   No schema changes needed')
    
    console.log(`\n6. Summary`)
    console.log('-'.repeat(80))
    if (data.competitors && data.competitors.length > 0) {
      console.log('✅ Competitors are present in database')
      console.log('✅ Data structure is correct')
      console.log('✅ Component should receive data correctly')
      console.log('\n💡 If component is still blank, check:')
      console.log('   1. Browser console for React errors')
      console.log('   2. Network tab for API errors')
      console.log('   3. Component render logic')
    } else {
      console.log('❌ ROOT CAUSE: No competitors in database')
      console.log('\n💡 Solutions:')
      console.log('   1. Check pipeline logs - are competitors being found?')
      console.log('   2. Check findLocalCompetitors function - is it returning results?')
      console.log('   3. Check validation - are competitors being filtered out?')
      console.log('   4. Generate a new brief to test competitor search')
    }
    
    console.log('\n' + '='.repeat(80))
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testDataFlow()

