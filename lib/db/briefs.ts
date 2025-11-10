import { supabase } from './supabase'
import { Brief } from '@/lib/schema/brief'
import { unstable_cache } from 'next/cache'

export type BriefRow = {
  id: string
  share_slug: string
  created_at: string
  data: Brief
}

export async function ensureSchema() {
  // TODO: Optionally run migrations in a proper system. For MVP, document schema:
  // Table: briefs (id uuid pk default gen_random_uuid(), share_slug text unique, created_at timestamptz default now(), data jsonb)
}

export async function createBrief(data: Brief): Promise<{ id: string; share_slug: string }> {
  const shareSlug = crypto.randomUUID().slice(0, 8)
  
  // Log competitor data before saving
  console.log('[DB] Creating brief with competitors:', {
    count: data.competitors?.length || 0,
    competitors: data.competitors?.map(c => ({
      name: c.name,
      hasHq: !!c.hq,
      hasSizeBand: !!c.size_band,
      hasPositioning: !!c.positioning
    })) || []
  })
  
  const { data: row, error } = await supabase
    .from('briefs')
    .insert({ share_slug: shareSlug, data })
    .select('id, share_slug')
    .single()
  
  if (error) {
    console.error('[DB] Error creating brief:', error)
    throw error
  }
  
  if (!row) {
    console.error('[DB] Failed to create brief: no row returned')
    throw new Error('Failed to create brief')
  }
  
  console.log('[DB] Brief created successfully:', { id: row.id, share_slug: row.share_slug })
  return { id: String(row.id), share_slug: String(row.share_slug) }
}

export async function listBriefs(): Promise<BriefRow[]> {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, share_slug, created_at, data')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as any) || []
}

export async function getBriefBySlug(slug: string, skipCache = false): Promise<BriefRow | null> {
  const fetchBrief = async (slug: string) => {
    const { data, error } = await supabase
      .from('briefs')
      .select('id, share_slug, created_at, data')
      .eq('share_slug', slug)
      .maybeSingle()
    if (error) {
      console.error('[DB] Error fetching brief:', error)
      throw error
    }
    
    if (data) {
      // Log competitor data when reading from DB
      const briefData = (data as any).data
      console.log('[DB] Retrieved brief from database:', {
        slug,
        company: briefData?.company?.name,
        competitorsCount: briefData?.competitors?.length || 0,
        competitors: briefData?.competitors?.map((c: any) => ({
          name: c.name,
          hasHq: !!c.hq,
          hasSizeBand: !!c.size_band,
          hasPositioning: !!c.positioning
        })) || []
      })
    }
    
    return (data as any) || null
  }

  // If skipCache is true (e.g., for newly created briefs), fetch directly
  if (skipCache) {
    return fetchBrief(slug)
  }

  // Otherwise use Next.js cache to ensure deterministic fetches - cache forever since briefs don't change
  const getCachedBrief = unstable_cache(
    fetchBrief,
    ['brief-by-slug'],
    {
      tags: [`brief-${slug}`],
      revalidate: false // Never revalidate - briefs are immutable
    }
  )
  
  return getCachedBrief(slug)
}


