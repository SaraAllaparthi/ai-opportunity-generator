import { Brief } from '@/lib/schema/brief'
import { getDomain, confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

export default function MovesCard({ data }: { data: Brief }) {
  const moves = data.strategic_moves
  const confidence = confidenceFromCount(moves.reduce((a,m)=>a+(m.citations?.length||0),0))
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Strategic Moves</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Recent moves signal strategic priorities; leverage them to de-risk sequencing and partnerships.</p>
      {moves.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">No recent moves found. These are estimates pending more data.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {moves.slice(0, 5).map((m, i) => (
            <li key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <div className="font-semibold text-gray-900 dark:text-white">{m.title}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{m.dateISO || '—'} • {m.impact || 'impact TBD'}</div>
              <div className="mt-1 text-xs flex flex-wrap gap-1">
                {m.citations?.slice(0, 3).map((c, j) => (
                  <a key={j} href={c} target="_blank" rel="noreferrer" className="rounded-full border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-gray-700 dark:text-gray-300 underline-offset-2 hover:underline">{getDomain(c)}</a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


