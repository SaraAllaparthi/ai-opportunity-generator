import { Brief } from '@/lib/schema/brief'

const getLevelColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'high':
      return 'bg-green-500/20 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-500 dark:border-green-500'
    case 'medium':
      return 'bg-amber-500/20 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500 dark:border-amber-500'
    case 'low':
      return 'bg-red-500/20 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-500 dark:border-red-500'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
  }
}

const getLevelDescription = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'high':
      return 'Strong capabilities ready for scalable AI deployment.'
    case 'medium':
      return 'Adequate foundation; some enablers still developing.'
    case 'low':
      return 'Gaps require foundational improvements.'
    default:
      return 'Assessment pending.'
  }
}

function generateReadinessItems(data: Brief): Array<{ 
  name: string
  label: string
  description: string
  level: string
  rationale: string
}> {
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
  
  // Data Readiness
  const dataLevel = hasData ? 'High' : (isTechForward ? 'Medium' : 'Low')
  const dataRationale = hasData 
    ? 'Use cases have clear data requirements'
    : isTechForward 
      ? `${industry} typically has structured data available`
      : `Data collection may be needed for ${industry.toLowerCase()}`
  
  // Leadership Alignment
  const leadershipLevel = companySize.includes('100') || companySize.includes('200') || companySize.includes('500') 
    ? 'High' 
    : 'Medium'
  const leadershipRationale = companySize 
    ? `${companySize} organization has management structure for AI initiatives`
    : 'Leadership commitment needed for AI transformation'
  
  // Technical Capability
  const technicalLevel = isTechForward ? 'High' : (avgComplexity <= 3 ? 'Medium' : 'Low')
  const technicalRationale = isTechForward
    ? `${industry} has technical capabilities for AI adoption`
    : avgComplexity <= 3
      ? 'Use cases are moderate complexity, feasible with support'
      : 'Complex use cases may require technical partnerships'
  
  // Risk & Security
  const riskLevel = isRegulated ? 'Medium' : 'Low'
  const riskRationale = isRegulated
    ? `${industry} has regulatory considerations for AI deployment`
    : 'Standard business risks, manageable with proper planning'
  
  // Regulatory Readiness
  const complianceLevel = isRegulated ? 'High' : 'Medium'
  const complianceRationale = isRegulated
    ? `${industry} requires compliance with industry regulations`
    : 'General data protection and business compliance standards apply'
  
  return [
    { 
      name: 'data',
      label: 'Data Readiness',
      description: 'Data quality and availability to support AI initiatives.',
      level: dataLevel,
      rationale: dataRationale
    },
    { 
      name: 'leadership',
      label: 'Leadership Alignment',
      description: 'Executive sponsorship and governance for AI adoption.',
      level: leadershipLevel,
      rationale: leadershipRationale
    },
    { 
      name: 'technical',
      label: 'Technical Capability',
      description: 'Infrastructure, tools, and skills to implement AI solutions.',
      level: technicalLevel,
      rationale: technicalRationale
    },
    { 
      name: 'risk',
      label: 'Risk & Security',
      description: 'Ability to manage data privacy, model risk, and ethical use.',
      level: riskLevel,
      rationale: riskRationale
    },
    { 
      name: 'compliance',
      label: 'Regulatory Readiness',
      description: 'Compliance posture for data and AI regulation.',
      level: complianceLevel,
      rationale: complianceRationale
    }
  ]
}

export default function FeasibilityScan({ _data }: { _data: Brief }) {
  const items = generateReadinessItems(_data)
  
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">AI Readiness Assessment across 5 key pillars</h4>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div 
            key={item.name} 
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
          >
            <div className="mb-3">
              <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{item.label}</h5>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.description}</p>
            </div>
            <div className={`rounded-full border px-2.5 py-1 text-xs font-medium text-center mb-2 ${getLevelColor(item.level)}`}>
              {item.level}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
              {getLevelDescription(item.level)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}


