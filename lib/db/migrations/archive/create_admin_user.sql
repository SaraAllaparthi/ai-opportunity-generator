-- Manual User Creation Script
-- Run this in Supabase SQL Editor to create a test admin user

-- Step 1: Create a user in auth.users with a known password
-- Note: You'll need to use Supabase Dashboard UI for this, or use the admin API

-- For now, let's create a user via SQL that you can use with magic link
-- First, check if any users exist:
SELECT id, email, created_at, email_confirmed_at 
FROM auth.users;

-- If you want to completely reset, delete all users:
-- DELETE FROM auth.users;

-- To create an admin user manually after they sign up:
-- 1. Sign up via the UI (magic link or password)
-- 2. Then run this to make them admin:

UPDATE public.app_users 
SET role = 'admin', status = 'active' 
WHERE email = 'YOUR_EMAIL_HERE';

-- Verify it worked:
SELECT au.email, au.role, au.status, u.email_confirmed_at
FROM public.app_users au
JOIN auth.users u ON au.auth_user_id = u.id;
