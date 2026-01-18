/**
 * Quote-Based Pay-After-Service Pricing API
 * Implements secure quote submission, acceptance, handshake codes, and payment processing
 */

import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import type { 
  JobWithDetails, 
  QuoteSubmission, 
  QuoteAcceptance, 
  HandshakeCode, 
  PaymentSubmission 
} from "@/types/pro-dashboard";

// Validation schemas
const quoteSubmissionSchema = z.object({
  jobId: z.string().uuid(),
  quoteTotal: z.number().min(0),
  quoteLabor: z.number().min(0).optional(),
  quoteMaterials: z.number().min(0).optional(),
  quoteBreakdown: z.string().max(2000).optional(),
});

const quoteAcceptanceSchema = z.object({
  jobId: z.string().uuid(),
  accepted: z.boolean(),
});

const paymentSubmissionSchema = z.object({
  jobId: z.string().uuid(),
  paymentAmount: z.number().min(0),
  paymentTip: z.number().min(0).optional(),
  paymentMethod: z.enum(['mpesa', 'card', 'cash']),
  paymentReference: z.string().optional(),
  partialPaymentReason: z.string().max(500).optional(),
});

/**
 * Helper function to get provider's table ID from auth user ID
 * Schema: providers.user_id -> auth.users.id, jobs.provider_id -> providers.id
 */
async function getProviderTableId(authUserId: string): Promise<string | null> {
  // First, try to find provider by user_id field (providers.user_id -> auth.users.id)
  // Note: Using 'as any' because user_id column may not be in generated types yet
  const { data: providerByUserId } = await (supabase
    .from("providers")
    .select("id, user_id") as any)
    .eq("user_id", authUserId)
    .maybeSingle();
  
  if (providerByUserId) {
    return (providerByUserId as any).id;
  }
  
  // Fallback: check if providers.id = authUserId (legacy schema)
  const { data: providerById } = await supabase
    .from("providers")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  
  if (providerById) {
    return providerById.id;
  }
  
  return null;
}

// ============================================================================
// QUOTE SUBMISSION & ACCEPTANCE API
// ============================================================================

export const quotesApi = {
  /**
   * Provider submits a quote after on-site assessment
   * Quote is locked after submission and cannot be edited
   */
  submitQuote: async (params: QuoteSubmission): Promise<JobWithDetails> => {
    const validated = quoteSubmissionSchema.parse(params);

    // Fetch job to verify status and check if provider owns it
    const { data: job, error: fetchError } = await supabase
      .from("jobs")
      .select("id, provider_id, status, quote_locked, quote_submitted_at")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !job) {
      throw new Error("Job not found");
    }

    // Verify provider owns this job
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get provider's table ID from auth user ID
    const providerTableId = await getProviderTableId(user.id);
    const jobProviderId = (job as any).provider_id;
    
    if (import.meta.env.DEV) {
      console.log("[quotesApi.submitQuote] Auth check:", {
        authUserId: user.id,
        providerTableId: providerTableId,
        jobProviderId: jobProviderId,
        match: providerTableId === jobProviderId,
      });
    }

    // Verify provider owns this job
    if (!providerTableId || providerTableId !== jobProviderId) {
      throw new Error("Unauthorized: You don't own this job");
    }

    // Check if quote already submitted and locked
    if ((job as any).quote_locked) {
      throw new Error("Quote has already been submitted and cannot be edited");
    }

    // Validate job status (should be confirmed/pending)
    if (!['pending', 'confirmed'].includes((job as any).status)) {
      throw new Error(`Cannot submit quote for job with status: ${(job as any).status}`);
    }

    // Submit quote
    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update({
        quote_total: validated.quoteTotal,
        quote_labor: validated.quoteLabor,
        quote_materials: validated.quoteMaterials,
        quote_breakdown: validated.quoteBreakdown,
        quote_submitted_at: new Date().toISOString(),
        // quote_locked will be set to true by trigger
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", validated.jobId)
      .select()
      .single();

    if (updateError) {
      console.error("[quotesApi.submitQuote] Error:", updateError);
      throw new Error(`Failed to submit quote: ${updateError.message}`);
    }

    if (!updatedJob) {
      throw new Error("Failed to submit quote");
    }

    if (import.meta.env.DEV) {
      console.log("[quotesApi.submitQuote] Quote submitted:", {
        jobId: validated.jobId,
        quoteTotal: validated.quoteTotal,
      });
    }

    return updatedJob as JobWithDetails;
  },

  /**
   * Customer accepts or rejects the provider's quote
   * Accepting generates start codes for handshake
   */
  acceptQuote: async (params: QuoteAcceptance): Promise<JobWithDetails> => {
    const validated = quoteAcceptanceSchema.parse(params);

    // Fetch job to verify status and check if customer owns it
    const { data: job, error: fetchError } = await supabase
      .from("jobs")
      .select("id, customer_id, status, quote_submitted_at, quote_accepted")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !job) {
      throw new Error("Job not found");
    }

    // Verify customer owns this job
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== (job as any).customer_id) {
      throw new Error("Unauthorized: You don't own this job");
    }

    // Check if quote has been submitted
    if (!(job as any).quote_submitted_at) {
      throw new Error("No quote has been submitted yet");
    }

    // Check if quote already accepted
    if ((job as any).quote_accepted) {
      throw new Error("Quote has already been accepted");
    }

    // Update quote acceptance status
    const updateData: any = {
      quote_accepted: validated.accepted,
      quote_accepted_at: validated.accepted ? new Date().toISOString() : null,
      status: validated.accepted ? 'confirmed' : 'cancelled',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", validated.jobId)
      .select()
      .single();

    if (updateError) {
      console.error("[quotesApi.acceptQuote] Error:", updateError);
      throw new Error(`Failed to ${validated.accepted ? 'accept' : 'reject'} quote: ${updateError.message}`);
    }

    if (!updatedJob) {
      throw new Error(`Failed to ${validated.accepted ? 'accept' : 'reject'} quote`);
    }

    if (import.meta.env.DEV) {
      console.log("[quotesApi.acceptQuote] Quote response:", {
        jobId: validated.jobId,
        accepted: validated.accepted,
      });
    }

    return updatedJob as JobWithDetails;
  },

  /**
   * Get quote status for a job
   */
  getQuoteStatus: async (jobId: string): Promise<{
    submitted: boolean;
    accepted: boolean;
    locked: boolean;
    quote?: {
      total: number;
      labor?: number;
      materials?: number;
      breakdown?: string;
      submittedAt: string;
      acceptedAt?: string;
    };
  }> => {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("quote_total, quote_labor, quote_materials, quote_breakdown, quote_submitted_at, quote_accepted, quote_accepted_at, quote_locked")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      throw new Error("Job not found");
    }

    const j = job as any;

    return {
      submitted: !!j.quote_submitted_at,
      accepted: !!j.quote_accepted,
      locked: !!j.quote_locked,
      quote: j.quote_submitted_at ? {
        total: j.quote_total,
        labor: j.quote_labor,
        materials: j.quote_materials,
        breakdown: j.quote_breakdown,
        submittedAt: j.quote_submitted_at,
        acceptedAt: j.quote_accepted_at,
      } : undefined,
    };
  },
};

// ============================================================================
// HANDSHAKE CODE API (Start & End Codes)
// ============================================================================

export const handshakeApi = {
  /**
   * Generate start code after quote acceptance
   * Only visible to customer - given to provider on arrival
   */
  generateStartCode: async (jobId: string): Promise<HandshakeCode> => {
    const { data, error } = await supabase
      .rpc('generate_start_code' as any, { job_id_param: jobId });

    if (error) {
      console.error("[handshakeApi.generateStartCode] Error:", error);
      throw new Error(`Failed to generate start code: ${error.message}`);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to generate start code");
    }

    const result = data[0];

    if (import.meta.env.DEV) {
      console.log("[handshakeApi.generateStartCode] Code generated:", {
        jobId,
        code: result.start_code,
      });
    }

    return {
      code: result.start_code,
    };
  },

  /**
   * Provider verifies start code to begin work
   * Marks job as in_progress
   */
  verifyStartCode: async (jobId: string, code: string): Promise<boolean> => {
    const { data, error } = await supabase
      .rpc('verify_start_code' as any, { 
        job_id_param: jobId, 
        code_param: code.toUpperCase() 
      });

    if (error) {
      console.error("[handshakeApi.verifyStartCode] Error:", error);
      throw new Error(`Failed to verify start code: ${error.message}`);
    }

    if (import.meta.env.DEV) {
      console.log("[handshakeApi.verifyStartCode] Code verified:", {
        jobId,
        valid: data,
      });
    }

    return data === true;
  },

  /**
   * Generate end code after provider completes work
   * Only visible to provider - given to customer after completion
   */
  generateEndCode: async (jobId: string): Promise<HandshakeCode> => {
    const { data, error } = await supabase
      .rpc('generate_end_code' as any, { job_id_param: jobId });

    if (error) {
      console.error("[handshakeApi.generateEndCode] Error:", error);
      throw new Error(`Failed to generate end code: ${error.message}`);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to generate end code");
    }

    const result = data[0];

    if (import.meta.env.DEV) {
      console.log("[handshakeApi.generateEndCode] Code generated:", {
        jobId,
        code: result.end_code,
      });
    }

    return {
      code: result.end_code,
    };
  },

  /**
   * Customer verifies end code after job completion
   * Unlocks payment flow
   */
  verifyEndCode: async (jobId: string, code: string): Promise<boolean> => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'quote-pricing.ts:371',message:'verifyEndCode API entry',data:{jobId,codeLength:code.length,codeUpper:code.toUpperCase()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    const { data, error } = await supabase
      .rpc('verify_end_code' as any, { 
        job_id_param: jobId, 
        code_param: code.toUpperCase() 
      });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'quote-pricing.ts:377',message:'verifyEndCode RPC response',data:{hasError:!!error,errorMessage:error?.message,dataValue:data,dataType:typeof data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'quote-pricing.ts:384',message:'verifyEndCode error',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error("[handshakeApi.verifyEndCode] Error:", error);
      // Provide user-friendly error messages
      if (error.message?.includes("Job must be started")) {
        throw new Error("The job must be started by the provider before you can verify the completion code. Please wait for the provider to start the job.");
      }
      throw new Error(`Failed to verify end code: ${error.message}`);
    }

    if (import.meta.env.DEV) {
      console.log("[handshakeApi.verifyEndCode] Code verified:", {
        jobId,
        valid: data,
      });
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'quote-pricing.ts:390',message:'verifyEndCode returning result',data:{data,dataEqualsTrue:data === true,returnValue:data === true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    return data === true;
  },

  /**
   * Get handshake status for a job
   */
  getHandshakeStatus: async (jobId: string): Promise<{
    startCodeGenerated: boolean;
    startCodeUsed: boolean;
    endCodeGenerated: boolean;
    endCodeUsed: boolean;
  }> => {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("start_code, start_code_used, end_code, end_code_used")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      throw new Error("Job not found");
    }

    const j = job as any;

    return {
      startCodeGenerated: !!j.start_code,
      startCodeUsed: !!j.start_code_used,
      endCodeGenerated: !!j.end_code,
      endCodeUsed: !!j.end_code_used,
    };
  },
};

// ============================================================================
// PAYMENT API
// ============================================================================

export const paymentApi = {
  /**
   * Process payment after job completion
   * Supports full payment, partial payment, and tips
   */
  submitPayment: async (params: PaymentSubmission): Promise<{
    success: boolean;
    paymentTotal: number;
    isPartial: boolean;
    platformCommission: number;
    providerPayout: number;
    disputeFlagged: boolean;
  }> => {
    const validated = paymentSubmissionSchema.parse(params);

    // Fetch job to verify end code used
    const { data: job, error: fetchError } = await supabase
      .from("jobs")
      .select("id, customer_id, end_code_used, quote_accepted, quote_total, provider_id")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !job) {
      throw new Error("Job not found");
    }

    // Verify customer owns this job
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== (job as any).customer_id) {
      throw new Error("Unauthorized: You don't own this job");
    }

    // Verify quote accepted
    if (!(job as any).quote_accepted) {
      throw new Error("Quote must be accepted before payment");
    }

    // Verify end code used
    if (!(job as any).end_code_used) {
      throw new Error("Job must be completed (end code verified) before payment");
    }

    // Get provider minimum price
    // Note: Using 'as any' because minimum_job_price column may not be in generated types yet
    const { data: provider } = await (supabase
      .from("providers")
      .select("minimum_job_price") as any)
      .eq("id", (job as any).provider_id)
      .single();

    const minimumPrice =
      provider && typeof (provider as any).minimum_job_price === "number"
        ? (provider as any).minimum_job_price
        : 0;

    // Validate payment amount
    if (validated.paymentAmount < minimumPrice) {
      throw new Error(`Payment amount must be at least ${minimumPrice} (provider minimum)`);
    }

    // Calculate tip (default to 0)
    const tip = validated.paymentTip || 0;

    // Call database function to process payment
    const { data, error } = await supabase
      .rpc('process_job_payment' as any, {
        job_id_param: validated.jobId,
        payment_amount_param: validated.paymentAmount,
        payment_tip_param: tip,
        payment_method_param: validated.paymentMethod,
        payment_reference_param: validated.paymentReference,
      });

    if (error) {
      console.error("[paymentApi.submitPayment] Error:", error);
      throw new Error(`Failed to process payment: ${error.message}`);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to process payment");
    }

    const result = data[0];

    // If partial payment, store reason
    if (result.is_partial && validated.partialPaymentReason) {
      await supabase
        .from("jobs")
        .update({
          partial_payment_reason: validated.partialPaymentReason,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", validated.jobId);
    }

    if (import.meta.env.DEV) {
      console.log("[paymentApi.submitPayment] Payment processed:", {
        jobId: validated.jobId,
        paymentTotal: result.payment_total,
        isPartial: result.is_partial,
        disputeFlagged: result.dispute_flagged,
      });
    }

    return {
      success: true,
      paymentTotal: result.payment_total,
      isPartial: result.is_partial,
      platformCommission: result.platform_commission,
      providerPayout: result.provider_payout,
      disputeFlagged: result.dispute_flagged,
    };
  },

  /**
   * Get payment details for a job
   */
  getPaymentDetails: async (jobId: string): Promise<{
    quoteTotal: number;
    minimumPrice: number;
    tipLimit: number;
    paymentStatus: string;
    isPaid: boolean;
  }> => {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("quote_total, payment_status, payment_completed_at, provider_id")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      throw new Error("Job not found");
    }

    // Get provider minimum price
    // Note: Using 'as any' because minimum_job_price column may not be in generated types yet
    const { data: provider } = await (supabase
      .from("providers")
      .select("minimum_job_price") as any)
      .eq("id", (job as any).provider_id)
      .single();

    const minimumPrice = (provider as any)?.minimum_job_price || 0;
    const quoteTotal = (job as any).quote_total || 0;

    // Calculate tip limit (e.g., 50% of quote total)
    const tipLimit = Math.round(quoteTotal * 0.5);

    return {
      quoteTotal,
      minimumPrice,
      tipLimit,
      paymentStatus: (job as any).payment_status || 'pending',
      isPaid: !!(job as any).payment_completed_at,
    };
  },
};

// ============================================================================
// DISPUTE API
// ============================================================================

export const disputeApi = {
  /**
   * Flag a job for dispute (manual override for edge cases)
   */
  flagDispute: async (jobId: string, reason: string): Promise<void> => {
    const { error } = await supabase
      .from("jobs")
      .update({
        dispute_flagged: true,
        dispute_reason: reason,
        dispute_flagged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", jobId);

    if (error) {
      console.error("[disputeApi.flagDispute] Error:", error);
      throw new Error(`Failed to flag dispute: ${error.message}`);
    }

    if (import.meta.env.DEV) {
      console.log("[disputeApi.flagDispute] Dispute flagged:", { jobId, reason });
    }
  },

  /**
   * Get disputes for a user (provider or customer)
   */
  getDisputes: async (): Promise<JobWithDetails[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Query for jobs where user is either customer or provider and dispute is flagged
    // Note: Using 'as any' to avoid deep type instantiation issues with complex filters
    const { data, error } = await (supabase as any)
      .from("jobs")
      .select("*")
      .eq("dispute_flagged", true)
      .or(`customer_id.eq.${user.id},provider_id.eq.${user.id}`);

    if (error) {
      console.error("[disputeApi.getDisputes] Error:", error);
      throw new Error(`Failed to fetch disputes: ${error.message}`);
    }

    return (data || []) as JobWithDetails[];
  },
};

