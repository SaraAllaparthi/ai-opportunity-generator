import { createClient } from '@/lib/db/supabase-server'
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
import { generateExecutiveSummary, computeUplift, computeWeightedPayback, formatCurrencyCHF } from '@/lib/utils/executiveSummary'
import { notFound } from 'next/navigation'

// Share pages are dynamic now, depending on token validity
export const revalidate = 0 

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: token } = await params
  
  if (!token) {
    notFound()
  }
  
  const supabase = await createClient()

  // Fetch share record with joined report data
  // RLS ensures we only get a result if token is valid (not expired, not revoked)
  // Note: We need to select reports(report_json)
  const { data: share, error } = await supabase
    .from('report_shares')
    .select(`
      *,
      reports (
        report_json
      )
    `)
    .eq('token', token)
    .maybeSingle()
  
  await track('share_opened', { token, found: !!share })

  if (error) {
    console.error('[SharePage] Error fetching share:', error)
  }

  if (!share || !share.reports) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="relative z-10">
          <StickyHeader />
          <main className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Maverick Lens</div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-sm text-gray-600 dark:text-gray-300 shadow-lg">
                Link expired or invalid. Please check the URL and try again.
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Cast the JSON data to the expected type
  const data = (share.reports as any).report_json
  
  // Debug: Log competitor data when rendering page
  console.log('[SharePage] Rendering page with data for company:', data.company?.name)
  
  // Validate data structure before passing to components
  if (!data.competitors || !Array.isArray(data.competitors)) {
    console.error('[SharePage] ❌ CRITICAL: competitors is not an array!', {
      type: typeof data.competitors,
      value: data.competitors
    })
    // Initialize empty array to prevent crashes
    data.competitors = []
  }
  
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
            <BriefExecutiveSummary 
              data={data} 
              summaryText={generateExecutiveSummary(data, 'en')}
              formattedUplift={formatCurrencyCHF(computeUplift(data.use_cases))}
              weightedPayback={computeWeightedPayback(data.use_cases)}
              avgComplexity={Math.round((data.use_cases.reduce((a: number, u: any) => a + u.complexity, 0) / (data.use_cases.length || 1)) * 10) / 10}
              avgEffort={Math.round((data.use_cases.reduce((a: number, u: any) => a + u.effort, 0) / (data.use_cases.length || 1)) * 10) / 10}
            />
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">ROI Contribution</div>
                <RoiDonut data={data} />
                <ul className="mt-6 space-y-2">
                  {data.use_cases.map((useCase: any, index: number) => {
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
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg flex flex-col">
                <div className="mb-6 text-sm font-medium text-gray-600 dark:text-gray-400">Benefit vs Investment</div>
                <div className="flex-grow">
                  <BenefitInvestmentBar data={data} />
                </div>
                <ul className="mt-4 space-y-2">
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
                    
                    const totalOneTime = data.use_cases.reduce((a: number, u: any) => a + normalizeNum(u.est_one_time_cost), 0)
                    const totalOngoing = data.use_cases.reduce((a: number, u: any) => a + normalizeNum(u.est_ongoing_cost), 0)
                    const totalInvestment = totalOneTime + totalOngoing
                    const totalBenefit = data.use_cases.reduce((a: number, u: any) => a + normalizeNum(u.est_annual_benefit), 0)
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
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg">
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
            <a
              href="mailto:contact@maverickaigroup.ai?subject=Book 30-min AI Discovery Call"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-6 text-xl font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
            >
              Book 30-min AI Discovery Call
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </a>
        </SectionWrapper>

        {/* Action Plan */}
        <SectionWrapper id="action-plan" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">CEO Action Plan</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{data.company?.name || 'Organization'} 90-day roadmap for AI acceleration</p>
          </div>
          <CEOActionPlan data={data} />
        </SectionWrapper>

        {/* AI Readiness Assessment */}
        <SectionWrapper id="feasibility" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">AI Readiness Assessment</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{data.company?.name || 'Organization'} - Organizational readiness to roll out AI capabilities</p>
          </div>
          <FeasibilityScan _data={data} />
        </SectionWrapper>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <a 
              href="https://www.maverickaigroup.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              © 2025 Maverick Lens | Built by Maverick AI Group | All rights reserved.
            </a>
          </div>
        </div>
      </footer>
      </div>
    </div>
  )
}


