"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleSwitcher from '@/components/LocaleSwitcher'

const industriesEn = [
  "Accounting & Auditing",
  "Aerospace",
  "Agriculture",
  "Architecture & Engineering",
  "Asset Management",
  "Automotive",
  "Banking",
  "Biotechnology",
  "Chemicals",
  "Construction",
  "Consulting",
  "E-commerce",
  "Education",
  "Energy & Utilities",
  "Financial Services",
  "Food & Beverage",
  "Healthcare",
  "Hotels & Restaurants",
  "Industrial Manufacturing",
  "Insurance",
  "Legal Services",
  "Life Sciences",
  "Logistics",
  "Manufacturing",
  "Marketing & Advertising",
  "Media & Publishing",
  "Medical Devices",
  "Non-profit Organizations",
  "Pharmaceutical Manufacturing",
  "Pharmaceuticals",
  "Precision Engineering",
  "Professional Services",
  "Property Management",
  "Public Administration",
  "Real Estate",
  "Renewable Energy",
  "Research & Development",
  "Retail",
  "Software & IT Services",
  "Supply Chain",
  "Technology",
  "Telecommunications",
  "Textiles & Apparel",
  "Tourism & Hospitality",
  "Training & Development",
  "Transportation",
  "Wholesale Trade"
].sort()

const industriesDe = [
  "Buchhaltung & Wirtschaftsprüfung",
  "Luft- und Raumfahrt",
  "Landwirtschaft",
  "Architektur & Ingenieurwesen",
  "Vermögensverwaltung",
  "Automobilindustrie",
  "Banken",
  "Biotechnologie",
  "Chemie",
  "Bau",
  "Unternehmensberatung",
  "E-Commerce",
  "Bildungswesen",
  "Energie & Versorgung",
  "Finanzdienstleistungen",
  "Lebensmittel & Getränke",
  "Gesundheitswesen",
  "Hotellerie & Gastronomie",
  "Industrielle Fertigung",
  "Versicherungen",
  "Rechtsberatung",
  "Life Sciences",
  "Logistik",
  "Fertigung",
  "Marketing & Werbung",
  "Medien & Verlagswesen",
  "Medizintechnik",
  "Gemeinnützige Organisationen",
  "Pharmazeutische Industrie",
  "Pharma",
  "Präzisionsmechanik",
  "Professionelle Dienstleistungen",
  "Immobilienverwaltung",
  "Öffentliche Verwaltung",
  "Immobilien",
  "Erneuerbare Energien",
  "Forschung & Entwicklung",
  "Einzelhandel",
  "Software & IT-Services",
  "Supply Chain",
  "Technologie",
  "Telekommunikation",
  "Textil & Bekleidung",
  "Tourismus & Hospitality",
  "Weiterbildung",
  "Transport & Logistik",
  "Großhandel"
].sort()

export default function LandingPage() {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  
  // Get industries based on locale
  const industries = locale === 'de' ? industriesDe : industriesEn
  
  // Update router to use locale-aware navigation
  const navigateTo = (path: string) => {
    router.push(`/${locale}${path}`)
  }
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [industry, setIndustry] = useState("")
  const [headquarters, setHeadquarters] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ step: number; message: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Normalize website URL - add https:// if missing
  function normalizeWebsite(url: string): string {
    if (!url) return url
    let normalized = url.trim()
    
    // Remove trailing slashes for consistency
    normalized = normalized.replace(/\/+$/, '')
    
    // Add https:// if no protocol
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }
    
    // Validate it's a proper URL
    try {
      const urlObj = new URL(normalized)
      // Return without trailing slash for consistency
      return urlObj.toString().replace(/\/+$/, '')
    } catch (e) {
      // If URL parsing fails, return as-is (server will catch it)
      return normalized
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setElapsed(0)
    setProgress({ step: 1, message: t('home.form.researching', { company: name || 'your company' }) })
    
    const startTime = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 100)

    const progressInterval = setInterval(() => {
      const currentElapsed = Math.floor((Date.now() - startTime) / 1000)
      setProgress(prev => {
        if (!prev) return prev
        if (prev.step === 1 && currentElapsed >= 10) {
          return { step: 2, message: t('home.form.analyzing') }
        }
        if (prev.step === 2 && currentElapsed >= 30) {
          return { step: 3, message: t('home.form.finalizing') }
        }
        return prev
      })
    }, 1000)

    try {
      // Normalize website URL before sending
      const normalizedWebsite = normalizeWebsite(website)
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          companyName: name, 
          website: normalizedWebsite, 
          industryHint: industry,
          headquartersHint: headquarters,
          locale: locale
        })
      })
      if (!res.ok) {
        let msg = "Failed to start research"
        try {
          const j = await res.json()
          // Show detailed error in development, or user-friendly message in production
          msg = j.details || j.error || msg
          // If there's a stack trace in development, append it
          if (j.stack && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            msg = `${msg}\n\n${j.stack}`
          }
        } catch {}
        throw new Error(msg)
      }
      const data = await res.json()
      clearInterval(interval)
      clearInterval(progressInterval)
      
      // Get the slug from either shareSlug or reportId (for backwards compatibility)
      const slug = data.shareSlug || data.reportId
      if (!slug) {
        throw new Error('No report ID received from server')
      }
      
      console.log('[Frontend] Received share slug:', slug)
      
      setProgress({ step: 3, message: '✅ Ready to view insights.' })
      
      // Longer delay to ensure database write is complete and visible, then navigate
      setTimeout(() => {
        console.log('[Frontend] Navigating to share page:', `/share/${slug}`)
        // Use Next.js router for client-side navigation (preserves state, no full page reload)
        router.push(`/${locale}/share/${slug}`)
        // Force a scroll to top in case the page was scrolled
        window.scrollTo(0, 0)
      }, 2000) // Increased from 1000ms to 2000ms to ensure database is ready
    } catch (err: any) {
      clearInterval(interval)
      clearInterval(progressInterval)
      // Handle different types of errors
      if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        setError("Network error: Could not connect to server. Please check your connection and try again.")
      } else if (err?.name === 'AbortError') {
        setError("Request timed out. The research process may take a while. Please try again.")
      } else {
        setError(err?.message || "Something went wrong. Please try again.")
      }
      console.error('[LandingPage] Error submitting form:', err)
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="relative z-10">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{t('title.app')}</div>
          <nav className="flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{t('nav.features')}</a>
            <a href="#how-it-works" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{t('nav.howItWorks')}</a>
            <LocaleSwitcher />
            <ThemeToggle />
            <button className="text-sm font-medium text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{t('nav.signIn')}</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-6 pt-12 pb-4 relative">
        {/* Decorative visual element */}
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="text-center mb-12 relative z-10">
          {/* Banner */}
          <div className="mb-8">
            <a 
              href="https://www.maverickaigroup.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block px-4 py-1.5 rounded-full border border-blue-600 dark:border-blue-400 bg-transparent text-sm font-medium text-blue-600 dark:text-white hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
            >
              Built by Maverick AI Group
            </a>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
            {locale === 'de' ? (
              <>
                Entdecken Sie, wie <span className="text-blue-600 dark:text-blue-400">KI</span> Ihr Unternehmen wachsen lassen kann
              </>
            ) : (
              <>
                Discover How <span className="text-blue-600 dark:text-blue-400">AI</span> Can <span className="text-blue-600 dark:text-blue-400">Grow Your Business</span>
              </>
            )}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('home.hero.subtitle')}
          </p>
          <p className="text-lg md:text-lg text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto leading-relaxed italic">
            {t('home.hero.text1')}
          </p>
          <button
            onClick={() => {
              const formSection = document.getElementById('generator-form')
              formSection?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-6 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg mb-6"
          >
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('home.hero.button')}
          </button>
          
          {/* Stats Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">8</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{t('home.features.section1.title')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">&lt; 90 s</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{t('home.features.section2.title')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">5</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{t('home.features.section3.title')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="bg-gray-50 dark:bg-gray-900/50 pt-12 pb-4">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col gap-6">
            {/* The Problem Card */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
              <h4 className="text-4xl font-semibold mb-3">
                {(() => {
                  const title = t('home.problemSolution.problem.title')
                  const words = title.split(' ')
                  if (words.length === 1) {
                    return <span className="text-blue-600 dark:text-blue-400">{title}</span>
                  }
                  return (
                    <>
                      <span className="text-gray-900 dark:text-white">{words[0]} </span>
                      <span className="text-blue-600 dark:text-blue-400">{words.slice(1).join(' ')}</span>
                    </>
                  )
                })()}
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {t('home.problemSolution.problem.text1')}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {t('home.problemSolution.problem.text2')}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('home.problemSolution.problem.text3')}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                {t('home.problemSolution.problem.text4')}
              </p>
            </div>
            
            {/* The Solution Card */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
              <h4 className="text-4xl font-semibold mb-3">
                {(() => {
                  const title = t('home.problemSolution.solution.title')
                  const words = title.split(' ')
                  if (words.length === 1) {
                    return <span className="text-blue-600 dark:text-blue-400">{title}</span>
                  }
                  return (
                    <>
                      <span className="text-gray-900 dark:text-white">{words[0]} </span>
                      <span className="text-blue-600 dark:text-blue-400">{words.slice(1).join(' ')}</span>
                    </>
                  )
                })()}
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                <span className="text-blue-600 font-bold dark:text-blue-400">{t('home.problemSolution.solution.text0')}</span>
                {t('home.problemSolution.solution.text1')}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {t('home.problemSolution.solution.text2')}
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {t('home.problemSolution.solution.text3')}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
              {(() => {
                  const title = t('home.problemSolution.solution.text4')
                  const words = title.split('?')
                  if (words.length === 1) {
                    return <span className="text-blue-600 dark:text-blue-400">{title}</span>
                  }
                  return (
                    <>
                      <span className="text-gray-900 font-bold dark:text-blue-400">{words[0]}? </span>
                      <span className="text-blue-600 dark:text-white">{words.slice(1).join(' ')}</span>
                    </>
                  )
                })()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Button Section */}
      <section className="bg-gray-50 dark:bg-gray-900/50 pt-4 pb-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex justify-center">
            <button
              onClick={() => {
                const formSection = document.getElementById('generator-form')
                formSection?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-6 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('home.problemSolution.solution.button')}
            </button>
          </div>
        </div>
      </section>

      {/* What's Inside Your Report Section */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
            <h4 className="text-4xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
              {t('home.whatsInsideReport.title')}
            </h4>
            <ul className="space-y-4 mb-6">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">{t('home.whatsInsideReport.item1.title')}</strong> — {t('home.whatsInsideReport.item1.description')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">{t('home.whatsInsideReport.item2.title')}</strong> — {t('home.whatsInsideReport.item2.description')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">{t('home.whatsInsideReport.item3.title')}</strong> — {t('home.whatsInsideReport.item3.description')}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">{t('home.whatsInsideReport.item4.title')}</strong> — {t('home.whatsInsideReport.item4.description')}
                </span>
              </li>
            </ul>
            <p className="text-left text-gray-600 dark:text-gray-300 text-lg italic">
              {t('home.whatsInsideReport.closing')}
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gray-50 dark:bg-gray-900/50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('home.howItWorks.title')}</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">{t('home.howItWorks.subtitle')}</p>
            </div>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg">1</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.howItWorks.step1.title')}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t('home.howItWorks.step1.description')}</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg">2</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.howItWorks.step2.title')}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t('home.howItWorks.step2.description')}</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg">3</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.howItWorks.step3.title')}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t('home.howItWorks.step3.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div id="generator-form" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-xl">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl font-semibold text-gray-900 dark:text-white mb-2 text-center">{t('home.form.title')}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">{t('home.form.subtitle')}</p>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">{t('home.form.companyName')}</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-sm placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                  placeholder="e.g., Acme Corporation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">{t('home.form.website')}</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-sm placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">{t('home.form.industry')}</label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                >
                  <option value="">Select an industry...</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-2">{t('home.form.headquarters')}</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-sm placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                  placeholder="e.g., Zurich, Switzerland"
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  required
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                We&apos;ll analyze public data from this website to generate your comprehensive AI opportunity report.
              </p>
              <button
                className="group w-full h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex"
                disabled={loading}
                type="submit"
              >
                {loading ? (
                  <div className="w-full">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('home.form.generating')}</span>
                    </div>
                    {progress && (
                      <div className="w-full space-y-2">
                        <div className="text-xs text-white/90 text-center">
                          {progress.message} — Step {progress.step} of 3
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-1.5">
                          <div 
                            className="bg-white h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(90, (progress.step / 3) * 100)}%` }}
                          ></div>
                        </div>
                        {elapsed > 0 && (
                          <div className="text-xs text-white/70 text-center">
                            {elapsed}s / ~90s
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {t('home.hero.button')}
                  </>
                )}
              </button>
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">{error}</div>
              )}
            </form>
          </div>
          </div>
        </div>
      </section>

      {/* Why Leaders Choose Maverick Lens Section */}
      <section id="features" className="bg-gray-50 dark:bg-gray-900/50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('home.whyLeadersChoose.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.whyLeadersChoose.section1.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('home.whyLeadersChoose.section1.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.whyLeadersChoose.section2.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('home.whyLeadersChoose.section2.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.whyLeadersChoose.section3.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('home.whyLeadersChoose.section3.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('home.whyLeadersChoose.section4.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('home.whyLeadersChoose.section4.description')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('home.cta.title')}</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">{t('home.cta.subtitle')}</p>
            </div>
            <div className="max-w-2xl mx-auto">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 font-medium">
                {t('home.cta.text1')}
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-300">{t('home.cta.listitem1')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-300">{t('home.cta.listtem2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-300">{t('home.cta.listitem3')}</span>
                </li>
              </ul>
              <div className="flex justify-center">
                <a
                  href="mailto:contact@maverickaigroup.ai"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-6 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
                >
                  {t('home.cta.button')}
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built by Maverick AI Group Section */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                {t('builtBy.title')}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                {t('builtBy.text1')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('footer.builtInSwitzerland')}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('footer.copyright')}</div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  )
}


