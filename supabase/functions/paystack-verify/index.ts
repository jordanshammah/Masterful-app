/**
 * Verify Paystack Transaction Edge Function
 * 
 * Security Features:
 * - JWT Authentication
 * - Rate limiting (10 requests per minute per user)
 * - Input validation
 * - Server-side verification with Paystack API
 * - Job ownership verification before status update
 * 
 * Flow:
 * 1. Validate JWT and get user
 * 2. Check rate limit
 * 3. Validate reference format
 * 4. Call Paystack verify API with secret key
 * 5. Verify job ownership
 * 6. Update job payment status if successful
 * 7. Return verification result
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

function sanitizeString(str: string, maxLength = 500): string {
  return str
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().substring(0, 8)}`;
}

function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  requestId?: string
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: message,
      request_id: requestId,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function successResponse(
  data: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  requestId?: string
): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      ...data,
      request_id: requestId,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_CONFIG = {
  maxRequests: 10,     // 10 requests
  windowMs: 60 * 1000, // per minute
  keyPrefix: 'paystack_verify',
};

// ============================================================================
// Types
// ============================================================================

interface VerifyRequest {
  reference: string;
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string | null;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: {
      job_id?: string;
      customer_id?: string;
      provider_id?: string;
      payment_type?: string;
      request_id?: string;
      [key: string]: unknown;
    };
    fees: number;
    customer: {
      id: number;
      email: string;
      [key: string]: unknown;
    };
  };
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const requestId = generateRequestId();
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders, requestId);
  }

  try {
    // ========================================================================
    // 1. Validate Environment Variables
    // ========================================================================
    
    let paystackSecretKey: string;
    let supabaseUrl: string;
    let supabaseServiceKey: string;
    let supabaseAnonKey: string;
    
    try {
      paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
      supabaseUrl = requireEnv("SUPABASE_URL");
      supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
      supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    } catch (envError) {
      console.error(`[${requestId}] Environment error:`, envError);
      return errorResponse("Payment service not configured", 500, corsHeaders, requestId);
    }
    
    // ========================================================================
    // 2. Authenticate User (JWT)
    // ========================================================================
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid authorization header", 401, corsHeaders, requestId);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error(`[${requestId}] Auth error:`, authError);
      return errorResponse("Authentication failed", 401, corsHeaders, requestId);
    }

    console.log(`[${requestId}] User authenticated:`, user.id);

    // ========================================================================
    // 3. Rate Limiting
    // ========================================================================
    
    const clientIP = getClientIP(req);
    const rateLimitKey = `${user.id}:${clientIP}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
    
    if (!rateLimitResult.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Too many verification requests. Please try again later.",
          retry_after_ms: rateLimitResult.retryAfterMs,
          request_id: requestId,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000).toString(),
          },
        }
      );
    }

    // ========================================================================
    // 4. Parse and Validate Input
    // ========================================================================
    
    let body: VerifyRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, corsHeaders, requestId);
    }

    const reference = sanitizeString(body.reference || '', 100);
    
    // Validate reference format (alphanumeric with underscores)
    if (!reference || !/^[A-Za-z0-9_-]+$/.test(reference)) {
      return errorResponse("Invalid or missing payment reference", 400, corsHeaders, requestId);
    }

    console.log(`[${requestId}] Verifying reference:`, reference);

    // ========================================================================
    // 5. Call Paystack Verify API
    // ========================================================================
    
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error(`[${requestId}] Paystack verify error:`, paystackResponse.status, errorText);
      
      if (paystackResponse.status === 404) {
        return errorResponse("Payment reference not found", 404, corsHeaders, requestId);
      }
      
      return errorResponse("Failed to verify payment", 502, corsHeaders, requestId);
    }

    const paystackData: PaystackVerifyResponse = await paystackResponse.json();

    if (!paystackData.status) {
      console.error(`[${requestId}] Paystack verify returned false status:`, paystackData);
      return errorResponse(paystackData.message || "Payment verification failed", 400, corsHeaders, requestId);
    }

    console.log(`[${requestId}] Paystack verification result:`, {
      status: paystackData.data.status,
      reference: paystackData.data.reference,
      amount: paystackData.data.amount,
    });

    // ========================================================================
    // 6. Verify Job Ownership and Update Status (Enhanced with Payout Reconciliation)
    // ========================================================================
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const jobId = paystackData.data.metadata?.job_id;
    
    let jobUpdated = false;
    let payoutCreated = false;

    // Always reconcile payment record if Paystack shows success (per spec)
    // Note: Using only base schema columns until migrations are run
    if (paystackData.data.status === 'success' && jobId) {
      const { data: payment, error: paymentUpdateError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "completed",
          payment_method: paystackData.data.channel === 'mobile_money' ? 'mpesa' : paystackData.data.channel,
          processed_at: paystackData.data.paid_at || new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("status", "pending")
        .select("id, job_id, provider_id")
        .maybeSingle();

      if (paymentUpdateError) {
        console.warn(`[${requestId}] Failed to update payment:`, paymentUpdateError);
      } else if (payment) {
        console.log(`[${requestId}] ✅ Payment record updated: ${payment.id}`);
      }
    }
    
    if (jobId) {
      // Fetch job to verify ownership
      const { data: job, error: jobError } = await supabaseAdmin
        .from("jobs")
        .select("id, customer_id, provider_id, payment_status, quote_total, platform_fee_percent")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error(`[${requestId}] Job lookup error:`, jobError);
        // Don't fail the verify - return the Paystack result anyway
      } else if (job) {
        // Verify user owns this job
        if (job.customer_id !== user.id) {
          console.warn(`[${requestId}] User ${user.id} verified payment for job they don't own: ${jobId}`);
          // Still return the verification result, but don't update the job
        } else if (paystackData.data.status === 'success' && job.payment_status !== 'completed') {
          // Update job payment status
          const amountPaid = paystackData.data.amount / 100; // Convert from minor units
          const paymentMethod = paystackData.data.channel === 'mobile_money' ? 'mpesa' : 'card';
          
          const { error: updateError } = await supabaseAdmin
            .from("jobs")
            .update({
              payment_status: "completed",
              payment_completed_at: paystackData.data.paid_at || new Date().toISOString(),
              payment_amount: amountPaid,
              payment_method: paymentMethod,
              payment_reference: reference,
              status: "completed", // Also mark job as completed
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

          if (updateError) {
            console.error(`[${requestId}] Failed to update job:`, updateError);
          } else {
            console.log(`[${requestId}] Job ${jobId} payment status updated to completed`);
            jobUpdated = true;
          }

          // ====================================================================
          // CREATE PAYOUT FOR PROVIDER (if not exists)
          // ====================================================================
          
          const { data: existingPayout } = await supabaseAdmin
            .from("payouts")
            .select("id")
            .eq("job_id", jobId)
            .maybeSingle();

          if (!existingPayout) {
            const platformFeePercent = job.platform_fee_percent || 15;
            const platformFee = amountPaid * (platformFeePercent / 100);
            const netAmount = amountPaid - platformFee;

            // Get provider's default payout method
            const { data: payoutMethod } = await supabaseAdmin
              .from("provider_payout_methods")
              .select("id, paystack_subaccount_id")
              .eq("provider_id", job.provider_id)
              .eq("is_default", true)
              .maybeSingle();

            const subaccountId = payoutMethod?.paystack_subaccount_id || null;

            const { data: newPayout, error: payoutError } = await supabaseAdmin
              .from("payouts")
              .insert({
                provider_id: job.provider_id,
                job_id: jobId,
                payment_id: payment?.id,
                payout_method_id: payoutMethod?.id,
                amount: amountPaid,
                currency: paystackData.data.currency,
                platform_fee: platformFee,
                net_amount: netAmount,
                status: subaccountId ? 'completed' : 'pending',
                paystack_subaccount_id: subaccountId,
                initiated_at: new Date().toISOString(),
                completed_at: subaccountId ? new Date().toISOString() : null,
                metadata: {
                  job_id: jobId,
                  payment_reference: reference,
                  verified_by: 'verify-endpoint',
                  verification_timestamp: new Date().toISOString(),
                },
              })
              .select()
              .maybeSingle();

            if (payoutError) {
              console.error(`[${requestId}] Failed to create payout:`, payoutError);
            } else if (newPayout) {
              console.log(`[${requestId}] ✅ Payout created via verify: ${newPayout.id}`);
              payoutCreated = true;
            }
          } else {
            console.log(`[${requestId}] Payout already exists for job ${jobId}`);
          }
        } else if (job.payment_status === 'completed') {
          console.log(`[${requestId}] Job ${jobId} already marked as completed`);
        }
      }
    }

    // ========================================================================
    // 7. Return Verification Result (Enhanced)
    // ========================================================================
    
    return successResponse(
      {
        status: paystackData.data.status,
        reference: paystackData.data.reference,
        amount: paystackData.data.amount / 100, // Return in major units
        currency: paystackData.data.currency,
        channel: paystackData.data.channel,
        paid_at: paystackData.data.paid_at,
        gateway_response: paystackData.data.gateway_response,
        metadata: paystackData.data.metadata,
        reconciliation: {
          job_updated: jobUpdated,
          payout_created: payoutCreated,
        },
        paystack: {
          status: paystackData.status,
          data: {
            status: paystackData.data.status,
          }
        },
      },
      corsHeaders,
      requestId
    );

  } catch (error) {
    console.error(`[${requestId}] Unhandled error:`, error);
    return errorResponse(
      "An unexpected error occurred. Please try again.",
      500,
      corsHeaders,
      requestId
    );
  }
});
