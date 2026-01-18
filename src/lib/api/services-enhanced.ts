/**
 * Enhanced Services API
 * Geo-aware professional search with rush booking support
 */

import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Validation schemas
const categoryIdSchema = z.number().int().positive();
const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);
const sortSchema = z.enum(["distance", "rating", "price"]);

const createBookingSchema = z.object({
  customerId: z.string().uuid(),
  proId: z.string().uuid(),
  categoryId: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  scheduledTime: z.string().optional(),
  address: z.string().min(5).max(500),
  notes: z.string().max(1000).optional(),
  rush: z.boolean(),
  paymentMethodId: z.string().uuid().optional(),
  estimatedBasePrice: z.number().min(0),
});

export interface ProfessionalWithDistance {
  id: string;
  category_id: number;
  bio?: string;
  hourly_rate: number;
  rating: number;
  review_count: number;
  is_active: boolean;
  is_verified: boolean;
  avg_response_time: number;
  location_lat?: number;
  location_lng?: number;
  distance_km?: number;
  distance_miles?: number;
  profiles?: {
    full_name: string;
    photo_url?: string;
    city?: string;
    phone?: string;
  };
  service_categories?: {
    name: string;
  };
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert kilometers to miles
 */
const kmToMiles = (km: number): number => {
  return km * 0.621371;
};

// Services API
export const servicesApi = {
  /**
   * Get professionals by category with geo-sorting
   */
  getProfessionalsByCategory: async (params: {
    categoryId: number;
    lat?: number;
    lng?: number;
    sort?: "distance" | "rating" | "price";
    limit?: number;
  }): Promise<ProfessionalWithDistance[]> => {
    const validatedCategoryId = categoryIdSchema.parse(params.categoryId);
    const validatedSort = params.sort ? sortSchema.parse(params.sort) : "distance";
    const limit = params.limit || 50;

    try {
      // Build base query - regular joins to allow providers without profiles/categories
      // Only show active AND verified providers
      let query = supabase
        .from("providers")
        .select(`
          *,
          profiles(
            full_name,
            photo_url,
            city,
            phone,
            location_lat,
            location_lng
          ),
          service_categories(
            name
          )
        `)
        .eq("category_id", validatedCategoryId)
        .eq("is_active", true)
        .eq("is_verified", true)
        .limit(limit);

      // Execute query
      const { data, error } = await query;

      if (error) {
        console.error("[ServicesAPI] Error fetching professionals by category:", {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          categoryId: validatedCategoryId,
        });
        throw new Error(`Failed to fetch professionals: ${error.message}`);
      }

      if (!data || data.length === 0) {
        if (import.meta.env.DEV) {
          console.warn("[ServicesAPI] No professionals found for category:", {
            categoryId: validatedCategoryId,
            limit,
          });
        }
        return [];
      }

      if (import.meta.env.DEV) {
        console.log("[ServicesAPI] Fetched professionals:", {
          count: data.length,
          categoryId: validatedCategoryId,
        });
      }

      // Process and calculate distances
      let processed: ProfessionalWithDistance[] = data.map((provider: any) => {
        const p = provider as Record<string, unknown>;
        // Handle both single object and array responses from Supabase
        const profile = Array.isArray(p.profiles) 
          ? (p.profiles[0] as Record<string, unknown> | undefined)
          : (p.profiles as Record<string, unknown> | undefined);
        const serviceCategory = Array.isArray(p.service_categories)
          ? (p.service_categories[0] as Record<string, unknown> | undefined)
          : (p.service_categories as Record<string, unknown> | undefined);
        
        let distance_km: number | undefined;
        let distance_miles: number | undefined;

        // Calculate distance if coordinates are available
        if (params.lat && params.lng && profile?.location_lat && profile?.location_lng) {
          const providerLat = Number(profile.location_lat);
          const providerLng = Number(profile.location_lng);
          
          if (!isNaN(providerLat) && !isNaN(providerLng)) {
            distance_km = calculateDistance(
              params.lat,
              params.lng,
              providerLat,
              providerLng
            );
            distance_miles = kmToMiles(distance_km);
          }
        }

        return {
          id: (p.id as string) || "",
          category_id: Number(p.category_id) || validatedCategoryId,
          bio: (p.bio as string) || undefined,
          hourly_rate: Number(p.hourly_rate) || 0,
          rating: Number(p.rating) || 0,
          review_count: Number(p.review_count) || 0,
          is_active: Boolean(p.is_active),
          is_verified: Boolean(p.is_verified),
          avg_response_time: Number(p.avg_response_time) || 0,
          location_lat: profile?.location_lat ? Number(profile.location_lat) : undefined,
          location_lng: profile?.location_lng ? Number(profile.location_lng) : undefined,
          distance_km,
          distance_miles,
          profiles: profile ? {
            full_name: (profile.full_name as string) || "Unknown",
            photo_url: (profile.photo_url as string) || undefined,
            city: (profile.city as string) || undefined,
            phone: (profile.phone as string) || undefined,
          } : undefined,
          service_categories: serviceCategory ? {
            name: (serviceCategory.name as string) || "Service",
          } : undefined,
        };
      });

      // Sort based on sort parameter
      if (validatedSort === "distance") {
        // Sort by distance (closest first), then by rating for those without location
        processed.sort((a, b) => {
          if (a.distance_km !== undefined && b.distance_km !== undefined) {
            return a.distance_km - b.distance_km;
          }
          if (a.distance_km !== undefined) return -1;
          if (b.distance_km !== undefined) return 1;
          return b.rating - a.rating; // Fallback to rating
        });
      } else if (validatedSort === "rating") {
        processed.sort((a, b) => b.rating - a.rating);
      } else if (validatedSort === "price") {
        processed.sort((a, b) => a.hourly_rate - b.hourly_rate);
      }

      return processed;
    } catch (error: any) {
      console.error("[ServicesAPI] Unexpected error in getProfessionalsByCategory:", {
        error: error.message,
        stack: error.stack,
        categoryId: validatedCategoryId,
      });
      throw error;
    }
  },

  /**
   * Search professionals across all categories
   */
  searchProfessionals: async (params: {
    query?: string;
    categoryId?: number;
    lat?: number;
    lng?: number;
    sort?: "distance" | "rating" | "price";
    limit?: number;
  }): Promise<ProfessionalWithDistance[]> => {
    const validatedSort = params.sort ? sortSchema.parse(params.sort) : "distance";
    const limit = params.limit || 50;

    try {
      // Build base query - regular joins to allow providers without profiles/categories
      // Only show active AND verified providers
      let query = supabase
        .from("providers")
        .select(`
          *,
          profiles(
            full_name,
            photo_url,
            city,
            phone,
            location_lat,
            location_lng
          ),
          service_categories(
            name
          )
        `)
        .eq("is_active", true)
        .eq("is_verified", true);

      // Filter by category if provided
      if (params.categoryId && params.categoryId > 0) {
        query = query.eq("category_id", params.categoryId);
      }

      query = query.limit(limit);

      // Apply text search if provided
      if (params.query) {
        // Note: Supabase text search would require full-text search setup
        // For now, we'll filter client-side
      }

      const { data, error } = await query;

      if (error) {
        console.error("[ServicesAPI] Error searching professionals:", {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          categoryId: params.categoryId,
          query: params.query,
        });
        throw new Error(`Failed to search professionals: ${error.message}`);
      }

      if (!data || data.length === 0) {
        if (import.meta.env.DEV) {
          console.warn("[ServicesAPI] No professionals found:", {
            categoryId: params.categoryId,
            query: params.query,
            limit,
          });
        }
        return [];
      }

      if (import.meta.env.DEV) {
        console.log("[ServicesAPI] Searched professionals:", {
          count: data.length,
          categoryId: params.categoryId,
          query: params.query,
        });
      }

      // Process similar to getProfessionalsByCategory
      let processed: ProfessionalWithDistance[] = data.map((provider: any) => {
        const p = provider as Record<string, unknown>;
        // Handle both single object and array responses from Supabase
        const profile = Array.isArray(p.profiles) 
          ? (p.profiles[0] as Record<string, unknown> | undefined)
          : (p.profiles as Record<string, unknown> | undefined);
        const serviceCategory = Array.isArray(p.service_categories)
          ? (p.service_categories[0] as Record<string, unknown> | undefined)
          : (p.service_categories as Record<string, unknown> | undefined);
        
        let distance_km: number | undefined;
        let distance_miles: number | undefined;

        if (params.lat && params.lng && profile?.location_lat && profile?.location_lng) {
          const providerLat = Number(profile.location_lat);
          const providerLng = Number(profile.location_lng);
          
          if (!isNaN(providerLat) && !isNaN(providerLng)) {
            distance_km = calculateDistance(
              params.lat,
              params.lng,
              providerLat,
              providerLng
            );
            distance_miles = kmToMiles(distance_km);
          }
        }

        return {
          id: (p.id as string) || "",
          category_id: Number(p.category_id) || 0,
          bio: (p.bio as string) || undefined,
          hourly_rate: Number(p.hourly_rate) || 0,
          rating: Number(p.rating) || 0,
          review_count: Number(p.review_count) || 0,
          is_active: Boolean(p.is_active),
          is_verified: Boolean(p.is_verified),
          avg_response_time: Number(p.avg_response_time) || 0,
          location_lat: profile?.location_lat ? Number(profile.location_lat) : undefined,
          location_lng: profile?.location_lng ? Number(profile.location_lng) : undefined,
          distance_km,
          distance_miles,
          profiles: profile ? {
            full_name: (profile.full_name as string) || "Unknown",
            photo_url: (profile.photo_url as string) || undefined,
            city: (profile.city as string) || undefined,
            phone: (profile.phone as string) || undefined,
          } : undefined,
          service_categories: serviceCategory ? {
            name: (serviceCategory.name as string) || "Service",
          } : undefined,
        };
      });

      // Filter by search query if provided
      if (params.query) {
        const queryLower = params.query.toLowerCase();
        processed = processed.filter(
          (p) =>
            p.profiles?.full_name?.toLowerCase().includes(queryLower) ||
            p.service_categories?.name?.toLowerCase().includes(queryLower) ||
            p.profiles?.city?.toLowerCase().includes(queryLower)
        );
      }

      // Sort
      if (validatedSort === "distance") {
        processed.sort((a, b) => {
          if (a.distance_km !== undefined && b.distance_km !== undefined) {
            return a.distance_km - b.distance_km;
          }
          if (a.distance_km !== undefined) return -1;
          if (b.distance_km !== undefined) return 1;
          return b.rating - a.rating;
        });
      } else if (validatedSort === "rating") {
        processed.sort((a, b) => b.rating - a.rating);
      } else if (validatedSort === "price") {
        processed.sort((a, b) => a.hourly_rate - b.hourly_rate);
      }

      return processed;
    } catch (error: any) {
      console.error("[ServicesAPI] Unexpected error in searchProfessionals:", {
        error: error.message,
        stack: error.stack,
        categoryId: params.categoryId,
        query: params.query,
      });
      throw error;
    }
  },
};

// Booking API with rush support
export const bookingApi = {
  /**
   * Create a booking with rush support and hourly pricing
   */
  createBooking: async (params: {
    customerId: string;
    proId: string;
    categoryId: number;
    scheduledAt: string;
    scheduledTime?: string;
    address: string;
    notes?: string;
    rush: boolean;
    paymentMethodId?: string;
    estimatedBasePrice: number;
  }): Promise<{ bookingId: string; totalPrice: number; rushFee: number; depositAmount?: number }> => {
    const validated = createBookingSchema.parse(params);

    // NEW: Fetch provider's current hourly rate to lock it for this booking
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("hourly_rate")
      .eq("id", validated.proId)
      .single();

    if (providerError || !provider) {
      throw new Error("Provider not found");
    }

    const hourlyRateSnapshot = Number(provider.hourly_rate);

    // Calculate rush fee and total price
    const basePrice = validated.estimatedBasePrice;
    const rushFee = validated.rush ? Math.round(basePrice * 0.3 * 100) / 100 : 0;
    const totalPrice = basePrice + rushFee;

    // NEW: Calculate deposit (exactly 1 hour of provider's rate)
    const depositAmount = hourlyRateSnapshot;

    // SECURITY: Auth codes are generated on-demand via Edge Function
    // We only store hashes at booking creation time, not plain codes
    // This prevents exposure if the database is compromised
    
    // Create booking data with only the fields that exist in the base schema
    const bookingData: Record<string, unknown> = {
      customer_id: validated.customerId,
      provider_id: validated.proId,
      category_id: validated.categoryId,
      scheduled_date: validated.scheduledAt,
      address: validated.address,
      notes: validated.notes || null,
      base_price: basePrice,
      total_price: totalPrice,
      is_rush: validated.rush,
      rush_fee_amount: rushFee,
      status: "pending",
    };
    
    // Add optional hourly pricing fields if migration has been run
    // These will be ignored gracefully if columns don't exist yet
    try {
      // Only add these fields if the provider has an hourly rate set
      if (hourlyRateSnapshot > 0) {
        bookingData.hourly_rate_snapshot = hourlyRateSnapshot;
        bookingData.deposit_amount = depositAmount;
        bookingData.initial_estimated_hours = 1.5;
        // Note: deposit_paid will default to FALSE in the database if column exists
      }
    } catch (e) {
      // Silently ignore if hourly pricing columns don't exist yet
      if (import.meta.env.DEV) {
        console.log("[bookingApi.createBooking] Hourly pricing fields not available yet");
      }
    }

    // Add scheduled_time if provided
    if (validated.scheduledTime) {
      bookingData.scheduled_time = validated.scheduledTime;
    }

    if (import.meta.env.DEV) {
      console.log("[bookingApi.createBooking] Creating booking:", {
        providerId: validated.proId,
        customerId: validated.customerId,
        categoryId: validated.categoryId,
        hourlyRateSnapshot,
        depositAmount,
      });
    }

    // Create the booking - auth codes are generated on-demand for security
    const { data: booking, error: bookingError } = await supabase
      .from("jobs")
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      if (import.meta.env.DEV) {
        console.error("[bookingApi.createBooking] Error creating booking:", {
          error: bookingError,
          code: bookingError.code,
          message: bookingError.message,
          details: bookingError.details,
          hint: bookingError.hint,
          bookingData
        });
      }
      throw new Error(`Failed to create booking: ${bookingError.message}${bookingError.details ? ` - ${bookingError.details}` : ''}${bookingError.hint ? ` (${bookingError.hint})` : ''}`);
    }

    if (!booking) {
      if (import.meta.env.DEV) {
        console.error("[bookingApi.createBooking] No booking returned after insert");
      }
      throw new Error("Failed to create booking - no data returned");
    }

    if (import.meta.env.DEV) {
      console.log("[bookingApi.createBooking] Booking created successfully:", {
        id: booking.id,
        provider_id: booking.provider_id,
        customer_id: booking.customer_id,
        status: booking.status,
        hourly_rate_snapshot: booking.hourly_rate_snapshot,
        deposit_amount: booking.deposit_amount,
      });
    }

    // If rush booking, send urgent notification to pro (non-blocking)
    if (validated.rush) {
      // Run notification asynchronously to avoid blocking booking creation
      Promise.resolve().then(async () => {
        try {
          // Fetch category name for notification (use maybeSingle to avoid errors)
          const { data: categoryData } = await supabase
            .from("service_categories")
            .select("name")
            .eq("id", validated.categoryId)
            .maybeSingle();

          const serviceName = categoryData?.name || "Service";

          // Import and use notifications API
          const { notificationsApi } = await import("./notifications");
          await notificationsApi.sendUrgentBookingNotification({
            bookingId: booking.id,
            proId: validated.proId,
            customerId: validated.customerId,
            serviceName,
            scheduledAt: validated.scheduledAt,
            address: validated.address,
            totalPrice,
          });

          // Update booking notes with notification info (since we don't have dedicated fields)
          // In production, you'd add these fields to the jobs table
          const notificationInfo = `[URGENT_NOTIFICATION_SENT:${new Date().toISOString()}|DEADLINE:${new Date(Date.now() + 15 * 60 * 1000).toISOString()}]`;
          const updatedNotes = validated.notes 
            ? `${validated.notes}\n\n${notificationInfo}`
            : notificationInfo;
          
          await supabase
            .from("jobs")
            .update({
              notes: updatedNotes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", booking.id);
        } catch (notifyError) {
          // Log error but don't fail booking creation
          if (import.meta.env.DEV) {
            console.error("Failed to send urgent notification:", notifyError);
          }
        }
      }).catch(() => {
        // Silently fail - notification is not critical
      });
    }

    return {
      bookingId: booking.id,
      totalPrice,
      rushFee,
      depositAmount, // NEW: Return deposit amount for payment
    };
  },

};

