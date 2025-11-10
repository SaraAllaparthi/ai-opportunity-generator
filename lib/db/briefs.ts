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
  
  // Validate competitor data structure before saving
  const competitors = data.competitors || []
  console.log('[DB] Creating brief with competitors:', {
    count: competitors.length,
    competitors: competitors.map(c => ({
      name: c.name,
      website: c.website,
      hasHq: !!c.hq,
      hasSizeBand: !!c.size_band,
      hasPositioning: !!c.positioning,
      evidencePagesCount: c.evidence_pages?.length || 0,
      hasSourceUrl: !!c.source_url
    }))
  })
  
  // Validate each competitor has required fields
  const invalidCompetitors = competitors.filter(c => {
    const hasName = c.name && typeof c.name === 'string' && c.name.trim().length > 0
    const hasWebsite = c.website && typeof c.website === 'string' && c.website.trim().length > 0
    const hasEvidencePages = Array.isArray(c.evidence_pages) && c.evidence_pages.length > 0
    return !hasName || !hasWebsite || !hasEvidencePages
  })
  
  if (invalidCompetitors.length > 0) {
    console.warn('[DB] ⚠️ Some competitors have missing required fields:', invalidCompetitors.map(c => ({
      name: c.name || 'MISSING',
      hasWebsite: !!c.website,
      evidencePagesCount: c.evidence_pages?.length || 0
    })))
  }
  
  // Ensure data structure matches schema exactly
  const briefData: Brief = {
    ...data,
    competitors: competitors.map(c => ({
      name: String(c.name).trim(),
      website: String(c.website).trim(),
      hq: c.hq ? String(c.hq).trim() : undefined,
      size_band: c.size_band ? String(c.size_band).trim() : undefined,
      positioning: c.positioning ? String(c.positioning).trim().substring(0, 140) : undefined,
      evidence_pages: Array.isArray(c.evidence_pages) && c.evidence_pages.length > 0
        ? c.evidence_pages.map(url => String(url).trim())
        : [c.website], // Fallback to website if evidence_pages is missing
      source_url: c.source_url ? String(c.source_url).trim() : undefined
    }))
  }
  
  const { data: row, error } = await supabase
    .from('briefs')
    .insert({ share_slug: shareSlug, data: briefData })
    .select('id, share_slug')
    .single()
  
  if (error) {
    console.error('[DB] Error creating brief:', error)
    console.error('[DB] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    throw error
  }
  
  if (!row) {
    console.error('[DB] Failed to create brief: no row returned')
    throw new Error('Failed to create brief')
  }
  
  // Verify the data was saved correctly by checking competitors
  const { data: verifyRow } = await supabase
    .from('briefs')
    .select('data')
    .eq('share_slug', shareSlug)
    .single()
  
  if (verifyRow) {
    const savedCompetitors = (verifyRow.data as any)?.competitors || []
    console.log('[DB] ✅ Brief created successfully:', { 
      id: row.id, 
      share_slug: row.share_slug,
      competitorsSaved: savedCompetitors.length,
      competitorNames: savedCompetitors.map((c: any) => c.name)
    })
  } else {
    console.warn('[DB] ⚠️ Brief created but verification query returned no data')
  }
  
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


