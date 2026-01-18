# Paystack Webhook → Verify: Implementation Status

## Overview

This document describes the current implementation of Paystack webhook processing and verification, mapped against the comprehensive specification provided.

## Implementation Summary

### ✅ Completed

1. **Webhook Reception & Signature Verification** (`paystack-webhook`)
   - ✅ HMAC-SHA512 signature verification
   - ✅ Returns `401` on invalid signature
   - ✅ Returns `200` immediately after validation
   - ✅ Supports multiple secret key environment variables
   - ✅ Rate limiting by IP (100 req/min)
   - ✅ CORS handling for development
   - ✅ Structured logging with request IDs

2. **Idempotency** (`paystack-webhook`)
   - ✅ Database-backed idempotency using `paystack_webhook_events` table
   - ✅ Uses `event.data.id` if available, falls back to `reference + eventType`
   - ✅ Upsert pattern with `event_id` as conflict target
   - ✅ In-memory cache for fast duplicate detection
   - ✅ Prevents double-processing of webhooks

3. **Event Processing** (`paystack-webhook`)
   - ✅ `charge.success`: Updates payment & job status, creates payout records
   - ✅ `charge.failed`: Logs failure without blocking retries
   - ✅ `transfer.success`: Marks provider payouts as completed
   - ⚠️ Other events (refund, etc.) logged but not fully handled

4. **Payment Record Updates** (Both functions)
   - ✅ Updates `payments.status` to "completed" on success
   - ✅ Sets `processed_at` timestamp
   - ⚠️ **Schema limitation**: `gateway_response` column doesn't exist yet (see Migration below)
   - ✅ Idempotent: Only updates if status ≠ "completed"

5. **Job Status Updates** (`paystack-webhook`)
   - ✅ Updates `jobs.payment_status` to "completed"
   - ✅ Sets `payment_completed_at`, `payment_amount`, `payment_method`, `payment_reference`
   - ✅ Marks job `status` as "completed"
   - ✅ Only updates if `payment_status = 'pending'` (idempotency)

6. **Provider Payout Creation** (Both functions)
   - ✅ Creates `payouts` record with platform fee calculation
   - ✅ Links to job, payment, and payout method
   - ✅ Sets `currency` from Paystack response
   - ✅ Marks as "completed" if subaccount routing was used
   - ✅ Marks as "pending" if manual payout required
   - ✅ Includes metadata for audit trail

7. **Server-to-Server Verification** (`paystack-verify`)
   - ✅ Calls Paystack's `/transaction/verify/:reference` endpoint
   - ✅ Uses secret key (server-side only)
   - ✅ JWT authentication for client requests
   - ✅ Rate limiting (10 req/min per user)
   - ✅ Validates user owns the job before updating
   - ✅ Reconciles payment status with Paystack
   - ✅ Creates payout if missing (duplicate webhook safety)

8. **Security**
   - ✅ Webhook: No JWT (Paystack servers don't send JWTs)
   - ✅ Verify: JWT required (client-initiated)
   - ✅ Signature verification prevents forgery
   - ✅ Rate limiting on both endpoints
   - ✅ Input sanitization (reference format validation)
   - ✅ Service role key used for admin operations

9. **Observability**
   - ✅ Structured console logging with request IDs
   - ✅ Logs all webhook events, signatures, metadata
   - ✅ Logs payment/job/payout updates
   - ✅ Error logging with context
   - ✅ Success/failure indicators (✅ ❌ ⚠️)

### ⚠️ Partially Implemented / Pending

1. **Database Schema**
   - ⚠️ **Missing columns**: `payments` table lacks Paystack-specific fields
   - ⚠️ Current implementation uses base schema only (`id`, `job_id`, `amount`, `status`, `payment_method`, `processed_at`)
   - ⚠️ Enhanced schema ready but not deployed (see migration file)

2. **Gateway Response Storage**
   - ⚠️ Full Paystack response not persisted (no `gateway_response` column yet)
   - ⚠️ Limited to storing status, amount, timestamps in current schema

3. **Error Handling**
   - ⚠️ No automatic retry logic for transient failures
   - ⚠️ No circuit breaker for Paystack API calls
   - ✅ Graceful degradation (webhook continues if payment record update fails)

4. **Notifications**
   - ❌ TODO: Send notifications to customer and provider on successful payment
   - ❌ TODO: Send failure notifications

5. **Refunds**
   - ❌ `refund.processed` event logged but not handled

6. **Transfer Failures**
   - ❌ `transfer.failed` event logged but not handled

7. **Reconciliation**
   - ❌ No automated reconciliation job for unmatched references
   - ❌ No admin dashboard for unmatched webhooks

## Current Flow

### 1. Webhook Receipt (`paystack-webhook`)

```
Paystack → POST /paystack-webhook
  ↓
1. Verify signature (HMAC-SHA512)
  ↓ (invalid → return 401)
2. Check rate limit (100/min per IP)
  ↓ (exceeded → return 429)
3. Parse event JSON
  ↓
4. Check idempotency (DB + in-memory)
  ↓ (duplicate → return 200)
5. Insert webhook event record
  ↓
6. Process event based on type
  ↓
7. Mark webhook as processed
  ↓
8. Return 200 OK
```

### 2. Event Processing (`handleChargeSuccess`)

```
charge.success event
  ↓
1. Extract metadata (job_id, customer_id, provider_id)
  ↓
2. Update payment record (status → completed)
  ↓
3. Update job record (payment_status → completed, job status → completed)
  ↓
4. Calculate platform fee and net amount
  ↓
5. Get provider's default payout method (if exists)
  ↓
6. Create payout record
   - Status: "completed" if subaccount routing
   - Status: "pending" if manual payout needed
  ↓
7. Log success
```

### 3. Client Verification (`paystack-verify`)

```
Client → POST /paystack-verify { reference }
  ↓
1. Verify JWT (authenticate user)
  ↓
2. Check rate limit (10/min per user)
  ↓
3. Validate reference format
  ↓
4. Call Paystack API: GET /transaction/verify/:reference
  ↓
5. Reconcile payment record (update if status = success)
  ↓
6. Update job record (if user owns job)
  ↓
7. Create payout record (if missing)
  ↓
8. Return verification result + reconciliation status
```

## Database Schema Requirement

### Current Schema (base)

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status payment_status DEFAULT 'pending',
  payment_method TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Required Schema (enhanced)

```sql
ALTER TABLE public.payments 
ADD COLUMN payment_provider TEXT DEFAULT 'paystack',
ADD COLUMN paystack_transaction_id TEXT,
ADD COLUMN paystack_reference TEXT UNIQUE,
ADD COLUMN paystack_subaccount_id TEXT,
ADD COLUMN idempotency_key TEXT,
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN gateway_response JSONB;

-- Indexes for performance
CREATE INDEX idx_payments_paystack_reference ON payments(paystack_reference);
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
```

**Migration file created**: `supabase/migrations/20250116000000_add_paystack_fields_to_payments.sql`

## Applying the Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard → SQL Editor**
2. Copy the contents of `supabase/migrations/20250116000000_add_paystack_fields_to_payments.sql`
3. Paste and execute

### Option 2: Supabase CLI

```bash
cd Masterful-app
npx supabase db push
```

### Option 3: Manual SQL

Run the migration file directly against your database.

## Testing Checklist

### After Migration

- [ ] Trigger a test payment (M-Pesa or card)
- [ ] Verify webhook logs show successful signature verification
- [ ] Verify payment record updated with `gateway_response` populated
- [ ] Verify job status updated to "completed"
- [ ] Verify payout record created
- [ ] Verify currency is set correctly (KES, NGN, etc.)
- [ ] Trigger duplicate webhook (should be idempotent)
- [ ] Test client verification endpoint
- [ ] Verify reconciliation works for unmatched payments

### Error Scenarios

- [ ] Invalid signature → 401
- [ ] Rate limit exceeded → 429
- [ ] Missing job_id in metadata → graceful degradation
- [ ] Duplicate webhook → idempotent (200 OK)
- [ ] Payment already completed → no duplicate payout
- [ ] Provider has no payout method → payout status = "pending"

## Spec Compliance Summary

| Requirement | Status | Notes |
|-------------|--------|-------|
| Signature verification (HMAC-SHA512) | ✅ | Implemented |
| Idempotency (DB-backed) | ✅ | Using `paystack_webhook_events` |
| Server-to-server verification | ✅ | `paystack-verify` endpoint |
| Persist gateway response (JSONB) | ⚠️ | Ready, pending migration |
| Update payment status | ✅ | Implemented |
| Update job status | ✅ | Implemented |
| Create provider payouts | ✅ | Implemented |
| Calculate platform fee | ✅ | Implemented |
| Store currency | ✅ | Implemented |
| Idempotent updates | ✅ | Only update if status ≠ completed |
| Rate limiting | ✅ | Webhook: 100/min, Verify: 10/min |
| Structured logging | ✅ | Request IDs, context |
| Notification triggers | ❌ | TODO |
| Refund handling | ❌ | TODO |
| Transfer failure handling | ❌ | TODO |
| Reconciliation dashboard | ❌ | TODO |
| Automated reconciliation jobs | ❌ | TODO |

## Next Steps

1. **Apply Migration** (see above)
2. **Test End-to-End** (checklist above)
3. **Implement Notifications**
   - Email/SMS on successful payment
   - Notify provider of payout
4. **Implement Refund Handling**
   - Update job/payment status
   - Reverse payout if applicable
5. **Implement Transfer Failure Handling**
   - Mark payout as failed
   - Notify admin/provider
6. **Build Reconciliation Dashboard**
   - Show unmatched webhooks
   - Show failed payments
   - Manual reconciliation tools
7. **Automated Reconciliation**
   - Daily job to verify all payments
   - Use Paystack reports API

## Deployment Status

- ✅ `paystack-webhook` deployed (2026-01-16)
- ✅ `paystack-verify` deployed (2026-01-16)
- ⚠️ Migration pending (apply manually)
- ✅ JWT verification disabled for webhook (config.toml)

## Configuration

### Environment Variables

Both functions require:

- `PAYSTACK_SECRET_KEY` or `PAYSTACK_SECRET` or `PAYSTACK_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (verify only)
- `ALLOWED_ORIGINS` (optional, comma-separated)

### Webhook Config

File: `supabase/functions/paystack-webhook/config.toml`

```toml
verify_jwt = false  # ✅ Webhooks don't send JWTs
```

## Support

For issues or questions:

1. Check Supabase Edge Function logs in Dashboard
2. Look for request IDs in logs (format: `req_<timestamp>_<uuid>`)
3. Verify signature matches expected HMAC-SHA512
4. Ensure migration has been applied
5. Check Paystack dashboard for webhook delivery status
