/**
 * Optimized hook for fetching and caching user roles
 * Uses React Query for caching to avoid repeated database queries
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { fetchUserRolesWithProviderFallback } from "@/lib/utils/roles";

export const useUserRoles = () => {
  const { user } = useAuth();

  const queryResult = useQuery({
    queryKey: ["userRoles", user?.id],
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useUserRoles.ts:15',message:'Query function called',data:{userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (!user?.id) return [];

      const roles = await fetchUserRolesWithProviderFallback(user.id);

      if (!roles) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useUserRoles.ts:23',message:'Query error',data:{error:"Failed to load roles",userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new Error("Failed to load roles");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useUserRoles.ts:27',message:'Query success',data:{roles:JSON.stringify(roles),userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return roles;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    retry: 1,
  });

  // #region agent log
  if (queryResult.isLoading !== undefined || queryResult.data !== undefined) {
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useUserRoles.ts:35',message:'Query state changed',data:{isLoading:queryResult.isLoading,isFetching:queryResult.isFetching,data:JSON.stringify(queryResult.data),error:queryResult.error?.message,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion

  return queryResult;
};







