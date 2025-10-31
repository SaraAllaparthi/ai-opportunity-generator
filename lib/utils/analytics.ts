const ENABLE_ANALYTICS = process.env.ENABLE_ANALYTICS === '1' || process.env.ENABLE_ANALYTICS === 'true'

type EventName = 'brief_started' | 'brief_generated' | 'brief_failed' | 'share_opened' | 'cta_clicked'

export async function track(event: EventName, payload?: Record<string, any>) {
  if (!ENABLE_ANALYTICS) return
  try {
    // Console logging by default; optional TODO: persist to Supabase events table
    console.log(`[analytics] ${event}`, payload || {})
  } catch {
    // noop
  }
}


