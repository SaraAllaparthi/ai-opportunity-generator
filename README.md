# AI Opportunity Brief

Generate a company-specific AI Opportunity Brief with citations, 5 tailored use cases, and a simple ROI view.

## Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui-style primitives (dark mode supported)
- Supabase (Postgres) for persistence
- Perplexity API for competitor discovery (web search)
- OpenAI API for reasoning (JSON mode)

## Setup
1. Clone repository and install deps:
   ```bash
   pnpm i # or npm i / yarn
   ```
2. Copy environment example and fill values:
   ```bash
   cp env.example .env.local # if .env.example is unavailable in your environment
   ```
   - Do not commit real keys.
   - Missing/incorrect keys will cause runtime errors.
3. Configure Supabase with a `briefs` table:
   ```sql
   create table if not exists public.briefs (
     id uuid primary key default gen_random_uuid(),
     share_slug text unique not null,
     created_at timestamptz not null default now(),
     data jsonb not null
   );
   ```
   - For MVP, the app uses the service role on the server. Do not expose it to clients.

## Running Locally
```bash
pnpm dev
```
Open http://localhost:3000

## Flow Overview
1. User submits company name + website
2. For competitor discovery: API calls Perplexity with 3–5 targeted queries; extracts competitors via OpenAI
3. LLM (OpenAI) converts research data to strict JSON per schema; validated with Zod; single retry on failure
4. Brief is persisted to Supabase and can be opened via share slug

## Analytics
Lightweight event hooks are console-logged and can be toggled via `ENABLE_ANALYTICS=1`.

## Guardrails
- All provider calls are server-side; keys pulled from env only
- Facts require citations; statements are de-duplicated and concise
- PII should not be included in public pages; keep content business-level

## Deployment
- Target: Vercel. Add env vars in Vercel dashboard.
- Ensure Supabase URL and Service Role Key are configured as Server Environment Variables only.

## Notes
- This is an MVP scaffold. TODOs are left where deeper logic/polish is needed.
- For shadcn/ui, styles are implemented via Tailwind tokens to avoid client setup.


