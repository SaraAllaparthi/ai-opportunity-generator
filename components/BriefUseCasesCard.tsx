"use client"
import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations()
  const sorted = [...data.use_cases].sort((a, b) => (a.payback_months ?? 999) - (b.payback_months ?? 999))
  const confidenceRaw = confidenceFromCount(sorted.reduce((a,u)=>a+(u.citations?.length||0),0))
  const confidence = confidenceRaw === 'Low' ? 'Medium' : confidenceRaw
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('report.useCases.title', { company: data.company.name })}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-sm font-medium ${getConfidenceColor(confidence)}`}>
          {t('badge.confidence.' + confidence.toLowerCase())}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t('report.useCases.prioritized')}</p>
      <ol className="space-y-3 text-sm">
        {sorted.map((u, i) => {
          // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
          const investment = (u.est_one_time_cost || 0) + (u.est_ongoing_cost || 0)
          const roiPct = (typeof u.est_annual_benefit === 'number' && investment > 0)
            ? Math.round(((u.est_annual_benefit - investment) / investment) * 100)
            : undefined
          const roiColor = 'bg-green-600'
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
              <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-white text-[10px] font-medium ${roiColor}`}>
                  {roiPct !== undefined ? t('report.useCases.roiPercent', { percent: roiPct }) : t('report.roi.est')}
                </span>
                <span>{u.payback_months ? t('report.useCases.payback', { months: u.payback_months }) : t('report.roi.est')}</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('report.useCases.value')}: {u.value_driver} • {t('report.useCases.complexity')} {u.complexity}/5 • {t('report.useCases.effort')} {u.effort}/5
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{u.description}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${100 - progress}%` }}></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div>{t('report.useCases.annualBenefit')}: <span className="text-blue-600 dark:text-blue-400 font-medium">{u.est_annual_benefit?.toLocaleString() ?? '—'}</span></div>
              <div>{t('report.useCases.oneTimeCost')}: <span className="text-gray-700 dark:text-gray-300">{u.est_one_time_cost?.toLocaleString() ?? '—'}</span></div>
              <div>{t('report.useCases.ongoingCost')}: <span className="text-gray-700 dark:text-gray-300">{u.est_ongoing_cost?.toLocaleString() ?? '—'}</span></div>
            </div>
          </motion.li>
        )})}
      </ol>
      <div className="mt-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('report.roi.summary')}</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="p-3">{t('report.roi.useCase')}</th>
                <th className="p-3">{t('report.roi.benefit')}</th>
                <th className="p-3">{t('report.roi.oneTime')}</th>
                <th className="p-3">{t('report.roi.ongoing')}</th>
                <th className="p-3">{t('report.roi.payback')}</th>
                <th className="p-3">{t('report.roi.roi')}</th>
                <th className="p-3">{t('report.roi.confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => {
                // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
                const investment = (u.est_one_time_cost || 0) + (u.est_ongoing_cost || 0)
                const roi = (typeof u.est_annual_benefit === 'number' && investment > 0)
                  ? Math.round(((u.est_annual_benefit - investment) / investment) * 100) + '%'
                  : t('report.roi.estimate')
                const confRaw = confidenceFromCount(u.citations?.length || 0)
                const conf = confRaw === 'Low' ? 'Medium' : confRaw
                return (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-gray-900 dark:text-white">{retitle(u.title, data.company.name, u.value_driver)}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{u.est_annual_benefit?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{u.est_one_time_cost?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{u.est_ongoing_cost?.toLocaleString() ?? '—'}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{u.payback_months ? t('report.useCases.paybackMonths', { months: u.payback_months }) : t('report.roi.estimate')}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{roi}</td>
                    <td className="p-3">
                      <span className={`rounded-full border px-2 py-0.5 text-sm font-medium ${
                        conf === 'Medium' || conf === 'High' 
                          ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500 dark:border-green-500' 
                          : getConfidenceColor(conf)
                      }`}>
                        {t('badge.confidence.' + conf.toLowerCase())}
                      </span>
                    </td>
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
              : t('report.roi.estimate')
            const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : t('report.roi.estimate'))
            return t('report.roi.totals', {
              benefit: fmt(totalBenefit),
              investment: fmt(totalOneTime + totalOngoing),
              payback: typeof avgPayback === 'number' ? t('report.useCases.paybackMonths', { months: avgPayback }) : t('report.roi.estimate'),
              roi: roiOverall
            })
          })()}
        </p>
      </div>
    </div>
  )
}



