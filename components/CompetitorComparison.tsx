'use client'

import { Brief } from '@/lib/schema/brief'
import { useEffect, useState, useMemo, useRef } from 'react'
import { researchCompetitorCapabilities } from '@/lib/providers/perplexity'

type CompetitorCapabilities = {
  ai_adoption: number
  innovation_speed: number
  operational_efficiency: number
  market_position: number
  technology_maturity: number
  customer_focus: number
  insights: string[]
}

type CompetitorWithCapabilities = {
  name: string
  website: string
  hq?: string
  capabilities: CompetitorCapabilities
}

const sanitizeKey = (name: string) => `k_${(name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_')}`

export default function CompetitorComparison({ data }: { data: Brief }) {
  // CRITICAL: Validate data prop is actually received
  if (!data) {
    console.error('[CompetitorComparison] ❌ CRITICAL: No data prop received!')
    return (
      <div className="w-full p-4 text-sm text-red-500">
        <div className="mb-2">Error: Component did not receive data prop</div>
        <div className="text-xs">This is a data flow issue - check how component is called</div>
      </div>
    )
  }
  
  // Debug: Log component initialization
  console.log('[CompetitorComparison] Component rendering with data:', {
    hasData: !!data,
    hasCompany: !!data?.company,
    companyName: data?.company?.name,
    competitorsCount: data?.competitors?.length || 0,
    competitors: data?.competitors?.map(c => ({ name: c?.name, website: c?.website })) || []
  })

  const [R, setR] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [companyCapabilities, setCompanyCapabilities] = useState<CompetitorCapabilities | null>(null)
  const [competitorCapabilities, setCompetitorCapabilities] = useState<CompetitorWithCapabilities[]>([])
  const [insights, setInsights] = useState<string[]>([])

  // Safe guards for possibly-missing data on first render
  const companyName = data?.company?.name ?? ''
  const companyWebsite = data?.company?.website ?? ''
  const companyIndustry = data?.company?.industry ?? data?.industry?.summary ?? ''
  const companyHq = data?.company?.headquarters

  useEffect(() => setMounted(true), [])

  // Lazy-load recharts only on client
  useEffect(() => {
    ;(async () => {
      try {
        const recharts = await import('recharts')
        console.log('[CompetitorComparison] Recharts loaded:', {
          hasResponsiveContainer: !!recharts.ResponsiveContainer,
          hasRadarChart: !!recharts.RadarChart,
          keys: Object.keys(recharts).slice(0, 10)
        })
        setR(recharts)
      } catch (err) {
        console.error('[CompetitorComparison] Failed to load recharts:', err)
        setError('Failed to load chart library')
      }
    })()
  }, [])

  const competitors = useMemo(() => {
    const filtered = (data?.competitors || [])
      .filter(c => c && c.name && c.name.trim())
      .slice(0, 3)
    console.log('[CompetitorComparison] Filtered competitors:', {
      rawCount: data?.competitors?.length || 0,
      filteredCount: filtered.length,
      competitors: filtered.map(c => ({ name: c.name, website: c.website }))
    })
    return filtered
  }, [data?.competitors])

  const hasCompetitors = competitors.length > 0
  
  // Debug: Log competitor status
  console.log('[CompetitorComparison] Competitor status:', {
    hasCompetitors,
    competitorsCount: competitors.length,
    companyName,
    companyWebsite
  })
  const competitorIds = useMemo(
    () => competitors.map(c => `${c.name}|${c.website}`).join(','),
    [competitors]
  )

  const researchCompletedRef = useRef(false)
  const researchKeyRef = useRef<string>('')

  useEffect(() => {
    console.log('[CompetitorComparison] useEffect triggered:', {
      mounted,
      hasCompetitors,
      companyName: companyName || 'MISSING',
      companyWebsite: companyWebsite || 'MISSING',
      competitorIds
    })

    // Early exits if required inputs aren't ready
    if (!mounted) {
      console.log('[CompetitorComparison] ⏸️ Early exit: not mounted')
      return
    }
    if (!hasCompetitors) {
      console.log('[CompetitorComparison] ⏸️ Early exit: no competitors')
      setLoading(false)
      return
    }
    if (!companyName || !companyWebsite) {
      console.log('[CompetitorComparison] ⏸️ Early exit: missing company name or website', { companyName, companyWebsite })
      setLoading(false)
      return
    }

    const currentResearchKey = `${companyName}|${companyWebsite}|${competitorIds}`
    if (researchCompletedRef.current && researchKeyRef.current === currentResearchKey) {
      console.log('[CompetitorComparison] ⏸️ Early exit: already researched this key')
      return
    }

    console.log('[CompetitorComparison] ✅ Starting research with key:', currentResearchKey)

    const run = async () => {
      setLoading(true)
      setError(null)
      researchKeyRef.current = currentResearchKey

      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.warn('[CompetitorComparison] ⏱️ Research timeout - showing fallback')
        setLoading(false)
        setError('Research timed out. Please refresh the page to retry.')
      }, 120000) // 2 minutes timeout

      try {
        console.log('[CompetitorComparison] 🔍 Researching company capabilities...')
        const companyCaps = await researchCompetitorCapabilities(
          companyName,
          companyWebsite,
          companyIndustry,
          companyHq
        )
        console.log('[CompetitorComparison] ✅ Company capabilities received:', companyCaps)
        setCompanyCapabilities(companyCaps)

        console.log('[CompetitorComparison] 🔍 Researching', competitors.length, 'competitors...')
        const competitorCaps = await Promise.all(
          competitors.map(async comp => {
            try {
              console.log('[CompetitorComparison] 🔍 Researching competitor:', comp.name)
              const caps = await researchCompetitorCapabilities(
                comp.name,
                comp.website,
                companyIndustry,
                comp.hq
              )
              console.log('[CompetitorComparison] ✅ Competitor capabilities received for', comp.name, ':', caps)
              return { name: comp.name, website: comp.website, hq: comp.hq, capabilities: caps }
            } catch (e) {
              console.error('[CompetitorComparison] ❌ Competitor research failed:', comp.name, e)
              // Return default values on error - component will still render
              return {
                name: comp.name,
                website: comp.website,
                hq: comp.hq,
                capabilities: {
                  ai_adoption: 3.0,
                  innovation_speed: 3.0,
                  operational_efficiency: 3.0,
                  market_position: 3.0,
                  technology_maturity: 3.0,
                  customer_focus: 3.0,
                  insights: [`Research unavailable for ${comp.name}`]
                }
              }
            }
          })
        )
        console.log('[CompetitorComparison] ✅ All competitor capabilities received:', competitorCaps.length, 'competitors')
        setCompetitorCapabilities(competitorCaps)

        const generatedInsights = generateInsights(companyCaps, competitorCaps, companyName)
        console.log('[CompetitorComparison] ✅ Generated insights:', generatedInsights.length, 'insights')
        setInsights(generatedInsights)

        researchCompletedRef.current = true
        console.log('[CompetitorComparison] ✅ Research completed successfully')
        clearTimeout(timeoutId)
      } catch (e: any) {
        console.error('[CompetitorComparison] ❌ Research error:', e)
        setError(`Failed to research competitors: ${e?.message ?? String(e)}`)
        clearTimeout(timeoutId)
      } finally {
        setLoading(false)
        console.log('[CompetitorComparison] ⏹️ Research finished, loading set to false')
      }
    }

    run()
    // NOTE: all deps are safe-guarded with nullish coalescing above
  }, [mounted, hasCompetitors, companyName, companyWebsite, companyIndustry, companyHq, competitorIds])

  // Build chart data with sanitized keys (avoid spaces)
  const dimensions = [
    { label: 'AI Adoption', key: 'ai_adoption' },
    { label: 'Innovation Speed', key: 'innovation_speed' },
    { label: 'Operational Efficiency', key: 'operational_efficiency' },
    { label: 'Market Position', key: 'market_position' },
    { label: 'Technology Maturity', key: 'technology_maturity' },
    { label: 'Customer Focus', key: 'customer_focus' }
  ] as const

  const companyKey = sanitizeKey(companyName)
  const competitorKeyMap = useMemo(() => {
    const m: Record<string, string> = {}
    competitors.forEach(c => { m[c.name] = sanitizeKey(c.name) })
    return m
  }, [competitors])

  const chartData = companyCapabilities && competitorCapabilities.length > 0
    ? dimensions.map(({ label, key }) => {
        const row: Record<string, any> = { dimension: label }
        const companyValue = companyCapabilities[key as keyof CompetitorCapabilities] as number
        row[companyKey] = companyValue
        
        competitorCapabilities.forEach(comp => {
          const compKey = competitorKeyMap[comp.name]
          if (compKey) {
            const compValue = comp.capabilities[key as keyof CompetitorCapabilities] as number
            row[compKey] = compValue
          }
        })
        
        console.log(`[CompetitorComparison] Chart row for ${label}:`, {
          dimension: label,
          companyKey,
          companyValue,
          competitorKeys: Object.keys(row).filter(k => k !== 'dimension' && k !== companyKey),
          rowKeys: Object.keys(row)
        })
        
        return row
      })
    : []
  
  // Debug: Log chart data creation
  console.log('[CompetitorComparison] Chart data created:', {
    hasCompanyCapabilities: !!companyCapabilities,
    competitorCapabilitiesCount: competitorCapabilities.length,
    chartDataLength: chartData.length,
    chartDataKeys: chartData.length > 0 ? Object.keys(chartData[0]) : [],
    firstRowSample: chartData.length > 0 ? chartData[0] : null
  })

  const colors = ['#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

  // Debug: Log render state
  console.log('[CompetitorComparison] Render state:', {
    mounted,
    hasR: !!R,
    loading,
    error,
    hasCompanyCapabilities: !!companyCapabilities,
    competitorCapabilitiesCount: competitorCapabilities.length,
    chartDataLength: chartData.length,
    hasCompetitors,
    companyKey,
    competitorKeyMap,
    chartDataSample: chartData.length > 0 ? chartData[0] : null
  })
  
  // Debug: Log why chart might not be rendering
  if (hasCompetitors && !loading && !error && chartData.length === 0) {
    console.warn('[CompetitorComparison] ⚠️ Chart data is empty but should have data:', {
      hasCompanyCapabilities: !!companyCapabilities,
      competitorCapabilitiesCount: competitorCapabilities.length,
      expectedCompetitors: competitors.length,
      companyCapabilitiesSample: companyCapabilities ? {
        ai_adoption: companyCapabilities.ai_adoption,
        innovation_speed: companyCapabilities.innovation_speed
      } : null,
      competitorCapabilitiesSample: competitorCapabilities.length > 0 ? {
        name: competitorCapabilities[0].name,
        ai_adoption: competitorCapabilities[0].capabilities.ai_adoption
      } : null
    })
  }

  // If no competitors, show a message instead of returning null
  if (!hasCompetitors) {
    console.log('[CompetitorComparison] ⚠️ No competitors found - showing message')
    return (
      <div className="w-full">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Peer Comparison</h4>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Peer comparison requires competitor data from the Competitive Position section.
          </p>
        </div>
        <div className="h-[480px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="mb-2">No competitors found in the brief data.</div>
            <div className="text-xs">Raw competitors count: {data?.competitors?.length || 0}</div>
            <div className="text-xs mt-2">Check server logs for data flow details</div>
          </div>
        </div>
      </div>
    )
  }
  
  // Always render the section header - don't hide it even during loading
  // This ensures the section is visible and not blank

  // Always render - never return null if we have competitors
  // This ensures the section is always visible, even if research is in progress or fails
  // Always render something - never be completely blank
  // Show section header and status immediately
  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Peer Comparison</h4>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {hasCompetitors
            ? `Comparative analysis of ${companyName} against ${competitors.length} competitor${competitors.length > 1 ? 's' : ''} from the Competitive Position section`
            : 'Loading competitor data...'}
        </p>
      </div>

      <div className="min-h-[550px] w-full flex items-center justify-center py-4">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-red-500 dark:text-red-400 border-2 border-red-500 rounded p-4">
            <div className="mb-2 font-semibold">Error: {error}</div>
            <div className="text-xs text-gray-500">Check browser console for details</div>
            <div className="text-xs mt-2">Competitors found: {competitors.length}</div>
            <div className="text-xs">This error occurred during research. The chart cannot be displayed.</div>
            <div className="text-xs mt-4 p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <strong>Debug Info:</strong><br/>
              Company: {companyName || 'MISSING'}<br/>
              Competitors: {competitors.length} found<br/>
              Research Status: Failed
            </div>
            {/* Show table even on error */}
            <div className="mt-4 w-full max-h-64 overflow-auto border-2 border-gray-400 rounded">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border p-2 text-left">Dimension</th>
                    <th className="border p-2">{companyName}</th>
                    {competitorCapabilities.map(comp => (
                      <th key={comp.name} className="border p-2">{comp.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map(({ label, key }) => (
                    <tr key={key}>
                      <td className="border p-2 font-medium">{label}</td>
                      <td className="border p-2 text-center">
                        {companyCapabilities ? (companyCapabilities[key as keyof CompetitorCapabilities] as number).toFixed(1) : '-'}
                      </td>
                      {competitorCapabilities.map(comp => (
                        <td key={comp.name} className="border p-2 text-center">
                          {(comp.capabilities[key as keyof CompetitorCapabilities] as number).toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !mounted || !R ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-gray-600 dark:text-gray-400 border-2 border-gray-400 rounded p-4">
            <div className="mb-2">{!mounted ? 'Initializing component…' : 'Loading chart library…'}</div>
            <div className="text-xs">Competitors: {competitors.length} found</div>
            {/* Show table while loading */}
            {companyCapabilities && competitorCapabilities.length > 0 && (
              <div className="mt-4 w-full max-h-64 overflow-auto border-2 border-gray-400 rounded">
                <div className="text-xs mb-2 p-2 bg-blue-50">Data available - showing table while chart loads:</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border p-2 text-left">Dimension</th>
                      <th className="border p-2">{companyName}</th>
                      {competitorCapabilities.map(comp => (
                        <th key={comp.name} className="border p-2">{comp.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map(({ label, key }) => (
                      <tr key={key}>
                        <td className="border p-2 font-medium">{label}</td>
                        <td className="border p-2 text-center">
                          {(companyCapabilities[key as keyof CompetitorCapabilities] as number).toFixed(1)}
                        </td>
                        {competitorCapabilities.map(comp => (
                          <td key={comp.name} className="border p-2 text-center">
                            {(comp.capabilities[key as keyof CompetitorCapabilities] as number).toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-gray-600 dark:text-gray-400 border-2 border-blue-400 rounded p-4">
            <div className="mb-2 font-semibold">Researching competitors with Perplexity AI…</div>
            <div className="text-xs mt-2">This may take 30-60 seconds</div>
            <div className="text-xs">Found {competitors.length} competitor{competitors.length > 1 ? 's' : ''} to research</div>
            <div className="text-xs mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <strong>Researching:</strong><br/>
              • {companyName}<br/>
              {competitors.map(c => `• ${c.name}`).map((line, i) => (
                <span key={i}>{line}<br/></span>
              ))}
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400 border-2 border-orange-400 rounded p-4">
            <div className="mb-2 font-semibold">Unable to generate comparison chart</div>
            <div className="text-xs">Company data: {companyCapabilities ? 'loaded' : 'missing'}</div>
            <div className="text-xs">Competitor data: {competitorCapabilities.length} loaded (expected: {competitors.length})</div>
            <div className="text-xs mt-2">Chart data points: {chartData.length}</div>
            <div className="text-xs">Competitors in data: {competitors.length}</div>
            <div className="text-xs">Check browser console (F12) for debugging info</div>
            {competitorCapabilities.length < competitors.length && (
              <div className="text-xs mt-2 text-yellow-600">
                ⚠️ Some competitor research may have failed. Check console for errors.
              </div>
            )}
            {/* Show table if we have data */}
            {companyCapabilities && competitorCapabilities.length > 0 && (
              <div className="mt-4 w-full max-h-64 overflow-auto border-2 border-gray-400 rounded">
                <div className="text-xs mb-2 p-2 bg-blue-50">Showing data table:</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border p-2 text-left">Dimension</th>
                      <th className="border p-2">{companyName}</th>
                      {competitorCapabilities.map(comp => (
                        <th key={comp.name} className="border p-2">{comp.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map(({ label, key }) => (
                      <tr key={key}>
                        <td className="border p-2 font-medium">{label}</td>
                        <td className="border p-2 text-center">
                          {(companyCapabilities[key as keyof CompetitorCapabilities] as number).toFixed(1)}
                        </td>
                        {competitorCapabilities.map(comp => (
                          <td key={comp.name} className="border p-2 text-center">
                            {(comp.capabilities[key as keyof CompetitorCapabilities] as number).toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : !R || !R.ResponsiveContainer || !R.RadarChart ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-yellow-600 dark:text-yellow-400 border-2 border-yellow-500 rounded p-4">
            <div className="mb-2 font-semibold">Chart library not fully loaded</div>
            <div className="text-xs">R: {R ? 'exists' : 'missing'}</div>
            <div className="text-xs">ResponsiveContainer: {R?.ResponsiveContainer ? 'exists' : 'missing'}</div>
            <div className="text-xs">RadarChart: {R?.RadarChart ? 'exists' : 'missing'}</div>
            <div className="text-xs mt-2">Chart data is ready ({chartData.length} dimensions) but chart cannot render</div>
            {/* ALWAYS show table when chart can't render */}
            <div className="mt-4 w-full max-h-64 overflow-auto border-2 border-gray-400 rounded bg-white dark:bg-gray-800">
              <div className="text-xs mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 font-semibold">Data Table (Chart unavailable):</div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border p-2 text-left">Dimension</th>
                    <th className="border p-2">{companyName}</th>
                    {competitorCapabilities.map(comp => (
                      <th key={comp.name} className="border p-2">{comp.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map(({ label, key }) => (
                    <tr key={key}>
                      <td className="border p-2 font-medium">{label}</td>
                      <td className="border p-2 text-center">
                        {(companyCapabilities![key as keyof CompetitorCapabilities] as number).toFixed(1)}
                      </td>
                      {competitorCapabilities.map(comp => (
                        <td key={comp.name} className="border p-2 text-center">
                          {(comp.capabilities[key as keyof CompetitorCapabilities] as number).toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center" style={{ height: '480px', minHeight: '480px' }}>
            {(() => {
              if (!R || !R.RadarChart) {
                return (
                  <div className="flex items-center justify-center h-full text-sm text-yellow-600">
                    <div>
                      <div className="mb-2">Chart components missing</div>
                      <div className="text-xs">R: {R ? '✓' : '✗'}</div>
                      <div className="text-xs">RadarChart: {R?.RadarChart ? '✓' : '✗'}</div>
                    </div>
                  </div>
                )
              }
              
              try {
                const RadarChart = R.RadarChart
                const PolarGrid = R.PolarGrid
                const PolarAngleAxis = R.PolarAngleAxis
                const PolarRadiusAxis = R.PolarRadiusAxis
                const Tooltip = R.Tooltip
                const Legend = R.Legend
                const Radar = R.Radar
                
                const containerWidth = 650
                const containerHeight = 550
                
                return (
                  <div className="w-full flex items-center justify-center">
                    <RadarChart 
                      width={containerWidth} 
                      height={containerHeight}
                      data={chartData} 
                      margin={{ top: 80, right: 80, bottom: 80, left: 80 }}
                    >
                      <PolarGrid 
                        stroke="#e5e7eb" 
                        strokeOpacity={0.3} 
                        strokeWidth={1} 
                      />
                      <PolarAngleAxis 
                        dataKey="dimension" 
                        tick={{ fontSize: 12, fill: 'currentColor', fontWeight: 500 }} 
                        tickLine={false}
                        tickFormatter={(value) => value}
                      />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 5]} 
                        tickCount={6} 
                        tick={{ fontSize: 10, fill: '#6b7280' }} 
                        axisLine={false}
                      />
                      <Tooltip 
                        formatter={(value: number) => (typeof value === 'number' ? value.toFixed(1) : value)} 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px 12px'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '30px' }} 
                        iconType="line"
                        formatter={(value: string) => <span style={{ fontSize: '12px', color: 'currentColor' }}>{value}</span>}
                      />
                      <Radar
                        name={companyName || 'Company'}
                        dataKey={companyKey}
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.2}
                        strokeWidth={2.5}
                        dot={{ fill: '#2563eb', r: 4 }}
                      />
                      {competitorCapabilities.map((comp, i) => {
                        const compKey = competitorKeyMap[comp.name]
                        if (!compKey) return null
                        return (
                          <Radar
                            key={compKey}
                            name={comp.name}
                            dataKey={compKey}
                            stroke={colors[i % colors.length]}
                            fill={colors[i % colors.length]}
                            fillOpacity={0.15}
                            strokeWidth={2}
                            strokeDasharray={i === 0 ? '5 5' : undefined}
                            dot={{ fill: colors[i % colors.length], r: 3 }}
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
                    <div className="text-xs">{chartError?.message || String(chartError)}</div>
                  </div>
                )
              }
            })()}
          </div>
        )}
      </div>

      {insights.length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-2">Key Insights</div>
          <ul className="space-y-1.5">
            {insights.map((insight, i) => (
              <li key={i} className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function generateInsights(
  companyCaps: CompetitorCapabilities,
  competitorCaps: CompetitorWithCapabilities[],
  companyName: string
): string[] {
  const insights: string[] = []
  if (competitorCaps.length === 0) return insights

  const dims: Array<keyof CompetitorCapabilities> = [
    'ai_adoption','innovation_speed','operational_efficiency','market_position','technology_maturity','customer_focus'
  ]
  const labels: Record<keyof CompetitorCapabilities, string> = {
    ai_adoption: 'AI Adoption',
    innovation_speed: 'Innovation Speed',
    operational_efficiency: 'Operational Efficiency',
    market_position: 'Market Position',
    technology_maturity: 'Technology Maturity',
    customer_focus: 'Customer Focus',
    insights: 'Insights'
  }

  const strengths: Array<{ dimension: string; lead: number }> = []
  const weaknesses: Array<{ dimension: string; gap: number }> = []

  dims.forEach(dim => {
    const companyScore = companyCaps[dim] as number
    const avgComp = competitorCaps.reduce((s, c) => s + (c.capabilities[dim] as number), 0) / competitorCaps.length
    const diff = companyScore - avgComp
    if (diff > 0.3) strengths.push({ dimension: labels[dim], lead: diff })
    if (-diff > 0.3) weaknesses.push({ dimension: labels[dim], gap: -diff })
  })

  if (strengths.length) {
    const top = strengths.sort((a,b) => b.lead - a.lead)[0]
    insights.push(`${companyName} leads peers in ${top.dimension.toLowerCase()} by ${top.lead.toFixed(1)} points, indicating a competitive advantage to leverage.`)
  }
  if (weaknesses.length) {
    const top = weaknesses.sort((a,b) => b.gap - a.gap)[0]
    insights.push(`${companyName} trails peers in ${top.dimension.toLowerCase()} by ${top.gap.toFixed(1)} points, representing a priority area for improvement.`)
  }

  const aiGap = competitorCaps.reduce((s, c) => s + c.capabilities.ai_adoption, 0) / competitorCaps.length - companyCaps.ai_adoption
  if (Math.abs(aiGap) > 0.5) {
    insights.push(aiGap > 0
      ? `Competitors show ${aiGap.toFixed(1)} points higher AI adoption on average, suggesting accelerated AI investment could close the gap.`
      : `${companyName} leads in AI adoption by ${Math.abs(aiGap).toFixed(1)} points, indicating strong technology positioning.`
    )
  }

  const mpGap = competitorCaps.reduce((s, c) => s + c.capabilities.market_position, 0) / competitorCaps.length - companyCaps.market_position
  if (Math.abs(mpGap) > 0.5) {
    insights.push(mpGap > 0
      ? `Peers hold stronger market positions on average, highlighting the need for strategic differentiation.`
      : `${companyName} maintains a stronger market position than peers, providing a solid foundation for growth.`
    )
  }

  const effGap = competitorCaps.reduce((s, c) => s + c.capabilities.operational_efficiency, 0) / competitorCaps.length - companyCaps.operational_efficiency
  if (Math.abs(effGap) > 0.5) {
    insights.push(effGap > 0
      ? `Competitors demonstrate higher operational efficiency, suggesting opportunities for process optimization and cost reduction.`
      : `${companyName} operates more efficiently than peers, providing cost advantages and margin benefits.`
    )
  }

  return insights.slice(0, 5)
}
