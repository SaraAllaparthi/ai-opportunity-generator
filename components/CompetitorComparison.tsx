"use client"
import { Brief } from '@/lib/schema/brief'
import { useMemo, useState, useEffect } from 'react'
import { geoScore } from '@/lib/geo/swiss'

const s = (v?: string) => (v ?? '').toString()
const lc = (v?: string) => s(v).toLowerCase()
const within = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x))

function parseEmployees(sizeField?: string | number): number | null {
  if (typeof sizeField === 'number') return sizeField
  const t = lc(sizeField)
  if (!t) return null
  const range = t.match(/(\d{1,5})\s*[-–]\s*(\d{1,5})/)
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2)
  const single = t.match(/(~|about|approx\.?|around)?\s*(\d{1,5})/)
  if (single) return Number(single[2])
  const buckets: Record<string, number> = {
    micro: 10, small: 50, sme: 250, mid: 300, midsize: 300,
    medium: 250, large: 1000, enterprise: 2000
  }
  for (const k of Object.keys(buckets)) if (t.includes(k)) return buckets[k]
  return null
}

function isSmallCompany(hint?: string | number): boolean {
  const n = parseEmployees(hint)
  if (n && !Number.isNaN(n)) return n < 250
  const txt = lc(typeof hint === 'number' ? String(hint) : hint)
  return /under|less|small|fewer|1-|10-|50-|100-|200-|sme|mid|midsize/.test(txt)
}

function normalizeCompetitorKey(name: string, website?: string): string {
  const nameKey = name.toLowerCase().trim().replace(/\s+/g, ' ')
  if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`)
      const host = url.hostname.toLowerCase().split('.').slice(-2).join('.')
      return `${nameKey}|${host}`
    } catch { return nameKey }
  }
  return nameKey
}

/** ---------- scoring for radar ---------- */
function calculateCompanyScores(data: Brief): { dimension: string; value: number }[] {
  const company = data.company
  const industry = data.industry
  const useCases = data.use_cases || []

  const aiTrendsCount = (industry.trends || [])
    .map(s)
    .filter(t => /ai|ml|machine learning|automation|computer vision|predictive/i.test(t)).length
  const innovationSpeed = within(2.0 + aiTrendsCount * 0.5, 1.0, 5.0)

  const costUseCases = useCases.filter(u => lc(u.value_driver) === 'cost').length
  const efficiency = within(2.2 + costUseCases * 0.45, 1.0, 5.0)

  const personalization = isSmallCompany(company.size ?? (company as any).employees) ? 4.2 : 3.6

  const avgComplexity = useCases.length
    ? useCases.reduce((sum, u) => sum + (u.complexity ?? 3), 0) / useCases.length
    : 3
  const dataReadiness = within(5.0 - avgComplexity * 0.6, 2.4, 5.0)

  const aiUseCases = useCases.filter(u =>
    /ai|ml|machine learning|computer vision|predictive/i.test(s(u.title)) ||
    /ai|ml|machine learning|computer vision|predictive/i.test(s(u.description))
  ).length
  const aiAdoption = within(2.0 + aiUseCases * 0.5, 1.0, 5.0)

  return [
    { dimension: 'Innovation Speed', value: innovationSpeed },
    { dimension: 'Operational Efficiency', value: efficiency },
    { dimension: 'Personalization', value: personalization },
    { dimension: 'Data Readiness', value: dataReadiness },
    { dimension: 'AI Adoption', value: aiAdoption }
  ]
}

function estimateCompetitorScores(
  competitor: Brief['competitors'][number],
  base: { dimension: string; value: number }[]
) {
  const combined = `${competitor.ai_maturity ?? ''} ${competitor.innovation_focus ?? ''} ${competitor.positioning ?? ''}`.toLowerCase()
  const adj: Record<string, number> = {}
  if (combined) {
    adj['AI Adoption'] = /(ai|digital|automation|smart|ml|predictive)/.test(combined) ? 0.8 : -0.1
    adj['Innovation Speed'] = /(innovation|fast|agile|cutting-edge|rapid|prototype)/.test(combined) ? 0.6 : 0
    adj['Operational Efficiency'] = /(efficiency|optimization|lean|cost|productivity|throughput)/.test(combined) ? 0.45 : 0
    adj['Personalization'] = /(regional|local|niche|specialized|custom|bespoke)/.test(combined) ? 0.35
      : /(large|scale|global network)/.test(combined) ? -0.2 : 0
    adj['Data Readiness'] = /(data|analytics|insight|predictive|mes|erp|digital thread|historians)/.test(combined) ? 0.5 : 0
  }
  return base.map(s => ({ dimension: s.dimension, value: within(s.value + (adj[s.dimension] ?? 0), 1.0, 5.0) }))
}

function generateStrategicInsight(
  companyScores: { dimension: string; value: number }[],
  competitorScores: Array<{ dimension: string; value: number }[]>
) {
  if (!competitorScores.length) {
    return 'Localize competitor discovery and prioritize Data Readiness and AI Adoption to beat regional peers on lead time and quality.'
  }
  const dims = companyScores.map(s => {
    const compAvg = competitorScores.reduce((sum, comp) => sum + (comp.find(c => c.dimension === s.dimension)?.value ?? 3), 0) / competitorScores.length
    return { dimension: s.dimension, company: s.value, compAvg, gap: compAvg - s.value }
  })
  const worst = [...dims].sort((a, b) => b.gap - a.gap)[0]
  if (worst && worst.gap > 0.25) {
    const map: Record<string, string> = {
      'Data Readiness': 'Close data gaps (unify sensors, MES/ERP, SPC) to enable predictive QA within 90 days.',
      'AI Adoption': 'Stand up a thin-slice computer-vision QA pilot to match peer automation and reduce scrap.',
      'Operational Efficiency': 'Automate bottleneck steps to recover 8–12% throughput and match peer cycle times.',
      'Innovation Speed': 'Adopt weekly pilot cadence and A/B ops changes to compress time-to-impact.',
      'Personalization': 'Productize custom work with parametric templates to scale without margin loss.',
    }
    return map[worst.dimension] ?? `Strengthen ${worst.dimension.toLowerCase()} to overtake regional peers this year.`
  }
  const best = [...dims].sort((a, b) => (b.company - b.compAvg) - (a.company - a.compAvg))[0]
  if (best && best.company - best.compAvg > 0.25) {
    const map: Record<string, string> = {
      'Personalization': 'Leverage high personalization to win mid-volume, high-mix programs with AI-guided quoting.',
      'Data Readiness': 'Exploit strong data readiness to deploy predictive maintenance across critical lines first.',
      'AI Adoption': 'Scale AI adoption from QA to scheduling/dispatch to lock in lead-time advantage.',
      'Operational Efficiency': 'Convert efficiency lead into guaranteed SLAs and premium pricing.',
      'Innovation Speed': 'Use rapid iteration to pilot coatings recipes faster and capture urgent demand.'
    }
    return map[best.dimension] ?? `Leverage superior ${best.dimension.toLowerCase()} to capture share faster than peers.`
  }
  return 'Double down on predictive QA and scheduling to create a defensible local edge.'
}

export default function CompetitorComparison({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)

  useEffect(() => { (async () => setR(await import('recharts')))() }, [])

  // Use only data.competitors - no client-side fetching
  const allCompetitors = useMemo(() => {
    return (data.competitors || []).filter(c => c && c.name && c.name.trim())
  }, [data.competitors])

  const companyHQ = data.company.headquarters ?? (data.company as any).hq

  // Rank by locality
  const ranked = useMemo(() => {
    const seen = new Set<string>()
    const uniq = allCompetitors.filter(c => {
      const k = normalizeCompetitorKey(c.name, c.website)
      if (seen.has(k)) return false
      seen.add(k); return true
    })
    return uniq
      .map(c => ({ c, score: geoScore(companyHQ, c.geo_fit) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.c)
      .slice(0, 3)
  }, [allCompetitors, companyHQ])

  const competitors = ranked
  const hasCompetitors = competitors.length > 0

  const companyScores = useMemo(() => calculateCompanyScores(data), [data])
  const competitorScoresList = competitors.map(c => estimateCompetitorScores(c, companyScores))
  const competitorScoresByName = useMemo(
    () => new Map(competitors.map((c, i) => [c.name, competitorScoresList[i]])),
    [competitors, competitorScoresList]
  )

  const chartData = companyScores.map(score => {
    const entry: any = { dimension: score.dimension, [data.company.name]: Math.round(score.value * 10) / 10 }
    competitors.forEach(comp => {
      const list = competitorScoresByName.get(comp.name) || []
      const pt = list.find(s => s.dimension === score.dimension)
      entry[comp.name] = Math.round((pt?.value ?? 3.0) * 10) / 10
    })
    return entry
  })

  const colors = ['#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
  const strategicInsight = generateStrategicInsight(companyScores, competitorScoresList)

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Peer Comparison: AI & Digital Maturity</h4>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {hasCompetitors
            ? `How ${data.company.name} compares to key peers across critical capabilities`
            : `Competitive positioning based on AI and digital maturity benchmarks`}
        </p>
      </div>

      <div className="h-80 w-full">
        {!R ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart…</div>
        ) : !hasCompetitors ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400 gap-2">
            No validated peers found for this company yet.
          </div>
        ) : (
          <R.ResponsiveContainer width="100%" height="100%">
            <R.RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <R.PolarGrid stroke="#e5e7eb" strokeOpacity={0.3} />
              <R.PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" />
              <R.PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-gray-500 dark:text-gray-400" />
              <R.Tooltip formatter={(value: number) => value.toFixed(1)} contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }} />
              <R.Legend wrapperStyle={{ paddingTop: 20 }} iconType="line" layout={competitors.length <= 2 ? 'horizontal' : 'vertical'} />
              <R.Radar name={data.company.name} dataKey={data.company.name} stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} strokeWidth={2} dot={{ fill: '#2563eb', r: 4 }} />
              {competitors.map((comp, i) => (
                <R.Radar key={comp.name} name={comp.name} dataKey={comp.name} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.15} strokeWidth={2} strokeDasharray={i === 0 ? '5 5' : undefined} dot={{ fill: colors[i % colors.length], r: 3 }} />
              ))}
            </R.RadarChart>
          </R.ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">Strategic Insight</div>
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          {hasCompetitors ? strategicInsight : 'Peer comparison requires competitor data from the research pipeline.'}
        </p>
      </div>
    </div>
  )
}
