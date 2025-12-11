import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/db/supabase-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Require admin authentication
    await requireAdmin()
    
    const supabase = await createAdminClient()
    
    console.log('[API] Fetching briefs from database...')
    // Fetch all briefs (using briefs table as source of truth for reports)
    // Include deleted items so we can show them in UI
    const { data: briefs, error } = await supabase
      .from('briefs')
      .select('id, share_slug, created_at, deleted_at, data')
      .order('created_at', { ascending: false })
    
    console.log('[API] Query result:', { count: briefs?.length, error })
    
    if (error) {
      console.error('[API] Error fetching briefs for admin:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    // Map briefs to the format expected by AdminReportManagement component
    const reports = briefs.map(brief => ({
      id: brief.id,
      company_name: (brief.data as any)?.company?.name || 'Unknown Company',
      created_at: brief.created_at,
      deleted_at: brief.deleted_at,
      // Frontend expects report_shares array for the link
      report_shares: [{
        share_slug: brief.share_slug,
        created_at: brief.created_at
      }]
    }))
    
    console.log(`[API] Returning ${reports.length} reports to admin`)
    return NextResponse.json({ reports }, { status: 200 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.error('[API] Error in GET /api/admin/reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
