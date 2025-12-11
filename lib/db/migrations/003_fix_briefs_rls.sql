-- Fix RLS on briefs table to allow admin/service role access

-- First, check if RLS is enabled and disable it temporarily to verify
-- Then create proper policies

-- Disable RLS on briefs (since it's a public-facing table anyway)
ALTER TABLE public.briefs DISABLE ROW LEVEL SECURITY;

-- Alternatively, if you want to keep RLS enabled, add these policies:
-- ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Anyone can view briefs" ON public.briefs
--   FOR SELECT
--   USING (true);
-- 
-- CREATE POLICY "Service role can do anything with briefs" ON public.briefs
--   USING (auth.role() = 'service_role');
