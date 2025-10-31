"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

export default function RoiDonut({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  const items = data.use_cases.map(u => ({ name: u.title, value: u.est_annual_benefit || 0 }))
  const COLORS = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed']
  return (
    <div className="h-48 w-full">
      {!R ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <R.ResponsiveContainer width="100%" height="100%">
          <R.PieChart>
            <R.Pie data={items} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {items.map((_, i) => (<R.Cell key={i} fill={COLORS[i % COLORS.length]} />))}
            </R.Pie>
            <R.Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : v)} />
          </R.PieChart>
        </R.ResponsiveContainer>
      )}
    </div>
  )
}


