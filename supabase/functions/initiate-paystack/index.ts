/**
 * Initiate Paystack Transaction Edge Function
 * 
 * Security Features:
 * - Rate limiting per user
 * - Request ID tracking for audit trails
 * - Input sanitization and validation
 * - CORS with configurable origins
 * - JWT authentication verification
 * - Job ownership verification
 * - Amount bounds checking against server-side quote
 * - Idempotency via reference generation
 * 
 * Payment Flows:
 * - M-PESA: Uses /charge endpoint for direct STK push (Kenya only)
 * - Card: Uses /transaction/initialize endpoint for redirect flow
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPPORTED_CURRENCIES = ["NGN", "GHS", "ZAR", "USD", "KES"] as const;
type Currency = typeof SUPPORTED_CURRENCIES[number];

const CONFIG = {
  // Currency
  DEFAULT_CURRENCY: ((Deno.env.get("VITE_PAYSTACK_CURRENCY") as Currency) || "KES") as Currency,
  
  // Paystack
  PAYSTACK_SECRET: Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("PAYSTACK_SECRET") || "",
  PAYSTACK_INIT_URL: "https://api.paystack.co/transaction/initialize",
  PAYSTACK_CHARGE_URL: "https://api.paystack.co/charge",
  
  // Supabase
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") || "",
  
  // Security limits
  MAX_AMOUNT: 10_000_000, // Maximum transaction amount (in major units)
  MIN_AMOUNT: 1, // Minimum transaction amount
  AMOUNT_TOLERANCE: 0.5, // Allow 50% below quote (for partial payments)
  AMOUNT_UPPER_TOLERANCE: 1.5, // Allow 50% above quote (for tips/extras)
  
  // Rate limiting (per user)
  RATE_LIMIT_WINDOW_MS: 60_000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 10, // Max 10 requests per minute per user
  
  // Allowed job statuses for payment
  PAYABLE_JOB_STATUSES: ['completed', 'in_progress', 'awaiting_payment'],
  
  // M-Pesa specific
  MPESA_CURRENCY: 'KES',
  MPESA_PROVIDER: 'mpesa',
  MPESA_PHONE_COUNTRY_CODE: '254',
} as const;

// In-memory rate limiter (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique request ID for tracking and debugging
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID?.()?.substring(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Generate a unique payment reference
 */
function generateReference(prefix = 'MF'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID?.()?.toUpperCase() ?? Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Convert major currency units to minor units (e.g., KES 100 → 10000 cents)
 */
function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

/**
 * Sanitize string input to prevent injection attacks
 */
function sanitizeString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  // Remove control characters and trim
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 500);
}

/**
 * Validate UUID format
 */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Check rate limit for a user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    // Reset or create new window
    rateLimitMap.set(userId, { count: 1, resetAt: now + CONFIG.RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: CONFIG.RATE_LIMIT_MAX_REQUESTS - 1, resetIn: CONFIG.RATE_LIMIT_WINDOW_MS };
  }
  
  if (userLimit.count >= CONFIG.RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetAt - now };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: CONFIG.RATE_LIMIT_MAX_REQUESTS - userLimit.count, resetIn: userLimit.resetAt - now };
}

// ============================================================================
// CORS HANDLING
// ============================================================================

function isPrivateNetworkOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return true;
    }
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return host.endsWith('.local');
  } catch {
    return false;
  }
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const DEFAULT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
  ];
  
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  
  const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ORIGINS;
  const allowWildcard = allowedOrigins.includes('*');
  
  const isLocalDev = isPrivateNetworkOrigin(origin);
  const isAllowed = origin != null && (allowWildcard || allowedOrigins.includes(origin) || isLocalDev);
  const allowedOrigin = isAllowed ? origin! : allowedOrigins[0] || '';
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function errorResponse(
  message: string, 
  status: number, 
  corsHeaders: Record<string, string>, 
  requestId?: string,
  details?: Record<string, unknown>
): Response {
  const body = {
    ok: false,
    error: message,
    request_id: requestId,
    ...(details && { details }),
  };
  
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function successResponse(
  data: Record<string, unknown>, 
  corsHeaders: Record<string, string>, 
  requestId?: string
): Response {
  return new Response(JSON.stringify({ ok: true, ...data, request_id: requestId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

interface ValidationResult {
  ok: boolean;
  reason?: string;
}

function validateJobId(jobId: unknown): ValidationResult {
  const sanitized = sanitizeString(jobId);
  if (!sanitized) return { ok: false, reason: 'Job ID is required' };
  if (!isValidUuid(sanitized)) return { ok: false, reason: 'Job ID must be a valid UUID' };
  return { ok: true };
}

function validateAmount(amount: unknown): ValidationResult {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { ok: false, reason: 'Amount must be a valid number' };
  }
  if (amount < CONFIG.MIN_AMOUNT) {
    return { ok: false, reason: `Amount must be at least ${CONFIG.MIN_AMOUNT}` };
  }
  if (amount > CONFIG.MAX_AMOUNT) {
    return { ok: false, reason: `Amount cannot exceed ${CONFIG.MAX_AMOUNT}` };
  }
  return { ok: true };
}

function validateCurrency(currency: unknown): string {
  const sanitized = sanitizeString(currency)?.toUpperCase();
  if (sanitized && (SUPPORTED_CURRENCIES as readonly string[]).includes(sanitized)) {
    return sanitized;
  }
  return CONFIG.DEFAULT_CURRENCY;
}

/**
 * Normalize and validate phone number for M-Pesa
 * Accepts: 07XXXXXXXX, 7XXXXXXXX, 254XXXXXXXXX, +254XXXXXXXXX
 * Returns: 254XXXXXXXXX (without +) or undefined if invalid
 */
function normalizePhoneForMpesa(phone: unknown): string | undefined {
  const sanitized = sanitizeString(phone);
  if (!sanitized) return undefined;
  
  // Strip all non-numeric characters
  const digits = sanitized.replace(/[^0-9]/g, '');
  
  // Kenya phone number patterns
  // 254XXXXXXXXX (12 digits) - International format
  if (digits.startsWith(CONFIG.MPESA_PHONE_COUNTRY_CODE) && digits.length === 12) {
    return digits;
  }
  
  // 07XXXXXXXX (10 digits) - Local format with leading 0
  if (digits.startsWith('0') && digits.length === 10) {
    return CONFIG.MPESA_PHONE_COUNTRY_CODE + digits.slice(1);
  }
  
  // 7XXXXXXXX (9 digits) - Local format without leading 0
  if (digits.startsWith('7') && digits.length === 9) {
    return CONFIG.MPESA_PHONE_COUNTRY_CODE + digits;
  }
  
  // Fallback: Accept any 10+ digit number (for flexibility)
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }
  
  return undefined;
}

/**
 * Validate that amount is within acceptable range of the quote
 */
function validateAmountAgainstQuote(amount: number, quoteTotal: number): ValidationResult {
  if (quoteTotal <= 0) {
    return { ok: false, reason: 'Job has no valid quote amount' };
  }
  
  const minAllowed = Math.max(quoteTotal * CONFIG.AMOUNT_TOLERANCE, CONFIG.MIN_AMOUNT);
  const maxAllowed = quoteTotal * CONFIG.AMOUNT_UPPER_TOLERANCE;
  
  if (amount < minAllowed) {
    return { ok: false, reason: `Amount must be at least ${minAllowed.toFixed(2)}` };
  }
  if (amount > maxAllowed) {
    return { ok: false, reason: `Amount cannot exceed ${maxAllowed.toFixed(2)}` };
  }
  
  return { ok: true };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders, requestId);
  }

  // Parse request body
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders, requestId);
  }

  // ========================================================================
  // VALIDATE INPUT
  // ========================================================================
  
  const { job_id, amount, phone, currency, channel } = payload;

  // Validate job_id
  const jobValidation = validateJobId(job_id);
  if (!jobValidation.ok) {
    return errorResponse(jobValidation.reason!, 400, corsHeaders, requestId);
  }
  const sanitizedJobId = sanitizeString(job_id)!;

  // Validate amount
  const amountValidation = validateAmount(amount);
  if (!amountValidation.ok) {
    return errorResponse(amountValidation.reason!, 400, corsHeaders, requestId);
  }
  const validatedAmount = amount as number;

  // Validate currency
  const validatedCurrency = validateCurrency(currency);

  // Normalize phone (optional for card payments)
  const normalizedPhone = phone ? normalizePhoneForMpesa(phone) : undefined;
  if (phone && !normalizedPhone) {
    return errorResponse('Invalid phone number format. Use 07XXXXXXXX or 254XXXXXXXXX', 400, corsHeaders, requestId);
  }

  // ========================================================================
  // VERIFY CONFIGURATION
  // ========================================================================
  
  if (!CONFIG.PAYSTACK_SECRET) {
    return errorResponse('Payment service not configured', 500, corsHeaders, requestId);
  }
  
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    return errorResponse('Authentication service not configured', 500, corsHeaders, requestId);
  }

  // ========================================================================
  // AUTHENTICATE USER
  // ========================================================================
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Missing or invalid authorization', 401, corsHeaders, requestId);
  }

  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return errorResponse('Authentication failed', 401, corsHeaders, requestId);
  }

  const userId = userData.user.id;
  const userEmail = userData.user.email;

  // ========================================================================
  // RATE LIMITING
  // ========================================================================
  
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return errorResponse(
      'Too many requests. Please wait before trying again.',
      429,
      corsHeaders,
      requestId,
      { retry_after_ms: rateLimit.resetIn }
    );
  }

  // ========================================================================
  // VERIFY JOB OWNERSHIP AND STATUS
  // ========================================================================
  
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, customer_id, provider_id, status, quote_total, quote_accepted, payment_status')
    .eq('id', sanitizedJobId)
    .single();

  if (jobError || !job) {
    return errorResponse('Job not found', 404, corsHeaders, requestId);
  }

  // Verify ownership
  if (job.customer_id !== userId) {
    return errorResponse('You do not have permission to pay for this job', 403, corsHeaders, requestId);
  }

  // Verify job status
  if (!CONFIG.PAYABLE_JOB_STATUSES.includes(job.status)) {
    return errorResponse(`Cannot process payment for job with status: ${job.status}`, 400, corsHeaders, requestId);
  }

  // Prevent duplicate payments
  if (job.payment_status === 'completed') {
    return errorResponse('This job has already been paid', 400, corsHeaders, requestId);
  }

  // Verify quote is accepted
  if (!job.quote_accepted) {
    return errorResponse('Quote must be accepted before payment', 400, corsHeaders, requestId);
  }

  // Validate amount against quote
  const quoteValidation = validateAmountAgainstQuote(validatedAmount, job.quote_total || 0);
  if (!quoteValidation.ok) {
    return errorResponse(quoteValidation.reason!, 400, corsHeaders, requestId);
  }

  // ========================================================================
  // DETERMINE PAYMENT METHOD
  // ========================================================================
  
  const explicitMpesaChannel = channel === 'mpesa' || channel === 'mobile_money';
  const isMpesaPayment = explicitMpesaChannel || (normalizedPhone && validatedCurrency === CONFIG.MPESA_CURRENCY);

  // ========================================================================
  // GET PROVIDER DEFAULT PAYOUT METHOD & SUBACCOUNT (FOR ROUTING)
  // ========================================================================
  
  let providerSubaccountId: string | null = null;
  
  try {
    const { data: defaultPayoutMethod } = await supabase
      .from('provider_payout_methods')
      .select('paystack_subaccount_id, type')
      .eq('provider_id', job.provider_id)
      .eq('is_default', true)
      .maybeSingle();
    
    if (defaultPayoutMethod && defaultPayoutMethod.paystack_subaccount_id) {
      providerSubaccountId = defaultPayoutMethod.paystack_subaccount_id;
      console.log(`[${requestId}] Found provider subaccount for routing: ${providerSubaccountId}`);
    } else {
      console.log(`[${requestId}] No default payout method with subaccount found for provider ${job.provider_id}`);
    }
  } catch (error) {
    console.warn(`[${requestId}] Failed to fetch provider subaccount (continuing without routing):`, error);
  }

  // ========================================================================
  // BUILD PAYSTACK REQUEST
  // ========================================================================
  
  const amountMinor = toMinorUnits(validatedAmount);
  const reference = generateReference('MF');
  
  const baseMetadata = {
    job_id: sanitizedJobId,
    customer_id: userId,
    provider_id: job.provider_id,
    payment_type: 'job_payment',
    quote_total: job.quote_total,
    request_id: requestId,
  };

  let paystackEndpoint: string;
  let paystackPayload: Record<string, unknown>;

  if (isMpesaPayment && normalizedPhone) {
    // M-PESA: Direct charge via /charge endpoint
    paystackEndpoint = CONFIG.PAYSTACK_CHARGE_URL;
    
    // Paystack requires + prefix for mobile money phone numbers
    const paystackPhone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;
    
    paystackPayload = {
      email: userEmail || `customer_${userId}@mobilefundi.com`,
    amount: amountMinor,
      currency: CONFIG.MPESA_CURRENCY,
    reference,
      mobile_money: {
        phone: paystackPhone,
        provider: CONFIG.MPESA_PROVIDER,
      },
      metadata: {
        ...baseMetadata,
        payment_method: 'mpesa',
        phone_number: normalizedPhone,
      },
    };
    
    // Add subaccount routing if available
    if (providerSubaccountId) {
      paystackPayload.subaccount = providerSubaccountId;
      console.log(`[${requestId}] Routing M-Pesa payment to subaccount: ${providerSubaccountId}`);
    }
  } else {
    // CARD: Redirect flow via /transaction/initialize endpoint
    paystackEndpoint = CONFIG.PAYSTACK_INIT_URL;
    
    paystackPayload = {
      email: userEmail || `customer_${userId}@mobilefundi.com`,
      amount: amountMinor,
      currency: validatedCurrency,
      reference,
      channels: ['card', 'bank_transfer'],
      metadata: {
        ...baseMetadata,
        payment_method: 'card',
      },
    };
    
    // Add subaccount routing if available
    if (providerSubaccountId) {
      paystackPayload.subaccount = providerSubaccountId;
      console.log(`[${requestId}] Routing card payment to subaccount: ${providerSubaccountId}`);
    }
  }

  // ========================================================================
  // GENERATE IDEMPOTENCY KEY
  // ========================================================================
  
  const idempotencyKey = `payment:${sanitizedJobId}:${reference}`;

  // ========================================================================
  // CALL PAYSTACK API
  // ========================================================================
  
  let paystackResponse: { ok: boolean; status: number; body: Record<string, unknown> };
  
  try {
    const response = await fetch(paystackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paystackPayload),
    });
    
    const responseText = await response.text();
    let responseBody: Record<string, unknown>;
    
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = { raw_response: responseText };
    }
    
    paystackResponse = {
      ok: response.ok,
      status: response.status,
      body: responseBody,
    };
  } catch {
    return errorResponse('Payment service temporarily unavailable', 502, corsHeaders, requestId);
  }

  // ========================================================================
  // HANDLE PAYSTACK RESPONSE
  // ========================================================================

  if (!paystackResponse.ok) {
    const errorData = paystackResponse.body?.data as Record<string, unknown> | undefined;
    const errorMessage = 
      (errorData?.message as string) || 
      (errorData?.gateway_response as string) || 
      (paystackResponse.body?.message as string) ||
      'Payment initialization failed';
    
    const statusCode = paystackResponse.status >= 400 && paystackResponse.status < 500 ? 400 : 502;
    return errorResponse(errorMessage, statusCode, corsHeaders, requestId);
  }

  const responseData = paystackResponse.body?.data as Record<string, unknown> | undefined;
  
  // Detect payment channel from Paystack response
  const paystackChannel = 
    (responseData?.channel as string) || 
    ((responseData?.authorization as Record<string, unknown>)?.channel as string);
  
  const detectedPaymentMethod = 
    paystackChannel === 'mobile_money' || paystackChannel === 'mpesa' || isMpesaPayment 
      ? 'mpesa' 
      : 'card';

  // ========================================================================
  // CREATE PAYMENT RECORD IN DATABASE
  // ========================================================================
  
  const paystackTransactionId = responseData?.id?.toString() || null;
  const paystackReference = (responseData?.reference as string) || reference;

  try {
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        job_id: sanitizedJobId,
        customer_id: userId,
        provider_id: job.provider_id,
        amount: validatedAmount,
        status: 'pending',
        payment_method: detectedPaymentMethod,
        payment_provider: 'paystack',
        paystack_transaction_id: paystackTransactionId,
        paystack_reference: paystackReference,
        paystack_subaccount_id: providerSubaccountId,
        idempotency_key: idempotencyKey,
        metadata: {
          ...baseMetadata,
          paystack_channel: paystackChannel,
          amount_minor: amountMinor,
        },
      });

    if (paymentError) {
      console.warn(`[${requestId}] Failed to create payment record:`, paymentError);
      // Continue anyway - webhook will handle reconciliation
    } else {
      console.log(`[${requestId}] Payment record created for reference: ${paystackReference}`);
    }
  } catch (error) {
    console.warn(`[${requestId}] Error creating payment record:`, error);
    // Continue anyway
  }

  // Build response
  const responseOut: Record<string, unknown> = {
    reference: paystackReference,
    payment_method: detectedPaymentMethod,
    subaccount_routing: providerSubaccountId ? true : false,
  };

  if (isMpesaPayment) {
    // M-PESA response
    responseOut.status = responseData?.status;
    responseOut.display_text = responseData?.display_text;
    responseOut.gateway_response = responseData?.gateway_response;
  } else {
    // Card response
    responseOut.authorization_url = responseData?.authorization_url;
    responseOut.access_code = responseData?.access_code;
    responseOut.status = responseData?.status;
  }

  return successResponse(responseOut, corsHeaders, requestId);
});
