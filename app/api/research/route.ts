import { z } from 'zod'
import { track } from '@/lib/utils/analytics'
import { runResearchPipeline } from '@/lib/research/pipeline'
import { createBrief } from '@/lib/db/briefs'
import { NextRequest } from 'next/server'

// Configure for longer execution time (Next.js 16+ supports maxDuration export)
export const runtime = 'nodejs' // Use Node.js runtime (not Edge)
export const maxDuration = 300 // 5 minutes (300 seconds) - maximum allowed by Vercel Pro

// Normalize website URL - add https:// if missing
function normalizeWebsite(url: string): string {
  if (!url) return url
  let normalized = url.trim()
  
  // Remove trailing slashes for consistency
  normalized = normalized.replace(/\/+$/, '')
  
  // Add https:// if no protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }
  
  // Validate it's a proper URL
  try {
    const urlObj = new URL(normalized)
    // Return without trailing slash for consistency
    return urlObj.toString().replace(/\/+$/, '')
  } catch (e) {
    // If URL parsing fails, return as-is (Zod will catch it)
    return normalized
  }
}

const InputSchema = z.object({
  companyName: z.string().min(1),
  name: z.string().min(1).optional(), // Legacy field
  website: z.string().min(1).transform((val) => normalizeWebsite(val)).pipe(z.string().url()),
  headquartersHint: z.string().min(1), // REQUIRED: Must include city, region, and country
  industryHint: z.string().min(1), // REQUIRED
  industry: z.string().optional() // Legacy field
})

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Log deployment info for debugging
    console.log('[API] Request received:', {
      isVercel: process.env.VERCEL === '1',
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
    
    // Check for required environment variables
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error('Missing PERPLEXITY_API_KEY environment variable')
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable')
    }
    
    const body = await req.json()
    const parsed = InputSchema.parse(body)
    
    // Normalize input (support both new and legacy field names)
    const companyName = parsed.companyName || parsed.name || ''
    const website = parsed.website
    const headquartersHint = parsed.headquartersHint
    const industryHint = parsed.industryHint || parsed.industry

    // STRICT PREREQUISITE CHECKS: All three required
    if (!companyName || companyName.trim().length === 0) {
      throw new Error('Company name is required')
    }
    if (!industryHint || industryHint.trim().length === 0) {
      throw new Error('Industry is required for competitor search')
    }
    if (!headquartersHint || headquartersHint.trim().length === 0) {
      throw new Error('Headquarters location (city, region, country) is required for competitor search')
    }

    // Validate headquarters contains location information (city, region, country)
    const hqLower = headquartersHint.toLowerCase()
    const hasCity = /^[^,]+/.test(headquartersHint.trim())
    const hasCountry = /(switzerland|schweiz|germany|deutschland|austria|österreich|france|italy|italia|spain|españa|united\s+kingdom|uk|britain|poland|polska|netherlands|nederland)/i.test(hqLower)
    
    if (!hasCity || !hasCountry) {
      throw new Error('Headquarters must include city and country (e.g., "Zurich, Switzerland" or "Berlin, Germany")')
    }

    await track('brief_started', { name: companyName, website, industry: industryHint })

    console.log('[API] Starting research pipeline for:', { companyName, website, industryHint, headquartersHint })
    
    // Add timeout protection at API level (280 seconds to leave 20s buffer before 300s limit)
    const pipelinePromise = runResearchPipeline({
      name: companyName,
      website,
      headquartersHint,
      industryHint
    })
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Pipeline timeout: Request took longer than 280 seconds')), 280000)
    })
    
    const result = await Promise.race([pipelinePromise, timeoutPromise])
    const { brief } = result
    
    // Log brief data before saving
    console.log('[API] Brief generated successfully:', {
      company: brief.company.name,
      competitorsCount: brief.competitors?.length || 0,
      competitors: brief.competitors?.map(c => c.name) || [],
      hasUseCases: (brief.use_cases || []).length > 0,
      hasROI: !!brief.roi
    })
    
    // Save brief to database
    let share_slug: string
    try {
      const result = await createBrief(brief)
      share_slug = result.share_slug
      console.log('[API] Brief saved to database with slug:', share_slug)
      
      // Verify the brief was actually saved by immediately fetching it
      const { getBriefBySlug } = await import('@/lib/db/briefs')
      const verifyBrief = await getBriefBySlug(share_slug, true) // Skip cache for immediate verification
      if (!verifyBrief) {
        console.error('[API] CRITICAL: Brief was saved but cannot be retrieved immediately. Slug:', share_slug)
        throw new Error('Brief saved but verification failed - database may be out of sync')
      }
      console.log('[API] Brief verification successful - brief is available:', share_slug)
    } catch (dbError: any) {
      console.error('[API] Database error saving brief:', {
        error: dbError?.message,
        code: dbError?.code,
        details: dbError
      })
      throw new Error(`Failed to save brief to database: ${dbError?.message || 'Unknown database error'}`)
    }

    await track('brief_generated', { name: companyName, share_slug })
    
    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(`[API] Brief generation completed in ${duration}s`)
    
    // Add timeout warning if it took too long
    if (duration > 240) {
      console.warn(`[API] Warning: Brief generation took ${duration}s, close to timeout limit`)
    }
    
    return new Response(JSON.stringify({ reportId: share_slug, shareSlug: share_slug }), { status: 200 })
  } catch (err: any) {
    const message = err?.message || String(err)
    const stack = err?.stack
    console.error('[API] Error generating brief:', {
      message,
      stack,
      error: err,
      name: err?.name,
      code: err?.code
    })
    
    await track('brief_failed', { error: message })
    
    // Always show detailed errors in development, and helpful messages in production
    const isDevelopment = process.env.NODE_ENV !== 'production'
    const isVercel = process.env.VERCEL === '1'
    
    // In production/Vercel, provide more helpful error messages
    let userMessage = message
    if (!isDevelopment) {
      if (message.includes('Missing') || message.includes('API_KEY') || message.includes('PERPLEXITY_API_KEY') || message.includes('OPENAI_API_KEY')) {
        userMessage = 'Configuration error: API keys are missing. Please check server configuration.'
      } else if (message.includes('Insufficient competitors') || message.includes('competitors')) {
        userMessage = 'Unable to find enough competitors for this company. Please try again or adjust the industry selection.'
      } else if (message.includes('timeout') || message.includes('timed out') || message.includes('Pipeline timeout') || message.includes('OpenAI request timed out')) {
        userMessage = 'The request took too long to complete. The pipeline is being optimized to run faster. Please try again with a simpler company name or contact support.'
      } else if (message.includes('Validation failed') || message.includes('validation')) {
        userMessage = 'Failed to generate valid brief data. Please try again with a different company or verify the website URL.'
      } else if (message.includes('OpenAI error') || message.includes('search service error')) {
        userMessage = 'Search service error. Please try again in a moment.'
      } else {
        userMessage = 'Failed to generate brief. Please try again.'
      }
    }
    
    const payload = isDevelopment
      ? { 
          error: 'Failed to generate brief', 
          details: message,
          stack: stack ? stack.split('\n').slice(0, 10).join('\n') : undefined,
          isVercel,
          vercelEnv: process.env.VERCEL_ENV,
          nodeEnv: process.env.NODE_ENV,
          errorName: err?.name,
          errorCode: err?.code
        }
      : { 
          error: userMessage,
          // Include error code for debugging in production (without sensitive details)
          code: message.includes('Missing') || message.includes('API_KEY') ? 'CONFIG_ERROR' :
                (message.includes('timeout') || message.includes('timed out') || message.includes('Pipeline timeout') || message.includes('OpenAI request timed out')) ? 'TIMEOUT_ERROR' :
                message.includes('Validation') || message.includes('validation') ? 'VALIDATION_ERROR' :
                message.includes('competitors') ? 'COMPETITOR_ERROR' :
                (message.includes('OpenAI error') || message.includes('search service error')) ? 'SEARCH_SERVICE_ERROR' :
                'UNKNOWN_ERROR'
        }
    return new Response(JSON.stringify(payload), { status: 400 })
  }
}
