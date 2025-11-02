import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

export default function SnapshotCard({ data }: { data: Brief }) {
  const company = data.company
  const confidence = confidenceFromCount((data.citations||[]).length)
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Company Snapshot</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      <div className="text-sm">
        <div className="font-semibold text-gray-900 dark:text-white mb-1">{company.name}</div>
        <a className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors" href={company.website} target="_blank" rel="noreferrer">{company.website}</a>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{company.summary || 'Estimate pending — generated summary based on public information.'}</p>
      </div>
    </div>
  )
}


