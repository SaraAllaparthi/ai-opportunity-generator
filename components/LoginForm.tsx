'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations, useLocale } from 'next-intl'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Try login first (most common case for existing users)
    console.log('Attempting login with email:', email)
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      // If login fails because user doesn't exist, try signup
      if (loginError.message.includes('Invalid login credentials')) {
        console.log('Login failed, attempting signup...')
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
            data: {
              email: email
            }
          },
        })

        if (signupError) {
          setMessage(t('login.error', { message: signupError.message }))
          console.error('Signup error:', signupError)
        } else {
          // Check if email confirmation is required
          if (signupData.user && !signupData.session) {
            console.warn('User created but no session - email confirmation required')
            setMessage(t('login.checkEmail'))
          } else if (signupData.session) {
            console.log('User created with session, redirecting...')
            setMessage(t('login.accountCreated'))
            setTimeout(() => {
              window.location.href = `/${locale}`
            }, 1000)
          } else {
            console.error('Unexpected signup state:', signupData)
            setMessage('Signup completed but something went wrong. Please try logging in.')
          }
        }
      } else {
        // Other login errors (wrong password, etc.)
        setMessage(t('login.error', { message: loginError.message }))
        console.error('Login error:', loginError)
      }
    } else {
      // Login successful
      console.log('Login successful! Session:', loginData.session)
      console.log('User:', loginData.user)
      
      // Verify session was set
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Verified session after login:', session)
      
      if (session) {
        setMessage(t('login.loggedInRedirecting'))
        // Use window.location for hard reload to ensure cookies are sent to server
        setTimeout(() => {
          window.location.href = `/${locale}`
        }, 1000)
      } else {
        setMessage('Login succeeded but session not set. Please try again.')
        console.error('Session not set after successful login!')
      }
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('login.email')}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('login.password')}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          required
          minLength={6}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('login.passwordHint')}
        </p>
      </div>

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        {t('login.submit')}
      </button>

      {message && (
        <p className={`text-sm text-center ${message.includes('Error') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {message}
        </p>
      )}
    </form>
  )
}
