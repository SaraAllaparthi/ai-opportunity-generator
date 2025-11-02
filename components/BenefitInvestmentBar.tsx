"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  
  const formatValue = (value: number, label: string) => {
    return new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(value)
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg space-y-1">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
          <div>
            <p className="text-xs font-medium text-gray-900 dark:text-white">{entry.name}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
              {formatValue(entry.value, entry.name)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BenefitInvestmentBar({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  const totalBenefit = data.use_cases.reduce((a,u)=>a+(u.est_annual_benefit||0),0)
  const totalOneTime = data.use_cases.reduce((a,u)=>a+(u.est_one_time_cost||0),0)
  const totalOngoing = data.use_cases.reduce((a,u)=>a+(u.est_ongoing_cost||0),0)
  const chart = [{ name: 'Totals', Benefit: totalBenefit, Investment: totalOneTime + totalOngoing }]
  return (
    <div className="h-48 w-full">
      {!R ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
      ) : (
        <R.ResponsiveContainer width="100%" height="100%">
          <R.BarChart data={chart}>
            <R.XAxis dataKey="name" hide />
            <R.YAxis hide />
            <R.Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <R.Bar dataKey="Benefit" stackId="a" fill="#16a34a" />
            <R.Bar dataKey="Investment" stackId="a" fill="#2563eb" />
          </R.BarChart>
        </R.ResponsiveContainer>
      )}
    </div>
  )
}


