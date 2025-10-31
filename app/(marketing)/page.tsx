"use client"
import { useState } from 'react'

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
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="text-sm font-medium tracking-wider">MAVERICK LENS</div>
          <div className="flex items-center gap-4">
            <button className="text-sm text-gray-400 hover:text-white transition-colors">EN</button>
            <span className="text-gray-600">|</span>
            <button className="text-sm text-gray-400 hover:text-white transition-colors">DEFR</button>
            <button className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-[850px] px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-medium mb-4">AI Executive Intelligence Generator</h1>
          <p className="text-xl text-gray-400 mb-8">
            Multi-agent AI system that transforms company data into comprehensive executive intelligence reports with quantified ROI projections.
          </p>
          <button
            onClick={() => {
              const formSection = document.getElementById('generator-form')
              formSection?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#0070F3] to-blue-600 px-8 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
          >
            Generate AI Insights
          </button>
          <p className="mt-4 text-sm text-gray-500">Takes less than 60 seconds to analyze.</p>
        </div>

        {/* Form Section */}
        <div id="generator-form" className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg mb-16">
          <h2 className="text-sm font-medium text-gray-400 mb-1">Enter your company name and website address to start</h2>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Company Name</label>
              <input
                className="w-full rounded-lg border border-gray-800 bg-[#0A0A0A] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#0070F3] transition-colors"
                placeholder="Enter company name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Website</label>
              <input
                className="w-full rounded-lg border border-gray-800 bg-[#0A0A0A] px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#0070F3] transition-colors"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-gray-500">
              Maverick Lens will analyze public data from this website to generate your AI report.
            </p>
            <button
              className="w-full h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#0070F3] to-blue-600 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? "Generating..." : "Generate AI Insights"}
            </button>
            {error && (
              <div className="text-sm text-red-400 mt-2">{error}</div>
            )}
          </form>
        </div>

        {/* Built by footer */}
        <div className="text-center mb-16">
          <p className="text-sm text-gray-400 mb-6">Built by Maverick AI Group</p>
          <p className="text-xs text-gray-500 mb-4">Powered by industry-leading AI and infrastructure</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <span className="text-xs text-gray-500">Built on</span>
            <span className="text-xs text-gray-400">Anthropic</span>
            <span className="text-gray-600">•</span>
            <span className="text-xs text-gray-400">Perplexity</span>
            <span className="text-gray-600">•</span>
            <span className="text-xs text-gray-400">Supabase</span>
            <span className="text-gray-600">•</span>
            <span className="text-xs text-gray-400">Vercel</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-[850px] px-6 py-20 border-t border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Multi-Agent AI System</h3>
            <p className="text-sm text-gray-400">Tavily research + OpenAI analysis for comprehensive intelligence</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">90-Second Generation</h3>
            <p className="text-sm text-gray-400">Lightning-fast report generation with parallel processing</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Executive Intelligence</h3>
            <p className="text-sm text-gray-400">8 comprehensive sections including competitive benchmarking and ROI projections</p>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="mx-auto max-w-[850px] px-6 py-20 border-t border-gray-800">
        <h2 className="text-3xl font-medium mb-4 text-center">Your AI Report Preview</h2>
        <p className="text-center text-gray-400 mb-12">Get a comprehensive analysis of AI opportunities tailored specifically to your company</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Executive Summary Preview */}
          <div className="rounded-2xl border border-gray-800 bg-[#121212] p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Executive Summary</h3>
            <p className="text-xs text-gray-500 mb-3">Strategic overview with quantified AI opportunities</p>
            <div className="flex gap-4">
              <div>
                <div className="text-2xl font-semibold text-[#0070F3] mb-1">CHF 2.5M</div>
                <div className="text-xs text-gray-400">ROI</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[#0070F3] mb-1">12</div>
                <div className="text-xs text-gray-400">months</div>
              </div>
            </div>
          </div>

          {/* AI Opportunity Landscape Preview */}
          <div className="rounded-2xl border border-gray-800 bg-[#121212] p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">AI Opportunity Landscape</h3>
            <p className="text-xs text-gray-500 mb-3">4-5 specific use cases with feasibility scores</p>
            <div className="flex gap-2">
              <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-green-400">High</span>
              <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-amber-400">Medium</span>
              <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-400">Low</span>
            </div>
          </div>

          {/* CEO Action Plan Preview */}
          <div className="rounded-2xl border border-gray-800 bg-[#121212] p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">CEO Action Plan</h3>
            <p className="text-xs text-gray-500 mb-3">90-day roadmap with specific milestones</p>
            <div className="flex gap-4">
              <div>
                <div className="text-2xl font-semibold text-[#0070F3] mb-1">4</div>
                <div className="text-xs text-gray-400">steps</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-gray-400 mb-1">—</div>
                <div className="text-xs text-gray-400">Assessment needed</div>
              </div>
            </div>
          </div>

          {/* Feasibility Scan Preview */}
          <div className="rounded-2xl border border-gray-800 bg-[#121212] p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Feasibility Scan</h3>
            <p className="text-xs text-gray-500 mb-3">Readiness assessment across 5 dimensions</p>
            <div className="flex gap-2 flex-wrap">
              <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-400">Data</span>
              <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-400">Leadership</span>
              <span className="rounded-full border border-gray-800 px-3 py-1 text-xs text-gray-400">Technical</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="mx-auto max-w-[850px] px-6 py-20 border-t border-gray-800">
        <div className="text-center">
          <h2 className="text-3xl font-medium mb-4">See your AI opportunities in minutes</h2>
          <p className="text-gray-400 mb-8">Get started with a comprehensive AI strategy report tailored to your company&apos;s unique situation and market position.</p>
          <button
            onClick={() => {
              const formSection = document.getElementById('generator-form')
              formSection?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#0070F3] to-blue-600 px-8 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
          >
            Generate AI Insights
          </button>
        </div>
      </section>
    </div>
  )
}


