'use client'

import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const initializeTheme = () => {
      try {
        const theme = localStorage.getItem('theme')
        const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        
        const el = document.documentElement
        if (isDark) {
          el.classList.add('dark')
        } else {
          el.classList.remove('dark')
        }
      } catch (e) {
        // Silently fail if localStorage is not available
      }
    }
    
    // Initialize immediately on client mount
    initializeTheme()
    
    // Listen for system theme changes (only if no manual preference)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const el = document.documentElement
        if (e.matches) {
          el.classList.add('dark')
        } else {
          el.classList.remove('dark')
        }
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Always render children immediately
  return <>{children}</>
}

