import { Brief } from '@/lib/schema/brief'

// Generate use-case specific action plan
function generateUseCaseActionPlan(data: Brief): {
  discover: string[]
  pilot: string[]
  scale: string[]
  measure: string[]
} {
  const useCases = (data.use_cases || []).slice(0, 3) // Top 3 use cases
  const topUseCase = useCases[0]
  const strategicMoves = (data.strategic_moves || []).slice(0, 2)
  
  // Extract key themes from use cases
  const valueDrivers = useCases.map(uc => uc.value_driver).filter(Boolean)
  const topValueDriver = valueDrivers[0] || 'cost'
  
  // Generate use-case specific actions
  const discover: string[] = [
    `Prioritize "${topUseCase?.title || 'top AI use case'}" as fastest ROI opportunity`,
    'Assign owner and define success KPIs for each use case',
    'Assess data availability and quality for priority use cases'
  ]
  
  const pilot: string[] = [
    `Launch pilot for "${topUseCase?.title || 'top use case'}" within 30 days`,
    `Target ${topUseCase?.payback_months || 12}-month payback on first pilot`,
    'Establish baseline metrics and success thresholds'
  ]
  
  const scale: string[] = [
    `Scale "${topUseCase?.title || 'top use case'}" to full deployment`,
    `Roll out remaining ${useCases.length > 1 ? useCases.length - 1 : 0} use cases by priority`,
    'Build MLOps infrastructure for production deployment'
  ]
  
  const measure: string[] = [
    `Track ${topValueDriver} impact from "${topUseCase?.title || 'top use case'}"`,
    'Monitor ROI against projected benefits',
    'Review and adjust quarterly based on results'
  ]
  
  // Add strategic goals alignment if available
  if (strategicMoves.length > 0) {
    const firstMove = strategicMoves[0]
    discover.push(`Align with strategic goal: ${firstMove.move}`)
    measure.push(`Measure progress toward: ${firstMove.move}`)
  }
  
  return { discover, pilot, scale, measure }
}

export default function CEOActionPlan({ data }: { data: Brief }) {
  const insights = generateUseCaseActionPlan(data)
  
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">CEO Action Plan (90 days)</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Move fast with discipline: Discover → Pilot → Scale → Measure.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Discover</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.discover.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Pilot</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.pilot.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Scale</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.scale.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Measure</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {insights.measure.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}


