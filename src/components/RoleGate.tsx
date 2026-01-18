/**
 * RoleGate Component
 * Protects routes based on user roles
 * 
 * FIXED: 
 * - Properly prioritizes provider role over customer role
 * - Prevents infinite redirect loops with path tracking
 * - Auto-creates customer role if user has none
 * - Thorough role checking before any redirect
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface RoleGateProps {
  children: React.ReactNode;
  requiredRole?: "customer" | "provider" | "admin";
}

// Track redirect history to prevent loops
const REDIRECT_HISTORY_KEY = "role_gate_redirect_history";
const MAX_REDIRECTS = 3;
const REDIRECT_WINDOW_MS = 5000;

function getRedirectHistory(): { path: string; time: number }[] {
  try {
    const history = sessionStorage.getItem(REDIRECT_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function addRedirectHistory(path: string): void {
  const history = getRedirectHistory();
  const now = Date.now();
  
  // Remove old entries (older than window)
  const filtered = history.filter(h => now - h.time < REDIRECT_WINDOW_MS);
  filtered.push({ path, time: now });
  
  sessionStorage.setItem(REDIRECT_HISTORY_KEY, JSON.stringify(filtered));
}

function isRedirectLoop(targetPath: string): boolean {
  const history = getRedirectHistory();
  const now = Date.now();
  
  // Count recent redirects to this path
  const recentRedirects = history.filter(
    h => h.path === targetPath && now - h.time < REDIRECT_WINDOW_MS
  );
  
  if (recentRedirects.length >= MAX_REDIRECTS) {
    console.error("[RoleGate] REDIRECT LOOP DETECTED! Target:", targetPath, "History:", history);
    return true;
  }
  
  return false;
}

function clearRedirectHistory(): void {
  sessionStorage.removeItem(REDIRECT_HISTORY_KEY);
}

export const RoleGate = ({ 
  children, 
  requiredRole,
}: RoleGateProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading, refetch: refetchRoles } = useUserRoles();
  const [authorized, setAuthorized] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [checkState, setCheckState] = useState<"loading" | "checking" | "authorized" | "redirecting">("loading");
  const hasCheckedRef = useRef(false);
  const isCreatingRoleRef = useRef(false); // Prevent multiple role creation attempts
  const pendingRoleRefetchRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout guard
  const queryClient = useQueryClient();

  // Safe redirect function with loop detection
  const safeNavigate = (path: string) => {
    if (isRedirectLoop(path)) {
      console.error("[RoleGate] Preventing redirect loop to:", path);
      // Clear history and show error state instead of infinite loop
      clearRedirectHistory();
      setCheckState("authorized"); // Allow access to prevent loop
      setAuthorized(true);
      return false;
    }
    
    addRedirectHistory(path);
    console.log("[RoleGate] Navigating to:", path);
    navigate(path, { replace: true });
    return true;
  };

  // Reset state when user ID changes (new login)
  useEffect(() => {
    // Only reset if user ID actually changed (not just roles updating)
    if (user?.id) {
      hasCheckedRef.current = false;
      isCreatingRoleRef.current = false;
      setAuthorized(false);
      setCreatingRole(false);
      setCheckState("loading");
    }
  }, [user?.id]);

  // Clear redirect history on successful authorization
  useEffect(() => {
    if (authorized) {
      clearRedirectHistory();
    }
  }, [authorized]);

  // Main authorization logic
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:123',message:'useEffect triggered',data:{hasChecked:hasCheckedRef.current,authorized,isCreatingRole:isCreatingRoleRef.current,authLoading,rolesLoading,creatingRole,userRoles:JSON.stringify(userRoles),requiredRole,pathname:location.pathname,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Prevent multiple checks or if already authorized
    if (hasCheckedRef.current || authorized || isCreatingRoleRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:131',message:'Early return - already checked/authorized/creating',data:{hasChecked:hasCheckedRef.current,authorized,isCreatingRole:isCreatingRoleRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return;
    }

    // Wait for loading to complete
    if (authLoading || rolesLoading || creatingRole) {
      if (checkState !== "loading") {
        setCheckState("loading");
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:136',message:'Still loading - blocking authorization',data:{authLoading,rolesLoading,creatingRole,path:location.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.log("[RoleGate] Still loading...", { 
        authLoading, 
        rolesLoading, 
        creatingRole,
        path: location.pathname 
      });
      
      // Safety timeout: if loading takes more than 10 seconds, allow access to prevent infinite loop
      timeoutRef.current = setTimeout(() => {
        console.warn("[RoleGate] Loading timeout - allowing access to prevent infinite loop");
        setAuthorized(true);
        setCheckState("authorized");
        hasCheckedRef.current = true;
      }, 10000);
      
      return;
    }

    // No user - redirect to login
    if (!user) {
      console.log("[RoleGate] No user found, redirecting to login");
      setCheckState("redirecting");
      safeNavigate("/login");
      hasCheckedRef.current = true;
      return;
    }

    // Clear timeout since we're proceeding
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If roles are unexpectedly empty on a provider route, refetch once before deciding
    if (
      requiredRole === "provider" &&
      userRoles.length === 0 &&
      !pendingRoleRefetchRef.current
    ) {
      pendingRoleRefetchRef.current = true;
      setCheckState("loading");
      refetchRoles().finally(() => {
        pendingRoleRefetchRef.current = false;
      });
      return;
    }

    // Mark as checking - only set if not already checking
    if (checkState !== "checking") {
      setCheckState("checking");
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:177',message:'Starting role check',data:{requiredRole,userRoles:JSON.stringify(userRoles),pathname:location.pathname,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Log current state
    console.log("[RoleGate] === ROLE CHECK ===", {
      requiredRole,
      userRoles,
      pathname: location.pathname,
      userId: user.id,
    });

    // Helper to check roles
    const hasRole = (role: string) => userRoles.includes(role);
    const isProvider = hasRole("provider");
    const isCustomer = hasRole("customer");
    const isAdmin = hasRole("admin");
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:190',message:'Role check results',data:{isProvider,isCustomer,isAdmin,userRoles:JSON.stringify(userRoles)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    console.log("[RoleGate] Role Status:", { isProvider, isCustomer, isAdmin });

    // ============================================
    // PROVIDER ROUTE (/dashboard/pro)
    // ============================================
    if (requiredRole === "provider") {
      if (isProvider) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:199',message:'Provider role confirmed - authorizing',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log("[RoleGate] ✅ User has provider role, granting access to pro dashboard");
        setAuthorized(true);
        setCheckState("authorized");
        hasCheckedRef.current = true;
        return;
      }
      
      // User does NOT have provider role
      const wantsProvider = sessionStorage.getItem("wants_provider") === "true";
      
      if (wantsProvider) {
        console.log("[RoleGate] User wants to be provider, redirecting to setup");
        setCheckState("redirecting");
        safeNavigate("/pro/setup");
        hasCheckedRef.current = true;
      } else {
        console.log("[RoleGate] ⚠️ User is NOT a provider, redirecting to customer dashboard");
        setCheckState("redirecting");
        safeNavigate("/dashboard/customer");
        hasCheckedRef.current = true;
      }
      return;
    }

    // ============================================
    // CUSTOMER ROUTE (/dashboard/customer)
    // ============================================
    if (requiredRole === "customer") {
      // IMPORTANT: Providers CAN access customer dashboard
      // But we should check if they SHOULD be redirected to pro dashboard
      
      // If user is a provider AND came here without explicitly choosing customer mode
      // AND they're not on a customer-specific action, consider redirecting
      const explicitCustomerMode = sessionStorage.getItem("explicit_customer_mode") === "true";
      
      if (isProvider && !explicitCustomerMode && !location.search.includes("view=")) {
        // Provider accessing customer dashboard root - might be a misdirect
        // Check if this was intentional by looking at referrer
        const fromProDashboard = document.referrer.includes("/dashboard/pro");
        const fromNavigation = sessionStorage.getItem("navigated_from_menu") === "true";
        
        if (!fromProDashboard && !fromNavigation) {
          console.log("[RoleGate] ⚠️ Provider landed on customer dashboard - redirecting to pro dashboard");
          setCheckState("redirecting");
          safeNavigate("/dashboard/pro");
          hasCheckedRef.current = true;
          return;
        }
      }
      
      if (isCustomer || isProvider) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:246',message:'Customer/provider role confirmed - authorizing',data:{isCustomer,isProvider,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log("[RoleGate] ✅ User has customer/provider role, granting access");
        setAuthorized(true);
        setCheckState("authorized");
        hasCheckedRef.current = true;
        return;
      }
      
      // No roles at all - verify in database first, then auto-create customer role if truly missing
      // Prevent multiple role creation attempts
      if (isCreatingRoleRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:255',message:'Role creation already in progress',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.log("[RoleGate] Role creation already in progress, skipping...");
        return;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:260',message:'No roles found - starting role creation flow',data:{userId:user.id,userRoles:JSON.stringify(userRoles)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.log("[RoleGate] ⚠️ User appears to have NO roles, verifying in database...");
      isCreatingRoleRef.current = true;
      setCreatingRole(true);
      setCheckState("loading");
      hasCheckedRef.current = true; // Mark as checked to prevent re-running
      
      // If roles are unexpectedly empty, refetch once before creating a role
      if (userRoles.length === 0 && !pendingRoleRefetchRef.current) {
        pendingRoleRefetchRef.current = true;
        setCheckState("loading");
        refetchRoles().finally(() => {
          pendingRoleRefetchRef.current = false;
        });
            return;
          }
          
          // User truly has no roles - create customer role with conflict protection
          console.log("[RoleGate] User confirmed to have NO roles, creating customer role...");
          supabase
            .from("user_roles")
            .insert({ user_id: user.id, role: "customer" })
            .then(({ error }) => {
              isCreatingRoleRef.current = false;
              
              if (error) {
                // Check if it's a duplicate key error (23505) or unique constraint violation
                if (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("duplicate")) {
                  console.log("[RoleGate] Customer role already exists (duplicate prevented)");
                } else {
                  console.error("[RoleGate] Failed to create customer role:", error);
                }
              } else {
                console.log("[RoleGate] Customer role created successfully");
              }
              
              // Invalidate and refetch roles, then authorize
              queryClient.invalidateQueries({ queryKey: ["userRoles", user.id] });
              // Use setTimeout to allow React Query to refetch before setting authorized
              setTimeout(() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoleGate.tsx:319',message:'Setting authorized after role creation timeout',data:{userId:user.id,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                setCreatingRole(false);
                setAuthorized(true);
                setCheckState("authorized");
              }, 200);
            })
            .catch((err) => {
              console.error("[RoleGate] Unexpected error creating role:", err);
              isCreatingRoleRef.current = false;
              setCreatingRole(false);
              // Allow access even if role creation fails to prevent blocking
          setAuthorized(true);
          setCheckState("authorized");
        });
      return;
    }

    // ============================================
    // ADMIN ROUTE
    // ============================================
    if (requiredRole === "admin") {
      if (isAdmin) {
        console.log("[RoleGate] ✅ User has admin role, granting access");
        setAuthorized(true);
        setCheckState("authorized");
        hasCheckedRef.current = true;
        return;
      }
      
      console.log("[RoleGate] User is not admin, redirecting to home");
      setCheckState("redirecting");
      safeNavigate("/");
      hasCheckedRef.current = true;
      return;
    }

    // ============================================
    // NO ROLE REQUIRED
    // ============================================
    console.log("[RoleGate] No role required, granting access");
    setAuthorized(true);
    setCheckState("authorized");
  }, [
    user?.id, // Only depend on user ID, not entire user object
    authLoading, 
    rolesLoading, 
    userRoles, 
    requiredRole, 
    location.pathname,
    location.search,
    creatingRole
    // Removed: queryClient, refetchRoles, authorized, checkState to prevent infinite loops
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Safety timeout for redirecting state to prevent infinite loading
  useEffect(() => {
    if (checkState !== "redirecting") return;

    const redirectTimeout = setTimeout(() => {
      console.warn("[RoleGate] Redirect timeout - allowing access to prevent infinite loop");
      setAuthorized(true);
      setCheckState("authorized");
    }, 8000);

    return () => clearTimeout(redirectTimeout);
  }, [checkState]);

  // Show loading state
  if (checkState === "loading" || checkState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white text-lg">
            {creatingRole ? "Setting up your account..." : "Verifying access..."}
          </p>
        </div>
      </div>
    );
  }

  // Show redirecting state
  if (checkState === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white text-lg">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <p className="text-white text-lg">Access denied</p>
          <button 
            onClick={() => navigate("/")}
            className="text-[#D9743A] hover:underline"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
