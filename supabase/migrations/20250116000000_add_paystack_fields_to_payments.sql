-- Migration: Add Paystack-specific fields to payments table
-- Created: 2026-01-16
-- Purpose: Enable proper webhook verification and audit logging per Paystack spec

-- Add Paystack tracking columns
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'paystack',
ADD COLUMN IF NOT EXISTS paystack_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
ADD COLUMN IF NOT EXISTS paystack_subaccount_id TEXT,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS gateway_response JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_paystack_transaction_id 
ON public.payments(paystack_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payments_paystack_reference 
ON public.payments(paystack_reference);

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key 
ON public.payments(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_payments_payment_provider 
ON public.payments(payment_provider);

-- Add unique constraint on paystack_reference (for idempotency)
ALTER TABLE public.payments 
ADD CONSTRAINT payments_paystack_reference_unique 
UNIQUE (paystack_reference);

-- Add comments for documentation
COMMENT ON COLUMN public.payments.payment_provider IS 'Payment gateway used (paystack, stripe, etc)';
COMMENT ON COLUMN public.payments.paystack_transaction_id IS 'Paystack transaction ID from API response';
COMMENT ON COLUMN public.payments.paystack_reference IS 'Unique Paystack reference for this transaction';
COMMENT ON COLUMN public.payments.paystack_subaccount_id IS 'Paystack subaccount ID for split payments';
COMMENT ON COLUMN public.payments.idempotency_key IS 'Idempotency key to prevent duplicate payment records';
COMMENT ON COLUMN public.payments.metadata IS 'Additional metadata from payment (job_id, customer_id, etc)';
COMMENT ON COLUMN public.payments.gateway_response IS 'Full gateway response for audit (JSONB)';
