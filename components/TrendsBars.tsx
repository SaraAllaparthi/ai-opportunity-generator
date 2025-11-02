"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]
  const fullName = data.payload.fullName || data.payload.name
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-lg max-w-[200px]">
      <p className="text-xs font-medium text-gray-900 dark:text-white mb-1 break-words">{fullName}</p>
      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Score: {data.value}</p>
    </div>
  )
}

export default function TrendsBars({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  const trends = (data.industry.trends || []).slice(0, 5)
  // Calculate reasonable width for labels (estimate ~6px per character + padding)
  const maxLabelWidth = Math.min(Math.max(...trends.map(t => t.length)) * 6 + 30, 180)
  const chart = trends.map((t, i) => ({ 
    name: t, // Show full text, no truncation
    fullName: t,
    score: 5 - i 
  }))
  return (
    <div className="h-48 w-full">
      {!R ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
      ) : (
        <R.ResponsiveContainer width="100%" height="100%">
          <R.BarChart data={chart} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: maxLabelWidth }}>
            <R.XAxis type="number" hide />
            <R.YAxis 
              type="category" 
              dataKey="name" 
              width={maxLabelWidth}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-gray-700 dark:text-gray-300"
              interval={0}
            />
            <R.Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <R.Bar 
              dataKey="score" 
              fill="#2563eb" 
              radius={[0,4,4,0]}
            >
              {chart.map((entry, index) => (
                <R.Cell key={`cell-${index}`} fill="#2563eb" />
              ))}
            </R.Bar>
          </R.BarChart>
        </R.ResponsiveContainer>
      )}
    </div>
  )
}


