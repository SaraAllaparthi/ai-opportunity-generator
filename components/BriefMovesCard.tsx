import { Brief } from '@/lib/schema/brief'
import { getDomain, confidenceFromCount } from '@/lib/utils/citations'

export default function MovesCard({ data }: { data: Brief }) {
  const moves = data.strategic_moves
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Strategic Moves</h3>
        <span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">Confidence {confidenceFromCount(moves.reduce((a,m)=>a+(m.citations?.length||0),0))}</span>
      </div>
      <p className="text-sm italic text-gray-400 mb-3">Recent moves signal strategic priorities; leverage them to de-risk sequencing and partnerships.</p>
      {moves.length === 0 ? (
        <div className="text-sm text-gray-400">No recent moves found. These are estimates pending more data.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {moves.slice(0, 5).map((m, i) => (
            <li key={i} className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
              <div className="font-medium text-white">{m.title}</div>
              <div className="text-xs text-gray-400 mt-1">{m.dateISO || '—'} • {m.impact || 'impact TBD'}</div>
              <div className="mt-1 text-xs flex flex-wrap gap-1">
                {m.citations?.slice(0, 3).map((c, j) => (
                  <a key={j} href={c} target="_blank" rel="noreferrer" className="rounded-full border px-2 py-0.5 underline-offset-2 hover:underline">{getDomain(c)}</a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


