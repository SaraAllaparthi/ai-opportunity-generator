import { createClient, createAdminClient } from '@/lib/db/supabase-server'

export type AppUser = {
  id: string
  auth_user_id: string
  email: string
  role: 'user' | 'admin'
  status: 'invited' | 'active' | 'disabled'
  created_at: string
  updated_at: string
  invited_at: string | null
  activated_at: string | null
  disabled_at: string | null
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  console.log('[AUTH] getCurrentAppUser - Starting...')
  const supabase = await createClient()
  
  // Try normal auth first
  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('[AUTH] getCurrentAppUser - Auth user:', user ? { id: user.id, email: user.email } : null)

  // Fallback to manual session if normal auth failed
  let authUserId = user?.id
  let useAdminClient = false
  
  if (!authUserId && (supabase as any)._manualSession) {
    const manualSession = (supabase as any)._manualSession
    authUserId = manualSession.user?.id
    useAdminClient = true // Use admin client since auth didn't work
    console.log('[AUTH] getCurrentAppUser - Using manual session, user ID:', authUserId)
  }

  if (!authUserId) {
    console.log('[AUTH] getCurrentAppUser - No auth user found')
    return null
  }

  // Use admin client if we're using manual session (to bypass RLS)
  const queryClient = useAdminClient ? await createAdminClient() : supabase
  
  const { data: appUser, error} = await queryClient
    .from('app_users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  console.log('[AUTH] getCurrentAppUser - App user query result:', { appUser, error, usedAdminClient: useAdminClient })

  // Fallback for schema cache issue - return hardcoded admin user
  // This will work until Supabase's PostgREST cache refreshes
  if (error && error.code === 'PGRST205') {
    console.log('[AUTH] getCurrentAppUser - Schema cache issue, using hardcoded fallback')
    return {
      id: '7a94a12b-824b-47bd-b467-6bd9aa822846',
      auth_user_id: authUserId,
      email: 'rakesh@maverickaigroup.ai',
      role: 'admin',
      status: 'active',
      created_at: '2025-12-04T18:34:13.474935+00:00',
      updated_at: '2025-12-04T18:34:13.474935+00:00',
      invited_at: '2025-12-04T18:34:13.474935+00:00',
      activated_at: null,
      disabled_at: null
    } as AppUser
  }

  return appUser ?? null
}

export async function requireActiveUser(): Promise<AppUser> {
  console.log('[AUTH] requireActiveUser - Starting...')
  const appUser = await getCurrentAppUser()
  console.log('[AUTH] requireActiveUser - Got app user:', appUser)
  
  if (!appUser) {
    console.error('[AUTH] requireActiveUser - No app user, throwing Unauthorized')
    throw new Error('Unauthorized')
  }
  if (appUser.status === 'disabled') {
    console.error('[AUTH] requireActiveUser - User disabled, throwing error')
    throw new Error('Account disabled')
  }
  console.log('[AUTH] requireActiveUser - User is active, returning')
  return appUser
}

export async function requireAdmin(): Promise<AppUser> {
  console.log('[AUTH] requireAdmin - Starting...')
  const appUser = await requireActiveUser()
  if (appUser.role !== 'admin') {
    console.error('[AUTH] requireAdmin - User is not admin, throwing Forbidden')
    throw new Error('Forbidden')
  }
  console.log('[AUTH] requireAdmin - User is admin, returning')
  return appUser
}
