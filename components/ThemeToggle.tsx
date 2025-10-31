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
      className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs"
      aria-label="Toggle theme"
    >
      {dark ? 'Dark' : 'Light'}
    </button>
  )
}


