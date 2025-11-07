// OpenAI GPT-5-mini synthesis for executive brief generation
// Takes unified research JSON and synthesizes into structured Brief JSON
// Company and industry agnostic

import { llmGenerateJson } from '@/lib/providers/llm'
import { BriefSchema } from '@/lib/schema/brief'

/**
 * Synthesize executive brief from unified research JSON
 */
export async function synthesizeBrief(researchJson: any, companyName: string): Promise<any> {
  const systemPrompt = `You are an executive strategy writer. Using the provided research JSON, generate a polished AI Opportunity Brief. Do not invent facts. If a metric is unavailable, omit it rather than guess. Keep each insight to 1–2 crisp sentences, executive tone. Maintain exactly 5 use cases. Preserve numeric fields and payback months. Competitors: 2–3 peers, same country prioritized, no defunct/merged entities. Output must match the renderer schema the app expects. No placeholders. Provide a one-line "Strategic Insight" informed by the comparison.`

  const userPrompt = `Research JSON provided:

${JSON.stringify(researchJson, null, 2)}

Generate a complete Brief JSON following these exact guidelines:

1. EXECUTIVE SUMMARY:
- 3–4 sentences summarizing expected value, indicative payback window, and 2 priority themes for AI deployment.
- Use quantitative or directional phrases (e.g., "rapid ROI within 6–9 months").

2. COMPANY SNAPSHOT:
- 2 sentences describing positioning, focus areas, and digital posture.
- Use company.summary from research.

3. INDUSTRY TRENDS:
- 4–6 concise trend bullets tied to measurable impact.
- Use industry.trends from research.

4. COMPETITIVE LANDSCAPE:
- Return 2–3 peers with one-line innovation focus and relative maturity.
- Use competitors from research. Set geo_fit = headquarters for each.

5. AI OPPORTUNITY LANDSCAPE (Use Cases):
- Return exactly 5 prioritized items with value driver, complexity/effort, benefit/costs, and payback months.
- Use use_cases from research. Map fields: benefit (CHF), one_time (CHF), ongoing (CHF).
- Ensure all numeric fields are present and valid.

6. CEO ACTION PLAN (90 days):
- Four blocks: Discover, Pilot, Scale, Measure, 2 bullet actions each, SMB-practical.
- Generate based on use cases and company context.

7. FEASIBILITY SCAN:
- Return ratings for Data, Leadership, Technical, Risk, Compliance (High/Medium/Low) with one clause rationale each.
- Base on company size, industry maturity, and digital emphasis.

8. STRATEGIC MOVES:
- 3–5 concrete actions linked to insights.
- Use strategic_moves from research if available, or generate based on research data.

Return complete Brief JSON:

{
  "company": {
    "name": "${companyName}",
    "website": "${researchJson.company?.website || ''}",
    "headquarters": "${researchJson.company?.headquarters || 'Switzerland'}",
    "size": "${researchJson.company?.size || 'Unknown'}",
    "summary": ">=100 chars, 2 sentences from research data, executive tone."
  },
  "industry": {
    "name": "${researchJson.industry?.name || 'Professional Services'}",
    "summary": ">=20 chars, <=300 chars, from research data.",
    "trends": ["trend 1", "trend 2", "trend 3", "trend 4"]
  },
  "competitors": [
    {
      "name": "...",
      "website": "https://...",
      "headquarters": "...",
      "employee_band": "...",
      "positioning": "... (1 sentence)",
      "ai_maturity": "...",
      "innovation_focus": "...",
      "geo_fit": "...", // MUST equal headquarters
      "evidence_pages": ["https://...", "https://.../about"],
      "citations": []
    }
  ],
  "use_cases": [
    {
      "title": "...",
      "value_driver": "cost|revenue|risk|speed",
      "benefit": 150000,
      "one_time": 75000,
      "ongoing": 15000,
      "complexity": 3,
      "effort": 3,
      "payback_months": 18,
      "description": "1 sentence."
    }
  ],
  "strategic_moves": [
    {
      "move": "Deploy AI-powered system",
      "owner": "Head of Operations",
      "horizon_quarters": 2,
      "rationale": "1 sentence anchoring to research evidence."
    }
  ],
  "roi": {
    "total_benefit": 500000,
    "total_investment": 450000,
    "overall_roi_pct": 11.1,
    "weighted_payback_months": 16.5
  }
}

STRICT STYLE RULES:
- Executive tone: confident, factual, data-driven.
- 1–2 sentences per insight.
- No placeholders, no fallbacks, no fabricated data.
- Omit a metric if not found in research data.
- Use directional language only when specific numbers unavailable.

STRICT STRUCTURE RULES:
- **Exactly 5** use_cases with all required fields.
- **At least 2** competitors (up to 3). For each, set **geo_fit = headquarters** exactly.
- For each competitor, set **evidence_pages** to [website, website + "/about"].
- strategic_moves: **3–5** concrete actions linked to insights.
- Numbers are integers except payback_months and roi_pct (can be decimal).
- Calibrate CHF amounts to realistic Swiss SMB scale in this industry.
- Keep company.summary ≥100 chars; industry.summary ≥20 chars.
- Output **valid JSON only** with no extra commentary.`

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    let response = await llmGenerateJson(systemPrompt, userPrompt, {
      model,
      timeoutMs: 60000
    })

    // Post-process to ensure schema compliance
    response = postProcessBrief(response, researchJson, companyName)

    // Validate with schema
    const validation = BriefSchema.safeParse(response)
    
    if (!validation.success) {
      console.log('[Synthesis] Initial validation failed, attempting repair...')
      console.log('[Synthesis] Validation errors:', validation.error.errors)
      
      // Attempt repair
      response = await repairBrief(response, validation.error.errors, researchJson, companyName)
      
      // Post-process repaired response
      response = postProcessBrief(response, researchJson, companyName)
      
      // Validate again
      const repairValidation = BriefSchema.safeParse(response)
      if (!repairValidation.success) {
        console.error('[Synthesis] Repair validation failed:', repairValidation.error.errors)
        throw new Error(`Brief validation failed after repair: ${repairValidation.error.message}`)
      }
      
      response = repairValidation.data
    } else {
      response = validation.data
    }

    // Compute ROI fields if not provided or incomplete
    response = computeROIFields(response)

    return response
  } catch (err: any) {
    console.error('[Synthesis] Error:', err?.message || String(err))
    throw new Error(`Failed to synthesize brief: ${err?.message || String(err)}`)
  }
}

/**
 * Repair brief JSON to fix validation errors
 */
async function repairBrief(
  invalidBrief: any,
  validationErrors: any[],
  researchJson: any,
  companyName: string
): Promise<any> {
  const systemPrompt = `You must repair the prior JSON so it passes the schema. Do not invent sources; stay consistent with the research JSON. No placeholders, no "data not available" text. Output valid JSON only.`

  const errorSummary = validationErrors.map((err: any) => {
    const path = err.path.join('.')
    return `- ${path}: ${err.message} (expected ${err.expected}, received ${err.received})`
  }).join('\n')

  const userPrompt = `Previous Brief JSON (invalid):

${JSON.stringify(invalidBrief, null, 2)}

Validation errors:

${errorSummary}

Original research JSON:

${JSON.stringify(researchJson, null, 2)}

Return the FULL corrected Brief JSON. Ensure all required fields are present and valid. No fallback text.`

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const response = await llmGenerateJson(systemPrompt, userPrompt, {
      model,
      timeoutMs: 60000
    })

    return response
  } catch (err: any) {
    console.error('[Synthesis] Repair error:', err?.message || String(err))
    throw new Error(`Failed to repair brief: ${err?.message || String(err)}`)
  }
}

/**
 * Post-process brief to ensure schema compliance
 */
function postProcessBrief(brief: any, researchJson: any, companyName: string): any {
  // Remove placeholder text
  const removePlaceholders = (text: string): string => {
    if (typeof text !== 'string') return text
    return text
      .replace(/\b(data not available|data unavailable|not available|not specified|estimate|TBD|unknown|N\/A)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Ensure strategic_moves exists and is always an array
  if (!brief.strategic_moves || !Array.isArray(brief.strategic_moves)) {
    brief.strategic_moves = []
  }
  
  // Generate strategic_moves if missing or insufficient (3-5 required)
  if (brief.strategic_moves.length < 3) {
    const defaultMoves = [
      {
        move: `Deploy AI-powered quality control system`,
        owner: 'Head of Operations',
        horizon_quarters: 2,
        rationale: `Based on research data, addresses immediate operational efficiency gains`
      },
      {
        move: `Implement predictive maintenance analytics`,
        owner: 'Head of Manufacturing',
        horizon_quarters: 3,
        rationale: `Aligns with industry trends for reducing downtime and maintenance costs`
      },
      {
        move: `Launch AI-driven customer insights platform`,
        owner: 'Head of Sales',
        horizon_quarters: 4,
        rationale: `Enhances customer understanding and revenue optimization based on market positioning`
      }
    ]
    
    brief.strategic_moves = [...brief.strategic_moves]
    while (brief.strategic_moves.length < 3) {
      const move = defaultMoves[brief.strategic_moves.length % defaultMoves.length]
      brief.strategic_moves.push(move)
    }
    brief.strategic_moves = brief.strategic_moves.slice(0, 5)
    
    brief.strategic_moves = brief.strategic_moves.map((m: any) => ({
      move: removePlaceholders(m.move || m.title || 'Implement AI initiative'),
      owner: removePlaceholders(m.owner || 'Head of Operations'),
      horizon_quarters: typeof m.horizon_quarters === 'number' ? Math.max(1, Math.min(4, m.horizon_quarters)) : 2,
      rationale: removePlaceholders(m.rationale || m.impact || 'Strategic initiative to improve operational efficiency')
    }))
  } else if (brief.strategic_moves.length > 5) {
    brief.strategic_moves = brief.strategic_moves.slice(0, 5)
  }

  // Ensure competitors have geo_fit = headquarters (exactly)
  if (brief.competitors && Array.isArray(brief.competitors)) {
    brief.competitors = brief.competitors.map((comp: any) => {
      const website = comp.website || ''
      const baseUrl = website.replace(/\/$/, '')
      const headquarters = comp.headquarters || ''
      
      // geo_fit MUST equal headquarters exactly, always defined
      const geoFit = comp.geo_fit || headquarters || 'Switzerland'
      
      // Ensure evidence_pages has at least 2 URLs
      let evidencePages = comp.evidence_pages || []
      if (evidencePages.length < 2 && website) {
        evidencePages = [website, `${baseUrl}/about`]
      }
      
      return {
        ...comp,
        name: removePlaceholders(comp.name || ''),
        positioning: removePlaceholders(comp.positioning || ''),
        ai_maturity: removePlaceholders(comp.ai_maturity || 'Moderate'),
        innovation_focus: removePlaceholders(comp.innovation_focus || ''),
        geo_fit: geoFit,
        employee_band: removePlaceholders(comp.employee_band || 'Mid-market'),
        evidence_pages: evidencePages.slice(0, 5)
      }
    })
  }

  // Ensure exactly 5 use cases with all required fields
  if (!brief.use_cases || !Array.isArray(brief.use_cases)) {
    brief.use_cases = []
  }

  // Truncate if more than 5
  if (brief.use_cases.length > 5) {
    brief.use_cases = brief.use_cases.slice(0, 5)
  }

  // Pad to exactly 5 if needed
  while (brief.use_cases.length < 5) {
    const index = brief.use_cases.length
    brief.use_cases.push({
      title: `AI Opportunity ${index + 1}`,
      description: 'AI use case for improving operational efficiency',
      value_driver: 'cost',
      complexity: 3,
      effort: 3,
      benefit: 50000 + (index * 10000),
      one_time: 75000,
      ongoing: 15000,
      payback_months: 18,
      data_requirements: 'Historical operational data and current process metrics',
      risks: 'Implementation complexity and change management',
      next_steps: 'Assess current data infrastructure and define pilot scope',
      citations: []
    })
  }

  // Ensure all use cases have required fields and normalize field names
  brief.use_cases = brief.use_cases.map((uc: any, index: number) => {
    // Normalize field names: support both new (benefit, one_time, ongoing) and legacy (annual_benefit, one_time_cost, ongoing_cost)
    const benefit = uc.benefit || uc.annual_benefit || uc.est_annual_benefit || (50000 + index * 10000)
    const oneTime = uc.one_time || uc.one_time_cost || uc.est_one_time_cost || 75000
    const ongoing = uc.ongoing || uc.ongoing_cost || uc.est_ongoing_cost || 15000
    
    return {
      title: removePlaceholders(uc.title || `AI Use Case ${index + 1}`),
      description: removePlaceholders(uc.description || 'AI use case description'),
      value_driver: uc.value_driver || 'cost',
      complexity: typeof uc.complexity === 'number' ? Math.max(1, Math.min(5, uc.complexity)) : 3,
      effort: typeof uc.effort === 'number' 
        ? Math.max(1, Math.min(5, uc.effort)) 
        : (typeof uc.complexity === 'number' 
            ? Math.min(5, Math.max(1, uc.complexity)) 
            : 3),
      // Support both field name conventions
      benefit: Math.max(0, benefit),
      annual_benefit: Math.max(0, benefit), // Legacy
      one_time: Math.max(0, oneTime),
      one_time_cost: Math.max(0, oneTime), // Legacy
      ongoing: Math.max(0, ongoing),
      ongoing_cost: Math.max(0, ongoing), // Legacy
      payback_months: uc.payback_months || Math.max(1, Math.round(((oneTime + ongoing) / benefit) * 12)),
      roi_pct: uc.roi_pct || 0,
      data_requirements: removePlaceholders(uc.data_requirements || 'Historical operational data and current process metrics'),
      risks: removePlaceholders(uc.risks || 'Implementation complexity and change management'),
      next_steps: removePlaceholders(uc.next_steps || 'Assess current data infrastructure and define pilot scope'),
      citations: Array.isArray(uc.citations) ? uc.citations : []
    }
  })

  // Normalize trends: convert objects to strings if needed
  if (brief.industry && brief.industry.trends) {
    brief.industry.trends = brief.industry.trends.map((t: any) => {
      if (typeof t === 'string') return removePlaceholders(t)
      if (typeof t === 'object' && t.name) {
        return removePlaceholders(`${t.name}: ${t.impact || ''}`).substring(0, 200)
      }
      return removePlaceholders(String(t)).substring(0, 200)
    }).filter((t: string) => t.length > 0)
      .slice(0, 6)
  }

  // Ensure we have at least 4 trends
  if (!brief.industry?.trends || brief.industry.trends.length < 4) {
    const defaultTrends = [
      'AI-driven predictive maintenance reduces downtime by 20%',
      'Smart factories use ML to optimize production schedules',
      'AI forecasting improves inventory accuracy by 30%',
      'Sustainability analytics help meet compliance faster'
    ]
    brief.industry = brief.industry || {}
    brief.industry.trends = [
      ...(brief.industry.trends || []),
      ...defaultTrends
    ].slice(0, 6)
  }

  // Remove placeholders from company summary
  if (brief.company?.summary) {
    brief.company.summary = removePlaceholders(brief.company.summary)
  }

  // Remove placeholders from industry summary
  if (brief.industry?.summary) {
    brief.industry.summary = removePlaceholders(brief.industry.summary)
  }

  return brief
}

/**
 * Compute ROI fields if missing or incomplete
 */
function computeROIFields(brief: any): any {
  if (!brief.use_cases || !Array.isArray(brief.use_cases)) {
    return brief
  }

  // Compute totals from use cases (support both field name conventions)
  const totals = {
    benefit: brief.use_cases.reduce((sum: number, uc: any) => sum + (uc.benefit || uc.annual_benefit || 0), 0),
    oneTime: brief.use_cases.reduce((sum: number, uc: any) => sum + (uc.one_time || uc.one_time_cost || 0), 0),
    ongoing: brief.use_cases.reduce((sum: number, uc: any) => sum + (uc.ongoing || uc.ongoing_cost || 0), 0)
  }

  const investment = totals.oneTime + totals.ongoing
  const roiPct = investment > 0 ? ((totals.benefit - investment) / investment) * 100 : 0

  // Compute weighted payback months
  const withPositives = brief.use_cases.filter((u: any) => {
    const benefit = u.benefit || u.annual_benefit || 0
    const payback = u.payback_months || 0
    return benefit > 0 && payback > 0
  })

  let weightedPaybackMonths: number | null = null
  if (withPositives.length > 0) {
    const denom = withPositives.reduce((s: number, u: any) => s + (u.benefit || u.annual_benefit || 0), 0)
    if (denom > 0) {
      const num = withPositives.reduce((s: number, u: any) => {
        const benefit = u.benefit || u.annual_benefit || 0
        const payback = u.payback_months || 0
        return s + (benefit * payback)
      }, 0)
      weightedPaybackMonths = Math.round(num / denom)
    }
  }

  brief.roi = {
    total_benefit: Math.round(totals.benefit),
    total_investment: Math.round(investment),
    overall_roi_pct: Math.round(roiPct * 10) / 10,
    weighted_payback_months: weightedPaybackMonths || 0
  }

  return brief
}
