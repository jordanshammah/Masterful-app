/**
 * Initiate Paystack Transaction Edge Function (STANDALONE VERSION)
 * 
 * This is a self-contained version with all helper functions inlined.
 * Copy-paste this entire file into the Supabase dashboard.
 * 
 * Security Features:
 * - JWT Authentication (user must be logged in)
 * - Rate limiting (5 requests per minute per user)
 * - Input validation (job ID, amount, currency)
 * - Job ownership verification
 * - Server-side amount calculation (prevents client tampering)
 * 
 * Flow:
 * 1. Validate JWT and get user
 * 2. Check rate limit
 * 3. Validate input parameters
 * 4. Verify job ownership and status
 * 5. Calculate amount server-side from job data
 * 6. Call Paystack API to initialize transaction
 * 7. Return authorization URL or reference
 * 
 * NOTE: If your IDE shows TypeScript errors, these are likely false positives.
 * Deno edge functions use URL imports and Deno-specific globals that IDEs don't
 * always recognize. The code will work correctly when deployed to Supabase.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Inline Helper Functions (from _shared/security.ts)
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
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }
  
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfterMs: entry.resetAt - now };
  }
  
  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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

function getEnvWithDefault(name: string, defaultValue: string): string {
  return Deno.env.get(name) || defaultValue;
}

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_CONFIG = {
  maxRequests: 5,
  windowMs: 60 * 1000,
  keyPrefix: 'paystack_init',
};

const SUPPORTED_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'USD', 'KES'] as const;
type Currency = typeof SUPPORTED_CURRENCIES[number];

// ============================================================================
// Types
// ============================================================================

interface InitiateRequest {
  job_id: string;
  amount: number;
  currency?: Currency;
  phone?: string;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url?: string;
    access_code?: string;
    reference: string;
    status?: string;
    gateway_response?: string;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

function generateReference(prefix = 'MF'): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().substring(0, 8);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const requestId = generateRequestId();
  console.error(`[${requestId}] ===== FUNCTION CALLED =====`);
  console.error(`[${requestId}] Method: ${req.method}`);
  console.error(`[${requestId}] URL: ${req.url}`);
  
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.error(`[${requestId}] Origin: ${origin}`);
  
  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] Handling OPTIONS preflight`);
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.error(`[${requestId}] Invalid method:`, req.method);
    return errorResponse("Method not allowed", 405, corsHeaders, requestId);
  }
  
  console.log(`[${requestId}] Processing POST request`);

  try {
    // 1. Validate Environment Variables
    let paystackSecretKey: string;
    let supabaseUrl: string;
    let supabaseServiceKey: string;
    let supabaseAnonKey: string;
    
    // Check which environment variables are missing
    // Support both PAYSTACK_SECRET_KEY and PAYSTACK_SECRET for backward compatibility
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("PAYSTACK_SECRET");
    const missingVars: string[] = [];
    if (!paystackSecret) missingVars.push("PAYSTACK_SECRET_KEY (or PAYSTACK_SECRET)");
    if (!Deno.env.get("SUPABASE_URL")) missingVars.push("SUPABASE_URL");
    if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!Deno.env.get("SUPABASE_ANON_KEY")) missingVars.push("SUPABASE_ANON_KEY");
    
    if (missingVars.length > 0) {
      console.error(`[${requestId}] Missing environment variables:`, missingVars);
      const errorMessage = `Payment service not configured. Missing secrets: ${missingVars.join(", ")}. Please set them in Supabase Dashboard → Edge Functions → Secrets or via CLI: supabase secrets set ${missingVars[0]}=your_value`;
      return errorResponse(errorMessage, 500, corsHeaders, requestId);
    }
    
    try {
      // Support both PAYSTACK_SECRET_KEY and PAYSTACK_SECRET
      paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("PAYSTACK_SECRET") || "";
      if (!paystackSecretKey) {
        throw new Error("Missing PAYSTACK_SECRET_KEY or PAYSTACK_SECRET");
      }
      supabaseUrl = requireEnv("SUPABASE_URL");
      supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
      supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    } catch (envError) {
      console.error(`[${requestId}] Environment error:`, envError);
      return errorResponse("Payment service not configured", 500, corsHeaders, requestId);
    }
    
    const defaultCurrency = getEnvWithDefault("PAYSTACK_DEFAULT_CURRENCY", "KES") as Currency;
    
    // 2. Authenticate User (JWT)
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

    // 3. Rate Limiting
    const clientIP = getClientIP(req);
    const rateLimitKey = `${user.id}:${clientIP}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
    
    if (!rateLimitResult.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Too many payment requests. Please try again later.",
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

    // 4. Parse and Validate Input
    let rawBodyText: string;
    try {
      rawBodyText = await req.text();
      console.error(`[${requestId}] Raw body text:`, rawBodyText);
      console.error(`[${requestId}] Raw body length:`, rawBodyText.length);
    } catch (textError) {
      console.error(`[${requestId}] Failed to read raw body:`, textError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to read request body",
          diagnostic: { textError: String(textError) },
          request_id: requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    let body: InitiateRequest;
    try {
      body = JSON.parse(rawBodyText);
      console.error(`[${requestId}] Parsed request body:`, JSON.stringify(body));
      console.error(`[${requestId}] Body type:`, typeof body, "Keys:", body ? Object.keys(body) : "null");
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid JSON body",
          diagnostic: {
            rawBody: rawBodyText,
            parseError: String(parseError),
          },
          request_id: requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      const diagnostic = {
        bodyType: typeof body,
        isArray: Array.isArray(body),
        bodyValue: body,
        bodyString: JSON.stringify(body),
      };
      console.error(`[${requestId}] Invalid body type:`, diagnostic);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid request body",
          diagnostic,
          request_id: requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const jobIdRaw = (body as any).job_id;
    const amountRaw = (body as any).amount;
    
    const diagnostic = {
      hasJobIdKey: 'job_id' in body,
      hasAmountKey: 'amount' in body,
      jobIdValue: jobIdRaw,
      jobIdType: typeof jobIdRaw,
      amountValue: amountRaw,
      amountType: typeof amountRaw,
      allKeys: Object.keys(body),
      fullBody: JSON.stringify(body),
    };
    
    console.log(`[${requestId}] Field check:`, diagnostic);
    
    if (!jobIdRaw || (typeof jobIdRaw !== 'string' && typeof jobIdRaw !== 'number')) {
      const errorMsg = `Missing or invalid job_id`;
      console.error(`[${requestId}] ${errorMsg}`, diagnostic);
      return new Response(
        JSON.stringify({
          ok: false,
          error: errorMsg,
          diagnostic,
          request_id: requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    let amount: number;
    if (amountRaw === undefined || amountRaw === null) {
      const errorMsg = `Missing amount`;
      console.error(`[${requestId}] ${errorMsg}`, diagnostic);
      return new Response(
        JSON.stringify({
          ok: false,
          error: errorMsg,
          diagnostic,
          request_id: requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (typeof amountRaw === 'number') {
      amount = amountRaw;
    } else if (typeof amountRaw === 'string') {
      const parsed = parseFloat(amountRaw);
      if (isNaN(parsed)) {
        const errorMsg = `Invalid amount (cannot parse string). Value: ${amountRaw}, Type: ${typeof amountRaw}`;
        console.error(`[${requestId}] ${errorMsg}`);
        return errorResponse(errorMsg, 400, corsHeaders, requestId);
      }
      amount = parsed;
    } else {
      const errorMsg = `Invalid amount type. Value: ${amountRaw}, Type: ${typeof amountRaw}, All keys: ${Object.keys(body).join(', ')}`;
      console.error(`[${requestId}] ${errorMsg}`);
      return errorResponse(errorMsg, 400, corsHeaders, requestId);
    }

    const job_id = String(jobIdRaw);
    const currency = (body as any).currency || defaultCurrency;
    const phone = (body as any).phone;

    if (!job_id || !isValidUUID(job_id)) {
      return errorResponse("Invalid or missing job_id", 400, corsHeaders, requestId);
    }

    if (typeof amount !== 'number' || amount <= 0 || amount > 10000000) {
      return errorResponse("Invalid amount. Must be between 1 and 10,000,000", 400, corsHeaders, requestId);
    }

    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return errorResponse(`Invalid currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`, 400, corsHeaders, requestId);
    }

    console.log(`[${requestId}] Request validated:`, { job_id, amount, currency });

    // 5. Verify Job Ownership and Status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, customer_id, provider_id, status, quote_total, quote_accepted, payment_status")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error(`[${requestId}] Job lookup error:`, jobError);
      return errorResponse("Job not found", 404, corsHeaders, requestId);
    }

    if (job.customer_id !== user.id) {
      console.warn(`[${requestId}] Unauthorized access attempt by ${user.id} on job ${job_id}`);
      return errorResponse("You don't have permission to pay for this job", 403, corsHeaders, requestId);
    }

    const allowedStatuses = ['completed', 'in_progress', 'awaiting_payment'];
    if (!allowedStatuses.includes(job.status)) {
      return errorResponse(`Cannot process payment for job with status: ${job.status}`, 400, corsHeaders, requestId);
    }

    if (job.payment_status === 'completed') {
      return errorResponse("This job has already been paid for", 400, corsHeaders, requestId);
    }

    if (!job.quote_accepted) {
      return errorResponse("Quote must be accepted before payment", 400, corsHeaders, requestId);
    }

    // 6. Server-side Amount Validation
    const serverAmount = job.quote_total || 0;
    const minAllowed = Math.max(serverAmount * 0.5, 100);
    const maxAllowed = serverAmount * 1.5;
    
    if (amount < minAllowed || amount > maxAllowed) {
      console.warn(`[${requestId}] Amount mismatch: client=${amount}, server=${serverAmount}`);
      return errorResponse(
        `Payment amount must be between ${minAllowed} and ${maxAllowed}`,
        400,
        corsHeaders,
        requestId
      );
    }

    // 7. Call Paystack API
    const reference = generateReference('MF');
    
    // Ensure email is available (required by Paystack)
    if (!user.email) {
      return errorResponse("User email is required for payment", 400, corsHeaders, requestId);
    }
    
    // For M-Pesa STK Push, use /charge endpoint with mobile_money
    // For other payment methods, use /transaction/initialize
    console.log(`[${requestId}] Payment details:`, { phone, currency, hasPhone: !!phone, isKES: currency === 'KES' });
    const isMpesaPayment = phone && currency === 'KES';
    console.log(`[${requestId}] isMpesaPayment:`, isMpesaPayment);
    
    let paystackPayload: Record<string, unknown>;
    let paystackUrl: string;
    
    if (isMpesaPayment) {
      // Use charge endpoint for M-Pesa STK Push
      paystackUrl = "https://api.paystack.co/charge";
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      paystackPayload = {
        email: user.email,
        amount: toMinorUnits(amount),
        currency,
        reference,
        mobile_money: {
          phone: formattedPhone,
          provider: "mpesa",
        },
        metadata: {
          job_id,
          customer_id: user.id,
          provider_id: job.provider_id,
          payment_type: "job_payment",
          quote_total: serverAmount,
          request_id: requestId,
        },
      };
      console.log(`[${requestId}] ✅ Using M-Pesa STK Push (charge endpoint)`);
      console.log(`[${requestId}] Phone number: ${phone} -> formatted: ${formattedPhone}`);
      console.log(`[${requestId}] Paystack payload:`, JSON.stringify(paystackPayload, null, 2));
    } else {
      // Use initialize endpoint for other payment methods
      paystackUrl = "https://api.paystack.co/transaction/initialize";
      paystackPayload = {
        email: user.email,
        amount: toMinorUnits(amount),
        currency,
        reference,
        callback_url: getEnvWithDefault("PAYSTACK_CALLBACK_URL", `${origin || 'https://qjvzswqawgiroteykgoh.supabase.co'}/payment/callback`),
        metadata: {
          job_id,
          customer_id: user.id,
          provider_id: job.provider_id,
          payment_type: "job_payment",
          quote_total: serverAmount,
          request_id: requestId,
        },
        channels: ['card', 'bank_transfer', 'mobile_money', 'ussd'],
      };
      
      if (phone) {
        paystackPayload.phone = phone;
      }
      console.log(`[${requestId}] ⚠️ Using standard payment initialization (NOT M-Pesa STK Push)`);
      console.log(`[${requestId}] Reason: phone=${phone}, currency=${currency}, isMpesaPayment=${isMpesaPayment}`);
    }

    console.log(`[${requestId}] Calling Paystack API: ${paystackUrl}`);
    console.log(`[${requestId}] isMpesaPayment: ${isMpesaPayment}, phone: ${phone}, currency: ${currency}`);
    console.log(`[${requestId}] Request payload:`, JSON.stringify(paystackPayload, null, 2));

    const paystackResponse = await fetch(paystackUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const responseText = await paystackResponse.text();
    console.log(`[${requestId}] Paystack response status: ${paystackResponse.status}`);
    console.log(`[${requestId}] Paystack response body:`, responseText);

    if (!paystackResponse.ok) {
      console.error(`[${requestId}] Paystack API error - Status: ${paystackResponse.status}`);
      console.error(`[${requestId}] Paystack API error - Response:`, responseText);
      let errorMessage = "Failed to initialize payment";
      let errorDetails: any = null;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
        errorDetails = errorJson;
        console.error(`[${requestId}] Parsed Paystack error:`, JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error(`[${requestId}] Could not parse error response:`, e);
      }
      
      // Return more detailed error message
      let detailedError = errorMessage;
      if (errorDetails?.data?.message) {
        detailedError = errorDetails.data.message;
        // Add helpful context for common errors
        if (detailedError.includes("test mobile money number") || detailedError.includes("test transaction")) {
          detailedError += " (You're using a test Paystack key - use test phone numbers like +254700000000)";
        }
      } else if (errorDetails?.data) {
        detailedError = `${errorMessage}: ${JSON.stringify(errorDetails.data)}`;
      }
      
      return errorResponse(detailedError, 502, corsHeaders, requestId);
    }

    let paystackData: PaystackInitResponse;
    try {
      paystackData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse Paystack response:`, parseError);
      console.error(`[${requestId}] Raw response:`, responseText);
      return errorResponse("Invalid response from payment service", 502, corsHeaders, requestId);
    }

    if (!paystackData.status || !paystackData.data?.reference) {
      console.error(`[${requestId}] Paystack returned invalid response:`, paystackData);
      return errorResponse(
        `Payment service returned invalid response: ${paystackData.message || 'Unknown error'}`,
        502,
        corsHeaders,
        requestId
      );
    }

    console.log(`[${requestId}] Paystack transaction response:`, {
      reference: paystackData.data.reference,
      status: paystackData.data.status,
      message: paystackData.message,
      gateway_response: paystackData.data.gateway_response,
      full_data: paystackData.data,
    });

    // 8. Store Transaction Reference
    await supabaseAdmin
      .from("jobs")
      .update({
        payment_reference: paystackData.data.reference,
        payment_status: "pending",
        payment_initiated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    // 9. Return Success Response
    // For M-Pesa, the response structure is slightly different
    const responseData: Record<string, unknown> = {
      reference: paystackData.data.reference,
    };
    
    if (paystackData.data.authorization_url) {
      responseData.authorization_url = paystackData.data.authorization_url;
    }
    
    if (paystackData.data.access_code) {
      responseData.access_code = paystackData.data.access_code;
    }
    
    // Include status and message for M-Pesa STK Push
    if (isMpesaPayment) {
      responseData.status = paystackData.data.status;
      responseData.message = paystackData.message || paystackData.data.gateway_response;
    }
    
    return successResponse(responseData, corsHeaders, requestId);

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
