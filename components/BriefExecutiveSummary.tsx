import { Brief } from '@/lib/schema/brief'

function formatCurrencyCHF(n?: number): string {
  if (typeof n !== 'number' || isNaN(n)) return 'Estimate'
  return new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n)
}

function computeUplift(useCases: Brief['use_cases']) {
  const benefits = useCases.map(u => u.est_annual_benefit).filter((v): v is number => typeof v === 'number' && !isNaN(v))
  const sum = benefits.reduce((a, b) => a + b, 0)
  return benefits.length ? sum : undefined
}

function computeWeightedPayback(useCases: Brief['use_cases']) {
  const items = useCases.filter(u => typeof u.est_annual_benefit === 'number' && typeof u.payback_months === 'number')
  const num = items.reduce((acc, u) => acc + (u.est_annual_benefit as number) * (u.payback_months as number), 0)
  const den = items.reduce((acc, u) => acc + (u.est_annual_benefit as number), 0)
  if (!den) return undefined
  return Math.round(num / den)
}

export default function BriefExecutiveSummary({ data }: { data: Brief }) {
  const uplift = computeUplift(data.use_cases)
  const weighted = computeWeightedPayback(data.use_cases)
  const avgComplexity = Math.round((data.use_cases.reduce((a, u) => a + u.complexity, 0) / (data.use_cases.length || 1)) * 10) / 10
  const avgEffort = Math.round((data.use_cases.reduce((a, u) => a + u.effort, 0) / (data.use_cases.length || 1)) * 10) / 10
  const topValueDriver = (() => {
    const counts: Record<string, number> = {}
    for (const u of data.use_cases) counts[u.value_driver] = (counts[u.value_driver] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'value'
  })()

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Executive Summary</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">{data.company.name}</div>
      </div>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        {typeof uplift === 'number' && typeof weighted === 'number'
          ? `${data.company.name} can unlock ~${formatCurrencyCHF(uplift)} annual value with benefit-weighted payback around ${weighted} months; sequence deployments by fastest ROI to compound impact.`
          : `Significant value potential with rapid payback; sequence deployments by fastest ROI to compound impact. (Some figures are estimates pending additional data)`}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-600 dark:text-gray-400 mb-1">Annual uplift</div>
          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{formatCurrencyCHF(uplift)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-600 dark:text-gray-400 mb-1">Weighted payback</div>
          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{typeof weighted === 'number' ? `${weighted} months` : 'Estimate'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-600 dark:text-gray-400 mb-1">Delivery profile</div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">Complexity {avgComplexity}/5</div>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">Effort {avgEffort}/5</div>
          </div>
        </div>
      </div>
      <ul className="mt-6 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
        <li>Focus on {topValueDriver.toLowerCase()} impact across 5 initiatives.</li>
        <li>Sequence deployments by fastest payback to accelerate value.</li>
        <li>Use existing data assets; label estimates where evidence is limited.</li>
      </ul>
    </section>
  )
}


