import { Brief } from '@/lib/schema/brief'

export default function CEOActionPlan({ data }: { data: Brief }) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">CEO Action Plan (90 days)</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Move fast with discipline: Discover → Pilot → Scale → Measure.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Discover</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Confirm use-case owners and KPIs</li>
            <li>Data access and governance path</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Pilot</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Build 1–2 thin-slice pilots</li>
            <li>Define success thresholds</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Scale</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Harden data + MLOps pipeline</li>
            <li>Rollout by segment/region</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Measure</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Track value and adoption</li>
            <li>Iterate backlog quarterly</li>
          </ul>
        </div>
      </div>
    </section>
  )
}


