/**
 * Customer Jobs View
 * Manage all jobs with auth-code flows
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  DollarSign,
  Search,
  Eye,
  Calendar,
  User,
  Phone,
  AlertCircle,
  Key,
  Copy,
  CreditCard,
  FileText,
  Hourglass,
  Send,
  Star,
} from "lucide-react";
import { useCustomerJobs, useCancelJob, useRescheduleJob, useCompleteJob, useGenerateCustomerStartCode } from "@/hooks/useCustomerEnhanced";
// import { usePaystackFinalPayment } from "@/hooks/usePaystack"; // OLD: Removed for quote-based pricing
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { CustomerJob } from "@/types/customer-dashboard";
import { JobTimer } from "@/components/jobs/JobTimer";
import { LiveEarningsDisplay } from "@/components/jobs/LiveEarningsDisplay";
// import { FinalBillPreview } from "@/components/jobs/FinalBillPreview"; // OLD: Removed for quote-based pricing
import { CodeVerificationModal } from "@/components/jobs/CodeVerificationModal";
import { CustomerQuoteAcceptanceModal } from "@/components/customer/CustomerQuoteAcceptanceModal";
import { QuoteBasedPaymentModal } from "@/components/jobs/QuoteBasedPaymentModal";
import { RatingModal } from "@/components/jobs/RatingModal";
// handshakeApi removed - using customerJobsApi.completeJob via completeJobMutation instead

interface CustomerJobsViewProps {
  customerId: string;
}

export const CustomerJobsView = ({ customerId }: CustomerJobsViewProps) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<CustomerJob | null>(null);
  const [authCodeDialog, setAuthCodeDialog] = useState(false);
  const [authCodeJobId, setAuthCodeJobId] = useState<string | null>(null);
  const [providerAuthCode, setProviderAuthCode] = useState("");
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelReasonRef = useRef<string>("");
  const cancelReasonTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Quote acceptance states
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteJob, setQuoteJob] = useState<CustomerJob | null>(null);
  // Quote-based payment modal
  const [showQuotePaymentModal, setShowQuotePaymentModal] = useState(false);
  const [paymentJob, setPaymentJob] = useState<CustomerJob | null>(null);
  // Rating modal
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingJob, setRatingJob] = useState<CustomerJob | null>(null);
  // Generated code state
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expires_at: string } | null>(null);
  const generatedCodeRef = useRef<{ code: string; expires_at: string } | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  // Code expiry tracking
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);
  const [isCodeExpired, setIsCodeExpired] = useState(false);
  
  // Paystack final payment hook - OLD: Removed for quote-based pricing
  // const { processFinalPayment, isProcessing: isFinalPaymentProcessing } = usePaystackFinalPayment();
  
  // Initialize queryClient first (before useEffects that use it)
  const queryClient = useQueryClient();
  
  // Debug: Log component mount/render
  useEffect(() => {
    console.log("[CustomerJobsView] Component mounted/rendered");
    return () => {
      console.log("[CustomerJobsView] Component unmounting");
    };
  }, []);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log("[CustomerJobsView] generatedCode state changed:", generatedCode);
  }, [generatedCode]);
  
  // Debug: Log authCodeDialog state changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:100',message:'authCodeDialog state changed',data:{authCodeDialog,hasAuthCodeJobId:!!authCodeJobId,authCodeJobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
  }, [authCodeDialog, authCodeJobId]);
  
  useEffect(() => {
    console.log("[CustomerJobsView] showCodeModal state changed:", showCodeModal);
  }, [showCodeModal]);

  // Ensure textarea ref is available when dialog opens
  useEffect(() => {
    if (cancelDialog && cancelReasonTextareaRef.current) {
      // Focus and ensure ref is set
      cancelReasonTextareaRef.current.focus();
      // Sync any existing value
      if (cancelReasonTextareaRef.current.value) {
        cancelReasonRef.current = cancelReasonTextareaRef.current.value;
        setCancelReason(cancelReasonTextareaRef.current.value);
      }
    }
  }, [cancelDialog]);

  // Check code expiry and update countdown
  useEffect(() => {
    // If no code, reset expiry state
    if (!selectedJob?.auth_code_customer) {
      setTimeUntilExpiry(null);
      setIsCodeExpired(false);
      return;
    }

    // If code exists but no expiry timestamp, assume it's a legacy code (no expiry tracking)
    // Don't show countdown, but don't mark as expired either
    if (!selectedJob?.customer_code_expires_at) {
      if (import.meta.env.DEV) {
        console.log("[CustomerJobsView] Code exists but no expiry timestamp (legacy code):", {
          hasCode: !!selectedJob.auth_code_customer,
          code: selectedJob.auth_code_customer,
          expiresAt: selectedJob.customer_code_expires_at,
        });
      }
      setTimeUntilExpiry(null);
      setIsCodeExpired(false);
      return;
    }

    const checkExpiry = () => {
      const now = new Date();
      const expiresAt = new Date(selectedJob.customer_code_expires_at!);
      const timeLeft = Math.max(0, expiresAt.getTime() - now.getTime());
      const expired = timeLeft === 0;

      setTimeUntilExpiry(timeLeft);
      setIsCodeExpired(expired);

      if (import.meta.env.DEV) {
        console.log("[CustomerJobsView] Expiry check:", {
          now: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          timeLeft,
          expired,
          minutesLeft: Math.floor(timeLeft / 60000),
          secondsLeft: Math.floor((timeLeft % 60000) / 1000),
        });
      }

      // If expired, clear the code and show regenerate option
      if (expired && selectedJob.auth_code_customer) {
        console.log("[CustomerJobsView] Code has expired, clearing from UI");
        setSelectedJob({ ...selectedJob, auth_code_customer: undefined });
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["customer", "jobs", customerId] });
      }
    };

    // Check immediately
    checkExpiry();

    // Update every second
    const interval = setInterval(checkExpiry, 1000);

    return () => clearInterval(interval);
  }, [selectedJob?.auth_code_customer, selectedJob?.customer_code_expires_at, customerId, queryClient]);
  const { data: jobs, isLoading } = useCustomerJobs(customerId);
  const cancelJobMutation = useCancelJob();
  const rescheduleJobMutation = useRescheduleJob();
  const completeJobMutation = useCompleteJob();
  const generateCodeMutation = useGenerateCustomerStartCode();

  // Update selectedJob when jobs data changes (to get latest code)
  // But preserve locally generated code if it exists
  useEffect(() => {
    if (selectedJob && jobs) {
      const updatedJob = jobs.find((j) => j.id === selectedJob.id);
      if (updatedJob) {
        // If we have a locally generated code (from generatedCode state), preserve it
        const hasLocalCode = generatedCode && generatedCode.code;
        const shouldUpdate = (
          updatedJob.auth_code_customer !== selectedJob.auth_code_customer ||
          updatedJob.status !== selectedJob.status
        );
        
        if (shouldUpdate) {
          // If we have a local code, merge it with the updated job data
          if (hasLocalCode) {
            setSelectedJob({ 
              ...updatedJob, 
              auth_code_customer: generatedCode.code,
              customer_code_expires_at: generatedCode.expires_at 
            });
            console.log("[CustomerJobsView] Preserving local code in selectedJob:", generatedCode.code);
          } else {
            setSelectedJob(updatedJob);
          }
        }
      }
    }
  }, [jobs, selectedJob?.id, generatedCode]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let filtered = jobs;

    if (statusFilter !== "all") {
      filtered = filtered.filter((j) => j.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.provider?.display_name?.toLowerCase().includes(query) ||
          j.provider?.business_name?.toLowerCase().includes(query) ||
          j.service_category?.name?.toLowerCase().includes(query) ||
          j.address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [jobs, statusFilter, searchQuery]);

  // Count jobs awaiting payment for badge
  const awaitingPaymentCount = useMemo(() => {
    return jobs?.filter((j) => j.status === "awaiting_payment").length || 0;
  }, [jobs]);

  // Helper to determine quote status
  const getJobQuoteStatus = (job: CustomerJob) => {
    const jobAny = job as any;
    if (jobAny.quote_accepted) return "accepted";
    if (jobAny.quote_submitted_at || jobAny.quote_total) return "pending";
    return "not_submitted";
  };

  const getStatusBadge = (status: string, job?: CustomerJob) => {
    // Check for quote-specific states in confirmed jobs
    if (job && status === "confirmed") {
      const quoteStatus = getJobQuoteStatus(job);
      if (quoteStatus === "pending") {
        return (
          <Badge className="border px-3 py-1 flex items-center gap-1 bg-purple-500/10 text-purple-400 border-purple-500/20">
            <FileText className="w-3 h-3" />
            Quote Ready
          </Badge>
        );
      }
      if (quoteStatus === "accepted") {
        return (
          <Badge className="border px-3 py-1 flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Quote Accepted
          </Badge>
        );
      }
    }

    const variants: Record<string, { className: string; label: string; icon: any }> = {
      pending: {
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        label: "Pending Approval",
        icon: Clock,
      },
      confirmed: {
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: "Awaiting Quote",
        icon: Hourglass,
      },
      in_progress: {
        className: "bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/20",
        label: "In Progress",
        icon: AlertCircle,
      },
      completed: {
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        label: "Completed",
        icon: CheckCircle2,
      },
      awaiting_payment: {
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        label: "Payment Due",
        icon: DollarSign,
      },
      cancelled: {
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        label: "Cancelled",
        icon: XCircle,
      },
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge className={cn("border px-3 py-1 flex items-center gap-1", variant.className)}>
        <Icon className="w-3 h-3" />
        {variant.label}
      </Badge>
    );
  };

  const handleCancelJob = async (reasonOverride?: string) => {
    if (!selectedJob) {
      toast({
        title: "Error",
        description: "No job selected",
        variant: "destructive",
      });
      return;
    }

    // Use provided reason, or try to get from multiple sources
    let currentReason = reasonOverride || "";
    
    if (!currentReason) {
      // First, try to get from the textarea DOM element directly (most reliable)
      if (cancelReasonTextareaRef.current) {
        currentReason = cancelReasonTextareaRef.current.value || "";
      }
      
      // Fallback to ref
      if (!currentReason) {
        currentReason = cancelReasonRef.current || "";
      }
      
      // Final fallback to state
      if (!currentReason) {
        currentReason = cancelReason || "";
      }
    }
    
    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log("[handleCancelJob] Reason sources:", {
        override: reasonOverride,
        textareaValue: cancelReasonTextareaRef.current?.value,
        refValue: cancelReasonRef.current,
        stateValue: cancelReason,
        finalValue: currentReason,
        trimmed: currentReason.trim(),
      });
    }
    
    const trimmedReason = currentReason.trim();
    
    if (!trimmedReason) {
      toast({
        title: "Error",
        description: "Please provide a reason for cancellation",
        variant: "destructive",
      });
      return;
    }

    // Prevent cancellation if quote has been accepted
    if ((selectedJob as any).quote_accepted) {
      toast({
        title: "Cannot Cancel",
        description: "This job cannot be cancelled as you have already approved the quote. Please contact the provider if you need to cancel.",
        variant: "destructive",
      });
      setCancelDialog(false);
      setCancelReason("");
      cancelReasonRef.current = "";
      return;
    }

    try {
      // Use the trimmed reason we validated
      await cancelJobMutation.mutateAsync({
        jobId: selectedJob.id,
        reason: trimmedReason,
      });
      toast({
        title: "Job Cancelled",
        description: "Your job has been cancelled successfully.",
      });
      setCancelDialog(false);
      setCancelReason("");
      cancelReasonRef.current = "";
      setSelectedJob(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel job";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCompleteJob = async (code: string) => {
    const jobId = authCodeJobId || selectedJob?.id;
    if (!jobId || !code.trim()) {
      toast({
        title: "Error",
        description: "Please enter the provider's completion code",
        variant: "destructive",
      });
      throw new Error("Code is required");
    }

    try {
      // Use the hash-based completeJob API (not RPC-based verifyEndCode)
      // This properly checks provider_end_code_hash which is set when provider generates the code
      await completeJobMutation.mutateAsync({
        jobId: jobId,
        providerAuthCode: code.trim(),
      });

      // Store jobId before clearing state (for setTimeout closure)
      const completedJobId = jobId;
      
      toast({
        title: "Job Completed!",
        description: "The job has been verified. Please proceed to payment.",
      });
      
      setAuthCodeDialog(false);
      setAuthCodeJobId(null);
      setSelectedJob(null);
      
      // Refresh jobs list - job will now appear in "Payment Due" tab with status 'awaiting_payment'
      queryClient.invalidateQueries({ queryKey: ["customer", "jobs", customerId] });
      
      // Auto-open payment modal for better UX
      setTimeout(() => {
        const updatedJobs = queryClient.getQueryData(["customer", "jobs", customerId]) as any[];
        const jobNeedingPayment = updatedJobs?.find(j => j.id === completedJobId);
        
        if (jobNeedingPayment && (jobNeedingPayment.status === "awaiting_payment" || jobNeedingPayment.status === "completed")) {
          setPaymentJob(jobNeedingPayment);
          setShowQuotePaymentModal(true);
        }
      }, 500);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to verify completion code";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw error; // Re-throw to let CodeVerificationModal handle it
    }
  };

  // Handle final payment via Paystack - OLD: Removed for quote-based pricing
  // This function is no longer needed as we use QuoteBasedPaymentModal with Paystack integration
  // const handleFinalPayment = async () => { ... }

  const renderJobCard = (job: CustomerJob) => {
    const providerName = job.provider?.display_name?.trim() 
      || job.provider?.business_name?.trim() 
      || "Professional";
    const serviceCategory = job.service_category?.name || "Service";

    return (
      <Card
        key={job.id}
        className="bg-[#050505] border-white/5 p-6 rounded-2xl hover:border-white/10 transition-all cursor-pointer"
        onClick={() => setSelectedJob(job)}
      >
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
              <h4 className="font-semibold text-base sm:text-lg truncate">{providerName}</h4>
              {getStatusBadge(job.status, job)}
            </div>
            <p className="text-xs sm:text-sm text-white/60 mb-1 truncate">{serviceCategory}</p>
            {job.scheduled_date && (
              <p className="text-xs text-white/40 mb-1 break-words">
                {format(new Date(job.scheduled_date), "PPP 'at' p")}
              </p>
            )}
            {job.address && (
              <div className="flex items-center gap-2 text-sm text-white/60 mt-2">
                <MapPin className="w-4 h-4" />
                <span>{job.address}</span>
              </div>
            )}
            {/* Show quote price if available */}
            {(job as any).quote_total ? (
              <div className="flex items-center gap-2 text-sm font-semibold mt-3">
                <DollarSign className="w-4 h-4 text-[#C25A2C]" />
                <span>KES {(job as any).quote_total.toLocaleString()}</span>
                {(job as any).quote_accepted && (
                  <span className="text-xs text-green-400">(Accepted)</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-white/50 mt-3">
                <DollarSign className="w-4 h-4" />
                <span>Quote pending</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedJob(job);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>

        {/* Quote-based flow UI */}
        {job.status === "confirmed" && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            {/* If quote submitted but not accepted - show review button */}
            {(job as any).quote_total && !(job as any).quote_accepted ? (
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold h-11 text-sm sm:text-base"
              onClick={(e) => {
                e.stopPropagation();
                setQuoteJob(job);
                setShowQuoteModal(true);
              }}
            >
              <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Review Quote (KES {(job as any).quote_total.toLocaleString()})</span>
            </Button>
            ) : (job as any).quote_accepted && job.auth_code_customer ? (
              // Quote accepted, show start code
              <>
                <p className="text-xs text-white/50">Your Start Code (share with provider when they arrive):</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={job.auth_code_customer}
                    readOnly
                    className="bg-black border-white/10 text-white font-mono text-center text-base sm:text-lg flex-1 min-w-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-white hover:bg-white/10 h-11 px-3 sm:px-4 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(job.auth_code_customer || "");
                      toast({ title: "Copied!", description: "Start code copied to clipboard" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </>
            ) : !(job as any).quote_total ? (
              // No quote yet - waiting
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                <Hourglass className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-amber-400 font-medium">Waiting for Quote</p>
                <p className="text-xs text-white/50 mt-1">
                  Provider will submit a quote after assessing the job
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Show job in progress info - quote based */}
        {/* Only show completion code button if job has been started (start_code_used) */}
        {job.status === "in_progress" && (job as any).start_code_used && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            {/* Show quote amount for reference */}
            {(job as any).quote_total && (
              <div className="bg-[#1E1E1E] rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">Agreed Quote</span>
                  <span className="font-bold text-[#D9743A]">KES {(job as any).quote_total.toLocaleString()}</span>
                </div>
              </div>
            )}
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20 h-11 text-sm sm:text-base"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedJob(job);
                setAuthCodeJobId(job.id);
                setAuthCodeDialog(true);
              }}
            >
              <Key className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Enter Completion Code</span>
            </Button>
          </div>
        )}

        {/* Show payment button for awaiting_payment status */}
        {job.status === "awaiting_payment" && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-amber-400 font-medium text-sm sm:text-base">Amount Due</span>
                <span className="font-bold text-lg sm:text-xl text-amber-400 truncate">KES {(job as any).quote_total?.toLocaleString() || '0'}</span>
              </div>
            </div>
            <Button
              className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-11 text-sm sm:text-base"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentJob(job);
                setShowQuotePaymentModal(true);
              }}
            >
              <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
              Pay Now
            </Button>
          </div>
        )}

        {/* Show Rate Provider button for completed & paid jobs without rating */}
        {job.status === "completed" && job.payment_status === "completed" && !(job as any).has_rating && (
          <div className="mt-4">
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold h-11 text-sm sm:text-base"
              onClick={(e) => {
                e.stopPropagation();
                setRatingJob(job);
                setShowRatingModal(true);
              }}
            >
              <Star className="w-4 h-4 mr-2 flex-shrink-0" />
              Rate Provider
            </Button>
          </div>
        )}

        {/* Show cancel button for pending, confirmed, and in_progress jobs - but NOT if quote is accepted */}
        {(job.status === "pending" || 
          job.status === "confirmed" || 
          job.status === "in_progress") && 
          !(job as any).quote_accepted && (
          <Button
            variant="outline"
            className="w-full mt-4 border-red-500/20 text-red-400 hover:bg-red-500/10 h-11 text-sm sm:text-base"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedJob(job);
              setCancelDialog(true);
            }}
          >
            Cancel Job
          </Button>
        )}
        
        {/* Show info message if quote is accepted and job can't be cancelled */}
        {(job.status === "confirmed" || job.status === "in_progress") && 
          (job as any).quote_accepted && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-amber-400 font-medium">Quote Approved</p>
                  <p className="text-xs text-white/60 mt-1">
                    This job cannot be cancelled as you've approved the quote. Contact the provider if you need assistance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-white/50">Jobs</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1 sm:mt-2">My Jobs</h1>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#050505] border-white/10 text-white pl-10 placeholder:text-white/40"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
        <div className="w-full overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsList className="bg-[#050505] border border-white/10 p-1 inline-flex w-auto min-w-full flex-nowrap gap-1 sm:gap-0">
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">Pending</TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">Upcoming</TabsTrigger>
            <TabsTrigger value="in_progress" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">Active</TabsTrigger>
            <TabsTrigger value="awaiting_payment" className="bg-amber-500/10 data-[state=active]:bg-amber-500/20 text-amber-400 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">
              <span className="whitespace-nowrap">Payment Due</span>
              {awaitingPaymentCount > 0 && (
                <span className="ml-1 sm:ml-1.5 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-bold bg-amber-500 text-black rounded-full">
                  {awaitingPaymentCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">Done</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0">Cancelled</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={statusFilter} className="space-y-4 mt-4 sm:mt-6">
          {isLoading ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="bg-[#050505] border-white/5 p-4 sm:p-6 rounded-2xl h-48" />
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
              {filteredJobs.map(renderJobCard)}
            </div>
          ) : (
            <Card className="bg-[#050505] border-white/5 p-12 text-center rounded-2xl">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <h3 className="font-semibold mb-2">No jobs found</h3>
              <p className="text-sm text-white/50">Jobs will appear here when you book services</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Job Details Dialog */}
      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
          }
        }}>
          <DialogContent 
            className="bg-[#050505] border-white/10 text-white w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => {
              e.preventDefault();
              setSelectedJob(null);
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl truncate">
                {selectedJob.provider?.display_name?.trim() 
                  || selectedJob.provider?.business_name?.trim() 
                  || "Professional"}
              </DialogTitle>
              <DialogDescription className="text-white/60 text-sm sm:text-base">
                {selectedJob.service_category?.name || "Service"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 sm:space-y-6 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-white/70">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedJob.status, selectedJob)}</div>
                </div>
                <div>
                  <Label className="text-white/70">
                    {(selectedJob as any).quote_total ? "Quoted Price" : "Price"}
                  </Label>
                  <p className="text-lg font-semibold mt-1">
                    {(selectedJob as any).quote_total 
                      ? `KES ${(selectedJob as any).quote_total.toLocaleString()}`
                      : "Pending quote"
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-white/70">Scheduled Date</Label>
                  <p className="mt-1">
                    {selectedJob.scheduled_date
                      ? format(new Date(selectedJob.scheduled_date), "PPP 'at' p")
                      : "Not scheduled"}
                  </p>
                </div>
                <div>
                  <Label className="text-white/70">Location</Label>
                  <p className="mt-1">{selectedJob.address || "N/A"}</p>
                </div>
              </div>

              {selectedJob.provider && (
                <div className="border-t border-white/5 pt-4">
                  <Label className="text-white/70 mb-2 block">Provider Details</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-white/40" />
                      <span>{selectedJob.provider.display_name?.trim() 
                        || selectedJob.provider.business_name?.trim() 
                        || "Professional"}</span>
                    </div>
                    {selectedJob.provider.rating && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Rating: {selectedJob.provider.rating.toFixed(1)}</span>
                        <span className="text-xs text-white/50">
                          ({selectedJob.provider.review_count || 0} reviews)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedJob.notes && (
                <div>
                  <Label className="text-white/70">Notes</Label>
                  <p className="mt-1 text-white/80 bg-black/50 border border-white/10 rounded-lg p-3">
                    {selectedJob.notes}
                  </p>
                </div>
              )}

              {/* Allow cancellation for pending, confirmed, and in_progress jobs - but NOT if quote is accepted */}
              {(selectedJob.status === "pending" || 
                selectedJob.status === "confirmed" || 
                selectedJob.status === "in_progress") && 
                !(selectedJob as any).quote_accepted && (
                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      setCancelDialog(true);
                    }}
                  >
                    Cancel Job
                  </Button>
                </div>
              )}
              
              {/* Show info message if quote is accepted and job can't be cancelled */}
              {(selectedJob.status === "confirmed" || selectedJob.status === "in_progress") && 
                (selectedJob as any).quote_accepted && (
                <div className="pt-4 border-t border-white/5">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-amber-400 font-medium mb-1">Quote Approved</p>
                        <p className="text-xs sm:text-sm text-white/60">
                          This job cannot be cancelled as you've already approved the quote. Only the provider can cancel jobs after quote approval. Please contact the provider directly if you need assistance.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quote Review Section for confirmed jobs with pending quotes */}
              {selectedJob.status === "confirmed" && (selectedJob as any).quote_total && !(selectedJob as any).quote_accepted && (
                <div className="border-t border-white/5 pt-4">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-purple-400" />
                      <Label className="text-purple-400 font-medium">Quote Ready for Review</Label>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-white/50 text-sm">Total Quote</span>
                        <span className="font-bold text-lg text-white">KES {(selectedJob as any).quote_total.toLocaleString()}</span>
                      </div>
                      {(selectedJob as any).quote_labor && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Labor</span>
                          <span className="text-white/70">KES {(selectedJob as any).quote_labor.toLocaleString()}</span>
                        </div>
                      )}
                      {(selectedJob as any).quote_materials && (selectedJob as any).quote_materials > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Materials</span>
                          <span className="text-white/70">KES {(selectedJob as any).quote_materials.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                      onClick={() => {
                        setQuoteJob(selectedJob);
                        setShowQuoteModal(true);
                      }}
                    >
                      Review & Accept Quote
                    </Button>
                  </div>
                </div>
              )}

              {/* Show customer start code only after quote is accepted */}
              {(selectedJob.status === "confirmed" && (selectedJob as any).quote_accepted) && (
                <div className="border-t border-white/5 pt-4">
                  <Label className="text-white/70 mb-2 block">Your Start Code</Label>
                  <p className="text-xs text-white/50 mb-2">
                    Share this code with your provider when they arrive to start the job
                  </p>
                  {selectedJob.auth_code_customer && !isCodeExpired ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={selectedJob.auth_code_customer}
                          readOnly
                          className="bg-black border-white/10 text-white font-mono text-center text-lg"
                        />
                        <Button
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/10"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedJob.auth_code_customer || "");
                            toast({ title: "Copied!", description: "Start code copied to clipboard" });
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                      {/* Show expiry countdown if expiry timestamp exists */}
                      {selectedJob.customer_code_expires_at ? (
                        timeUntilExpiry !== null && timeUntilExpiry > 0 ? (
                          <div className="flex items-center justify-between text-xs pt-2">
                            <span className="text-yellow-400 font-medium">
                              ⏱️ Expires in: {Math.floor(timeUntilExpiry / 60000)}m {Math.floor((timeUntilExpiry % 60000) / 1000)}s
                            </span>
                            <span className="text-white/40">
                              {format(new Date(selectedJob.customer_code_expires_at), "PPp")}
                            </span>
                          </div>
                        ) : timeUntilExpiry === 0 ? (
                          <div className="pt-2">
                            <p className="text-xs text-red-400">
                              ⚠️ Code has expired
                            </p>
                          </div>
                        ) : null
                      ) : (
                        <div className="pt-2">
                          <p className="text-xs text-white/40 italic">
                            Note: This code was generated before expiry tracking. It will remain valid until regenerated.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : isCodeExpired ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400 mb-2">
                          Your code has expired. Generate a new code to share with your provider.
                        </p>
                      </div>
                      <Button
                        className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const result = await generateCodeMutation.mutateAsync({ jobId: selectedJob.id });
                            const codeData = { code: result.code, expires_at: result.expires_at };
                            generatedCodeRef.current = codeData;
                            setGeneratedCode(codeData);
                            setSelectedJob({ 
                              ...selectedJob, 
                              auth_code_customer: result.code,
                              customer_code_expires_at: result.expires_at 
                            });
                            setShowCodeModal(true);
                            toast({
                              title: "Code Regenerated!",
                              description: `Your new start code is: ${result.code}`,
                            });
                          } catch (error: unknown) {
                            const errorMessage = error instanceof Error ? error.message : "Failed to generate code";
                            toast({
                              title: "Error",
                              description: errorMessage,
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={generateCodeMutation.isPending}
                      >
                        {generateCodeMutation.isPending ? "Regenerating..." : "Regenerate Code"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-sm text-yellow-400 mb-2">
                          No code generated yet. Generate a code to share with your provider.
                        </p>
                      </div>
                      <Button
                        className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("[CustomerJobsView] Generate button clicked for job:", selectedJob.id);
                          try {
                            console.log("[CustomerJobsView] Calling mutation...");
                            const result = await generateCodeMutation.mutateAsync({ jobId: selectedJob.id });
                            console.log("[CustomerJobsView] Mutation completed, result:", result);
                            
                            if (!result || !result.code) {
                              console.error("[CustomerJobsView] Invalid result from mutation:", result);
                              throw new Error("Invalid response from code generation");
                            }
                            
                            // Store code and expiry for display
                            const codeData = { code: result.code, expires_at: result.expires_at };
                            console.log("[CustomerJobsView] Code generated, setting state:", codeData);
                            
                            // Store in ref first to persist across re-renders
                            generatedCodeRef.current = codeData;
                            console.log("[CustomerJobsView] Stored in ref:", generatedCodeRef.current);
                            
                            // Update selectedJob immediately with the new code and expiry so it shows in the card
                            const updatedJob = { 
                              ...selectedJob, 
                              auth_code_customer: result.code,
                              customer_code_expires_at: result.expires_at 
                            };
                            
                            // Set all states synchronously - use functional updates to ensure they're applied
                            setGeneratedCode((prev) => {
                              console.log("[CustomerJobsView] setGeneratedCode called, prev:", prev, "new:", codeData);
                              return codeData;
                            });
                            setSelectedJob(updatedJob);
                            setShowCodeModal((prev) => {
                              console.log("[CustomerJobsView] setShowCodeModal called, prev:", prev, "new: true");
                              return true;
                            });
                            
                            console.log("[CustomerJobsView] All state setters called");
                            
                            // Show success toast with the code - make it persistent so user can see it
                            toast({
                              title: "Code Generated!",
                              description: `Your start code is: ${result.code}. It will appear in the job card below.`,
                              duration: 10000, // Show for 10 seconds
                            });
                            
                            // Force immediate state update by using a callback
                            // This ensures the modal opens even if React batches updates
                            requestAnimationFrame(() => {
                              console.log("[CustomerJobsView] requestAnimationFrame - checking state");
                              if (!generatedCode && generatedCodeRef.current) {
                                console.log("[CustomerJobsView] State missing, restoring from ref in RAF");
                                setGeneratedCode(generatedCodeRef.current);
                                setShowCodeModal(true);
                              }
                            });
                            
                            // Force a re-render check after state updates
                            setTimeout(() => {
                              console.log("[CustomerJobsView] State check after 100ms:");
                              console.log("  - showCodeModal state:", showCodeModal);
                              console.log("  - generatedCode state:", generatedCode);
                              console.log("  - generatedCodeRef.current:", generatedCodeRef.current);
                              // If state was cleared, restore it from ref
                              if (!generatedCode && generatedCodeRef.current) {
                                console.log("[CustomerJobsView] State was cleared, restoring from ref:", generatedCodeRef.current);
                                setGeneratedCode(generatedCodeRef.current);
                                setShowCodeModal(true);
                              }
                            }, 100);
                          } catch (error: unknown) {
                            const errorMessage = error instanceof Error ? error.message : "Failed to generate code";
                            
                            // If code already exists, refresh job data to show the existing code
                            if (errorMessage.includes("already exists")) {
                              // Refresh jobs data to get the existing code
                              queryClient.invalidateQueries({ queryKey: ["customer", "jobs", customerId] });
                              toast({
                                title: "Code Already Exists",
                                description: "A code has already been generated for this job. Refreshing...",
                                variant: "default",
                              });
                            } else {
                              toast({
                                title: "Error",
                                description: errorMessage,
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        disabled={generateCodeMutation.isPending}
                      >
                        {generateCodeMutation.isPending ? "Generating..." : "Generate Start Code"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Show quote info and completion when job is in progress */}
              {/* Note: Backend will validate that start_code_used is true before allowing end code verification */}
              {selectedJob.status === "in_progress" && (
                <div className="border-t border-white/5 pt-4 space-y-4" onClick={(e) => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:1127',message:'Container div clicked',data:{hasSelectedJob:!!selectedJob,status:selectedJob?.status,startCodeUsed:selectedJob?.start_code_used,hasEndCode:!!selectedJob?.end_code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                  // #endregion
                  e.stopPropagation();
                }}>
                  {/* Quote-Based Job Info */}
                  {selectedJob.quote_total && (
                    <div className="bg-gradient-to-br from-[#1E1E1E] to-[#121212] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[#D9743A]" />
                          Agreed Quote
                        </h4>
                        <Badge variant="success" className="bg-green-500/20 text-green-400">
                          In Progress
                        </Badge>
                      </div>
                      
                      <div className="text-center py-2">
                        <div className="text-3xl font-bold text-[#D9743A]">
                          KES {selectedJob.quote_total.toLocaleString()}
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                          Payment due after job completion
                        </p>
                      </div>
                      
                      {(selectedJob.quote_labor || selectedJob.quote_materials) && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {selectedJob.quote_labor && (
                            <div className="bg-black/30 rounded-lg p-2">
                              <p className="text-white/50 text-xs">Labor</p>
                              <p className="font-medium text-white">KES {selectedJob.quote_labor.toLocaleString()}</p>
                            </div>
                          )}
                          {selectedJob.quote_materials && (
                            <div className="bg-black/30 rounded-lg p-2">
                              <p className="text-white/50 text-xs">Materials</p>
                              <p className="font-medium text-white">KES {selectedJob.quote_materials.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-white/40 text-center italic">
                        No upfront payment required
                      </p>
                    </div>
                  )}
                  
                  <Button
                    type="button"
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:1175',message:'Enter Provider Completion Code button clicked',data:{hasSelectedJob:!!selectedJob,selectedJobId:selectedJob?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                      // #endregion
                      if (selectedJob) {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:1182',message:'Setting authCodeJobId and opening dialog',data:{jobId:selectedJob.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                        // #endregion
                        setAuthCodeJobId(selectedJob.id);
                        setAuthCodeDialog(true);
                      } else {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:1189',message:'Button clicked but selectedJob is null',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                        // #endregion
                      }
                    }}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Enter Provider Completion Code
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Complete Job Auth Code Dialog */}
      <CodeVerificationModal
        open={authCodeDialog}
        onOpenChange={(open) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:1183',message:'authCodeDialog onOpenChange called',data:{open,currentAuthCodeDialog:authCodeDialog,hasAuthCodeJobId:!!authCodeJobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          setAuthCodeDialog(open);
          if (!open) {
            setAuthCodeJobId(null);
          }
        }}
        title="Complete Job"
        description="Enter the provider's completion code to confirm the job is finished"
        label="Provider Completion Code"
        placeholder="Enter provider code"
        onSubmit={async (code) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CustomerJobsView.tsx:1161',message:'onSubmit prop called',data:{codeLength:code.length,hasSelectedJob:!!selectedJob,hasAuthCodeJobId:!!authCodeJobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          await handleCompleteJob(code);
        }}
        isLoading={completeJobMutation.isPending}
        error={completeJobMutation.error?.message || null}
      />

      {/* Cancel Job Dialog */}
      <Dialog 
        open={cancelDialog} 
        onOpenChange={(open) => {
          setCancelDialog(open);
          if (!open) {
            // Reset reason when dialog closes
            setCancelReason("");
            cancelReasonRef.current = "";
          }
        }}
      >
        <DialogContent className="bg-[#050505] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Cancel Job</DialogTitle>
            <DialogDescription className="text-white/60">
              Please provide a reason for cancelling this job
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="cancel-reason" className="text-white/70">Reason</Label>
              <Textarea
                ref={cancelReasonTextareaRef}
                id="cancel-reason"
                defaultValue={cancelReason}
                onChange={(e) => {
                  const value = e.target.value;
                  setCancelReason(value);
                  cancelReasonRef.current = value;
                }}
                onInput={(e) => {
                  const value = (e.target as HTMLTextAreaElement).value;
                  setCancelReason(value);
                  cancelReasonRef.current = value;
                }}
                placeholder="Explain why you're cancelling..."
                className="bg-black border-white/10 text-white mt-1 min-h-[100px] resize-none"
                autoFocus
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/10 h-11"
                onClick={() => {
                  setCancelDialog(false);
                  setCancelReason("");
                  cancelReasonRef.current = "";
                  if (cancelReasonTextareaRef.current) {
                    cancelReasonTextareaRef.current.value = "";
                  }
                }}
              >
                Keep Job
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold h-11"
                onClick={() => {
                  // ALWAYS read directly from DOM element - this is the source of truth
                  let reasonValue = "";
                  
                  // Try ref first
                  if (cancelReasonTextareaRef.current) {
                    reasonValue = cancelReasonTextareaRef.current.value || "";
                  }
                  
                  // Fallback: find by ID if ref didn't work
                  if (!reasonValue) {
                    const textareaElement = document.getElementById('cancel-reason') as HTMLTextAreaElement;
                    if (textareaElement) {
                      reasonValue = textareaElement.value || "";
                    }
                  }
                  
                  // Debug
                  if (import.meta.env.DEV) {
                    console.log("[Cancel Button Click] Reading value:", {
                      refExists: !!cancelReasonTextareaRef.current,
                      refValue: cancelReasonTextareaRef.current?.value,
                      elementById: document.getElementById('cancel-reason')?.value,
                      stateValue: cancelReason,
                      refValue: cancelReasonRef.current,
                      finalValue: reasonValue,
                    });
                  }
                  
                  // Validate - must have value
                  if (!reasonValue || !reasonValue.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a reason for cancellation",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  const trimmed = reasonValue.trim();
                  
                  // Update state and ref for consistency
                  if (trimmed !== cancelReason) {
                    setCancelReason(trimmed);
                    cancelReasonRef.current = trimmed;
                  }
                  
                  // Call the handler with the trimmed reason
                  handleCancelJob(trimmed);
                }}
                disabled={cancelJobMutation.isPending}
              >
                {cancelJobMutation.isPending ? "Cancelling..." : "Cancel Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NOTE: Start code modal removed - now handled by CustomerQuoteAcceptanceModal */}
      {/* The CustomerQuoteAcceptanceModal shows the start code after quote acceptance */}

      {/* Final Bill Preview Modal - OLD: Removed for quote-based pricing */}
      {/* This modal is no longer used. We now use QuoteBasedPaymentModal with Paystack integration. */}

      {/* Quote Acceptance Modal */}
      {quoteJob && (
        <CustomerQuoteAcceptanceModal
          open={showQuoteModal}
          onOpenChange={(open) => {
            setShowQuoteModal(open);
            if (!open) setQuoteJob(null);
          }}
          job={quoteJob as any}
          onQuoteResponded={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", "jobs", customerId] });
            setShowQuoteModal(false);
            setQuoteJob(null);
            toast({
              title: "Quote Response Submitted",
              description: "Your response has been sent to the provider.",
            });
          }}
        />
      )}

      {/* Quote-Based Payment Modal */}
      {paymentJob && (
        <QuoteBasedPaymentModal
          open={showQuotePaymentModal}
          onOpenChange={(open) => {
            setShowQuotePaymentModal(open);
            if (!open) setPaymentJob(null);
          }}
          job={paymentJob as any}
          onPaymentSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", "jobs", customerId] });
            setShowQuotePaymentModal(false);
            
            // Show rating modal after successful payment
            const jobForRating = paymentJob;
            setPaymentJob(null);
            
            toast({
              title: "Payment Successful!",
              description: "Thank you for your payment. Please rate your experience.",
            });
            
            // Open rating modal after a short delay
            setTimeout(() => {
              setRatingJob(jobForRating);
              setShowRatingModal(true);
            }, 500);
          }}
        />
      )}

      {/* Rating Modal */}
      {ratingJob && ratingJob.provider && (
        <RatingModal
          open={showRatingModal}
          onOpenChange={(open) => {
            setShowRatingModal(open);
            if (!open) setRatingJob(null);
          }}
          jobId={ratingJob.id}
          providerId={ratingJob.provider_id}
          providerName={ratingJob.provider.display_name || ratingJob.provider.business_name || "Professional"}
          onRatingSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", "jobs", customerId] });
            setShowRatingModal(false);
            setRatingJob(null);
          }}
        />
      )}
    </div>
  );
};








