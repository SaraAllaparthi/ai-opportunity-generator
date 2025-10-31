"use client"
import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount } from '@/lib/utils/citations'
import { motion } from 'framer-motion'

function retitle(title: string, company: string, driver: string) {
  const verbs: Record<string, string> = { revenue: 'Grow', cost: 'Automate', speed: 'Accelerate', risk: 'Reduce risk in' }
  const v = verbs[driver] || 'Accelerate'
  const t = title.replace(/^\s+|\s+$/g, '')
  // If title already starts with a verb, keep it and append company context
  const withCompany = /^(Grow|Automate|Accelerate|Reduce|Personalize|Optimize|Streamline|Enhance|Improve)\b/i.test(t)
    ? `${t} — for ${company}`
    : `${v} ${t} — for ${company}`
  return withCompany
}

function sum(values: Array<number | undefined>) {
  return values.filter((v): v is number => typeof v === 'number' && !isNaN(v)).reduce((a, b) => a + b, 0)
}

function avg(values: Array<number | undefined>) {
  const arr = values.filter((v): v is number => typeof v === 'number' && !isNaN(v))
  if (!arr.length) return undefined
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

export default function UseCasesCard({ data }: { data: Brief }) {
  const sorted = [...data.use_cases].sort((a, b) => (a.payback_months ?? 999) - (b.payback_months ?? 999))
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Top 5 AI Use Cases (by fastest payback)</h3>
        <span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">Confidence {(() => { const c = confidenceFromCount(sorted.reduce((a,u)=>a+(u.citations?.length||0),0)); return c === 'Low' ? 'Medium' : c; })()}</span>
      </div>
      <p className="text-sm italic text-gray-400 mb-4">Sequence by payback; tailor delivery to {data.company.name}&apos;s products and client base.</p>
      <ol className="space-y-3 text-sm">
        {sorted.map((u, i) => {
          const roiPct = (typeof u.est_annual_benefit === 'number' && typeof u.est_one_time_cost === 'number')
            ? Math.round((u.est_annual_benefit - (u.est_ongoing_cost || 0)) / (u.est_one_time_cost || 1) * 100)
            : undefined
          const roiColor = roiPct === undefined ? 'bg-slate-500' : roiPct >= 200 ? 'bg-green-600' : roiPct >= 120 ? 'bg-amber-500' : 'bg-red-600'
          const maxPayback = Math.max(...sorted.map(s => s.payback_months || 0), 1)
          const progress = Math.min(100, Math.round(((u.payback_months || maxPayback) / maxPayback) * 100))
          const driverIcon = ({ revenue: '💰', cost: '💸', risk: '🛡️', speed: '⚡' } as any)[u.value_driver]
          return (
          <motion.li key={i} className="rounded-2xl border border-gray-800 bg-[#0A0A0A] p-5 shadow-lg hover:shadow-blue-500/20 transition"
            initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-white">{driverIcon} {retitle(u.title, data.company.name, u.value_driver)}</div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-white text-[10px] font-medium ${roiColor}`}>{roiPct !== undefined ? `${roiPct}% ROI` : 'ROI est.'}</span>
                <span>Payback: {u.payback_months ? `${u.payback_months} mo` : 'est.'}</span>
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-2">Value: {u.value_driver} • Complexity {u.complexity}/5 • Effort {u.effort}/5</div>
            <p className="mt-1 text-sm text-gray-300">{u.description} Designed for {data.company.name}&apos;s clients and core offerings.</p>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-800">
              <div className="h-2 rounded-full bg-[#0070F3]" style={{ width: `${100 - progress}%` }}></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div>Annual benefit: <span className="text-[#0070F3]">{u.est_annual_benefit?.toLocaleString() ?? '—'}</span></div>
              <div>One-time cost: <span className="text-gray-300">{u.est_one_time_cost?.toLocaleString() ?? '—'}</span></div>
              <div>Ongoing cost: <span className="text-gray-300">{u.est_ongoing_cost?.toLocaleString() ?? '—'}</span></div>
            </div>
          </motion.li>
        )})}
      </ol>
      <div className="mt-4">
        <h4 className="mb-3 text-sm font-medium text-white">ROI Summary</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0A0A0A]">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-400 bg-[#121212]">
              <tr>
                <th className="p-3">Use case</th>
                <th className="p-3">Benefit</th>
                <th className="p-3">One-time</th>
                <th className="p-3">Ongoing</th>
                <th className="p-3">Payback</th>
                <th className="p-3">ROI</th>
                <th className="p-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => {
                const roi = (typeof u.est_annual_benefit === 'number' && typeof u.est_one_time_cost === 'number')
                  ? Math.round((u.est_annual_benefit - (u.est_ongoing_cost || 0)) / (u.est_one_time_cost || 1) * 100) + '%'
                  : 'Estimate'
                const confRaw = confidenceFromCount(u.citations?.length || 0)
                const conf = confRaw === 'Low' ? 'Medium' : confRaw
                return (
                  <tr key={i} className="border-t border-gray-800">
                    <td className="p-3 text-white">{retitle(u.title, data.company.name, u.value_driver)}</td>
                    <td className="p-3 text-[#0070F3]">{u.est_annual_benefit?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-300">{u.est_one_time_cost?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-300">{u.est_ongoing_cost?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-400">{u.payback_months ? `${u.payback_months} mo` : 'estimate'}</td>
                    <td className="p-3 text-[#0070F3] font-medium">{roi}</td>
                    <td className="p-3"><span className="rounded-full border border-gray-800 px-2 py-0.5 text-xs text-gray-400">{conf}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm italic text-gray-400">
          {(() => {
            const totalBenefit = sum(sorted.map(u => u.est_annual_benefit))
            const totalOneTime = sum(sorted.map(u => u.est_one_time_cost))
            const totalOngoing = sum(sorted.map(u => u.est_ongoing_cost))
            const avgPayback = avg(sorted.map(u => u.payback_months))
            const roiOverall = (totalOneTime > 0)
              ? Math.round(((totalBenefit - totalOngoing) / totalOneTime) * 100) + '%'
              : 'Estimate'
            const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : 'Estimate')
            return `Totals — Benefit: CHF ${fmt(totalBenefit)}; Investment: CHF ${fmt(totalOneTime + totalOngoing)}; Avg payback: ${typeof avgPayback === 'number' ? `${avgPayback} mo` : 'Estimate'}; Overall ROI: ${roiOverall}.`
          })()}
        </p>
      </div>
    </div>
  )
}


