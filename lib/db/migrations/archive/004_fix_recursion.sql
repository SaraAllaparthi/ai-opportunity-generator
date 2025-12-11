-- Fix infinite recursion in app_users RLS policy

-- 1. Create a security definer function to check if the current user is an admin
-- This function runs with the privileges of the creator (postgres/superuser usually), bypassing RLS on app_users
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

-- 2. Update the recursive policy to use the non-recursive function
DROP POLICY IF EXISTS "Admins can view all app_users" ON public.app_users;

CREATE POLICY "Admins can view all app_users" ON public.app_users
  FOR SELECT USING (
    public.is_admin()
  );
