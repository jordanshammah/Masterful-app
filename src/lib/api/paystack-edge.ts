/**
 * Paystack Edge Function Client (Frontend)
 * - Calls Supabase Edge Functions to initiate and verify Paystack transactions
 * - Sends the user's Supabase JWT in Authorization header
 *
 * Security:
 * - Never uses Paystack secret key on the client
 * - Never uses Supabase service role key on the client
 * - All sensitive operations happen server-side in Edge Functions
 * 
 * Flow for M-Pesa STK Push:
 * 1. Call initiatePaystack() with phone number
 * 2. User receives STK Push on their phone
 * 3. User enters PIN
 * 4. Paystack sends webhook to our server
 * 5. Server updates job status via webhook
 * 6. Frontend polls or uses realtime subscription to detect completion
 */

import { supabase } from "@/integrations/supabase/client";

export type PaystackCurrency = "NGN" | "GHS" | "ZAR" | "USD" | "KES";
export const SUPPORTED_CURRENCIES = ["NGN", "GHS", "ZAR", "USD", "KES"] as const;

export interface InitiatePaystackParams {
  jobId: string;
  amountMajor: number; // Amount in major units (e.g. 5000 for 5000 KES)
  currency?: PaystackCurrency;
  phone?: string; // Required for M-Pesa STK Push (format: 254XXXXXXXXX)
}

export interface InitiatePaystackResponse {
  ok: boolean;
  reference: string;
  authorization_url?: string;
  access_code?: string;
  request_id?: string;
  error?: string;
  devMock?: boolean;
  // Legacy fields for backward compatibility
  data?: any;
  paystack?: {
    status?: boolean;
    data?: {
      status?: string;
    };
  };
}

/**
 * Validate payment amount is within valid range
 */
export function validatePaymentAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a number' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  if (amount > 10000000) {
    return { valid: false, error: 'Amount cannot exceed 10,000,000' };
  }
  return { valid: true };
}

/**
 * Validate job ID is a valid UUID
 */
export function validateJobId(jobId: string): { valid: boolean; error?: string } {
  if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
    return { valid: false, error: 'Job ID is required and must be a non-empty string' };
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId.trim())) {
    return { valid: false, error: `Invalid Job ID format: ${jobId}. Job ID must be a valid UUID` };
  }
  return { valid: true };
}

/**
 * Validate currency is supported
 */
export function validateCurrency(currency: string): { valid: boolean; error?: string } {
  if (!SUPPORTED_CURRENCIES.includes(currency as PaystackCurrency)) {
    return { valid: false, error: `Invalid currency: ${currency}. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}` };
  }
  return { valid: true };
}

export interface VerifyPaystackResponse {
  ok: boolean;
  status?: 'success' | 'failed' | 'abandoned' | 'pending';
  reference?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  paid_at?: string;
  gateway_response?: string;
  request_id?: string;
  error?: string;
  // Legacy fields for backward compatibility
  data?: any;
  paystack?: {
    status?: boolean;
    data?: {
      status?: string;
    };
  };
}

// Get Edge Function URLs from environment
// In development, these should point to your local Supabase instance
// In production, these should point to your deployed Supabase project
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const DEFAULT_INITIATE_URL = `${SUPABASE_URL}/functions/v1/initiate-paystack`;
const DEFAULT_VERIFY_URL = `${SUPABASE_URL}/functions/v1/paystack-verify`;

const INITIATE_URL =
  (import.meta.env.VITE_PAYSTACK_INITIATE_URL as string) || DEFAULT_INITIATE_URL;
const VERIFY_URL =
  (import.meta.env.VITE_PAYSTACK_VERIFY_URL as string) || DEFAULT_VERIFY_URL;

const DEFAULT_CURRENCY: PaystackCurrency =
  ((import.meta.env.VITE_PAYSTACK_CURRENCY as PaystackCurrency) || "KES");

/**
 * Validate phone number for M-Pesa (Kenyan format)
 * Accepts: 07XXXXXXXX, 01XXXXXXXX, +254XXXXXXXXX, 254XXXXXXXXX
 * 
 * @returns Normalized phone in 254XXXXXXXXX format, or null if invalid
 */
export function validateKenyanPhone(phone: string): string | null {
  // Remove all non-digit characters (except + for initial check)
  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  // Accept flexible formats:
  // - 07XXXXXXXX (local format, 10 digits)
  // - +2547XXXXXXXX (international with +, 13 chars)
  // - 2547XXXXXXXX (international without +, 12 digits)
  // - 017XXXXXXXX (with 01 prefix, 10 digits)
  
  if (/^0[17]\d{8}$/.test(cleaned)) {
    // Convert 07XXXXXXXX or 01XXXXXXXX to 2547XXXXXXXX
    return '254' + cleaned.substring(1);
  }
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    // Remove + prefix: +2547XXXXXXXX -> 2547XXXXXXXX
    return cleaned.substring(1);
  }
  if (/^254[17]\d{8}$/.test(cleaned)) {
    // Already in correct format: 2547XXXXXXXX
    return cleaned;
  }
  
  if (import.meta.env.DEV) {
    console.warn('[validateKenyanPhone] Invalid phone format:', phone, 'cleaned:', cleaned);
  }
  return null; // Invalid format
}

/**
 * Format phone for display (converts 254XXXXXXXXX to 07XXXXXXXX)
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return phone;
  const normalized = validateKenyanPhone(phone);
  if (!normalized) return phone;
  if (normalized.startsWith('254') && normalized.length === 12) {
    return '0' + normalized.substring(3);
  }
  return normalized;
}

/**
 * Get current user's access token for authenticated requests
 */
async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Authentication error: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated. Please log in to continue.");
  return token;
}

/**
 * Handle API errors with user-friendly messages
 */
function handleApiError(status: number, responseText: string): Error {
  // Try to parse JSON error
  try {
    const json = JSON.parse(responseText);
    if (json.error) {
      return new Error(json.error);
    }
  } catch {
    // Not JSON, use status-based message
  }

  switch (status) {
    case 400:
      return new Error("Invalid request. Please check your payment details.");
    case 401:
      return new Error("Session expired. Please log in again.");
    case 403:
      return new Error("You don't have permission to perform this action.");
    case 404:
      return new Error("Payment reference not found.");
    case 429:
      return new Error("Too many requests. Please wait a moment and try again.");
    case 500:
      return new Error("Payment service temporarily unavailable. Please try again later.");
    case 502:
      return new Error("Payment gateway error. Please try again later.");
    default:
      return new Error(responseText || `Request failed (${status})`);
  }
}

/**
 * Initiate a Paystack payment transaction
 * For M-Pesa STK Push, include the phone parameter
 */
export async function initiatePaystack({
  jobId,
  amountMajor,
  currency,
  phone,
}: InitiatePaystackParams): Promise<InitiatePaystackResponse> {
  // Validate Edge Function URL is configured
  if (!INITIATE_URL || (INITIATE_URL === DEFAULT_INITIATE_URL && !SUPABASE_URL)) {
    if (import.meta.env.DEV) {
      console.error("[initiatePaystack] Configuration check:", {
        SUPABASE_URL: SUPABASE_URL ? "SET" : "MISSING",
        INITIATE_URL: INITIATE_URL ? "CONFIGURED" : "MISSING",
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? "SET" : "MISSING",
        VITE_PAYSTACK_INITIATE_URL: import.meta.env.VITE_PAYSTACK_INITIATE_URL ? "SET" : "MISSING",
      });
    }
    throw new Error(
      "Payment service not configured. Please ensure VITE_SUPABASE_URL is set in your .env.local file and restart the dev server."
    );
  }

  // Validate inputs before making API call
  if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
    throw new Error("Job ID is required and must be a valid string");
  }

  // UUID format validation (edge function expects UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId.trim())) {
    throw new Error(`Invalid Job ID format: ${jobId}. Job ID must be a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)`);
  }

  if (typeof amountMajor !== 'number' || isNaN(amountMajor) || amountMajor <= 0) {
    throw new Error(`Invalid payment amount: ${amountMajor}. Must be a positive number.`);
  }

  if (amountMajor > 10000000) {
    throw new Error(`Payment amount too high: ${amountMajor}. Maximum allowed is 10,000,000.`);
  }

  // Currency validation (if provided)
  const selectedCurrency = currency || DEFAULT_CURRENCY;
  if (!SUPPORTED_CURRENCIES.includes(selectedCurrency)) {
    throw new Error(`Invalid currency: ${selectedCurrency}. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }

  // Validate and format phone for M-Pesa
  let formattedPhone: string | undefined;
  if (phone) {
    if (import.meta.env.DEV) {
      console.log('[initiatePaystack] Validating phone:', phone);
    }
    const validated = validateKenyanPhone(phone);
    if (!validated) {
      console.error('[initiatePaystack] Phone validation failed for:', phone);
      throw new Error("Invalid phone number format. Use format: 07XXXXXXXX or 254XXXXXXXXX");
    }
    formattedPhone = validated;
    if (import.meta.env.DEV) {
      console.log('[initiatePaystack] Validated phone:', formattedPhone);
    }
  } else {
    if (import.meta.env.DEV) {
      console.warn('[initiatePaystack] No phone number provided - will use standard payment flow');
    }
  }

  const token = await getAccessToken();
  
  // Build body, ensuring no undefined values
  const body: Record<string, unknown> = {
    job_id: jobId,
    amount: amountMajor, // Edge function handles conversion to minor units
    currency: currency || DEFAULT_CURRENCY,
  };
  
  // Only add phone if it's provided and valid
  if (formattedPhone) {
    body.phone = formattedPhone;
  }

  // Debug logging in development only
  if (import.meta.env.DEV) {
    console.log("[initiatePaystack] Request:", {
      job_id: body.job_id,
      amount: body.amount,
      currency: body.currency,
      hasPhone: !!body.phone,
    });
  }
  
  // Final validation before sending
  if (!body.job_id || !body.amount) {
    throw new Error(`Missing required fields: job_id=${!!body.job_id}, amount=${!!body.amount}`);
  }

  // DEV MOCK: optionally bypass real edge calls for testing without remote deploy
  const devMockEnabled = (import.meta.env.DEV) && ((import.meta.env.VITE_PAYSTACK_MOCK as string) === "true");
  if (devMockEnabled) {
    if (import.meta.env.DEV) {
      console.log("[initiatePaystack] DEV MOCK enabled: returning mock response");
    }
    return {
      ok: true,
      reference: `MOCK-${jobId}-${Date.now()}`,
      devMock: true
    };
  }

  // Stringify body and log in development
  const bodyString = JSON.stringify(body);
  if (import.meta.env.DEV) {
    console.log("[initiatePaystack] Sending request:", {
      url: INITIATE_URL,
      method: "POST",
      bodyString,
      bodyParsed: JSON.parse(bodyString), // Verify it can be parsed back
      bodyKeys: Object.keys(body),
    });
  }

  let res: Response;
  try {
    res = await fetch(INITIATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: bodyString,
    });
  } catch (fetchError: any) {
    // Network error - fetch failed completely (CORS, DNS, connection refused, etc.)
    if (import.meta.env.DEV) {
      console.error("[initiatePaystack] Fetch error:", fetchError);
      console.error("[initiatePaystack] URL:", INITIATE_URL);
      console.error("[initiatePaystack] URL configured:", !!INITIATE_URL);
      console.error("[initiatePaystack] Supabase URL configured:", !!SUPABASE_URL);
    }
    
    // Check if it's a network error (TypeError from fetch, or other network-related errors)
    const isNetworkError = 
      fetchError instanceof TypeError ||
      fetchError instanceof DOMException ||
      fetchError?.name === "NetworkError" ||
      fetchError?.message?.includes("fetch") ||
      fetchError?.message?.includes("network") ||
      fetchError?.message?.includes("CORS") ||
      fetchError?.message?.includes("Failed to fetch") ||
      fetchError?.message?.includes("Load failed");
    
    if (isNetworkError) {
      const errorMsg = 
        `Unable to connect to payment service. Please check:\n` +
        `1. Edge Functions are deployed (run: supabase functions list)\n` +
        `2. Edge Function secrets are set (PAYSTACK_SECRET, SUPABASE_URL, etc.)\n` +
        `3. Network connection is active\n` +
        `4. VITE_SUPABASE_URL is set in .env.local (not .env.example)\n` +
        `5. Dev server was restarted after adding .env.local\n` +
        `6. CORS is configured (add localhost:8080 to ALLOWED_ORIGINS if needed)\n` +
        `\n💡 Tip: Open browser console and run: debugPaymentConfig()`;
      
      if (import.meta.env.DEV) {
        console.error("[initiatePaystack] Network error details:", {
          url: INITIATE_URL,
          urlConfigured: !!INITIATE_URL,
          supabaseUrlConfigured: !!SUPABASE_URL,
          error: fetchError.message,
          errorType: fetchError.constructor.name,
          errorName: fetchError?.name,
        });
      }
      
      throw new Error(errorMsg);
    }
    
    throw new Error(`Network error: ${fetchError.message || "Failed to fetch"}`);
  }

  // Try to read response even if status is not OK
  let responseText: string;
  try {
    responseText = await res.text();
  } catch (textError) {
    // If we can't read the response, it's likely a CORS or network issue
    throw new Error(
      `Unable to read response from payment service. This may be a CORS issue. ` +
      `Check Edge Function logs in Supabase Dashboard.`
    );
  }

  if (!res.ok) {
    if (import.meta.env.DEV) {
      console.error("[initiatePaystack] API error:", {
        status: res.status,
        statusText: res.statusText,
        response: responseText.substring(0, 500), // Show more of the response
        urlConfigured: !!INITIATE_URL,
        requestBody: body, // Log what we sent
      });
    }
    
    // Try to parse error message from response
    let errorMessage: string | undefined;
    let errorJson: any = null;
    try {
      errorJson = JSON.parse(responseText);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // Not JSON or no error field, use status-based error
    }
    
    // Log full response for debugging
    if (import.meta.env.DEV) {
      console.error("[initiatePaystack] Full error response:", {
        status: res.status,
        responseText: responseText,
        parsedError: errorJson,
        requestBody: body,
        diagnostic: errorJson?.diagnostic,
      });
    }
    
    // If diagnostic info is available, use it to create a detailed error
    if (errorJson?.diagnostic) {
      const diagnostic = errorJson.diagnostic;
      const helpfulMessage = 
        `Edge Function Error: ${errorMessage || 'Unknown error'}\n\n` +
        `What Edge Function Received:\n` +
        `- Body type: ${diagnostic.bodyType || 'unknown'}\n` +
        `- Has job_id key: ${diagnostic.hasJobIdKey}\n` +
        `- Has amount key: ${diagnostic.hasAmountKey}\n` +
        `- job_id value: ${diagnostic.jobIdValue} (type: ${diagnostic.jobIdType})\n` +
        `- amount value: ${diagnostic.amountValue} (type: ${diagnostic.amountType})\n` +
        `- All keys received: ${diagnostic.allKeys?.join(', ') || diagnostic.bodyKeys?.join(', ') || 'none'}\n` +
        `- Full body: ${diagnostic.fullBody || diagnostic.bodyString || 'N/A'}\n\n` +
        `What Client Sent:\n` +
        `- job_id: ${body.job_id}\n` +
        `- amount: ${body.amount}\n` +
        `- currency: ${body.currency}\n` +
        `- phone: ${body.phone || 'none'}\n` +
        `- Full request: ${JSON.stringify(body)}`;
      
      console.error("[initiatePaystack] Diagnostic error details:", {
        diagnostic,
        requestBody: body,
        errorResponse: errorJson,
      });
      
      throw new Error(helpfulMessage);
    }
    
    // Provide more helpful error message for "missing fields"
    if (errorMessage === "missing fields" || errorMessage?.includes("missing")) {
      // If the error response has more details, use them
      const detailedError = errorJson?.error || errorMessage;
      const helpfulMessage = 
        `Edge Function Error: ${detailedError}\n` +
        `Client sent: job_id=${body.job_id}, amount=${body.amount}, currency=${body.currency}, phone=${body.phone || 'none'}\n` +
        `Full request body: ${JSON.stringify(body)}\n` +
        `This suggests the Edge Function isn't receiving the data correctly. ` +
        `Please check Edge Function logs or redeploy with updated validation.`;
      
      if (import.meta.env.DEV) {
        console.error("[initiatePaystack] Missing fields error. Full details:", {
          errorResponse: errorJson,
          requestBody: body,
          responseText: responseText,
        });
      }
      
      throw new Error(helpfulMessage);
    }
    
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    
    throw handleApiError(res.status, responseText);
  }

  let json: InitiatePaystackResponse;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error("Invalid response from payment service");
  }

  if (!json.ok && json.error) {
    throw new Error(json.error);
  }

  if (!json.reference) {
    throw new Error("Payment initiation did not return a reference");
  }

  return json;
}

/**
 * Verify a Paystack payment transaction
 * Call this after user completes payment (popup callback or STK Push)
 */
export async function verifyPaystack(reference: string): Promise<VerifyPaystackResponse> {
  if (!reference || typeof reference !== 'string') {
    throw new Error("Payment reference is required");
  }

  // Basic format validation
  if (!/^[A-Za-z0-9_-]+$/.test(reference)) {
    throw new Error("Invalid payment reference format");
  }

  const token = await getAccessToken();

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ reference }),
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw handleApiError(res.status, responseText);
  }

  let json: VerifyPaystackResponse;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error("Invalid response from payment service");
  }

  return json;
}

/**
 * Check if Paystack Edge Functions are configured
 */
export function isPaystackConfigured(): boolean {
  return !!(INITIATE_URL && VERIFY_URL);
}

/**
 * Debug helper to check payment configuration
 * Call this in browser console to diagnose issues
 */
export async function debugPaymentConfig(): Promise<any> {
  const config = {
    SUPABASE_URL: SUPABASE_URL ? "SET" : "MISSING",
    INITIATE_URL: INITIATE_URL ? "CONFIGURED" : "MISSING",
    VERIFY_URL: VERIFY_URL ? "CONFIGURED" : "MISSING",
    DEFAULT_CURRENCY: DEFAULT_CURRENCY,
    env: {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? "SET" : "MISSING",
      VITE_PAYSTACK_INITIATE_URL: import.meta.env.VITE_PAYSTACK_INITIATE_URL ? "SET" : "MISSING",
      VITE_PAYSTACK_VERIFY_URL: import.meta.env.VITE_PAYSTACK_VERIFY_URL ? "SET" : "MISSING",
      VITE_PAYSTACK_CURRENCY: import.meta.env.VITE_PAYSTACK_CURRENCY ? "SET" : "MISSING",
    },
  };
  
  console.log("🔍 Payment Configuration Debug:", config);
  
  if (!SUPABASE_URL) {
    console.error("❌ VITE_SUPABASE_URL is missing! Check your .env.local file");
  }
  if (!INITIATE_URL || (INITIATE_URL === DEFAULT_INITIATE_URL && !SUPABASE_URL)) {
    console.error("❌ Edge Function URL not configured properly");
  }
  
  // Show URL format (without exposing actual project URL)
  if (SUPABASE_URL) {
    const urlParts = SUPABASE_URL.split('.');
    if (urlParts.length > 0) {
      const maskedUrl = `${urlParts[0]}...supabase.co`;
      console.log("✅ Supabase URL format:", maskedUrl);
    }
  }
  
  // Test connectivity to Edge Function (if URL is configured)
  if (INITIATE_URL && SUPABASE_URL) {
    console.log("🧪 Testing Edge Function connectivity...");
    try {
      // Try to get session token for test
      const { data: sessionData } = await supabase.auth.getSession();
      const testToken = sessionData?.session?.access_token;
      
      if (testToken) {
        // Try a simple OPTIONS request to check CORS (preflight)
        try {
          const testRes = await fetch(INITIATE_URL, {
            method: "OPTIONS",
            headers: {
              "Authorization": `Bearer ${testToken}`,
            },
          });
          
          if (testRes.status === 204 || testRes.ok) {
            console.log("✅ Edge Function is reachable and CORS is configured correctly");
            console.log("   Status:", testRes.status, testRes.statusText);
            
            // Check for CORS headers
            const corsHeaders = {
              "Access-Control-Allow-Origin": testRes.headers.get("Access-Control-Allow-Origin"),
              "Access-Control-Allow-Methods": testRes.headers.get("Access-Control-Allow-Methods"),
              "Access-Control-Allow-Headers": testRes.headers.get("Access-Control-Allow-Headers"),
            };
            console.log("   CORS Headers:", corsHeaders);
          } else {
            console.warn("⚠️  Edge Function responded but with unexpected status:", testRes.status);
          }
        } catch (testError: any) {
          console.error("❌ Edge Function connectivity test failed:", testError.message);
          if (testError.message.includes("CORS") || testError.message.includes("Failed to fetch")) {
            console.error("   ⚠️  This looks like a CORS issue. Ensure Edge Function handles OPTIONS requests.");
          }
        }
      } else {
        console.warn("⚠️  Not authenticated - cannot test Edge Function connectivity");
        console.log("   💡 Tip: Log in and try again to test full connectivity");
      }
    } catch (testErr: any) {
      console.error("❌ Error testing connectivity:", testErr.message);
    }
  }
  
  return config;
}

/**
 * Get the default currency
 */
export function getDefaultCurrency(): PaystackCurrency {
  return DEFAULT_CURRENCY;
}

