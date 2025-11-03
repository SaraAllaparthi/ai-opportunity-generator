"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]
  const value = typeof data.value === 'number' ? new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(data.value) : data.value
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg">
      <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">{data.name}</p>
      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{value}</p>
    </div>
  )
}

export default function RoiDonut({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  const items = data.use_cases.map(u => ({ name: u.title, value: u.est_annual_benefit || 0 }))
  const COLORS = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed']
  return (
    <div className="h-48 w-full">
      {!R ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
      ) : (
        <R.ResponsiveContainer width="100%" height="100%">
          <R.PieChart>
            <R.Pie data={items} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {items.map((_, i) => (<R.Cell key={i} fill={COLORS[i % COLORS.length]} />))}
            </R.Pie>
            <R.Tooltip content={<CustomTooltip />} />
          </R.PieChart>
        </R.ResponsiveContainer>
      )}
    </div>
  )
}


