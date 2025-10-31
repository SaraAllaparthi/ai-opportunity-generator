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
    <main className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">AI Opportunity Brief</h1>
        <ThemeToggle />
      </header>
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium">Generate a brief</h2>
        <p className="mb-4 text-sm text-muted-foreground">Enter a company and website. We’ll research with citations and propose 5 AI use cases.</p>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring"
            placeholder="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring"
            placeholder="Website (https://...)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            required
          />
          <button
            className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "Researching..." : "Generate Brief"}
          </button>
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </form>
      </section>
    </main>
  )
}


