import { z } from 'zod'

export const UseCaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  value_driver: z.enum(['revenue', 'cost', 'risk', 'speed', 'quality']),
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
    trends: z.array(z.string().max(200, 'Each trend must be max 200 characters')).min(4).max(6)
  }),
  strategic_moves: z.array(z.object({
    move: z.string(),
    owner: z.string(),
    horizon_quarters: z.number().int().min(1).max(4),
    rationale: z.string()
  })).min(3).max(5).default([]),
  competitors: z.array(z.object({
    name: z.string(),
    website: z.string().url(), // Absolute URL, normalized to origin
    hq: z.string().optional(), // "City, Country" if available
    size_band: z.string().optional(), // e.g., "10–50", "50–250", "250–1000", "1000+", "Unknown"
    positioning: z.string().optional(), // ≤140 chars: what they do / for whom; no slogans
    evidence_pages: z.array(z.string().url()).min(1), // Min 1, prefer 2: [origin, origin + /about] if resolvable
    source_url: z.string().url().optional() // The page used to infer positioning, if different from website
  })).min(0).max(6), // 0-6 competitors (prefer 2-3, but allow 0 if none pass validation)
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
    trends: z.array(z.string().max(200, 'Each trend must be max 200 characters')).min(4).max(6)
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
    hq: z.string().optional(),
    size_band: z.string().optional(),
    positioning: z.string().optional(),
    evidence_pages: z.array(z.string().url()).optional(),
    source_url: z.string().url().optional()
  })).min(0).max(6), // Will be enriched during pipeline
  use_cases: z.array(UseCaseSchema).length(5),
  citations: z.array(z.string().url()).default([])
})

export type Brief = z.infer<typeof BriefSchema>
export type BriefInput = z.infer<typeof BriefInputSchema>
export type UseCase = z.infer<typeof UseCaseSchema>


