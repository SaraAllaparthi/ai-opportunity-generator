'use client'

import { Brief } from '@/lib/schema/brief'
import { useTranslations } from 'next-intl'

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

export default function BriefExecutiveSummary({ 
  data, 
  summaryText,
  formattedUplift,
  weightedPayback,
  avgComplexity,
  avgEffort
}: { 
  data: Brief
  summaryText: string
  formattedUplift: string
  weightedPayback: number | undefined
  avgComplexity: number
  avgEffort: number
}) {
  const t = useTranslations()

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('section.execSummary')}</h3>
      </div>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {summaryText}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-600 dark:text-gray-400 mb-1">{t('report.execSummary.annualUplift')}</div>
          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{formattedUplift}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-600 dark:text-gray-400 mb-1">{t('report.execSummary.weightedPayback')}</div>
          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{typeof weightedPayback === 'number' ? `${weightedPayback} ${t('common.months')}` : t('report.execSummary.estimate')}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-600 dark:text-gray-400 mb-1">{t('report.execSummary.deliveryProfile')}</div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{t('report.execSummary.complexity', { value: avgComplexity })}</div>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{t('report.execSummary.effort', { value: avgEffort })}</div>
          </div>
        </div>
      </div>
    </section>
  )
}


