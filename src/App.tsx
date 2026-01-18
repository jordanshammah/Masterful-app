import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "@/components/ErrorBoundary";
import BottomNavigation from "@/components/BottomNavigation";
import { RoleGate } from "@/components/RoleGate";

// Lazy load pages for code splitting and faster initial load
const Index = lazy(() => import("./pages/Index"));
const Services = lazy(() => import("./pages/Services"));
const ServiceCategory = lazy(() => import("./pages/ServiceCategory"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProSetupStepper = lazy(() => import("./pages/pro-setup/ProSetupStepper").then(m => ({ default: m.ProSetupStepper })));
const BasicInfoStep = lazy(() => import("./pages/pro-setup/BasicInfoStep").then(m => ({ default: m.BasicInfoStep })));
const AddressStep = lazy(() => import("./pages/pro-setup/AddressStep").then(m => ({ default: m.AddressStep })));
const PayoutsStep = lazy(() => import("./pages/pro-setup/PayoutsStep").then(m => ({ default: m.PayoutsStep })));
const VerificationStep = lazy(() => import("./pages/pro-setup/VerificationStep").then(m => ({ default: m.VerificationStep })));
const ProfessionalProfile = lazy(() => import("./pages/ProfessionalProfile"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const ProDashboard = lazy(() => import("./pages/ProDashboard"));
const BookingFlow = lazy(() => import("./pages/BookingFlow"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));

// Loading component
const PageLoader = () => (
  <div className="min-h-screen bg-black text-white flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-white/60">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds - shorter for better freshness
      gcTime: 1000 * 60 * 5, // 5 minutes - shorter cache time
      refetchOnMount: "always", // Always refetch on mount for fresh data
      refetchOnReconnect: true, // Refetch on reconnect to sync data
    },
    mutations: {
      retry: 0,
      // Clear related queries after mutations
      onSuccess: () => {
        // This will be handled per mutation
      },
    },
  },
});

const App = () => {
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/:category" element={<ServiceCategory />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/signup" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route path="/pro/setup" element={<ProSetupStepper />}>
                  <Route index element={<BasicInfoStep />} />
                  <Route path="basic-info" element={<BasicInfoStep />} />
                  <Route path="address" element={<AddressStep />} />
                  <Route path="payouts" element={<PayoutsStep />} />
                </Route>
                <Route path="/professional/:id" element={<ProfessionalProfile />} />
                <Route path="/dashboard/customer" element={
                  <RoleGate requiredRole="customer">
                    <CustomerDashboard />
                  </RoleGate>
                } />
                <Route path="/dashboard/pro" element={
                  <RoleGate requiredRole="provider">
                    <ProDashboard />
                  </RoleGate>
                } />
                <Route path="/booking" element={<BookingFlow />} />
                <Route path="/admin" element={
                  <RoleGate requiredRole="admin">
                    <AdminDashboard />
                  </RoleGate>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <BottomNavigation />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
};

export default App;
