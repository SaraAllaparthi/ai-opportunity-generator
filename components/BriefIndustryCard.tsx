import { Brief } from '@/lib/schema/brief'
import { confidenceFromCount, getConfidenceColor } from '@/lib/utils/citations'

// Match the same colors used in TrendImpactGrid
const TREND_COLORS = [
  '#14b8a6', // teal-500
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
]

// Extract trend name and value-add from format "Trend Name: value-add description"
function parseTrend(trend: string): { actionable: string; rest: string } {
  // Check if trend follows "Trend Name: value-add" format
  const colonIndex = trend.indexOf(':')
  
  if (colonIndex > 0 && colonIndex < trend.length - 1) {
    // Split at colon: trend name before, value-add after
    const trendName = trend.substring(0, colonIndex).trim()
    const valueAdd = trend.substring(colonIndex + 1).trim()
    
    return {
      actionable: trendName,
      rest: valueAdd
    }
  }
  
  // Fallback: If no colon, try to find action verbs or natural breaks
  const words = trend.split(' ')
  const actionVerbs = ['reduces', 'improves', 'increases', 'enhances', 'optimizes', 'enables', 'helps', 'allows', 'uses', 'provides', 'cuts', 'saves', 'boosts']
  let actionableEnd = -1
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[.,]/g, '')
    if (actionVerbs.includes(word)) {
      actionableEnd = i
      break
    }
  }
  
  // If we found an action verb, everything before it is the actionable part
  if (actionableEnd > 0) {
    const actionable = words.slice(0, actionableEnd).join(' ')
    const rest = words.slice(actionableEnd).join(' ')
    return { actionable, rest }
  }
  
  // Fallback: split at natural boundaries
  const separators = /[.—]|—/
  if (separators.test(trend)) {
    const parts = trend.split(separators)
    return {
      actionable: parts[0].trim(),
      rest: parts.slice(1).join(' ').trim()
    }
  }
  
  // Last resort: first 3-4 words as trend name
  const mainWords = Math.min(4, Math.floor(words.length * 0.4))
  return {
    actionable: words.slice(0, mainWords).join(' '),
    rest: words.slice(mainWords).join(' ')
  }
}

export default function IndustryCard({ data }: { data: Brief }) {
  const industry = data.industry
  const companyIndustry = data.company.industry
  const confidence = confidenceFromCount((data.citations||[]).length)
  const cardTitle = companyIndustry 
    ? `${companyIndustry} Industry Trends`
    : 'Industry Trends'
  
  const trends = (industry.trends || []).slice(0, 5)
  
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cardTitle}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceColor(confidence)}`}>Confidence {confidence}</span>
      </div>
      {industry.summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-5 leading-relaxed">{industry.summary}</p>
      )}
      <ul className="list-none pl-0 text-sm space-y-3">
        {trends.map((t, i) => {
          const { actionable, rest } = parseTrend(t)
          return (
            <li key={i} className="leading-relaxed flex items-start gap-3">
              <span
                className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                style={{
                  backgroundColor: TREND_COLORS[i % TREND_COLORS.length],
                  boxShadow: `0 0 8px ${TREND_COLORS[i % TREND_COLORS.length]}40`,
                }}
              />
              <div className="flex-1">
                <span className="font-semibold text-gray-900 dark:text-white">{actionable}</span>
                {rest && (
                  <span className="text-gray-600 dark:text-gray-400"> {rest}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}


