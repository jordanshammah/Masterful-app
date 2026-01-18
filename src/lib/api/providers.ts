/**
 * Clean Provider API
 * Simple, reliable provider fetching from the providers table
 */

import { supabase } from "@/integrations/supabase/client";

export interface Provider {
  id: string;
  user_id?: string;
  display_name?: string;
  business_name?: string;
  category_id: number;
  bio?: string;
  hourly_rate: number;
  minimum_job_price?: number; // NEW: For quote-based pricing
  rating: number;
  review_count: number;
  is_active: boolean;
  is_verified: boolean;
  avg_response_time: number;
  city?: string;
  profile_image_url?: string;
  latitude?: number;
  longitude?: number;
  service_categories?: {
    name: string;
  };
  distance_km?: number;
  distance_miles?: number;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (
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

const kmToMiles = (km: number): number => {
  return km * 0.621371;
};

/**
 * Fetch all providers from the providers table
 * Only returns active AND verified providers
 * Uses display_name directly from providers table
 */
export const fetchProviders = async (params?: {
  categoryId?: number;
  lat?: number;
  lng?: number;
  sort?: "distance" | "rating" | "price";
  limit?: number;
}): Promise<Provider[]> => {
  try {
    console.log("[fetchProviders] ===== STARTING PROVIDER FETCH =====");
    console.log("[fetchProviders] Parameters received:", JSON.stringify(params, null, 2));

    // Build query - fetch providers with display_name directly from providers table
    console.log("[fetchProviders] Building provider query...");
    let providerQuery = supabase
      .from("providers")
      .select(`
        id,
        user_id,
        display_name,
        business_name,
        category_id,
        bio,
        hourly_rate,
        minimum_job_price,
        rating,
        review_count,
        is_active,
        is_verified,
        avg_response_time,
        city,
        profile_image_url,
        latitude,
        longitude,
        service_categories(
          name
        )
      `)
      .eq("is_active", true)
      .eq("is_verified", true);

    // Apply category filter if provided
    if (params?.categoryId && params.categoryId > 0) {
      providerQuery = providerQuery.eq("category_id", params.categoryId);
      console.log("[fetchProviders] Category filter applied:", params.categoryId);
    }

    // Apply limit
    const limit = params?.limit || 100;
    providerQuery = providerQuery.limit(limit);
    console.log("[fetchProviders] Query limit:", limit);

    // Execute provider query
    console.log("[fetchProviders] Executing provider query...");
    const { data: providerData, error: providerError } = await providerQuery;

    if (providerError) {
      console.error("[fetchProviders] ===== PROVIDER QUERY ERROR =====");
      console.error("[fetchProviders] Error message:", providerError.message);
      console.error("[fetchProviders] Error code:", providerError.code);
      throw new Error(`Failed to fetch providers: ${providerError.message}`);
    }

    if (!providerData || providerData.length === 0) {
      console.warn("[fetchProviders] No providers found");
      return [];
    }

    console.log("[fetchProviders] Found", providerData.length, "providers");
    console.log("[fetchProviders] Sample provider:", JSON.stringify(providerData[0], null, 2));

    // Process providers and calculate distances
    console.log("[fetchProviders] ===== PROCESSING PROVIDERS =====");
    const processed: Provider[] = providerData.map((provider: any, index: number) => {
      const p = provider as Record<string, unknown>;
      
      console.log(`[fetchProviders] Processing provider ${index + 1}/${providerData.length}:`, {
        id: p.id,
        display_name: p.display_name,
        business_name: p.business_name,
        category_id: p.category_id,
        has_service_categories: !!p.service_categories,
      });
      
      // Handle service category (can be array or object)
      const serviceCategory = Array.isArray(p.service_categories)
        ? (p.service_categories[0] as Record<string, unknown> | undefined)
        : (p.service_categories as Record<string, unknown> | undefined);
      
      if (serviceCategory) {
        console.log(`[fetchProviders] Provider ${index + 1} service category:`, serviceCategory.name);
      } else {
        console.warn(`[fetchProviders] Provider ${index + 1} has no service category data`);
      }

      let distance_km: number | undefined;
      let distance_miles: number | undefined;

      // Calculate distance if coordinates are available (use latitude/longitude from providers table)
      if (params?.lat && params?.lng && p.latitude && p.longitude) {
        const providerLat = Number(p.latitude);
        const providerLng = Number(p.longitude);
        
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
        user_id: (p.user_id as string) || undefined,
        display_name: (p.display_name as string)?.trim() || undefined,
        business_name: (p.business_name as string)?.trim() || undefined,
        category_id: Number(p.category_id) || 0,
        bio: (p.bio as string) || undefined,
        hourly_rate: Number(p.hourly_rate) || 0,
        minimum_job_price: p.minimum_job_price ? Number(p.minimum_job_price) : undefined,
        rating: Number(p.rating) || 0,
        review_count: Number(p.review_count) || 0,
        is_active: p.is_active !== null ? Boolean(p.is_active) : true,
        is_verified: Boolean(p.is_verified) || false,
        avg_response_time: Number(p.avg_response_time) || 45,
        city: (p.city as string) || undefined,
        profile_image_url: (p.profile_image_url as string) || undefined,
        latitude: p.latitude ? Number(p.latitude) : undefined,
        longitude: p.longitude ? Number(p.longitude) : undefined,
        service_categories: serviceCategory ? {
          name: (serviceCategory.name as string) || "Service",
        } : undefined,
        distance_km,
        distance_miles,
      };
    });

    // Sort based on sort parameter
    const sortBy = params?.sort || "rating";
    console.log("[fetchProviders] Sorting providers by:", sortBy);
    if (sortBy === "distance") {
      processed.sort((a, b) => {
        if (a.distance_km !== undefined && b.distance_km !== undefined) {
          return a.distance_km - b.distance_km;
        }
        if (a.distance_km !== undefined) return -1;
        if (b.distance_km !== undefined) return 1;
        return b.rating - a.rating; // Fallback to rating
      });
    } else if (sortBy === "rating") {
      processed.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "price") {
      processed.sort((a, b) => a.hourly_rate - b.hourly_rate);
    }

    console.log("[fetchProviders] ===== PROCESSING COMPLETE =====");
    console.log("[fetchProviders] Final processed providers count:", processed.length);
    console.log("[fetchProviders] Sorted by:", sortBy);
    if (processed.length > 0) {
      console.log("[fetchProviders] Sample processed provider (first):", JSON.stringify(processed[0], null, 2));
    }
    console.log("[fetchProviders] ===== RETURNING PROVIDERS =====");

    return processed;
  } catch (error: any) {
    console.error("[fetchProviders] Unexpected error:", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};
