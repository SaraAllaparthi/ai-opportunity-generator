import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

export default function IndustryCard({ data }: { data: Brief }) {
  const industry = data.industry
  const confidence = confidenceFromCount((data.citations||[]).length)
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Industry Trends</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Momentum concentrates in 3–5 trendlines; near-term wins by aligning to demand and data readiness.</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{industry.summary}</p>
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
        {industry.trends.slice(0, 5).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}


