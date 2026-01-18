/**
 * Pro Dashboard - Provider Dashboard
 * Premium professional dashboard with sidebar navigation
 * 
 * SIMPLIFIED: RoleGate handles authorization, this component trusts that
 */

import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useProviderRealtime } from "@/hooks/useRealtime";
import { ProviderDashboardLayout } from "@/components/pro/ProviderDashboardLayout";
import type { DashboardView } from "@/types/pro-dashboard";

// View components
import { ProDashboardHome } from "@/components/pro/views/ProDashboardHome";
import { ProJobsView } from "@/components/pro/views/ProJobsView";
import { ProCalendarView } from "@/components/pro/views/ProCalendarView";
import { ProEarningsView } from "@/components/pro/views/ProEarningsView";
import { ProPayoutsView } from "@/components/pro/views/ProPayoutsView";
import { ProProfileView } from "@/components/pro/views/ProProfileView";
import { ProSettingsView } from "@/components/pro/views/ProSettingsView";

const ProDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  // Enable realtime updates for jobs, payments, reviews, and provider profile changes
  useProviderRealtime({
    enabled: !!user,
    onDataChange: (payload) => {
      // Show toast notification for important updates
      if (payload.table === "jobs") {
        const newData = payload.new as Record<string, unknown>;
        const oldData = payload.old as Record<string, unknown>;
        
        if (payload.eventType === "INSERT") {
          toast({
            title: "New Job Request!",
            description: "You have a new job request waiting for your response.",
          });
        } else if (payload.eventType === "UPDATE" && newData.status !== oldData.status) {
          toast({
            title: "Job Updated",
            description: `Job status changed to ${newData.status}`,
          });
        }
      } else if (payload.table === "reviews" && payload.eventType === "INSERT") {
        toast({
          title: "New Review!",
          description: "A customer left you a new review.",
        });
      }
    },
  });
  
  // Get active view from URL params or default to home
  const activeView = (searchParams.get("view") || "home") as DashboardView;

  // Update URL when view changes
  const handleNavigate = (view: DashboardView) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    setSearchParams(params, { replace: true });
  };

  // Loading state - brief loading while auth initializes
  // RoleGate handles the actual authorization, so we just need to wait for user
  if (authLoading) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProDashboard.tsx:69',message:'ProDashboard showing loading state',data:{authLoading,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/60">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // If no user, RoleGate should have handled the redirect
  // But just in case, show a fallback
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-lg text-white/60">Please sign in to continue</div>
      </div>
    );
  }

  // Render active view
  const renderView = () => {
    switch (activeView) {
      case "home":
        return <ProDashboardHome providerId={user.id} />;
      case "jobs":
      case "jobs-active":
      case "jobs-pending":
      case "jobs-completed":
        return <ProJobsView providerId={user.id} activeTab={activeView} />;
      case "calendar":
        return <ProCalendarView providerId={user.id} />;
      case "earnings":
        return <ProEarningsView providerId={user.id} />;
      case "payouts":
        return <ProPayoutsView />;
      case "profile":
        return <ProProfileView providerId={user.id} />;
      case "settings":
        return <ProSettingsView />;
      default:
        return <ProDashboardHome providerId={user.id} />;
    }
  };

  return (
    <ProviderDashboardLayout activeView={activeView} onNavigate={handleNavigate}>
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {renderView()}
      </div>
    </ProviderDashboardLayout>
  );
};

export default ProDashboard;
