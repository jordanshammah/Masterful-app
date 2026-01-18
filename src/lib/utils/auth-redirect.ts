/**
 * UNIFIED AUTH REDIRECT SYSTEM
 * 
 * Handles post-authentication redirects and role management.
 * SIMPLIFIED: Role checking is the source of truth, not verification status.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchUserRolesWithProviderFallback } from "@/lib/utils/roles";

export type UserRole = "customer" | "provider" | "admin";

export interface UserAuthStatus {
  roles: string[];
  hasProviderRole: boolean;
  hasCustomerRole: boolean;
  hasAdminRole: boolean;
}

// SessionStorage keys
const WANTS_PROVIDER_KEY = "wants_provider";
const REDIRECT_LOCK_KEY = "auth_redirect_in_progress";
const REDIRECT_LOCK_TIMEOUT = 3000;

// Module-level redirect lock
let redirectInProgress = false;
let redirectLockTimeout: NodeJS.Timeout | null = null;

/**
 * Check if a redirect is currently in progress
 */
function isRedirectInProgress(): boolean {
  if (redirectInProgress) return true;
  
  const lockTime = sessionStorage.getItem(REDIRECT_LOCK_KEY);
  if (lockTime) {
    const elapsed = Date.now() - parseInt(lockTime, 10);
    if (elapsed > REDIRECT_LOCK_TIMEOUT) {
      clearRedirectLock();
      return false;
    }
    return true;
  }
  
  return false;
}

/**
 * Set redirect lock
 */
function setRedirectLock(): void {
  redirectInProgress = true;
  sessionStorage.setItem(REDIRECT_LOCK_KEY, Date.now().toString());
  
  if (redirectLockTimeout) {
    clearTimeout(redirectLockTimeout);
  }
  redirectLockTimeout = setTimeout(() => {
    clearRedirectLock();
  }, REDIRECT_LOCK_TIMEOUT);
  
  console.log("[AuthRedirect] Redirect lock set");
}

/**
 * Clear redirect lock
 */
function clearRedirectLock(): void {
  redirectInProgress = false;
  sessionStorage.removeItem(REDIRECT_LOCK_KEY);
  if (redirectLockTimeout) {
    clearTimeout(redirectLockTimeout);
    redirectLockTimeout = null;
  }
  console.log("[AuthRedirect] Redirect lock cleared");
}

/**
 * Set wants_provider flag
 */
export function setWantsProvider(): void {
  sessionStorage.setItem(WANTS_PROVIDER_KEY, "true");
  console.log("[AuthRedirect] Set wants_provider flag");
}

/**
 * Clear wants_provider flag
 */
export function clearWantsProvider(): void {
  sessionStorage.removeItem(WANTS_PROVIDER_KEY);
  console.log("[AuthRedirect] Cleared wants_provider flag");
}

/**
 * Check if user wants to be a provider
 */
export function wantsProvider(): boolean {
  return sessionStorage.getItem(WANTS_PROVIDER_KEY) === "true";
}

/**
 * Start Pro Onboarding
 */
export function startProOnboarding(navigate: (path: string) => void): void {
  console.log("[AuthRedirect] startProOnboarding() called");
  setWantsProvider();
  navigate("/pro/setup");
}

/**
 * Get user's authentication status including roles
 * SIMPLIFIED: Only checks roles, no verification status to avoid loops
 */
export async function getUserAuthStatus(userId: string): Promise<UserAuthStatus> {
  try {
    const userRoles = await fetchUserRolesWithProviderFallback(userId);
    const hasProviderRole = userRoles.includes("provider");
    const hasCustomerRole = userRoles.includes("customer");
    const hasAdminRole = userRoles.includes("admin");

    if (import.meta.env.DEV) {
      console.log("[AuthRedirect] getUserAuthStatus:", {
        userId,
        userRoles,
        hasProviderRole,
        hasCustomerRole,
        hasAdminRole,
      });
    }

    return {
      roles: userRoles,
      hasProviderRole,
      hasCustomerRole,
      hasAdminRole,
    };
  } catch (error) {
    console.error("[AuthRedirect] Error getting auth status:", error);
    return {
      roles: [],
      hasProviderRole: false,
      hasCustomerRole: false,
      hasAdminRole: false,
    };
  }
}

/**
 * UNIFIED POST-AUTH REDIRECT HANDLER
 * 
 * PRIORITY ORDER:
 * 1. If wants_provider flag is set → /pro/setup
 * 2. If user has PROVIDER role → /dashboard/pro (PROVIDER TAKES PRIORITY)
 * 3. If user has customer role → /dashboard/customer
 * 4. Otherwise → /dashboard/customer (will auto-create role)
 */
export async function handlePostAuthRedirect(
  userId: string,
  navigate: (path: string, options?: { replace?: boolean }) => void
): Promise<void> {
  if (isRedirectInProgress()) {
    console.log("[AuthRedirect] Redirect already in progress, skipping");
    return;
  }
  
  try {
    setRedirectLock();
    console.log("[AuthRedirect] ========================================");
    console.log("[AuthRedirect] handlePostAuthRedirect() for userId:", userId);
    
    let redirectPath: string;
    
    // Step 1: Check wants_provider flag FIRST (signup flow)
    if (wantsProvider()) {
      console.log("[AuthRedirect] → User wants to become provider → /pro/setup");
      redirectPath = "/pro/setup";
    } else {
      // Step 2: Fetch ALL roles for the user (with provider fallback)
      console.log("[AuthRedirect] Fetching user roles...");
      const userRoles = await fetchUserRolesWithProviderFallback(userId);
      const hasProviderRole = userRoles.includes("provider");
      const hasCustomerRole = userRoles.includes("customer");
      const hasAdminRole = userRoles.includes("admin");
      
      console.log("[AuthRedirect] User roles:", {
        userRoles,
        hasProviderRole,
        hasCustomerRole,
        hasAdminRole,
      });
      
      // Step 3: Determine redirect based on role PRIORITY
      // PROVIDER role takes precedence over customer role
      if (hasAdminRole) {
        console.log("[AuthRedirect] → User is ADMIN → /admin");
        redirectPath = "/admin";
      } else if (hasProviderRole) {
        console.log("[AuthRedirect] → User is PROVIDER → /dashboard/pro");
        redirectPath = "/dashboard/pro";
      } else if (hasCustomerRole) {
        console.log("[AuthRedirect] → User is CUSTOMER → /dashboard/customer");
        redirectPath = "/dashboard/customer";
      } else {
        console.log("[AuthRedirect] → User has NO roles → /dashboard/customer (will auto-create)");
        redirectPath = "/dashboard/customer";
      }
    }
    
    console.log("[AuthRedirect] Final redirect:", redirectPath);
    console.log("[AuthRedirect] ========================================");
    
    navigate(redirectPath, { replace: true });
    clearRedirectLock();
    
  } catch (error) {
    console.error("[AuthRedirect] Redirect error:", error);
    clearRedirectLock();
    
    try {
      // Safe fallback
      navigate("/dashboard/customer", { replace: true });
    } catch (navError) {
      console.error("[AuthRedirect] Fallback navigation failed:", navError);
    }
  }
}

/**
 * Complete provider verification process
 */
export async function completeProviderVerification(userId: string): Promise<void> {
  try {
    console.log("[AuthRedirect] completeProviderVerification() called for userId:", userId);
    
    await upgradeToProvider(userId);
    
    // Mark setup as complete
    sessionStorage.setItem("pro_setup_complete", "true");
    
    // Clear wants_provider flag
    clearWantsProvider();
    
    console.log("[AuthRedirect] Provider verification completed successfully");
  } catch (error) {
    console.error("[AuthRedirect] Error completing provider verification:", error);
    throw error;
  }
}

/**
 * Upgrade customer to provider role
 */
export async function upgradeToProvider(userId: string): Promise<void> {
  try {
    console.log("[AuthRedirect] upgradeToProvider() called for userId:", userId);
    
    // Check if provider role already exists
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const hasProviderRole = existingRoles?.some((r) => r.role === "provider");
    if (hasProviderRole) {
      console.log("[AuthRedirect] User already has provider role, skipping");
      clearWantsProvider();
      return;
    }
    
    // Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("User not authenticated. Please sign in and try again.");
    }

    // Call Edge Function to upgrade role
    console.log("[AuthRedirect] Calling Edge Function to upgrade role to provider...");
    
    const { data, error } = await supabase.functions.invoke("request-role-provider", {
      body: { role: "provider" },
    });

    if (import.meta.env.DEV) {
      console.log("[AuthRedirect] Edge Function response:", { data, error });
    }

    if (error) {
      let errorMessage = error.message || "Failed to send request to Edge Function";
      
      if (error.context) {
        const context = error.context as any;
        if (context instanceof Response || (typeof context.json === 'function' || typeof context.text === 'function')) {
          try {
            const response = context as Response;
            const errorBody = await response.text();
            try {
              const parsed = JSON.parse(errorBody);
              errorMessage = parsed.error || parsed.detail || errorMessage;
            } catch {
              if (errorBody) errorMessage = errorBody;
            }
          } catch (e) {
            console.warn("[AuthRedirect] Could not read error from response:", e);
          }
        }
      }
      
      console.error("[AuthRedirect] Error calling Edge Function:", errorMessage);
      throw new Error(`Failed to upgrade role to provider: ${errorMessage}`);
    }

    if (data && typeof data === 'object' && 'error' in data) {
      const errorMessage = (data as any).error || (data as any).detail || "Unknown error";
      console.error("[AuthRedirect] Edge Function returned error:", errorMessage);
      throw new Error(`Failed to upgrade role to provider: ${errorMessage}`);
    }

    if (!data || !data.success) {
      const errorMessage = data?.error || data?.detail || "Edge Function did not return success";
      console.error("[AuthRedirect] Edge Function did not return success:", errorMessage);
      throw new Error(`Failed to upgrade role to provider: ${errorMessage}`);
    }

    console.log("[AuthRedirect] Role upgraded to provider successfully");

    // Update user metadata (non-blocking)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            role: "provider",
          },
        });
      }
    } catch (metadataErr) {
      console.warn("[AuthRedirect] Warning: Error updating metadata:", metadataErr);
    }
    
    console.log("[AuthRedirect] User upgraded to provider role successfully");
  } catch (error) {
    console.error("[AuthRedirect] Error upgrading to provider:", error);
    throw error;
  }
}
