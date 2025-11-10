import { Brief } from '@/lib/schema/brief'
import { getDomain, confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

// Generate strategic comparison when competitors are unavailable
function generateStrategicComparison(data: Brief): string {
  const company = data.company
  const industry = data.company.industry || 'the industry'
  const companyName = company.name
  
  // Infer representative peer description based on available data
  let peerDescription = ''
  if (industry) {
    peerDescription = `regional firms adopting AI in ${industry.toLowerCase()}`
  } else {
    peerDescription = 'similar-size peers in the same sector'
  }
  
  return `${companyName} competes alongside ${peerDescription}. Most companies with under 500 employees face similar constraints: limited resources for AI investment, reliance on manual processes, and slower innovation cycles compared to large enterprises. However, SMBs have inherent advantages—agility, personalization capabilities, and faster decision-making. The opportunity lies in using AI to amplify these strengths: moving faster than larger competitors, delivering more personalized customer experiences, and building data-driven efficiency that scales without linear cost increases.`
}

export default function CompetitorsCard({ data }: { data: Brief }) {
  // Debug: Log what we receive
  console.log('[CompetitorsCard] Received data:')
  console.log('  Has competitors field:', 'competitors' in data)
  console.log('  Competitors type:', Array.isArray(data.competitors) ? 'array' : typeof data.competitors)
  console.log('  Competitors length:', data.competitors?.length || 0)
  console.log('  Competitors raw:', JSON.stringify(data.competitors || [], null, 2))
  if (data.competitors && data.competitors.length > 0) {
    console.log('  First competitor:', JSON.stringify(data.competitors[0], null, 2))
  }
  
  const competitors = (data.competitors || []).filter(c => c && c.name && c.name.trim())
  
  // Debug: Log after filtering
  console.log('[CompetitorsCard] After filtering:')
  console.log('  Original count:', (data.competitors || []).length)
  console.log('  Filtered count:', competitors.length)
  if (competitors.length > 0) {
    console.log('  Filtered competitors:', JSON.stringify(competitors.map(c => ({ name: c.name, website: c.website })), null, 2))
  } else {
    console.log('  ⚠️ All competitors filtered out!')
    if ((data.competitors || []).length > 0) {
      console.log('  Why filtered out? Sample competitor:', JSON.stringify((data.competitors || [])[0], null, 2))
    }
  }
  
  // Use evidence_pages count for confidence instead of citations
  const confidence = confidenceFromCount(competitors.reduce((a,c)=>a+(c.evidence_pages?.length||0),0))
  const hasCompetitors = competitors.length > 0
  
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Competitive Position</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Understanding where you stand relative to peers helps prioritize AI investments that deliver competitive advantage.</p>
      {!hasCompetitors ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic leading-relaxed">
          Peer analysis is being generated from verified industry sources.
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
            {(() => {
              const competitorNames = competitors.map(c => c.name)
              let competitorText = ''
              if (competitorNames.length === 1) {
                competitorText = competitorNames[0]
              } else if (competitorNames.length === 2) {
                competitorText = `${competitorNames[0]} and ${competitorNames[1]}`
              } else {
                competitorText = `${competitorNames.slice(0, -1).join(', ')}, and ${competitorNames[competitorNames.length - 1]}`
              }
              
              const industryText = data.company.industry 
                ? `the ${data.company.industry.toLowerCase()} sector`
                : 'your industry'
              
              return `${data.company.name} competes alongside ${competitorText} in ${industryText}.`
            })()}
          </div>
          <ul className="space-y-3 text-sm">
            {competitors.slice(0, 3).map((c, i) => (
              <li key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white mb-1">{c.name}</div>
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        {c.website}
                      </a>
                    )}
                  </div>
                </div>
                {c.positioning && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">{c.positioning}</div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {c.hq && (
                    <span>📍 {c.hq}</span>
                  )}
                  {c.size_band && (
                    <span>👥 {c.size_band}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}


