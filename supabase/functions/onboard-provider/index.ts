/**
 * Edge Function: onboard-provider
 *
 * Accepts provider setup payload from the client and writes to DB using service role.
 * Ensures profile, provider, and (optional) address data are persisted server-side.
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

type AddressPayload = {
  label?: string;
  street?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  is_primary?: boolean;
};

type OnboardPayload = {
  display_name?: string;
  business_name?: string;
  category_id?: number | string;
  bio?: string;
  hourly_rate?: number | string;
  profile_image_url?: string;
  address?: AddressPayload | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function parseNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function normalizeAddress(input: unknown): AddressPayload | null {
  if (!input || typeof input !== "object") return null;
  const addr = input as Record<string, unknown>;

  return {
    label: isNonEmptyString(addr.label) ? sanitizeString(addr.label, 100) : undefined,
    street: isNonEmptyString(addr.street) ? sanitizeString(addr.street, 200) : undefined,
    city: isNonEmptyString(addr.city) ? sanitizeString(addr.city, 100) : undefined,
    region: isNonEmptyString(addr.region) ? sanitizeString(addr.region, 100) : undefined,
    postal_code: isNonEmptyString(addr.postal_code) ? sanitizeString(addr.postal_code, 30) : undefined,
    country: isNonEmptyString(addr.country) ? sanitizeString(addr.country, 50) : undefined,
    is_primary: addr.is_primary === true,
  };
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

  let payload: OnboardPayload;
  try {
    payload = (await req.json()) as OnboardPayload;
  } catch {
    return errorResponse("Invalid JSON body", 400, corsHeaders, requestId);
  }

  const displayName = isNonEmptyString(payload.display_name)
    ? sanitizeString(payload.display_name, 120)
    : undefined;
  const businessName = isNonEmptyString(payload.business_name)
    ? sanitizeString(payload.business_name, 120)
    : undefined;
  const bio = isNonEmptyString(payload.bio) ? sanitizeString(payload.bio, 500) : undefined;
  const categoryId = parseNumber(payload.category_id);
  const hourlyRate = parseNumber(payload.hourly_rate);
  const profileImageUrl = isNonEmptyString(payload.profile_image_url)
    ? sanitizeString(payload.profile_image_url, 500)
    : undefined;
  const address = normalizeAddress(payload.address);

  if (!displayName || categoryId === null || hourlyRate === null || !bio) {
    return errorResponse(
      "Missing required fields: display_name, category_id, hourly_rate, bio",
      400,
      corsHeaders,
      requestId
    );
  }

  const userId = userData.user.id;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Update profile (non-blocking details)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: displayName,
      city: address?.city || null,
    })
    .eq("id", userId);

  if (profileError) {
    console.error(`[${requestId}] Profile update error:`, profileError);
    return errorResponse(`Profile update failed: ${profileError.message}`, 500, corsHeaders, requestId);
  }

  // Ensure provider role exists
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "provider" }, { onConflict: "user_id,role" });

  if (roleError) {
    console.error(`[${requestId}] Role upsert error:`, roleError);
    return errorResponse(`Role update failed: ${roleError.message}`, 500, corsHeaders, requestId);
  }

  const providerPayload: Record<string, unknown> = {
    id: userId,
    user_id: userId,
    display_name: displayName,
    business_name: businessName || null,
    bio: bio || null,
    profile_image_url: profileImageUrl || null,
    city: address?.city || null,
    category_id: categoryId,
    hourly_rate: hourlyRate,
    is_verified: false,
    is_active: false,
  };

  const { data: providerRow, error: providerError } = await supabaseAdmin
    .from("providers")
    .upsert(providerPayload, { onConflict: "id" })
    .select("*")
    .single();

  if (providerError) {
    console.error(`[${requestId}] Provider upsert error:`, providerError);
    return errorResponse(`Provider upsert failed: ${providerError.message}`, 500, corsHeaders, requestId);
  }

  // Optional: insert provider address
  if (address?.street && address?.city && address?.region && address?.postal_code) {
    if (address.is_primary) {
      const { error: unsetError } = await supabaseAdmin
        .from("addresses")
        .update({ is_primary: false })
        .eq("owner_type", "provider")
        .eq("owner_id", userId)
        .eq("is_primary", true);

      if (unsetError) {
        console.warn(`[${requestId}] Failed to unset primary addresses:`, unsetError);
      }
    }

    const { error: addressError } = await supabaseAdmin.from("addresses").insert({
      owner_type: "provider",
      owner_id: userId,
      label: address.label || "Business Address",
      street: address.street,
      city: address.city,
      region: address.region,
      postal_code: address.postal_code,
      country: address.country || "US",
      is_primary: address.is_primary ?? false,
    });

    if (addressError) {
      console.error(`[${requestId}] Address insert error:`, addressError);
      return errorResponse(`Address insert failed: ${addressError.message}`, 500, corsHeaders, requestId);
    }
  }

  return successResponse(
    {
      provider: providerRow,
      message: "Provider onboarded successfully",
    },
    corsHeaders,
    requestId
  );
});
