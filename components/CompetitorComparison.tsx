"use client"
import { Brief } from '@/lib/schema/brief'
import { useEffect, useState } from 'react'

// Calculate company's maturity scores based on available data
function calculateCompanyScores(data: Brief): { dimension: string; value: number }[] {
  const company = data.company
  const industry = data.industry
  const useCases = data.use_cases || []
  
  // Innovation Speed: Based on industry trends mentioning AI adoption
  const aiTrendsCount = (industry.trends || []).filter(t => 
    t.toLowerCase().includes('ai') || t.toLowerCase().includes('ml') || t.toLowerCase().includes('automation')
  ).length
  const innovationSpeed = Math.min(4.5, 2.5 + (aiTrendsCount * 0.5))
  
  // Operational Efficiency: Based on use cases targeting cost reduction
  const costUseCases = useCases.filter(u => u.value_driver === 'cost').length
  const efficiency = Math.min(4.5, 2.5 + (costUseCases * 0.4))
  
  // Personalization: Based on company size (smaller = better for personalization)
  const companySize = company.size || ''
  const isSmallCompany = /under|less|small|fewer|1-|10-|50-|100-|200-/.test(companySize.toLowerCase())
  const personalization = isSmallCompany ? 4.2 : 3.6
  
  // Data Readiness: Based on use case complexity (lower complexity = better readiness)
  const avgComplexity = useCases.length > 0 
    ? useCases.reduce((sum, u) => sum + (u.complexity || 3), 0) / useCases.length 
    : 3
  const dataReadiness = Math.max(2.5, 5.0 - avgComplexity * 0.6)
  
  // AI Adoption: Based on number of AI-focused use cases
  const aiUseCases = useCases.filter(u => 
    u.title.toLowerCase().includes('ai') || 
    u.description.toLowerCase().includes('ai') ||
    u.description.toLowerCase().includes('machine learning')
  ).length
  const aiAdoption = Math.min(4.5, 2.0 + (aiUseCases * 0.5))
  
  return [
    { dimension: 'Innovation Speed', value: innovationSpeed },
    { dimension: 'Operational Efficiency', value: efficiency },
    { dimension: 'Personalization', value: personalization },
    { dimension: 'Data Readiness', value: dataReadiness },
    { dimension: 'AI Adoption', value: aiAdoption }
  ]
}

// Estimate competitor scores based on their descriptions
function estimateCompetitorScores(competitor: Brief['competitors'][number], baseScores: { dimension: string; value: number }[]): { dimension: string; value: number }[] {
  // Use all available competitor data: positioning, size_band, hq for scoring
  const positioning = competitor.positioning || ''
  const sizeBand = competitor.size_band || ''
  const hq = competitor.hq || ''
  const combined = `${positioning} ${sizeBand} ${hq}`.toLowerCase()
  
  // Adjust scores based on competitor descriptions
  const adjustments: Record<string, number> = {}
  
  // AI Adoption: Higher if they mention AI/digital/automation
  if (combined.includes('ai') || combined.includes('digital') || combined.includes('automation') || combined.includes('smart')) {
    adjustments['AI Adoption'] = 0.8
  } else {
    adjustments['AI Adoption'] = -0.5
  }
  
  // Innovation Speed: Higher if they mention innovation/speed/agile
  if (combined.includes('innovation') || combined.includes('fast') || combined.includes('agile') || combined.includes('cutting-edge')) {
    adjustments['Innovation Speed'] = 0.6
  } else {
    adjustments['Innovation Speed'] = -0.3
  }
  
  // Efficiency: Higher if they mention efficiency/optimization/cost
  if (combined.includes('efficiency') || combined.includes('optimiz') || combined.includes('cost') || combined.includes('productivity')) {
    adjustments['Operational Efficiency'] = 0.5
  } else {
    adjustments['Operational Efficiency'] = -0.2
  }
  
  // Personalization: Higher for smaller/regional companies
  if (combined.includes('regional') || combined.includes('local') || combined.includes('niche') || combined.includes('specialized')) {
    adjustments['Personalization'] = 0.4
  } else if (combined.includes('large') || combined.includes('scale')) {
    adjustments['Personalization'] = -0.3
  }
  
  // Data Readiness: Higher if they mention data/analytics/insights
  if (combined.includes('data') || combined.includes('analytic') || combined.includes('insight') || combined.includes('predictive')) {
    adjustments['Data Readiness'] = 0.6
  } else {
    adjustments['Data Readiness'] = -0.3
  }
  
  return baseScores.map(score => ({
    dimension: score.dimension,
    value: Math.max(1.0, Math.min(5.0, score.value + (adjustments[score.dimension] || 0)))
  }))
}

// Generate strategic insight - one sentence, action-oriented
function generateStrategicInsight(
  companyScores: { dimension: string; value: number }[],
  competitorScores: Array<{ dimension: string; value: number }[]>
): string {
  if (competitorScores.length === 0) {
    return 'Focus on data readiness and AI adoption to create sustainable competitive advantages in the next 12 months.'
  }
  
  // Find dimensions where company is below peer average
  const weakDimensions = companyScores
    .map(s => {
      const compAvg = competitorScores.reduce((sum, comp) => {
        const compScore = comp.find(c => c.dimension === s.dimension)?.value || 3.0
        return sum + compScore
      }, 0) / competitorScores.length
      return { dimension: s.dimension, gap: compAvg - s.value, companyScore: s.value, compAvg }
    })
    .filter(d => d.gap > 0.2)
    .sort((a, b) => b.gap - a.gap)
  
  if (weakDimensions.length > 0) {
    const topGap = weakDimensions[0]
    const dimensionMap: Record<string, string> = {
      'data readiness': 'data-readiness',
      'ai adoption': 'AI adoption',
      'operational efficiency': 'operational efficiency',
      'innovation speed': 'innovation speed',
      'personalization': 'personalization'
    }
    const dimKey = dimensionMap[topGap.dimension.toLowerCase()] || topGap.dimension.toLowerCase()
    
    // Generate specific, action-oriented insight
    if (topGap.dimension.toLowerCase().includes('data readiness')) {
      return `Close the data-readiness gap to outperform peers on lead time and quality.`
    } else if (topGap.dimension.toLowerCase().includes('ai adoption')) {
      return `Accelerate AI adoption to match peer capabilities and gain competitive edge.`
    } else if (topGap.dimension.toLowerCase().includes('efficiency')) {
      return `Improve operational efficiency to compete on cost and speed with regional peers.`
    } else if (topGap.dimension.toLowerCase().includes('innovation')) {
      return `Increase innovation speed to keep pace with market leaders and capture opportunities faster.`
    } else {
      return `Strengthen ${dimKey} to outperform peers in agility and customer responsiveness.`
    }
  }
  
  // Find strongest dimension to leverage
  const strongDimensions = companyScores
    .map(s => {
      const compAvg = competitorScores.reduce((sum, comp) => {
        const compScore = comp.find(c => c.dimension === s.dimension)?.value || 3.0
        return sum + compScore
      }, 0) / competitorScores.length
      return { dimension: s.dimension, lead: s.value - compAvg }
    })
    .filter(d => d.lead > 0.2)
    .sort((a, b) => b.lead - a.lead)
  
  if (strongDimensions.length > 0) {
    const topStrength = strongDimensions[0]
    const strengthMap: Record<string, string> = {
      'personalization': 'personalization capabilities',
      'data readiness': 'data readiness',
      'ai adoption': 'AI maturity',
      'operational efficiency': 'efficiency focus',
      'innovation speed': 'innovation agility'
    }
    const strengthKey = strengthMap[topStrength.dimension.toLowerCase()] || topStrength.dimension.toLowerCase()
    return `Leverage your ${strengthKey} to differentiate and capture market share faster.`
  }
  
  return 'Focus on data readiness and AI adoption to create sustainable competitive advantages in the next 12 months.'
}

export default function CompetitorComparison({ data }: { data: Brief }) {
  const [R, setR] = useState<any>(null)
  useEffect(() => { (async () => setR(await import('recharts')))() }, [])
  
  const companyScores = calculateCompanyScores(data)
  const competitors = (data.competitors || []).filter(c => c && c.name && c.name.trim()).slice(0, 3) // Top 3 competitors
  const hasCompetitors = competitors.length > 0
  
  // Calculate competitor scores
  const competitorScoresList = competitors.map(c => estimateCompetitorScores(c, companyScores))
  
  // Create radar chart data - format: [{ dimension: '...', Company: X, Peer1: Y, Peer2: Z }]
  const chartData = companyScores.map(score => {
    const entry: any = {
      dimension: score.dimension,
      [data.company.name]: Math.round(score.value * 10) / 10
    }
    
    competitors.forEach((comp, i) => {
      const compScore = competitorScoresList[i].find(s => s.dimension === score.dimension)
      entry[comp.name] = compScore ? Math.round(compScore.value * 10) / 10 : 3.0
    })
    
    return entry
  })
  
  const colors = ['#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
  const strategicInsight = generateStrategicInsight(companyScores, competitorScoresList)
  
  // Only show chart if we have real competitors - no industry average fallback
  const chartDataForDisplay = hasCompetitors ? chartData : null
  
  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Peer Comparison</h4>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {hasCompetitors 
            ? `Visual representation of how ${data.company.name} compares against its competitors`
            : `Competitive positioning based on market analysis`
          }
        </p>
      </div>
      
      <div className="h-[480px] w-full">
        {!R ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading chart…</div>
        ) : !hasCompetitors || !chartDataForDisplay ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400">
            Peer comparison data will be displayed once research completes.
          </div>
        ) : (
          <R.ResponsiveContainer width="100%" height="100%">
            <R.RadarChart data={chartDataForDisplay} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <R.PolarGrid stroke="#e5e7eb" strokeOpacity={0.3} />
              <R.PolarAngleAxis 
                dataKey="dimension" 
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-700 dark:text-gray-300"
              />
              <R.PolarRadiusAxis 
                angle={90} 
                domain={[0, 5]} 
                tickCount={6}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-gray-500 dark:text-gray-400"
              />
              <R.Tooltip 
                formatter={(value: number) => value.toFixed(1)}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
              <R.Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <R.Radar
                name={data.company.name}
                dataKey={data.company.name}
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 4 }}
              />
              {competitors.map((comp, i) => (
                <R.Radar
                  key={comp.name}
                  name={comp.name}
                  dataKey={comp.name}
                  stroke={colors[(i + 1) % colors.length]}
                  fill={colors[(i + 1) % colors.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  strokeDasharray={i === 0 ? '5 5' : undefined}
                  dot={{ fill: colors[(i + 1) % colors.length], r: 3 }}
                />
              ))}
            </R.RadarChart>
          </R.ResponsiveContainer>
        )}
      </div>
      
      {/* Strategic Insight */}
      <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">Strategic Insight</div>
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          {hasCompetitors ? strategicInsight : 'Peer comparison requires live competitor data from searches.'}
        </p>
      </div>
    </div>
  )
}
