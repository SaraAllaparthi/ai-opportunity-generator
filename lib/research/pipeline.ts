// Unified research pipeline using single researchCompany() function
// Company and industry agnostic

import { researchCompany } from '@/lib/providers/perplexity'
import { synthesizeBrief } from '@/lib/research/synthesis'
import { Brief, BriefSchema } from '@/lib/schema/brief'
import { supabase } from '@/lib/db/supabase'

export type PipelineInput = {
  name: string
  website: string
  headquartersHint?: string
  industryHint?: string
}

const CACHE_TTL_HOURS = 24

/**
 * Get cache key for research
 */
function getCacheKey(input: PipelineInput): string {
  const base = `${input.name}|${input.website}|${input.industryHint || 'unknown'}`
  return `research:${base}`
}

/**
 * Get cached research result
 */
async function getCachedResearch(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('research_cache')
      .select('data, created_at')
      .eq('cache_key', key)
      .single()

    if (error || !data) return null

    const createdAt = new Date(data.created_at as string)
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

    if (ageHours > CACHE_TTL_HOURS) {
      await supabase.from('research_cache').delete().eq('cache_key', key)
      return null
    }

    return data.data
  } catch (err) {
    console.error('[Pipeline] Cache read error:', err)
    return null
  }
}

/**
 * Set cached research result
 */
async function setCachedResearch(key: string, data: any): Promise<void> {
  try {
    await supabase
      .from('research_cache')
      .upsert({
        cache_key: key,
        data,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      })
    console.log('[Pipeline] Cached research result')
  } catch (err) {
    console.error('[Pipeline] Cache write error:', err)
  }
}

/**
 * Validate research data before synthesis
 */
function validateResearchData(research: any, companyName: string): void {
  // Validate use_cases
  if (!Array.isArray(research.use_cases) || research.use_cases.length !== 5) {
    throw new Error(`Invalid use_cases: expected 5, got ${research.use_cases?.length || 0}`)
  }

  for (const uc of research.use_cases) {
    if (typeof uc.benefit !== 'number' || uc.benefit < 0) {
      throw new Error(`Invalid use case benefit: ${uc.benefit}`)
    }
    if (typeof uc.one_time !== 'number' || uc.one_time < 0) {
      throw new Error(`Invalid use case one_time: ${uc.one_time}`)
    }
    if (typeof uc.ongoing !== 'number' || uc.ongoing < 0) {
      throw new Error(`Invalid use case ongoing: ${uc.ongoing}`)
    }
    if (typeof uc.complexity !== 'number' || uc.complexity < 1 || uc.complexity > 5) {
      throw new Error(`Invalid use case complexity: ${uc.complexity}`)
    }
    if (typeof uc.effort !== 'number' || uc.effort < 1 || uc.effort > 5) {
      throw new Error(`Invalid use case effort: ${uc.effort}`)
    }
    if (typeof uc.payback_months !== 'number' || uc.payback_months < 1) {
      throw new Error(`Invalid use case payback_months: ${uc.payback_months}`)
    }
  }

  // Validate competitors
  if (!Array.isArray(research.competitors) || research.competitors.length < 2) {
    throw new Error(`Invalid competitors: expected at least 2, got ${research.competitors?.length || 0}`)
  }

  for (const comp of research.competitors) {
    if (!comp.geo_fit) {
      throw new Error(`Missing geo_fit for competitor: ${comp.name}`)
    }
    if (!Array.isArray(comp.evidence_pages) || comp.evidence_pages.length < 2) {
      throw new Error(`Invalid evidence_pages for competitor: ${comp.name}`)
    }
  }

  // Validate strategic_moves is array
  if (!Array.isArray(research.strategic_moves)) {
    throw new Error('strategic_moves must be an array')
  }

  // Check for placeholder text
  const placeholderRegex = /(data not available|estimate|not specified|TBD|unknown|N\/A)/i
  const researchStr = JSON.stringify(research)
  if (placeholderRegex.test(researchStr)) {
    console.warn('[Pipeline] Placeholder text detected in research data')
  }
}

/**
 * Main research pipeline
 */
export async function runResearchPipeline(input: PipelineInput): Promise<{ brief: Brief; citations: string[] }> {
  console.log('[Pipeline] Starting unified research pipeline for:', input)

  const industryHint = input.industryHint || 'Professional Services'

  try {
    // Step 1: Research company (with caching)
    console.log('[Pipeline] Step 1: Researching company...')
    const cacheKey = getCacheKey(input)
    let researchData = await getCachedResearch(cacheKey)
    
    if (!researchData) {
      researchData = await researchCompany({
        name: input.name,
        website: input.website,
        industryHint
      })
      await setCachedResearch(cacheKey, researchData)
    }

    // Step 2: Validate research data
    console.log('[Pipeline] Step 2: Validating research data...')
    validateResearchData(researchData, input.name)

    // Step 3: Synthesize brief using GPT-5-mini
    console.log('[Pipeline] Step 3: Synthesizing executive brief...')
    const brief = await synthesizeBrief(researchData, input.name)

    // Step 4: Validate final brief
    console.log('[Pipeline] Step 4: Validating final brief...')
    const validated = BriefSchema.safeParse(brief)
    if (!validated.success) {
      console.error('[Pipeline] Final validation failed:', validated.error.errors)
      throw new Error(`Brief validation failed: ${validated.error.message}`)
    }

    // Step 5: Collect citations
    const citations = [
      ...(researchData.citations || []),
      ...(researchData.competitors?.flatMap((c: any) => c.citations || []) || []),
      ...(researchData.use_cases?.flatMap((uc: any) => uc.citations || []) || []),
      ...(researchData.strategic_moves?.flatMap((sm: any) => sm.url ? [sm.url] : []) || [])
    ].filter((url, index, self) => self.indexOf(url) === index) // Dedupe

    console.log('[Pipeline] Pipeline completed successfully')
    return { brief: validated.data, citations }
  } catch (err: any) {
    console.error('[Pipeline] Pipeline error:', err?.message || String(err))
    throw err
  }
}
