/**
 * Clean Provider Hook
 * Simple React Query hook for fetching providers
 */

import { useQuery } from "@tanstack/react-query";
import { fetchProviders, type Provider } from "@/lib/api/providers";

export const useProviders = (params?: {
  categoryId?: number;
  lat?: number;
  lng?: number;
  sort?: "distance" | "rating" | "price";
  limit?: number;
  enabled?: boolean;
}) => {
  return useQuery<Provider[]>({
    queryKey: ["providers", params?.categoryId, params?.lat, params?.lng, params?.sort],
    queryFn: () => fetchProviders(params),
    enabled: params?.enabled !== false,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
    retryDelay: 1000,
  });
};












