-- Fix code hashes for existing jobs
-- This script recalculates hashes from plain text codes to fix mismatches
-- Run this in Supabase Dashboard → SQL Editor

-- First, let's see which jobs have mismatched codes
SELECT 
    id,
    auth_code_customer,
    customer_start_code_hash,
    auth_code_provider,
    provider_end_code_hash,
    status
FROM jobs
WHERE (auth_code_customer IS NOT NULL OR auth_code_provider IS NOT NULL);

-- Note: We can't directly calculate SHA-256 hashes in SQL
-- This needs to be done via the Edge Function or a migration script
-- The Edge Function should handle this automatically when codes are regenerated

-- Alternative: Clear codes that have mismatches and let users regenerate
-- This is safer than trying to recalculate hashes in SQL

-- Option 1: Clear codes with potential mismatches (safest)
-- UPDATE jobs
-- SET auth_code_customer = NULL
-- WHERE auth_code_customer IS NOT NULL 
--   AND customer_start_code_hash IS NOT NULL
--   AND status IN ('pending', 'confirmed');

-- Option 2: Clear all codes and let users regenerate (if you want a clean slate)
-- UPDATE jobs
-- SET auth_code_customer = NULL,
--     auth_code_provider = NULL
-- WHERE status IN ('pending', 'confirmed', 'in_progress');








