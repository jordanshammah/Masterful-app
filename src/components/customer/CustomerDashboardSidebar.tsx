/**
 * Customer Dashboard Sidebar
 * Premium sidebar navigation with Masterful theme
 * Updated with new layout structure
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Briefcase,
  Wallet,
  UserCircle,
  Shield,
  LifeBuoy,
  Settings,
  LogOut,
  ArrowLeft,
  Plus,
  Menu,
  X,
  ChevronDown,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { CustomerDashboardView } from "@/types/customer-dashboard";

interface CustomerDashboardSidebarProps {
  activeView: CustomerDashboardView;
  onNavigate: (view: CustomerDashboardView) => void;
  profile?: {
    full_name?: string;
    photo_url?: string;
  };
}

const navItems: Array<{
  id: CustomerDashboardView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "home", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "My Jobs", icon: Briefcase },
  { id: "wallet", label: "Wallet & Billing", icon: Wallet },
  { id: "account", label: "Account Details", icon: UserCircle },
  { id: "security", label: "Security", icon: Shield },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "settings", label: "Settings", icon: Settings },
];

export const CustomerDashboardSidebar = ({
  activeView,
  onNavigate,
  profile,
}: CustomerDashboardSidebarProps) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const firstName = profile?.full_name?.split(" ")[0] || "Customer";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleBookService = () => {
    navigate("/services");
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 inline-flex items-center p-2 mt-2 ms-3 text-sm text-white bg-transparent border border-transparent rounded-lg hover:bg-white/5 focus:outline-none focus:ring-4 focus:ring-white/10 sm:hidden"
        aria-controls="separator-sidebar"
        aria-expanded={sidebarOpen}
      >
        <span className="sr-only">Open sidebar</span>
        {sidebarOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        id="separator-sidebar"
        className={cn(
          "fixed top-0 left-0 z-40 w-64 h-screen transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        )}
        aria-label="Sidebar"
      >
        <div className="h-full px-3 py-4 overflow-y-auto bg-black border-r border-white/10 scrollbar-hide">
          {/* Profile Section */}
          <div className="px-2 py-4 mb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-[#D9743A]/30">
                <AvatarImage src={profile?.photo_url} alt={firstName} />
                <AvatarFallback className="bg-[#D9743A]/20 text-[#D9743A] font-semibold">
                  {firstName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || "Customer"}
                </p>
                <p className="text-xs text-white/50">Active</p>
              </div>
            </div>
          </div>

          {/* Book Service Button */}
          <div className="px-2 py-2 mb-4">
            <Button
              className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold gap-2"
              onClick={handleBookService}
            >
              <Plus className="w-4 h-4" />
              Book a Service
            </Button>
          </div>

          {/* Navigation */}
          <ul className="space-y-2 font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "flex items-center w-full px-2 py-1.5 text-sm rounded-lg transition-all duration-200 group",
                      isActive
                        ? "bg-white/5 text-[#D9743A]"
                        : "text-white/70 hover:bg-white/5 hover:text-[#D9743A]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 transition duration-200",
                        isActive ? "text-[#D9743A]" : "group-hover:text-[#D9743A]"
                      )}
                    />
                    <span className="ms-3 flex-1 text-left">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer Section */}
          <ul className="space-y-2 font-medium border-t border-white/10 pt-4 mt-4">
            <li>
              <button
                onClick={() => {
                  navigate("/services");
                  setSidebarOpen(false);
                }}
                className="flex items-center w-full px-2 py-1.5 text-sm text-white/70 rounded-lg hover:bg-white/5 hover:text-[#D9743A] group transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5 transition duration-200 group-hover:text-[#D9743A]" />
                <span className="flex-1 ms-3 text-left">Back to Services</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  handleLogout();
                  setSidebarOpen(false);
                }}
                className="flex items-center w-full px-2 py-1.5 text-sm text-white/70 rounded-lg hover:bg-white/5 hover:text-[#D9743A] group transition-all duration-200"
              >
                <LogOut className="w-5 h-5 transition duration-200 group-hover:text-[#D9743A]" />
                <span className="flex-1 ms-3 text-left">Logout</span>
              </button>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center px-2 py-1.5 text-sm text-white/70 rounded-lg hover:bg-white/5 hover:text-[#D9743A] group transition-all duration-200"
              >
                <BookOpen className="w-5 h-5 transition duration-200 group-hover:text-[#D9743A]" />
                <span className="flex-1 ms-3">Documentation</span>
              </a>
            </li>
            <li>
              <a
                href="#"
                className="flex items-center px-2 py-1.5 text-sm text-white/70 rounded-lg hover:bg-white/5 hover:text-[#D9743A] group transition-all duration-200"
              >
                <HelpCircle className="w-5 h-5 transition duration-200 group-hover:text-[#D9743A]" />
                <span className="flex-1 ms-3">Support</span>
              </a>
            </li>
          </ul>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};
