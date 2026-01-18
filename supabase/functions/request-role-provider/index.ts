// Edge Function: request-role-provider
// Accepts POST { role: 'provider' } with Authorization: Bearer <access_token>
// Validates token using Supabase Auth to ensure signature verification
// Performs upsert to public.user_roles via Supabase REST using SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RequestBody {
  role?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // SECURITY FIX: Verify JWT signature using Supabase Auth instead of just parsing
  // This ensures the token is valid and hasn't been tampered with
  const supabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: { Authorization: auth },
    },
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    console.error('[request-role-provider] Token verification failed:', authError?.message);
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const user_id = user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (body.role !== 'provider') {
    return new Response(
      JSON.stringify({ error: 'Only role "provider" is allowed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Upsert user_roles via PostgREST
  const url = `${SUPABASE_URL}/rest/v1/user_roles`;
  const payload = {
    user_id,
    role: 'provider'
  };

  try {
    const res = await fetch(url + '?on_conflict=user_id', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[request-role-provider] PostgREST error:', text);
      return new Response(
        JSON.stringify({ error: 'Failed to upsert role', detail: text }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optionally create providers row here (commented)
    // await fetch(`${SUPABASE_URL}/rest/v1/providers`, {...})

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[request-role-provider] Request failed:', err);
    return new Response(
      JSON.stringify({ error: 'Request failed', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});





