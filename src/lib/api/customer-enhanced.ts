/**
 * Enhanced Customer API
 * Complete API functions for customer dashboard with validation
 */

import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { hashAuthCode } from "@/lib/utils";
import type {
  CustomerJob,
  PaymentMethod,
  Transaction,
  Address,
  SupportTicket,
  LoginSession,
} from "@/types/customer-dashboard";

// Validation schemas
const customerIdSchema = z.string().uuid("Invalid customer ID");
const jobIdSchema = z.string().uuid("Invalid job ID");
const authCodeSchema = z.string().min(4, "Auth code must be at least 4 characters");

const cancelJobSchema = z.object({
  jobId: jobIdSchema,
  reason: z.string().min(10, "Please provide a reason for cancellation"),
});

const rescheduleJobSchema = z.object({
  jobId: jobIdSchema,
  newDate: z.string().datetime(),
  newTime: z.string().optional(),
});

const validateStartSchema = z.object({
  jobId: jobIdSchema,
  customerAuthCode: authCodeSchema,
});

const validateCompleteSchema = z.object({
  jobId: jobIdSchema,
  providerAuthCode: authCodeSchema,
});

const generateCustomerCodeSchema = z.object({
  jobId: jobIdSchema,
});

const addressSchema = z.object({
  label: z.string().min(1).max(50),
  street: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  region: z.string().min(2).max(100), // Replaces state, more flexible
  postal_code: z.string().min(3).max(20), // Replaces zip_code, more flexible for international
  country: z.string().min(2).max(100),
  is_primary: z.boolean().optional(), // Replaces is_default
});

const supportTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  category: z.enum(["general", "billing", "technical", "trust_safety"]),
  message: z.string().min(20).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

// Jobs API
export const customerJobsApi = {
  /**
   * Get all jobs for a customer
   */
  getAllJobs: async (customerId: string): Promise<CustomerJob[]> => {
    const validatedId = customerIdSchema.parse(customerId);

    if (import.meta.env.DEV) {
      console.log("[customerJobsApi.getAllJobs] Fetching jobs for customer:", validatedId);
    }

    // Fetch jobs with service_categories
    // Using * to get all columns including auth_code_customer and auth_code_provider if they exist
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        *,
        service_category:service_categories(
          id,
          name
        )
      `)
      .eq("customer_id", validatedId)
      .order("created_at", { ascending: false });

    if (import.meta.env.DEV) {
      console.log("[customerJobsApi.getAllJobs] Found jobs:", {
        count: jobData?.length || 0,
        jobs: jobData?.map((j: any) => ({
          id: j.id,
          provider_id: j.provider_id,
          status: j.status,
          created_at: j.created_at
        })),
        error: jobError
      });
    }

    if (jobError) {
      if (import.meta.env.DEV) {
        console.error("[customerJobsApi.getAllJobs] Query error:", {
          error: jobError,
          code: jobError.code,
          message: jobError.message,
          details: jobError.details,
          hint: jobError.hint
        });
      }
      throw new Error(`Failed to fetch jobs: ${jobError.message}`);
    }

    if (!jobData || jobData.length === 0) {
      if (import.meta.env.DEV) {
        console.log("[customerJobsApi.getAllJobs] No jobs found for customer:", validatedId);
      }
      return [];
    }

    // Fetch providers separately
    const providerIds = [...new Set(jobData.map((j: any) => j.provider_id).filter(Boolean))];
    let providerMap = new Map();
    
    if (providerIds.length > 0) {
      try {
        const { data: providerData, error: providerError } = await supabase
          .from("providers")
          .select("id, display_name, business_name, rating, review_count, profile_image_url")
          .in("id", providerIds);

        if (!providerError && providerData) {
          providerData.forEach((provider: any) => {
            providerMap.set(provider.id, {
              id: provider.id,
              display_name: provider.display_name,
              business_name: provider.business_name,
              rating: provider.rating,
              review_count: provider.review_count,
              profile_image_url: provider.profile_image_url,
            });
          });
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("[customerJobsApi.getAllJobs] Error fetching providers:", err);
        }
      }
    }

    // Fetch reviews for these jobs (only authored by this customer)
    const jobIds = [...new Set(jobData.map((j: any) => j.id).filter(Boolean))];
    const reviewMap = new Map<string, { id: string; rating: number; review_text: string | null; created_at: string; job_id: string }>();
    
    if (jobIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id, job_id, rating, review_text, created_at")
        .in("job_id", jobIds)
        .eq("author_id", validatedId);

      if (reviewError) {
        if (import.meta.env.DEV) {
          console.warn("[customerJobsApi.getAllJobs] Failed to fetch reviews:", reviewError);
        }
      } else if (reviewData) {
        reviewData.forEach((review) => {
          if (review?.job_id) {
            reviewMap.set(review.job_id, review as any);
          }
        });
      }
    }

    return jobData.map((job: any) => {
      const provider = providerMap.get(job.provider_id);
      // Include customer code if job is pending or confirmed (before start)
      // Include provider code if job is in_progress (for completion)
      const shouldIncludeCustomerCode = job.status === "pending" || job.status === "confirmed";
      const shouldIncludeProviderCode = job.status === "in_progress";
      
      // Fetch codes from database - check both possible column names
      // Try auth_code_customer first, then customer_start_code as fallback
      const customerCode = job.auth_code_customer || job.customer_start_code || undefined;
      const providerCode = job.auth_code_provider || job.provider_end_code || undefined;
      
      // Check if job has been rated
      const reviewData = reviewMap.get(job.id);
      const hasRating = Boolean(reviewData);
      
      if (import.meta.env.DEV) {
        console.log("[getAllJobs] Job auth codes:", {
          jobId: job.id,
          status: job.status,
          auth_code_customer: job.auth_code_customer,
          customer_start_code: job.customer_start_code,
          auth_code_provider: job.auth_code_provider,
          provider_end_code: job.provider_end_code,
          resolvedCustomerCode: customerCode,
          resolvedProviderCode: providerCode,
          shouldIncludeCustomerCode,
          shouldIncludeProviderCode,
          hasRating,
          reviewData,
          allJobKeys: Object.keys(job).filter(k => k.includes('code') || k.includes('auth'))
        });
      }
      
      return {
        id: job.id || "",
        provider_id: job.provider_id || "",
        status: (job.status || "pending") as CustomerJob["status"],
        scheduled_date: job.scheduled_date || "",
        scheduled_time: job.scheduled_time || undefined,
        total_price: Number(job.total_price) || 0,
        base_price: Number(job.base_price) || 0,
        address: job.address || "",
        notes: job.notes || undefined,
        created_at: job.created_at || new Date().toISOString(),
        updated_at: job.updated_at || undefined,
        job_start_time: job.job_start_time || (job.status === "in_progress" ? job.updated_at : undefined),
        category_id: Number(job.category_id) || 0,
        // Fetch plain codes from database for display - try both column name variations
        auth_code_customer: shouldIncludeCustomerCode ? customerCode : undefined,
        auth_code_provider: shouldIncludeProviderCode ? providerCode : undefined,
        customer_code_expires_at: job.customer_code_expires_at || undefined,
        provider_code_expires_at: job.provider_code_expires_at || undefined,
        
        // Quote-based pricing fields
        quote_total: job.quote_total ? Number(job.quote_total) : undefined,
        quote_labor: job.quote_labor ? Number(job.quote_labor) : undefined,
        quote_materials: job.quote_materials ? Number(job.quote_materials) : undefined,
        quote_breakdown: job.quote_breakdown || undefined,
        quote_submitted_at: job.quote_submitted_at || undefined,
        quote_accepted: job.quote_accepted || false,
        quote_accepted_at: job.quote_accepted_at || undefined,
        quote_locked: job.quote_locked || false,
        
        // Handshake codes
        start_code: job.start_code || undefined,
        start_code_used: job.start_code_used || false,
        start_code_used_at: job.start_code_used_at || undefined,
        end_code: job.end_code || undefined,
        end_code_used: job.end_code_used || false,
        end_code_used_at: job.end_code_used_at || undefined,
        
        // Payment fields
        payment_amount: job.payment_amount ? Number(job.payment_amount) : undefined,
        payment_tip: job.payment_tip ? Number(job.payment_tip) : undefined,
        payment_total: job.payment_total ? Number(job.payment_total) : undefined,
        payment_method: job.payment_method || undefined,
        payment_status: job.payment_status || 'pending',
        payment_completed_at: job.payment_completed_at || undefined,
        payment_reference: job.payment_reference || undefined,
        is_partial_payment: job.is_partial_payment || false,
        partial_payment_reason: job.partial_payment_reason || undefined,
        
        // Dispute tracking
        dispute_flagged: job.dispute_flagged || false,
        dispute_reason: job.dispute_reason || undefined,
        
        // Rating status
        has_rating: hasRating,
        review: reviewData
          ? {
              id: reviewData.id,
              rating: reviewData.rating,
              review_text: reviewData.review_text,
              created_at: reviewData.created_at,
            }
          : undefined,
        
        provider: provider || undefined,
        service_category: job.service_category || undefined,
      };
    });
  },

  /**
   * Get job by ID
   */
  getJobById: async (jobId: string): Promise<CustomerJob> => {
    const validatedId = jobIdSchema.parse(jobId);

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        *,
        service_category:service_categories(
          id,
          name
        )
      `)
      .eq("id", validatedId)
      .single();

    if (jobError) {
      throw new Error(`Failed to fetch job: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    // Fetch provider separately
    let provider = undefined;
    if (jobData.provider_id) {
      try {
        const { data: providerData } = await supabase
          .from("providers")
          .select("id, rating, review_count")
          .eq("id", jobData.provider_id)
          .single();

        if (providerData) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url, phone")
            .eq("id", jobData.provider_id)
            .single();

          provider = {
            id: providerData.id,
            rating: providerData.rating,
            review_count: providerData.review_count,
            profiles: profileData || undefined,
          };
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("[customerJobsApi.getJobById] Error fetching provider:", err);
        }
      }
    }

    // Fetch rating for this job (by the job's customer)
    let reviewData: { id: string; rating: number; review_text: string | null; created_at: string } | null = null;
    try {
      const { data: reviewRow, error: reviewError } = await supabase
        .from("reviews")
        .select("id, rating, review_text, created_at")
        .eq("job_id", validatedId)
        .eq("author_id", jobData.customer_id)
        .maybeSingle();

      if (reviewError) {
        if (import.meta.env.DEV) {
          console.warn("[customerJobsApi.getJobById] Failed to fetch review:", reviewError);
        }
      } else {
        reviewData = reviewRow;
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[customerJobsApi.getJobById] Review fetch error:", err);
      }
    }

    const hasRating = Boolean(reviewData);

    // Fetch codes from database - check both possible column names
    // Using type assertion because these columns may exist at runtime but aren't in generated types
    const jobDataAny = jobData as any;
    const customerCode = jobDataAny.auth_code_customer || jobDataAny.customer_start_code || undefined;
    const providerCode = jobDataAny.auth_code_provider || jobDataAny.provider_end_code || undefined;
    
    if (import.meta.env.DEV) {
      console.log("[getJobById] Job auth codes:", {
        jobId: validatedId,
        status: jobData.status,
        auth_code_customer: jobDataAny.auth_code_customer,
        customer_start_code: jobDataAny.customer_start_code,
        resolvedCustomerCode: customerCode,
        allCodeKeys: Object.keys(jobData).filter(k => k.includes('code') || k.includes('auth'))
      });
    }
    
    return {
      id: jobData.id || validatedId,
      provider_id: jobData.provider_id || "",
      status: (jobData.status || "pending") as CustomerJob["status"],
      scheduled_date: jobData.scheduled_date || "",
      scheduled_time: jobDataAny.scheduled_time || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: jobData.updated_at || undefined,
      category_id: Number(jobData.category_id) || 0,
      // Fetch plain codes from database - try both column name variations
      auth_code_customer: customerCode,
      auth_code_provider: providerCode,
      
      // Quote-based pricing fields
      quote_total: jobDataAny.quote_total ? Number(jobDataAny.quote_total) : undefined,
      quote_labor: jobDataAny.quote_labor ? Number(jobDataAny.quote_labor) : undefined,
      quote_materials: jobDataAny.quote_materials ? Number(jobDataAny.quote_materials) : undefined,
      quote_breakdown: jobDataAny.quote_breakdown || undefined,
      quote_submitted_at: jobDataAny.quote_submitted_at || undefined,
      quote_accepted: jobDataAny.quote_accepted || false,
      quote_accepted_at: jobDataAny.quote_accepted_at || undefined,
      quote_locked: jobDataAny.quote_locked || false,
      
      // Handshake codes
      start_code: jobDataAny.start_code || undefined,
      start_code_used: jobDataAny.start_code_used || false,
      start_code_used_at: jobDataAny.start_code_used_at || undefined,
      end_code: jobDataAny.end_code || undefined,
      end_code_used: jobDataAny.end_code_used || false,
      end_code_used_at: jobDataAny.end_code_used_at || undefined,
      
      // Payment fields
      payment_amount: jobDataAny.payment_amount ? Number(jobDataAny.payment_amount) : undefined,
      payment_tip: jobDataAny.payment_tip ? Number(jobDataAny.payment_tip) : undefined,
      payment_total: jobDataAny.payment_total ? Number(jobDataAny.payment_total) : undefined,
      payment_method: jobDataAny.payment_method || undefined,
      payment_status: jobDataAny.payment_status || 'pending',
      payment_completed_at: jobDataAny.payment_completed_at || undefined,
      payment_reference: jobDataAny.payment_reference || undefined,
      is_partial_payment: jobDataAny.is_partial_payment || false,
      partial_payment_reason: jobDataAny.partial_payment_reason || undefined,
      
      // Dispute tracking
      dispute_flagged: jobDataAny.dispute_flagged || false,
      dispute_reason: jobDataAny.dispute_reason || undefined,
      
      // Rating status
      has_rating: hasRating,
      review: reviewData
        ? {
            id: reviewData.id,
            rating: reviewData.rating,
            review_text: reviewData.review_text,
            created_at: reviewData.created_at,
          }
        : undefined,
      
      provider,
      service_category: jobData.service_category || undefined,
    };
  },

  /**
   * Cancel a job
   * Updates status to cancelled and ensures it reflects on both customer and provider dashboards
   */
  cancelJob: async (params: { jobId: string; reason: string }): Promise<CustomerJob> => {
    const validated = cancelJobSchema.parse(params);

    // First, get the job to verify it exists and get provider_id for cache invalidation
    const { data: existingJob, error: fetchError } = await supabase
      .from("jobs")
      .select("id, provider_id, customer_id, status")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !existingJob) {
      throw new Error(`Job not found: ${fetchError?.message || "Unknown error"}`);
    }

    // Only allow cancellation if job is not already completed or cancelled
    if (existingJob.status === "completed") {
      throw new Error("Cannot cancel a completed job");
    }
    if (existingJob.status === "cancelled") {
      throw new Error("Job is already cancelled");
    }

    // Update job status to cancelled
    const existingJobAny = existingJob as any;
    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
        notes: existingJobAny.notes 
          ? `${existingJobAny.notes}\n\nCancelled by customer: ${validated.reason}`
          : `Cancelled by customer: ${validated.reason}`,
      })
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories(
          id,
          name
        )
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to cancel job: ${updateError.message}`);
    }

    if (!updatedJob) {
      throw new Error("Job cancellation failed - no data returned");
    }

    // Fetch provider separately
    let provider = undefined;
    if (updatedJob.provider_id) {
      try {
        const { data: providerData } = await supabase
          .from("providers")
          .select("*")
          .eq("id", updatedJob.provider_id)
          .maybeSingle();

        if (providerData) {
          const pd = providerData as any;
          provider = {
            id: pd.id,
            display_name: pd.display_name,
            business_name: pd.business_name,
            rating: pd.rating,
            review_count: pd.review_count,
            profile_image_url: pd.profile_image_url,
          };
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("[customerJobsApi.cancelJob] Error fetching provider:", err);
        }
      }
    }

    const updatedJobAny = updatedJob as any;
    return {
      id: updatedJob.id || validated.jobId,
      provider_id: updatedJob.provider_id || "",
      status: "cancelled" as CustomerJob["status"],
      scheduled_date: updatedJob.scheduled_date || "",
      scheduled_time: updatedJobAny.scheduled_time || undefined,
      total_price: Number(updatedJob.total_price) || 0,
      base_price: Number(updatedJob.base_price) || 0,
      address: updatedJob.address || "",
      notes: updatedJob.notes || undefined,
      created_at: updatedJob.created_at || new Date().toISOString(),
      updated_at: updatedJob.updated_at || undefined,
      job_start_time: updatedJobAny.job_start_time || undefined,
      category_id: Number(updatedJob.category_id) || 0,
      provider: provider || undefined,
      service_category: updatedJob.service_category || undefined,
    };
  },

  /**
   * Reschedule a job
   */
  rescheduleJob: async (params: { jobId: string; newDate: string; newTime?: string }): Promise<CustomerJob> => {
    const validated = rescheduleJobSchema.parse(params);

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update({
        scheduled_date: validated.newDate,
        scheduled_time: validated.newTime || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories(
          id,
          name
        )
      `)
      .single();

    if (jobError) {
      throw new Error(`Failed to reschedule job: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    // Fetch provider separately
    let provider = undefined;
    if (jobData.provider_id) {
      try {
        const { data: providerData } = await supabase
          .from("providers")
          .select("id, rating, review_count")
          .eq("id", jobData.provider_id)
          .single();

        if (providerData) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, full_name, photo_url, phone")
            .eq("id", jobData.provider_id)
            .single();

          provider = {
            id: providerData.id,
            rating: providerData.rating,
            review_count: providerData.review_count,
            profiles: profileData || undefined,
          };
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("[customerJobsApi.rescheduleJob] Error fetching provider:", err);
        }
      }
    }

    const rescheduleJobAny = jobData as any;
    return {
      id: jobData.id || validated.jobId,
      provider_id: jobData.provider_id || "",
      status: (jobData.status || "pending") as CustomerJob["status"],
      scheduled_date: validated.newDate,
      scheduled_time: validated.newTime || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: jobData.updated_at || undefined,
      category_id: Number(jobData.category_id) || 0,
      auth_code_customer: rescheduleJobAny.auth_code_customer || undefined,
      auth_code_provider: rescheduleJobAny.auth_code_provider || undefined,
      provider,
      service_category: jobData.service_category || undefined,
    };
  },

  /**
   * Validate customer auth code to start job
   * Uses hash comparison for security
   */
  validateStart: async (params: { jobId: string; customerAuthCode: string }): Promise<boolean> => {
    const validated = validateStartSchema.parse(params);

    // Get the stored hash from database
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", validated.jobId)
      .single();

    if (error || !data) {
      throw new Error("Job not found");
    }

    const dataAny = data as any;
    if (!dataAny.customer_start_code_hash) {
      throw new Error("No auth code found for this job");
    }

    // Hash the input code and compare with stored hash
    const inputHash = await hashAuthCode(validated.customerAuthCode);
    return dataAny.customer_start_code_hash === inputHash;
  },

  /**
   * Validate provider auth code to complete job
   * Uses hash comparison for security
   * @deprecated Use completeJob instead - this only validates, doesn't complete
   */
  validateComplete: async (params: { jobId: string; providerAuthCode: string }): Promise<boolean> => {
    const validated = validateCompleteSchema.parse(params);

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", validated.jobId)
      .single();

    if (error || !data) {
      throw new Error("Job not found");
    }

    const dataAny = data as any;
    if (!dataAny.provider_end_code_hash) {
      throw new Error("No auth code found for this job");
    }

    // Hash the input code and compare with stored hash
    const inputHash = await hashAuthCode(validated.providerAuthCode);
    return dataAny.provider_end_code_hash === inputHash;
  },

  /**
   * Complete a job with provider auth code
   * Validates the code, marks as completed, captures timestamp, and triggers billing
   * Uses hash comparison for security
   */
  completeJob: async (params: { jobId: string; providerAuthCode: string }): Promise<CustomerJob> => {
    const validated = validateCompleteSchema.parse(params);

    // First, verify the auth code hash
    const { data: existingJob, error: fetchError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !existingJob) {
      throw new Error("Job not found");
    }

    const existingJobAny = existingJob as any;
    if (existingJob.status !== "in_progress") {
      throw new Error("Job must be in progress to be completed");
    }

    if (!existingJobAny.provider_end_code_hash) {
      throw new Error("No completion code found for this job. The provider must generate a completion code first.");
    }

    // Hash the input code and compare with stored hash
    const inputHash = await hashAuthCode(validated.providerAuthCode);
    if (existingJobAny.provider_end_code_hash !== inputHash) {
      throw new Error("Invalid completion code. Please check the code and try again.");
    }

    // Capture completion timestamp (server-side)
    const endTime = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: "awaiting_payment", // Changed from "completed" to trigger payment modal
      end_code_used: true,
      end_code_used_at: endTime,
      job_completed_at: endTime, // NEW: Server-side timestamp for billing
      updated_at: endTime,
    };

    // Update job status and capture timestamp
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories(
          id,
          name
        )
      `)
      .single();

    if (jobError) {
      throw new Error(`Failed to complete job: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    const jobDataAny = jobData as any;

    // NEW: Calculate final bill if hourly pricing is being used
    if (jobDataAny.hourly_rate_snapshot && jobDataAny.job_started_at && jobDataAny.job_completed_at) {
      try {
        // Call server-side billing calculation function
        const { data: billingData, error: billingError } = await supabase
          .rpc("calculate_final_bill" as any, { job_id_param: validated.jobId });

        if (!billingError && billingData && Array.isArray(billingData) && billingData.length > 0) {
          const billing = billingData[0] as any;
          
          // Update job with calculated billing (using any to bypass TypeScript checks for new columns)
          await supabase
            .from("jobs")
            .update({
              actual_duration_minutes: billing.actual_duration_minutes,
              final_billed_hours: billing.final_billed_hours,
              final_labor_cost: billing.final_labor_cost,
              final_materials_cost: billing.final_materials_cost,
              final_subtotal: billing.final_subtotal,
              platform_fee_amount: billing.platform_fee_amount,
              final_total_cost: billing.final_total_cost,
              final_amount_due: billing.final_amount_due,
              provider_payout_amount: billing.provider_payout_amount,
              final_billed: true,
            } as any)
            .eq("id", validated.jobId);
        }
      } catch (error) {
        console.error("Failed to calculate final bill:", error);
        // Don't fail job completion if billing calculation fails
        // Billing can be calculated manually or retried later
      }
    }

    // Fetch provider details
    const providerId = jobData.provider_id;
    let provider = undefined;
    if (providerId) {
      const { data: providerData } = await supabase
        .from("providers")
        .select("*")
        .eq("id", providerId)
        .single();

      if (providerData) {
        const pd = providerData as any;
        provider = {
          id: providerId,
          display_name: pd.display_name || undefined,
          business_name: pd.business_name || undefined,
          profile_image_url: pd.profile_image_url || undefined,
          rating: pd.rating ? Number(pd.rating) : undefined,
          review_count: pd.review_count || 0,
        };
      }
    }

    const completeJobDataAny = jobData as any;
    return {
      id: jobData.id || validated.jobId,
      provider_id: providerId || "",
      status: "completed" as const,
      scheduled_date: jobData.scheduled_date || "",
      scheduled_time: completeJobDataAny.scheduled_time || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: endTime,
      job_start_time: existingJobAny.job_start_time || undefined,
      category_id: jobData.category_id || 0,
      provider,
      service_category: jobData.service_category || undefined,
    };
  },
};

// Wallet API
export const customerWalletApi = {
  /**
   * Get payment methods
   * Note: payment_methods table may not exist in all deployments
   */
  getPaymentMethods: async (customerId: string): Promise<PaymentMethod[]> => {
    const validatedId = customerIdSchema.parse(customerId);

    // Use type assertion since payment_methods table may not be in generated types
    const { data, error } = await (supabase as any)
      .from("payment_methods")
      .select("id, type, last4, brand, expiry_month, expiry_year, is_primary, created_at")
      .eq("customer_id", validatedId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Table may not exist, return empty array
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return [];
      }
      throw new Error(`Failed to fetch payment methods: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((pm: unknown) => {
      const p = pm as Record<string, unknown>;
      return {
        id: (p.id as string) || "",
        type: (p.type || "card") as PaymentMethod["type"],
        last4: (p.last4 as string) || undefined,
        brand: (p.brand as string) || undefined,
        expiry_month: p.expiry_month ? Number(p.expiry_month) : undefined,
        expiry_year: p.expiry_year ? Number(p.expiry_year) : undefined,
        is_primary: Boolean(p.is_primary),
        created_at: (p.created_at as string) || new Date().toISOString(),
      };
    });
  },

  /**
   * Get transactions
   */
  getTransactions: async (customerId: string): Promise<Transaction[]> => {
    const validatedId = customerIdSchema.parse(customerId);

    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        job:jobs!inner(
          id,
          provider:provider_id(
            profiles:profiles!inner(
              full_name
            )
          ),
          service_category:service_categories!inner(
            name
          )
        )
      `)
      .eq("customer_id", validatedId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((t: unknown) => {
      const transaction = t as Record<string, unknown>;
      const jobData = transaction.job as Record<string, unknown> | undefined;
      return {
        id: (transaction.id as string) || "",
        job_id: (transaction.job_id as string) || "",
        amount: Number(transaction.amount) || 0,
        status: (transaction.status || "pending") as Transaction["status"],
        payment_method: (transaction.payment_method as string) || "",
        processed_at: (transaction.processed_at as string) || undefined,
        created_at: (transaction.created_at as string) || new Date().toISOString(),
        job: jobData ? {
          id: (jobData.id as string) || "",
          provider: jobData.provider as { display_name?: string; business_name?: string } | undefined,
          service_category: jobData.service_category as { name: string } | undefined,
        } : undefined,
      };
    });
  },
};

// Address API - Unified addresses table
// Note: addresses table may not exist in all deployments - use type assertions
export const customerAddressApi = {
  /**
   * Get addresses for a customer
   */
  getAddresses: async (customerId: string): Promise<Address[]> => {
    const validatedId = customerIdSchema.parse(customerId);

    const { data, error } = await (supabase as any)
      .from("addresses")
      .select("id, owner_type, owner_id, label, street, city, region, postal_code, country, is_primary, created_at, updated_at")
      .eq("owner_type", "customer")
      .eq("owner_id", validatedId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Table may not exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return [];
      }
      throw new Error(`Failed to fetch addresses: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((a: unknown) => {
      const addr = a as Record<string, unknown>;
      return {
        id: (addr.id as string) || "",
        owner_type: (addr.owner_type as "customer" | "provider") || "customer",
        owner_id: (addr.owner_id as string) || validatedId,
        label: (addr.label as string) || "",
        street: (addr.street as string) || "",
        city: (addr.city as string) || "",
        region: (addr.region as string) || "",
        postal_code: (addr.postal_code as string) || "",
        country: (addr.country as string) || "",
        latitude: addr.latitude ? Number(addr.latitude) : null,
        longitude: addr.longitude ? Number(addr.longitude) : null,
        is_primary: Boolean(addr.is_primary),
        created_at: (addr.created_at as string) || new Date().toISOString(),
        updated_at: (addr.updated_at as string) || undefined,
      };
    });
  },

  /**
   * Add address with two-step primary address logic
   */
  addAddress: async (
    customerId: string,
    address: Omit<Address, "id" | "owner_type" | "owner_id" | "created_at" | "updated_at">,
  ): Promise<Address> => {
    const validatedId = customerIdSchema.parse(customerId);
    const validatedAddress = addressSchema.parse(address);

    try {
      // Step 1: If this is set as primary, unset other primary addresses first
      if (validatedAddress.is_primary) {
        const { error: updateError } = await (supabase as any)
          .from("addresses")
          .update({ is_primary: false })
          .eq("owner_type", "customer")
          .eq("owner_id", validatedId)
          .eq("is_primary", true);

        if (updateError) {
          console.warn("[AddressAPI] Failed to unset primary addresses:", updateError);
          // Continue anyway - might be first address
        }
      }

      // Step 2: Insert the new address
      const { data, error } = await (supabase as any)
        .from("addresses")
        .insert({
          owner_type: "customer",
          owner_id: validatedId,
          label: validatedAddress.label,
          street: validatedAddress.street,
          city: validatedAddress.city,
          region: validatedAddress.region,
          postal_code: validatedAddress.postal_code,
          country: validatedAddress.country,
          // NOTE: latitude/longitude removed - they don't exist in addresses table
          is_primary: validatedAddress.is_primary ?? false,
        })
        .select()
        .single();

      if (error) {
        const errorMessage = error.message || "";
        let userMessage = "Failed to add address";
        
        if (errorMessage.includes("duplicate") || errorMessage.includes("unique")) {
          userMessage = "This address already exists.";
        } else if (errorMessage.includes("permission") || errorMessage.includes("policy")) {
          userMessage = "You don't have permission to add addresses.";
        } else if (errorMessage.includes("RLS") || errorMessage.includes("row-level security")) {
          userMessage = "Permission denied. Please ensure you are logged in.";
        }

        throw new Error(userMessage);
      }

      if (!data) {
        throw new Error("Failed to create address");
      }

      const addr = data as Record<string, unknown>;
      return {
        id: (addr.id as string) || "",
        owner_type: "customer",
        owner_id: validatedId,
        label: (addr.label as string) || "",
        street: (addr.street as string) || "",
        city: (addr.city as string) || "",
        region: (addr.region as string) || "",
        postal_code: (addr.postal_code as string) || "",
        country: (addr.country as string) || "",
        latitude: addr.latitude ? Number(addr.latitude) : null,
        longitude: addr.longitude ? Number(addr.longitude) : null,
        is_primary: Boolean(addr.is_primary),
        created_at: (addr.created_at as string) || new Date().toISOString(),
        updated_at: (addr.updated_at as string) || undefined,
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid address data: ${error.errors.map(e => e.message).join(", ")}`);
      }
      throw error;
    }
  },

  /**
   * Update address
   */
  updateAddress: async (
    addressId: string,
    address: Partial<Omit<Address, "id" | "owner_type" | "owner_id" | "created_at" | "updated_at">>,
  ): Promise<Address> => {
    const validatedAddress = addressSchema.partial().parse(address);

    try {
      // If setting as primary, unset other primary addresses first
      if (validatedAddress.is_primary === true) {
        // Get the address to find owner info
        const { data: existingAddress } = await (supabase as any)
          .from("addresses")
          .select("owner_type, owner_id")
          .eq("id", addressId)
          .single();

        if (existingAddress) {
          const { error: updateError } = await (supabase as any)
            .from("addresses")
            .update({ is_primary: false })
            .eq("owner_type", existingAddress.owner_type)
            .eq("owner_id", existingAddress.owner_id)
            .eq("is_primary", true)
            .neq("id", addressId);

          if (updateError) {
            console.warn("[AddressAPI] Failed to unset primary addresses:", updateError);
          }
        }
      }

      const { data, error } = await (supabase as any)
        .from("addresses")
        .update({
          ...validatedAddress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", addressId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update address: ${error.message}`);
      }

      if (!data) {
        throw new Error("Address not found");
      }

      const addr = data as Record<string, unknown>;
      return {
        id: (addr.id as string) || "",
        owner_type: (addr.owner_type as "customer" | "provider") || "customer",
        owner_id: (addr.owner_id as string) || "",
        label: (addr.label as string) || "",
        street: (addr.street as string) || "",
        city: (addr.city as string) || "",
        region: (addr.region as string) || "",
        postal_code: (addr.postal_code as string) || "",
        country: (addr.country as string) || "",
        latitude: addr.latitude ? Number(addr.latitude) : null,
        longitude: addr.longitude ? Number(addr.longitude) : null,
        is_primary: Boolean(addr.is_primary),
        created_at: (addr.created_at as string) || new Date().toISOString(),
        updated_at: (addr.updated_at as string) || undefined,
      };
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Delete address
   */
  deleteAddress: async (addressId: string): Promise<void> => {
    const { error } = await (supabase as any)
      .from("addresses")
      .delete()
      .eq("id", addressId);

    if (error) {
      throw new Error(`Failed to delete address: ${error.message}`);
    }
  },
};

// Provider Address API - Uses same unified addresses table
// Note: addresses table may not exist in all deployments - use type assertions
export const providerAddressApi = {
  /**
   * Get addresses for a provider
   */
  getAddresses: async (providerId: string): Promise<Address[]> => {
    const validatedId = customerIdSchema.parse(providerId); // Reuse same validation

    const { data, error } = await (supabase as any)
      .from("addresses")
      .select("id, owner_type, owner_id, label, street, city, region, postal_code, country, is_primary, created_at, updated_at")
      .eq("owner_type", "provider")
      .eq("owner_id", validatedId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Table may not exist
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return [];
      }
      throw new Error(`Failed to fetch addresses: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((a: unknown) => {
      const addr = a as Record<string, unknown>;
      return {
        id: (addr.id as string) || "",
        owner_type: "provider",
        owner_id: validatedId,
        label: (addr.label as string) || "",
        street: (addr.street as string) || "",
        city: (addr.city as string) || "",
        region: (addr.region as string) || "",
        postal_code: (addr.postal_code as string) || "",
        country: (addr.country as string) || "",
        latitude: addr.latitude ? Number(addr.latitude) : null,
        longitude: addr.longitude ? Number(addr.longitude) : null,
        is_primary: Boolean(addr.is_primary),
        created_at: (addr.created_at as string) || new Date().toISOString(),
        updated_at: (addr.updated_at as string) || undefined,
      };
    });
  },

  /**
   * Add address for a provider
   */
  addAddress: async (
    providerId: string,
    address: Omit<Address, "id" | "owner_type" | "owner_id" | "created_at" | "updated_at">,
  ): Promise<Address> => {
    const validatedId = customerIdSchema.parse(providerId);
    const validatedAddress = addressSchema.parse(address);

    try {
      // Step 1: If this is set as primary, unset other primary addresses first
      if (validatedAddress.is_primary) {
        const { error: updateError } = await (supabase as any)
          .from("addresses")
          .update({ is_primary: false })
          .eq("owner_type", "provider")
          .eq("owner_id", validatedId)
          .eq("is_primary", true);

        if (updateError) {
          console.warn("[ProviderAddressAPI] Failed to unset primary addresses:", updateError);
        }
      }

      // Step 2: Insert the new address
      const { data, error } = await (supabase as any)
        .from("addresses")
        .insert({
          owner_type: "provider",
          owner_id: validatedId,
          label: validatedAddress.label,
          street: validatedAddress.street,
          city: validatedAddress.city,
          region: validatedAddress.region,
          postal_code: validatedAddress.postal_code,
          country: validatedAddress.country,
          // NOTE: latitude/longitude removed - they don't exist in addresses table
          is_primary: validatedAddress.is_primary ?? false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add address: ${error.message}`);
      }

      if (!data) {
        throw new Error("Failed to create address");
      }

      const addr = data as Record<string, unknown>;
      return {
        id: (addr.id as string) || "",
        owner_type: "provider",
        owner_id: validatedId,
        label: (addr.label as string) || "",
        street: (addr.street as string) || "",
        city: (addr.city as string) || "",
        region: (addr.region as string) || "",
        postal_code: (addr.postal_code as string) || "",
        country: (addr.country as string) || "",
        latitude: addr.latitude ? Number(addr.latitude) : null,
        longitude: addr.longitude ? Number(addr.longitude) : null,
        is_primary: Boolean(addr.is_primary),
        created_at: (addr.created_at as string) || new Date().toISOString(),
        updated_at: (addr.updated_at as string) || undefined,
      };
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Update address
   */
  updateAddress: async (
    addressId: string,
    address: Partial<Omit<Address, "id" | "owner_type" | "owner_id" | "created_at" | "updated_at">>,
  ): Promise<Address> => {
    return customerAddressApi.updateAddress(addressId, address); // Reuse same logic
  },

  /**
   * Delete address
   */
  deleteAddress: async (addressId: string): Promise<void> => {
    return customerAddressApi.deleteAddress(addressId); // Reuse same logic
  },
};

// Support API
// Note: support_tickets table may not exist in all deployments - use type assertions
export const customerSupportApi = {
  /**
   * Create support ticket
   */
  createTicket: async (customerId: string, ticket: Omit<SupportTicket, "id" | "status" | "created_at" | "updated_at" | "messages"> & { message?: string }): Promise<SupportTicket> => {
    const validatedId = customerIdSchema.parse(customerId);
    const validatedTicket = supportTicketSchema.parse({
      subject: ticket.subject,
      category: ticket.category,
      message: ticket.message || "",
      priority: ticket.priority,
    });

    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .insert({
        customer_id: validatedId,
        subject: validatedTicket.subject,
        category: validatedTicket.category,
        priority: validatedTicket.priority || "medium",
        status: "open",
        initial_message: validatedTicket.message,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ticket: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create support ticket");
    }

    const t = data as Record<string, unknown>;
    return {
      id: (t.id as string) || "",
      subject: (t.subject as string) || "",
      category: (t.category || "general") as SupportTicket["category"],
      status: (t.status || "open") as SupportTicket["status"],
      priority: (t.priority || "medium") as SupportTicket["priority"],
      created_at: (t.created_at as string) || new Date().toISOString(),
      updated_at: (t.updated_at as string) || undefined,
      messages: [],
    };
  },

  /**
   * Get ticket by ID
   */
  getTicket: async (ticketId: string): Promise<SupportTicket> => {
    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .select(`
        *,
        messages:support_messages(*)
      `)
      .eq("id", ticketId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch ticket: ${error.message}`);
    }

    if (!data) {
      throw new Error("Ticket not found");
    }

    const t = data as Record<string, unknown>;
    return {
      id: (t.id as string) || "",
      subject: (t.subject as string) || "",
      category: (t.category || "general") as SupportTicket["category"],
      status: (t.status || "open") as SupportTicket["status"],
      priority: (t.priority || "medium") as SupportTicket["priority"],
      created_at: (t.created_at as string) || new Date().toISOString(),
      updated_at: (t.updated_at as string) || undefined,
      messages: (t.messages as SupportTicket["messages"]) || [],
    };
  },
};








