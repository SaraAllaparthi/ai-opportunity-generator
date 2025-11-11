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
import { getTranslations } from 'next-intl/server'
import { generateExecutiveSummary, computeUplift, computeWeightedPayback, formatCurrencyCHF } from '@/lib/utils/executiveSummary'

// Briefs are static once created - cache the page indefinitely
export const revalidate = false // Never revalidate since briefs are immutable once created

export default async function SharePage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  // In Next.js 16, params is a Promise and must be awaited
  const { slug, locale } = await params
  const t = await getTranslations({ locale })
  
  if (!slug) {
    console.error('[SharePage] No slug provided in params')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="relative z-10">
          <StickyHeader showLocaleSwitcher={false} />
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
  
  // Try fetching with cache first, then without cache if not found (for newly created briefs)
  let brief = await getBriefBySlug(slug, false)
  if (!brief) {
    // If not found in cache, try fetching directly (may be a newly created brief)
    console.log('[SharePage] Brief not found in cache, trying direct fetch for:', slug)
    brief = await getBriefBySlug(slug, true)
  }
  
  // If still not found, wait a bit and retry (for race conditions with database writes)
  if (!brief) {
    console.log('[SharePage] Brief still not found, waiting 500ms and retrying:', slug)
    await new Promise(resolve => setTimeout(resolve, 500))
    brief = await getBriefBySlug(slug, true)
    
    // Final retry after another delay
    if (!brief) {
      console.log('[SharePage] Brief still not found after first retry, waiting 1s and retrying again:', slug)
      await new Promise(resolve => setTimeout(resolve, 1000))
      brief = await getBriefBySlug(slug, true)
    }
  }
  
  await track('share_opened', { slug, found: !!brief })
  if (!brief) {
    console.error('[SharePage] Brief not found after all retries. Slug:', slug)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="relative z-10">
          <StickyHeader showLocaleSwitcher={false} />
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
  
  // Debug: Log competitor data when rendering page
  console.log('[SharePage] Rendering page with data:')
  console.log('  Company:', data.company?.name)
  console.log('  Competitors count:', data.competitors?.length || 0)
  console.log('  Competitors type:', Array.isArray(data.competitors) ? 'array' : typeof data.competitors)
  console.log('  Competitors array:', JSON.stringify(data.competitors || [], null, 2))
  if (data.competitors && data.competitors.length > 0) {
    console.log('  First competitor:', JSON.stringify(data.competitors[0], null, 2))
    console.log('  Competitor names:', data.competitors.map((c: any) => c.name))
    console.log('  Competitor websites:', data.competitors.map((c: any) => c.website))
  } else {
    console.log('  ⚠️ No competitors in data!')
    console.log('  ⚠️ This will cause CompetitorComparison to return null')
  }
  
  // Validate data structure before passing to components
  if (!data.competitors || !Array.isArray(data.competitors)) {
    console.error('[SharePage] ❌ CRITICAL: competitors is not an array!', {
      type: typeof data.competitors,
      value: data.competitors
    })
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="relative z-10">
      <StickyHeader showLocaleSwitcher={false} />
      <main className="mx-auto max-w-6xl px-6">
        {/* Hero / Executive Summary */}
        <SectionWrapper id="exec-summary" className="pb-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">{t('title.report', { company: data.company.name })}</h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              {t('report.subtitle.execSummary', { company: data.company.name })}
            </p>
          </div>
          
          <div className="mb-12">
            <BriefExecutiveSummary 
              data={data} 
              summaryText={generateExecutiveSummary(data, locale as 'en' | 'de')}
              formattedUplift={formatCurrencyCHF(computeUplift(data.use_cases))}
              weightedPayback={computeWeightedPayback(data.use_cases)}
              avgComplexity={Math.round((data.use_cases.reduce((a, u) => a + u.complexity, 0) / (data.use_cases.length || 1)) * 10) / 10}
              avgEffort={Math.round((data.use_cases.reduce((a, u) => a + u.effort, 0) / (data.use_cases.length || 1)) * 10) / 10}
            />
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">{t('report.roi.contribution')}</div>
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
                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">{t('report.roi.title')}</div>
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
                            {t('report.roi.oneTime')}
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
                            {t('report.roi.benefit')}
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
                            {t('report.roi.roi')}
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
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('section.snapshot')}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('report.subtitle.snapshot', { company: data.company.name })}</p>
          </div>
          <SnapshotCard data={data} />
        </SectionWrapper>

        {/* Industry Trends */}
        <SectionWrapper id="industry" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('section.trends')}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('report.subtitle.industry', { company: data.company.name })}</p>
          </div>
          <IndustryCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('report.trends.title')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('report.trends.subtitle')}</p>
            </div>
            <TrendImpactGrid data={data} />
          </div>
        </SectionWrapper>

        {/* Competitors */}
        <SectionWrapper id="competitors" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('section.compLandscape')}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('report.subtitle.competitors')}</p>
          </div>
          <CompetitorsCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-lg">
            <CompetitorComparison data={data} />
          </div>
        </SectionWrapper>

        {/* AI Opportunity Landscape */}
        <SectionWrapper id="use-cases" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('section.useCases')}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('report.subtitle.useCases')}</p>
          </div>
          <UseCasesCard data={data} />
          
          <div className="mt-8 text-center">
            <a
              href="mailto:contact@maverickaigroup.ai?subject=Book 30-min AI Discovery Call"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 dark:bg-blue-500 px-8 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Book 30-min AI Discovery Call
            </a>
          </div>
        </SectionWrapper>

        {/* Action Plan */}
        <SectionWrapper id="action-plan" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('section.actionPlan')}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('report.subtitle.actionPlan', { company: data.company?.name || 'Organization' })}</p>
          </div>
          <CEOActionPlan data={data} />
        </SectionWrapper>

        {/* AI Readiness Assessment */}
        <SectionWrapper id="feasibility" className="pt-0">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('section.feasibility')}</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('report.subtitle.feasibility', { company: data.company?.name || 'Organization' })}</p>
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
                {t('footer.builtBy')}
              </a>
            </p>
          </div>
        </footer>
      </main>
      </div>
    </div>
  )
}


