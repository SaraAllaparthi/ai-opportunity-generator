import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/db/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')

  console.log('Auth callback params:', { token_hash, type, code })

  // Create a response object that we can attach cookies to
  // Default to successful redirect to home
  let response = NextResponse.redirect(new URL('/en', requestUrl.origin))

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Handle magic link (PKCE flow)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })
    
    console.log('Magic link verification:', { data, error })

    if (data.user && !error) {
      // Check if app_users record exists, create if not
      const adminClient = await createAdminClient()
      const { data: existingUser } = await adminClient
        .from('app_users')
        .select('id, status')
        .eq('auth_user_id', data.user.id)
        .single()
      
      if (!existingUser) {
        console.log('Creating app_users record for:', data.user.email)
        // Create app_users record for new user
        const { error: insertError } = await adminClient
          .from('app_users')
          .insert({
            auth_user_id: data.user.id,
            email: data.user.email!,
            status: 'active', // Set to active immediately for first user
            role: 'user'
          })
        
        if (insertError) {
          console.error('Error creating app_users:', insertError)
        } else {
          console.log('Successfully created app_users record')
        }
      } else {
        console.log('app_users record already exists, checking status...')
        
        // If user is 'invited', activate them now that they have logged in
        if (existingUser.status === 'invited') {
           console.log('Activating invited user:', data.user.email)
           const { error: updateError } = await adminClient
             .from('app_users')
             .update({ 
               status: 'active',
               activated_at: new Date().toISOString()
             })
             .eq('id', existingUser.id)
           
           if (updateError) {
             console.error('Error activating user:', updateError)
           } else {
             console.log('User activated successfully')
           }
        }
      }
    } else {
      console.error('Magic link verification failed:', error)
      // Redirect to login with error?
      return NextResponse.redirect(new URL(`/en/login?error=verification_failed&details=${encodeURIComponent(error?.message || '')}`, requestUrl.origin))
    }
  }
  // Handle OAuth code exchange
  else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('Code exchange:', { data, error })
    
    if (data.user && !error) {
      // Check if app_users record exists, create if not
      const adminClient = await createAdminClient()
      const { data: existingUser } = await adminClient
        .from('app_users')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .single()
      
      if (!existingUser) {
        // Create app_users record for new user
        await adminClient
          .from('app_users')
          .insert({
            auth_user_id: data.user.id,
            email: data.user.email!,
            status: 'active',
            role: 'user'
          })
      }
    }
  }

  // Redirect to home page (with cookies attached)
  return response
}
