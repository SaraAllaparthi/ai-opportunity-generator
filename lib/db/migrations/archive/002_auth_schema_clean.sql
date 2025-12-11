-- Migration: Auth Schema
-- Creates app_users, reports, and report_shares tables with RLS policies

-- 1. app_users table
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'invited',
  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app_user data" ON public.app_users
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all app_users" ON public.app_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- 2. reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  report_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can insert own reports" ON public.reports
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

-- 3. report_shares table
CREATE TABLE IF NOT EXISTS public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports (id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares for their reports" ON public.report_shares
  FOR SELECT USING (
    created_by_user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can create shares for their reports" ON public.report_shares
  FOR INSERT WITH CHECK (
    created_by_user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update shares for their reports" ON public.report_shares
  FOR UPDATE USING (
    created_by_user_id IN (SELECT id FROM public.app_users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Public can view valid shares" ON public.report_shares
  FOR SELECT TO anon USING (
    revoked_at IS NULL AND now() < expires_at
  );
