"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

export default function TrendsBars({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  const trends = (data.industry.trends || []).slice(0, 5)
  const chart = trends.map((t, i) => ({ name: t.slice(0, 18) + (t.length>18?'…':''), score: 5 - i }))
  return (
    <div className="h-48 w-full">
      {!R ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <R.ResponsiveContainer width="100%" height="100%">
          <R.BarChart data={chart} layout="vertical">
            <R.XAxis type="number" hide />
            <R.YAxis type="category" dataKey="name" width={120} />
            <R.Tooltip />
            <R.Bar dataKey="score" fill="#2563eb" radius={[0,4,4,0]} />
          </R.BarChart>
        </R.ResponsiveContainer>
      )}
    </div>
  )
}


