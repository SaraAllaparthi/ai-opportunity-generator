import { getBriefBySlug } from '@/lib/db/briefs'
import { track } from '@/lib/utils/analytics'
import SnapshotCard from '@/components/BriefSnapshotCard'
import IndustryCard from '@/components/BriefIndustryCard'
import CompetitorsCard from '@/components/BriefCompetitorsCard'
import UseCasesCard from '@/components/BriefUseCasesCard'
import BriefExecutiveSummary from '@/components/BriefExecutiveSummary'
import RoiDonut from '@/components/RoiDonut'
import BenefitInvestmentBar from '@/components/BenefitInvestmentBar'
import TrendImpactGrid from '@/components/TrendImpactGrid'
import CompetitorComparison from '@/components/CompetitorComparison'
import CEOActionPlan from '@/components/CEOActionPlan'
import FeasibilityScan from '@/components/FeasibilityScan'
import StickyHeader from '@/components/StickyHeader'
import SectionWrapper from '@/components/SectionWrapper'

// Briefs are static once created - cache the page indefinitely
export const revalidate = false // Never revalidate since briefs are immutable once created

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  // In Next.js 16, params is a Promise and must be awaited
  const { slug } = await params
  
  if (!slug) {
    console.error('[SharePage] No slug provided in params')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="relative z-10">
          <StickyHeader />
          <main className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Maverick Lens</div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-sm text-gray-600 dark:text-gray-300 shadow-lg">
                Invalid report link. Please check the URL and try again.
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }
  
  console.log('[SharePage] Fetching brief with slug:', slug)
  const brief = await getBriefBySlug(slug)
  await track('share_opened', { slug, found: !!brief })
  if (!brief) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="relative z-10">
          <StickyHeader />
          <main className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Maverick Lens</div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-sm text-gray-600 dark:text-gray-300 shadow-lg">
                Brief not found or unavailable. Please check the link.
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const data = brief.data
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="relative z-10">
      <StickyHeader />
      <main className="mx-auto max-w-6xl px-6">
        {/* Hero / Executive Summary */}
        <SectionWrapper id="exec-summary" className="pb-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">AI Opportunity Brief — {data.company.name}</h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Executive intelligence on ROI and strategic AI acceleration for {data.company.name}
            </p>
          </div>
          
          <div className="mb-12">
            <BriefExecutiveSummary data={data} />
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">ROI Contribution</div>
                <RoiDonut data={data} />
                <ul className="mt-6 space-y-2">
                  {data.use_cases.map((useCase, index) => {
                    // Normalize numeric values to ensure consistency
                    const normalizeNum = (v: any): number => {
                      if (typeof v === 'number' && !isNaN(v)) return v
                      if (typeof v === 'string') {
                        const parsed = parseFloat(v)
                        return !isNaN(parsed) ? parsed : 0
                      }
                      return 0
                    }
                    
                    const COLORS = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed']
                    const color = COLORS[index % COLORS.length]
                    const amount = normalizeNum(useCase.est_annual_benefit)
                    const formattedAmount = new Intl.NumberFormat('en-CH', { 
                      style: 'currency', 
                      currency: 'CHF', 
                      maximumFractionDigits: 0 
                    }).format(amount)
                    return (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span 
                          className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: color }}
                        />
                        <span className="flex-1 text-gray-700 dark:text-gray-300">
                          {useCase.title}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formattedAmount}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Benefit vs Investment</div>
                <BenefitInvestmentBar data={data} />
                <ul className="mt-6 space-y-2">
                  {(() => {
                    // Normalize numeric values to ensure consistency
                    const normalizeNum = (v: any): number => {
                      if (typeof v === 'number' && !isNaN(v)) return v
                      if (typeof v === 'string') {
                        const parsed = parseFloat(v)
                        return !isNaN(parsed) ? parsed : 0
                      }
                      return 0
                    }
                    
                    const totalOneTime = data.use_cases.reduce((a, u) => a + normalizeNum(u.est_one_time_cost), 0)
                    const totalOngoing = data.use_cases.reduce((a, u) => a + normalizeNum(u.est_ongoing_cost), 0)
                    const totalInvestment = totalOneTime + totalOngoing
                    const totalBenefit = data.use_cases.reduce((a, u) => a + normalizeNum(u.est_annual_benefit), 0)
                    const roiPercentage = totalInvestment > 0 
                      ? ((totalBenefit - totalInvestment) / totalInvestment) * 100 
                      : 0
                    const formatAmount = (amount: number) => new Intl.NumberFormat('en-CH', { 
                      style: 'currency', 
                      currency: 'CHF', 
                      maximumFractionDigits: 0 
                    }).format(amount)
                    
                    return (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <span 
                            className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: '#2563eb' }}
                          />
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            Investment
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {formatAmount(totalInvestment)}
                          </span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <span 
                            className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: '#16a34a' }}
                          />
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            Benefit
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {formatAmount(totalBenefit)}
                          </span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <span 
                            className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: '#7c3aed' }}
                          />
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            ROI
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {roiPercentage >= 0 ? '+' : ''}{roiPercentage.toFixed(1)}%
                          </span>
                        </li>
                      </>
                    )
                  })()}
                </ul>
              </div>
            </div>
          </div>
        </SectionWrapper>

        {/* Company Snapshot */}
        <SectionWrapper id="snapshot" className="pt-2">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Company Snapshot</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Overview of {data.company.name} and market position</p>
          </div>
          <SnapshotCard data={data} />
        </SectionWrapper>

        {/* Industry Trends */}
        <SectionWrapper id="industry" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Industry Trends</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Key market dynamics and opportunities for {data.company.name}</p>
          </div>
          <IndustryCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Trend Analysis Impact Grid</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Prioritised trends by business readiness and potential impact</p>
            </div>
            <TrendImpactGrid data={data} />
          </div>
        </SectionWrapper>

        {/* Competitors */}
        <SectionWrapper id="competitors" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Competitive Landscape</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Market positioning relative to key peers</p>
          </div>
          <CompetitorsCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
            <CompetitorComparison data={data} />
          </div>
        </SectionWrapper>

        {/* AI Opportunity Landscape */}
        <SectionWrapper id="use-cases" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">AI Opportunity Landscape</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Five prioritized use cases with ROI analysis</p>
          </div>
          <UseCasesCard data={data} />
          
          <div className="mt-8 text-center">
            <a
              href="#book"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 dark:bg-blue-500 px-8 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Schedule a 30-min {data.company.name} AI Value Workshop — define your fastest ROI path
            </a>
          </div>
        </SectionWrapper>

        {/* Action Plan */}
        <SectionWrapper id="action-plan" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">CEO Action Plan</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">90-day roadmap for AI acceleration</p>
          </div>
          <CEOActionPlan data={data} />
        </SectionWrapper>

        {/* Feasibility Scan */}
        <SectionWrapper id="feasibility" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Feasibility Scan</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Readiness assessment across key domains</p>
          </div>
          <FeasibilityScan _data={data} />
        </SectionWrapper>

        {/* Footer */}
        <footer className="py-12 text-center text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-t-2xl border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-6">
            <p className="mb-4">
              <a 
                href="https://www.maverickaigroup.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Built by Maverick AI Group
              </a>
            </p>
          </div>
        </footer>
      </main>
      </div>
    </div>
  )
}


