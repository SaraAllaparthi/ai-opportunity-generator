import { z } from 'zod'
import { track } from '@/lib/utils/analytics'
import { runResearchPipeline } from '@/lib/research/pipeline'
import { createBrief } from '@/lib/db/briefs'
import { NextRequest } from 'next/server'

// Increase timeout for long-running research pipeline
export const maxDuration = 300 // 5 minutes (max for Vercel Pro, 60s for Hobby)
export const dynamic = 'force-dynamic'

const InputSchema = z.object({
  name: z.string().min(1),
  website: z.string().url()
})

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await req.json()
    const { name, website } = InputSchema.parse(body)
    await track('brief_started', { name, website })

    console.log('[API] Starting research pipeline for:', { name, website })
    console.log('[API] Pipeline started at:', new Date().toISOString())
    
    const { brief } = await runResearchPipeline({ name, website })
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[API] Pipeline completed in ${elapsed}s`)
    
    // Log brief data before saving
    console.log('[API] Brief generated successfully:', {
      company: brief.company.name,
      competitorsCount: brief.competitors?.length || 0,
      competitors: brief.competitors?.map(c => c.name) || [],
      hasUseCases: (brief.use_cases || []).length > 0
    })
    
    const { share_slug } = await createBrief(brief)
    console.log('[API] Brief saved to database with slug:', share_slug)

    await track('brief_generated', { name, share_slug, duration: elapsed })
    return new Response(JSON.stringify({ reportId: share_slug, shareSlug: share_slug }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err?.message || String(err)
    console.error(`[API] Error generating brief after ${elapsed}s:`, message)
    console.error('[API] Error stack:', err?.stack)
    await track('brief_failed', { error: message, duration: elapsed })
    const payload = process.env.NODE_ENV === 'production'
      ? { error: 'Failed to generate brief. Please try again.' }
      : { error: 'Failed to generate brief', details: message }
    return new Response(JSON.stringify(payload), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


