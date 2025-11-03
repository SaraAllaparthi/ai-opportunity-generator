"use client"
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function LandingPage() {
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website })
      })
      if (!res.ok) {
        let msg = "Failed to start research"
        try {
          const j = await res.json()
          msg = j.details || j.error || msg
        } catch {}
        throw new Error(msg)
      }
      const data = await res.json()
      window.location.href = `/share/${data.shareSlug}`
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.")
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
          <div className="text-lg font-semibold text-gray-900 dark:text-white">Maverick Lens</div>
          <nav className="flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">How it works</a>
            <ThemeToggle />
            <button className="text-sm font-medium text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Sign In</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-6 py-12 relative">
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
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Reveal Hidden <span className="text-blue-600 dark:text-blue-400">AI Opportunities</span> Instantly
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Seamlessly analyze your company&apos;s public data to discover the most valuable AI use cases, quantify ROI and get an executive ready strategy brief in under 90 seconds.
          </p>
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
            Generate AI Insights
          </button>
          
          {/* Stats Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">8</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Strategic Sections</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">&lt; 90 s</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Report Generation</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">5</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">ROI-Ranked AI Use Cases</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 md:p-10 shadow-lg">
            <div className="space-y-8">
              {/* The Problem */}
              <div>
                <h4 className="text-4xl font-semibold mb-3">
                  <span className="text-gray-900 dark:text-white">Business </span>
                  <span className="text-blue-600 dark:text-blue-400">Problem</span>
                </h4>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  CEOs know AI has potential — but not where to start.
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  Most organizations waste months on vague &quot;AI readiness&quot; discussions without a clear ROI case.
                </p>
              </div>
              
              {/* The Solution */}
              <div>
                <h4 className="text-4xl font-semibold mb-3">
                  <span className="text-gray-900 dark:text-white">Our </span>
                  <span className="text-blue-600 dark:text-blue-400">Solution</span>
                </h4>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Maverick Lens uses multi-agent AI research to scan your company&apos;s public footprint, benchmark against competitors, and identify the fastest-payback AI initiatives.
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  The result: a quantified, McKinsey-style AI Opportunity Brief tailored to your business.
                </p>
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
            <h2 className="text-4xl font-semibold text-gray-900 dark:text-white mb-2 text-center">Generate Your <span className="text-blue-600 dark:text-blue-400">AI Report</span></h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 text-center">Enter your company information to get started</p>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="text-xl block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                  placeholder="e.g., Acme Corporation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xl block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Website URL</label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
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
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Report...
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate AI Insights
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

      {/* Features Section */}
      <section id="features" className="bg-gray-50 dark:bg-gray-900/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Everything you need</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Powerful features to help you understand your AI opportunities</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Seamless Integration</h3>
              <p className="text-gray-600 dark:text-gray-300">Connects instantly with your public website or company profile — no data upload required.</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Executive Analysis in Minutes</h3>
              <p className="text-gray-600 dark:text-gray-300">Generates a concise, board-ready intelligence report with ROI, feasibility, and a 90-day action plan.</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Quantified Impact</h3>
              <p className="text-gray-600 dark:text-gray-300">Each use case includes projected benefit, cost, payback, and confidence level — all visualized.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">How it works</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">Get your comprehensive AI opportunity report in three simple steps</p>
          </div>
          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg">1</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Enter Company Details</h3>
                <p className="text-gray-600 dark:text-gray-300">Provide your company name and website URL. We&apos;ll use this to gather public information.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg">2</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">AI Analysis</h3>
                <p className="text-gray-600 dark:text-gray-300">Our multi-agent AI system researches your company and analyzes opportunities using advanced LLM technology.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg">3</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Get Your Report</h3>
                <p className="text-gray-600 dark:text-gray-300">Receive a comprehensive report with AI opportunities, ROI projections, competitive analysis, and actionable insights.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Let&apos;s Design <span className="text-blue-600 dark:text-blue-400">Your AI Roadmap</span> Together</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">Work directly with our strategy team to map your company&apos;s fastest-ROI AI initiatives, identify data gaps, and define your 90-day execution plan..</p>
            <a
              href="mailto:contact@maverickaigroup.ai"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-6 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
            >
              Book Strategic Session
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">© 2025 Maverick Lens | Built by Maverick AI Group | All rights reserved.</div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  )
}


