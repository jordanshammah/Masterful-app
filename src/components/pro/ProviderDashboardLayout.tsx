/**
 * Provider Dashboard Layout
 * Responsive dashboard shell with sidebar, header, and bottom navigation.
 */

import { ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardView } from "@/types/pro-dashboard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  useProEarningsEnhanced,
  useProProfileEnhanced,
} from "@/hooks/useProEnhanced";
import {
  Briefcase,
  CalendarDays,
  FileText,
  Home,
  TrendingUp,
  Wallet,
  UserCircle,
  Settings,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const navItems: Array<{
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  targetView: DashboardView;
  matchViews: DashboardView[];
}> = [
  {
    id: "home",
    label: "Dashboard",
    icon: Home,
    targetView: "home",
    matchViews: ["home"],
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: Briefcase,
    targetView: "jobs",
    matchViews: ["jobs", "jobs-active", "jobs-pending", "jobs-completed"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    targetView: "calendar",
    matchViews: ["calendar"],
  },
  {
    id: "earnings",
    label: "Earnings",
    icon: TrendingUp,
    targetView: "earnings",
    matchViews: ["earnings"],
  },
  {
    id: "payouts",
    label: "Payouts",
    icon: Wallet,
    targetView: "payouts",
    matchViews: ["payouts"],
  },
  {
    id: "profile",
    label: "Basic Info",
    icon: UserCircle,
    targetView: "profile",
    matchViews: ["profile"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    targetView: "settings",
    matchViews: ["settings"],
  },
];

interface ProviderDashboardLayoutProps {
  children: ReactNode;
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
}

export const ProviderDashboardLayout = ({
  children,
  activeView,
  onNavigate,
}: ProviderDashboardLayoutProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const providerId = user?.id || "";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useProProfileEnhanced(providerId);
  const {
    data: earnings,
    isLoading: earningsLoading,
    isError: earningsError,
  } = useProEarningsEnhanced(providerId);

  const providerName = useMemo(() => {
    return (
      profile?.profiles?.full_name ||
      profile?.display_name ||
      profile?.business_name ||
      user?.user_metadata?.full_name ||
      "Professional"
    );
  }, [
    profile?.profiles?.full_name,
    profile?.display_name,
    profile?.business_name,
    user?.user_metadata?.full_name,
  ]);

  const initials = useMemo(() => {
    const parts = providerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase());
    return parts.join("") || "P";
  }, [providerName]);

  const totalEarnings = earnings?.lifetime?.amount || 0;
  const earningsLabel = useMemo(
    () => currencyFormatter.format(totalEarnings),
    [totalEarnings]
  );

  const hasHeaderError = profileError || earningsError;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleBackToServices = () => {
    navigate("/services");
  };

  const renderNavItem = (
    item: (typeof navItems)[number],
    isMobile?: boolean
  ) => {
    const isActive = item.matchViews.includes(activeView);

    if (isMobile) {
      return (
        <button
          key={item.id}
          type="button"
          aria-label={item.label}
          onClick={() => onNavigate(item.targetView)}
          className={cn(
            "flex h-full flex-1 flex-col items-center justify-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            isActive
              ? "text-[#D9743A]"
              : "text-[#D9743A]/70 hover:text-[#D9743A]"
          )}
        >
          <item.icon className={cn("h-5 w-5", isActive ? "text-[#D9743A]" : "text-[#D9743A]/70")} />
          <span className="text-[10px] mt-1">{item.label}</span>
        </button>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onNavigate(item.targetView);
          setSidebarOpen(false);
        }}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          isActive
            ? "bg-white/10 text-[#D9743A]"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        )}
      >
        <item.icon
          className={cn(
            "h-5 w-5 transition",
            isActive ? "text-[#D9743A]" : "text-white/60 group-hover:text-[#D9743A]"
          )}
        />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Mobile Toggle Button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 inline-flex items-center p-2 mt-2 ms-3 text-sm text-white bg-transparent border border-transparent rounded-lg hover:bg-white/5 focus:outline-none focus:ring-4 focus:ring-white/10"
        aria-controls="provider-sidebar"
        aria-expanded={sidebarOpen}
      >
        <span className="sr-only">Open sidebar</span>
        {sidebarOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Desktop & Mobile sidebar */}
      <aside
        id="provider-sidebar"
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 flex-col bg-[#050505] border-r border-white/10 shadow-[0_0_35px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col gap-1 px-6 py-6 border-b border-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.6em] text-white/50">
              Masterful
            </p>
            <p className="text-sm text-white/50">Provider Dashboard</p>
          </div>

          {/* Profile Section */}
          <div className="px-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-[#D9743A]/30">
                {profile?.profiles?.photo_url ? (
                  <AvatarImage src={profile.profiles.photo_url} alt={providerName} />
                ) : (
                  <AvatarFallback className="bg-[#D9743A]/20 text-[#D9743A] font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                {profileLoading ? (
                  <Skeleton className="h-4 w-24 rounded" />
                ) : (
                  <p className="text-sm font-medium text-white truncate">
                    {providerName}
                  </p>
                )}
                <p className="text-xs text-white/50">
                  {profile?.is_verified ? "Verified Pro" : "Provider"}
                </p>
              </div>
            </div>
            {/* Earnings Badge */}
            <div className="mt-3">
              {earningsLoading ? (
                <Skeleton className="h-8 w-full rounded-lg" />
              ) : (
                <div className="bg-[#D9743A]/10 border border-[#D9743A]/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-white/50">Total Earnings</p>
                  <p className="text-lg font-bold text-[#D9743A]">{earningsLabel}</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {navItems.map((item) => renderNavItem(item))}
          </nav>

          {/* Footer Navigation */}
          <div className="px-3 py-4 border-t border-white/10 space-y-1">
            <button
              type="button"
              onClick={() => {
                handleBackToServices();
                setSidebarOpen(false);
              }}
              className="group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white transition"
            >
              <ArrowLeft className="h-5 w-5 text-white/60 group-hover:text-[#D9743A]" />
              <span>Back to Services</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleLogout();
                setSidebarOpen(false);
              }}
              className="group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white transition"
            >
              <LogOut className="h-5 w-5 text-white/60 group-hover:text-[#D9743A]" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header + content */}
      <div className="md:ml-[256px]">
        <header className="relative z-20 hidden md:flex items-center justify-between gap-4 border-b border-white/10 bg-[#040404]/80 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="ml-12 md:ml-0">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">
              Masterful
            </p>
            <p className="text-2xl font-semibold leading-none text-white">
              Provider Dashboard
            </p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="hidden sm:block text-right text-sm leading-tight">
              <p className="uppercase text-xs text-white/60">Provider</p>
              {profileLoading ? (
                <Skeleton className="mt-1 h-5 w-32 rounded-full" />
              ) : (
                <p className="text-lg font-semibold">{providerName}</p>
              )}
            </div>
            <div className="hidden sm:block">
              {earningsLoading ? (
                <Skeleton className="h-9 w-28 rounded-full" />
              ) : (
                <Badge className="border-[#D9743A]/40 bg-[#D9743A]/10 text-[#D9743A]">
                  {earningsLabel}
                </Badge>
              )}
            </div>
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-white/10 bg-white/5">
              {profile?.profiles?.photo_url ? (
                <AvatarImage src={profile.profiles.photo_url} alt={providerName} />
              ) : (
                <AvatarFallback>{initials}</AvatarFallback>
              )}
            </Avatar>
          </div>
        </header>
        {hasHeaderError && (
          <div className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 sm:px-6">
            Unable to refresh provider data right now. Please try again shortly.
          </div>
        )}
        <main className="px-4 py-6 md:pb-6 sm:px-6">
          <div className="max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
