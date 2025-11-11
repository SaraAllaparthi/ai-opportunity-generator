"use client"
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import ThemeToggle from './ThemeToggle'
import LocaleSwitcher from './LocaleSwitcher'

interface StickyHeaderProps {
  showLocaleSwitcher?: boolean
}

export default function StickyHeader({ showLocaleSwitcher = true }: StickyHeaderProps) {
  const t = useTranslations()
  const locale = useLocale()
  
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={`/${locale}`} className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('title.app')}
        </Link>
        <nav className="flex items-center gap-6">
          {showLocaleSwitcher && <LocaleSwitcher />}
          <ThemeToggle />
          <Link href={`/${locale}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {t('nav.back')}
          </Link>
        </nav>
      </div>
    </header>
  )
}

