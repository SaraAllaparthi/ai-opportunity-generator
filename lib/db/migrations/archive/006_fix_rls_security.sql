-- Fix Supabase Security Warnings
-- 1. Enable RLS on report_shares (policies already exist, but RLS was not enabled)
-- 2. Enable RLS on test_users (no policies needed as it's only accessed via service role)

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_users ENABLE ROW LEVEL SECURITY;
