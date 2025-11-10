import { Brief } from '@/lib/schema/brief'

const getLevelColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'high':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
    case 'medium':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
    case 'low':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
  }
}

function generateFeasibilityItems(data: Brief): Array<{ name: string; level: string; rationale: string }> {
  const industry = data.company?.industry || 'Professional Services'
  const companySize = data.company?.size || ''
  const useCases = data.use_cases || []
  
  // Assess based on industry and company context
  const hasData = useCases.some(uc => uc.data_requirements && uc.data_requirements !== 'TBD')
  const hasComplexUseCases = useCases.some(uc => uc.complexity >= 4)
  const avgComplexity = useCases.length > 0 
    ? useCases.reduce((sum, uc) => sum + uc.complexity, 0) / useCases.length 
    : 3
  
  // Industry-specific considerations
  const isRegulated = ['Financial Services', 'Healthcare', 'Energy & Utilities'].includes(industry)
  const isTechForward = ['Technology', 'Professional Services'].includes(industry)
  
  // Data readiness
  const dataLevel = hasData ? 'High' : (isTechForward ? 'Medium' : 'Low')
  const dataRationale = hasData 
    ? 'Use cases have clear data requirements'
    : isTechForward 
      ? `${industry} typically has structured data available`
      : `Data collection may be needed for ${industry.toLowerCase()}`
  
  // Leadership readiness
  const leadershipLevel = companySize.includes('100') || companySize.includes('200') || companySize.includes('500') 
    ? 'High' 
    : 'Medium'
  const leadershipRationale = companySize 
    ? `${companySize} organization has management structure for AI initiatives`
    : 'Leadership commitment needed for AI transformation'
  
  // Technical readiness
  const technicalLevel = isTechForward ? 'High' : (avgComplexity <= 3 ? 'Medium' : 'Low')
  const technicalRationale = isTechForward
    ? `${industry} has technical capabilities for AI adoption`
    : avgComplexity <= 3
      ? 'Use cases are moderate complexity, feasible with support'
      : 'Complex use cases may require technical partnerships'
  
  // Risk assessment
  const riskLevel = isRegulated ? 'Medium' : 'Low'
  const riskRationale = isRegulated
    ? `${industry} has regulatory considerations for AI deployment`
    : 'Standard business risks, manageable with proper planning'
  
  // Compliance
  const complianceLevel = isRegulated ? 'High' : 'Medium'
  const complianceRationale = isRegulated
    ? `${industry} requires compliance with industry regulations`
    : 'General data protection and business compliance standards apply'
  
  return [
    { name: 'Data', level: dataLevel, rationale: dataRationale },
    { name: 'Leadership', level: leadershipLevel, rationale: leadershipRationale },
    { name: 'Technical', level: technicalLevel, rationale: technicalRationale },
    { name: 'Risk', level: riskLevel, rationale: riskRationale },
    { name: 'Compliance', level: complianceLevel, rationale: complianceRationale }
  ]
}

export default function FeasibilityScan({ _data }: { _data: Brief }) {
  const items = generateFeasibilityItems(_data)
  
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Feasibility Scan</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Readiness assessment for {_data.company?.name || 'your company'} in the {_data.company?.industry || 'industry'} sector.
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((i) => (
          <div key={i.name} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{i.name}</span>
            </div>
            <div className={`rounded-full border px-2.5 py-1 text-xs font-medium text-center mb-2 ${getLevelColor(i.level)}`}>
              {i.level}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{i.rationale}</p>
          </div>
        ))}
      </div>
    </section>
  )
}


