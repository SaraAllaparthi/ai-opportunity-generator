import { Brief } from '@/lib/schema/brief'

const getLevelColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'high':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
    case 'medium':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
    case 'low':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
  }
}

const items = [
  { name: 'Data', level: 'Medium' },
  { name: 'Leadership', level: 'Medium' },
  { name: 'Technical', level: 'Medium' },
  { name: 'Risk', level: 'Medium' },
  { name: 'Compliance', level: 'Medium' }
]

export default function FeasibilityScan({ _data }: { _data: Brief }) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Feasibility Scan</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Readiness across domains is adequate to proceed with targeted pilots.</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((i) => (
          <div key={i.name} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{i.name}</span>
            </div>
            <div className={`rounded-full border px-2.5 py-1 text-xs font-medium text-center ${getLevelColor(i.level)}`}>
              {i.level}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}


