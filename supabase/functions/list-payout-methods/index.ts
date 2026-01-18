/**
 * List Payout Methods Edge Function
 *
 * Returns payout methods for the authenticated provider using service role.
 * Useful when RLS blocks direct client-side reads.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  errorResponse,
  generateRequestId,
  getCorsHeaders,
  sanitizeString,
  successResponse,
} from "../_shared/security.ts";

interface ListPayoutMethodsRequest {
  provider_id?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders, requestId);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse("Service not configured", 500, corsHeaders, requestId);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Missing or invalid authorization", 401, corsHeaders, requestId);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    return errorResponse("Authentication failed", 401, corsHeaders, requestId);
  }

  let payload: ListPayoutMethodsRequest = {};
  try {
    payload = (await req.json()) as ListPayoutMethodsRequest;
  } catch {
    payload = {};
  }

  const userId = userData.user.id;
  const requestedProviderId = sanitizeString(payload.provider_id);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const tryFetchProviderByUserId = async () => {
    const { data: providerData, error } = await (supabaseAdmin
      .from("providers")
      .select("id, user_id") as any)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (String(error?.message || "").includes("user_id")) {
        return null;
      }
      throw error;
    }

    return providerData as { id: string; user_id?: string } | null;
  };

  const tryFetchProviderById = async (id: string) => {
    const { data: providerData, error } = await (supabaseAdmin
      .from("providers")
      .select("id, user_id") as any)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return providerData as { id: string; user_id?: string } | null;
  };

  let provider: { id: string; user_id?: string } | null = null;

  try {
    provider = await tryFetchProviderByUserId();
    if (!provider && requestedProviderId && isValidUuid(requestedProviderId)) {
      provider = await tryFetchProviderById(requestedProviderId);
    }
    if (!provider) {
      provider = await tryFetchProviderById(userId);
    }
  } catch (error) {
    console.error(`[${requestId}] Provider lookup error:`, error);
  }

  if (!provider) {
    return errorResponse("Provider not found", 404, corsHeaders, requestId);
  }

  const providerOwnerId = provider.user_id ?? provider.id;
  if (providerOwnerId !== userId) {
    return errorResponse("Unauthorized", 403, corsHeaders, requestId);
  }

  const { data: payoutMethods, error: listError } = await supabaseAdmin
    .from("provider_payout_methods")
    .select("*")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  if (listError) {
    console.error(`[${requestId}] Failed to list payout methods:`, listError);
    return errorResponse(`Failed to list payout methods: ${listError.message}`, 500, corsHeaders, requestId);
  }

  return successResponse(
    {
      payout_methods: payoutMethods || [],
    },
    corsHeaders,
    requestId
  );
});
