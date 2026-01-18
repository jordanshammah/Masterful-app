/**
 * Navigation - Minimal, Premium Design
 * Profile dropdown when logged in, simple navigation when not
 */

import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X, User, LogOut, UserCircle, Briefcase } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startProOnboarding } from "@/lib/utils/auth-redirect";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  getActiveRole,
  getRoleFlags,
  resolveDashboardRoute,
} from "@/lib/utils/roles";

const Navigation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading, refetch: refetchRoles } = useUserRoles();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const [currentRole, setCurrentRole] = useState<"customer" | "provider" | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setUserProfile(null);
          return;
        }

      try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, photo_url")
          .eq("id", user.id)
            .single();
          
          setUserProfile(profile);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Error getting profile:", error);
        }
      }
    };

    fetchProfile();
  }, [user?.id]);
      
  useEffect(() => {
    const explicitCustomerMode = sessionStorage.getItem("explicit_customer_mode") === "true";
    setCurrentRole(getActiveRole(userRoles, explicitCustomerMode));
  }, [userRoles]);

  const handleDashboardClick = async () => {
    // Track that this is an intentional navigation from menu
    sessionStorage.setItem("navigated_from_menu", "true");
    
    // PRIORITY: Provider role takes precedence
    // Use userRoles directly instead of currentRole state (more reliable)
    let resolvedRoles = userRoles;

    if (rolesLoading) {
      const refetchResult = await refetchRoles();
      resolvedRoles = refetchResult.data || resolvedRoles;
    }

    const explicitCustomerMode = sessionStorage.getItem("explicit_customer_mode") === "true";
    const dashboardRoute = resolveDashboardRoute(resolvedRoles, explicitCustomerMode);
    
    if (dashboardRoute === "/dashboard/pro") {
      console.log("[Navigation] Provider clicking dashboard → /dashboard/pro");
      setCurrentRole("provider");
    } else if (dashboardRoute === "/admin") {
      console.log("[Navigation] Admin clicking dashboard → /admin");
      setCurrentRole(null);
    } else {
      console.log("[Navigation] Customer/explicit mode → /dashboard/customer");
      sessionStorage.setItem("explicit_customer_mode", "true");
      setCurrentRole("customer");
    }
    
    navigate(dashboardRoute);
    
    // Clear the flag after a short delay
    setTimeout(() => {
      sessionStorage.removeItem("navigated_from_menu");
    }, 1000);
  };

  const handleSwitchRole = async (role: "customer" | "provider") => {
    // Track that this is an intentional navigation
    sessionStorage.setItem("navigated_from_menu", "true");
    
    setCurrentRole(role);
    
    if (role === "provider") {
      sessionStorage.removeItem("explicit_customer_mode");
      console.log("[Navigation] Switching to provider mode → /dashboard/pro");
      navigate("/dashboard/pro");
    } else {
      sessionStorage.setItem("explicit_customer_mode", "true");
      console.log("[Navigation] Switching to customer mode → /dashboard/customer");
      navigate("/dashboard/customer");
    }
    
    toast({
      title: "Role switched",
      description: `Switched to ${role === "provider" ? "Provider" : "Customer"} mode`,
    });
    
    // Clear the flag after a short delay
    setTimeout(() => {
      sessionStorage.removeItem("navigated_from_menu");
    }, 1000);
  };

  const handleLogout = async () => {
    // Clear all session flags
    sessionStorage.removeItem("navigated_from_menu");
    sessionStorage.removeItem("explicit_customer_mode");
    sessionStorage.removeItem("wants_provider");
    sessionStorage.removeItem("role_gate_redirect_history");
    
    await supabase.auth.signOut();
    navigate("/");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };

  const { hasProviderRole: isProvider, hasCustomerRole: isCustomer } = getRoleFlags(userRoles);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-black/95 backdrop-blur-md border-b border-white/10" 
          : "bg-black/80 backdrop-blur-sm border-b border-white/5"
      }`}
    >
      <div className="container mx-auto px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link 
            to="/" 
            className="text-2xl font-bold text-white hover:text-[#D9743A] transition-colors duration-200"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Masterful
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link 
              to="/services" 
              className="text-[#A6A6A6] hover:text-white transition-colors duration-200 text-sm"
            >
              Services
            </Link>
            
            {!user && (
              <button
                onClick={() => {
                  navigate("/signup?wants_provider=true");
                }}
                className="text-[#A6A6A6] hover:text-white transition-colors duration-200 text-sm"
              >
                Become a Pro
              </button>
            )}

            {user ? (
              <>
                {!isProvider && (
                  <Button 
                    variant="ghost"
                    onClick={() => startProOnboarding(navigate)}
                    className="text-[#A6A6A6] hover:text-white hover:bg-white/5 text-sm"
                  >
                    Become a Pro
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      {userProfile?.photo_url ? (
                        <img 
                          src={userProfile.photo_url} 
                          alt={userProfile.full_name || "Profile"}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#D9743A] flex items-center justify-center">
                          <User className="w-5 h-5 text-black" />
                        </div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#121212] border-white/10 w-48">
                    <DropdownMenuItem 
                      onClick={handleDashboardClick}
                      className="text-white hover:bg-white/10 cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      Account
                    </DropdownMenuItem>
                    {isProvider && isCustomer && (
                      <>
                        <DropdownMenuSeparator className="bg-white/10" />
                        {currentRole === "provider" ? (
                          <DropdownMenuItem 
                            onClick={() => handleSwitchRole("customer")}
                            className="text-white hover:bg-white/10 cursor-pointer"
                          >
                            <UserCircle className="w-4 h-4 mr-2" />
                            Switch to Customer Mode
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleSwitchRole("provider")}
                            className="text-white hover:bg-white/10 cursor-pointer"
                          >
                            <Briefcase className="w-4 h-4 mr-2" />
                            Switch to Provider Mode
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="text-white hover:bg-white/10 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost"
                  asChild
                  className="text-[#A6A6A6] hover:text-white hover:bg-white/5"
                >
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button 
                  asChild
                  className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-10 px-6 rounded-[6px]"
                >
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-6 border-t border-white/10">
            <div className="flex flex-col gap-4">
              <Link
                to="/services"
                className="text-[#A6A6A6] hover:text-white transition-colors py-2"
                onClick={() => setIsOpen(false)}
              >
                Services
              </Link>
              
              {user ? (
                <>
                  {!isProvider && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        startProOnboarding(navigate);
                      }}
                      className="text-left text-[#A6A6A6] hover:text-white transition-colors py-2 w-full"
                    >
                      Become a Pro
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleDashboardClick();
                    }}
                    className="text-left text-[#A6A6A6] hover:text-white transition-colors py-2"
                  >
                    Account
                  </button>
                  {isProvider && isCustomer && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        handleSwitchRole(currentRole === "provider" ? "customer" : "provider");
                      }}
                      className="text-left text-[#A6A6A6] hover:text-white transition-colors py-2"
                    >
                      Switch to {currentRole === "provider" ? "Customer" : "Provider"} Mode
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="text-left text-[#A6A6A6] hover:text-white transition-colors py-2"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/signup?wants_provider=true");
                    }}
                    className="text-left text-[#A6A6A6] hover:text-white transition-colors py-2 w-full"
                  >
                    Become a Pro
                  </button>
                  <Button 
                    variant="ghost" 
                    asChild 
                    className="w-full justify-start text-[#A6A6A6] hover:text-white"
                  >
                    <Link to="/login" onClick={() => setIsOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                  <Button 
                    asChild
                    className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
                  >
                    <Link to="/signup" onClick={() => setIsOpen(false)}>
                      Sign Up
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
