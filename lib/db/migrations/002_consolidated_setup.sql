-- Consolidated Migration Script (002-006)
-- Covers: Auth Schema, Test Users, Fix Recursion, Deleted At, RLS Fixes
-- This script corresponds to the consolidated state of the database from 002 onwards.
-- NOTE: This script assumes 'briefs' table (001) already exists.

-- ==========================================
-- 1. Helper Functions (Fix Recursion - 004)
-- ==========================================

-- Secure function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE auth_user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ==========================================
-- 2. App Users Table (002)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  
  role text NOT NULL DEFAULT 'user',        -- 'user' | 'admin'
  status text NOT NULL DEFAULT 'invited',   -- 'invited' | 'active' | 'disabled'
  
  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Policies for app_users
-- Users can read their own data
DROP POLICY IF EXISTS "Users can view own app_user data" ON public.app_users;
CREATE POLICY "Users can view own app_user data" ON public.app_users
  FOR SELECT USING (auth.uid() = auth_user_id);

-- Admins can view all app_users (Using non-recursive function check)
DROP POLICY IF EXISTS "Admins can view all app_users" ON public.app_users;
CREATE POLICY "Admins can view all app_users" ON public.app_users
  FOR SELECT USING (
    public.is_admin()
  );

-- ==========================================
-- 3. Reports Table (002)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  report_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies for reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own reports" ON public.reports;
CREATE POLICY "Users can insert own reports" ON public.reports
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

-- ==========================================
-- 4. Report Shares (002 + 006 Fix)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports (id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

-- Fix: Explicitly enable RLS (006)
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- Policies for report_shares
-- Owner access (Authenticated)
DROP POLICY IF EXISTS "Users can view shares for their reports" ON public.report_shares;
CREATE POLICY "Users can view shares for their reports" ON public.report_shares
  FOR SELECT USING (
    created_by_user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create shares for their reports" ON public.report_shares;
CREATE POLICY "Users can create shares for their reports" ON public.report_shares
  FOR INSERT WITH CHECK (
    created_by_user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update shares for their reports" ON public.report_shares;
CREATE POLICY "Users can update shares for their reports" ON public.report_shares
  FOR UPDATE USING (
    created_by_user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

-- Public access (Anonymous)
DROP POLICY IF EXISTS "Public can view valid shares" ON public.report_shares;
CREATE POLICY "Public can view valid shares" ON public.report_shares
  FOR SELECT
  TO anon
  USING (
    revoked_at IS NULL 
    AND now() < expires_at
  );


-- ==========================================
-- 6. Briefs Updates (005)
-- ==========================================

-- Alter briefs table (from 001) to add soft delete
ALTER TABLE public.briefs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_briefs_deleted_at ON public.briefs(deleted_at);
