import { z } from 'zod'
import { track } from '@/lib/utils/analytics'
import { runResearchPipeline } from '@/lib/research/pipeline'
import { createBrief } from '@/lib/db/briefs'
import { NextRequest } from 'next/server'

// Normalize website URL - add https:// if missing
function normalizeWebsite(url: string): string {
  if (!url) return url
  let normalized = url.trim()
  
  // Remove trailing slashes for consistency
  normalized = normalized.replace(/\/+$/, '')
  
  // Remove leading www. if present (but keep it if it's part of the domain)
  // Actually, let's keep www. and just ensure protocol
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
  name: z.string().min(1),
  website: z.string().min(1).transform((val) => normalizeWebsite(val)).pipe(z.string().url())
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, website } = InputSchema.parse(body)
    await track('brief_started', { name, website })

    console.log('[API] Starting research pipeline for:', { name, website })
    const { brief } = await runResearchPipeline({ name, website })
    
    // Log brief data before saving
    console.log('[API] Brief generated successfully:', {
      company: brief.company.name,
      competitorsCount: brief.competitors?.length || 0,
      competitors: brief.competitors?.map(c => c.name) || [],
      hasUseCases: (brief.use_cases || []).length > 0
    })
    
    const { share_slug } = await createBrief(brief)
    console.log('[API] Brief saved to database with slug:', share_slug)

    await track('brief_generated', { name, share_slug })
    return new Response(JSON.stringify({ reportId: share_slug, shareSlug: share_slug }), { status: 200 })
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error('[API] Error generating brief:', message, err)
    await track('brief_failed', { error: message })
    const payload = process.env.NODE_ENV === 'production'
      ? { error: 'Failed to generate brief. Please try again.' }
      : { error: 'Failed to generate brief', details: message }
    return new Response(JSON.stringify(payload), { status: 400 })
  }
}


