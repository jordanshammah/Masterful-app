/**
 * Customer Dashboard - Complete Rebuild
 * Premium customer dashboard with sidebar navigation
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { wantsProvider, handlePostAuthRedirect } from "@/lib/utils/auth-redirect";
import { useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/lib/api/customer";
import { useCustomerRealtime } from "@/hooks/useRealtime";
import { CustomerDashboardSidebar } from "@/components/customer/CustomerDashboardSidebar";
import type { CustomerDashboardView } from "@/types/customer-dashboard";

// View components
import { CustomerDashboardHome } from "@/components/customer/views/CustomerDashboardHome";
import { CustomerJobsView } from "@/components/customer/views/CustomerJobsView";
import { CustomerWalletView } from "@/components/customer/views/CustomerWalletView";
import { CustomerAccountView } from "@/components/customer/views/CustomerAccountView";
import { CustomerSecurityView } from "@/components/customer/views/CustomerSecurityView";
import { CustomerSupportView } from "@/components/customer/views/CustomerSupportView";
import { CustomerSettingsView } from "@/components/customer/views/CustomerSettingsView";

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading, error: rolesError } = useUserRoles();
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  
  // Enable realtime updates for jobs, payments, and profile changes
  // This ensures the dashboard updates automatically when data changes
  useCustomerRealtime({
    enabled: !!user,
    onDataChange: (payload) => {
      // Show toast notification for important updates
      if (payload.table === "jobs" && payload.eventType === "UPDATE") {
        const newData = payload.new as Record<string, unknown>;
        const oldData = payload.old as Record<string, unknown>;
        if (newData.status !== oldData.status) {
          toast({
            title: "Job Updated",
            description: `Job status changed to ${newData.status}`,
          });
        }
      }
    },
  });
  
  // Get active view from URL params or default to home
  const activeView = (searchParams.get("view") || "home") as CustomerDashboardView;

  // Check if user has customer role
  const hasCustomerRole = useMemo(() => {
    return userRoles.includes("customer");
  }, [userRoles]);

  // NOTE: Auth is handled by RoleGate wrapper in App.tsx
  // RoleGate ensures user is logged in and has appropriate role
  // No redundant auth checks needed here - RoleGate handles it all
  
  useEffect(() => {
    // Just log for debugging
    if (!authLoading && user) {
      console.log("[CustomerDashboard] Rendering for user:", user.id);
      console.log("[CustomerDashboard] User roles:", userRoles);
    }
  }, [authLoading, user, userRoles]);

  // Update URL when view changes
  const handleNavigate = (view: CustomerDashboardView) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    setSearchParams(params, { replace: true });
  };

  // Loading state
  if (authLoading || rolesLoading) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerDashboard.tsx:84',message:'CustomerDashboard showing loading state',data:{authLoading,rolesLoading,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-lg text-white/60">Loading dashboard...</div>
      </div>
    );
  }

  // REMOVED: Role check blocking - if user has session, show dashboard
  // Roles will be created/checked in background, don't block UI

  // Render active view
  const renderView = () => {
    switch (activeView) {
      case "home":
        return <CustomerDashboardHome customerId={user.id} />;
      case "jobs":
        return <CustomerJobsView customerId={user.id} />;
      case "wallet":
        return <CustomerWalletView customerId={user.id} />;
      case "account":
        return <CustomerAccountView customerId={user.id} />;
      case "security":
        return <CustomerSecurityView customerId={user.id} />;
      case "support":
        return <CustomerSupportView customerId={user.id} />;
      case "settings":
        return <CustomerSettingsView customerId={user.id} />;
      default:
        return <CustomerDashboardHome customerId={user.id} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <CustomerDashboardSidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        profile={{
          full_name: user.user_metadata?.full_name,
          photo_url: user.user_metadata?.photo_url,
        }}
      />
      <div className="p-4 sm:ml-64">
        <main className="overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CustomerDashboard;

