-- ============================================
-- COMPLETE DATABASE SETUP FOR AI OPPORTUNITY GENERATOR
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create app_users table
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on app_users
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own app_user data" ON public.app_users;
DROP POLICY IF EXISTS "Admins can view all app_users" ON public.app_users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.app_users;

-- Create RLS policies for app_users
CREATE POLICY "Users can view own app_user data" ON public.app_users
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all app_users" ON public.app_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all app_users" ON public.app_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.app_users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can do anything" ON public.app_users
  FOR ALL USING (true);

-- 2. Create or verify briefs table (your main reports table)
CREATE TABLE IF NOT EXISTS public.briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_slug TEXT UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  data jsonb NOT NULL
);

-- Enable RLS on briefs
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view briefs" ON public.briefs;
DROP POLICY IF EXISTS "Service role can insert briefs" ON public.briefs;

-- Create RLS policies for briefs
CREATE POLICY "Anyone can view briefs" ON public.briefs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role can insert briefs" ON public.briefs
  FOR INSERT WITH CHECK (true);

-- Create index on share_slug
CREATE INDEX IF NOT EXISTS idx_briefs_share_slug ON public.briefs(share_slug);

-- 3. Insert your admin user if not exists
-- Replace the auth_user_id with your actual Supabase auth user ID
INSERT INTO public.app_users (id, auth_user_id, email, role, status, activated_at)
VALUES (
  '7a94a12b-824b-47bd-b467-6bd9aa822846',
  'b986c53a-d3a7-4bc4-9099-25b2630c1323', -- Your auth user ID
  'rakesh@maverickaigroup.ai',
  'admin',
  'active',
  now()
)
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'admin',
  status = 'active',
  updated_at = now();

-- 4. Force PostgREST schema cache reload
-- This notifies PostgREST to reload the schema
NOTIFY pgrst, 'reload schema';

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.app_users TO anon, authenticated;
GRANT SELECT ON public.briefs TO anon, authenticated;
GRANT INSERT ON public.briefs TO authenticated;

-- 6. Verify tables exist
SELECT 'app_users table exists' as status, count(*) as row_count FROM public.app_users
UNION ALL
SELECT 'briefs table exists' as status, count(*) as row_count FROM public.briefs;
