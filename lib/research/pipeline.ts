import { tavilySearch } from '@/lib/providers/tavily'
import { llmGenerateJson } from '@/lib/providers/llm'
import { Brief, BriefSchema } from '@/lib/schema/brief'
import { dedupeUrls } from '@/lib/utils/citations'

export type PipelineInput = { name: string; website: string }

function buildQueries({ name, website }: PipelineInput): string[] {
  const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return [
    `${name} company profile products site:${domain}`,
    `${name} industry trends 2023..today`,
    `${name} news launch funding partnership 2023..today`,
    `${name} competitors alternatives comparison`,
    `${name} common pain points customers complaints`
  ]
}

export type ResearchSnippet = { title: string; url: string; content: string }

export async function runResearchPipeline(input: PipelineInput): Promise<{ brief: Brief; citations: string[] }> {
  const queries = buildQueries(input)

  const all: ResearchSnippet[] = []
  for (const q of queries) {
    const res = await tavilySearch(q, { maxResults: 6 })
    all.push(...res)
  }

  // Deduplicate by URL and keep top 12-15
  const uniqueByUrl = new Map<string, ResearchSnippet>()
  for (const r of all) {
    if (!uniqueByUrl.has(r.url)) uniqueByUrl.set(r.url, r)
  }
  const top = Array.from(uniqueByUrl.values()).slice(0, 15)
  const citations = dedupeUrls(top.map((t) => t.url))

  const schemaRules = [
    'Top-level keys: company, industry, strategic_moves, competitors, use_cases, citations',
    'company: { name, website, summary }',
    'industry: { summary, trends[] (max 5) }',
    'strategic_moves[]: { title, dateISO, impact, citations[] } (max 5)',
    'competitors[]: { name, website, positioning, citations[] } (max 5)',
    'use_cases[]: EXACTLY 5 items; each { title, description, value_driver in [revenue|cost|risk|speed], complexity 1..5, effort 1..5, est_annual_benefit?, est_one_time_cost?, est_ongoing_cost?, payback_months?, data_requirements, risks, next_steps, citations[] }',
    'citations: array of URLs used across sections',
    'Return ONLY a JSON object. No markdown, no prose.'
  ]

  const system = `You are a diligent analyst. Produce STRICT JSON matching the schema rules. Always include citations used for each claim. Do not include any text outside the JSON.`
  const user = JSON.stringify({
    input,
    snippets: top,
    schema_rules: schemaRules,
    rules: [
      'Cite sources via URLs used in each section',
      'De-duplicate statements; max 5 bullets per section',
      'Provide exactly 5 use cases with required fields',
      'Label uncertain numbers as estimates and keep conservative'
    ]
  })

  let parsed: Brief | null = null
  let firstError: any | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const promptUser = (() => {
      if (attempt === 0) return user
      // On retry, include validation error details and restate critical constraints
      const ve = firstError?.issues ? firstError.issues : String(firstError)
      return JSON.stringify({
        input,
        snippets: top,
        schema_rules: schemaRules,
        fix: {
          message: 'Previous output failed validation. Correct ALL issues and return valid JSON only.',
          validation_error: ve,
          critical: [
            'Return a JSON object (no markdown) matching the schema_rules',
            'Ensure use_cases has EXACTLY 5 items',
            'Ensure value_driver is one of revenue|cost|risk|speed',
            'Ensure complexity and effort are integers between 1 and 5'
          ]
        }
      })
    })()
    const json = await llmGenerateJson(system, promptUser)
    const result = BriefSchema.safeParse(json)
    if (result.success) {
      parsed = result.data
      break
    } else {
      firstError = result.error
    }
  }

  if (!parsed) throw new Error('Failed to validate model output')

  // Attach aggregated citations
  parsed.citations = dedupeUrls([...(parsed.citations || []), ...citations])

  return { brief: parsed, citations: parsed.citations }
}


