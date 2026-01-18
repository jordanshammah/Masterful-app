import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  UserCircle,
  ShieldCheck,
  Briefcase,
  Bell,
  CreditCard,
  LifeBuoy,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerAccountSidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
  onLogout: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "account", label: "Account Details", icon: UserCircle },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "jobs", label: "My Jobs", icon: Briefcase },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "support", label: "Support", icon: LifeBuoy },
];

export const CustomerAccountSidebar = ({ activePage, onNavigate, onBack, onLogout }: CustomerAccountSidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = (
    <div className="flex flex-col h-full bg-black text-white border-r border-white/10">
      <div className="px-4 py-6 border-b border-white/10">
        <p className="text-sm uppercase tracking-widest text-white/50">Masterful</p>
        <h1 className="text-2xl font-semibold mt-2">Account</h1>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all",
                "border border-transparent",
                "hover:border-white/10 hover:bg-white/5",
                isActive && "border-white/15 bg-white/5 text-[#C25A2C] relative"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-2 bottom-2 w-1 rounded-full bg-transparent transition-all",
                  isActive && "bg-[#C25A2C]"
                )}
              />
              <Icon className={cn("w-4 h-4", isActive ? "text-[#C25A2C]" : "text-white/60")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="w-full justify-start text-white/80 hover:text-white hover:bg-white/5 gap-3 border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to App
        </Button>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-white/80 hover:text-white hover:bg-white/5 gap-3"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black text-white">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="text-sm uppercase tracking-widest text-white/60">Account</span>
        <div className="w-10" />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 w-72 z-40 transform transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:flex"
        )}
      >
        {SidebarContent}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 lg:hidden text-white"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </>
  );
};

export default CustomerAccountSidebar;










