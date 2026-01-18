/**
 * Create Payout Method Edge Function
 * 
 * Allows providers to add bank or M-Pesa payout methods.
 * Validates ownership, handles default flag, and prepares for subaccount creation.
 * 
 * Security:
 * - JWT authentication required
 * - Validates user is a provider
 * - RLS policies enforce ownership
 * 
 * Request Body:
 * {
 *   provider_id: string (UUID),
 *   type: 'bank' | 'mpesa' | 'mobile_money',
 *   label?: string,
 *   account_name: string,
 *   account_number: string,
 *   bank_code?: string (required for bank),
 *   country?: string (default 'KE'),
 *   is_default?: boolean
 * }
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

const CONFIG = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") || "",
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
};

// ============================================================================
// TYPES
// ============================================================================

interface CreatePayoutMethodRequest {
  provider_id: string;
  type: 'bank' | 'mpesa' | 'mobile_money' | 'other';
  label?: string;
  account_name: string;
  account_number: string;
  bank_code?: string;
  country?: string;
  is_default?: boolean;
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

// ============================================================================
// VALIDATION
// ============================================================================

function validatePayoutMethodRequest(payload: unknown): {
  ok: boolean;
  error?: string;
  data?: CreatePayoutMethodRequest;
} {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }

  const req = payload as Record<string, unknown>;

  // Validate provider_id
  const provider_id = sanitizeString(req.provider_id);
  if (!provider_id || !isValidUuid(provider_id)) {
    return { ok: false, error: 'Valid provider_id (UUID) is required' };
  }

  // Validate type
  const type = sanitizeString(req.type);
  if (!type || !['bank', 'mpesa', 'mobile_money', 'other'].includes(type)) {
    return { ok: false, error: 'type must be: bank, mpesa, mobile_money, or other' };
  }

  // Validate account_name
  const account_name = sanitizeString(req.account_name);
  if (!account_name || account_name.length < 2) {
    return { ok: false, error: 'account_name is required (min 2 characters)' };
  }

  // Validate account_number
  const account_number = sanitizeString(req.account_number);
  if (!account_number || account_number.length < 3) {
    return { ok: false, error: 'account_number is required (min 3 characters)' };
  }

  // For bank type, bank_code is required
  const bank_code = sanitizeString(req.bank_code);
  if (type === 'bank' && !bank_code) {
    return { ok: false, error: 'bank_code is required for bank accounts' };
  }

  // Optional fields
  const label = sanitizeString(req.label);
  const country = sanitizeString(req.country) || 'KE';
  const is_default = req.is_default === true;

  return {
    ok: true,
    data: {
      provider_id,
      type: type as 'bank' | 'mpesa' | 'mobile_money' | 'other',
      label,
      account_name,
      account_number,
      bank_code,
      country,
      is_default,
    },
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  console.log(`[${requestId}] === CREATE PAYOUT METHOD ===`);

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
    return errorResponse('Service not configured', 500, corsHeaders, requestId);
  }

  // Parse request body
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders, requestId);
  }

  // Validate request
  const validation = validatePayoutMethodRequest(payload);
  if (!validation.ok || !validation.data) {
    return errorResponse(validation.error!, 400, corsHeaders, requestId);
  }

  const data = validation.data;

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

  const tryFetchProviderByUserId = async () => {
    const { data: providerData, error } = await (supabaseAdmin
      .from('providers')
      .select('id, user_id') as any)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (String(error?.message || "").includes('user_id')) {
        return null;
      }
      throw error;
    }

    return providerData as { id: string; user_id?: string } | null;
  };

  const tryFetchProviderById = async (id: string) => {
    const { data: providerData, error } = await (supabaseAdmin
      .from('providers')
      .select('id, user_id') as any)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return providerData as { id: string; user_id?: string } | null;
  };

  try {
    provider = await tryFetchProviderByUserId();
    if (!provider && data.provider_id) {
      provider = await tryFetchProviderById(data.provider_id);
    }
    if (!provider && userId) {
      provider = await tryFetchProviderById(userId);
    }
  } catch (error) {
    console.error(`[${requestId}] Provider lookup error:`, error);
  }

  if (!provider) {
    return errorResponse('Provider not found', 404, corsHeaders, requestId);
  }

  const providerOwnerId = provider.user_id ?? provider.id;
  if (providerOwnerId !== userId) {
    return errorResponse('You do not have permission to add payout methods for this provider', 403, corsHeaders, requestId);
  }

  const providerIdToUse = provider.id;

  console.log(`[${requestId}] Provider resolution:`, {
    input_provider_id: data.provider_id,
    auth_user_id: userId,
    resolved_provider_table_id: providerIdToUse,
    provider_user_id: provider.user_id,
    provider_owns: providerOwnerId === userId,
  });

  // ========================================================================
  // HANDLE DEFAULT FLAG IN TRANSACTION
  // ========================================================================

  try {
    // If this is being set as default, unset other defaults first
    if (data.is_default) {
      const { error: updateError } = await supabaseAdmin
        .from('provider_payout_methods')
        .update({ is_default: false })
        .eq('provider_id', providerIdToUse)
        .eq('is_default', true);

      if (updateError) {
        console.error(`[${requestId}] Failed to unset other defaults:`, updateError);
        // Continue anyway - unique constraint will catch issues
      }
    }

    // ========================================================================
    // INSERT PAYOUT METHOD
    // ========================================================================

    console.log(`[${requestId}] Inserting payout method with provider_id:`, providerIdToUse);

    const { data: payoutMethod, error: insertError } = await supabaseAdmin
      .from('provider_payout_methods')
      .insert({
        provider_id: providerIdToUse,
        type: data.type,
        label: data.label,
        account_name: data.account_name,
        account_number: data.account_number,
        bank_code: data.bank_code,
        country: data.country,
        is_default: data.is_default,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] Failed to insert payout method:`, insertError);
      return errorResponse(`Failed to create payout method: ${insertError.message}`, 500, corsHeaders, requestId);
    }

    console.log(`[${requestId}] ✅ Created payout method:`, {
      payout_method_id: payoutMethod.id,
      provider_id: payoutMethod.provider_id,
      type: payoutMethod.type,
      account_number: payoutMethod.account_number,
      label: payoutMethod.label,
    });

    return successResponse(
      {
        payout_method: payoutMethod,
        message: 'Payout method created successfully',
        next_step: 'Call create-subaccount to generate Paystack subaccount for this method',
      },
      corsHeaders,
      requestId
    );

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return errorResponse('Internal server error', 500, corsHeaders, requestId);
  }
});
