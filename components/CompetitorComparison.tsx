'use client'

import { Brief } from '@/lib/schema/brief'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'

type EntityScores = {
  entity: string
  ai_adoption: number
  innovation_speed: number
  operational_efficiency: number
  technology_maturity: number
  market_position: number
  customer_focus: number
}

type ScoresData = {
  scores: EntityScores[]
}

const sanitizeKey = (name: string) => `k_${(name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_')}`

// Dimensions defined outside component to avoid recreation on every render
const dimensions = [
  { label: 'AI Adoption', key: 'ai_adoption' },
  { label: 'Innovation Speed', key: 'innovation_speed' },
  { label: 'Operational Efficiency', key: 'operational_efficiency' },
  { label: 'Market Position', key: 'market_position' },
  { label: 'Technology Maturity', key: 'technology_maturity' },
  { label: 'Customer Focus', key: 'customer_focus' }
] as const

/**
 * Generate executive summary using OpenAI via API route
 */
async function summarizePeerComparison(
  companyName: string,
  dimensions: Array<{ label: string; companyScore: number; peerAverage: number }>,
  language: 'en' | 'de' = 'en'
): Promise<string> {
  try {
    const response = await fetch('/api/summarize-peer-comparison', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        companyName,
        dimensions,
        language
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.summary || ''
  } catch (err) {
    console.error('[PeerComparison] Error generating summary:', err)
    // Fallback to basic summary
    const topGap = dimensions.reduce((max, d) => {
      const gap = Math.abs(d.companyScore - d.peerAverage)
      return gap > max.gap ? { dimension: d.label, gap, isPositive: d.companyScore > d.peerAverage } : max
    }, { dimension: '', gap: 0, isPositive: true })
    
    if (topGap.gap > 0.3) {
      return language === 'de'
        ? `${topGap.isPositive ? 'Führt' : 'Liegt zurück'} bei ${topGap.dimension.toLowerCase()} um ${topGap.gap.toFixed(1)} Punkte im Vergleich zu Peers.`
        : `${topGap.isPositive ? 'Leads' : 'Trails'} in ${topGap.dimension.toLowerCase()} by ${topGap.gap.toFixed(1)} points compared to peers.`
    }
    return language === 'de'
      ? 'Zeigt ausgewogene Fähigkeiten im Vergleich zu Peers.'
      : 'Shows balanced capabilities compared to peers.'
  }
}

/**
 * Analyze text and infer scores for six dimensions based on keywords and patterns
 * Company-agnostic logic that works for any organization or industry
 */
function inferScoresFromText(text: string): {
  ai_adoption: number
  innovation_speed: number
  operational_efficiency: number
  technology_maturity: number
  market_position: number
  customer_focus: number
} {
  const lowerText = text.toLowerCase()
  
  // AI Adoption scoring (1-5)
  const aiKeywords = {
    strong: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network', 'automation', 'intelligent', 'smart', 'predictive analytics', 'ai-powered', 'ai-driven'],
    moderate: ['digital', 'technology', 'software', 'platform', 'system', 'data analytics', 'analytics', 'optimization'],
    weak: ['traditional', 'manual', 'legacy', 'paper-based']
  }
  const aiScore = calculateDimensionScore(lowerText, aiKeywords, 1.5)

  // Innovation Speed scoring (1-5)
  const innovationKeywords = {
    strong: ['innovative', 'cutting-edge', 'pioneering', 'breakthrough', 'rapid', 'agile', 'fast-moving', 'disruptive', 'next-generation', 'advanced', 'modern', 'state-of-the-art'],
    moderate: ['developing', 'growing', 'expanding', 'improving', 'enhancing', 'upgrading'],
    weak: ['established', 'traditional', 'stable', 'conservative', 'long-standing']
  }
  const innovationScore = calculateDimensionScore(lowerText, innovationKeywords, 1.5)

  // Operational Efficiency scoring (1-5)
  const efficiencyKeywords = {
    strong: ['efficient', 'optimized', 'streamlined', 'automated', 'lean', 'productive', 'cost-effective', 'high-performance', 'scalable', 'agile operations'],
    moderate: ['operational', 'process', 'workflow', 'systematic', 'organized'],
    weak: ['inefficient', 'complex', 'bureaucratic', 'slow', 'cumbersome']
  }
  const efficiencyScore = calculateDimensionScore(lowerText, efficiencyKeywords, 1.5)

  // Technology Maturity scoring (1-5)
  const techKeywords = {
    strong: ['cloud', 'saas', 'api', 'microservices', 'modern tech', 'digital platform', 'enterprise software', 'cloud-native', 'api-first', 'scalable architecture'],
    moderate: ['software', 'system', 'platform', 'digital', 'technology', 'solution'],
    weak: ['legacy', 'outdated', 'traditional systems', 'on-premise', 'manual processes']
  }
  const techScore = calculateDimensionScore(lowerText, techKeywords, 1.5)

  // Market Position scoring (1-5)
  const marketKeywords = {
    strong: ['leader', 'leading', 'market leader', 'dominant', 'top', 'premier', 'recognized', 'award-winning', 'established leader', 'industry leader'],
    moderate: ['established', 'growing', 'expanding', 'recognized', 'known', 'reputable'],
    weak: ['emerging', 'startup', 'small', 'niche', 'regional', 'local']
  }
  const marketScore = calculateDimensionScore(lowerText, marketKeywords, 1.5)

  // Customer Focus scoring (1-5)
  const customerKeywords = {
    strong: ['customer-centric', 'client-focused', 'customer satisfaction', 'personalized', 'tailored', 'custom', 'dedicated service', 'customer experience', 'client success'],
    moderate: ['service', 'support', 'customer', 'client', 'solutions', 'satisfaction'],
    weak: ['generic', 'standard', 'one-size-fits-all', 'impersonal']
  }
  const customerScore = calculateDimensionScore(lowerText, customerKeywords, 1.5)

  return {
    ai_adoption: Math.max(1, Math.min(5, Math.round(aiScore * 10) / 10)),
    innovation_speed: Math.max(1, Math.min(5, Math.round(innovationScore * 10) / 10)),
    operational_efficiency: Math.max(1, Math.min(5, Math.round(efficiencyScore * 10) / 10)),
    technology_maturity: Math.max(1, Math.min(5, Math.round(techScore * 10) / 10)),
    market_position: Math.max(1, Math.min(5, Math.round(marketScore * 10) / 10)),
    customer_focus: Math.max(1, Math.min(5, Math.round(customerScore * 10) / 10))
  }
}

/**
 * Calculate dimension score based on keyword presence
 * Returns score between 1-5
 */
function calculateDimensionScore(text: string, keywords: { strong: string[], moderate: string[], weak: string[] }, baseScore: number): number {
  let score = baseScore // Start with neutral base
  
  // Count strong keyword matches
  const strongMatches = keywords.strong.filter(kw => text.includes(kw)).length
  score += strongMatches * 0.8
  
  // Count moderate keyword matches
  const moderateMatches = keywords.moderate.filter(kw => text.includes(kw)).length
  score += moderateMatches * 0.3
  
  // Subtract for weak keyword matches
  const weakMatches = keywords.weak.filter(kw => text.includes(kw)).length
  score -= weakMatches * 0.5
  
  // Text length factor (longer descriptions may indicate more detail/capability)
  const lengthFactor = Math.min(text.length / 200, 0.5) // Cap at 0.5 bonus
  score += lengthFactor
  
  return Math.max(1, Math.min(5, score))
}

/**
 * Normalize scores so the strongest company in each dimension = 5
 */
function normalizeScores(scores: EntityScores[]): EntityScores[] {
  if (scores.length === 0) return scores

  const dimensions: Array<keyof Omit<EntityScores, 'entity'>> = [
    'ai_adoption',
    'innovation_speed',
    'operational_efficiency',
    'technology_maturity',
    'market_position',
    'customer_focus'
  ]

  // Find max value for each dimension
  const maxValues: Record<string, number> = {}
  dimensions.forEach(dim => {
    const max = Math.max(...scores.map(s => s[dim]))
    maxValues[dim] = max > 0 ? max : 1 // Avoid division by zero
  })

  // Normalize each score: (score / max) * 5
  return scores.map(entity => {
    const normalized: EntityScores = { ...entity }
    dimensions.forEach(dim => {
      normalized[dim] = Math.max(1, Math.min(5, Math.round(((entity[dim] / maxValues[dim]) * 5) * 10) / 10))
    })
    return normalized
  })
}

/**
 * Generate scores for all entities using local text analysis
 */
function generateScores(data: Brief): ScoresData {
  const scores: EntityScores[] = []

  // Score main company
  const companyText = [
    data.company.summary || '',
    data.company.market_position || '',
    data.company.latest_news || ''
  ].filter(Boolean).join(' ')

  if (companyText.trim()) {
    const companyScores = inferScoresFromText(companyText)
    scores.push({
      entity: data.company.name,
      ...companyScores
    })
  }

  // Score competitors
  const competitors = (data.competitors || []).slice(0, 5)
  competitors.forEach(comp => {
    const competitorText = [
      comp.positioning || '',
      comp.size_band || ''
    ].filter(Boolean).join(' ')

    if (competitorText.trim()) {
      const compScores = inferScoresFromText(competitorText)
      scores.push({
        entity: comp.name,
        ...compScores
      })
    }
  })

  // Normalize scores so strongest = 5
  const normalized = normalizeScores(scores)

  return { scores: normalized }
}

export default function CompetitorComparison({ data }: { data: Brief }) {
  const t = useTranslations()
  const locale = useLocale() as 'en' | 'de'
  if (!data) {
    return (
      <div className="w-full p-4 text-sm text-red-500">
        <div className="mb-2">Error: Component did not receive data prop</div>
      </div>
    )
  }

  const [R, setR] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [scoresData, setScoresData] = useState<ScoresData | null>(null)
  const [executiveSummary, setExecutiveSummary] = useState<string>('')

  const companyName = data?.company?.name ?? ''
  const competitors = useMemo(() => {
    return (data?.competitors || [])
      .filter(c => c && c.name && c.name.trim())
      .slice(0, 5)
  }, [data?.competitors])

  const hasCompetitors = competitors.length > 0

  useEffect(() => setMounted(true), [])

  // Lazy-load recharts
  useEffect(() => {
    ;(async () => {
      try {
        const recharts = await import('recharts')
        setR(recharts)
      } catch (err) {
        console.error('[CompetitorComparison] Failed to load recharts:', err)
      }
    })()
  }, [])

  // Generate scores from local data
  // Use a stable key to track if we've processed this data
  const dataKey = useMemo(() => {
    return `${companyName}|${competitors.map(c => c.name).join(',')}`
  }, [companyName, competitors])

  const lastProcessedKeyRef = useRef<string>('')

  useEffect(() => {
    if (!mounted || !hasCompetitors) {
      lastProcessedKeyRef.current = ''
      return
    }

    // Skip if we've already processed this data
    if (lastProcessedKeyRef.current === dataKey) return

    try {
      const generated = generateScores(data)
      setScoresData(generated)
      lastProcessedKeyRef.current = dataKey

      // Generate executive summary using OpenAI
      const companyScore = generated.scores.find(s => s.entity === companyName)
      const peerScores = generated.scores.filter(s => s.entity !== companyName)

      if (companyScore && peerScores.length > 0) {
        // Calculate peer averages for each dimension
        const dimensionData = dimensions.map(({ label, key }) => {
          const companyValue = companyScore[key]
          const peerAvg = peerScores.reduce((sum, p) => sum + p[key], 0) / peerScores.length
              return {
            label,
            companyScore: companyValue,
            peerAverage: peerAvg
          }
        })

        // Generate summary with OpenAI
        summarizePeerComparison(companyName, dimensionData, locale)
          .then(summary => {
            if (summary && summary.trim()) {
              setExecutiveSummary(summary)
            } else {
              // Fallback if summary is empty
              const fallbackSummary = generateExecutiveSummary(companyScore, peerScores, locale)
              setExecutiveSummary(fallbackSummary)
            }
          })
          .catch(err => {
            console.error('[CompetitorComparison] Failed to generate OpenAI summary, using fallback:', err)
            // Fallback to local generation
            const fallbackSummary = generateExecutiveSummary(companyScore, peerScores, locale)
            setExecutiveSummary(fallbackSummary)
          })
      } else if (companyScore && peerScores.length === 0) {
        // No peers, but we have company score - show basic summary
        setExecutiveSummary(locale === 'de' 
          ? 'Zeigt ausgewogene Fähigkeiten in allen wichtigen Dimensionen.'
          : 'Shows balanced capabilities across key dimensions.')
      }
    } catch (err) {
      console.error('[CompetitorComparison] Error generating scores:', err)
      lastProcessedKeyRef.current = ''
    }
  }, [mounted, hasCompetitors, dataKey])

  const companyKey = sanitizeKey(companyName)
  const competitorKeyMap = useMemo(() => {
    const m: Record<string, string> = {}
    competitors.forEach(c => { m[c.name] = sanitizeKey(c.name) })
    return m
  }, [competitors])

  const chartData = scoresData
    ? dimensions.map(({ label, key }) => {
        const cleanLabel = label.trim()  // important
        const row: Record<string, any> = { dimension: cleanLabel }
        scoresData.scores.forEach(score => {
          const entityKey = score.entity === companyName ? companyKey : competitorKeyMap[score.entity]
          if (entityKey) {
            row[entityKey] = score[key]
          }
        })
        return row
      })
    : []

  const colors = ['#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

  // Print radar chart data for debugging
  useEffect(() => {
    if (scoresData && chartData.length > 0) {
      console.log('=== RadarChart Data ===')
      console.log('Company Name:', companyName)
      console.log('Competitors:', competitors.map(c => c.name))
      console.log('Dimensions:', dimensions.map(d => ({ label: d.label, key: d.key })))
      console.log('Dimensions in chartData:', chartData.map(d => d.dimension))
      console.log('Unique dimensions:', Array.from(new Set(chartData.map(d => d.dimension))))
      console.log('Count:', chartData.length, 'Unique count:', new Set(chartData.map(d => d.dimension)).size)
      console.log('Scores Data:', JSON.stringify(scoresData, null, 2))
      console.log('Chart Data (for RadarChart):', JSON.stringify(chartData, null, 2))
      console.log('Company Key:', companyKey)
      console.log('Competitor Key Map:', competitorKeyMap)
      console.log('Colors:', colors)
      console.log('=====================')
    }
  }, [scoresData, chartData, companyName, competitors, companyKey, competitorKeyMap])

  if (!hasCompetitors) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('report.peerComparison.title')}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('report.peerComparison.noCompetitors')}
          </p>
        </div>
        <div className="h-[400px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="mb-2">{t('report.peerComparison.noCompetitors')}</div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="w-full">
      <div className="mb-2">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('report.peerComparison.title')}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('report.subtitle.peerComparison', { 
            count: competitors.length, 
            plural: competitors.length > 1 ? 's' : '' 
          })}
        </p>
      </div>

      <div className="w-full flex items-center justify-center overflow-visible">
        {!mounted || !R ? (
          <div className="flex flex-col items-center justify-center h-[480px] text-sm text-gray-600 dark:text-gray-400">
            <div className="mb-2">{!mounted ? 'Initializing component…' : 'Loading chart library…'}</div>
          </div>
        ) : !scoresData || chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[480px] text-sm text-gray-500 dark:text-gray-400">
            <div className="mb-2">Generating comparison scores...</div>
          </div>
        ) : !R.RadarChart ? (
          <div className="flex flex-col items-center justify-center h-[480px] text-sm text-yellow-600 dark:text-yellow-400">
            <div className="mb-2">Chart library not fully loaded</div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center overflow-visible">
            {(() => {
              try {
                const RadarChart = R.RadarChart
                const PolarGrid = R.PolarGrid
                const PolarAngleAxis = R.PolarAngleAxis
                const PolarRadiusAxis = R.PolarRadiusAxis
                const Tooltip = R.Tooltip
                const Legend = R.Legend
                const Radar = R.Radar
                
                // Custom tooltip component that adapts to dark mode
                const CustomTooltip = ({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null
                  
                  // Check if dark mode is active
                  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
                  
                  return (
                    <div 
                      className="rounded-lg border p-2 shadow-lg"
                      style={{
                        backgroundColor: isDark ? 'rgb(31, 41, 55)' : 'rgb(255, 255, 255)',
                        borderColor: isDark ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)',
                        color: isDark ? 'rgb(249, 250, 251)' : 'rgb(17, 24, 39)',
                        padding: '8px 12px'
                      }}
                    >
                      <p style={{ marginBottom: '4px', fontWeight: 500, fontSize: '14px' }}>{label}</p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ fontSize: '13px', margin: '2px 0' }}>
                          <span style={{ color: entry.color }}>{entry.name}: </span>
                          {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                        </p>
                      ))}
                    </div>
                  )
                }
                
                const containerWidth = 880
                const containerHeight = 620

                const companyScore = scoresData.scores.find(s => s.entity === companyName)
                const peerScores = scoresData.scores.filter(s => s.entity !== companyName)
                
                return (
                  <div className="w-full flex items-center justify-center overflow-visible">
                    <RadarChart
                      width={containerWidth}
                      height={containerHeight}
                      data={chartData}
                      margin={{ top: 20, right: 60, bottom: 40, left: 60 }}
                      outerRadius="75%"
                      startAngle={0}
                      endAngle={360}
                    >
                      <PolarGrid stroke="#e5e7eb" strokeOpacity={0.35} strokeWidth={1} />

                      <PolarAngleAxis
                        dataKey="dimension"
                        type="category"
                        interval={0}
                        tick={{ fontSize: 14, fill: 'currentColor', fontWeight: 500 }}
                        tickLine={false}
                        tickMargin={18}
                        tickFormatter={(raw: string) => {
                          const value = raw.trim()
                          const shortLabels: Record<string, string> = {
                            'Operational Efficiency': 'Ops Efficiency',
                            'Technology Maturity': 'Tech Maturity',
                            'Customer Focus': 'Customer Focus',
                            'Innovation Speed': 'Innovation Speed',
                            'AI Adoption': 'AI Adoption',
                            'Market Position': 'Market Position'
                          }
                          return shortLabels[value] || value
                        }}
                      />

                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 5]}
                        tickCount={6}
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        tickFormatter={(v: number) => String(Math.round(v))}
                        axisLine={false}
                      />

                      <Tooltip content={<CustomTooltip />} />

                      <Legend
                        wrapperStyle={{ paddingTop: '20px', paddingBottom: '10px' }}
                        iconType="line"
                        formatter={(value: string) => (
                          <span style={{ fontSize: '16px', fontWeight: 600, color: 'currentColor' }}>{value}</span>
                        )}
                        verticalAlign="top"
                        align="center"
                      />

                      {companyScore && (
                        <Radar
                          name={companyName || 'Company'}
                          dataKey={companyKey}
                          stroke="#2563eb"
                          fill="#2563eb"
                          fillOpacity={0.25}
                          strokeWidth={3}
                          dot={{ fill: '#2563eb', r: 6 }}
                          isAnimationActive={false}
                        />
                      )}

                      {peerScores.map((peer, i) => {
                        const peerKey = competitorKeyMap[peer.entity]
                        if (!peerKey) return null
                        return (
                          <Radar
                            key={peerKey}
                            name={peer.entity}
                            dataKey={peerKey}
                            stroke={colors[i % colors.length]}
                            fill={colors[i % colors.length]}
                            fillOpacity={0.12}
                            strokeWidth={2.5}
                            strokeDasharray="4 3"
                            dot={{ fill: colors[i % colors.length], r: 5 }}
                            isAnimationActive={false}
                          />
                        )
                      })}
                    </RadarChart>
                  </div>
                )
              } catch (chartError: any) {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-sm text-red-500 p-4">
                    <div className="mb-2 font-semibold">Chart Rendering Error</div>
                    <div className="text-sm">{chartError?.message || String(chartError)}</div>
                  </div>
                )
              }
            })()}
          </div>
        )}
      </div>

      {scoresData && scoresData.scores.length > 0 && (
        <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Executive Summary</div>
          {executiveSummary ? (
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {executiveSummary}
            </p>
          ) : (
            <p className="text-sm text-blue-700 dark:text-blue-300 italic">
              Generating executive summary...
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function generateExecutiveSummary(
  companyScore: EntityScores,
  peerScores: EntityScores[],
  locale: 'en' | 'de' = 'en'
): string {
  if (peerScores.length === 0) {
    return locale === 'de'
      ? 'Zeigt ausgewogene Fähigkeiten in allen wichtigen Dimensionen.'
      : 'Shows balanced capabilities across key dimensions.'
  }

  const dims: Array<keyof Omit<EntityScores, 'entity'>> = [
    'ai_adoption',
    'innovation_speed',
    'operational_efficiency',
    'market_position',
    'technology_maturity',
    'customer_focus'
  ]

  const labels: Record<keyof Omit<EntityScores, 'entity'>, { en: string; de: string }> = {
    ai_adoption: { en: 'AI Adoption', de: 'KI-Einführung' },
    innovation_speed: { en: 'Innovation Speed', de: 'Innovationsgeschwindigkeit' },
    operational_efficiency: { en: 'Operational Efficiency', de: 'Operative Effizienz' },
    market_position: { en: 'Market Position', de: 'Marktposition' },
    technology_maturity: { en: 'Technology Maturity', de: 'Technologiereife' },
    customer_focus: { en: 'Customer Focus', de: 'Kundenfokus' }
  }

  const strengths: Array<{ dimension: string; lead: number }> = []
  const weaknesses: Array<{ dimension: string; gap: number }> = []

  dims.forEach(dim => {
    const companyValue = companyScore[dim]
    const avgPeer = peerScores.reduce((sum, p) => sum + p[dim], 0) / peerScores.length
    const diff = companyValue - avgPeer
    if (diff > 0.3) strengths.push({ dimension: labels[dim][locale], lead: diff })
    if (-diff > 0.3) weaknesses.push({ dimension: labels[dim][locale], gap: -diff })
  })

  const sentences: string[] = []

  if (strengths.length > 0) {
    const topStrength = strengths.sort((a, b) => b.lead - a.lead)[0]
    if (locale === 'de') {
      sentences.push(`Führt bei ${topStrength.dimension.toLowerCase()} mit ${topStrength.lead.toFixed(1)} Punkten, was einen Wettbewerbsvorteil darstellt, den es zu nutzen gilt.`)
    } else {
      sentences.push(`Leads peers in ${topStrength.dimension.toLowerCase()} by ${topStrength.lead.toFixed(1)} points, indicating a competitive advantage to leverage.`)
    }
  }

  if (weaknesses.length > 0) {
    const topWeakness = weaknesses.sort((a, b) => b.gap - a.gap)[0]
    if (locale === 'de') {
      sentences.push(`Liegt bei ${topWeakness.dimension.toLowerCase()} um ${topWeakness.gap.toFixed(1)} Punkte zurück, was einen Prioritätsbereich für Verbesserungen darstellt.`)
    } else {
      sentences.push(`Trails peers in ${topWeakness.dimension.toLowerCase()} by ${topWeakness.gap.toFixed(1)} points, representing a priority area for improvement.`)
    }
  }

  if (sentences.length === 0) {
    const avgCompany = dims.reduce((sum, dim) => sum + companyScore[dim], 0) / dims.length
    const avgPeer = dims.reduce((sum, dim) => {
      const peerAvg = peerScores.reduce((s, p) => s + p[dim], 0) / peerScores.length
      return sum + peerAvg
    }, 0) / dims.length

    if (avgCompany > avgPeer + 0.2) {
      sentences.push(locale === 'de'
        ? 'Zeigt insgesamt stärkere Fähigkeiten im Vergleich zu Peers, mit besonderen Stärken in wichtigen operativen Bereichen.'
        : 'Demonstrates stronger overall capabilities compared to peers, with particular strengths in key operational areas.')
    } else if (avgPeer > avgCompany + 0.2) {
      sentences.push(locale === 'de'
        ? 'Zeigt Verbesserungsmöglichkeiten in mehreren Dimensionen im Vergleich zur Peer-Leistung.'
        : 'Shows opportunities for improvement across multiple dimensions relative to peer performance.')
    } else {
      sentences.push(locale === 'de'
        ? 'Zeigt ausgewogene Fähigkeiten im Vergleich zu Peers, mit Möglichkeiten zur Differenzierung durch gezielte Investitionen.'
        : 'Shows balanced capabilities relative to peers, with opportunities to differentiate through targeted investments.')
    }
  }

  if (sentences.length === 1 && strengths.length > 1) {
    const secondStrength = strengths.sort((a, b) => b.lead - a.lead)[1]
    sentences.push(locale === 'de'
      ? `Zusätzliche Stärke in ${secondStrength.dimension.toLowerCase()} positioniert weiterhin wettbewerbsfähig.`
      : `Additional strength in ${secondStrength.dimension.toLowerCase()} further positions competitively.`)
  } else if (sentences.length === 1 && weaknesses.length > 1) {
    const secondWeakness = weaknesses.sort((a, b) => b.gap - a.gap)[1]
    sentences.push(locale === 'de'
      ? `Die Behebung von Lücken in ${secondWeakness.dimension.toLowerCase()} könnte die Wettbewerbspositionierung beschleunigen.`
      : `Addressing gaps in ${secondWeakness.dimension.toLowerCase()} could accelerate competitive positioning.`)
  }

  return sentences.slice(0, 3).join(' ')
}
