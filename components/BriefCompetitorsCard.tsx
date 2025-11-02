import { Brief } from '@/lib/schema/brief'
import { getDomain, confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

export default function CompetitorsCard({ data }: { data: Brief }) {
  const competitors = data.competitors
  const confidence = confidenceFromCount(competitors.reduce((a,c)=>a+(c.citations?.length||0),0))
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Competitors</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Compete on speed and personalization; differentiate where data moats exist.</p>
      {competitors.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">No competitors identified. These are estimates pending more data.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {competitors.slice(0, 5).map((c, i) => (
            <li key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <div className="font-semibold text-gray-900 dark:text-white">{c.name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{c.positioning || '—'}</div>
              <div className="mt-1 text-xs flex flex-wrap gap-1">
                {c.citations?.slice(0, 3).map((u, j) => (
                  <a key={j} href={u} target="_blank" rel="noreferrer" className="rounded-full border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-gray-700 dark:text-gray-300 underline-offset-2 hover:underline">{getDomain(u)}</a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


