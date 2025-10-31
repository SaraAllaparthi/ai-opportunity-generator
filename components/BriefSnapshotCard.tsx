import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount } from '@/lib/utils/citations'

export default function SnapshotCard({ data }: { data: Brief }) {
  const company = data.company
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Company Snapshot</h3>
        <span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">Confidence {confidenceFromCount((data.citations||[]).length)}</span>
      </div>
      <div className="text-sm">
        <div className="font-medium">{company.name}</div>
        <a className="text-gray-400 hover:text-[#0070F3] hover:underline transition-colors" href={company.website} target="_blank" rel="noreferrer">{company.website}</a>
        <p className="mt-2 text-sm text-gray-300">{company.summary || 'Estimate pending — generated summary based on public information.'}</p>
      </div>
    </div>
  )
}


