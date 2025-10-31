"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

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
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <R.ResponsiveContainer width="100%" height="100%">
          <R.BarChart data={chart}>
            <R.XAxis dataKey="name" hide />
            <R.YAxis hide />
            <R.Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : v)} />
            <R.Bar dataKey="Benefit" stackId="a" fill="#16a34a" />
            <R.Bar dataKey="Investment" stackId="a" fill="#2563eb" />
          </R.BarChart>
        </R.ResponsiveContainer>
      )}
    </div>
  )
}


