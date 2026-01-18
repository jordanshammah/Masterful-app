/**
 * Paystack Webhook Handler Edge Function
 * 
 * CRITICAL SECURITY:
 * - Signature verification (HMAC SHA-512) - MUST verify all requests
 * - No JWT required (webhooks come from Paystack servers)
 * - Rate limiting by IP
 * - Idempotency (prevent duplicate processing)
 * 
 * Supported Events:
 * - charge.success: Payment completed successfully (STK Push, card, etc.)
 * - transfer.success: Payout to provider completed
 * - charge.failed: Payment failed
 * - refund.processed: Refund completed
 * 
 * Flow:
 * 1. Verify webhook signature
 * 2. Parse event type and data
 * 3. Check idempotency (prevent duplicates)
 * 4. Process event and update database
 * 5. Return 200 OK (always, to acknowledge receipt)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Security Utilities (Inlined for bundling compatibility)
// ============================================================================

// CORS Configuration
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean);
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;
  
  const isAllowed = origin && (
    allowedOrigins.includes(origin) || 
    (ALLOWED_ORIGINS.length === 0 && (
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      origin.includes('::1')
    ))
  );
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedOrigins[0] || '*'),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Rate Limiting
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const key = `${config.keyPrefix || 'rl'}:${identifier}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (entry && entry.resetAt <= now) {
    rateLimitStore.delete(key);
    entry = undefined;
  }
  
  if (!entry) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

async function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return timingSafeEqual(computedSignature, signature);
  } catch (error) {
    console.error('[security] Signature verification failed:', error);
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().substring(0, 8)}`;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getPaystackSecret(): string {
  return (
    Deno.env.get("PAYSTACK_SECRET_KEY") ||
    Deno.env.get("PAYSTACK_SECRET") ||
    Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ||
    ""
  );
}

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_CONFIG = {
  maxRequests: 100,    // 100 requests (webhooks can burst)
  windowMs: 60 * 1000, // per minute
  keyPrefix: 'paystack_webhook',
};

// Paystack webhook IPs (for additional verification)
// These may change - check Paystack docs for current list
const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220',
];

// ============================================================================
// Types
// ============================================================================

interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message?: string;
    gateway_response?: string;
    paid_at?: string;
    created_at: string;
    channel?: string;
    currency: string;
    ip_address?: string;
    metadata?: {
      job_id?: string;
      customer_id?: string;
      provider_id?: string;
      payment_type?: string;
      [key: string]: unknown;
    };
    fees?: number;
    customer?: {
      id: number;
      email: string;
      [key: string]: unknown;
    };
    authorization?: {
      authorization_code?: string;
      [key: string]: unknown;
    };
  };
}

// ============================================================================
// Idempotency Store (in-memory, use Redis/KV in production)
// ============================================================================

const processedEvents = new Set<string>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old entries periodically
setInterval(() => {
  // In production, use proper TTL with Redis
  if (processedEvents.size > 10000) {
    processedEvents.clear();
  }
}, 60 * 60 * 1000); // Every hour

// ============================================================================
// Event Handlers
// ============================================================================

async function handleChargeSuccess(
  data: PaystackWebhookEvent['data'],
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string
): Promise<void> {
  const jobId = data.metadata?.job_id;
  
  if (!jobId) {
    console.error(`[${requestId}] ❌ No job_id in metadata, skipping job update`);
    console.error(`[${requestId}] Full metadata:`, JSON.stringify(data.metadata, null, 2));
    console.error(`[${requestId}] This means the initiate-paystack function didn't include job_id in metadata, or Paystack didn't forward it.`);
    return;
  }
  
  console.log(`[${requestId}] ✅ Found job_id in metadata: ${jobId}`);

  const amountPaid = data.amount / 100; // Convert from minor units
  const paymentMethod = data.channel === 'mobile_money' ? 'mpesa' : 
                        data.channel === 'card' ? 'card' : 'other';

  console.log(`[${requestId}] Processing successful charge for job:`, {
    jobId,
    amount: amountPaid,
    reference: data.reference,
    channel: data.channel,
  });

  // ========================================================================
  // UPDATE PAYMENT RECORD
  // Note: Using only base schema columns until migrations are run
  // ========================================================================
  
  const { data: payment, error: paymentUpdateError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      payment_method: data.channel === 'mobile_money' ? 'mpesa' : data.channel,
      processed_at: data.paid_at || new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .neq("status", "completed")
    .select("id, job_id, customer_id, provider_id, amount")
    .maybeSingle();

  if (paymentUpdateError) {
    console.warn(`[${requestId}] Failed to update payment record:`, paymentUpdateError);
  } else if (payment) {
    console.log(`[${requestId}] ✅ Payment record updated: ${payment.id}`);
  }

  // ========================================================================
  // UPDATE JOB PAYMENT STATUS
  // ========================================================================
  
  const { data: updatedJob, error } = await supabaseAdmin
    .from("jobs")
    .update({
      payment_status: "completed",
      payment_completed_at: data.paid_at || new Date().toISOString(),
      payment_amount: amountPaid,
      payment_method: paymentMethod,
      payment_reference: data.reference,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("payment_status", "pending") // Only update if still pending (idempotency)
    .select("id, customer_id, provider_id, quote_total, platform_fee_percent")
    .single();

  if (error) {
    // Could be already processed or job not found
    console.warn(`[${requestId}] Failed to update job ${jobId}:`, error.message);
    return;
  }

  if (!updatedJob) {
    console.log(`[${requestId}] Job ${jobId} already processed or not found`);
    return;
  }

    console.log(`[${requestId}] Job ${jobId} payment completed successfully`);
    
  // ========================================================================
  // CREATE PAYOUT RECORD FOR PROVIDER
  // ========================================================================
  
  const platformFeePercent = updatedJob.platform_fee_percent || 15;
  const platformFee = amountPaid * (platformFeePercent / 100);
  const netAmount = amountPaid - platformFee;

  console.log(`[${requestId}] Creating payout: amount=${amountPaid}, fee=${platformFee}, net=${netAmount}`);

  try {
    // Get provider's default payout method
    const { data: payoutMethod } = await supabaseAdmin
      .from("provider_payout_methods")
      .select("id, paystack_subaccount_id")
      .eq("provider_id", updatedJob.provider_id)
      .eq("is_default", true)
      .maybeSingle();

    const subaccountId = payoutMethod?.paystack_subaccount_id || null;

    // Create payout record
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from("payouts")
      .insert({
        provider_id: updatedJob.provider_id,
        job_id: jobId,
        payment_id: payment?.id,
        payout_method_id: payoutMethod?.id,
        amount: amountPaid,
        currency: data.currency || 'KES',
        platform_fee: platformFee,
        net_amount: netAmount,
        status: subaccountId ? 'completed' : 'pending', // If routed to subaccount, mark as completed
        paystack_subaccount_id: subaccountId,
        initiated_at: new Date().toISOString(),
        completed_at: subaccountId ? new Date().toISOString() : null,
        metadata: {
          job_id: jobId,
          payment_reference: data.reference,
          paystack_fees: data.fees,
          routing_method: subaccountId ? 'subaccount' : 'manual',
        },
      })
      .select()
      .single();

    if (payoutError) {
      console.error(`[${requestId}] Failed to create payout:`, payoutError);
    } else {
      console.log(`[${requestId}] ✅ Payout created: ${payout.id} (status: ${payout.status})`);
      
      if (subaccountId) {
        console.log(`[${requestId}] Funds routed to subaccount: ${subaccountId}`);
      } else {
        console.log(`[${requestId}] Manual payout required - no subaccount routing`);
      }
    }
  } catch (error) {
    console.error(`[${requestId}] Error creating payout:`, error);
  }

  // TODO: Send notification to customer and provider
}

async function handleChargeFailed(
  data: PaystackWebhookEvent['data'],
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string
): Promise<void> {
  const jobId = data.metadata?.job_id;
  
  if (!jobId) {
    console.log(`[${requestId}] No job_id in metadata, skipping job update`);
    return;
  }

  console.log(`[${requestId}] Processing failed charge for job:`, {
    jobId,
    reference: data.reference,
    message: data.message,
    gateway_response: data.gateway_response,
  });

  // ========================================================================
  // UPDATE PAYMENT RECORD (do not override completed)
  // ========================================================================
  
  const { error: paymentUpdateError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
    })
    .eq("paystack_reference", data.reference)
    .neq("status", "completed");

  if (paymentUpdateError) {
    console.warn(`[${requestId}] Failed to update payment record:`, paymentUpdateError);
  }

  // ========================================================================
  // STEP 1: Verify job exists in database
  // ========================================================================
  const { data: existingJob, error: fetchError } = await supabaseAdmin
    .from("jobs")
    .select("id, payment_status")
    .eq("id", jobId)
    .single();

  if (fetchError || !existingJob) {
    console.error(`[${requestId}] Job ${jobId} not found in database:`, fetchError?.message);
    return;
  }

  // ========================================================================
  // STEP 2: Only update if payment is still pending (allow retry)
  // ========================================================================
  if (existingJob.payment_status === 'completed') {
    console.log(`[${requestId}] Job ${jobId} already completed, not updating failure info`);
    return;
  }

  // Update job with failure info (but don't change status - allow retry)
  const { error: updateError } = await supabaseAdmin
    .from("jobs")
    .update({
      payment_last_error: data.gateway_response || data.message || "Payment failed",
      payment_last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .neq("payment_status", "completed"); // Only update if not already completed

  if (updateError) {
    console.warn(`[${requestId}] Failed to update job ${jobId}:`, {
      error: updateError.message,
      code: updateError.code,
    });
  } else {
    console.log(`[${requestId}] Job ${jobId} failure info updated`);
  }
}

async function handleTransferSuccess(
  data: PaystackWebhookEvent['data'],
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string
): Promise<void> {
  // Handle provider payout completion
  console.log(`[${requestId}] Transfer success:`, {
    reference: data.reference,
    amount: data.amount / 100,
  });
  
  try {
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from("payouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("paystack_transfer_id", data.reference)
      .neq("status", "completed")
      .select("id, provider_id")
      .maybeSingle();

    if (payoutError) {
      console.warn(`[${requestId}] Failed to update payout for transfer:`, payoutError);
      return;
    }

    if (payout) {
      console.log(`[${requestId}] ✅ Payout marked completed: ${payout.id}`);
  // TODO: Notify provider of successful payout
    } else {
      console.log(`[${requestId}] No matching payout found for transfer: ${data.reference}`);
    }
  } catch (error) {
    console.error(`[${requestId}] Error updating payout for transfer:`, error);
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const requestId = generateRequestId();
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Log webhook attempt (always log, even if it fails)
  console.log(`[${requestId}] ===== WEBHOOK RECEIVED =====`);
  console.log(`[${requestId}] Method: ${req.method}`);
  console.log(`[${requestId}] URL: ${req.url}`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[${requestId}] Headers:`, {
    'x-paystack-signature': req.headers.get('x-paystack-signature') ? 'PRESENT' : 'MISSING',
    'content-type': req.headers.get('content-type'),
    'user-agent': req.headers.get('user-agent'),
    'x-forwarded-for': req.headers.get('x-forwarded-for'),
  });
  
  // Handle CORS preflight (shouldn't happen for webhooks, but just in case)
  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] Handling OPTIONS preflight`);
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    console.warn(`[${requestId}] Invalid method: ${req.method}`);
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ========================================================================
    // 1. Validate Environment Variables
    // ========================================================================
    
    let paystackSecretKey: string;
    let supabaseUrl: string;
    let supabaseServiceKey: string;
    
    try {
      paystackSecretKey = getPaystackSecret();
      if (!paystackSecretKey) {
        throw new Error("Missing required environment variable: PAYSTACK_SECRET_KEY");
      }
      supabaseUrl = requireEnv("SUPABASE_URL");
      supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    } catch (envError) {
      console.error(`[${requestId}] Environment error:`, envError);
      return new Response("Server configuration error", { status: 500 });
    }
    
    // ========================================================================
    // 2. Rate Limiting (by IP)
    // ========================================================================
    
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
    
    if (!rateLimitResult.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for IP ${clientIP}`);
      return new Response("Too many requests", { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000).toString(),
        },
      });
    }

    // ========================================================================
    // 3. Get Raw Body and Signature
    // ========================================================================
    
    const signature = req.headers.get('x-paystack-signature');
    
    if (!signature) {
      console.warn(`[${requestId}] Missing Paystack signature header`);
      return new Response("Missing signature", { status: 400 });
    }

    const rawBody = await req.text();
    
    if (!rawBody) {
      console.warn(`[${requestId}] Empty request body`);
      return new Response("Empty body", { status: 400 });
    }

    // ========================================================================
    // 4. Verify Webhook Signature (CRITICAL)
    // ========================================================================
    
    const isValid = await verifyPaystackSignature(rawBody, signature, paystackSecretKey);
    
    if (!isValid) {
      console.error(`[${requestId}] ❌ Invalid webhook signature from IP ${clientIP}`);
      console.error(`[${requestId}] Signature received: ${signature ? signature.substring(0, 20) + '...' : 'MISSING'}`);
      console.error(`[${requestId}] ⚠️  This could mean:`);
      console.error(`[${requestId}]    1. Webhook is not from Paystack (security issue)`);
      console.error(`[${requestId}]    2. PAYSTACK_SECRET_KEY doesn't match the key used to create the webhook`);
      console.error(`[${requestId}]    3. Signature verification algorithm mismatch`);
      return new Response("Invalid signature", { status: 401 });
    }

      console.log(`[${requestId}] ✅ Signature verified successfully`);

    // ========================================================================
    // 5. Parse Event
    // ========================================================================
    
    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error(`[${requestId}] Failed to parse webhook body`);
      return new Response("Invalid JSON", { status: 400 });
    }

    const eventType = event.event;
    const eventId = event.data?.id
      ? `paystack_${event.data.id}`
      : `${event.data.reference}_${eventType}`;

    console.log(`[${requestId}] ✅ Received webhook:`, {
      event: eventType,
      reference: event.data.reference,
      status: event.data.status,
      amount: event.data.amount,
      currency: event.data.currency,
      channel: event.data.channel,
      metadata: event.data.metadata,
    });
    
    // Log metadata details for debugging
    if (event.data.metadata) {
      console.log(`[${requestId}] Metadata:`, {
        job_id: event.data.metadata.job_id,
        customer_id: event.data.metadata.customer_id,
        provider_id: event.data.metadata.provider_id,
        payment_type: event.data.metadata.payment_type,
        request_id: event.data.metadata.request_id,
      });
    } else {
      console.warn(`[${requestId}] ⚠️  No metadata in webhook payload!`);
    }

    // ========================================================================
    // 6. Idempotency Check (Database-backed)
    // ========================================================================
    
    // Check in-memory first (faster)
    if (processedEvents.has(eventId)) {
      console.log(`[${requestId}] Duplicate event (in-memory), skipping: ${eventId}`);
      return new Response("OK", { status: 200 });
    }

    // Check database for persistent idempotency
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: existingEvent } = await supabaseAdmin
      .from('paystack_webhook_events')
      .select('id, processed')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[${requestId}] Duplicate event (database), skipping: ${eventId}`);
      processedEvents.add(eventId); // Update in-memory cache
      return new Response("OK", { status: 200 });
    }

    // Insert webhook event for tracking
    const { error: webhookInsertError } = await supabaseAdmin
      .from('paystack_webhook_events')
      .upsert(
        {
          event_id: eventId,
          event_type: eventType,
          reference: event.data.reference,
          raw_payload: event as unknown as Record<string, unknown>,
          processed: false,
        },
        { onConflict: "event_id" }
      );

    if (webhookInsertError) {
      console.warn(`[${requestId}] Failed to insert webhook event:`, webhookInsertError);
      // Continue processing anyway
    }

    // Mark as processed in memory
    processedEvents.add(eventId);

    // ========================================================================
    // 7. Process Event
    // ========================================================================

    switch (eventType) {
      case 'charge.success':
        await handleChargeSuccess(event.data, supabaseAdmin, requestId);
        break;
        
      case 'charge.failed':
        await handleChargeFailed(event.data, supabaseAdmin, requestId);
        break;
        
      case 'transfer.success':
        await handleTransferSuccess(event.data, supabaseAdmin, requestId);
        break;
        
      case 'transfer.failed':
        console.log(`[${requestId}] Transfer failed:`, event.data.reference);
        // TODO: Handle failed payout
        break;
        
      case 'refund.processed':
        console.log(`[${requestId}] Refund processed:`, event.data.reference);
        // TODO: Handle refund
        break;
        
      default:
        console.log(`[${requestId}] Unhandled event type: ${eventType}`);
    }

    // ========================================================================
    // 8. Mark webhook as processed & Return Success
    // ========================================================================
    
    // Update webhook event as processed
    await supabaseAdmin
      .from('paystack_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
    
    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error(`[${requestId}] ❌ Unhandled error in webhook handler:`, error);
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    return new Response("Internal server error", { status: 500 });
  }
});
