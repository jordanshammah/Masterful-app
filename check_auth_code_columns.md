-- Verify all auth code columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('auth_code_customer', 'auth_code_provider', 'customer_start_code_hash', 'provider_end_code_hash')
ORDER BY column_name;

-- Check if there are any RLS policies on the jobs table that might block updates
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'jobs';









