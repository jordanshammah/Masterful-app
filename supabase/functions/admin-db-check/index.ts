/**
 * Admin Database Check Edge Function
 * 
 * Securely checks database state for customer_addresses table
 * Only accessible by admin users
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Get allowed origins from environment or use defaults
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean);
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;
  
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

interface AdminCheckRequest {
  action: "check_tables" | "check_schema" | "sync_schema";
}

interface AdminCheckResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `admin-check-${Date.now()}-${crypto.randomUUID().substring(0, 7)}`;

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header",
          timestamp: new Date().toISOString(),
        } as AdminCheckResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify user is authenticated and is admin
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error(`[${requestId}] Authentication failed:`, authError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
          timestamp: new Date().toISOString(),
        } as AdminCheckResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (rolesError || !roles) {
      console.error(`[${requestId}] Admin check failed for user ${user.id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Admin access required",
          timestamp: new Date().toISOString(),
        } as AdminCheckResponse),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log admin invocation
    console.log(`[${requestId}] Admin DB check invoked by user ${user.id}`);

    // Parse request body
    const body: AdminCheckRequest = await req.json().catch(() => ({ action: "check_tables" }));
    const { action } = body;

    let result: any = null;

    switch (action) {
      case "check_tables": {
        // Check for customer_address table and alternatives
        const tables = ["customer_address", "Customer_address", "customer_addresses"];
        const tableResults: Record<string, any> = {};

        for (const tableName of tables) {
          try {
            const { data, error } = await supabase
              .from(tableName)
              .select("id")
              .limit(1);

            tableResults[tableName] = {
              exists: !error,
              error: error?.message || null,
            };
          } catch (error: any) {
            tableResults[tableName] = {
              exists: false,
              error: error.message,
            };
          }
        }

        // Query information_schema for all customer/address related tables
        const { data: schemaData, error: schemaError } = await supabase.rpc(
          "exec_sql",
          {
            query: `
              SELECT table_schema, table_name 
              FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND (table_name ILIKE '%customer%' OR table_name ILIKE '%address%')
              ORDER BY table_name;
            `,
          }
        ).catch(() => ({ data: null, error: new Error("RPC not available") }));

        result = {
          tableChecks: tableResults,
          schemaQuery: schemaError ? { error: schemaError.message } : { data: schemaData },
        };
        break;
      }

      case "check_schema": {
        // Get detailed schema information for customer_address
        const { data: schemaData, error: schemaError } = await supabase.rpc(
          "exec_sql",
          {
            query: `
              SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
              FROM information_schema.columns
              WHERE table_schema = 'public' 
              AND table_name = 'customer_address'
              ORDER BY ordinal_position;
            `,
          }
        ).catch(() => ({ data: null, error: new Error("RPC not available") }));

        result = {
          schema: schemaError ? { error: schemaError.message } : { columns: schemaData },
        };
        break;
      }

      case "sync_schema": {
        // Create customer_addresses table if it doesn't exist
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.customer_addresses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            street TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            zip_code TEXT NOT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT customer_address_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE
          );

          -- Enable RLS
          ALTER TABLE public.customer_address ENABLE ROW LEVEL SECURITY;

          -- RLS Policies
          CREATE POLICY IF NOT EXISTS "Customers can view own addresses" 
            ON public.customer_address FOR SELECT 
            USING (auth.uid() = customer_id);

          CREATE POLICY IF NOT EXISTS "Customers can insert own addresses" 
            ON public.customer_address FOR INSERT 
            WITH CHECK (auth.uid() = customer_id);

          CREATE POLICY IF NOT EXISTS "Customers can update own addresses" 
            ON public.customer_address FOR UPDATE 
            USING (auth.uid() = customer_id);

          CREATE POLICY IF NOT EXISTS "Customers can delete own addresses" 
            ON public.customer_address FOR DELETE 
            USING (auth.uid() = customer_id);

          CREATE POLICY IF NOT EXISTS "Providers can view customer addresses for their jobs" 
            ON public.customer_address FOR SELECT 
            USING (
              EXISTS (
                SELECT 1 FROM public.jobs 
                WHERE jobs.customer_id = customer_address.customer_id 
                AND jobs.provider_id = auth.uid()
              )
            );

          -- Create index
          CREATE INDEX IF NOT EXISTS idx_customer_address_customer_id 
            ON public.customer_address(customer_id);

          -- Add update trigger
          CREATE TRIGGER IF NOT EXISTS update_customer_address_updated_at 
            BEFORE UPDATE ON public.customer_address 
            FOR EACH ROW 
            EXECUTE FUNCTION public.update_updated_at_column();
        `;

        const { data: execData, error: execError } = await supabase.rpc(
          "exec_sql",
          { query: createTableSQL }
        ).catch(() => ({ data: null, error: new Error("RPC not available - use Supabase SQL editor") }));

        result = {
          created: !execError,
          error: execError?.message || null,
          note: execError ? "Please run the SQL in Supabase SQL editor" : "Table created successfully",
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown action: ${action}`,
            timestamp: new Date().toISOString(),
          } as AdminCheckResponse),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Admin check completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      } as AdminCheckResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      } as AdminCheckResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});















