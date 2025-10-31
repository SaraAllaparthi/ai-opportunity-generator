import { Brief } from '@/lib/schema/brief'

export default function CEOActionPlan({ data }: { data: Brief }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <h3 className="mb-1 text-lg font-medium">CEO Action Plan (90 days)</h3>
      <p className="text-sm italic text-gray-400 mb-4">Move fast with discipline: Discover → Pilot → Scale → Measure.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
          <div className="font-medium text-white">Discover</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-300 space-y-1">
            <li>Confirm use-case owners and KPIs</li>
            <li>Data access and governance path</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
          <div className="font-medium text-white">Pilot</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-300 space-y-1">
            <li>Build 1–2 thin-slice pilots</li>
            <li>Define success thresholds</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
          <div className="font-medium text-white">Scale</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-300 space-y-1">
            <li>Harden data + MLOps pipeline</li>
            <li>Rollout by segment/region</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#0A0A0A] p-4">
          <div className="font-medium text-white">Measure</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-300 space-y-1">
            <li>Track value and adoption</li>
            <li>Iterate backlog quarterly</li>
          </ul>
        </div>
      </div>
    </section>
  )
}


