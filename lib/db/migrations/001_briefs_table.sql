-- Migration: Create briefs table with JSONB data column
-- This table stores AI Opportunity Briefs with competitor information

CREATE TABLE IF NOT EXISTS public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_briefs_share_slug ON briefs(share_slug);
CREATE INDEX IF NOT EXISTS idx_briefs_created_at ON briefs(created_at);

-- Optional: GIN indexes for JSONB queries (uncomment if needed for complex queries)
-- CREATE INDEX IF NOT EXISTS idx_briefs_competitors 
-- ON briefs USING GIN ((data->'competitors'));
-- 
-- CREATE INDEX IF NOT EXISTS idx_briefs_company_name 
-- ON briefs USING GIN ((data->'company'->>'name'));

-- Add comment to table
COMMENT ON TABLE public.briefs IS 'Stores AI Opportunity Briefs with company information, competitors, use cases, and ROI analysis';
COMMENT ON COLUMN public.briefs.data IS 'JSONB object containing the complete brief data including competitors array';

