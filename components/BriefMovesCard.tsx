import { Brief } from '@/lib/schema/brief'

export default function MovesCard({ data }: { data: Brief }) {
  const moves = data.strategic_moves
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Strategic Moves</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Concrete actions to drive AI transformation; sequenced by delivery horizon.</p>
      {moves.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">No strategic moves identified. Generate a new brief to see action plans.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {moves.slice(0, 5).map((m, i) => (
            <li key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <div className="font-semibold text-gray-900 dark:text-white">{m.move}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Owner: {m.owner} • Horizon: {m.horizon_quarters} quarter{m.horizon_quarters > 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">{m.rationale}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
