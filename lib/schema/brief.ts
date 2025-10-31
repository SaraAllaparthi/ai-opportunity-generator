import { z } from 'zod'

export const UseCaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  value_driver: z.enum(['revenue', 'cost', 'risk', 'speed']),
  complexity: z.number().int().min(1).max(5),
  effort: z.number().int().min(1).max(5),
  est_annual_benefit: z.number().optional(),
  est_one_time_cost: z.number().optional(),
  est_ongoing_cost: z.number().optional(),
  payback_months: z.number().optional(),
  data_requirements: z.string().optional().default('TBD'),
  risks: z.string().optional().default('TBD'),
  next_steps: z.string().optional().default('TBD'),
  citations: z.array(z.string().url()).default([])
})

export const BriefSchema = z.object({
  company: z.object({
    name: z.string(),
    website: z.string(),
    summary: z.string().optional().default('Estimate based on public info')
  }),
  industry: z.object({
    summary: z.string().optional().default('Concise overview based on sources'),
    trends: z.array(z.string()).min(0).max(5)
  }),
  strategic_moves: z.array(z.object({
    title: z.string(),
    dateISO: z.string().optional(),
    impact: z.string().optional(),
    citations: z.array(z.string().url()).default([])
  })).max(5),
  competitors: z.array(z.object({
    name: z.string(),
    website: z.string().optional(),
    positioning: z.string().optional(),
    citations: z.array(z.string().url()).default([])
  })).max(5),
  use_cases: z.array(UseCaseSchema).length(5),
  citations: z.array(z.string().url()).default([])
})

export type Brief = z.infer<typeof BriefSchema>


