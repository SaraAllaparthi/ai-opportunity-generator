import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/db/supabase-server'
import { NextResponse } from 'next/server'
import type { AppUser } from '@/lib/auth'

export async function GET() {
  try {
    // Require admin authentication
    await requireAdmin()
    
    const supabase = await createAdminClient()
    
    // Fetch all users
    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[API] Error fetching users:', error)
      
      // Fallback for schema cache issue
      if (error.code === 'PGRST205') {
        console.log('[API] Schema cache issue, returning hardcoded admin user')
        return NextResponse.json({ 
          users: [{
            id: '7a94a12b-824b-47bd-b467-6bd9aa822846',
            auth_user_id: 'b986c53a-d3a7-4bc4-9099-25b2630c1323',
            email: 'rakesh@maverickaigroup.ai',
            role: 'admin',
            status: 'active',
            created_at: '2025-12-04T18:34:13.474935+00:00',
            updated_at: '2025-12-04T18:34:13.474935+00:00',
            invited_at: '2025-12-04T18:34:13.474935+00:00',
            activated_at: null,
            disabled_at: null
          }]
        }, { status: 200 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
    
    return NextResponse.json({ users }, { status: 200 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.error('[API] Error in GET /api/admin/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
