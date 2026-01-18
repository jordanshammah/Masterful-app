/**
 * Enhanced Services Hooks
 * React Query hooks for geo-aware professional search
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { servicesApi, bookingApi } from "@/lib/api/services-enhanced";
import type { ProfessionalWithDistance } from "@/lib/api/services-enhanced";

export const useProfessionalsByCategory = (params: {
  categoryId: number;
  lat?: number;
  lng?: number;
  sort?: "distance" | "rating" | "price";
  limit?: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["professionals", "category", params.categoryId, params.lat, params.lng, params.sort],
    queryFn: async () => {
      try {
        return await servicesApi.getProfessionalsByCategory(params);
      } catch (error: any) {
        console.error("[useProfessionalsByCategory] Query failed:", {
          error: error.message,
          categoryId: params.categoryId,
          params,
        });
        throw error;
      }
    },
    enabled: params.enabled !== false && !!params.categoryId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  });
};

export const useSearchProfessionals = (params: {
  query?: string;
  categoryId?: number;
  lat?: number;
  lng?: number;
  sort?: "distance" | "rating" | "price";
  limit?: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["professionals", "search", params.query, params.categoryId, params.lat, params.lng, params.sort],
    queryFn: async () => {
      try {
        return await servicesApi.searchProfessionals(params);
      } catch (error: any) {
        console.error("[useSearchProfessionals] Query failed:", {
          error: error.message,
          query: params.query,
          categoryId: params.categoryId,
          params,
        });
        throw error;
      }
    },
    enabled: params.enabled !== false,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
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
    }) => bookingApi.createBooking(params),
    onSuccess: (_, variables) => {
      // Invalidate queries asynchronously to avoid blocking UI
      // Use setTimeout to make invalidation non-blocking
      setTimeout(() => {
        // Invalidate provider's job queries so their dashboard updates
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs", "pending", variables.proId] });
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
        
        // Invalidate customer's job queries so their dashboard updates
        queryClient.invalidateQueries({ queryKey: ["customer", "jobs", variables.customerId] });
      }, 0);
    },
    onError: (error) => {
      // Log error for debugging
      if (import.meta.env.DEV) {
        console.error("[useCreateBooking] Booking creation failed:", error);
      }
    },
    retry: 0, // Don't retry on failure to avoid hanging
  });
};

