import { supabase } from './supabase'
import { Brief } from '@/lib/schema/brief'

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
  const { data: row, error } = await supabase
    .from('briefs')
    .insert({ share_slug: shareSlug, data })
    .select('id, share_slug')
    .single()
  if (error) throw error
  if (!row) throw new Error('Failed to create brief')
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

export async function getBriefBySlug(slug: string): Promise<BriefRow | null> {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, share_slug, created_at, data')
    .eq('share_slug', slug)
    .maybeSingle()
  if (error) throw error
  return (data as any) || null
}


