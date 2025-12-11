import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true
})

export default async function middleware(request: NextRequest) {
  console.log('[MIDDLEWARE] Request path:', request.nextUrl.pathname)
  console.log('[MIDDLEWARE] Cookies:', request.cookies.getAll().map(c => c.name))
  
  // 1. Handle Supabase Auth Session
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          console.log('[MIDDLEWARE] Setting cookies:', cookiesToSet.map(c => c.name))
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if needed
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[MIDDLEWARE] User from session:', user ? { id: user.id, email: user.email } : null)

  // 2. Handle Intl Routing
  // If the user is visiting the root path, we might want to let intl middleware handle the redirect
  if (request.nextUrl.pathname === '/') {
    const locale = request.cookies.get('NEXT_LOCALE')?.value || 
                   request.headers.get('accept-language')?.split(',')[0]?.split('-')[0] || 
                   'en'
    // const validLocale = ['en', 'de'].includes(locale) ? locale : 'en' // Unused variable
    return intlMiddleware(request)
  }
  
  // For other paths, run intl middleware
  // Note: We need to merge the response from intlMiddleware with the cookies set by Supabase
  const response = intlMiddleware(request)
  
  // Copy cookies from supabaseResponse to the final response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie)
  })

  return response
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next`, `/_vercel`, or `/auth`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|auth|.*\\..*).*)'
  ]
}

