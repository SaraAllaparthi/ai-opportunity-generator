# AI Opportunity Brief

Generate a company-specific AI Opportunity Brief with citations, 5 tailored use cases, and a simple ROI view.

## Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui-style primitives (dark mode supported)
- Supabase (Postgres) for persistence
- OpenAI API for research and reasoning (JSON mode)

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
2. API uses OpenAI to research company information and generate structured data
3. LLM (OpenAI) generates strict JSON per schema; validated with Zod; single retry on failure
4. Brief is persisted to Supabase and can be opened via share slug

## Analytics
Lightweight event hooks are console-logged and can be toggled via `ENABLE_ANALYTICS=1`.

## Guardrails
- All provider calls are server-side; keys pulled from env only
- Facts require citations; statements are de-duplicated and concise
- PII should not be included in public pages; keep content business-level

## Deployment

### Vercel Deployment

1. **Environment Variables**: Add all required environment variables in Vercel dashboard (Settings → Environment Variables):
   - `OPENAI_API_KEY` (required)
   - `SUPABASE_URL` (required)
   - `SUPABASE_SERVICE_ROLE_KEY` (required)
   - `ENABLE_ANALYTICS` (optional, set to "0" or "1")

2. **Timeout Configuration**: 
   - The research API route is configured for up to 300 seconds (5 minutes)
   - **Important**: This requires a Vercel Pro plan. The Hobby plan has a 10-second timeout limit which is insufficient for this pipeline
   - If you're on Hobby plan, you'll need to upgrade or optimize the pipeline to run faster

3. **Runtime**: Uses Node.js runtime (not Edge) for better compatibility

4. **Troubleshooting**:
   - Check Vercel function logs for detailed error messages
   - Verify all environment variables are set correctly
   - If you see timeout errors, check your Vercel plan limits
   - The `/api/health` endpoint can help verify configuration

### Common Issues

- **Timeout errors**: Upgrade to Vercel Pro plan or optimize pipeline
- **Missing API keys**: Verify all environment variables are set in Vercel dashboard
- **Database errors**: Check Supabase connection and table schema

## Notes
- This is an MVP scaffold. TODOs are left where deeper logic/polish is needed.
- For shadcn/ui, styles are implemented via Tailwind tokens to avoid client setup.


