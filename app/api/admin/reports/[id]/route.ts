import { requireAdmin } from '@/lib/auth'
import { supabase } from '@/lib/db/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    await requireAdmin()
    
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }



    // Use singleton service role client to ensure RLS bypass
    // Soft delete the brief by setting deleted_at timestamp
    const { data, error } = await supabase
      .from('briefs')
      // @ts-ignore
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
    
    if (error) {
      console.error('[API] Error deleting report:', error)
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
    }
    
    if (!data || data.length === 0) {
      console.error('[API] Soft delete failed: No rows updated. ID:', id)
      return NextResponse.json({ error: 'Report not found or not updated' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.error('[API] Error in DELETE /api/admin/reports/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
