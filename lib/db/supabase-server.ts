import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  console.log('[SUPABASE-SERVER] Creating client with cookies:', allCookies.map(c => ({ 
    name: c.name, 
    hasValue: !!c.value,
    valueLength: c.value?.length 
  })))

  const client = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            console.error('[SUPABASE-SERVER] Error setting cookies:', error)
          }
        },
      },
    }
  )

  // Manual session extraction and verification
  const authCookie = allCookies.find(c => c.name.includes('auth-token') && !c.name.includes('verifier'))
  if (authCookie && authCookie.value) {
    try {
      // Remove base64- prefix if present
      const cookieValue = authCookie.value.startsWith('base64-') 
        ? authCookie.value.substring(7) 
        : authCookie.value
      
      const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8')
      const session = JSON.parse(decoded)
      
      console.log('[SUPABASE-SERVER] Manually parsed session:', {
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token,
        userEmail: session.user?.email,
        userId: session.user?.id
      })
      
      // Store the session data for later use
      if (session.access_token && session.user) {
        // Create a custom property to store the manual session
        (client as any)._manualSession = session
        console.log('[SUPABASE-SERVER] Stored manual session on client')
      }
    } catch (err) {
      console.error('[SUPABASE-SERVER] Error parsing cookie:', err)
    }
  }

  return client
}

export async function createAdminClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.SUPABASE_URL!
  console.log('[SUPABASE-ADMIN] Creating admin client with URL:', supabaseUrl)

  return createServerClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored
          }
        },
      },
    }
  )
}
