'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AuthHandler() {
  const router = useRouter()
  const [processed, setProcessed] = useState(false)

  useEffect(() => {
    if (processed) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = document.cookie
              .split('; ')
              .find(row => row.startsWith(`${name}=`))
            return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
          },
          set(name: string, value: string, options: any) {
            document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${options.maxAge || 31536000}; SameSite=Lax`
          },
          remove(name: string, options: any) {
            document.cookie = `${name}=; path=/; max-age=0`
          },
        },
      }
    )

    // Handle auth tokens in URL hash
    const hash = window.location.hash.substring(1)
    if (!hash) return

    const hashParams = new URLSearchParams(hash)
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const type = hashParams.get('type')

    console.log('AuthHandler - Found tokens in URL:', { 
      hasAccessToken: !!accessToken, 
      hasRefreshToken: !!refreshToken,
      type 
    })

    if (accessToken && refreshToken) {
      setProcessed(true)
      console.log('AuthHandler - Setting session...')
      
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ data, error }) => {
        if (error) {
          console.error('AuthHandler - Error setting session:', error)
        } else {
          console.log('AuthHandler - Session set successfully!', data)
          // Clear the hash
          window.history.replaceState(null, '', window.location.pathname)
          // Force a hard reload to refresh server-side data
          window.location.reload()
        }
      })
    }
  }, [processed, router])

  return null
}
