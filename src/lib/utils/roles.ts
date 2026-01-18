import { supabase } from "@/integrations/supabase/client";

export type RoleName = "customer" | "provider" | "admin";
export type ActiveRole = "customer" | "provider" | null;

export async function fetchUserRolesWithProviderFallback(
  userId: string
): Promise<string[]> {
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesError) {
    console.error("[roles] Failed to fetch roles:", rolesError);
  }

  const roles = rolesData?.map((r) => r.role) || [];
  const hasProviderRole = roles.includes("provider");

  if (!hasProviderRole) {
    const { data: providerData, error: providerError } = await supabase
      .from("providers")
      .select("id, user_id")
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    if (providerError) {
      console.error("[roles] Failed to check provider record:", providerError);
    }

    if (providerData) {
      const { error: upsertError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "provider" },
          { onConflict: "user_id,role" }
        );

      if (upsertError) {
        console.error("[roles] Failed to upsert provider role:", upsertError);
      } else {
        return Array.from(new Set([...roles, "provider"]));
      }
    }
  }

  return roles;
}

export function getRoleFlags(roles: string[]) {
  const hasProviderRole = roles.includes("provider");
  const hasCustomerRole = roles.includes("customer");
  const hasAdminRole = roles.includes("admin");

  return {
    hasProviderRole,
    hasCustomerRole,
    hasAdminRole,
  };
}

export function getActiveRole(
  roles: string[],
  explicitCustomerMode: boolean
): ActiveRole {
  const { hasProviderRole, hasCustomerRole } = getRoleFlags(roles);

  if (explicitCustomerMode && hasCustomerRole) {
    return "customer";
  }

  if (hasProviderRole) {
    return "provider";
  }

  if (hasCustomerRole) {
    return "customer";
  }

  return null;
}

export function resolveDashboardRoute(
  roles: string[],
  explicitCustomerMode: boolean
): string {
  const { hasAdminRole } = getRoleFlags(roles);
  if (hasAdminRole) return "/admin";

  const activeRole = getActiveRole(roles, explicitCustomerMode);
  if (activeRole === "provider") return "/dashboard/pro";
  return "/dashboard/customer";
}
