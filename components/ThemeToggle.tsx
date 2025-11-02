"use client"
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setMounted(true)
    const pref = localStorage.getItem('theme')
    const isDark = pref ? pref === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    toggle(isDark)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function toggle(next: boolean) {
    setDark(next)
    if (typeof document !== 'undefined') {
      const el = document.documentElement
      if (next) el.classList.add('dark')
      else el.classList.remove('dark')
      localStorage.setItem('theme', next ? 'dark' : 'light')
    }
  }
  if (!mounted) return null
  return (
    <button
      onClick={() => toggle(!dark)}
      className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  )
}


