import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Briefcase, BarChart3, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();
  const hasProviderRole = userRoles.includes("provider");

  const isProDashboard = location.pathname.startsWith("/dashboard/pro");

  const customerNavItems = [
    { path: "/dashboard/customer?view=home", icon: Home, label: "Dashboard", tooltip: "Dashboard" },
    { path: "/services", icon: PlusCircle, label: "Book", tooltip: "Book a Service" },
    { path: "/dashboard/customer?view=jobs", icon: Calendar, label: "Jobs", tooltip: "Jobs" },
  ];

  const proNavItems = [
    { path: "/dashboard/pro?view=home", icon: Home, label: "Dashboard", tooltip: "Dashboard" },
    { path: "/dashboard/pro?view=jobs", icon: Briefcase, label: "Jobs", tooltip: "Jobs" },
    { path: "/dashboard/pro?view=calendar", icon: Calendar, label: "Calendar", tooltip: "Calendar" },
    { path: "/dashboard/pro?view=earnings", icon: BarChart3, label: "Earnings", tooltip: "Earnings" },
  ];

  const navItems = isProDashboard || hasProviderRole ? proNavItems : customerNavItems;

  const isActive = (path: string) => {
    if (path.includes("dashboard/customer")) {
      if (path.includes("view=")) {
        const view = path.split("view=")[1];
        return location.pathname === "/dashboard/customer" && location.search.includes(`view=${view}`);
      }
      return location.pathname === "/dashboard/customer" && !location.search.includes("view=");
    }
    return location.pathname.startsWith(path);
  };

  // Hide bottom nav on landing page, auth pages, pro setup, or when user is not authenticated
  const hideNavPages = ["/", "/login", "/signup", "/auth/callback", "/onboarding"];
  const shouldHide = 
    authLoading || 
    !user || 
    rolesLoading ||
    hideNavPages.includes(location.pathname) ||
    location.pathname.startsWith("/complete-profile") ||
    location.pathname.startsWith("/pro/setup") ||
    location.pathname.startsWith("/dashboard/pro");

  if (shouldHide) {
    return null;
  }

  return (
    <nav className="fixed z-20 w-full h-16 max-w-lg -translate-x-1/2 bg-[#1E1E1E] border border-white/10 rounded-full bottom-4 left-1/2 md:hidden">
      <div
          className={cn(
          "grid h-full max-w-lg mx-auto",
          navItems.length === 3 ? "grid-cols-3" : "grid-cols-4"
        )}
      >
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isFirst = index === 0;
          const isLast = index === navItems.length - 1;

          return (
        <Link
              key={item.path}
              to={item.path}
          className={cn(
            "inline-flex flex-col items-center justify-center px-5 hover:bg-white/5 group transition-colors",
                isFirst && "rounded-s-full",
                isLast && "rounded-e-full",
                active && "bg-white/5"
              )}
            >
              <Icon
          className={cn(
            "w-6 h-6 mb-1 transition-colors",
                  active ? "text-[#D9743A]" : "text-[#A6A6A6] group-hover:text-[#D9743A]"
                )}
              />
              <span className="sr-only">{item.tooltip}</span>
        </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;

