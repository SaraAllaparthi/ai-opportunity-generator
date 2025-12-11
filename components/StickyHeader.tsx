"use client"
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import ThemeToggle from './ThemeToggle'
import LocaleSwitcher from './LocaleSwitcher'
import type { AppUser } from '@/lib/auth'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import UserMenu from './UserMenu'

interface StickyHeaderProps {
  showLocaleSwitcher?: boolean
  user?: AppUser | null
  onLogout?: () => void
}

export default function StickyHeader({ showLocaleSwitcher = true, user, onLogout }: StickyHeaderProps) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    await supabase.auth.signOut()
    router.refresh()
    // Force hard reload to clear server-side cookies properly
    window.location.href = `/${locale}/login`
  }
  
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={`/${locale}`} className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('title.app')}
        </Link>
        <nav className="flex items-center gap-6">
          {showLocaleSwitcher && <LocaleSwitcher />}
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-4">
              {user.role === 'admin' && (
                <Link
                  href={`/${locale}/admin`}
                  className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  Admin
                </Link>
              )}
              <UserMenu user={user} locale={locale} />
            </div>
          ) : (
            <Link 
              href={`/${locale}/login`} 
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

