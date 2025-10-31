import { Brief } from '@/lib/schema/brief'
import { getDomain, confidenceFromCount } from '@/lib/utils/citations'

export default function CompetitorsCard({ data }: { data: Brief }) {
  const competitors = data.competitors
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Competitors</h3>
        <span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">Confidence {confidenceFromCount(competitors.reduce((a,c)=>a+(c.citations?.length||0),0))}</span>
      </div>
      <p className="text-sm italic text-gray-400 mb-3">Compete on speed and personalization; differentiate where data moats exist.</p>
      {competitors.length === 0 ? (
        <div className="text-sm text-gray-400">No competitors identified. These are estimates pending more data.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {competitors.slice(0, 5).map((c, i) => (
            <li key={i} className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
              <div className="font-medium text-white">{c.name}</div>
              <div className="text-xs text-gray-400 mt-1">{c.positioning || '—'}</div>
              <div className="mt-1 text-xs flex flex-wrap gap-1">
                {c.citations?.slice(0, 3).map((u, j) => (
                  <a key={j} href={u} target="_blank" rel="noreferrer" className="rounded-full border px-2 py-0.5 underline-offset-2 hover:underline">{getDomain(u)}</a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


