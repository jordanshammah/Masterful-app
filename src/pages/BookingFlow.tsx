/**
 * Booking Flow - High-Conversion, Trust-First Redesign
 * Premium UX with early price transparency, trust signals, and micro-interactions
 * Inspired by Airbnb, Uber, Urban Company
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Navigation from "@/components/Navigation";
import { 
  ArrowLeft, 
  Clock, 
  DollarSign, 
  Star, 
  Zap, 
  CheckCircle2,
  Shield,
  MapPin,
  Calendar as CalendarIcon,
  ChevronDown,
  Lock,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCreateBooking } from "@/hooks/useServicesEnhanced";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const BookingFlow = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPro, setSelectedPro] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isRush, setIsRush] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWhatHappensNext, setShowWhatHappensNext] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const createBookingMutation = useCreateBooking();

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  useEffect(() => {
    const proId = searchParams.get("proId") || searchParams.get("provider_id");
    if (proId) {
      fetchPro(proId);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const fetchPro = async (proId: string) => {
    try {
      setLoading(true);
      
      const { data: providerData, error: providerError } = await supabase
        .from("providers")
        .select(`
          *,
          service_categories(name)
        `)
        .eq("id", proId)
        .single();

      if (providerError) throw providerError;
      if (!providerData) {
        throw new Error("Provider not found");
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, photo_url, city")
        .eq("id", proId)
        .single();

      const combinedData = {
        ...providerData,
        profiles: profileData || null,
      };

      setSelectedPro(combinedData);
    } catch (error: any) {
      console.error("[BookingFlow] Error fetching provider:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load provider information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Price calculations - now quote-based
  const minimumPrice = selectedPro?.minimum_job_price || selectedPro?.hourly_rate || 0;
  const basePrice = 0; // No upfront price - quote provided on-site
  const rushFee = isRush ? Math.round(minimumPrice * 0.3 * 100) / 100 : 0;

  // Form validation state
  const isFormValid = useMemo(() => {
    const trimmedAddress = address.trim();
    return !!(selectedDate && selectedTime && trimmedAddress && trimmedAddress.length >= 5);
  }, [selectedDate, selectedTime, address]);

  const handleBookClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!isFormValid) {
      toast({
        title: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    const trimmedAddress = address.trim();
    
    if (!user || !selectedPro || !selectedDate || !selectedTime || !trimmedAddress) {
      toast({
        title: "Error",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }
    
    if (trimmedAddress.length < 5) {
      toast({
        title: "Invalid Address",
        description: "Please enter a complete address (at least 5 characters)",
        variant: "destructive",
      });
      return;
    }

    // Prevent double submission
    if (createBookingMutation.isPending) {
      return;
    }

    try {
      const scheduledAt = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(":");
      scheduledAt.setHours(parseInt(hours), parseInt(minutes));

      // Create a timeout promise to prevent infinite hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Booking request timed out. Please try again.")), 30000);
      });

      const bookingPromise = createBookingMutation.mutateAsync({
        customerId: user.id,
        proId: selectedPro.id,
        categoryId: selectedPro.category_id,
        scheduledAt: scheduledAt.toISOString(),
        scheduledTime: selectedTime,
        address: trimmedAddress,
        notes: notes.trim() || undefined,
        rush: isRush,
        estimatedBasePrice: basePrice,
      });

      // Race between booking and timeout
      const result = await Promise.race([bookingPromise, timeoutPromise]);
      
      // Store booking ID
      setCreatedBookingId(result.bookingId);
      setShowConfirmModal(false);
      
      // No payment required - go directly to success
      setShowSuccessModal(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create booking";
      
      if (import.meta.env.DEV) {
        console.error("[BookingFlow] Error creating booking:", error);
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#A6A6A6]">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!selectedPro) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-semibold">Professional not found</h2>
          <Button
            onClick={() => navigate('/services')}
            className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
          >
            Browse Services
          </Button>
        </div>
      </div>
    );
  }

  // Generate avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = selectedPro.display_name?.trim() 
    || selectedPro.business_name?.trim() 
    || "Professional";
  const isVerified = selectedPro.is_verified || false;
  const rating = selectedPro.rating || 0;
  const reviewCount = selectedPro.review_count || 0;

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-8 overflow-x-hidden">
      <Navigation />
      
      <div className="container mx-auto px-4 md:px-8 lg:px-12 py-8 pt-24 max-w-5xl w-full overflow-x-hidden">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(`/professional/${selectedPro.id}`)}
          className="mb-6 text-[#A6A6A6] hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to profile
        </Button>

        {/* Step Progress Indicator - IMPROVED MOBILE */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-start gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { label: "Service", completed: true },
              { label: "Schedule", completed: false, current: true },
              { label: "Details", completed: false },
              { label: "Confirm", completed: false },
            ].map((step, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300 flex-shrink-0",
                  step.current 
                    ? "bg-[#D9743A] text-black" 
                    : step.completed
                    ? "bg-[#D9743A]/20 text-[#D9743A]"
                    : "bg-[#1E1E1E] text-white/40"
                )}>
                  {step.completed ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : index + 1}
                </div>
                <span className={cn(
                  "text-xs sm:text-sm font-medium transition-colors duration-300 whitespace-nowrap",
                  step.current ? "text-white" : step.completed ? "text-[#D9743A]" : "text-white/40"
                )}>
                  {step.label}
                </span>
                {index < 3 && (
                  <div className={cn(
                    "w-6 sm:w-8 lg:w-12 h-0.5 transition-colors duration-300 flex-shrink-0",
                    step.completed ? "bg-[#D9743A]" : "bg-[#1E1E1E]"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column: Main Booking Form */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 w-full min-w-0 order-2 lg:order-1">
            {/* Enhanced Provider Confidence Header */}
            <Card className="bg-[#121212] border-white/10 p-3 sm:p-4 lg:p-6">
              <div className="flex items-start gap-2.5 sm:gap-3 lg:gap-5 flex-wrap">
                {/* Avatar - Smaller on Mobile */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-2 ring-white/10">
                    {selectedPro.profile_image_url ? (
                      <img
                        src={selectedPro.profile_image_url}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#D9743A]/20 to-[#C25A2C]/20 flex items-center justify-center text-[#D9743A] font-semibold text-lg sm:text-xl">
                        {getInitials(displayName)}
                      </div>
                    )}
                  </div>
                  {isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-[#D9743A] rounded-full p-1 sm:p-1.5 shadow-lg ring-2 ring-[#121212]">
                      <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
                    </div>
                  )}
                </div>

                {/* Provider Info */}
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <div className="flex items-center gap-2 mb-1.5 sm:mb-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white break-words">{displayName}</h2>
                    {isVerified && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-[#D9743A]/20 text-[#D9743A] text-xs font-medium rounded whitespace-nowrap">
                        Verified Pro
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-white/60 mb-2 sm:mb-3">{selectedPro.service_categories?.name}</p>
                  
                  {/* Trust Signals - Responsive */}
                  <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap text-xs sm:text-sm">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#D9743A] text-[#D9743A]" />
                      <span className="font-semibold text-white">{rating.toFixed(1)}</span>
                      {reviewCount > 0 && (
                        <span className="text-white/50">
                          ({reviewCount})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-white/60">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Available today</span>
                      <span className="sm:hidden">Today</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-white/60">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="truncate max-w-[100px] sm:max-w-none">
                        {selectedPro.profiles?.city || "Local area"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price - Always Visible, Responsive */}
                <div className="text-left sm:text-right flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                  <div className="text-xs text-white/50 uppercase tracking-wide mb-1">From</div>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#D9743A] leading-none mb-1">
                    KES {minimumPrice.toLocaleString()}
                  </div>
                  <div className="text-xs text-white/50">minimum</div>
                </div>
              </div>
            </Card>

            {/* Booking Form */}
            <Card className="bg-[#121212] border-white/10 p-4 sm:p-6 lg:p-8">
              <div className="mb-4 sm:mb-6 lg:mb-8">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Schedule your service</h2>
                <p className="text-xs sm:text-sm lg:text-base text-white/60">Choose when and where you need help</p>
              </div>

              <div className="space-y-6 sm:space-y-8">
                {/* Date & Time Selection - IMPROVED LAYOUT */}
                <div className="space-y-6">
                  {/* Date Picker - Full Width on Mobile */}
                  <div className="w-full">
                    <Label className="text-white mb-3 block font-medium flex items-center gap-2 text-base">
                      <CalendarIcon className="w-4 h-4" />
                      Select Date
                    </Label>
                    <div className="w-full overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                        className={cn(
                          "rounded-xl border border-white/10 bg-[#1E1E1E] transition-all duration-300 w-full",
                          "[&_.rdp-day]:h-10 [&_.rdp-day]:w-10 sm:[&_.rdp-day]:h-12 sm:[&_.rdp-day]:w-12",
                          "[&_.rdp-cell]:p-0",
                          "[&_.rdp-head_cell]:text-white/60 [&_.rdp-head_cell]:text-xs sm:[&_.rdp-head_cell]:text-sm",
                          "[&_.rdp-day_button]:w-full [&_.rdp-day_button]:h-full [&_.rdp-day_button]:text-sm sm:[&_.rdp-day_button]:text-base",
                          "[&_.rdp-day_selected]:bg-[#D9743A] [&_.rdp-day_selected]:text-black [&_.rdp-day_selected]:font-semibold",
                          "[&_.rdp-day_today]:bg-white/5 [&_.rdp-day_today]:font-semibold",
                          "[&_.rdp-nav_button]:text-white [&_.rdp-nav_button]:hover:bg-white/10",
                          "[&_.rdp-caption]:text-white [&_.rdp-caption]:font-medium [&_.rdp-caption]:text-sm sm:[&_.rdp-caption]:text-base",
                          "[&_.rdp-months]:w-full",
                          "[&_.rdp-month]:w-full",
                          "[&_.rdp-table]:w-full",
                          selectedDate && "ring-2 ring-[#D9743A]/50"
                        )}
                      />
                    </div>
                  </div>

                  {/* Time Selection - Improved Grid */}
                  <div className="w-full">
                    <Label className="text-white mb-3 block font-medium flex items-center gap-2 text-base">
                      <Clock className="w-4 h-4" />
                      Select Time
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                      {timeSlots.map((time) => (
                        <Button
                          key={time}
                          variant={selectedTime === time ? "default" : "outline"}
                          onClick={() => setSelectedTime(time)}
                          className={cn(
                            "h-12 sm:h-14 transition-all duration-200 text-sm sm:text-base font-medium",
                            selectedTime === time
                              ? "bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold shadow-lg shadow-[#D9743A]/20"
                              : "bg-[#1E1E1E] border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                          )}
                        >
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <Label className="text-white mb-2 block font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Service Address *
                  </Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter the complete service address (e.g., 123 Main St, City)"
                    className={cn(
                      "bg-[#1E1E1E] border-white/10 text-white placeholder:text-white/40 h-12 focus:border-[#D9743A]/50 transition-colors duration-200",
                      address.trim().length > 0 && address.trim().length < 5 && "border-red-500/50 focus:border-red-500"
                    )}
                  />
                  {address.trim().length > 0 && address.trim().length < 5 && (
                    <p className="text-red-400 text-sm mt-1">
                      Address must be at least 5 characters
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <Label className="text-white mb-2 block font-medium">Job Description (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Brief description of the work needed..."
                    maxLength={180}
                    className="bg-[#1E1E1E] border-white/10 text-white placeholder:text-white/40 min-h-[100px] focus:border-[#D9743A]/50 transition-colors duration-200"
                  />
                  <p className="text-xs text-white/40 mt-1 text-right">{notes.length}/180</p>
                </div>

                {/* Priority Booking - Reframed */}
                <Card className="bg-[#1E1E1E] border-white/10 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-5 h-5 text-[#D9743A]" />
                        <h3 className="font-semibold text-white">Priority Booking</h3>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">
                        Get faster confirmation and priority dispatch. Your booking will be processed immediately.
                      </p>
                    </div>
                    <Switch
                      checked={isRush}
                      onCheckedChange={setIsRush}
                      className="data-[state=checked]:bg-[#D9743A] flex-shrink-0"
                    />
                  </div>
                </Card>

                {/* What Happens Next - Collapsible */}
                <Collapsible open={showWhatHappensNext} onOpenChange={setShowWhatHappensNext}>
                  <CollapsibleTrigger className="w-full">
                    <Card className="bg-[#1E1E1E] border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-5 h-5 text-white/60" />
                          <span className="text-sm font-medium text-white">What happens after I book?</span>
                        </div>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-white/60 transition-transform duration-200",
                          showWhatHappensNext && "rotate-180"
                        )} />
                      </div>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="bg-[#1E1E1E] border-white/10 border-t-0 rounded-t-none p-6 mt-0">
                      <div className="space-y-4">
                        {[
                          { step: 1, title: "Provider arrives", desc: "The professional arrives at your location and assesses the job." },
                          { step: 2, title: "You get a quote", desc: "Provider gives you an exact quote with labor and materials breakdown." },
                          { step: 3, title: "You approve", desc: "Accept the quote to authorize work. You'll get a start code to share." },
                          { step: 4, title: "Work completed", desc: "After job completion, enter the end code and pay via M-Pesa." },
                        ].map((item) => (
                          <div key={item.step} className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-[#D9743A]/20 flex items-center justify-center text-[#D9743A] font-semibold text-sm flex-shrink-0">
                              {item.step}
                            </div>
                            <div>
                              <h4 className="font-medium text-white mb-1">{item.title}</h4>
                              <p className="text-sm text-white/60">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* Trust & Safety Reassurance */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-4 md:gap-6 p-4 sm:p-6 bg-[#1E1E1E] rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                    <Lock className="w-5 h-5 text-[#D9743A] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">No upfront payment</p>
                      <p className="text-xs text-white/50">Pay only after job completion</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                    <DollarSign className="w-5 h-5 text-[#D9743A] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">Quote before work</p>
                      <p className="text-xs text-white/50">Know exact price upfront</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                    <Shield className="w-5 h-5 text-[#D9743A] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">Verified professionals</p>
                      <p className="text-xs text-white/50">All pros are background checked</p>
                    </div>
                  </div>
                </div>

                {/* CTA Button - Animated when valid */}
                <Button
                  onClick={handleBookClick}
                  disabled={!isFormValid}
                  className={cn(
                    "w-full h-14 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold text-lg transition-all duration-300",
                    isFormValid && "shadow-lg shadow-[#D9743A]/20 hover:shadow-xl hover:shadow-[#D9743A]/30 hover:scale-[1.02]",
                    !isFormValid && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Continue to Confirmation
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Price Preview - Shows FIRST on Mobile */}
          <div className="lg:col-span-1 w-full min-w-0 order-1 lg:order-2">
            <div className="lg:sticky lg:top-32">
              <Card className="bg-[#121212] border-white/10 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-white">How Pricing Works</h3>
                
                {/* Quote-Based Pricing Display */}
                <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                  {/* No Upfront Payment Banner */}
                  <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                      <span className="text-white font-semibold text-sm sm:text-base">No Upfront Payment</span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Book now, pay later. You'll only pay after the job is complete and you're satisfied.
                    </p>
                  </div>

                  {/* Minimum Price */}
                  <div className="bg-[#D9743A]/5 border border-[#D9743A]/20 rounded-lg p-3 sm:p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/70 text-xs sm:text-sm">Provider Minimum:</span>
                      <span className="text-white font-bold text-sm sm:text-base">
                        KES {minimumPrice.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">
                      Final quote provided on-site after assessment
                    </p>
                  </div>
                    
                  {isRush && (
                    <div className="flex justify-between items-center animate-fade-in p-3 bg-[#1E1E1E] rounded-lg">
                      <span className="text-white/70 text-xs sm:text-sm flex items-center gap-1.5">
                        <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D9743A]" />
                        Priority booking
                      </span>
                      <span className="text-[#D9743A] font-medium text-sm">Faster confirmation</span>
                    </div>
                  )}
                  
                  {/* How It Works */}
                  <div className="border-t border-white/10 pt-3 sm:pt-4 mt-3 sm:mt-4">
                    <p className="text-white font-semibold text-sm sm:text-base mb-3">Payment Flow:</p>
                    
                    <div className="bg-black/30 rounded-lg p-2.5 sm:p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#D9743A]/20 flex items-center justify-center text-[#D9743A] text-xs flex-shrink-0 mt-0.5">1</div>
                        <p className="text-xs text-white/70 leading-tight">
                          Provider arrives & assesses the job
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#D9743A]/20 flex items-center justify-center text-[#D9743A] text-xs flex-shrink-0 mt-0.5">2</div>
                        <p className="text-xs text-white/70 leading-tight">
                          You receive & approve the quote
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#D9743A]/20 flex items-center justify-center text-[#D9743A] text-xs flex-shrink-0 mt-0.5">3</div>
                        <p className="text-xs text-white/70 leading-tight">
                          Work begins after your approval
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#D9743A]/20 flex items-center justify-center text-[#D9743A] text-xs flex-shrink-0 mt-0.5">4</div>
                        <p className="text-xs text-white/70 leading-tight">
                          Pay via M-Pesa after completion
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Provider Summary - Compact */}
                <div className="pt-4 sm:pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                    {selectedPro.profiles?.photo_url ? (
                      <img
                        src={selectedPro.profiles.photo_url}
                        alt={displayName}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-[#D9743A]/20 to-[#C25A2C]/20 flex items-center justify-center text-[#D9743A] font-semibold text-sm flex-shrink-0">
                        {getInitials(displayName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate text-sm sm:text-base">{displayName}</p>
                      <p className="text-xs text-white/50 truncate">{selectedPro.service_categories?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-wrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#D9743A] text-[#D9743A]" />
                      <span className="text-white font-medium">{rating.toFixed(1)}</span>
                    </div>
                    {reviewCount > 0 && (
                      <span className="text-white/50">
                        {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                      </span>
                    )}
                    {isVerified && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-[#D9743A]/20 text-[#D9743A] text-xs font-medium rounded">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog 
        open={showConfirmModal} 
        onOpenChange={(open) => {
          // Prevent closing modal while booking is in progress
          if (!open && createBookingMutation.isPending) {
            return;
          }
          setShowConfirmModal(open);
        }}
      >
        <DialogContent className="bg-[#121212] border-white/10 rounded-[20px] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Confirm Your Booking</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <div className="space-y-4">
              <div>
                <span className="text-[#A6A6A6] text-sm">Professional:</span>
                <p className="text-white font-medium">{displayName}</p>
              </div>
              <div>
                <span className="text-[#A6A6A6] text-sm">Date:</span>
                <p className="text-white font-medium">
                  {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              <div>
                <span className="text-[#A6A6A6] text-sm">Time:</span>
                <p className="text-white font-medium">{selectedTime}</p>
              </div>
              <div>
                <span className="text-[#A6A6A6] text-sm">Address:</span>
                <p className="text-white font-medium">{address}</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              {/* No Upfront Payment Banner */}
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                  <span className="text-white font-semibold">No Payment Required Now</span>
                </div>
                <p className="text-sm text-white/70">
                  The provider will give you a quote on arrival. You'll pay only after the job is done.
                </p>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#A6A6A6]">Provider Minimum:</span>
                  <span className="text-white font-medium">
                    KES {minimumPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A6A6A6]">Final Price:</span>
                  <span className="text-white/60 text-xs">Quoted on-site</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A6A6A6]">Payment:</span>
                  <span className="text-white/60 text-xs">After job completion</span>
                </div>
              </div>
              
              {isRush && (
                <div className="flex justify-between text-sm mb-2 text-[#D9743A]">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Priority Booking
                  </span>
                  <span>Faster confirmation</span>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 border-white/10 text-white hover:bg-white/10"
              >
                Edit
              </Button>
              <Button
                onClick={handleConfirmBooking}
                disabled={createBookingMutation.isPending}
                className="flex-1 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createBookingMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2 inline-block" />
                    Confirming...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-[#121212] border-white/10 rounded-[20px] max-w-md">
          <DialogHeader>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#22C55E]/20 flex items-center justify-center animate-bounce-once">
              <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              Booking Confirmed!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            <p className="text-[#A6A6A6] text-center">
              Your booking has been sent to the professional. No payment required yet!
            </p>
            
            {/* No Upfront Payment Confirmation */}
            <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
                <span className="text-white font-semibold">No Payment Taken</span>
              </div>
              <p className="text-sm text-white/70">
                You'll pay after the job is complete. The provider will give you a quote on arrival.
              </p>
            </div>
            
            <div className="p-4 bg-[#1E1E1E] rounded-[12px] text-left">
              <p className="text-sm text-[#A6A6A6] mb-2">What happens next:</p>
              <ol className="text-sm text-white space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D9743A]/20 text-[#D9743A] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>Provider arrives and <strong>assesses the job</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D9743A]/20 text-[#D9743A] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>You receive a <strong>detailed quote</strong> to review</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D9743A]/20 text-[#D9743A] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span><strong>Accept the quote</strong> to get your start code</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D9743A]/20 text-[#D9743A] text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <span>After job completion, <strong>pay via M-Pesa</strong></span>
                </li>
              </ol>
            </div>
            
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/dashboard/customer?view=jobs');
              }}
              className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
            >
              Go to My Jobs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingFlow;
