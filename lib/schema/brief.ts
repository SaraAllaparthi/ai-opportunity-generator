import { z } from 'zod'

export const UseCaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  value_driver: z.enum(['revenue', 'cost', 'risk', 'speed']),
  complexity: z.number().int().min(1).max(5),
  effort: z.number().int().min(1).max(5),
  // New field names (preferred)
  benefit: z.number().optional(), // CHF annual benefit
  one_time: z.number().optional(), // CHF one-time cost
  ongoing: z.number().optional(), // CHF ongoing cost
  // Legacy field names (for backward compatibility)
  est_annual_benefit: z.number().optional(),
  annual_benefit: z.number().optional(), // CHF amount
  one_time_cost: z.number().optional(), // CHF amount
  ongoing_cost: z.number().optional(), // CHF amount
  est_one_time_cost: z.number().optional(), // Legacy field
  est_ongoing_cost: z.number().optional(), // Legacy field
  payback_months: z.number().min(1).optional(),
  roi_pct: z.number().optional(), // ROI percentage
  data_requirements: z.string().optional().default('TBD'),
  risks: z.string().optional().default('TBD'),
  next_steps: z.string().optional().default('TBD'),
  citations: z.array(z.string().url()).default([])
})

export const BriefSchema = z.object({
  company: z.object({
    name: z.string(),
    website: z.string(),
    summary: z.string().min(100, 'Company summary must be at least 100 characters to provide a comprehensive overview'),
    size: z.string().optional(), // e.g., "500 employees", "€50M revenue"
    industry: z.string().optional(), // Primary industry sector
    headquarters: z.string().optional(), // City, Country
    founded: z.string().optional(), // Year or "Founded YYYY"
    ceo: z.string().optional(), // CEO name
    market_position: z.string().optional(), // Market position/leadership info
    latest_news: z.string().optional() // One point from latest news or announcement
  }),
  industry: z.object({
    summary: z.string()
      .min(20, 'Industry summary must be at least 20 characters')
      .max(300, 'Industry summary must be under 50 words (approximately 300 characters)'),
    trends: z.array(z.string().max(200, 'Each trend must be max 15 words')).min(4).max(6)
  }),
  strategic_moves: z.array(z.object({
    move: z.string(),
    owner: z.string(),
    horizon_quarters: z.number().int().min(1).max(4),
    rationale: z.string()
  })).min(3).max(5).default([]),
  competitors: z.array(z.object({
    name: z.string(),
    website: z.string().url(),
    positioning: z.string(),
    ai_maturity: z.string(),
    innovation_focus: z.string(),
    employee_band: z.string(), // e.g., "50-200 employees"
    geo_fit: z.string().default('Switzerland'), // Country/region match (HQ location)
    evidence_pages: z.array(z.string().url()).min(2), // At least 2 URLs on company domain
    citations: z.array(z.string().url()).default([])
  })).min(2).max(6), // 2-6 competitors required (minimum 2)
  use_cases: z.array(UseCaseSchema).length(5),
  citations: z.array(z.string().url()).default([]),
  roi: z.object({
    total_benefit: z.number(),
    total_investment: z.number(),
    overall_roi_pct: z.number(),
    weighted_payback_months: z.number()
  }).optional()
})

// Schema for initial LLM output (before competitor enrichment)
// Competitors are enriched later with employee_band, geo_fit, and evidence_pages
export const BriefInputSchema = z.object({
  company: z.object({
    name: z.string(),
    website: z.string(),
    summary: z.string().min(100, 'Company summary must be at least 100 characters to provide a comprehensive overview'),
    size: z.string().optional(),
    industry: z.string().optional(),
    headquarters: z.string().optional(),
    founded: z.string().optional(),
    ceo: z.string().optional(),
    market_position: z.string().optional(),
    latest_news: z.string().optional()
  }),
  industry: z.object({
    summary: z.string()
      .min(20, 'Industry summary must be at least 20 characters')
      .max(300, 'Industry summary must be under 50 words (approximately 300 characters)'),
    trends: z.array(z.string().max(200, 'Each trend must be max 15 words')).min(4).max(6)
  }),
  strategic_moves: z.array(z.object({
    move: z.string(),
    owner: z.string(),
    horizon_quarters: z.number().int().min(1).max(4),
    rationale: z.string()
  })).min(3).max(5).default([]),
  competitors: z.array(z.object({
    name: z.string(),
    website: z.string().url(),
    positioning: z.string(),
    ai_maturity: z.string(),
    innovation_focus: z.string(),
    employee_band: z.string().optional(), // Added during enrichment
    geo_fit: z.string().optional().default('Switzerland'), // Added during enrichment
    evidence_pages: z.array(z.string().url()).optional(), // Added during enrichment
    citations: z.array(z.string().url()).default([])
  })).min(2).max(6),
  use_cases: z.array(UseCaseSchema).length(5),
  citations: z.array(z.string().url()).default([])
})

export type Brief = z.infer<typeof BriefSchema>
export type BriefInput = z.infer<typeof BriefInputSchema>
export type UseCase = z.infer<typeof UseCaseSchema>


