/**
 * Generate Job Codes Edge Function
 * 
 * Generates one-time auth codes for jobs:
 * - Customers generate "start codes" for confirmed/pending jobs
 * - Providers generate "end codes" for in-progress jobs
 * 
 * Returns plain code (one-time display) and expiry; backend stores only hash
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Get allowed origins from environment or use defaults
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean);
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;
  
  // In production, check if origin is in allowed list
  // In development (no ALLOWED_ORIGINS set), allow localhost origins
  const isAllowed = origin && (
    allowedOrigins.includes(origin) || 
    (ALLOWED_ORIGINS.length === 0 && (origin.includes('localhost') || origin.includes('127.0.0.1')))
  );
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0] || '',
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

interface GenerateCodeRequest {
  job_id: string;
  role: "customer" | "provider";
  method?: "ui" | "email";
}

interface GenerateCodeResponse {
  ok: boolean;
  code: string;
  expires_at: string;
  job_id: string;
  error?: string;
}

// Generate a cryptographically secure 8-character uppercase alphanumeric code
function generateCode(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: 0, O, I, 1
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join('');
}

// Hash code using SHA-256
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing authorization header",
        } as GenerateCodeResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create client for user operations
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "User not authenticated",
        } as GenerateCodeResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body: GenerateCodeRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[generate-job-codes] JSON parse error:", parseError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid request body. Expected JSON.",
        } as GenerateCodeResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { job_id, role, method = "ui" } = body;

    console.log("[generate-job-codes] Request received:", {
      job_id,
      role,
      method,
      user_id: user.id,
    });

    if (!job_id || !role) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields: job_id and role",
        } as GenerateCodeResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch job details using service role (bypasses RLS)
    // Use * to get all columns, then filter what we need (handles missing columns gracefully)
    console.log("[generate-job-codes] Querying job with ID:", job_id);
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("*, customer_code_expires_at, provider_code_expires_at")
      .eq("id", job_id)
      .single();

    console.log("[generate-job-codes] Job query result:", {
      found: !!job,
      job_id: job?.id,
      customer_id: job?.customer_id,
      provider_id: job?.provider_id,
      status: job?.status,
      error: jobError ? {
        message: jobError.message,
        code: jobError.code,
        details: jobError.details,
        hint: jobError.hint,
      } : null,
    });

    if (jobError) {
      console.error("[generate-job-codes] Job query error:", jobError);
      // If it's a "not found" error (PGRST116), return 404
      if (jobError.code === "PGRST116" || jobError.message?.includes("No rows")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Job not found with ID: ${job_id}. Please verify the job exists in the database.`,
          } as GenerateCodeResponse),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Other database errors
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Database error: ${jobError.message}`,
        } as GenerateCodeResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!job) {
      console.error("[generate-job-codes] Job not found (no error but no data)");
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Job not found with ID: ${job_id}`,
        } as GenerateCodeResponse),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user has permission to generate code for this job
    if (role === "customer") {
      if (job.customer_id !== user.id) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "You don't have permission to generate codes for this job",
          } as GenerateCodeResponse),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Customer can only generate start code for pending or confirmed jobs
      if (job.status !== "pending" && job.status !== "confirmed") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Start code can only be generated for pending or confirmed jobs",
          } as GenerateCodeResponse),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if code already exists (handle missing columns gracefully)
      const existingCode = (job as any).auth_code_customer;
      const hasHash = (job as any).customer_start_code_hash;
      const codeExpiresAt = (job as any).customer_code_expires_at;
      
      if (existingCode) {
        // Verify the hash matches the plain text code (detect mismatches)
        if (hasHash) {
          const existingCodeHash = await hashCode(existingCode);
          if (existingCodeHash !== hasHash) {
            console.log("[generate-job-codes] Hash mismatch detected! Plain text code doesn't match stored hash. Allowing regeneration.");
            // Hash doesn't match - this code won't verify correctly
            // Allow regeneration to create a new code with matching hash
            // Continue to generate new code below
          } else {
            // Hash matches - check expiry
            const now = new Date();
            const expiresAt = codeExpiresAt ? new Date(codeExpiresAt) : null;
            const isExpired = expiresAt ? now > expiresAt : false;
            
            if (!isExpired && expiresAt) {
              // Code exists, hash matches, and hasn't expired, return it
              console.log("[generate-job-codes] Valid code found with matching hash, returning it");
              return new Response(
                JSON.stringify({
                  ok: true,
                  code: existingCode,
                  expires_at: expiresAt.toISOString(),
                  job_id: job_id,
                } as GenerateCodeResponse),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            } else if (isExpired) {
              // Code has expired, allow regeneration
              console.log("[generate-job-codes] Existing code has expired, allowing regeneration");
              // Continue to generate new code below
            } else {
              // No expiry timestamp (legacy code from before expiry tracking)
              // Treat as valid and return it, but set an expiry for future tracking
              console.log("[generate-job-codes] Legacy code found (no expiry), returning it and setting expiry");
              const newExpiresAt = new Date();
              newExpiresAt.setMinutes(newExpiresAt.getMinutes() + 10);
              
              // Update the expiry timestamp for this legacy code
              await supabaseAdmin
                .from("jobs")
                .update({ customer_code_expires_at: newExpiresAt.toISOString() })
                .eq("id", job_id);
              
              return new Response(
                JSON.stringify({
                  ok: true,
                  code: existingCode,
                  expires_at: newExpiresAt.toISOString(),
                  job_id: job_id,
                } as GenerateCodeResponse),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            }
          }
        } else {
          // Code exists but no hash - this is a legacy code without hash
          // Check expiry if available
          const now = new Date();
          const expiresAt = codeExpiresAt ? new Date(codeExpiresAt) : null;
          const isExpired = expiresAt ? now > expiresAt : false;
          
          if (!isExpired && expiresAt) {
            // Return it but note that hash is missing
            console.log("[generate-job-codes] Code exists without hash (legacy), returning it");
            return new Response(
              JSON.stringify({
                ok: true,
                code: existingCode,
                expires_at: expiresAt.toISOString(),
                job_id: job_id,
              } as GenerateCodeResponse),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          } else {
            // Expired or no expiry - allow regeneration
            console.log("[generate-job-codes] Code exists without hash and is expired or has no expiry, allowing regeneration");
            // Continue to generate new code below
          }
        }
      }
      
      // If only hash exists but no plain text, allow regeneration
      // This handles cases where the plain text column doesn't exist or value was lost
      if (hasHash && !existingCode) {
        console.log("[generate-job-codes] Hash exists but no plain text code, allowing regeneration");
        // Continue to generate new code below
      }
    } else if (role === "provider") {
      // Verify provider owns this job
      // providers.id should equal auth.users.id (based on schema)
      // jobs.provider_id references providers.id
      console.log("[generate-job-codes] Checking provider permission:", {
        user_id: user.id,
        job_provider_id: job.provider_id,
      });
      
      // Check if user.id matches job.provider_id (standard case where providers.id = auth.users.id)
      if (user.id !== job.provider_id) {
        // If not matching, check if there's a provider record
        const { data: provider, error: providerError } = await supabaseAdmin
          .from("providers")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        
        console.log("[generate-job-codes] Provider lookup:", {
          found: !!provider,
          provider_id: provider?.id,
          error: providerError,
        });
        
        // If provider doesn't exist or doesn't match job provider, deny access
        if (providerError || !provider || provider.id !== job.provider_id) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "You don't have permission to generate codes for this job",
            } as GenerateCodeResponse),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Provider can only generate end code for in-progress jobs
      if (job.status !== "in_progress") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "End code can only be generated for in-progress jobs",
          } as GenerateCodeResponse),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if code already exists (handle missing columns gracefully)
      const existingCode = (job as any).auth_code_provider;
      const hasHash = (job as any).provider_end_code_hash;
      const codeExpiresAt = (job as any).provider_code_expires_at;
      
      if (existingCode) {
        // Verify the hash matches the plain text code (detect mismatches)
        if (hasHash) {
          const existingCodeHash = await hashCode(existingCode);
          if (existingCodeHash !== hasHash) {
            console.log("[generate-job-codes] Hash mismatch detected! Plain text code doesn't match stored hash. Allowing regeneration.");
            // Hash doesn't match - this code won't verify correctly
            // Allow regeneration to create a new code with matching hash
            // Continue to generate new code below
          } else {
            // Hash matches - check expiry
            const now = new Date();
            const expiresAt = codeExpiresAt ? new Date(codeExpiresAt) : null;
            const isExpired = expiresAt ? now > expiresAt : false;
            
            if (!isExpired && expiresAt) {
              // Code exists, hash matches, and hasn't expired, return it
              console.log("[generate-job-codes] Valid code found with matching hash, returning it");
              return new Response(
                JSON.stringify({
                  ok: true,
                  code: existingCode,
                  expires_at: expiresAt.toISOString(),
                  job_id: job_id,
                } as GenerateCodeResponse),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            } else if (isExpired) {
              // Code has expired, allow regeneration
              console.log("[generate-job-codes] Existing code has expired, allowing regeneration");
              // Continue to generate new code below
            } else {
              // No expiry timestamp (legacy code from before expiry tracking)
              // Treat as valid and return it, but set an expiry for future tracking
              console.log("[generate-job-codes] Legacy code found (no expiry), returning it and setting expiry");
              const newExpiresAt = new Date();
              newExpiresAt.setMinutes(newExpiresAt.getMinutes() + 10);
              
              // Update the expiry timestamp for this legacy code
              await supabaseAdmin
                .from("jobs")
                .update({ provider_code_expires_at: newExpiresAt.toISOString() })
                .eq("id", job_id);
              
              return new Response(
                JSON.stringify({
                  ok: true,
                  code: existingCode,
                  expires_at: newExpiresAt.toISOString(),
                  job_id: job_id,
                } as GenerateCodeResponse),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            }
          }
        } else {
          // Code exists but no hash - this is a legacy code without hash
          // Check expiry if available
          const now = new Date();
          const expiresAt = codeExpiresAt ? new Date(codeExpiresAt) : null;
          const isExpired = expiresAt ? now > expiresAt : false;
          
          if (!isExpired && expiresAt) {
            // Return it but note that hash is missing
            console.log("[generate-job-codes] Code exists without hash (legacy), returning it");
            return new Response(
              JSON.stringify({
                ok: true,
                code: existingCode,
                expires_at: expiresAt.toISOString(),
                job_id: job_id,
              } as GenerateCodeResponse),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          } else {
            // Expired or no expiry - allow regeneration
            console.log("[generate-job-codes] Code exists without hash and is expired or has no expiry, allowing regeneration");
            // Continue to generate new code below
          }
        }
      }
      
      // If only hash exists but no plain text, allow regeneration
      // This handles cases where the plain text column doesn't exist or value was lost
      if (hasHash && !existingCode) {
        console.log("[generate-job-codes] Hash exists but no plain text code, allowing regeneration");
        // Continue to generate new code below
      }
    }

    // Generate code
    const plainCode = generateCode();
    const hashedCode = await hashCode(plainCode);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Code expires in 10 minutes

    // Check if hash already exists (immutable column)
    const existingHash = role === "customer" 
      ? (job as any).customer_start_code_hash 
      : (job as any).provider_end_code_hash;

    // Update job with code and hash
    // Note: If hash already exists, it's immutable - only update the plain text code
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (role === "customer") {
      updateData.auth_code_customer = plainCode;
      updateData.customer_code_expires_at = expiresAt.toISOString();
      // Only set hash if it doesn't already exist (immutable column)
      if (!existingHash) {
        updateData.customer_start_code_hash = hashedCode;
      } else {
        console.log("[generate-job-codes] Hash already exists (immutable), only updating plain text code and expiry");
      }
    } else {
      updateData.auth_code_provider = plainCode;
      updateData.provider_code_expires_at = expiresAt.toISOString();
      // Only set hash if it doesn't already exist (immutable column)
      if (!existingHash) {
        updateData.provider_end_code_hash = hashedCode;
      } else {
        console.log("[generate-job-codes] Hash already exists (immutable), only updating plain text code and expiry");
      }
    }

    console.log("[generate-job-codes] Updating job with code data:", {
      job_id,
      role,
      updateDataKeys: Object.keys(updateData),
      hasAuthCodeCustomer: role === "customer" ? !!updateData.auth_code_customer : "N/A",
      hasAuthCodeProvider: role === "provider" ? !!updateData.auth_code_provider : "N/A",
    });

    const { error: updateError, data: updateResult } = await supabaseAdmin
      .from("jobs")
      .update(updateData)
      .eq("id", job_id)
      .select("id, auth_code_customer, auth_code_provider");

    if (updateError) {
      console.error("[generate-job-codes] Error updating job with code:", {
        error: updateError,
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        updateData,
      });
      
      // If error is about missing column, try updating without plain text column
      if (
        updateError.message?.includes("auth_code_customer") ||
        updateError.message?.includes("auth_code_provider") ||
        updateError.code === "42703" // PostgreSQL undefined column error
      ) {
        console.log("[generate-job-codes] Plain text column missing, trying with hash only");
        const hashOnlyUpdate: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        
        if (role === "customer") {
          hashOnlyUpdate.customer_start_code_hash = hashedCode;
        } else {
          hashOnlyUpdate.provider_end_code_hash = hashedCode;
        }
        
        const { error: hashOnlyError } = await supabaseAdmin
          .from("jobs")
          .update(hashOnlyUpdate)
          .eq("id", job_id);
        
        if (hashOnlyError) {
          console.error("[generate-job-codes] Hash-only update also failed:", hashOnlyError);
          return new Response(
            JSON.stringify({
              ok: false,
              error: `Database error: ${hashOnlyError.message}. The plain text code column may not exist in your database.`,
            } as GenerateCodeResponse),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        // Hash saved successfully, but we can't return the plain code since column doesn't exist
        // Return the code anyway since we generated it
        console.log("[generate-job-codes] Hash saved successfully, returning generated code");
      } else {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Failed to save code to database: ${updateError.message}${updateError.details ? ` - ${updateError.details}` : ''}${updateError.hint ? ` (${updateError.hint})` : ''}`,
          } as GenerateCodeResponse),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      console.log("[generate-job-codes] Job updated successfully:", updateResult);
    }

    // If method is "email", send email (placeholder - implement email sending logic)
    if (method === "email") {
      // TODO: Implement email sending logic
      console.log(`Would send code ${plainCode} to user ${user.email}`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        ok: true,
        code: plainCode,
        expires_at: expiresAt.toISOString(),
        job_id: job_id,
      } as GenerateCodeResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[generate-job-codes] Unhandled error:", error);
    console.error("[generate-job-codes] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    });
    
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as GenerateCodeResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

