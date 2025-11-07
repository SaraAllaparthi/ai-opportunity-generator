"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'
import { formatCHF } from '@/lib/utils/currency'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]
  const value = typeof data.value === 'number' ? formatCHF(data.value) : data.value
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg z-50">
      <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">{data.name}</p>
      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{value}</p>
    </div>
  )
}

export default function RoiDonut({ data }: { data: Brief }) {
  const [mounted, setMounted] = useState(false)
  const [Recharts, setRecharts] = useState<any>(null)
  
  useEffect(() => {
    setMounted(true)
    import('recharts').then((mod) => {
      setRecharts(mod)
    }).catch((err) => {
      console.error('[RoiDonut] Failed to load recharts:', err)
    })
  }, [])
  
  // Calculate ROI from use_cases directly (support both field name conventions)
  const useCases = data?.use_cases || []
  const totals = {
    benefit: useCases.reduce((s: number, u: any) => s + (u.benefit || u.annual_benefit || 0), 0),
    oneTime: useCases.reduce((s: number, u: any) => s + (u.one_time || u.one_time_cost || 0), 0),
    ongoing: useCases.reduce((s: number, u: any) => s + (u.ongoing || u.ongoing_cost || 0), 0)
  }

  const investment = totals.oneTime + totals.ongoing
  const roiPct = investment > 0 ? ((totals.benefit - investment) / investment) * 100 : 0

  // Compute weighted payback months
  const withPositives = useCases.filter((u: any) => {
    const benefit = u.benefit || u.annual_benefit || 0
    const payback = u.payback_months || 0
    return benefit > 0 && payback > 0
  })

  let weightedPaybackMonths: number | null = null
  if (withPositives.length > 0) {
    const denom = withPositives.reduce((s: number, u: any) => s + (u.benefit || u.annual_benefit || 0), 0)
    if (denom > 0) {
      const num = withPositives.reduce((s: number, u: any) => {
        const benefit = u.benefit || u.annual_benefit || 0
        const payback = u.payback_months || 0
        return s + (benefit * payback)
      }, 0)
      weightedPaybackMonths = Math.round(num / denom)
    }
  }

  // Prepare chart data: Investment and Net Gain
  const netGain = Math.max(0, totals.benefit - investment)
  const chartData = [
    { name: 'Investment', value: investment },
    { name: 'Net Value', value: netGain }
  ].filter(item => item.value > 0)

  const COLORS = ['#ef4444', '#16a34a'] // Red for investment, green for net gain
  
  // If not mounted, show loading
  if (!mounted) {
    return (
      <div className="h-48 w-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart…</div>
      </div>
    )
  }
  
  // If recharts not loaded yet
  if (!Recharts) {
    return (
      <div className="h-48 w-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart library…</div>
      </div>
    )
  }
  
  // If no ROI data, show empty state
  if (totals.benefit === 0 && investment === 0) {
    return (
      <div className="h-48 w-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded">
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Awaiting estimates
        </div>
      </div>
    )
  }
  
  const { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } = Recharts
  
  return (
    <div className="h-48 w-full relative" style={{ minHeight: '192px', width: '100%' }}>
      <div style={{ width: '100%', height: '192px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={chartData} 
              dataKey="value" 
              nameKey="name" 
              innerRadius="60%" 
              outerRadius="90%" 
              paddingAngle={2}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={-270}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartData.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }: any) => {
                if (!active || !payload || !payload.length) return null
                const investment = payload.find((p: any) => p.name === 'Investment')
                const netValue = payload.find((p: any) => p.name === 'Net Value')
                return (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg z-50">
                    {investment && (
                      <p className="text-xs mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">Investment: </span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">{formatCHF(investment.value)}</span>
                      </p>
                    )}
                    {netValue && (
                      <p className="text-xs mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">Net Value: </span>
                        <span className="text-green-600 dark:text-green-400 font-semibold">{formatCHF(netValue.value)}</span>
                      </p>
                    )}
                    <p className="text-xs">
                      <span className="font-medium text-gray-900 dark:text-white">Benefit: </span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{formatCHF(totals.benefit)}</span>
                    </p>
                  </div>
                )
              }} 
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value: string) => value}
            />
            {/* Center label showing ROI */}
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-sm font-semibold"
              fill={roiPct >= 0 ? '#16a34a' : '#ef4444'}
            >
              <tspan x="50%" dy="-0.8em" className="font-bold">ROI</tspan>
              <tspan x="50%" dy="1.2em">
                {investment > 0 ? `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(0)}%` : '—'}
              </tspan>
              {weightedPaybackMonths !== null && (
                <tspan x="50%" dy="1.2em" className="text-xs opacity-75">
                  Payback ~{weightedPaybackMonths} mo
                </tspan>
              )}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
