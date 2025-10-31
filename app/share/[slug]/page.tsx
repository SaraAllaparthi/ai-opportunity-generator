import { getBriefBySlug } from '@/lib/db/briefs'
import { track } from '@/lib/utils/analytics'
import SnapshotCard from '@/components/BriefSnapshotCard'
import IndustryCard from '@/components/BriefIndustryCard'
import MovesCard from '@/components/BriefMovesCard'
import CompetitorsCard from '@/components/BriefCompetitorsCard'
import UseCasesCard from '@/components/BriefUseCasesCard'
import BriefExecutiveSummary from '@/components/BriefExecutiveSummary'
import SharePriceCard from '@/components/SharePriceCard'
import RoiDonut from '@/components/RoiDonut'
import BenefitInvestmentBar from '@/components/BenefitInvestmentBar'
import MovesTimeline from '@/components/MovesTimeline'
import TrendsBars from '@/components/TrendsBars'
import CompetitorComparison from '@/components/CompetitorComparison'
import CEOActionPlan from '@/components/CEOActionPlan'
import FeasibilityScan from '@/components/FeasibilityScan'
import StickyHeader from '@/components/StickyHeader'
import SectionWrapper from '@/components/SectionWrapper'

export const dynamic = 'force-dynamic'

export default async function SharePage({ params }: { params: { slug: string } }) {
  const brief = await getBriefBySlug(params.slug)
  await track('share_opened', { slug: params.slug, found: !!brief })
  if (!brief) {
    return (
      <main className="flex flex-col gap-4">
        <div className="text-2xl font-semibold">Maverick AI Group</div>
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Brief not found or unavailable. Please check the link.</div>
      </main>
    )
  }

  const data = brief.data
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <StickyHeader />
      <main className="mx-auto max-w-[850px] px-6">
        {/* Hero / Executive Summary */}
        <SectionWrapper id="exec-summary">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-medium mb-3">AI Opportunity Brief — {data.company.name}</h1>
            <p className="text-gray-400 text-lg">
              Executive intelligence on ROI and strategic AI acceleration for {data.company.name}
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-12">
            <div className="md:col-span-2">
              <BriefExecutiveSummary data={data} />
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
                  <div className="mb-2 text-sm font-medium text-gray-400">ROI Contribution</div>
                  <RoiDonut data={data} />
                </div>
                <div className="rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
                  <div className="mb-2 text-sm font-medium text-gray-400">Benefit vs Investment</div>
                  <BenefitInvestmentBar data={data} />
                </div>
              </div>
            </div>
            <div><SharePriceCard companyName={data.company.name} /></div>
          </div>

          <div className="text-center">
            <a
              href="#book"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#0070F3] to-blue-600 px-8 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
            >
              Schedule a 30-min {data.company.name} AI Value Workshop — define your fastest ROI path
            </a>
          </div>
        </SectionWrapper>

        {/* Company Snapshot */}
        <SectionWrapper id="snapshot">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">Company Snapshot</h2>
            <p className="text-gray-400 text-sm">Overview of {data.company.name} and market position</p>
          </div>
          <SnapshotCard data={data} />
        </SectionWrapper>

        {/* Industry Trends */}
        <SectionWrapper id="industry">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">Industry Trends</h2>
            <p className="text-gray-400 text-sm">Key market dynamics and opportunities</p>
          </div>
          <IndustryCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
            <TrendsBars data={data} />
          </div>
        </SectionWrapper>

        {/* Strategic Moves */}
        <SectionWrapper id="moves">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">Strategic Moves</h2>
            <p className="text-gray-400 text-sm">Recent initiatives and market positioning</p>
          </div>
          <MovesCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
            <MovesTimeline data={data} />
          </div>
        </SectionWrapper>

        {/* Competitors */}
        <SectionWrapper id="competitors">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">Competitive Landscape</h2>
            <p className="text-gray-400 text-sm">Market positioning relative to key peers</p>
          </div>
          <CompetitorsCard data={data} />
          <div className="mt-6 rounded-2xl border border-gray-800 bg-[#121212] p-8 shadow-lg">
            <CompetitorComparison data={data} />
          </div>
        </SectionWrapper>

        {/* AI Opportunity Landscape */}
        <SectionWrapper id="use-cases">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">AI Opportunity Landscape</h2>
            <p className="text-gray-400 text-sm">Five prioritized use cases with ROI analysis</p>
          </div>
          <UseCasesCard data={data} />
        </SectionWrapper>

        {/* Action Plan */}
        <SectionWrapper id="action-plan">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">CEO Action Plan</h2>
            <p className="text-gray-400 text-sm">90-day roadmap for AI acceleration</p>
          </div>
          <CEOActionPlan data={data} />
        </SectionWrapper>

        {/* Feasibility Scan */}
        <SectionWrapper id="feasibility">
          <div className="mb-4">
            <h2 className="text-2xl font-medium mb-2">Feasibility Scan</h2>
            <p className="text-gray-400 text-sm">Readiness assessment across key domains</p>
          </div>
          <FeasibilityScan _data={data} />
        </SectionWrapper>

        {/* Bottom CTA */}
        <SectionWrapper>
          <div className="text-center">
            <a
              href="#book"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#0070F3] to-blue-600 px-8 text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
            >
              Schedule a 30-min {data.company.name} AI Value Workshop — define your fastest ROI path
            </a>
          </div>
        </SectionWrapper>

        {/* Footer */}
        <footer className="py-12 text-center text-sm text-gray-400">
          Built by Maverick AI Group • Powered by Tavily + Azure + Vercel
        </footer>
      </main>
    </div>
  )
}


