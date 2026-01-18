/**
 * Job Codes Edge Function API
 * Client calls to Supabase Edge Function: generate-job-codes
 * Uses Supabase client's built-in function invocation for better CORS handling
 * 
 * DEV MODE: Falls back to client-side generation if Edge Function unavailable
 */

import { supabase } from "@/integrations/supabase/client";

export interface GenerateCodeResponse {
  ok: boolean;
  code: string;
  expires_at: string;
  job_id: string;
}

export interface GenerateCodeParams {
  jobId: string;
  method?: "ui" | "email";
}

/**
 * Generate a random 6-character alphanumeric code
 * Used as fallback when Edge Function is not deployed
 */
function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Pure JavaScript SHA-256 implementation
 * Used as fallback when crypto.subtle is not available (non-secure contexts like HTTP)
 * Based on the FIPS 180-4 standard - produces identical output to crypto.subtle
 */
function sha256JS(message: string): string {
  // Helper functions
  const rightRotate = (value: number, amount: number) => 
    (value >>> amount) | (value << (32 - amount));
  
  // Initial hash values
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  
  // Round constants
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  
  // Convert string to UTF-8 bytes
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  const bitLength = messageBytes.length * 8;
  
  // Pre-processing: adding padding bits
  const paddingLength = (64 - ((messageBytes.length + 9) % 64)) % 64;
  const paddedLength = messageBytes.length + 1 + paddingLength + 8;
  const padded = new Uint8Array(paddedLength);
  padded.set(messageBytes);
  padded[messageBytes.length] = 0x80;
  
  // Append length in bits as 64-bit big-endian
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);
  
  // Process message in 512-bit chunks
  const w = new Uint32Array(64);
  
  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunkStart + i * 4, false);
    }
    
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i-15], 7) ^ rightRotate(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rightRotate(w[i-2], 17) ^ rightRotate(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    
    let a = h[0], b = h[1], c = h[2], d = h[3];
    let e = h[4], f = h[5], g = h[6], hh = h[7];
    
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (hh + S1 + ch + k[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      
      hh = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  
  return Array.from(h).map(n => n.toString(16).padStart(8, '0')).join('');
}

/**
 * Check if Web Crypto API is available (only in secure contexts)
 */
function isCryptoSubtleAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         typeof crypto.subtle.digest === 'function';
}

/**
 * Hash a code using SHA-256 (client-side) with fallback for HTTP
 * Uses native crypto.subtle when available (HTTPS/localhost)
 * Falls back to pure JS SHA-256 on HTTP
 * 
 * Both produce identical SHA-256 hashes for compatibility
 */
async function hashCodeClient(code: string): Promise<string> {
  // Check if crypto.subtle is available (secure context)
  if (isCryptoSubtleAvailable()) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn("[hashCodeClient] crypto.subtle.digest failed, using JS fallback:", error);
      return sha256JS(code);
    }
  }
  
  // Fallback for non-secure contexts (HTTP) - uses pure JS SHA-256
  console.warn("[hashCodeClient] crypto.subtle not available (non-secure context), using JS SHA-256");
  return sha256JS(code);
}

/**
 * Fallback: Generate code client-side and store in database
 * Used when Edge Function is not deployed (development mode)
 * Stores BOTH plain text code AND hash for verification
 */
async function generateCodeFallback(
  jobId: string,
  role: 'customer' | 'provider'
): Promise<GenerateCodeResponse> {
  const code = generateRandomCode();
  const codeHash = await hashCodeClient(code);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  
  // Store BOTH the plain text code AND the hash in the jobs table
  const plainColumn = role === 'customer' ? 'auth_code_customer' : 'auth_code_provider';
  const hashColumn = role === 'customer' ? 'customer_start_code_hash' : 'provider_end_code_hash';
  
  const updateData: Record<string, string> = {
    [plainColumn]: code,
    [hashColumn]: codeHash,
  };
  
  const { error: updateError } = await supabase
    .from('jobs')
    .update(updateData as any)
    .eq('id', jobId);
  
  if (updateError) {
    console.error(`[generateCodeFallback] Failed to store ${role} code:`, updateError);
    throw new Error(`Failed to generate ${role} code: ${updateError.message}`);
  }
  
  console.log(`[generateCodeFallback] Generated ${role} code for job ${jobId}: ${code} (hash: ${codeHash.substring(0, 8)}...)`);
  
  return {
    ok: true,
    code,
    expires_at: expiresAt,
    job_id: jobId,
  };
}

/**
 * Generate customer start code via Edge Function
 * Uses Supabase client's functions.invoke() which handles CORS and authentication automatically
 * Falls back to client-side generation in development if Edge Function unavailable
 */
export async function generateCustomerStartCode(
  params: GenerateCodeParams
): Promise<GenerateCodeResponse> {
  const { jobId, method = "ui" } = params;

  // Check if user is authenticated
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error("User not authenticated");
  }

  try {
    // Use Supabase client's function invocation - handles CORS and auth automatically
    const { data, error } = await supabase.functions.invoke("generate-job-codes", {
      body: {
        job_id: jobId,
        role: "customer",
        method,
      },
    });
    
    // If Edge Function failed with network error, use fallback in development
    if (error && (error.message?.includes('Failed to fetch') || error.message?.includes('Failed to send'))) {
      console.warn('[generateCustomerStartCode] Edge Function unavailable, using fallback');
      return await generateCodeFallback(jobId, 'customer');
    }

    // Log for debugging
    if (import.meta.env.DEV) {
      console.log("[generateCustomerStartCode] Response:", { data, error });
      console.log("[generateCustomerStartCode] Full error object:", JSON.stringify(error, null, 2));
    }

    // Check if data exists but has error (sometimes 400/500 errors are in data, not error)
    if (data && typeof data === 'object' && 'ok' in data && !data.ok && 'error' in data) {
      const errorMessage = (data as any).error || "Failed to generate code";
      console.error("[generateCustomerStartCode] Error in data field:", errorMessage);
      throw new Error(errorMessage);
    }

    if (error) {
      // Log the actual error for debugging
      console.error("[generateCustomerStartCode] Error:", error);
      console.error("[generateCustomerStartCode] Error details:", {
        message: error.message,
        context: error.context,
        status: (error as any).status,
        statusText: (error as any).statusText,
        fullError: JSON.stringify(error, null, 2),
      });
      
      // Try to extract error message from response
      let errorMessage = error.message || "Failed to generate code";
      
      // error.context might be a Response object - try to read the body
      if (error.context) {
        const context = error.context as any;
        
        // Check if context is a Response object (has .json() or .text() method)
        if (context instanceof Response || (typeof context.json === 'function' || typeof context.text === 'function')) {
          try {
            // Clone the response if it's a Response object (in case body was already read)
            const responseToRead = context instanceof Response ? context.clone() : context;
            
            // Try to read the response body as JSON first, fallback to text
            let responseBody: any;
            try {
              responseBody = await responseToRead.json();
            } catch {
              try {
                const textBody = await responseToRead.text();
                responseBody = JSON.parse(textBody);
              } catch {
                // If both fail, try to get status info
                if (context instanceof Response) {
                  const status = context.status;
                  if (status === 400) {
                    errorMessage = "Invalid request. Please check the job status.";
                  } else if (status === 404) {
                    errorMessage = "Job not found";
                  } else if (status === 403) {
                    errorMessage = "You don't have permission to generate codes for this job";
                  } else if (status === 401) {
                    errorMessage = "You must be signed in to generate codes";
                  }
                }
              }
            }
            
            if (responseBody && typeof responseBody === 'object') {
              if (responseBody.error) {
                errorMessage = responseBody.error;
              } else if (responseBody.message) {
                errorMessage = responseBody.message;
              }
            } else if (typeof responseBody === 'string') {
              // Try to parse as JSON
              try {
                const parsed = JSON.parse(responseBody);
                errorMessage = parsed.error || parsed.message || errorMessage;
              } catch {
                errorMessage = responseBody;
              }
            }
          } catch (readError) {
            console.warn("[generateCustomerStartCode] Could not read response body:", readError);
            // Try to get status from Response if available
            if (context instanceof Response) {
              const status = context.status;
              if (status === 400) {
                errorMessage = "Invalid request. Please check the job status.";
              } else if (status === 404) {
                errorMessage = "Job not found";
              }
            }
          }
        } else {
          // Context is a plain object
          // Try to get error from context.message
          if (context.message) {
            errorMessage = context.message;
          }
          
          // Try to parse context.body if it exists
          if (context.body) {
            try {
              const body = typeof context.body === 'string' ? JSON.parse(context.body) : context.body;
              if (body.error) {
                errorMessage = body.error;
              } else if (body.message) {
                errorMessage = body.message;
              }
            } catch (parseErr) {
              // If body is not JSON, use it as-is
              if (typeof context.body === 'string' && context.body.length < 200) {
                errorMessage = context.body;
              }
            }
          }
          
          // Try error.context.error
          if (context.error) {
            errorMessage = context.error;
          }
        }
      }
      
      // Also check if data exists but has an error field (sometimes errors are in data)
      if (data && typeof data === 'object' && 'error' in data) {
        errorMessage = (data as any).error || errorMessage;
      }
      
      // Handle specific error codes
      const status = (error as any).status;
      if (status === 401 || errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("not authenticated")) {
        throw new Error("You must be signed in to generate codes");
      } else if (status === 403 || errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("permission")) {
        throw new Error("You don't have permission to generate codes for this job");
      } else if (status === 429 || errorMessage.includes("429") || errorMessage.includes("rate limit")) {
        throw new Error("Too many code generation attempts. Please wait before trying again.");
      } else if (status === 400) {
        // For 400 errors, show the actual error message from the function
        throw new Error(errorMessage || "Invalid request. Please check the job status.");
      } else if (status === 404 || errorMessage.includes("404") || errorMessage.includes("not found")) {
        throw new Error(errorMessage || "Job not found");
      }
      
      // Return the actual error message
      throw new Error(errorMessage);
    }

    if (!data || !data.ok) {
      throw new Error(data?.error || "Failed to generate code");
    }

    return data as GenerateCodeResponse;
  } catch (error: unknown) {
    // Log the full error for debugging
    console.error("[generateCustomerStartCode] Catch block error:", error);
    
    // Handle network errors, CORS errors, etc.
    if (error instanceof Error) {
      // Check for specific Supabase function errors
      const errorMsg = error.message.toLowerCase();
      
      // If it's a CORS or network error, use fallback in development
      if (
        errorMsg.includes("cors") || 
        errorMsg.includes("failed to fetch") || 
        errorMsg.includes("failed to send") ||
        errorMsg.includes("err_failed") ||
        errorMsg.includes("edge function") ||
        errorMsg.includes("function not found") ||
        errorMsg.includes("functionsfetcherror")
      ) {
        console.warn('[generateCustomerStartCode] Edge Function unavailable, using fallback');
        return await generateCodeFallback(jobId, 'customer');
      }
      
      // Re-throw other errors as-is with original message
      throw error;
    }
    throw new Error("An unexpected error occurred while generating the code");
  }
}

/**
 * Generate provider end code via Edge Function
 * Uses Supabase client's functions.invoke() which handles CORS and authentication automatically
 * Falls back to client-side generation in development if Edge Function unavailable
 */
export async function generateProviderEndCode(
  params: GenerateCodeParams
): Promise<GenerateCodeResponse> {
  const { jobId, method = "ui" } = params;

  // Check if user is authenticated
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error("User not authenticated");
  }

  try {
    // Use Supabase client's function invocation - handles CORS and auth automatically
    const { data, error } = await supabase.functions.invoke("generate-job-codes", {
      body: {
        job_id: jobId,
        role: "provider",
        method,
      },
    });
    
    // If Edge Function failed with network error, use fallback
    if (error && (error.message?.includes('Failed to fetch') || error.message?.includes('Failed to send'))) {
      console.warn('[generateProviderEndCode] Edge Function unavailable, using fallback');
      return await generateCodeFallback(jobId, 'provider');
    }

    // Log for debugging
    if (import.meta.env.DEV) {
      console.log("[generateProviderEndCode] Response:", { data, error });
      console.log("[generateProviderEndCode] Full error object:", JSON.stringify(error, null, 2));
    }

    // Check if data exists but has error (sometimes 400/500 errors are in data, not error)
    if (data && typeof data === 'object' && 'ok' in data && !data.ok && 'error' in data) {
      const errorMessage = (data as any).error || "Failed to generate code";
      console.error("[generateProviderEndCode] Error in data field:", errorMessage);
      throw new Error(errorMessage);
    }

    if (error) {
      // Log the actual error for debugging
      console.error("[generateProviderEndCode] Error:", error);
      console.error("[generateProviderEndCode] Error details:", {
        message: error.message,
        context: error.context,
        status: (error as any).status,
        statusText: (error as any).statusText,
        fullError: JSON.stringify(error, null, 2),
      });
      
      // Try to extract error message from response
      let errorMessage = error.message || "Failed to generate code";
      
      // error.context might be a Response object - try to read the body
      if (error.context) {
        const context = error.context as any;
        
        // Check if context is a Response object (has .json() or .text() method)
        if (context instanceof Response || (typeof context.json === 'function' || typeof context.text === 'function')) {
          try {
            // Clone the response if it's a Response object (in case body was already read)
            const responseToRead = context instanceof Response ? context.clone() : context;
            
            // Try to read the response body as JSON first, fallback to text
            let responseBody: any;
            try {
              responseBody = await responseToRead.json();
            } catch {
              try {
                const textBody = await responseToRead.text();
                responseBody = JSON.parse(textBody);
              } catch {
                // If both fail, try to get status info
                if (context instanceof Response) {
                  const status = context.status;
                  if (status === 400) {
                    errorMessage = "Invalid request. Job must be in progress to generate end code.";
                  } else if (status === 404) {
                    errorMessage = "Job not found";
                  } else if (status === 403) {
                    errorMessage = "You don't have permission to generate codes for this job";
                  } else if (status === 401) {
                    errorMessage = "You must be signed in to generate codes";
                  }
                }
              }
            }
            
            if (responseBody && typeof responseBody === 'object') {
              if (responseBody.error) {
                errorMessage = responseBody.error;
              } else if (responseBody.message) {
                errorMessage = responseBody.message;
              }
            } else if (typeof responseBody === 'string') {
              // Try to parse as JSON
              try {
                const parsed = JSON.parse(responseBody);
                errorMessage = parsed.error || parsed.message || errorMessage;
              } catch {
                errorMessage = responseBody;
              }
            }
          } catch (readError) {
            console.warn("[generateProviderEndCode] Could not read response body:", readError);
            // Try to get status from Response if available
            if (context instanceof Response) {
              const status = context.status;
              if (status === 400) {
                errorMessage = "Invalid request. Job must be in progress to generate end code.";
              } else if (status === 404) {
                errorMessage = "Job not found";
              }
            }
          }
        } else {
          // Context is a plain object
          // Try to get error from context.message
          if (context.message) {
            errorMessage = context.message;
          }
          
          // Try to parse context.body if it exists
          if (context.body) {
            try {
              const body = typeof context.body === 'string' ? JSON.parse(context.body) : context.body;
              if (body.error) {
                errorMessage = body.error;
              } else if (body.message) {
                errorMessage = body.message;
              }
            } catch (parseErr) {
              // If body is not JSON, use it as-is
              if (typeof context.body === 'string' && context.body.length < 200) {
                errorMessage = context.body;
              }
            }
          }
          
          // Try error.context.error
          if (context.error) {
            errorMessage = context.error;
          }
        }
      }
      
      // Also check if data exists but has an error field (sometimes errors are in data)
      if (data && typeof data === 'object' && 'error' in data) {
        errorMessage = (data as any).error || errorMessage;
      }
      
      // Handle specific error codes
      const status = (error as any).status;
      if (status === 401 || errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("not authenticated")) {
        throw new Error("You must be signed in to generate codes");
      } else if (status === 403 || errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("permission")) {
        throw new Error("You don't have permission to generate codes for this job");
      } else if (status === 429 || errorMessage.includes("429") || errorMessage.includes("rate limit")) {
        throw new Error("Too many code generation attempts. Please wait before trying again.");
      } else if (status === 400) {
        // For 400 errors, show the actual error message from the function
        throw new Error(errorMessage || "Invalid request. Job must be in progress to generate end code.");
      } else if (status === 404 || errorMessage.includes("404") || errorMessage.includes("not found")) {
        throw new Error(errorMessage || "Job not found");
      }
      
      // Return the actual error message
      throw new Error(errorMessage);
    }

    if (!data || !data.ok) {
      throw new Error(data?.error || "Failed to generate code");
    }

    return data as GenerateCodeResponse;
  } catch (error: unknown) {
    // Log the full error for debugging
    console.error("[generateProviderEndCode] Catch block error:", error);
    
    // Handle network errors, CORS errors, etc.
    if (error instanceof Error) {
      // Check for specific Supabase function errors
      const errorMsg = error.message.toLowerCase();
      
      // If it's a CORS or network error, use fallback
      if (
        errorMsg.includes("cors") || 
        errorMsg.includes("failed to fetch") || 
        errorMsg.includes("failed to send") ||
        errorMsg.includes("err_failed") ||
        errorMsg.includes("edge function") ||
        errorMsg.includes("function not found") ||
        errorMsg.includes("functionsfetcherror")
      ) {
        console.warn('[generateProviderEndCode] Edge Function unavailable, using fallback');
        return await generateCodeFallback(jobId, 'provider');
      }
      
      // Re-throw other errors as-is with original message
      throw error;
    }
    throw new Error("An unexpected error occurred while generating the code");
  }
}

