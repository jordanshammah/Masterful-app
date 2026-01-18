/**
 * Manage Paystack Split Groups Edge Function
 * 
 * Allows creating and managing Paystack split groups for complex payment routing
 * where a single payment needs to be split between platform and provider(s).
 * 
 * Use Cases:
 * - Platform commission + Provider payout
 * - Multi-provider jobs (future)
 * - Variable commission rates
 * 
 * Operations:
 * - POST /create: Create a new split group
 * - GET /list: List split groups for a provider
 * - POST /update: Update split group rules
 * 
 * Request Body (create):
 * {
 *   name: string,
 *   type: 'percentage' | 'flat',
 *   bearer_type: 'account' | 'subaccount' | 'all-proportional',
 *   bearer_subaccount?: string,
 *   splits: [
 *     { subaccount: string, share: number },
 *     ...
 *   ]
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  PAYSTACK_SECRET_KEY: Deno.env.get("PAYSTACK_SECRET_KEY") || "",
  PAYSTACK_SPLIT_URL: "https://api.paystack.co/split",
};

// ============================================================================
// TYPES
// ============================================================================

interface SplitRule {
  subaccount: string;
  share: number;
}

interface CreateSplitRequest {
  name: string;
  type: 'percentage' | 'flat';
  bearer_type: 'account' | 'subaccount' | 'all-proportional';
  bearer_subaccount?: string;
  splits: SplitRule[];
}

interface PaystackSplitResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    name: string;
    split_code: string;
    type: string;
    currency: string;
    subaccounts: Array<{
      subaccount: {
        id: number;
        subaccount_code: string;
        business_name: string;
      };
      share: number;
    }>;
    bearer_type: string;
    bearer_subaccount?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().substring(0, 8)}`;
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
  const isLocalDev = origin != null && (origin.includes('localhost') || origin.includes('127.0.0.1'));
  const isAllowed = origin != null && (allowedOrigins.includes(origin) || isLocalDev);
  const allowedOrigin = isAllowed ? origin! : allowedOrigins[0] || '';
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  requestId?: string
): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message, request_id: requestId }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function successResponse(
  data: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  requestId?: string
): Response {
  return new Response(
    JSON.stringify({ ok: true, ...data, request_id: requestId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  console.log(`[${requestId}] === MANAGE SPLIT GROUPS ===`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Verify configuration
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse('Service not configured', 500, corsHeaders, requestId);
  }

  if (!CONFIG.PAYSTACK_SECRET_KEY) {
    return errorResponse('Payment service not configured', 500, corsHeaders, requestId);
  }

  const supabaseAdmin = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

  // ========================================================================
  // CREATE SPLIT GROUP
  // ========================================================================

  if (req.method === 'POST') {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400, corsHeaders, requestId);
    }

    const splitData = payload as CreateSplitRequest;

    // Validate request
    if (!splitData.name || !splitData.type || !splitData.splits || splitData.splits.length === 0) {
      return errorResponse('Invalid split configuration', 400, corsHeaders, requestId);
    }

    console.log(`[${requestId}] Creating split group: ${splitData.name}`);

    // Build Paystack payload
    const paystackPayload = {
      name: splitData.name,
      type: splitData.type,
      currency: 'KES',
      subaccounts: splitData.splits.map(s => ({
        subaccount: s.subaccount,
        share: s.share,
      })),
      bearer_type: splitData.bearer_type,
      bearer_subaccount: splitData.bearer_subaccount,
    };

    // Call Paystack API
    try {
      const response = await fetch(CONFIG.PAYSTACK_SPLIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify(paystackPayload),
      });

      const paystackResponse: PaystackSplitResponse = await response.json();

      if (!response.ok || !paystackResponse.status || !paystackResponse.data) {
        console.error(`[${requestId}] Paystack error:`, paystackResponse);
        return errorResponse(
          `Paystack error: ${paystackResponse.message}`,
          response.status >= 500 ? 502 : 400,
          corsHeaders,
          requestId
        );
      }

      const splitCode = paystackResponse.data.split_code;
      console.log(`[${requestId}] ✅ Split group created: ${splitCode}`);

      // Store split group metadata (optional - for reference)
      // You could create a split_groups table to track these

      return successResponse(
        {
          split: paystackResponse.data,
          split_code: splitCode,
          message: 'Split group created successfully',
        },
        corsHeaders,
        requestId
      );

    } catch (error) {
      console.error(`[${requestId}] Network error:`, error);
      return errorResponse('Payment service temporarily unavailable', 502, corsHeaders, requestId);
    }
  }

  // ========================================================================
  // LIST SPLIT GROUPS
  // ========================================================================

  if (req.method === 'GET') {
    try {
      const response = await fetch(CONFIG.PAYSTACK_SPLIT_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
        },
      });

      const paystackResponse = await response.json();

      if (!response.ok) {
        return errorResponse('Failed to fetch split groups', 502, corsHeaders, requestId);
      }

      return successResponse(
        {
          splits: paystackResponse.data || [],
        },
        corsHeaders,
        requestId
      );

    } catch (error) {
      console.error(`[${requestId}] Network error:`, error);
      return errorResponse('Payment service temporarily unavailable', 502, corsHeaders, requestId);
    }
  }

  return errorResponse('Method not allowed', 405, corsHeaders, requestId);
});
