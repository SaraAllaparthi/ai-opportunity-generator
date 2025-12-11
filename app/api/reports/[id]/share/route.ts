import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createClient } from '@/lib/db/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser()
    const { id: reportId } = await params
    const body = await req.json()
    const { expires_in_days = 7 } = body

    const supabase = await createClient()

    // Verify ownership implicitly via RLS on insert, but explicit check is good too.
    // Let's rely on RLS insert policy which checks `created_by_user_id`.
    // Wait, report_shares references report_id. We need to ensure report_id belongs to user.
    // Our RLS policy for INSERT on report_shares checks `created_by_user_id = user.id`.
    // But it doesn't strictly enforce that `report_id` belongs to `user.id` unless we add a trigger or complex policy.
    // For now, let's check ownership manually.

    const { data: report } = await supabase
      .from('reports')
      .select('id')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (!report) {
      return NextResponse.json({ error: 'Report not found or access denied' }, { status: 404 })
    }

    const token = crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_in_days)

    const { error } = await supabase
      .from('report_shares')
      .insert({
        report_id: reportId,
        token,
        expires_at: expiresAt.toISOString(),
        created_by_user_id: user.id,
      })

    if (error) {
      console.error('Error creating share:', error)
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
    }

    return NextResponse.json({ token, expires_at: expiresAt })

  } catch (error: any) {
    console.error('API Error:', error)
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
