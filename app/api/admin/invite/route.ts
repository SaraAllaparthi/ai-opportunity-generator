import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/db/supabase-server'

export async function POST(req: NextRequest) {
  try {
    // 1. Check if requester is admin
    await requireAdmin()

    const body = await req.json()
    const { email, password } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabaseAdmin = await createAdminClient()
    const supabaseClient = await createClient() // For app_users insert

    // 2. Create user (with password) or Invite user (magic link)
    let authData, authError

    if (password) {
      // Admin is creating user with specific password
      console.log('Creating user with provided password:', email)
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Auto-confirm email so they can log in immediately
      })
      authData = result.data
      authError = result.error
    } else {
      // Fallback to invite flow if no password provided (legacy/optional)
      console.log('Inviting user via email (no password):', email)
      const result = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
      authData = result.data
      authError = result.error
    }

    if (authError) {
      // Handle "user already registered" by resending invite/notification
      // Note: If creating with password fails because they exist, we might want to just tell admin "User exists"
      // instead of resending invite, because we can't set their password if they already exist without a reset flow.
      if (authError.status === 422 && authError.message.includes('already been registered')) {
        console.log('User already registered')
        return NextResponse.json({ error: 'User already exists. Please reset password instead.' }, { status: 400 })
      }

      console.warn('Error creating/inviting user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    if (!authData?.user) {
      console.warn('No user data returned from Auth')
      return NextResponse.json({ error: 'Failed to create user in Auth system' }, { status: 500 })
    }

    // 3. Create app_users record
    const { error: dbError } = await supabaseAdmin // Use admin client to bypass RLS if needed, or ensure policy allows admin to insert
      .from('app_users')
      .upsert({
        auth_user_id: authData.user.id,
        email: authData.user.email!,
        role: 'user',
        status: password ? 'active' : 'invited',
        activated_at: password ? new Date().toISOString() : null,
      }, { onConflict: 'auth_user_id' })

    if (dbError) {
      console.warn('Error creating app user:', dbError)
      return NextResponse.json({ error: 'Failed to create app user record' }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    console.warn('API Error:', error)
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
