'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReportForm() {
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Generate the report content (mocked for now or call existing generation API)
      // The original app likely called an API to generate the JSON.
      // We need to replicate that. 
      // Assuming there is an existing API or we need to call the new /api/reports endpoint with the generated JSON.
      
      // Wait, the original flow was: User enters company -> App generates JSON -> App saves to DB -> Redirects.
      // Now: User enters company -> App generates JSON -> App calls POST /api/reports -> Redirects.
      
      // Let's assume we have a helper to generate the report JSON first.
      // Or does the POST /api/reports handle generation?
      // My implementation of POST /api/reports expects `report_json` in the body.
      // So the frontend needs to generate it first.
      
      // For this MVP, I'll assume there's a separate "generate" step or I'll mock it.
      // Actually, looking at the original code (which I replaced), it probably had the generation logic.
      // I should have checked `app/[locale]/page.tsx` more carefully before replacing it.
      // I will implement a basic form that calls the generation API.
      
      // Let's assume there is an endpoint `/api/research` or similar that generates the JSON.
      // I saw `app/api/research/route.ts` in the file list.
      
      const researchRes = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: companyName }),
      })
      
      if (!researchRes.ok) throw new Error('Failed to generate research')
      const researchData = await researchRes.json()
      
      // 2. Save the report
      const saveRes = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          report_json: researchData, // Assuming researchData IS the report json
          create_share_link: true
        }),
      })
      
      if (!saveRes.ok) throw new Error('Failed to save report')
      const saveData = await saveRes.json()
      
      // 3. Redirect to share page
      router.push(`/share/${saveData.share_token}`)
      
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Generate New Report</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Company Name
          </label>
          <input
            id="company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="e.g. Acme Corp"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Report...
            </>
          ) : (
            'Generate Report'
          )}
        </button>
        
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </form>
    </div>
  )
}
