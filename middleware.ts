import createMiddleware from 'next-intl/middleware'
import { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true
})

export default function middleware(request: NextRequest) {
  // Handle root path redirect to default locale
  if (request.nextUrl.pathname === '/') {
    const locale = request.cookies.get('NEXT_LOCALE')?.value || 
                   request.headers.get('accept-language')?.split(',')[0]?.split('-')[0] || 
                   'en'
    const validLocale = ['en', 'de'].includes(locale) ? locale : 'en'
    return intlMiddleware(request)
  }
  
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
}

