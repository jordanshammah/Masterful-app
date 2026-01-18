-- ============================================================================
-- FIX: Apply RLS Policies for Become a Pro Feature
-- ============================================================================
-- This SQL script fixes the "Permission denied" error when users try to become professionals
-- 
-- INSTRUCTIONS:
-- 1. Copy ALL the SQL below (from line 8 to the end)
-- 2. Go to Supabase Dashboard: https://app.supabase.com/
-- 3. Select your project
-- 4. Click "SQL Editor" in the left sidebar
-- 5. Paste the SQL code
-- 6. Click "Run" (or press Ctrl+Enter)
-- 7. You should see "Success. No rows returned"
--
-- ============================================================================

-- Fix 1: Add INSERT and UPDATE policies for user_roles table
-- This allows users to add and update roles for themselves (needed for upsert operations)

-- Drop existing policies if they exist (makes this script safe to run multiple times)
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;

-- Create INSERT policy - allows users to add roles to themselves
CREATE POLICY "Users can insert own roles" 
  ON public.user_roles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy - allows users to update their own roles (needed for upsert)
CREATE POLICY "Users can update own roles" 
  ON public.user_roles FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix 2: Fix circular dependency in providers INSERT policy
-- The original policy required users to already have the 'provider' role,
-- but they couldn't get the role because there was no INSERT policy for user_roles.

-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Providers can insert own profile" ON public.providers;

-- Create new policy that allows users to create their own provider profile
-- without needing the provider role first
CREATE POLICY "Users can insert own provider profile" 
  ON public.providers FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- VERIFICATION:
-- ============================================================================
-- After running this script, verify the policies were created by running:
--
-- SELECT policyname, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'user_roles' 
-- AND policyname IN ('Users can insert own roles', 'Users can update own roles');
--
-- You should see 2 rows returned.
-- ============================================================================




