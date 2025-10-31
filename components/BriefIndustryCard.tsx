import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount } from '@/lib/utils/citations'

export default function IndustryCard({ data }: { data: Brief }) {
  const industry = data.industry
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Industry Trends</h3>
        <span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">Confidence {confidenceFromCount((data.citations||[]).length)}</span>
      </div>
      <p className="text-sm italic text-gray-400 mb-3">Momentum concentrates in 3–5 trendlines; near-term wins by aligning to demand and data readiness.</p>
      <p className="text-sm text-gray-300 mb-4">{industry.summary}</p>
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-300 space-y-1">
        {industry.trends.slice(0, 5).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}


