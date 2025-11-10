"use client"
import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'
import { motion } from 'framer-motion'

function retitle(title: string, company: string, driver: string) {
  const t = title.replace(/^\s+|\s+$/g, '')
  // Return title as-is without company name or emoji
  return t
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
  const confidenceRaw = confidenceFromCount(sorted.reduce((a,u)=>a+(u.citations?.length||0),0))
  const confidence = confidenceRaw === 'Low' ? 'Medium' : confidenceRaw
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top 5 AI Use Cases for {data.company.name}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Prioritised by ROI</p>
      <ol className="space-y-3 text-sm">
        {sorted.map((u, i) => {
          // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
          const investment = (u.est_one_time_cost || 0) + (u.est_ongoing_cost || 0)
          const roiPct = (typeof u.est_annual_benefit === 'number' && investment > 0)
            ? Math.round(((u.est_annual_benefit - investment) / investment) * 100)
            : undefined
          const roiColor = roiPct === undefined ? 'bg-slate-500' : roiPct >= 200 ? 'bg-green-600' : roiPct >= 120 ? 'bg-amber-500' : 'bg-red-600'
          const maxPayback = Math.max(...sorted.map(s => s.payback_months || 0), 1)
          const progress = Math.min(100, Math.round(((u.payback_months || maxPayback) / maxPayback) * 100))
          return (
          <motion.li 
            key={i} 
            className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5 shadow-lg hover:shadow-blue-500/20 transition"
            initial={{ opacity: 0, y: 8 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-900 dark:text-white">{retitle(u.title, data.company.name, u.value_driver)}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-white text-[10px] font-medium ${roiColor}`}>{roiPct !== undefined ? `${roiPct}% ROI` : 'ROI est.'}</span>
                <span>Payback: {u.payback_months ? `${u.payback_months} mo` : 'est.'}</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Value: {u.value_driver} • Complexity {u.complexity}/5 • Effort {u.effort}/5</div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{u.description}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${100 - progress}%` }}></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div>Annual benefit: <span className="text-blue-600 dark:text-blue-400 font-medium">{u.est_annual_benefit?.toLocaleString() ?? '—'}</span></div>
              <div>One-time cost: <span className="text-gray-700 dark:text-gray-300">{u.est_one_time_cost?.toLocaleString() ?? '—'}</span></div>
              <div>Ongoing cost: <span className="text-gray-700 dark:text-gray-300">{u.est_ongoing_cost?.toLocaleString() ?? '—'}</span></div>
            </div>
          </motion.li>
        )})}
      </ol>
      <div className="mt-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">ROI Summary</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
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
                // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
                const investment = (u.est_one_time_cost || 0) + (u.est_ongoing_cost || 0)
                const roi = (typeof u.est_annual_benefit === 'number' && investment > 0)
                  ? Math.round(((u.est_annual_benefit - investment) / investment) * 100) + '%'
                  : 'Estimate'
                const confRaw = confidenceFromCount(u.citations?.length || 0)
                const conf = confRaw === 'Low' ? 'Medium' : confRaw
                return (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-gray-900 dark:text-white">{retitle(u.title, data.company.name, u.value_driver)}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{u.est_annual_benefit?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{u.est_one_time_cost?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{u.est_ongoing_cost?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{u.payback_months ? `${u.payback_months} mo` : 'estimate'}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{roi}</td>
                    <td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getConfidenceColor(conf)}`}>{conf}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          {(() => {
            const totalBenefit = sum(sorted.map(u => u.est_annual_benefit))
            const totalOneTime = sum(sorted.map(u => u.est_one_time_cost))
            const totalOngoing = sum(sorted.map(u => u.est_ongoing_cost))
            const totalInvestment = totalOneTime + totalOngoing
            const avgPayback = avg(sorted.map(u => u.payback_months))
            // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
            const roiOverall = (totalInvestment > 0)
              ? Math.round(((totalBenefit - totalInvestment) / totalInvestment) * 100) + '%'
              : 'Estimate'
            const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : 'Estimate')
            return `Totals — Benefit: CHF ${fmt(totalBenefit)}; Investment: CHF ${fmt(totalOneTime + totalOngoing)}; Avg payback: ${typeof avgPayback === 'number' ? `${avgPayback} mo` : 'Estimate'}; Overall ROI: ${roiOverall}.`
          })()}
        </p>
      </div>
    </div>
  )
}


