"use client"
import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'
import { validateROI } from '@/lib/utils/roiValidation'
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

// Normalize numeric values to ensure consistency (handle null, undefined, or string values)
function normalizeNum(v: any): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') {
    const parsed = parseFloat(v)
    return !isNaN(parsed) ? parsed : 0
  }
  return 0
}

// Get benefit value from use case, checking all possible field names
function getBenefit(u: Brief['use_cases'][0]): number {
  return normalizeNum(
    u.benefit ?? 
    u.est_annual_benefit ?? 
    u.annual_benefit ?? 
    0
  )
}

// Get one-time cost from use case, checking all possible field names
function getOneTimeCost(u: Brief['use_cases'][0]): number {
  return normalizeNum(
    u.one_time ?? 
    u.est_one_time_cost ?? 
    u.one_time_cost ?? 
    0
  )
}

// Get ongoing cost from use case, checking all possible field names
function getOngoingCost(u: Brief['use_cases'][0]): number {
  return normalizeNum(
    u.ongoing ?? 
    u.est_ongoing_cost ?? 
    u.ongoing_cost ?? 
    0
  )
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
        {(() => {
          // Calculate ROI for all use cases first to find min/max for normalization
          const rois = sorted.map(u => {
            const benefit = getBenefit(u)
            const oneTimeCost = getOneTimeCost(u)
            const ongoingCost = getOngoingCost(u)
            const investment = oneTimeCost + ongoingCost
            return (benefit > 0 && investment > 0)
              ? ((benefit - investment) / investment) * 100
              : undefined
          })
          const validRois = rois.filter((r): r is number => typeof r === 'number')
          const maxRoi = validRois.length > 0 ? Math.max(...validRois) : 100
          const minRoi = validRois.length > 0 ? Math.min(...validRois) : 0
          // Use 0 as baseline if all ROIs are positive, otherwise use minRoi
          const baselineRoi = minRoi >= 0 ? 0 : minRoi
          const roiRange = maxRoi - baselineRoi || 1 // Avoid division by zero
          
          return sorted.map((u, i) => {
            // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
            // Use helper functions to get values from all possible field names
            const benefit = getBenefit(u)
            const oneTimeCost = getOneTimeCost(u)
            const ongoingCost = getOngoingCost(u)
            const investment = oneTimeCost + ongoingCost
            const rawRoiPct = (benefit > 0 && investment > 0)
              ? ((benefit - investment) / investment) * 100
              : undefined
            // Validate and cap ROI to realistic percentages
            const roiPct = typeof rawRoiPct === 'number' ? validateROI(rawRoiPct) : undefined
            const roiColor = 'bg-green-600'
            // Calculate bar width based on ROI: higher ROI = more blue
            // Normalize ROI to 0-100% based on baseline and max ROI
            let barWidth = 2 // Default minimum for undefined ROI
            if (typeof roiPct === 'number') {
              if (roiPct < 0) {
                // Negative ROI: show minimal bar (2%)
                barWidth = 2
              } else {
                // Positive ROI: normalize from baseline to maxRoi (baseline = 2% bar, maxRoi = 100% bar)
                barWidth = Math.max(2, Math.min(100, ((roiPct - baselineRoi) / roiRange) * 98 + 2))
              }
            }
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
                  {roiPct !== undefined 
                    ? t('report.useCases.roiPercent', { percent: roiPct })
                    : (benefit > 0 && investment === 0)
                      ? '∞% ROI'
                      : t('report.roi.est')}
                </span>
                <span>{u.payback_months ? t('report.useCases.payback', { months: u.payback_months }) : t('report.roi.est')}</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('report.useCases.value')}: {u.value_driver} • {t('report.useCases.complexity')} {u.complexity}/5 • {t('report.useCases.effort')} {u.effort}/5
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{u.description}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${barWidth}%` }}></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div>{t('report.useCases.annualBenefit')}: <span className="text-blue-600 dark:text-blue-400 font-medium">{benefit > 0 ? benefit.toLocaleString() : '—'}</span></div>
              <div>{t('report.useCases.oneTimeCost')}: <span className="text-gray-700 dark:text-gray-300">{oneTimeCost > 0 ? oneTimeCost.toLocaleString() : '—'}</span></div>
              <div>{t('report.useCases.ongoingCost')}: <span className="text-gray-700 dark:text-gray-300">{ongoingCost > 0 ? ongoingCost.toLocaleString() : '—'}</span></div>
            </div>
          </motion.li>
          )
        })
        })()}
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
                <th className="p-3 whitespace-nowrap">{t('report.roi.confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => {
                // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
                // Use helper functions to get values from all possible field names
                const benefit = getBenefit(u)
                const oneTimeCost = getOneTimeCost(u)
                const ongoingCost = getOngoingCost(u)
                const investment = oneTimeCost + ongoingCost
                const rawRoi = (benefit > 0 && investment > 0)
                  ? ((benefit - investment) / investment) * 100
                  : undefined
                // Validate and cap ROI to realistic percentages
                const validatedRoi = typeof rawRoi === 'number' ? validateROI(rawRoi) : undefined
                const roi = validatedRoi !== undefined
                  ? validatedRoi + '%'
                  : (benefit > 0 && investment === 0)
                    ? '∞%' // If there's benefit but no investment, ROI is infinite
                    : t('report.roi.estimate')
                const confRaw = confidenceFromCount(u.citations?.length || 0)
                const conf = confRaw === 'Low' ? 'Medium' : confRaw
                return (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-gray-900 dark:text-white">{retitle(u.title, data.company.name, u.value_driver)}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{benefit > 0 ? benefit.toLocaleString() : '—'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{oneTimeCost > 0 ? oneTimeCost.toLocaleString() : '—'}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300">{ongoingCost > 0 ? ongoingCost.toLocaleString() : '—'}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{u.payback_months ? t('report.useCases.paybackMonths', { months: u.payback_months }) : t('report.roi.estimate')}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">{roi}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
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
            const totalBenefit = sum(sorted.map(u => getBenefit(u)))
            const totalOneTime = sum(sorted.map(u => getOneTimeCost(u)))
            const totalOngoing = sum(sorted.map(u => getOngoingCost(u)))
            const totalInvestment = totalOneTime + totalOngoing
            const avgPayback = avg(sorted.map(u => u.payback_months))
            // Calculate ROI using consistent formula: (Benefit - Investment) / Investment * 100
            const rawRoiOverall = (totalInvestment > 0)
              ? ((totalBenefit - totalInvestment) / totalInvestment) * 100
              : undefined
            // Validate and cap overall ROI to realistic percentages
            const validatedRoiOverall = typeof rawRoiOverall === 'number' ? validateROI(rawRoiOverall) : undefined
            const roiOverall = validatedRoiOverall !== undefined
              ? validatedRoiOverall + '%'
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



