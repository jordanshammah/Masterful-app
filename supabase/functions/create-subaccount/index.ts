/**
 * Create Paystack Subaccount Edge Function
 * 
 * Creates a Paystack subaccount for a provider's payout method (bank or M-Pesa).
 * Handles idempotency to prevent duplicate subaccounts.
 * 
 * Security:
 * - JWT authentication required
 * - Validates provider ownership
 * - Uses Idempotency-Key for safe retries
 * 
 * Request Body:
 * {
 *   provider_id: string (UUID),
 *   payout_method_id: string (UUID)
 * }
 * 
 * Flow:
 * 1. Validate request and authenticate user
 * 2. Check if subaccount already exists for this payout method
 * 3. Call Paystack API with appropriate payload (bank vs M-Pesa)
 * 4. Store subaccount details in provider_subaccounts
 * 5. Update provider_payout_methods with paystack_subaccount_id
 * 6. Log operation in provider_sync_logs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  errorResponse as sharedErrorResponse,
  generateRequestId as sharedGenerateRequestId,
  getCorsHeaders,
  successResponse as sharedSuccessResponse,
} from "../_shared/security.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Support both PAYSTACK_SECRET_KEY and PAYSTACK_SECRET for backward compatibility
const getPaystackSecret = (): string => {
  return Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("PAYSTACK_SECRET") || "";
};

const CONFIG = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") || "",
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  PAYSTACK_SECRET_KEY: getPaystackSecret(),
  PAYSTACK_SUBACCOUNT_URL: "https://api.paystack.co/subaccount",
};

// ============================================================================
// TYPES
// ============================================================================

interface CreateSubaccountRequest {
  provider_id: string;
  payout_method_id: string;
}

interface PaystackSubaccountResponse {
  status: boolean;
  message: string;
  data?: {
    subaccount_code: string;
    business_name: string;
    description?: string;
    primary_contact_name?: string;
    primary_contact_email?: string;
    primary_contact_phone?: string;
    settlement_bank: string;
    account_number: string;
    percentage_charge: number;
    id: number;
    is_verified?: boolean;
    [key: string]: unknown;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRequestId(): string {
  return sharedGenerateRequestId();
}

function sanitizeString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 500);
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  requestId?: string
): Response {
  return sharedErrorResponse(message, status, corsHeaders, requestId);
}

function successResponse(
  data: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  requestId?: string
): Response {
  return sharedSuccessResponse(data, corsHeaders, requestId);
}

/**
 * Generate stable idempotency key for subaccount creation
 */
function generateIdempotencyKey(providerId: string, payoutMethodId: string): string {
  return `subaccount:${providerId}:${payoutMethodId}`;
}

/**
 * Log Paystack API call to provider_sync_logs (optional - table may not exist)
 */
async function logPaystackCall(
  supabaseAdmin: ReturnType<typeof createClient>,
  providerId: string,
  operation: string,
  endpoint: string,
  requestPayload: Record<string, unknown>,
  responsePayload: Record<string, unknown> | null,
  httpStatus: number,
  success: boolean,
  errorMessage: string | null,
  idempotencyKey: string,
  durationMs: number
): Promise<void> {
  try {
    // Sanitize request payload - remove secrets
    const sanitizedRequest = { ...requestPayload };
    delete sanitizedRequest.Authorization;

    await supabaseAdmin
      .from('provider_sync_logs')
      .insert({
        provider_id: providerId,
        operation,
        endpoint,
        request_payload: sanitizedRequest,
        response_payload: responsePayload,
        http_status: httpStatus,
        success,
        error_message: errorMessage,
        idempotency_key: idempotencyKey,
        duration_ms: durationMs,
      });
  } catch (error: any) {
    // Table might not exist - that's okay, just log to console
    if (String(error?.message || "").includes('does not exist') || 
        String(error?.message || "").includes('relation') ||
        error?.code === '42P01') {
      console.warn('[logPaystackCall] provider_sync_logs table not found, skipping log');
    } else {
      console.error('[logPaystackCall] Failed to log:', error);
    }
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  console.log(`[${requestId}] === CREATE SUBACCOUNT ===`);

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow POST
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405, corsHeaders, requestId);
    }

    // Verify configuration
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${requestId}] Missing Supabase configuration`);
      return errorResponse('Service not configured', 500, corsHeaders, requestId);
    }

    if (!CONFIG.PAYSTACK_SECRET_KEY) {
      console.error(`[${requestId}] Missing Paystack configuration`);
      const errorMessage = 'Payment service not configured. Missing PAYSTACK_SECRET_KEY (or PAYSTACK_SECRET). Please set it in Supabase Dashboard → Edge Functions → Secrets or via CLI: supabase secrets set PAYSTACK_SECRET_KEY=your_value';
      return errorResponse(errorMessage, 500, corsHeaders, requestId);
    }

    // Parse request body
    let payload: unknown;
    try {
      payload = await req.json();
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError);
      return errorResponse('Invalid JSON body', 400, corsHeaders, requestId);
    }

  const req_data = payload as Record<string, unknown>;

  // Validate request
  const provider_id = sanitizeString(req_data.provider_id);
  const payout_method_id = sanitizeString(req_data.payout_method_id);

  if (!provider_id || !isValidUuid(provider_id)) {
    return errorResponse('Valid provider_id (UUID) is required', 400, corsHeaders, requestId);
  }

  if (!payout_method_id || !isValidUuid(payout_method_id)) {
    return errorResponse('Valid payout_method_id (UUID) is required', 400, corsHeaders, requestId);
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

  // ========================================================================
  // VERIFY PROVIDER OWNERSHIP
  // ========================================================================

  const supabaseAdmin = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

  let provider: { id: string; user_id?: string } | null = null;

  // Try to find provider by user_id first (new structure)
  const tryFetchProviderByUserId = async () => {
    try {
      const { data: providerData, error } = await (supabaseAdmin
        .from('providers')
        .select('id, user_id') as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && !String(error?.message || "").includes('user_id')) {
        throw error;
      }

      return providerData as { id: string; user_id?: string } | null;
    } catch (error) {
      console.warn(`[${requestId}] Provider lookup by user_id failed:`, error);
      return null;
    }
  };

  // Try to find provider by id (legacy structure or direct lookup)
  const tryFetchProviderById = async (id: string) => {
    try {
      const { data: providerData, error } = await supabaseAdmin
        .from('providers')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return providerData as { id: string; user_id?: string } | null;
    } catch (error) {
      console.warn(`[${requestId}] Provider lookup by id failed:`, error);
      return null;
    }
  };

  try {
    // Try multiple lookup strategies
    provider = await tryFetchProviderByUserId();
    
    if (!provider && provider_id) {
      provider = await tryFetchProviderById(provider_id);
    }
    
    if (!provider) {
      provider = await tryFetchProviderById(userId);
    }
  } catch (error) {
    console.error(`[${requestId}] Provider lookup error:`, error);
  }

  if (!provider) {
    console.error(`[${requestId}] Provider not found. provider_id: ${provider_id}, userId: ${userId}`);
    return errorResponse('Provider not found', 404, corsHeaders, requestId);
  }

  const providerOwnerId = provider.user_id ?? provider.id;
  if (providerOwnerId !== userId) {
    console.error(`[${requestId}] Permission denied. providerOwnerId: ${providerOwnerId}, userId: ${userId}`);
    return errorResponse('You do not have permission for this provider', 403, corsHeaders, requestId);
  }

  const providerIdToUse = provider.id;
  
  console.log(`[${requestId}] Provider resolved:`, {
    input_provider_id: provider_id,
    auth_user_id: userId,
    resolved_provider_table_id: providerIdToUse,
    provider_user_id: provider.user_id,
  });

  // ========================================================================
  // GET PAYOUT METHOD DETAILS
  // ========================================================================

  console.log(`[${requestId}] Fetching payout method:`, {
    payout_method_id,
    provider_id: providerIdToUse,
  });

  let payoutMethod: any = null;
  try {
    const { data, error: payoutError } = await supabaseAdmin
      .from('provider_payout_methods')
      .select('*')
      .eq('id', payout_method_id)
      .eq('provider_id', providerIdToUse)
      .single();

    if (payoutError) {
      console.error(`[${requestId}] Payout method fetch error:`, {
        error: payoutError,
        code: payoutError.code,
        message: payoutError.message,
        details: payoutError.details,
        hint: payoutError.hint,
      });
      return errorResponse(`Payout method not found: ${payoutError.message}`, 404, corsHeaders, requestId);
    }

    if (!data) {
      console.error(`[${requestId}] Payout method not found in database`);
      return errorResponse('Payout method not found', 404, corsHeaders, requestId);
    }

    payoutMethod = data;
    console.log(`[${requestId}] Payout method found:`, {
      id: payoutMethod.id,
      type: payoutMethod.type,
      account_number: payoutMethod.account_number ? '***' : undefined,
      has_subaccount: !!payoutMethod.paystack_subaccount_id,
    });
  } catch (error) {
    console.error(`[${requestId}] Exception fetching payout method:`, error);
    return errorResponse('Failed to fetch payout method', 500, corsHeaders, requestId);
  }

  // ========================================================================
  // CHECK IF SUBACCOUNT ALREADY EXISTS (IDEMPOTENCY)
  // ========================================================================

  if (payoutMethod.paystack_subaccount_id) {
    console.log(`[${requestId}] Subaccount already exists: ${payoutMethod.paystack_subaccount_id}`);
    
    try {
      const { data: existingSubaccount } = await supabaseAdmin
        .from('provider_subaccounts')
        .select('*')
        .eq('paystack_subaccount_id', payoutMethod.paystack_subaccount_id)
        .maybeSingle();

      return successResponse(
        {
          subaccount: existingSubaccount || null,
          message: 'Subaccount already exists',
          already_exists: true,
        },
        corsHeaders,
        requestId
      );
    } catch (error: any) {
      // Table might not exist - that's okay, just return success
      if (String(error?.message || "").includes('does not exist') || 
          String(error?.message || "").includes('relation') ||
          error?.code === '42P01') {
        console.warn(`[${requestId}] provider_subaccounts table not found, but subaccount ID exists in payout method`);
        return successResponse(
          {
            subaccount: null,
            message: 'Subaccount already exists',
            already_exists: true,
          },
          corsHeaders,
          requestId
        );
      }
      // Re-throw if it's a different error
      throw error;
    }
  }

  // ========================================================================
  // GET PROVIDER PROFILE FOR CONTACT INFO
  // ========================================================================

  console.log(`[${requestId}] Fetching provider profile for contact info:`, {
    providerOwnerId,
  });

  let profile: any = null;
  try {
    const { data, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', providerOwnerId)
      .maybeSingle();

    if (profileError) {
      console.warn(`[${requestId}] Profile fetch error (non-critical):`, profileError);
    } else {
      profile = data;
      console.log(`[${requestId}] Profile fetched:`, {
        has_name: !!profile?.full_name,
        has_email: !!profile?.email,
        has_phone: !!profile?.phone,
      });
    }
  } catch (error) {
    console.warn(`[${requestId}] Exception fetching profile (non-critical):`, error);
  }

  const contactName = profile?.full_name || payoutMethod.account_name || 'Provider';
  const contactEmail = profile?.email || `provider_${providerIdToUse}@mobilefundi.com`;
  const contactPhone = profile?.phone || '+254700000000';

  console.log(`[${requestId}] Contact info resolved:`, {
    name: contactName,
    email: contactEmail,
    phone: contactPhone ? '***' : undefined,
  });

  // ========================================================================
  // BUILD PAYSTACK SUBACCOUNT PAYLOAD
  // ========================================================================

  const idempotencyKey = generateIdempotencyKey(providerIdToUse, payout_method_id);
  const businessName = payoutMethod.label || `${contactName} - ${payoutMethod.type}`;

  let paystackPayload: Record<string, unknown>;

  if (payoutMethod.type === 'bank') {
    // Bank account subaccount
    // Split: Platform gets 15%, Provider subaccount gets 85%
    paystackPayload = {
      business_name: businessName,
      settlement_bank: payoutMethod.bank_code,
      account_number: payoutMethod.account_number,
      primary_contact_name: contactName,
      primary_contact_email: contactEmail,
      primary_contact_phone: contactPhone,
      percentage_charge: 15, // Platform takes 15%, provider subaccount gets 85%
      metadata: {
        provider_id: providerIdToUse,
        payout_method_id,
        type: 'bank',
      },
    };
  } else if (payoutMethod.type === 'mpesa' || payoutMethod.type === 'mobile_money') {
    // M-Pesa / Mobile Money subaccount
    // Paystack dashboard supports M-Pesa subaccounts with "M-PESA" as the bank name
    // For M-Pesa subaccounts, Paystack expects the LOCAL format (10 digits starting with 0)
    // NOT the international format (12 digits starting with 254)
    let mobileNumber = payoutMethod.account_number.trim();
    
    // Remove any spaces, dashes, or + prefix
    mobileNumber = mobileNumber.replace(/[\s\-+]/g, '');
    
    // Convert to local format (10 digits starting with 0) for M-Pesa subaccounts
    if (mobileNumber.startsWith('254')) {
      // Convert 2547XXXXXXXX to 07XXXXXXXX (local format)
      mobileNumber = '0' + mobileNumber.substring(3);
    } else if (!mobileNumber.startsWith('0')) {
      // If it doesn't start with 0 or 254, try to convert
      if (mobileNumber.length === 9) {
        // 9 digits - add leading 0
        mobileNumber = '0' + mobileNumber;
      } else if (mobileNumber.length === 10 && mobileNumber.startsWith('7')) {
        // 10 digits starting with 7 - add leading 0
        mobileNumber = '0' + mobileNumber;
      }
    }

    // Validate: M-Pesa numbers should be 10 digits starting with 0
    if (!/^0\d{9}$/.test(mobileNumber)) {
      console.error(`[${requestId}] Invalid M-Pesa format after normalization: ${mobileNumber.substring(0, 3)}***${mobileNumber.slice(-3)}`);
      return errorResponse(
        `Invalid M-Pesa account number format. Expected 10 digits starting with 0 (e.g., 0712345678). Got: ${mobileNumber.length} digits.`,
        400,
        corsHeaders,
        requestId
      );
    }

    console.log(`[${requestId}] M-Pesa account number normalized: ${payoutMethod.account_number} -> ${mobileNumber.substring(0, 3)}***${mobileNumber.slice(-3)}`);

    // For phone number in contact info, use international format (with +254)
    const phoneForContact = mobileNumber.startsWith('0') 
      ? '+254' + mobileNumber.substring(1)
      : mobileNumber;

    // Try "M-PESA" as settlement_bank (as shown in Paystack dashboard)
    // Paystack dashboard supports M-Pesa subaccounts, so we'll try the dashboard format
    // Split: Platform gets 15%, Provider subaccount gets 85%
    paystackPayload = {
      business_name: businessName,
      settlement_bank: 'M-PESA', // Paystack dashboard shows "M-PESA" as bank name for mobile money
      account_number: mobileNumber, // LOCAL format: 07XXXXXXXX (10 digits, no country code)
      primary_contact_name: contactName,
      primary_contact_email: contactEmail,
      primary_contact_phone: phoneForContact, // International format for contact: +2547XXXXXXXX
      percentage_charge: 15, // Platform takes 15%, provider subaccount gets 85%
      metadata: {
        provider_id: providerIdToUse,
        payout_method_id,
        type: 'mpesa',
        country: payoutMethod.country || 'KE',
      },
    };
    
    console.log(`[${requestId}] Attempting M-Pesa subaccount with settlement_bank: M-PESA, account_number format: local (10 digits)`);
  } else {
    return errorResponse('Unsupported payout method type', 400, corsHeaders, requestId);
  }

  console.log(`[${requestId}] Creating ${payoutMethod.type} subaccount for provider ${providerIdToUse}`);
  console.log(`[${requestId}] Paystack payload (sanitized):`, {
    business_name: paystackPayload.business_name,
    settlement_bank: paystackPayload.settlement_bank,
    account_number: typeof paystackPayload.account_number === 'string' ? '***' : paystackPayload.account_number,
    primary_contact_name: paystackPayload.primary_contact_name,
    primary_contact_email: paystackPayload.primary_contact_email,
    has_phone: !!paystackPayload.primary_contact_phone,
  });

  // ========================================================================
  // CALL PAYSTACK API
  // ========================================================================

  const startTime = Date.now();
  let paystackResponse: PaystackSubaccountResponse;
  let httpStatus = 0;

  try {
    console.log(`[${requestId}] Calling Paystack API...`);
    const response = await fetch(CONFIG.PAYSTACK_SUBACCOUNT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paystackPayload),
    });

    httpStatus = response.status;
    console.log(`[${requestId}] Paystack API response status:`, httpStatus);
    
    const responseText = await response.text();
    console.log(`[${requestId}] Paystack API response (first 200 chars):`, responseText.substring(0, 200));
    
    try {
      paystackResponse = JSON.parse(responseText);
      console.log(`[${requestId}] Paystack response parsed:`, {
        status: paystackResponse.status,
        message: paystackResponse.message,
        has_data: !!paystackResponse.data,
      });
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse Paystack response:`, parseError);
      paystackResponse = {
        status: false,
        message: 'Invalid response from Paystack',
        data: undefined,
      };
    }

    const durationMs = Date.now() - startTime;

    // Log the API call
    await logPaystackCall(
      supabaseAdmin,
      providerIdToUse,
      'create_subaccount',
      CONFIG.PAYSTACK_SUBACCOUNT_URL,
      paystackPayload,
      paystackResponse as unknown as Record<string, unknown>,
      httpStatus,
      response.ok && paystackResponse.status === true,
      paystackResponse.status ? null : paystackResponse.message,
      idempotencyKey,
      durationMs
    );

    if (!response.ok || !paystackResponse.status || !paystackResponse.data) {
      console.error(`[${requestId}] Paystack error:`, paystackResponse);
      return errorResponse(
        `Paystack error: ${paystackResponse.message}`,
        httpStatus >= 500 ? 502 : 400,
        corsHeaders,
        requestId
      );
    }

  } catch (error) {
    const durationMs = Date.now() - startTime;
    await logPaystackCall(
      supabaseAdmin,
      providerIdToUse,
      'create_subaccount',
      CONFIG.PAYSTACK_SUBACCOUNT_URL,
      paystackPayload,
      null,
      0,
      false,
      error instanceof Error ? error.message : 'Network error',
      idempotencyKey,
      durationMs
    );

    console.error(`[${requestId}] Network error:`, error);
    return errorResponse('Payment service temporarily unavailable', 502, corsHeaders, requestId);
  }

  // ========================================================================
  // STORE SUBACCOUNT IN DATABASE
  // ========================================================================

  const subaccountData = paystackResponse.data!;
  const subaccountCode = subaccountData.subaccount_code;

  try {
    // First, try to insert into provider_subaccounts (table might not exist, so handle gracefully)
    let newSubaccount: any = null;
    try {
      const { data, error: subaccountInsertError } = await supabaseAdmin
        .from('provider_subaccounts')
        .insert({
          provider_id: providerIdToUse,
          paystack_subaccount_id: subaccountCode,
          provider_payout_method_id: payout_method_id,
          status: 'active',
          subaccount_code: subaccountCode,
          settlement_bank: subaccountData.settlement_bank,
          account_number: subaccountData.account_number,
          business_name: subaccountData.business_name,
          percentage_charge: subaccountData.percentage_charge,
          raw_response: subaccountData as unknown as Record<string, unknown>,
        })
        .select()
        .single();

      if (subaccountInsertError) {
        // If table doesn't exist, log warning but continue
        if (String(subaccountInsertError.message || "").includes('does not exist') || 
            String(subaccountInsertError.message || "").includes('relation') ||
            subaccountInsertError.code === '42P01') {
          console.warn(`[${requestId}] provider_subaccounts table not found, skipping insert:`, subaccountInsertError.message);
        } else {
          throw subaccountInsertError;
        }
      } else {
        newSubaccount = data;
      }
    } catch (tableError: any) {
      // If table doesn't exist, that's okay - we'll just update the payout method
      if (String(tableError?.message || "").includes('does not exist') || 
          String(tableError?.message || "").includes('relation') ||
          tableError?.code === '42P01') {
        console.warn(`[${requestId}] provider_subaccounts table not found, continuing without it`);
      } else {
        console.error(`[${requestId}] Failed to store subaccount:`, tableError);
        throw tableError;
      }
    }

    // Update payout method with subaccount ID
    console.log(`[${requestId}] Updating payout method with subaccount ID:`, {
      payout_method_id,
      subaccount_code: subaccountCode,
    });
    
    const { error: updateError } = await supabaseAdmin
      .from('provider_payout_methods')
      .update({
        paystack_subaccount_id: subaccountCode,
        verification_status: 'verified',
      })
      .eq('id', payout_method_id);

    if (updateError) {
      console.error(`[${requestId}] Failed to update payout method:`, {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      // Don't throw - subaccount was created successfully, just the update failed
      // This is non-critical as the subaccount exists in Paystack
    } else {
      console.log(`[${requestId}] Payout method updated successfully`);
    }

    console.log(`[${requestId}] ✅ Subaccount created successfully: ${subaccountCode}`);

    return successResponse(
      {
        subaccount: newSubaccount,
        paystack_subaccount_code: subaccountCode,
        message: 'Subaccount created successfully',
      },
      corsHeaders,
      requestId
    );

  } catch (error) {
    console.error(`[${requestId}] Database error:`, error);
    return errorResponse('Failed to store subaccount', 500, corsHeaders, requestId);
  }

  } catch (error) {
    // Top-level error handler for unexpected errors
    console.error(`[${requestId}] ========== UNEXPECTED ERROR ==========`);
    console.error(`[${requestId}] Error type:`, error?.constructor?.name || typeof error);
    console.error(`[${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    console.error(`[${requestId}] Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`[${requestId}] =====================================`);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${errorMessage}`, 500, corsHeaders, requestId);
  }
});
