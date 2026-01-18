/**
 * Pro Setup Stepper - Main wrapper component
 * Manages step navigation and form state across all steps
 * 
 * FIXED: Prevents redirect loop by not redirecting providers who are intentionally on setup
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { wantsProvider, setWantsProvider, clearWantsProvider } from "@/lib/utils/auth-redirect";
import { Check } from "lucide-react";

const steps = [
  { id: 1, name: "Basic Info", route: "basic-info" },
  { id: 2, name: "Address", route: "address" },
  { id: 3, name: "Payouts", route: "payouts" },
];

export const ProSetupStepper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();
  const [currentStep, setCurrentStep] = useState(1);
  const [ready, setReady] = useState(false);
  const hasCheckedRef = useRef(false);

  // Determine current step from URL
  useEffect(() => {
    const path = location.pathname;
    console.log("[ProSetupStepper] Determining step from path:", path);
    
    if (path.includes("/payouts")) {
      setCurrentStep(3);
    } else if (path.includes("/address")) {
      setCurrentStep(2);
    } else if (path.includes("/basic-info") || path === "/pro/setup") {
      setCurrentStep(1);
      // If at root /pro/setup, redirect to basic-info
      if (path === "/pro/setup") {
        console.log("[ProSetupStepper] Redirecting to /pro/setup/basic-info");
        navigate("/pro/setup/basic-info", { replace: true });
      }
    } else {
      // Default to step 1
      setCurrentStep(1);
      navigate("/pro/setup/basic-info", { replace: true });
    }
  }, [location.pathname, navigate]);

  // Auth check - simplified to prevent loops
  useEffect(() => {
    // Prevent multiple checks
    if (hasCheckedRef.current) {
      return;
    }

    // Wait for loading to complete
    if (authLoading || rolesLoading) {
      console.log("[ProSetupStepper] Still loading...");
      return;
    }

    // Mark as checked
    hasCheckedRef.current = true;

    // No user - redirect to login
    if (!user) {
      console.log("[ProSetupStepper] No user, redirecting to login");
      navigate("/login", { replace: true });
      return;
    }

    console.log("[ProSetupStepper] User authenticated:", user.id);
    console.log("[ProSetupStepper] User roles:", userRoles);

    const hasProviderRole = userRoles.includes("provider");
    const wantsProviderFlag = wantsProvider();

    // KEY FIX: If user already has provider role AND didn't explicitly want to be here
    // This prevents the loop where RoleGate sends them here but they already have the role
    if (hasProviderRole && !wantsProviderFlag) {
      console.log("[ProSetupStepper] User already has provider role and no wants_provider flag");
      console.log("[ProSetupStepper] This might be a redirect loop - sending to dashboard");
      
      // Clear any stale flags
      clearWantsProvider();
      
      // Send to provider dashboard
      navigate("/dashboard/pro", { replace: true });
      return;
    }

    // If user is here intentionally (wants_provider flag set) or doesn't have provider role yet
    // Ensure the flag is set so they can complete setup
    if (!wantsProviderFlag) {
      console.log("[ProSetupStepper] Setting wants_provider flag");
      setWantsProvider();
    }

    // Ready to show the setup form
    console.log("[ProSetupStepper] Ready to show setup form");
    setReady(true);
  }, [user, authLoading, rolesLoading, userRoles, navigate]);

  const progress = (currentStep / steps.length) * 100;

  // Show loading screen while checking auth
  if (authLoading || rolesLoading || !ready) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 max-w-4xl">
          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#A6A6A6]">Step {currentStep} of {steps.length}</span>
              <span className="text-sm text-[#A6A6A6]">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-[#1E1E1E] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#D9743A] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-12">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      currentStep > step.id
                        ? "bg-[#D9743A] border-[#D9743A]"
                        : currentStep === step.id
                        ? "bg-[#D9743A] border-[#D9743A]"
                        : "bg-transparent border-white/20"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5 text-black" />
                    ) : (
                      <span className="text-sm font-semibold">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs text-center ${
                      currentStep >= step.id ? "text-white" : "text-white/40"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-all ${
                      currentStep > step.id ? "bg-[#D9743A]" : "bg-white/20"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
