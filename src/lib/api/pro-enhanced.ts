/**
 * Enhanced Pro API
 * Complete API functions for professional dashboard with validation and error handling
 */

import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { hashAuthCode } from "@/lib/utils";
import type {
  JobWithDetails,
  EarningsData,
  Payout,
  ProProfile,
  VerificationDocument,
  BankDetails,
  PayoutMethod,
} from "@/types/pro-dashboard";

// Validation schemas
const jobIdSchema = z.string().uuid("Invalid job ID");
const providerIdSchema = z.string().uuid("Invalid provider ID");
const authCodeSchema = z.string().min(4, "Auth code must be at least 4 characters");

const startJobSchema = z.object({
  jobId: jobIdSchema,
  customerAuthCode: authCodeSchema,
});

const completeJobSchema = z.object({
  jobId: jobIdSchema,
  providerAuthCode: authCodeSchema,
  materials_cost: z.number().min(0).optional(),
});

const generateProviderCodeSchema = z.object({
  jobId: jobIdSchema,
});

const updateJobStatusSchema = z.object({
  jobId: jobIdSchema,
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]),
});

const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  hourly_rate: z.number().min(0).max(10000).optional(),
  minimum_job_price: z.number().min(0).max(10000000).optional(),
  is_active: z.boolean().optional(),
  business_name: z.string().max(120).optional(),
  city: z.string().max(100).optional(),
});

const bankDetailsSchema = z.object({
  account_holder_name: z.string().min(2).max(100),
  account_number: z.string().min(4).max(20),
  routing_number: z.string().length(9),
  bank_name: z.string().min(2).max(100),
});

/**
 * Helper function to get the provider table ID from an auth user ID
 * 
 * Uses providers.user_id -> auth.users.id relationship structure
 * - providers.user_id references auth.users.id
 * - providers.id is the provider's table primary key
 * - jobs.provider_id references providers.id (not providers.user_id)
 * 
 * So we need to find the provider record where user_id = authUserId, then use that provider's id
 */
export async function getProviderTableId(authUserId: string): Promise<string> {
  if (import.meta.env.DEV) {
    console.log(`[getProviderTableId] Looking up provider for auth user ID:`, authUserId);
  }
  
  // First, try to find provider by user_id field (new structure: providers.user_id -> auth.users.id)
  const { data: providerByUserId, error: providerByUserIdError } = await supabase
    .from("providers")
    .select("id, user_id")
    .eq("user_id", authUserId)
    .maybeSingle();
  
  if (providerByUserId && !providerByUserIdError) {
    if (import.meta.env.DEV) {
      console.log(`[getProviderTableId] Found provider by user_id (new structure):`, {
        providerTableId: providerByUserId.id,
        userId: providerByUserId.user_id,
        authUserId
      });
    }
    return providerByUserId.id;
  }
  
  // Fallback: try to find provider by checking if providers.id = authUserId (legacy schema)
  const { data: providerById, error: providerByIdError } = await supabase
    .from("providers")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  
  if (providerById && !providerByIdError) {
    if (import.meta.env.DEV) {
      console.log(`[getProviderTableId] Found provider by id (legacy schema):`, providerById.id);
    }
    return providerById.id;
  }
  
  if (import.meta.env.DEV) {
    console.warn(`[getProviderTableId] Could not find provider record for user:`, authUserId);
    console.warn(`[getProviderTableId] Error by user_id:`, providerByUserIdError);
    console.warn(`[getProviderTableId] Error by id:`, providerByIdError);
    console.warn(`[getProviderTableId] Falling back to using auth user ID as provider table ID`);
  }
  
  // Fallback: use the authUserId as-is (assume it's already the provider table ID)
  return authUserId;
}

// Jobs API
export const proJobsApi = {
  /**
   * Get all jobs for a provider
   * NOTE: providerId parameter is the auth user ID
   * We need to find the provider's table ID (providers.id) to query jobs.provider_id
   */
  getAllJobs: async (providerId: string): Promise<JobWithDetails[]> => {
    const validatedId = providerIdSchema.parse(providerId);

    // Get the provider table ID (may differ from auth user ID)
    const providerTableId = await getProviderTableId(validatedId);
    
    if (import.meta.env.DEV) {
      console.log(`[proJobsApi.getAllJobs] Auth user ID:`, validatedId);
      console.log(`[proJobsApi.getAllJobs] Provider table ID:`, providerTableId);
    }

    // Fetch jobs with service_categories
    // Using * to get all columns including auth_code_customer and auth_code_provider if they exist
    // Use providerTableId (the provider's table ID) to query jobs.provider_id
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        *,
        service_category:service_categories!inner(
          id,
          name
        )
      `)
      .eq("provider_id", providerTableId)
      .order("created_at", { ascending: false });

    if (jobError) {
      throw new Error(`Failed to fetch jobs: ${jobError.message}`);
    }

    if (!jobData || jobData.length === 0) {
      return [];
    }

    // Fetch customer profiles separately (customer_id references auth.users, not profiles directly)
    const customerIds = [...new Set(jobData.map((j: any) => j.customer_id).filter(Boolean))];
    
    let profileMap = new Map();
    if (customerIds.length > 0) {
      try {
        // Fetch profiles individually to avoid .in() query issues
        const profilePromises = customerIds.map(async (customerId: string) => {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("id, full_name, photo_url, phone")
              .eq("id", customerId)
              .maybeSingle();

            if (profileError) {
              if (import.meta.env.DEV) {
                console.warn(`[proJobsApi.getAllJobs] Error fetching profile for ${customerId}:`, profileError);
              }
              return null;
            }
            return profileData;
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn(`[proJobsApi.getAllJobs] Exception fetching profile for ${customerId}:`, err);
            }
            return null;
          }
        });

        const profileResults = await Promise.all(profilePromises);
        profileResults.forEach((profile: any, index: number) => {
          const customerId = customerIds[index];
          if (profile) {
            // IMPORTANT: Map by customerId (the key we use for lookup), not profile.id
            // This ensures the lookup works correctly
            profileMap.set(customerId, profile);
            if (import.meta.env.DEV) {
              console.log(`[proJobsApi.getAllJobs] Mapped profile for customer_id ${customerId}:`, {
                profileId: profile.id,
                full_name: profile.full_name,
                mappedBy: customerId,
                matches: profile.id === customerId
              });
            }
          } else {
            if (import.meta.env.DEV) {
              console.warn(`[proJobsApi.getAllJobs] No profile returned for customer_id: ${customerId}`);
            }
          }
        });
        
        if (import.meta.env.DEV) {
          console.log(`[proJobsApi.getAllJobs] Fetched ${profileMap.size} profiles out of ${customerIds.length} customers`);
          console.log(`[proJobsApi.getAllJobs] Customer IDs searched:`, customerIds);
          console.log(`[proJobsApi.getAllJobs] Profile map keys:`, Array.from(profileMap.keys()));
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error(`[proJobsApi.getAllJobs] Error fetching profiles:`, err);
        }
        // Continue without profiles
      }
    }

    // Fetch reviews for these jobs
    const jobIds = [...new Set(jobData.map((j: any) => j.id).filter(Boolean))];
    const reviewMap = new Map<string, { id: string; rating: number; review_text: string | null; created_at: string; author_id: string; job_id: string }>();
    
    if (jobIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id, job_id, rating, review_text, created_at, author_id")
        .in("job_id", jobIds);

      if (reviewError) {
        if (import.meta.env.DEV) {
          console.warn("[proJobsApi.getAllJobs] Failed to fetch reviews:", reviewError);
        }
      } else if (reviewData) {
        reviewData.forEach((review) => {
          if (review?.job_id) {
            reviewMap.set(review.job_id, review as any);
          }
        });
      }
    }

    // Combine jobs with profiles
    return jobData.map((job: any) => {
      const customerId = job.customer_id;
      const profile = profileMap.get(customerId);
      
      if (import.meta.env.DEV) {
        if (!profile) {
          console.warn(`[proJobsApi.getAllJobs] No profile found for customer_id: ${customerId}`);
          console.warn(`[proJobsApi.getAllJobs] Available profiles in map:`, Array.from(profileMap.keys()));
        } else {
          console.log(`[proJobsApi.getAllJobs] Profile found for customer_id ${customerId}:`, {
            id: profile.id,
            full_name: profile.full_name,
            hasFullName: !!profile.full_name
          });
        }
      }
      
      // Include customer code if job is pending or confirmed (for starting)
      // Include provider code if job is in_progress (for completion)
      const shouldIncludeCustomerCode = job.status === "pending" || job.status === "confirmed";
      const shouldIncludeProviderCode = job.status === "in_progress";

      // Check if job has been rated
      const reviewData = reviewMap.get(job.id);
      const hasRating = Boolean(reviewData);

      return {
        id: job.id || "",
        customer_id: customerId || "",
        status: (job.status || "pending") as JobWithDetails["status"],
        scheduled_date: job.scheduled_date || "",
        scheduled_time: job.scheduled_time || undefined,
        total_price: Number(job.total_price) || 0,
        base_price: Number(job.base_price) || 0,
        address: job.address || "",
        notes: job.notes || undefined,
        created_at: job.created_at || new Date().toISOString(),
        updated_at: job.updated_at || undefined,
        job_start_time: job.job_start_time || (job.status === "in_progress" ? job.updated_at : undefined),
        materials_cost: job.materials_cost ? Number(job.materials_cost) : undefined,
        
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
        review: reviewData ? {
          id: reviewData.id,
          rating: reviewData.rating,
          review_text: reviewData.review_text,
          created_at: reviewData.created_at,
          author_id: reviewData.author_id,
        } : undefined,
        
        // Customer and service category
        customer: profile ? {
          id: customerId,
          profiles: profile,
        } : undefined,
        service_category: job.service_category || undefined,
        auth_code_customer: shouldIncludeCustomerCode ? (job.auth_code_customer || undefined) : undefined,
        auth_code_provider: shouldIncludeProviderCode ? (job.auth_code_provider || undefined) : undefined,
      };
    });
  },

  /**
   * Get jobs by status
   * NOTE: providerId parameter is the auth user ID
   * We need to find the provider's table ID (providers.id) to query jobs.provider_id
   */
  getJobsByStatus: async (
    providerId: string,
    status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
  ): Promise<JobWithDetails[]> => {
    const validatedId = providerIdSchema.parse(providerId);

    if (import.meta.env.DEV) {
      console.log(`[proJobsApi.getJobsByStatus] ===== FETCHING ${status.toUpperCase()} JOBS =====`);
      console.log(`[proJobsApi.getJobsByStatus] Auth user ID (input):`, validatedId);
      
      // Check current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log(`[proJobsApi.getJobsByStatus] Current auth user ID:`, authUser?.id);
      console.log(`[proJobsApi.getJobsByStatus] IDs match:`, authUser?.id === validatedId);
    }

    // Get the provider table ID (may differ from auth user ID)
    const providerTableId = await getProviderTableId(validatedId);
    
    if (import.meta.env.DEV) {
      console.log(`[proJobsApi.getJobsByStatus] Provider table ID:`, providerTableId);
      
      // Check current auth user to verify RLS context
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log(`[proJobsApi.getJobsByStatus] Current auth user for RLS:`, authUser?.id);
      console.log(`[proJobsApi.getJobsByStatus] Auth user matches provider table ID:`, authUser?.id === providerTableId);
      
      // First, let's check if there are ANY jobs for this provider (simple query)
      const { data: allJobs, error: allJobsError } = await supabase
        .from("jobs")
        .select("id, provider_id, status, customer_id, created_at")
        .eq("provider_id", providerTableId);
      
      console.log(`[proJobsApi.getJobsByStatus] All jobs for provider table ID ${providerTableId}:`, {
        count: allJobs?.length || 0,
        jobs: allJobs?.map((j: any) => ({ id: j.id, provider_id: j.provider_id, status: j.status, created: j.created_at })),
        error: allJobsError,
        errorCode: allJobsError?.code,
        errorMessage: allJobsError?.message,
        errorDetails: allJobsError?.details,
        errorHint: allJobsError?.hint
      });

      // Try querying ALL jobs (no filter) to see if RLS is blocking
      const { data: allJobsNoFilter, error: allJobsNoFilterError } = await supabase
        .from("jobs")
        .select("id, provider_id, status, customer_id, created_at")
        .limit(10);
      
      console.log(`[proJobsApi.getJobsByStatus] All jobs (no filter, RLS test):`, {
        count: allJobsNoFilter?.length || 0,
        jobs: allJobsNoFilter?.map((j: any) => ({ 
          id: j.id, 
          provider_id: j.provider_id, 
          provider_id_type: typeof j.provider_id,
          provider_id_length: j.provider_id?.length,
          status: j.status,
          created_at: j.created_at
        })),
        error: allJobsNoFilterError,
        errorCode: allJobsNoFilterError?.code,
        errorMessage: allJobsNoFilterError?.message
      });
      
      // Check if there are any jobs with different provider_ids
      if (allJobsNoFilter && allJobsNoFilter.length > 0) {
        const uniqueProviderIds = [...new Set(allJobsNoFilter.map((j: any) => j.provider_id))];
        console.log(`[proJobsApi.getJobsByStatus] Unique provider_ids in all jobs:`, uniqueProviderIds);
        console.log(`[proJobsApi.getJobsByStatus] Querying provider_id (${providerTableId}) matches any job:`, uniqueProviderIds.includes(providerTableId));
        console.log(`[proJobsApi.getJobsByStatus] Auth user ID (${validatedId}) matches any job:`, uniqueProviderIds.includes(validatedId));
      }
      
      // Try a direct query using the exact provider_id from the customer dashboard
      const knownProviderId = 'a5dbf695-1bdb-4d5d-b063-d91da79683c6';
      const { data: directQueryJobs, error: directQueryError } = await supabase
        .from("jobs")
        .select("id, provider_id, status, customer_id, created_at")
        .eq("provider_id", knownProviderId);
      
      console.log(`[proJobsApi.getJobsByStatus] Direct query for known provider_id ${knownProviderId}:`, {
        count: directQueryJobs?.length || 0,
        jobs: directQueryJobs,
        error: directQueryError,
        errorCode: directQueryError?.code,
        errorMessage: directQueryError?.message
      });
    }

    // First, try a simple query without joins to see if RLS is the issue
    // Use providerTableId (the provider's table ID) to query jobs.provider_id
    const { data: simpleJobData, error: simpleError } = await supabase
      .from("jobs")
      .select("id, provider_id, status, customer_id, scheduled_date, total_price, address")
      .eq("provider_id", providerTableId)
      .eq("status", status);

    if (simpleError) {
      if (import.meta.env.DEV) {
        console.error(`[proJobsApi.getJobsByStatus] Simple query error:`, simpleError);
      }
      throw new Error(`Failed to fetch ${status} jobs: ${simpleError.message}`);
    }

    if (import.meta.env.DEV) {
      console.log(`[proJobsApi.getJobsByStatus] Simple query found ${simpleJobData?.length || 0} jobs`);
    }

    if (!simpleJobData || simpleJobData.length === 0) {
      if (import.meta.env.DEV) {
        console.log(`[proJobsApi.getJobsByStatus] No ${status} jobs found for provider table ID:`, providerTableId);
      }
      return [];
    }

    // Now fetch with service_categories
    // Using * to get all columns including auth_code_customer and auth_code_provider if they exist
    // Use providerTableId (the provider's table ID) to query jobs.provider_id
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select(`
        *,
        service_category:service_categories(
          id,
          name
        )
      `)
      .eq("provider_id", providerTableId)
      .eq("status", status)
      .order("scheduled_date", { ascending: true });

    // Use jobData if available, otherwise fall back to simpleJobData
    let finalJobData = jobData;
    if (jobError || !jobData) {
      if (import.meta.env.DEV) {
        console.warn(`[proJobsApi.getJobsByStatus] Category join failed, using simple data:`, jobError);
      }
      finalJobData = simpleJobData;
    }

    if (!finalJobData || finalJobData.length === 0) {
      if (import.meta.env.DEV) {
        console.log(`[proJobsApi.getJobsByStatus] No ${status} jobs found for provider:`, validatedId);
      }
      return [];
    }

    if (import.meta.env.DEV) {
      console.log(`[proJobsApi.getJobsByStatus] Found ${finalJobData.length} ${status} jobs (before profile fetch):`, finalJobData);
    }

    // Fetch customer profiles separately (customer_id references auth.users, not profiles directly)
    const customerIds = [...new Set(finalJobData.map((j: any) => j.customer_id).filter(Boolean))];
    
    let profileMap = new Map();
    if (customerIds.length > 0) {
      try {
        // Fetch profiles one by one if .in() query fails, or use .in() if it works
        // Some Supabase setups have issues with .in() queries
        const profilePromises = customerIds.map(async (customerId: string) => {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("id, full_name, photo_url, phone")
              .eq("id", customerId)
              .maybeSingle();

            if (import.meta.env.DEV) {
              console.log(`[proJobsApi.getJobsByStatus] Profile query result for ${customerId}:`, {
                hasData: !!profileData,
                hasError: !!profileError,
                profileData: profileData,
                error: profileError,
                errorCode: profileError?.code,
                errorMessage: profileError?.message
              });
            }

            if (profileError) {
              if (import.meta.env.DEV) {
                console.warn(`[proJobsApi.getJobsByStatus] Error fetching profile for ${customerId}:`, profileError);
              }
              return null;
            }
            
            // Ensure full_name exists and is not empty
            if (profileData && !profileData.full_name) {
              if (import.meta.env.DEV) {
                console.warn(`[proJobsApi.getJobsByStatus] Profile found for ${customerId} but full_name is empty:`, profileData);
              }
            }
            
            if (import.meta.env.DEV && profileData) {
              console.log(`[proJobsApi.getJobsByStatus] Successfully fetched profile for ${customerId}:`, {
                id: profileData.id,
                full_name: profileData.full_name,
                hasFullName: !!profileData.full_name
              });
            }
            
            return profileData;
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn(`[proJobsApi.getJobsByStatus] Exception fetching profile for ${customerId}:`, err);
            }
            return null;
          }
        });

        const profileResults = await Promise.all(profilePromises);
        profileResults.forEach((profile: any, index: number) => {
          const customerId = customerIds[index];
          if (profile) {
            // IMPORTANT: Map by customerId (the key we use for lookup), not profile.id
            // This ensures the lookup works even if profile.id doesn't match customerId exactly
            profileMap.set(customerId, profile);
            if (import.meta.env.DEV) {
              console.log(`[proJobsApi.getJobsByStatus] Mapped profile for customer_id ${customerId}:`, {
                profileId: profile.id,
                full_name: profile.full_name,
                mappedBy: customerId,
                matches: profile.id === customerId
              });
            }
          } else {
            if (import.meta.env.DEV) {
              console.warn(`[proJobsApi.getJobsByStatus] No profile returned for customer_id: ${customerId}`);
            }
          }
        });

        if (import.meta.env.DEV) {
          console.log(`[proJobsApi.getJobsByStatus] Fetched ${profileMap.size} profiles out of ${customerIds.length} customers`);
          console.log(`[proJobsApi.getJobsByStatus] Customer IDs searched:`, customerIds);
          console.log(`[proJobsApi.getJobsByStatus] Profile map keys:`, Array.from(profileMap.keys()));
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error(`[proJobsApi.getJobsByStatus] Error fetching profiles:`, err);
        }
        // Continue without profiles - jobs will still show but without customer details
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[proJobsApi.getJobsByStatus] Found ${finalJobData.length} ${status} jobs for provider table ID:`, providerTableId);
    }

    // Fetch reviews for these jobs
    const jobIds = [...new Set(finalJobData.map((j: any) => j.id).filter(Boolean))];
    const reviewMap = new Map<string, { id: string; rating: number; review_text: string | null; created_at: string; author_id: string; job_id: string }>();
    
    if (jobIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("id, job_id, rating, review_text, created_at, author_id")
        .in("job_id", jobIds);

      if (reviewError) {
        if (import.meta.env.DEV) {
          console.warn("[proJobsApi.getJobsByStatus] Failed to fetch reviews:", reviewError);
        }
      } else if (reviewData) {
        reviewData.forEach((review) => {
          if (review?.job_id) {
            reviewMap.set(review.job_id, review as any);
          }
        });
      }
    }

    // Combine jobs with profiles
    return finalJobData.map((job: any) => {
      const customerId = job.customer_id;
      let profile = profileMap.get(customerId);
      
      // If profile not found in map, try to fetch it directly (fallback)
      if (!profile && customerId) {
        if (import.meta.env.DEV) {
          console.warn(`[proJobsApi.getJobsByStatus] Profile not in map for customer_id: ${customerId}, attempting direct fetch`);
        }
        // Don't do async fetch here as it would require Promise.all - just log for now
        // The profile should have been fetched above, so this is a fallback check
      }
      
      if (import.meta.env.DEV) {
        if (!profile) {
          console.warn(`[proJobsApi.getJobsByStatus] No profile found for customer_id: ${customerId} in job ${job.id}`);
          console.warn(`[proJobsApi.getJobsByStatus] Available profiles in map:`, Array.from(profileMap.keys()));
          console.warn(`[proJobsApi.getJobsByStatus] Customer IDs that were searched:`, customerIds);
        } else {
          console.log(`[proJobsApi.getJobsByStatus] Profile found for customer_id ${customerId}:`, {
            id: profile.id,
            full_name: profile.full_name,
            hasFullName: !!profile.full_name
          });
        }
      }
      
      // Include customer code if job is pending or confirmed (for starting)
      // Include provider code if job is in_progress (for completion)
      const shouldIncludeCustomerCode = job.status === "pending" || job.status === "confirmed";
      const shouldIncludeProviderCode = job.status === "in_progress";

      // Check if job has been rated
      const reviewData = reviewMap.get(job.id);
      const hasRating = Boolean(reviewData);

      return {
        id: job.id || "",
        customer_id: customerId || "",
        status: (job.status || status) as JobWithDetails["status"],
        scheduled_date: job.scheduled_date || "",
        scheduled_time: job.scheduled_time || undefined,
        total_price: Number(job.total_price) || 0,
        base_price: Number(job.base_price) || 0,
        address: job.address || "",
        notes: job.notes || undefined,
        created_at: job.created_at || new Date().toISOString(),
        updated_at: job.updated_at || undefined,
        job_start_time: job.job_start_time || (job.status === "in_progress" ? job.updated_at : undefined),
        materials_cost: job.materials_cost ? Number(job.materials_cost) : undefined,
        
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
        review: reviewData ? {
          id: reviewData.id,
          rating: reviewData.rating,
          review_text: reviewData.review_text,
          created_at: reviewData.created_at,
          author_id: reviewData.author_id,
        } : undefined,
        
        // Customer and service category
        customer: profile ? {
          id: customerId,
          profiles: profile,
        } : undefined,
        service_category: job.service_category || undefined,
        auth_code_customer: shouldIncludeCustomerCode ? (job.auth_code_customer || undefined) : undefined,
        auth_code_provider: shouldIncludeProviderCode ? (job.auth_code_provider || undefined) : undefined,
      };
    });
  },

  /**
   * Accept a job request
   */
  acceptJob: async (jobId: string): Promise<JobWithDetails> => {
    const validatedId = jobIdSchema.parse(jobId);

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", validatedId)
      .select(`
        *,
        service_category:service_categories!inner(
          id,
          name
        )
      `)
      .single();

    if (jobError) {
      throw new Error(`Failed to accept job: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    // Fetch customer profile separately
    const customerId = jobData.customer_id;
    let customer = undefined;
    if (customerId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, phone")
        .eq("id", customerId)
        .single();

      if (profileData) {
        customer = {
          id: customerId,
          profiles: profileData,
        };
      }
    }

    return {
      id: jobData.id || "",
      customer_id: customerId || "",
      status: "confirmed",
      scheduled_date: jobData.scheduled_date || "",
      scheduled_time: jobData.scheduled_time || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: jobData.updated_at || undefined,
      customer,
      service_category: jobData.service_category || undefined,
    };
  },

  /**
   * Decline a job request (for pending jobs only)
   */
  declineJob: async (jobId: string): Promise<void> => {
    const validatedId = jobIdSchema.parse(jobId);

    const { error } = await supabase
      .from("jobs")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", validatedId);

    if (error) {
      throw new Error(`Failed to decline job: ${error.message}`);
    }
  },

  /**
   * Cancel a job (for confirmed or in_progress jobs)
   * Updates status to cancelled and ensures it reflects on both customer and provider dashboards
   */
  cancelJob: async (params: { jobId: string; reason: string }): Promise<JobWithDetails> => {
    const cancelJobSchema = z.object({
      jobId: jobIdSchema,
      reason: z.string().min(10, "Please provide a reason for cancellation"),
    });
    
    const validated = cancelJobSchema.parse(params);

    // First, get the job to verify it exists and get customer_id for cache invalidation
    const { data: existingJob, error: fetchError } = await supabase
      .from("jobs")
      .select("id, provider_id, customer_id, status, notes")
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
    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
        notes: existingJob.notes 
          ? `${existingJob.notes}\n\nCancelled by provider: ${validated.reason}`
          : `Cancelled by provider: ${validated.reason}`,
      })
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories!inner(
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

    // Fetch customer profile separately
    const customerId = updatedJob.customer_id;
    let customer = undefined;
    if (customerId) {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url, phone")
          .eq("id", customerId)
          .maybeSingle();

        if (profileData) {
          customer = {
            id: customerId,
            profiles: profileData,
          };
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("[proJobsApi.cancelJob] Error fetching customer:", err);
        }
      }
    }

    return {
      id: updatedJob.id || validated.jobId,
      customer_id: customerId || "",
      status: "cancelled" as JobWithDetails["status"],
      scheduled_date: updatedJob.scheduled_date || "",
      scheduled_time: updatedJob.scheduled_time || undefined,
      total_price: Number(updatedJob.total_price) || 0,
      base_price: Number(updatedJob.base_price) || 0,
      address: updatedJob.address || "",
      notes: updatedJob.notes || undefined,
      created_at: updatedJob.created_at || new Date().toISOString(),
      updated_at: updatedJob.updated_at || undefined,
      job_start_time: updatedJob.job_start_time || undefined,
      materials_cost: updatedJob.materials_cost ? Number(updatedJob.materials_cost) : undefined,
      customer,
      service_category: updatedJob.service_category || undefined,
    };
  },

  /**
   * Start a job with customer auth code
   * Uses hash comparison for security
   * Captures server-side timestamp for billing
   */
  startJob: async (params: { jobId: string; customerAuthCode: string }): Promise<JobWithDetails> => {
    const validated = startJobSchema.parse(params);

    // First, verify the auth code hash
    const { data: existingJob, error: fetchError } = await supabase
      .from("jobs")
      .select("customer_start_code_hash, status")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !existingJob) {
      throw new Error("Job not found");
    }

    if (!existingJob.customer_start_code_hash) {
      throw new Error("No auth code found for this job");
    }

    // Verify job is confirmed (not already started)
    if (existingJob.status !== "confirmed") {
      throw new Error("Job must be confirmed before starting");
    }

    // Hash the input code and compare with stored hash
    const inputHash = await hashAuthCode(validated.customerAuthCode);
    if (existingJob.customer_start_code_hash !== inputHash) {
      throw new Error("Invalid auth code");
    }

    // Update status and capture server-side start timestamp
    const startTime = new Date().toISOString();
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update({ 
        status: "in_progress", 
        job_started_at: startTime, // NEW: Server-side timestamp for billing
        updated_at: startTime
      })
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories!inner(
          id,
          name
        )
      `)
      .single();

    if (jobError) {
      throw new Error(`Failed to start job: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    // Fetch customer profile separately
    const customerId = jobData.customer_id;
    let customer = undefined;
    if (customerId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, phone")
        .eq("id", customerId)
        .single();

      if (profileData) {
        customer = {
          id: customerId,
          profiles: profileData,
        };
      }
    }

    return {
      id: jobData.id || "",
      customer_id: customerId || "",
      status: "in_progress",
      scheduled_date: jobData.scheduled_date || "",
      scheduled_time: jobData.scheduled_time || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: jobData.updated_at || undefined,
      job_start_time: jobData.updated_at || undefined,
      job_started_at: jobData.job_started_at || undefined, // NEW: Server timestamp
      hourly_rate_snapshot: jobData.hourly_rate_snapshot ? Number(jobData.hourly_rate_snapshot) : undefined,
      customer,
      service_category: jobData.service_category || undefined,
    };
  },

  /**
   * Complete a job with provider auth code
   * Uses hash comparison for security
   */
  completeJob: async (params: { jobId: string; providerAuthCode: string }): Promise<JobWithDetails> => {
    const validated = completeJobSchema.parse(params);

    // First, verify the auth code hash
    const { data: existingJob, error: fetchError } = await supabase
      .from("jobs")
      .select("provider_end_code_hash")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !existingJob) {
      throw new Error("Job not found");
    }

    if (!existingJob.provider_end_code_hash) {
      throw new Error("No auth code found for this job");
    }

    // Hash the input code and compare with stored hash
    const inputHash = await hashAuthCode(validated.providerAuthCode);
    if (existingJob.provider_end_code_hash !== inputHash) {
      throw new Error("Invalid auth code");
    }

    // Update status if code is valid
    const updateData: Record<string, unknown> = {
      status: "completed",
      updated_at: new Date().toISOString(),
    };

    if (validated.materials_cost !== undefined) {
      updateData.materials_cost = validated.materials_cost;
    }

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories!inner(
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

    // Fetch customer profile separately
    const customerId = jobData.customer_id;
    let customer = undefined;
    if (customerId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, phone")
        .eq("id", customerId)
        .single();

      if (profileData) {
        customer = {
          id: customerId,
          profiles: profileData,
        };
      }
    }

    return {
      id: jobData.id || "",
      customer_id: customerId || "",
      status: "completed",
      scheduled_date: jobData.scheduled_date || "",
      scheduled_time: jobData.scheduled_time || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: jobData.updated_at || undefined,
      customer,
      service_category: jobData.service_category || undefined,
    };
  },

  /**
   * Update job status
   */
  updateJobStatus: async (params: { jobId: string; status: string }): Promise<JobWithDetails> => {
    const validated = updateJobStatusSchema.parse(params);

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update({ 
        status: validated.status as JobWithDetails["status"],
        updated_at: new Date().toISOString() 
      })
      .eq("id", validated.jobId)
      .select(`
        *,
        service_category:service_categories!inner(
          id,
          name
        )
      `)
      .single();

    if (jobError) {
      throw new Error(`Failed to update job status: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    // Fetch customer profile separately
    const customerId = jobData.customer_id;
    let customer = undefined;
    if (customerId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, phone")
        .eq("id", customerId)
        .single();

      if (profileData) {
        customer = {
          id: customerId,
          profiles: profileData,
        };
      }
    }

    return {
      id: jobData.id || "",
      customer_id: customerId || "",
      status: validated.status as JobWithDetails["status"],
      scheduled_date: jobData.scheduled_date || "",
      scheduled_time: jobData.scheduled_time || undefined,
      total_price: Number(jobData.total_price) || 0,
      base_price: Number(jobData.base_price) || 0,
      address: jobData.address || "",
      notes: jobData.notes || undefined,
      created_at: jobData.created_at || new Date().toISOString(),
      updated_at: jobData.updated_at || undefined,
      customer,
      service_category: jobData.service_category || undefined,
    };
  },

  /**
   * Generate provider end code for an in_progress job
   * Creates a new code and stores both plain and hashed versions
   */
  generateProviderEndCode: async (params: { jobId: string }): Promise<{ providerCode: string }> => {
    const validated = generateProviderCodeSchema.parse(params);

    // First, verify the job exists and is in the correct status
    const { data: existingJob, error: fetchError } = await supabase
      .from("jobs")
      .select("id, status, provider_id")
      .eq("id", validated.jobId)
      .single();

    if (fetchError || !existingJob) {
      throw new Error("Job not found");
    }

    if (existingJob.status !== "in_progress") {
      throw new Error("Code can only be generated for jobs in progress");
    }

    // Generate new provider end code
    const authCodeProvider = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Hash code for secure verification
    const hashedProviderCode = await hashAuthCode(authCodeProvider);

    // Update job with new code (both plain and hash)
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .update({
        auth_code_provider: authCodeProvider,
        provider_end_code_hash: hashedProviderCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.jobId)
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to generate code: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error("Job not found");
    }

    if (import.meta.env.DEV) {
      console.log("[proJobsApi.generateProviderEndCode] Generated code for job:", {
        jobId: validated.jobId,
        providerCode: authCodeProvider,
      });
    }

    return {
      providerCode: authCodeProvider,
    };
  },
};

// Job Estimates API (for on-site estimate revisions)
export const jobEstimatesApi = {
  /**
   * Create a revised estimate for a job (before job starts)
   */
  createEstimate: async (params: {
    jobId: string;
    revisedHours: number;
    revisedMaterialsCost: number;
    explanation: string;
    photoUrls?: string[];
  }) => {
    const { jobId, revisedHours, revisedMaterialsCost, explanation, photoUrls } = params;

    // Validate inputs
    if (!jobId || !explanation) {
      throw new Error("Job ID and explanation are required");
    }

    if (revisedHours <= 0) {
      throw new Error("Revised hours must be greater than 0");
    }

    if (revisedMaterialsCost < 0) {
      throw new Error("Materials cost cannot be negative");
    }

    // Verify job exists and is in confirmed status (not yet started)
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status, provider_id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    if (job.status !== "confirmed") {
      throw new Error("Estimates can only be created for confirmed jobs before they start");
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Create estimate
    const { data: estimate, error: estimateError } = await supabase
      .from("job_estimates")
      .insert({
        job_id: jobId,
        revised_hours: revisedHours,
        revised_materials_cost: revisedMaterialsCost,
        explanation,
        photo_urls: photoUrls || [],
        created_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (estimateError) {
      throw new Error(`Failed to create estimate: ${estimateError.message}`);
    }

    return estimate;
  },

  /**
   * Get estimate for a job
   */
  getEstimate: async (jobId: string) => {
    const { data: estimate, error } = await supabase
      .from("job_estimates")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch estimate: ${error.message}`);
    }

    return estimate;
  },

  /**
   * Customer approves an estimate
   */
  approveEstimate: async (estimateId: string, response?: string) => {
    const { data: estimate, error: fetchError } = await supabase
      .from("job_estimates")
      .select("*, jobs!inner(customer_id, id)")
      .eq("id", estimateId)
      .single();

    if (fetchError || !estimate) {
      throw new Error("Estimate not found");
    }

    // Verify user is the customer
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || (estimate.jobs as any).customer_id !== user.id) {
      throw new Error("Unauthorized");
    }

    // Update estimate status
    const { error: updateEstimateError } = await supabase
      .from("job_estimates")
      .update({
        status: "approved",
        customer_response: response || "Approved",
        responded_at: new Date().toISOString(),
      })
      .eq("id", estimateId);

    if (updateEstimateError) {
      throw new Error(`Failed to approve estimate: ${updateEstimateError.message}`);
    }

    // Update job with approved estimate
    const { error: updateJobError } = await supabase
      .from("jobs")
      .update({
        approved_estimated_hours: estimate.revised_hours,
        approved_materials_cost: estimate.revised_materials_cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimate.job_id);

    if (updateJobError) {
      throw new Error(`Failed to update job: ${updateJobError.message}`);
    }

    return true;
  },

  /**
   * Customer rejects an estimate
   */
  rejectEstimate: async (estimateId: string, response?: string) => {
    const { data: estimate, error: fetchError } = await supabase
      .from("job_estimates")
      .select("*, jobs!inner(customer_id)")
      .eq("id", estimateId)
      .single();

    if (fetchError || !estimate) {
      throw new Error("Estimate not found");
    }

    // Verify user is the customer
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || (estimate.jobs as any).customer_id !== user.id) {
      throw new Error("Unauthorized");
    }

    // Update estimate status
    const { error: updateError } = await supabase
      .from("job_estimates")
      .update({
        status: "rejected",
        customer_response: response || "Rejected",
        responded_at: new Date().toISOString(),
      })
      .eq("id", estimateId);

    if (updateError) {
      throw new Error(`Failed to reject estimate: ${updateError.message}`);
    }

    return true;
  },
};

// Earnings API
export const proEarningsApi = {
  /**
   * Get earnings data for a provider
   */
  getEarnings: async (providerId: string): Promise<EarningsData> => {
    const validatedId = providerIdSchema.parse(providerId);
    
    // Get the provider table ID (may differ from auth user ID)
    const providerTableId = await getProviderTableId(validatedId);
    
    if (import.meta.env.DEV) {
      console.log(`[proEarningsApi.getEarnings] Auth user ID:`, validatedId);
      console.log(`[proEarningsApi.getEarnings] Provider table ID:`, providerTableId);
    }

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    const monthStart = new Date(now.setMonth(now.getMonth() - 1));

    // Get completed jobs with payments
    // Use providerTableId (the provider's table ID) to query payments/jobs
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        amount,
        created_at,
        processed_at,
        status,
        jobs!inner(
          id,
          scheduled_date,
          total_price,
          payment_amount,
          quote_total
        )
      `)
      .eq("provider_id", providerTableId)
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    let paymentsData: any[] = [];

    if (paymentsError || !payments || payments.length === 0) {
      // Fallback: use completed jobs with payment_status = 'completed'
      // Use providerTableId (the provider's table ID) to query jobs
      const { data: completedJobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, total_price, payment_amount, quote_total, scheduled_date, updated_at, payment_completed_at")
        .eq("provider_id", providerTableId)
        .or("status.eq.completed,payment_status.eq.completed")
        .order("updated_at", { ascending: true });

      if (!jobsError && completedJobs) {
        paymentsData = completedJobs.map((job: any) => ({
          // Use payment_amount if available, then quote_total, then fall back to total_price
          amount: job.payment_amount || job.quote_total || job.total_price,
          created_at: job.payment_completed_at || job.updated_at || job.scheduled_date,
          processed_at: job.payment_completed_at || job.updated_at || job.scheduled_date,
          status: "completed",
          jobs: { id: job.id, scheduled_date: job.scheduled_date },
        }));
      }
    } else {
      // Map payments to use payment_amount from jobs if available
      paymentsData = payments.map((p: any) => ({
        ...p,
        amount: p.jobs?.payment_amount || p.jobs?.quote_total || p.amount,
      }));
    }

    // Get pending payouts
    // Use providerTableId (the provider's table ID) to query payments
    const { data: pendingPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("provider_id", providerTableId)
      .eq("status", "pending");

    const pendingPayouts = (pendingPayments || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    // Calculate earnings by period
    const todayPayments = paymentsData.filter(
      (p) => new Date(p.created_at) >= todayStart
    );
    const weekPayments = paymentsData.filter(
      (p) => new Date(p.created_at) >= weekStart
    );
    const monthPayments = paymentsData.filter(
      (p) => new Date(p.created_at) >= monthStart
    );

    // Generate sparkline data
    const generateSparkline = (days: number, payments: any[]) => {
      const sparkline: number[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayPayments = payments.filter((p) => {
          const paymentDate = new Date(p.created_at);
          return paymentDate >= date && paymentDate < nextDate;
        });

        const dayTotal = dayPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        );
        sparkline.push(dayTotal);
      }
      return sparkline;
    };

    return {
      today: {
        amount: todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        jobs: todayPayments.length,
        sparkline: generateSparkline(7, todayPayments),
      },
      week: {
        amount: weekPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        jobs: weekPayments.length,
        sparkline: generateSparkline(7, weekPayments),
      },
      month: {
        amount: monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        jobs: monthPayments.length,
        sparkline: generateSparkline(30, monthPayments),
      },
      lifetime: {
        amount: paymentsData.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        jobs: paymentsData.length,
        sparkline: generateSparkline(30, paymentsData),
      },
      pendingPayouts,
      nextPayoutDate: undefined, // TODO: Calculate from payout schedule
    };
  },

  /**
   * Get payout history
   */
  getPayouts: async (providerId: string): Promise<Payout[]> => {
    const validatedId = providerIdSchema.parse(providerId);

    // Get the provider table ID (may differ from auth user ID)
    const providerTableId = await getProviderTableId(validatedId);
    
    if (import.meta.env.DEV) {
      console.log(`[proEarningsApi.getPayouts] Auth user ID:`, validatedId);
      console.log(`[proEarningsApi.getPayouts] Provider table ID:`, providerTableId);
    }

    // Use providerTableId (the provider's table ID) to query payments
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, status, created_at, processed_at, payment_method")
      .eq("provider_id", providerTableId)
      .in("status", ["pending", "processing", "completed", "failed"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch payouts: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((p: unknown) => {
      const payment = p as Record<string, unknown>;
      return {
        id: (payment.id as string) || "",
        amount: Number(payment.amount) || 0,
        status: (payment.status || "pending") as Payout["status"],
        requested_at: (payment.created_at as string) || new Date().toISOString(),
        processed_at: (payment.processed_at as string) || undefined,
        payment_method: (payment.payment_method as string) || undefined,
      };
    });
  },

  /**
   * Request a payout
   */
  requestPayout: async (providerId: string, amount: number): Promise<Payout> => {
    const validatedId = providerIdSchema.parse(providerId);
    
    if (amount <= 0) {
      throw new Error("Payout amount must be greater than 0");
    }

    // This would typically create a payout request
    // For now, we'll create a pending payment record
    const { data, error } = await supabase
      .from("payments")
      .insert({
        provider_id: validatedId,
        amount,
        status: "pending",
        payment_method: "bank_transfer",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to request payout: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create payout request");
    }

    const payment = data as Record<string, unknown>;
    return {
      id: (payment.id as string) || "",
      amount: Number(payment.amount) || 0,
      status: "pending",
      requested_at: (payment.created_at as string) || new Date().toISOString(),
      processed_at: undefined,
      payment_method: (payment.payment_method as string) || undefined,
    };
  },
};

// Profile API
export const proProfileApi = {
  /**
   * Get provider profile
   * Uses providers.user_id -> auth.users.id relationship, then joins profiles via users.id
   */
  getProfile: async (providerId: string): Promise<ProProfile> => {
    const validatedId = providerIdSchema.parse(providerId);

    // First, try to find provider by user_id (new structure: providers.user_id -> auth.users.id)
    let providerData: any = null;
    let userId: string = validatedId;

    // Try to find provider by user_id field first
    const { data: providerByUserId, error: userIdError } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", validatedId)
      .maybeSingle();

    if (providerByUserId && !userIdError) {
      providerData = providerByUserId;
      userId = validatedId; // user_id matches auth.users.id
    } else {
      // Fallback: try by id (legacy structure where providers.id = auth.users.id)
      const { data: providerById, error: idError } = await supabase
        .from("providers")
        .select("*")
        .eq("id", validatedId)
        .maybeSingle();

      if (providerById && !idError) {
        providerData = providerById;
        userId = validatedId; // id matches auth.users.id
      } else {
        throw new Error(`Failed to fetch profile: ${userIdError?.message || idError?.message || "Provider not found"}`);
      }
    }

    if (!providerData) {
      throw new Error("Profile not found");
    }

    // Now join profiles via the shared auth.users.id relationship
    // Since both providers.user_id (or providers.id) and profiles.id reference auth.users.id,
    // we can query profiles where profiles.id = userId
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, photo_url, city, phone, email")
      .eq("id", userId)
      .maybeSingle();

    // Fetch service_categories data
    const { data: categoryData } = await supabase
      .from("service_categories")
      .select("name")
      .eq("id", providerData.category_id)
      .maybeSingle();

    const p = providerData as Record<string, unknown>;
    return {
      id: (p.id as string) || validatedId,
      category_id: Number(p.category_id) || 0,
      display_name: (p.display_name as string) || undefined,
      business_name: (p.business_name as string) || undefined,
      profile_image_url: (p.profile_image_url as string) || undefined,
      bio: (p.bio as string) || undefined,
      hourly_rate: Number(p.hourly_rate) || 0,
      minimum_job_price: p.minimum_job_price !== null && p.minimum_job_price !== undefined
        ? Number(p.minimum_job_price)
        : undefined,
      rating: Number(p.rating) || 0,
      review_count: Number(p.review_count) || 0,
      is_active: Boolean(p.is_active),
      is_verified: Boolean(p.is_verified),
      avg_response_time: Number(p.avg_response_time) || 0,
      profiles: profileData ? {
        full_name: profileData.full_name || "",
        photo_url: profileData.photo_url || undefined,
        city: profileData.city || undefined,
        phone: profileData.phone || undefined,
        email: profileData.email || undefined,
      } : undefined,
      service_categories: categoryData ? {
        name: categoryData.name || "",
      } : undefined,
    };
  },

  /**
   * Update provider profile
   * Uses providers.user_id -> auth.users.id relationship, then joins profiles via users.id
   */
  updateProfile: async (providerId: string, updates: Partial<ProProfile>): Promise<ProProfile> => {
    const validatedId = providerIdSchema.parse(providerId);
    const validatedUpdates = updateProfileSchema.parse(updates);

    // First, find the provider record by user_id or id
    let providerTableId: string | null = null;
    let userId: string = validatedId;

    // Try to find provider by user_id field first (new structure)
    const { data: providerByUserId } = await supabase
      .from("providers")
      .select("id, user_id")
      .eq("user_id", validatedId)
      .maybeSingle();

    if (providerByUserId) {
      providerTableId = providerByUserId.id;
      userId = validatedId; // user_id matches auth.users.id
    } else {
      // Fallback: try by id (legacy structure)
      const { data: providerById } = await supabase
        .from("providers")
        .select("id")
        .eq("id", validatedId)
        .maybeSingle();

      if (providerById) {
        providerTableId = providerById.id;
        userId = validatedId; // id matches auth.users.id
      } else {
        throw new Error("Provider not found");
      }
    }

    // Separate updates: business_name goes to providers, city goes to profiles
    const providerUpdates: Record<string, unknown> = {};
    const profileUpdates: Record<string, unknown> = {};

    // Fields that go to providers table
    if (validatedUpdates.bio !== undefined) providerUpdates.bio = validatedUpdates.bio;
    if (validatedUpdates.hourly_rate !== undefined) providerUpdates.hourly_rate = validatedUpdates.hourly_rate;
    if (validatedUpdates.minimum_job_price !== undefined) providerUpdates.minimum_job_price = validatedUpdates.minimum_job_price;
    if (validatedUpdates.is_active !== undefined) providerUpdates.is_active = validatedUpdates.is_active;
    if (validatedUpdates.business_name !== undefined) providerUpdates.business_name = validatedUpdates.business_name;

    // Fields that go to profiles table
    if (validatedUpdates.city !== undefined) profileUpdates.city = validatedUpdates.city;

    // Update providers table using the provider table ID
    let providerData: any = null;
    if (Object.keys(providerUpdates).length > 0) {
      const { data, error: updateError } = await supabase
        .from("providers")
        .update(providerUpdates)
        .eq("id", providerTableId)
        .select("*")
        .single();

      if (updateError) {
        throw new Error(`Failed to update provider profile: ${updateError.message}`);
      }

      if (!data) {
        throw new Error("Provider not found");
      }

      providerData = data;
    } else {
      // If no provider updates, fetch existing data
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .eq("id", providerTableId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch provider: ${error.message}`);
      }

      providerData = data;
    }

    // Update profiles table if city is being updated
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);

      if (profileUpdateError) {
        throw new Error(`Failed to update profile city: ${profileUpdateError.message}`);
      }
    }

    // Join profiles via the shared auth.users.id relationship
    // Since both providers.user_id (or providers.id) and profiles.id reference auth.users.id,
    // we can query profiles where profiles.id = userId
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, photo_url, city, phone, email")
      .eq("id", userId)
      .maybeSingle();

    // Fetch service_categories data
    const { data: categoryData } = await supabase
      .from("service_categories")
      .select("name")
      .eq("id", providerData.category_id)
      .maybeSingle();

    const p = providerData as Record<string, unknown>;
    return {
      id: (p.id as string) || providerTableId || validatedId,
      category_id: Number(p.category_id) || 0,
      display_name: (p.display_name as string) || undefined,
      business_name: (p.business_name as string) || undefined,
      profile_image_url: (p.profile_image_url as string) || undefined,
      bio: (p.bio as string) || undefined,
      hourly_rate: Number(p.hourly_rate) || 0,
      minimum_job_price: p.minimum_job_price !== null && p.minimum_job_price !== undefined
        ? Number(p.minimum_job_price)
        : undefined,
      rating: Number(p.rating) || 0,
      review_count: Number(p.review_count) || 0,
      is_active: Boolean(p.is_active),
      is_verified: Boolean(p.is_verified),
      avg_response_time: Number(p.avg_response_time) || 0,
      profiles: profileData ? {
        full_name: profileData.full_name || "",
        photo_url: profileData.photo_url || undefined,
        city: profileData.city || undefined,
        phone: profileData.phone || undefined,
        email: profileData.email || undefined,
      } : undefined,
      service_categories: categoryData ? {
        name: categoryData.name || "",
      } : undefined,
    };
  },

  /**
   * Upload verification documents
   */
  uploadDocuments: async (providerId: string, files: File[]): Promise<VerificationDocument[]> => {
    const validatedId = providerIdSchema.parse(providerId);

    if (!files || files.length === 0) {
      throw new Error("No files provided");
    }

    // Upload files to Supabase Storage
    const uploadedDocs: VerificationDocument[] = [];

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${validatedId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("verification-documents")
        .getPublicUrl(fileName);

      uploadedDocs.push({
        id: uploadData.path,
        type: file.name.toLowerCase().includes("license") ? "license" : 
              file.name.toLowerCase().includes("certificate") ? "certificate" : "id",
        url: publicUrl,
        status: "pending",
        uploaded_at: new Date().toISOString(),
      });
    }

    return uploadedDocs;
  },

  /**
   * Save bank details
   */
  saveBankDetails: async (providerId: string, bankDetails: BankDetails): Promise<void> => {
    const validatedId = providerIdSchema.parse(providerId);
    const validatedDetails = bankDetailsSchema.parse(bankDetails);

    // Map legacy bank details to payout method
    const { data, error } = await supabase.functions.invoke("create-payout-method", {
      body: {
        provider_id: validatedId,
        type: "bank",
        label: validatedDetails.bank_name,
        account_name: validatedDetails.account_holder_name,
        account_number: validatedDetails.account_number,
        bank_code: validatedDetails.routing_number,
        country: "KE",
        is_default: true,
      },
      });

    if (error) {
      throw new Error(`Failed to save bank details: ${error.message}`);
    }

    // Optionally create subaccount immediately
    const payoutMethodId = (data as any)?.payout_method?.id;
    if (payoutMethodId) {
      const { error: subError } = await supabase.functions.invoke("create-subaccount", {
        body: {
          provider_id: validatedId,
          payout_method_id: payoutMethodId,
        },
      });

      if (subError) {
        console.warn("[saveBankDetails] Subaccount creation failed:", subError.message);
      }
    }
  },
};

async function resolveProviderTableId(providerId: string): Promise<string> {
  const validatedId = providerIdSchema.parse(providerId);

  console.log(`[DEBUG resolveProviderTableId] Input providerId (auth user ID):`, validatedId);

  const { data: providerByUserId, error: userIdError } = await supabase
    .from("providers")
    .select("id, user_id")
    .eq("user_id", validatedId)
    .maybeSingle();

  console.log(`[DEBUG resolveProviderTableId] Query by user_id result:`, {
    found: !!providerByUserId,
    providerTableId: providerByUserId?.id,
    user_id: providerByUserId?.user_id,
    error: userIdError,
  });

  if (providerByUserId?.id) {
    console.log(`[DEBUG resolveProviderTableId] ✅ Resolved via user_id:`, providerByUserId.id);
    return providerByUserId.id as string;
  }

  const { data: providerById, error: idError } = await supabase
    .from("providers")
    .select("id")
    .eq("id", validatedId)
    .maybeSingle();

  console.log(`[DEBUG resolveProviderTableId] Query by id (legacy) result:`, {
    found: !!providerById,
    providerTableId: providerById?.id,
    error: idError,
  });

  if (providerById?.id) {
    console.log(`[DEBUG resolveProviderTableId] ✅ Resolved via id (legacy):`, providerById.id);
    return providerById.id as string;
  }

  console.warn(`[DEBUG resolveProviderTableId] ⚠️ Could not resolve provider table ID, using input as-is:`, validatedId);
  return validatedId;
}

// Payout Methods API
export const proPayoutMethodsApi = {
  list: async (providerId: string): Promise<PayoutMethod[]> => {
    console.log(`[DEBUG proPayoutMethodsApi.list] Input providerId (auth user ID):`, providerId);
    
    // Prefer Edge Function to bypass potential RLS issues
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke("list-payout-methods", {
        body: { provider_id: providerId },
      });

      if (!functionError && functionData && typeof functionData === "object") {
        const payoutMethods = (functionData as any).payout_methods;
        if (Array.isArray(payoutMethods)) {
          console.log(`[DEBUG proPayoutMethodsApi.list] Edge function returned:`, {
            count: payoutMethods.length,
            methods: payoutMethods.map((m: any) => ({ id: m.id, type: m.type, label: m.label })),
          });
          return payoutMethods as PayoutMethod[];
        }
      }

      if (functionError) {
        console.warn("[proPayoutMethodsApi.list] Edge function failed:", {
          message: functionError.message,
          name: functionError.name,
          context: functionError.context,
        });
        console.warn("[proPayoutMethodsApi.list] Falling back to direct query");
      }
    } catch (err: any) {
      console.error("[proPayoutMethodsApi.list] Edge function invocation error:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      console.warn("[proPayoutMethodsApi.list] Falling back to direct query due to error");
    }

    const providerTableId = await resolveProviderTableId(providerId);
    const providerIds = providerTableId === providerId ? [providerTableId] : [providerTableId, providerId];
    console.log(`[DEBUG proPayoutMethodsApi.list] Resolved providerTableId:`, providerTableId);
    console.log(`[DEBUG proPayoutMethodsApi.list] Using providerIds for query:`, providerIds);

    const { data, error } = await supabase
      .from("provider_payout_methods")
      .select("*")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch payout methods: ${error.message}`);
    }

    return (data || []) as PayoutMethod[];
  },

  create: async (payload: {
    providerId: string;
    type: "bank" | "mpesa" | "mobile_money";
    label?: string;
    accountName: string;
    accountNumber: string;
    bankCode?: string;
    country?: string;
    isDefault?: boolean;
  }): Promise<PayoutMethod> => {
    // Verify Supabase client is configured
    if (!supabase) {
      throw new Error("Supabase client is not configured. Please check your environment variables.");
    }

    const providerTableId = await resolveProviderTableId(payload.providerId);

    console.log("[proPayoutMethodsApi.create] Invoking create-payout-method with:", {
      providerTableId,
      type: payload.type,
      accountName: payload.accountName,
      accountNumber: payload.accountNumber ? "***" : undefined,
    });

    try {
      const { data, error } = await supabase.functions.invoke("create-payout-method", {
        body: {
          provider_id: providerTableId,
          type: payload.type,
          label: payload.label,
          account_name: payload.accountName,
          account_number: payload.accountNumber,
          bank_code: payload.bankCode,
          country: payload.country || "KE",
          is_default: payload.isDefault ?? true,
        },
      });

      if (error) {
        console.error("[proPayoutMethodsApi.create] Edge Function error:", {
          message: error.message,
          name: error.name,
          stack: error.stack,
          context: error.context,
        });

        let errorMessage = error.message || "Unknown error";
        const context = (error as any)?.context;
        
        // Check if it's a network/connection error
        if (error.message?.includes("Failed to send") || error.message?.includes("fetch")) {
          errorMessage = "Unable to connect to server. Please check your internet connection and ensure the Edge Function is deployed.";
        }
        
        if (context?.response) {
          try {
            const responseText = await context.response.text();
            if (responseText) {
              try {
                const parsed = JSON.parse(responseText);
                errorMessage = parsed?.error || parsed?.message || responseText;
              } catch {
                errorMessage = responseText;
              }
            }
          } catch (parseError) {
            console.warn("[proPayoutMethodsApi.create] Failed to parse error response:", parseError);
          }
        }
        
        const status = (context as any)?.status ?? (context as any)?.response?.status;
        const statusInfo = status ? ` (HTTP ${status})` : "";
        throw new Error(`Failed to create payout method: ${errorMessage}${statusInfo}`);
      }

      if (!data || typeof data !== "object") {
        throw new Error("Edge Function returned invalid response");
      }

      if ("error" in data) {
        throw new Error((data as any).error || "Edge Function returned an error");
      }

      const payoutMethod = (data as any).payout_method;
      if (!payoutMethod) {
        throw new Error("Edge Function response missing payout_method");
      }

      return payoutMethod as PayoutMethod;
    } catch (err: any) {
      // Re-throw if it's already our formatted error
      if (err.message?.includes("Failed to create payout method")) {
        throw err;
      }
      
      // Handle network/connection errors
      if (err.message?.includes("fetch") || err.message?.includes("network") || err.name === "TypeError") {
        throw new Error("Failed to create payout method: Unable to connect to server. Please check your internet connection and ensure the Edge Function 'create-payout-method' is deployed.");
      }
      
      throw new Error(`Failed to create payout method: ${err.message || "Unknown error"}`);
    }
  },

  createSubaccount: async (providerId: string, payoutMethodId: string): Promise<void> => {
    const providerTableId = await resolveProviderTableId(providerId);

    console.log("[proPayoutMethodsApi.createSubaccount] Invoking create-subaccount with:", {
      providerTableId,
      payoutMethodId,
    });

    try {
      const { data, error } = await supabase.functions.invoke("create-subaccount", {
        body: {
          provider_id: providerTableId,
          payout_method_id: payoutMethodId,
        },
      });

      if (error) {
        console.error("[proPayoutMethodsApi.createSubaccount] Edge Function error:", {
          message: error.message,
          name: error.name,
          context: error.context,
        });

        let errorMessage = error.message || "Unknown error";
        const context = (error as any)?.context;
        
        if (context?.response) {
          try {
            const responseText = await context.response.text();
            if (responseText) {
              try {
                const parsed = JSON.parse(responseText);
                errorMessage = parsed?.error || parsed?.message || responseText;
              } catch {
                errorMessage = responseText;
              }
            }
          } catch (parseError) {
            console.warn("[proPayoutMethodsApi.createSubaccount] Failed to parse error response:", parseError);
          }
        }
        
        const status = (context as any)?.status ?? (context as any)?.response?.status;
        const statusInfo = status ? ` (HTTP ${status})` : "";
        throw new Error(`Failed to create subaccount: ${errorMessage}${statusInfo}`);
      }

      if (data && typeof data === "object" && "error" in data) {
        throw new Error((data as any).error || "Edge Function returned an error");
      }

      console.log("[proPayoutMethodsApi.createSubaccount] Subaccount created successfully:", data);
    } catch (err: any) {
      // Re-throw if it's already our formatted error
      if (err.message?.includes("Failed to create subaccount")) {
        throw err;
      }
      
      // Handle network/connection errors
      if (err.message?.includes("fetch") || err.message?.includes("network") || err.name === "TypeError") {
        throw new Error("Failed to create subaccount: Unable to connect to server. Please check your internet connection and ensure the Edge Function 'create-subaccount' is deployed.");
      }
      
      throw new Error(`Failed to create subaccount: ${err.message || "Unknown error"}`);
    }
  },

  setDefault: async (providerId: string, payoutMethodId: string): Promise<void> => {
    const providerTableId = await resolveProviderTableId(providerId);
    const providerIds = providerTableId === providerId ? [providerTableId] : [providerTableId, providerId];

    const { error } = await supabase
      .from("provider_payout_methods")
      .update({ is_default: false })
      .in("provider_id", providerIds);

    if (error) {
      throw new Error(`Failed to unset default payout method: ${error.message}`);
    }

    const { error: setError } = await supabase
      .from("provider_payout_methods")
      .update({ is_default: true })
      .eq("id", payoutMethodId)
      .in("provider_id", providerIds);

    if (setError) {
      throw new Error(`Failed to set default payout method: ${setError.message}`);
    }
  },
};








