-- Add missing plain text auth code columns to jobs table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS auth_code_customer TEXT,
ADD COLUMN IF NOT EXISTS auth_code_provider TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.jobs.auth_code_customer IS 'Plain text customer start code for display';
COMMENT ON COLUMN public.jobs.auth_code_provider IS 'Plain text provider end code for display';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('auth_code_customer', 'auth_code_provider', 'customer_start_code_hash', 'provider_end_code_hash')
ORDER BY column_name;









