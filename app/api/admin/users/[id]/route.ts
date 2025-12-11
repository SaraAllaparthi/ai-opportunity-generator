import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/db/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    await requireAdmin()
    
    const { id } = await params
    const body = await request.json()
    const { status, role } = body
    
    // Validate input
    if (status && !['active', 'disabled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    
    const supabase = await createAdminClient()
    
    // Build update object
    const updates: any = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (role) updates.role = role
    if (status === 'disabled') updates.disabled_at = new Date().toISOString()
    if (status === 'active') updates.disabled_at = null
    
    // Update user
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('[API] Error updating user:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
    
    return NextResponse.json({ user: data }, { status: 200 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.error('[API] Error in PATCH /api/admin/users/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
