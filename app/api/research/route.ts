import { z } from 'zod'
import { track } from '@/lib/utils/analytics'
import { runResearchPipeline } from '@/lib/research/pipeline'
import { createBrief } from '@/lib/db/briefs'
import { NextRequest } from 'next/server'

const InputSchema = z.object({
  name: z.string().min(1),
  website: z.string().url()
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, website } = InputSchema.parse(body)
    await track('brief_started', { name, website })

    const { brief } = await runResearchPipeline({ name, website })
    const { share_slug } = await createBrief(brief)

    await track('brief_generated', { name, share_slug })
    return new Response(JSON.stringify({ reportId: share_slug, shareSlug: share_slug }), { status: 200 })
  } catch (err: any) {
    const message = err?.message || String(err)
    await track('brief_failed', { error: message })
    const payload = process.env.NODE_ENV === 'production'
      ? { error: 'Failed to generate brief. Please try again.' }
      : { error: 'Failed to generate brief', details: message }
    return new Response(JSON.stringify(payload), { status: 400 })
  }
}


