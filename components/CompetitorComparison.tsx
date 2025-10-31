"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

type Comp = { name: string; positioning: string; scores: { axis: string; value: number }[] }

function getDefaultCompetitors(company: string): Comp[] {
  if (/ubs/i.test(company)) {
    const axes = ['Wealth scale','AI maturity','Personalization','Private credit','ESG']
    const mk = (name: string, positioning: string, values: number[]): Comp => ({ name, positioning, scores: axes.map((a,i)=>({axis:a,value:values[i]})) })
    return [
      mk('J.P. Morgan','Global scale; strong platformization; leading private markets', [5,4,4,5,4]),
      mk('Morgan Stanley','Advisory strength; personalization leadership via platform', [4,4,5,3,4]),
      mk('Goldman Sachs','Product innovation; institutional distribution advantage', [4,4,4,4,3]),
      mk('Bank of America','Mass affluent scale; strong digital adoption', [4,3,4,3,3]),
      mk('Deutsche Bank','European focus; rebuilding wealth franchise', [3,3,3,3,4])
    ]
  }
  return []
}

export default function CompetitorComparison({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  const comps = getDefaultCompetitors(data.company.name)
  if (comps.length === 0) return null
  const axes = comps[0].scores.map(s => s.axis)
  const chartData = axes.map(axis => {
    const o: any = { axis }
    for (const c of comps) o[c.name] = c.scores.find(s=>s.axis===axis)?.value || 0
    return o
  })
  const colors = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed']
  return (
    <div className="w-full">
      <div className="mb-2 text-sm italic">Compete on scale and personalization; lean into data moats.</div>
      <div className="h-72 w-full">
        {!R ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <R.ResponsiveContainer>
            <R.RadarChart data={chartData} outerRadius="70%">
              <R.PolarGrid />
              <R.PolarAngleAxis dataKey="axis" />
              <R.PolarRadiusAxis angle={30} domain={[0,5]} tickCount={6} />
              {comps.map((c, i) => (
                <R.Radar key={c.name} name={c.name} dataKey={c.name} stroke={colors[i%colors.length]} fill={colors[i%colors.length]} fillOpacity={0.2} />
              ))}
              <R.Tooltip />
            </R.RadarChart>
          </R.ResponsiveContainer>
        )}
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {comps.map((c,i)=>(
          <li key={i} className="rounded-md border p-2 text-sm"><span className="font-medium">{c.name}:</span> {c.positioning}</li>
        ))}
      </ul>
    </div>
  )
}


