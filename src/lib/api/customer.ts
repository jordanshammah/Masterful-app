import { supabase } from "@/integrations/supabase/client";

export interface CustomerProfile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  city?: string;
  photo_url?: string;
  created_at?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

export interface ProfessionalRecommendation {
  id: string;
  name: string;
  photoUrl?: string;
  rating: number;
  category: string;
  location?: string;
  isVerified?: boolean;
}

export interface Booking {
  id: string;
  proName: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  serviceCategory?: string;
  totalPrice?: number;
  basePrice?: number;
  createdAt?: string;
  providerId?: string;
}

export interface Payment {
  id: string;
  jobId: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "refunded";
  paymentMethod?: string;
  processedAt?: string;
  createdAt: string;
  job?: {
    id: string;
    proName: string;
    serviceCategory?: string;
    scheduledDate?: string;
  };
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "job_accepted" | "schedule_update" | "job_completed" | "system";
  read: boolean;
  created_at: string;
}

// Auth API
export const authApi = {
  sendVerification: async (email: string) => {
    if (!email || !email.includes("@")) {
      throw new Error("Valid email is required");
    }

    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    
    if (error) {
      throw new Error(`Failed to send verification: ${error.message}`);
    }
    
    return data;
  },

  verify: async (token: string) => {
    if (!token) {
      throw new Error("Verification token is required");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "email",
    });
    
    if (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
    
    return data;
  },

  login: async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
    
    return data;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  },
};

// Customer Data API
export const customerApi = {
  /**
   * Check if a user's profile is complete
   * Required fields: full_name, email, phone, city
   */
  isProfileComplete: async (id: string): Promise<boolean> => {
    if (!id) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone, city")
        .eq("id", id)
        .single();
      
      if (error || !data) {
        return false;
      }
      
      // Check if all required fields are present and not empty
      const hasFullName = data.full_name && data.full_name.trim().length > 0;
      const hasEmail = data.email && data.email.trim().length > 0;
      const hasPhone = data.phone && data.phone.trim().length > 0;
      const hasCity = data.city && data.city.trim().length > 0;
      
      return hasFullName && hasEmail && hasPhone && hasCity;
    } catch (error) {
      console.error("Error checking profile completion:", error);
      return false;
    }
  },

  getProfile: async (id: string): Promise<CustomerProfile> => {
    if (!id) {
      throw new Error("Profile ID is required");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, city, photo_url, created_at")
      .eq("id", id)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("Profile not found");
    }
    
    return {
      id: data.id || id,
      full_name: data.full_name || "",
      email: data.email || undefined,
      phone: data.phone || undefined,
      city: data.city || undefined,
      photo_url: data.photo_url || undefined,
      created_at: data.created_at || undefined,
    };
  },

  updateProfile: async (id: string, updates: Partial<CustomerProfile>) => {
    if (!id) {
      throw new Error("Profile ID is required");
    }

    // First, check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    // If profile doesn't exist, create it first
    if (!existingProfile) {
      // Get the current user's email from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id,
          full_name: updates.full_name || "",
          email: updates.email || user?.email || "",
          phone: updates.phone || undefined,
          city: updates.city || undefined,
          photo_url: updates.photo_url || undefined,
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
      
      if (!newProfile) {
        throw new Error("Profile creation failed - no data returned");
      }
      
      return {
        id: newProfile.id || id,
        full_name: newProfile.full_name || "",
        email: newProfile.email || undefined,
        phone: newProfile.phone || undefined,
        city: newProfile.city || undefined,
        photo_url: newProfile.photo_url || undefined,
        created_at: newProfile.created_at || undefined,
      };
    }

    // Profile exists, update it
    // Use maybeSingle() to avoid error if RLS prevents returning the row
    const { data: updateData, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
    
    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }
    
    // If update didn't return data (RLS issue), fetch it separately
    if (!updateData) {
      const { data: fetchedData, error: fetchError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, city, photo_url, created_at")
        .eq("id", id)
        .single();
      
      if (fetchError) {
        throw new Error(`Failed to fetch updated profile: ${fetchError.message}`);
      }
      
      if (!fetchedData) {
        throw new Error("Profile update failed - could not retrieve updated profile");
      }
      
      return {
        id: fetchedData.id || id,
        full_name: fetchedData.full_name || "",
        email: fetchedData.email || undefined,
        phone: fetchedData.phone || undefined,
        city: fetchedData.city || undefined,
        photo_url: fetchedData.photo_url || undefined,
        created_at: fetchedData.created_at || undefined,
      };
    }
    
    return {
      id: updateData.id || id,
      full_name: updateData.full_name || "",
      email: updateData.email || undefined,
      phone: updateData.phone || undefined,
      city: updateData.city || undefined,
      photo_url: updateData.photo_url || undefined,
      created_at: updateData.created_at || undefined,
    };
  },
};

// Categories API
export const categoriesApi = {
  getAll: async (): Promise<ServiceCategory[]> => {
    const { data, error } = await supabase
      .from("service_categories")
      .select("id, name, icon, description")
      .order("name");
    
    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
    
    if (!data) {
      return [];
    }
    
    return data.map((category: unknown) => {
      const c = category as Record<string, unknown>;
      return {
        id: (c.id as string) || "",
        name: (c.name as string) || "",
        icon: (c.icon as string) || undefined,
        description: (c.description as string) || undefined,
      };
    });
  },
};

// Recommendations API
export const recommendationsApi = {
  getForCustomer: async (customerId: string): Promise<ProfessionalRecommendation[]> => {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    const { data, error } = await supabase
      .from("providers")
      .select(`
        id,
        rating,
        is_verified,
        profiles!inner(full_name, photo_url, city),
        service_categories!inner(name)
      `)
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(10);
    
    if (error) {
      throw new Error(`Failed to fetch recommendations: ${error.message}`);
    }
    
    if (!data) {
      return [];
    }
    
    return data.map((provider: unknown) => {
      const p = provider as Record<string, unknown>;
      const profiles = (p.profiles as Record<string, unknown>) || {};
      const serviceCategories = (p.service_categories as Record<string, unknown>) || {};
      
      return {
        id: (p.id as string) || "",
        name: (profiles.full_name as string) || "Unknown",
        photoUrl: (profiles.photo_url as string) || undefined,
        rating: Number(p.rating) || 0,
        category: (serviceCategories.name as string) || "General",
        location: (profiles.city as string) || undefined,
        isVerified: Boolean(p.is_verified),
      };
    });
  },
};

// Bookings API
export const bookingsApi = {
  getForCustomer: async (customerId: string): Promise<Booking[]> => {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        scheduled_date,
        address,
        total_price,
        base_price,
        created_at,
        provider_id,
        providers!inner(
          profiles!inner(full_name),
          service_categories!inner(name)
        )
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }
    
    if (!data) {
      return [];
    }
    
    return data.map((job: any) => ({
      id: job.id || "",
      proName: job.providers?.profiles?.full_name || "Unknown",
      status: (job.status || "pending") as Booking["status"],
      scheduledDate: job.scheduled_date || undefined,
      location: job.address || undefined,
      serviceCategory: job.providers?.service_categories?.name || undefined,
      totalPrice: Number(job.total_price) || 0,
      basePrice: Number(job.base_price) || 0,
      createdAt: job.created_at || new Date().toISOString(),
      providerId: job.provider_id || undefined,
    }));
  },

  getActive: async (customerId: string): Promise<Booking[]> => {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        scheduled_date,
        address,
        total_price,
        base_price,
        created_at,
        provider_id,
        providers!inner(
          profiles!inner(full_name),
          service_categories!inner(name)
        )
      `)
      .eq("customer_id", customerId)
      .in("status", ["pending", "confirmed", "in_progress"])
      .order("created_at", { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch active bookings: ${error.message}`);
    }
    
    if (!data) {
      return [];
    }
    
    return data.map((job: unknown) => {
      const j = job as Record<string, unknown>;
      return {
        id: (j.id as string) || "",
        proName: ((j.providers as Record<string, unknown>)?.profiles as Record<string, unknown>)?.full_name as string || "Unknown",
        status: (j.status || "pending") as Booking["status"],
        scheduledDate: (j.scheduled_date as string) || undefined,
        location: (j.address as string) || undefined,
        serviceCategory: ((j.providers as Record<string, unknown>)?.service_categories as Record<string, unknown>)?.name as string || undefined,
        totalPrice: Number(j.total_price) || 0,
        basePrice: Number(j.base_price) || 0,
        createdAt: (j.created_at as string) || new Date().toISOString(),
        providerId: (j.provider_id as string) || undefined,
      };
    });
  },

  getCompleted: async (customerId: string): Promise<Booking[]> => {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        scheduled_date,
        address,
        total_price,
        base_price,
        created_at,
        provider_id,
        providers!inner(
          profiles!inner(full_name),
          service_categories!inner(name)
        )
      `)
      .eq("customer_id", customerId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (error) {
      throw new Error(`Failed to fetch completed bookings: ${error.message}`);
    }
    
    if (!data) {
      return [];
    }
    
    return data.map((job: unknown) => {
      const j = job as Record<string, unknown>;
      return {
        id: (j.id as string) || "",
        proName: ((j.providers as Record<string, unknown>)?.profiles as Record<string, unknown>)?.full_name as string || "Unknown",
        status: (j.status || "completed") as Booking["status"],
        scheduledDate: (j.scheduled_date as string) || undefined,
        location: (j.address as string) || undefined,
        serviceCategory: ((j.providers as Record<string, unknown>)?.service_categories as Record<string, unknown>)?.name as string || undefined,
        totalPrice: Number(j.total_price) || 0,
        basePrice: Number(j.base_price) || 0,
        createdAt: (j.created_at as string) || new Date().toISOString(),
        providerId: (j.provider_id as string) || undefined,
      };
    });
  },

  create: async (bookingData: {
    customer_id: string;
    provider_id: string;
    service_category_id: string;
    scheduled_date: string;
    scheduled_time?: string;
    location?: string;
    description?: string;
  }) => {
    if (!bookingData.customer_id || !bookingData.provider_id || !bookingData.service_category_id) {
      throw new Error("Missing required booking information");
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert(bookingData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create booking: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("Booking creation failed - no data returned");
    }
    
    return data;
  },

  cancel: async (bookingId: string) => {
    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to cancel booking: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("Booking cancellation failed - no data returned");
    }
    
    return data;
  },
};

// Payments API
export const paymentsApi = {
  getForCustomer: async (customerId: string): Promise<Payment[]> => {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        job_id,
        amount,
        status,
        payment_method,
        processed_at,
        created_at,
        jobs!inner(
          id,
          scheduled_date,
          providers!inner(
            profiles!inner(full_name),
            service_categories!inner(name)
          )
        )
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }
    
    if (!data) {
      return [];
    }
    
    return data.map((payment: unknown) => {
      const p = payment as Record<string, unknown>;
      const jobs = (p.jobs as Record<string, unknown>) || {};
      const providers = (jobs.providers as Record<string, unknown>) || {};
      const profiles = (providers.profiles as Record<string, unknown>) || {};
      const serviceCategories = (providers.service_categories as Record<string, unknown>) || {};
      
      return {
        id: (p.id as string) || "",
        jobId: (p.job_id as string) || "",
        amount: Number(p.amount) || 0,
        status: (p.status || "pending") as Payment["status"],
        paymentMethod: (p.payment_method as string) || undefined,
        processedAt: (p.processed_at as string) || undefined,
        createdAt: (p.created_at as string) || new Date().toISOString(),
        job: {
          id: (jobs.id as string) || "",
          proName: (profiles.full_name as string) || "Unknown",
          serviceCategory: (serviceCategories.name as string) || undefined,
          scheduledDate: (jobs.scheduled_date as string) || undefined,
        },
      };
    });
  },
};

// Notifications API
export const notificationsApi = {
  getForCustomer: async (customerId: string): Promise<Notification[]> => {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    // For now, we'll create a simple notification system
    // In a real app, you'd have a notifications table
    const { data: bookings, error } = await supabase
      .from("jobs")
      .select("id, status, created_at, providers!inner(profiles!inner(full_name))")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
    
    if (!bookings) {
      return [];
    }
    
    return bookings.map((booking: unknown) => {
      const b = booking as Record<string, unknown>;
      const providers = (b.providers as Record<string, unknown>) || {};
      const profiles = (providers.profiles as Record<string, unknown>) || {};
      const status = (b.status as string) || "pending";
      const proName = (profiles.full_name as string) || "Professional";
      
      let title = "Job Updated";
      let message = `${proName} updated your booking`;
      let type: Notification["type"] = "schedule_update";
      
      if (status === "confirmed") {
        title = "Job Confirmed";
        message = `${proName} confirmed your booking`;
        type = "job_accepted";
      } else if (status === "in_progress") {
        title = "Job Started";
        message = `${proName} started the job`;
        type = "job_completed";
      }
      
      return {
        id: (b.id as string) || "",
        title,
        message,
        type,
        read: false,
        created_at: (b.created_at as string) || new Date().toISOString(),
      };
    });
  },
};

