/**
 * Shared Security Utilities for Edge Functions
 * Rate limiting, validation, CORS, signature verification
 */

// ============================================================================
// CORS Configuration
// ============================================================================

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean);
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];

/**
 * Check if an origin is a local network IP address
 */
function isLocalNetworkIP(origin: string): boolean {
  // Check for common local network IP ranges
  const localIPPatterns = [
    /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0 - 172.31.255.255
    /^http:\/\/192\.168\./,                      // 192.168.0.0 - 192.168.255.255
    /^http:\/\/10\./,                            // 10.0.0.0 - 10.255.255.255
    /^http:\/\/127\./,                           // 127.0.0.0 - 127.255.255.255
    /^http:\/\/169\.254\./,                      // 169.254.0.0 - 169.254.255.255 (link-local)
  ];
  
  return localIPPatterns.some(pattern => pattern.test(origin));
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // If ALLOWED_ORIGINS is explicitly set, use it; otherwise be permissive
  const allowedOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;
  
  // Check if origin is explicitly allowed
  const isExplicitlyAllowed = origin && allowedOrigins.includes(origin);
  
  // Allow localhost in development (when ALLOWED_ORIGINS is not set)
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') ||
    origin.includes('::1')
  );
  
  // Allow local network IPs (HTTP) for development/testing
  const isLocalNetwork = origin && ALLOWED_ORIGINS.length === 0 && isLocalNetworkIP(origin);
  
  // In production, allow any HTTPS origin if ALLOWED_ORIGINS is not explicitly set
  // This allows the app to work from any deployed URL
  const isProductionHttps = origin && 
    ALLOWED_ORIGINS.length === 0 && 
    origin.startsWith('https://') &&
    !isLocalhost &&
    !isLocalNetwork;
  
  // Determine if origin should be allowed
  const isAllowed = isExplicitlyAllowed || (ALLOWED_ORIGINS.length === 0 && (isLocalhost || isLocalNetwork || isProductionHttps));
  
  // Use the origin if allowed, otherwise use first allowed origin or wildcard
  const allowedOrigin = isAllowed ? origin! : (allowedOrigins.length > 0 ? allowedOrigins[0] : '*');
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ============================================================================
// Rate Limiting (In-Memory with KV Store fallback)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting (resets on function cold start)
// For production, use Deno KV or Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed
  windowMs: number;     // Time window in milliseconds
  keyPrefix?: string;   // Prefix for rate limit key
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

/**
 * Check rate limit for a given identifier (IP, user ID, etc.)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.keyPrefix || 'rl'}:${identifier}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Clean up expired entry
  if (entry && entry.resetAt <= now) {
    rateLimitStore.delete(key);
    entry = undefined;
  }
  
  // First request in window
  if (!entry) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }
  
  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

// ============================================================================
// Input Validation Helpers
// ============================================================================

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function isValidEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

export function isValidPhoneKE(str: string): boolean {
  // Kenyan phone: 07XXXXXXXX, 01XXXXXXXX, +254XXXXXXXXX, 254XXXXXXXXX
  const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
  return phoneRegex.test(str.replace(/\s/g, ''));
}

export function sanitizeString(str: string, maxLength = 500): string {
  return str
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

// ============================================================================
// Paystack Signature Verification
// ============================================================================

/**
 * Verify Paystack webhook signature
 * CRITICAL: Must verify all webhooks before processing
 */
export async function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(computedSignature, signature);
  } catch (error) {
    console.error('[security] Signature verification failed:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// ============================================================================
// Request ID Generation
// ============================================================================

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().substring(0, 8)}`;
}

// ============================================================================
// Error Response Helpers
// ============================================================================

export function errorResponse(
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

export function successResponse(
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

// ============================================================================
// Environment Variable Validation
// ============================================================================

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnvWithDefault(name: string, defaultValue: string): string {
  return Deno.env.get(name) || defaultValue;
}
