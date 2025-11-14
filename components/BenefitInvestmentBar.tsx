"use client"
import { Brief } from '@/lib/schema/brief'
import { useTranslations } from 'next-intl'
import { validateROI } from '@/lib/utils/roiValidation'

function computeWeightedPayback(useCases: Brief['use_cases']) {
  const items = useCases.filter(u => typeof u.est_annual_benefit === 'number' && typeof u.payback_months === 'number')
  const num = items.reduce((acc, u) => acc + (u.est_annual_benefit as number) * (u.payback_months as number), 0)
  const den = items.reduce((acc, u) => acc + (u.est_annual_benefit as number), 0)
  if (!den) return undefined
  return Math.round(num / den)
}

export default function BenefitInvestmentBar({ data }: { data: Brief }) {
  const t = useTranslations()
  // Normalize numeric values to ensure consistency (handle null, undefined, or string values)
  const normalizeNum = (v: any): number => {
    if (typeof v === 'number' && !isNaN(v)) return v
    if (typeof v === 'string') {
      const parsed = parseFloat(v)
      return !isNaN(parsed) ? parsed : 0
    }
    return 0
  }
  
  const totalBenefit = data.use_cases.reduce((a,u)=>a+normalizeNum(u.est_annual_benefit),0)
  const totalOneTime = data.use_cases.reduce((a,u)=>a+normalizeNum(u.est_one_time_cost),0)
  const totalOngoing = data.use_cases.reduce((a,u)=>a+normalizeNum(u.est_ongoing_cost),0)
  const totalInvestment = totalOneTime + totalOngoing
  
  // Calculate ROI percentage and validate it
  const rawRoiPercentage = totalInvestment > 0 
    ? ((totalBenefit - totalInvestment) / totalInvestment) * 100 
    : 0
  const roiPercentage = validateROI(rawRoiPercentage)
  
  // Calculate weighted payback
  const weightedPayback = computeWeightedPayback(data.use_cases)
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CH', { 
      style: 'currency', 
      currency: 'CHF', 
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(amount)
  }
  
  // Calculate proportions for the bar (Investment + Benefit = total, show both segments)
  const total = totalInvestment + totalBenefit
  const investmentPercent = total > 0 ? (totalInvestment / total) * 100 : 50
  const benefitPercent = total > 0 ? (totalBenefit / total) * 100 : 50
  
  return (
    <div className="w-full space-y-3">
      {/* ROI Percentage Display */}
      <div className="text-center">
        <div className="text-lg font-medium text-gray-900 dark:text-white">
          {t('report.roi.roi')}: {roiPercentage >= 0 ? '+' : ''}{roiPercentage.toFixed(1)}%
        </div>
      </div>
      
      {/* Horizontal Gauge - Investment and Benefit side by side */}
      <div className="relative">
        <div className="h-10 w-full rounded-full overflow-hidden flex">
          {/* Investment segment (left, blue) */}
          <div 
            className="h-full transition-all duration-500 rounded-l-full"
            style={{ 
              width: `${investmentPercent}%`,
              backgroundColor: '#2563eb' // blue-600
            }}
          />
          {/* Benefit segment (right, green) */}
          <div 
            className="h-full transition-all duration-500 rounded-r-full"
            style={{ 
              width: `${benefitPercent}%`,
              backgroundColor: '#16a34a' // green-600
            }}
          />
        </div>
        
        {/* Labels below the bar */}
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            {formatCurrency(totalInvestment)} {t('report.roi.invested')}
          </span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            {formatCurrency(totalBenefit)} {t('report.roi.gained')}
          </span>
        </div>
      </div>
      
      {/* Payback period */}
      {weightedPayback !== undefined && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-1">
          {t('report.roi.paybackText', { months: weightedPayback })}
        </div>
      )}
    </div>
  )
}


