import { supabase } from "@/integrations/supabase/client";

export interface ProProfile {
  id: string;
  category_id: number;
  bio?: string;
  hourly_rate: number;
  rating: number;
  review_count: number;
  is_active: boolean;
  is_verified: boolean;
  avg_response_time: number;
  profiles?: {
    full_name: string;
    photo_url?: string;
    city?: string;
  };
  service_categories?: {
    name: string;
  };
}

export interface EarningsData {
  today: { amount: number; jobs: number; sparkline: number[] };
  week: { amount: number; jobs: number; sparkline: number[] };
  month: { amount: number; jobs: number; sparkline: number[] };
  lifetime: { amount: number; jobs: number; sparkline: number[] };
}

export interface JobRequest {
  id: string;
  customer_id: string;
  category_id: number;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  scheduled_date: string;
  total_price: number;
  address: string;
  notes?: string;
  created_at: string;
  customers?: {
    profiles?: {
      full_name: string;
      photo_url?: string;
    };
  };
  service_categories?: {
    name: string;
  };
}

export interface Job {
  id: string;
  customer_id: string;
  status: string;
  scheduled_date: string;
  total_price: number;
  address: string;
  customers?: {
    profiles?: {
      full_name: string;
    };
  };
  service_categories?: {
    name: string;
  };
}

// Pro Data API
export const proApi = {
  /**
   * Get provider profile
   * Uses providers.user_id -> auth.users.id relationship, then joins profiles via users.id
   */
  getProfile: async (id: string): Promise<ProProfile> => {
    // First, try to find provider by user_id (new structure: providers.user_id -> auth.users.id)
    let providerData: any = null;
    let userId: string = id;

    const { data: providerByUserId } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (providerByUserId) {
      providerData = providerByUserId;
      userId = id; // user_id matches auth.users.id
    } else {
      // Fallback: try by id (legacy structure where providers.id = auth.users.id)
      const { data: providerById, error: idError } = await supabase
        .from("providers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (providerById && !idError) {
        providerData = providerById;
        userId = id; // id matches auth.users.id
      } else {
        throw idError || new Error("Provider not found");
      }
    }

    // Join profiles via the shared auth.users.id relationship
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, photo_url, city")
      .eq("id", userId)
      .maybeSingle();

    // Fetch service_categories
    const { data: categoryData } = await supabase
      .from("service_categories")
      .select("name")
      .eq("id", providerData.category_id)
      .maybeSingle();

    return {
      ...providerData,
      profiles: profileData || undefined,
      service_categories: categoryData || undefined,
    };
  },

  /**
   * Update provider profile
   * Uses providers.user_id -> auth.users.id relationship structure
   */
  updateProfile: async (id: string, updates: Partial<ProProfile>) => {
    // Find provider by user_id or id
    let providerTableId: string = id;

    const { data: providerByUserId } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", id)
      .maybeSingle();

    if (providerByUserId) {
      providerTableId = providerByUserId.id;
    }

    const { data, error } = await supabase
      .from("providers")
      .update(updates)
      .eq("id", providerTableId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// Earnings API
export const earningsApi = {
  getEarnings: async (providerId: string): Promise<EarningsData> => {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    const monthStart = new Date(now.setMonth(now.getMonth() - 1));

    // Get all completed jobs with payments
    // If no payments exist, calculate from completed jobs
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        amount,
        created_at,
        jobs!inner(
          id,
          scheduled_date,
          total_price
        )
      `)
      .eq("provider_id", providerId)
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    let paymentsData: any[] = [];

    if (paymentsError || !payments || payments.length === 0) {
      // Fallback: use completed jobs as earnings source
      const { data: completedJobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, total_price, scheduled_date, updated_at")
        .eq("provider_id", providerId)
        .eq("status", "completed")
        .order("updated_at", { ascending: true });

      if (!jobsError && completedJobs) {
        paymentsData = completedJobs.map((job: any) => ({
          amount: job.total_price,
          created_at: job.updated_at || job.scheduled_date,
          jobs: { id: job.id, scheduled_date: job.scheduled_date },
        }));
      }
    } else {
      paymentsData = payments;
    }

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

    // Generate sparkline data (last 7 days for today/week, last 30 days for month)
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
        amount: todayPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        ),
        jobs: todayPayments.length,
        sparkline: generateSparkline(7, todayPayments),
      },
      week: {
        amount: weekPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        ),
        jobs: weekPayments.length,
        sparkline: generateSparkline(7, weekPayments),
      },
      month: {
        amount: monthPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        ),
        jobs: monthPayments.length,
        sparkline: generateSparkline(30, monthPayments),
      },
      lifetime: {
        amount: paymentsData.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        ),
        jobs: paymentsData.length,
        sparkline: generateSparkline(30, paymentsData),
      },
    };
  },
};

// Jobs API
export const jobsApi = {
  getJobRequests: async (providerId: string): Promise<JobRequest[]> => {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        profiles!jobs_customer_id_fkey(full_name, photo_url),
        service_categories(name)
      `)
      .eq("provider_id", providerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      // Try alternative query structure
      const { data: altData, error: altError } = await supabase
        .from("jobs")
        .select(`
          *,
          service_categories(name)
        `)
        .eq("provider_id", providerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (altError) throw altError;

      // Fetch customer profiles separately
      const customerIds = [...new Set((altData || []).map((j: any) => j.customer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", customerIds);

      const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return (altData || []).map((job: any) => ({
        ...job,
        customers: {
          profiles: profilesMap.get(job.customer_id) || { full_name: "Customer" },
        },
      }));
    }

    return (data || []).map((job: any) => ({
      ...job,
      customers: {
        profiles: job.profiles || { full_name: "Customer" },
      },
    }));
  },

  getAllJobs: async (providerId: string): Promise<Job[]> => {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        customer_id,
        status,
        scheduled_date,
        total_price,
        address,
        customers:customer_id(
          profiles!inner(full_name)
        ),
        service_categories(name)
      `)
      .eq("provider_id", providerId)
      .order("scheduled_date", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  acceptJob: async (jobId: string) => {
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "confirmed" })
      .eq("id", jobId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  declineJob: async (jobId: string) => {
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  completeJob: async (jobId: string) => {
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "completed" })
      .eq("id", jobId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getJobsByDate: async (providerId: string): Promise<Record<string, Job[]>> => {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        scheduled_date,
        customers:customer_id(
          profiles!inner(full_name)
        ),
        service_categories(name)
      `)
      .eq("provider_id", providerId)
      .in("status", ["confirmed", "in_progress"]);

    if (error) throw error;

    const jobsByDate: Record<string, Job[]> = {};
    (data || []).forEach((job: any) => {
      const date = new Date(job.scheduled_date).toISOString().split("T")[0];
      if (!jobsByDate[date]) {
        jobsByDate[date] = [];
      }
      jobsByDate[date].push(job);
    });

    return jobsByDate;
  },
};

// Verification API
export const verificationApi = {
  getStatus: async (providerId: string) => {
    const { data, error } = await supabase
      .from("providers")
      .select("is_verified")
      .eq("id", providerId)
      .single();
    if (error) throw error;
    return data;
  },

  uploadDocuments: async (providerId: string, documents: File[]) => {
    // This would typically upload to storage and update provider record
    // For now, we'll just return a success
    return { success: true };
  },
};

