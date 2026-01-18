/**
 * Pro Jobs View
 * Manage all jobs (active, pending, completed)
 */

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobRequestCard } from "@/components/pro/JobRequestCard";
import { ProviderQuoteSubmissionModal } from "@/components/pro/ProviderQuoteSubmissionModal";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  DollarSign,
  Search,
  Eye,
  Play,
  CheckCircle,
  Zap,
  Key,
  Copy,
  FileText,
  Send,
  Hourglass,
  Receipt,
} from "lucide-react";
import { LiveEarningsDisplay } from "@/components/jobs/LiveEarningsDisplay";
import { InvoiceModal } from "@/components/jobs/InvoiceModal";
import { useProJobsByStatus } from "@/hooks/useProEnhanced";
import { useAcceptJobEnhanced, useDeclineJobEnhanced, useStartJobEnhanced, useCancelJobEnhanced, useGenerateProviderEndCode } from "@/hooks/useProEnhanced";
import { useProviderJobsRealtime } from "@/hooks/useProviderJobsRealtime";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DashboardView, JobWithDetails } from "@/types/pro-dashboard";

interface ProJobsViewProps {
  providerId: string;
  activeTab: DashboardView;
}

export const ProJobsView = ({ providerId, activeTab }: ProJobsViewProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [authCodeDialog, setAuthCodeDialog] = useState<"start" | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [authCodeJobId, setAuthCodeJobId] = useState<string | null>(null);

  const { data: pendingJobs, isLoading: pendingLoading } = useProJobsByStatus(providerId, "pending");
  const { data: confirmedJobs, isLoading: confirmedLoading } = useProJobsByStatus(providerId, "confirmed");
  const { data: inProgressJobs, isLoading: inProgressLoading } = useProJobsByStatus(providerId, "in_progress");
  const { data: completedJobs, isLoading: completedLoading } = useProJobsByStatus(providerId, "completed");
  const { data: cancelledJobs, isLoading: cancelledLoading } = useProJobsByStatus(providerId, "cancelled");

  // Subscribe to real-time job updates
  useProviderJobsRealtime({
    providerId,
    enabled: !!providerId,
  });

  // Combine all jobs for easy lookup
  const allJobs = [
    ...(pendingJobs || []),
    ...(confirmedJobs || []),
    ...(inProgressJobs || []),
    ...(completedJobs || []),
    ...(cancelledJobs || []),
  ];

  // Update selectedJob when jobs data changes (to get latest code)
  useEffect(() => {
    if (selectedJob && allJobs.length > 0) {
      const updatedJob = allJobs.find((j) => j.id === selectedJob.id);
      if (updatedJob && (
        updatedJob.auth_code_provider !== selectedJob.auth_code_provider ||
        updatedJob.status !== selectedJob.status
      )) {
        setSelectedJob(updatedJob);
      }
    }
  }, [allJobs, selectedJob?.id]);

  // State declarations - must be before useEffect that uses them
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelReasonRef = useRef("");
  const cancelReasonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null); // Store job ID separately to avoid race condition

  // Reset cancelReason when dialog closes (but not when it opens)
  useEffect(() => {
    if (!cancelDialog && cancelReason) {
      setCancelReason("");
      cancelReasonRef.current = "";
    }
  }, [cancelDialog, cancelReason]);

  const acceptJobMutation = useAcceptJobEnhanced();
  const declineJobMutation = useDeclineJobEnhanced();
  const startJobMutation = useStartJobEnhanced();
  const cancelJobMutation = useCancelJobEnhanced();
  const generateCodeMutation = useGenerateProviderEndCode();
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteJob, setQuoteJob] = useState<JobWithDetails | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceJob, setInvoiceJob] = useState<JobWithDetails | null>(null);

  const activeJobs = [...(confirmedJobs || []), ...(inProgressJobs || [])];

  // Filter jobs by search query
  const filterJobs = (jobs: JobWithDetails[] | undefined) => {
    if (!jobs) return [];
    if (!searchQuery) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.customer?.profiles?.full_name?.toLowerCase().includes(query) ||
        job.service_category?.name?.toLowerCase().includes(query) ||
        job.address?.toLowerCase().includes(query)
    );
  };

  // Helper to determine quote status for a job
  const getQuoteStatus = (job: JobWithDetails) => {
    if (job.quote_accepted) return "accepted";
    if (job.quote_submitted_at) return "pending";
    return "not_submitted";
  };

  const getStatusBadge = (status: string, job?: JobWithDetails) => {
    // Check for quote-specific states
    if (job && status === "confirmed") {
      const quoteStatus = getQuoteStatus(job);
      if (quoteStatus === "not_submitted") {
        return (
          <Badge className="border px-3 py-1 flex items-center gap-1 bg-purple-500/10 text-purple-400 border-purple-500/20">
            <FileText className="w-3 h-3" />
            Needs Quote
          </Badge>
        );
      }
      if (quoteStatus === "pending") {
        return (
          <Badge className="border px-3 py-1 flex items-center gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Hourglass className="w-3 h-3" />
            Quote Sent
          </Badge>
        );
      }
    }

    const variants: Record<string, { className: string; label: string; icon: any }> = {
      pending: {
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        label: "Pending",
        icon: Clock,
      },
      confirmed: {
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: "Confirmed",
        icon: CheckCircle2,
      },
      in_progress: {
        className: "bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/20",
        label: "In Progress",
        icon: Play,
      },
      completed: {
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        label: "Completed",
        icon: CheckCircle,
      },
      cancelled: {
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        label: "Cancelled",
        icon: XCircle,
      },
      awaiting_payment: {
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        label: "Awaiting Payment",
        icon: DollarSign,
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

  const handleAcceptJob = async (jobId: string) => {
    try {
      await acceptJobMutation.mutateAsync(jobId);
      toast({
        title: "Job Accepted",
        description: "You've successfully accepted this job request.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to accept job";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeclineJob = async (jobId: string) => {
    try {
      await declineJobMutation.mutateAsync(jobId);
      toast({
        title: "Job Declined",
        description: "You've declined this job request.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to decline job";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStartJob = async () => {
    // Use authCodeJobId if selectedJob is not available (race condition fix)
    const jobId = selectedJob?.id || authCodeJobId;
    
    if (!jobId || !authCode?.trim()) {
      toast({
        title: "Error",
        description: "Please enter the customer auth code",
        variant: "destructive",
      });
      return;
    }

    try {
      await startJobMutation.mutateAsync({
        jobId: jobId,
        customerAuthCode: authCode.trim(),
      });
      
      toast({
        title: "Job Started",
        description: "You've successfully started the job.",
      });
      setAuthCodeDialog(null);
      setAuthCode("");
      setAuthCodeJobId(null);
      setSelectedJob(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start job";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };


  const handleCancelJob = async () => {
    // Use cancelJobId (stored when dialog opened) - selectedJob may have been cleared
    const jobId = cancelJobId || selectedJob?.id;
    
    // ALWAYS read directly from DOM element - this is the source of truth
    let reasonValue = "";
    
    // Try ref first (most reliable)
    if (cancelReasonTextareaRef.current) {
      reasonValue = cancelReasonTextareaRef.current.value || "";
    }
    
    // Fallback: find by ID if ref didn't work
    if (!reasonValue) {
      const textareaElement = document.getElementById('cancel-reason-textarea') as HTMLTextAreaElement | null;
      if (textareaElement) {
        reasonValue = textareaElement.value || "";
      }
    }
    
    // Final fallback to state/ref (shouldn't be needed but as safety)
    if (!reasonValue) {
      reasonValue = cancelReasonRef.current || cancelReason || "";
    }
    
    if (!jobId || !reasonValue.trim()) {
      toast({
        title: "Error",
        description: !jobId ? "No job selected" : "Please provide a reason for cancellation",
        variant: "destructive",
      });
      return;
    }

    try {
      await cancelJobMutation.mutateAsync({
        jobId: jobId,
        reason: reasonValue.trim(),
      });
      toast({
        title: "Job Cancelled",
        description: "The job has been cancelled successfully. The customer has been notified.",
      });
      setCancelDialog(false);
      setCancelReason("");
      cancelReasonRef.current = ""; // Clear ref too
      setCancelJobId(null); // Clear stored job ID
      if (cancelReasonTextareaRef.current) {
        cancelReasonTextareaRef.current.value = "";
      }
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

  const renderJobCard = (job: JobWithDetails) => {
    // Get customer name with multiple fallbacks
    const customerName = job.customer?.profiles?.full_name?.trim() 
      || "Customer";
    const serviceCategory = job.service_category?.name || "Service";
    
    // Debug logging in dev mode
    if (import.meta.env.DEV && !job.customer?.profiles?.full_name) {
      console.warn(`[ProJobsView] No customer name found for job ${job.id}:`, {
        hasCustomer: !!job.customer,
        hasProfiles: !!job.customer?.profiles,
        fullName: job.customer?.profiles?.full_name,
        customerId: job.customer_id,
        customerObject: job.customer
      });
    }

    return (
      <Card
        key={job.id}
        className="bg-[#050505] border-white/5 p-6 rounded-2xl hover:border-white/10 transition-all cursor-pointer"
        onClick={() => setSelectedJob(job)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-semibold text-lg">{customerName}</h4>
              {getStatusBadge(job.status, job)}
            </div>
            <p className="text-sm text-white/60 mb-1">{serviceCategory}</p>
            {job.scheduled_date && (
              <p className="text-xs text-white/40 mb-1">
                {format(new Date(job.scheduled_date), "PPP 'at' p")}
              </p>
            )}
            {job.address && (
              <div className="flex items-center gap-2 text-sm text-white/60 mt-2">
                <MapPin className="w-4 h-4" />
                <span>{job.address}</span>
              </div>
            )}
            {/* Show quote if submitted, otherwise show placeholder */}
            {job.quote_total ? (
              <div className="flex items-center gap-2 text-sm font-semibold mt-3">
                <DollarSign className="w-4 h-4 text-[#C25A2C]" />
                <span>KES {job.quote_total.toLocaleString()}</span>
                {job.quote_accepted && (
                  <span className="text-xs text-green-400 ml-1">(Accepted)</span>
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

        {job.status === "confirmed" && (
          <div className="space-y-2">
            {/* Quote-based flow: Submit Quote → Wait for Acceptance → Start Job */}
            {!job.quote_submitted_at ? (
              // No quote submitted yet - show Submit Quote button
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuoteJob(job);
                  setShowQuoteModal(true);
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Quote
              </Button>
            ) : !job.quote_accepted ? (
              // Quote submitted but not accepted yet
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                <Hourglass className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-amber-400 font-medium">Quote Pending</p>
                <p className="text-xs text-white/50 mt-1">
                  Waiting for customer to accept KES {job.quote_total?.toLocaleString()}
                </p>
              </div>
            ) : (
              // Quote accepted - can start job
              <Button
                className="w-full bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedJob(job);
                  setAuthCodeJobId(job.id); // Store jobId separately to avoid race condition
                  setAuthCodeDialog("start");
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                Start Job
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedJob(job);
                setCancelJobId(job.id); // Store job ID separately to avoid race condition
                setCancelDialog(true);
              }}
            >
              Cancel Job
            </Button>
          </div>
        )}

        {job.status === "in_progress" && (job as any).job_started_at && (
          <div className="space-y-3">
            {/* Live earnings display for provider */}
            <LiveEarningsDisplay
              startTime={(job as any).job_started_at || job.created_at}
              hourlyRate={(job as any).hourly_rate_snapshot || (job as any).hourly_rate || job.base_price || 0}
              depositPaid={(job as any).deposit_amount || 0}
              estimatedHours={(job as any).initial_estimated_hours || 2}
              variant="provider"
              className="mt-2"
            />
            
            {/* End code section */}
            {job.auth_code_provider ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-xs text-green-400 mb-2 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Your Completion Code
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={job.auth_code_provider}
                    readOnly
                    className="bg-black/50 border-white/10 text-white font-mono text-center text-lg"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(job.auth_code_provider || "");
                      toast({ title: "Copied!", description: "Code copied to clipboard" });
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const result = await generateCodeMutation.mutateAsync({ jobId: job.id });
                    setGeneratedCode({ code: result.code, expires_at: result.expires_at });
                    setShowCodeModal(true);
                    toast({ title: "Code Generated!", description: "Share this code with the customer to complete the job." });
                  } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to generate code";
                    toast({ title: "Error", description: errorMessage, variant: "destructive" });
                  }
                }}
                disabled={generateCodeMutation.isPending}
              >
                {generateCodeMutation.isPending ? "Generating..." : "Generate Completion Code"}
              </Button>
            )}
            
            <Button
              variant="outline"
              className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedJob(job);
                setCancelJobId(job.id); // Store job ID separately to avoid race condition
                setCancelDialog(true);
              }}
            >
              Cancel Job
            </Button>
          </div>
        )}

        {/* Invoice button for completed jobs */}
        {job.status === "completed" && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <Button
              className="w-full bg-[#D9743A]/20 hover:bg-[#D9743A]/30 text-[#D9743A] border border-[#D9743A]/30 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setInvoiceJob(job);
                setShowInvoiceModal(true);
              }}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Generate Invoice
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Jobs</p>
          <h1 className="text-3xl font-semibold mt-2">Job Management</h1>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          placeholder="Search jobs by customer, service, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-[#050505] border-white/10 text-white pl-10 placeholder:text-white/40"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={activeTab === "jobs" ? "all" : activeTab.replace("jobs-", "")} className="w-full">
        <div className="w-full overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsList className="bg-[#050505] border border-white/10 p-1 inline-flex w-auto min-w-full flex-nowrap">
            <TabsTrigger value="all" onClick={() => navigate("/dashboard/pro?view=jobs")} className="whitespace-nowrap flex-shrink-0 px-3 sm:px-4">
              All Jobs
            </TabsTrigger>
            <TabsTrigger value="pending" onClick={() => navigate("/dashboard/pro?view=jobs-pending")} className="whitespace-nowrap flex-shrink-0 px-3 sm:px-4">
              Pending
            </TabsTrigger>
            <TabsTrigger value="active" onClick={() => navigate("/dashboard/pro?view=jobs-active")} className="whitespace-nowrap flex-shrink-0 px-3 sm:px-4">
              Active
            </TabsTrigger>
            <TabsTrigger value="completed" onClick={() => navigate("/dashboard/pro?view=jobs-completed")} className="whitespace-nowrap flex-shrink-0 px-3 sm:px-4">
              Completed
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="space-y-4 mt-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {filterJobs(pendingJobs).map(renderJobCard)}
            {filterJobs(activeJobs).map(renderJobCard)}
            {filterJobs(completedJobs).map(renderJobCard)}
            {filterJobs(cancelledJobs).map(renderJobCard)}
          </div>
          {filterJobs(pendingJobs).length === 0 && 
           filterJobs(activeJobs).length === 0 && 
           filterJobs(completedJobs).length === 0 &&
           filterJobs(cancelledJobs).length === 0 && (
            <Card className="bg-[#050505] border-white/5 p-12 text-center rounded-2xl">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <h3 className="font-semibold mb-2">No jobs found</h3>
              <p className="text-sm text-white/50">Jobs will appear here when customers book your services</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="bg-[#050505] border-white/5 p-6 rounded-2xl h-48" />
              ))}
            </div>
          ) : filterJobs(pendingJobs).length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {filterJobs(pendingJobs).map((job) => (
                <JobRequestCard
                  key={job.id}
                  job={job as any}
                  onAccept={handleAcceptJob}
                  onDecline={handleDeclineJob}
                  isLoading={acceptJobMutation.isPending || declineJobMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-[#050505] border-white/5 p-12 text-center rounded-2xl">
              <Clock className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <h3 className="font-semibold mb-2">No pending jobs</h3>
              <p className="text-sm text-white/50">New job requests will appear here</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4 mt-6">
          {filterJobs(activeJobs).length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {filterJobs(activeJobs).map(renderJobCard)}
            </div>
          ) : (
            <Card className="bg-[#050505] border-white/5 p-12 text-center rounded-2xl">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <h3 className="font-semibold mb-2">No active jobs</h3>
              <p className="text-sm text-white/50">Active jobs will appear here</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          {filterJobs(completedJobs).length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {filterJobs(completedJobs).map(renderJobCard)}
            </div>
          ) : (
            <Card className="bg-[#050505] border-white/5 p-12 text-center rounded-2xl">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <h3 className="font-semibold mb-2">No completed jobs</h3>
              <p className="text-sm text-white/50">Completed jobs will appear here</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Job Details Dialog */}
      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent 
            className="bg-[#050505] border-white/10 text-white w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => {
              setSelectedJob(null);
            }}
          >
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-2xl">
                  {selectedJob.customer?.profiles?.full_name?.trim() || "Customer"}
                </DialogTitle>
                {(selectedJob as any).is_rush && (
                  <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/30 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    URGENT
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-white/60">
                {selectedJob.service_category?.name || "Service"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/70">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <Label className="text-white/70">
                    {selectedJob.quote_total ? "Quoted Price" : "Price"}
                  </Label>
                  <p className="text-lg font-semibold mt-1">
                    {selectedJob.quote_total 
                      ? `KES ${selectedJob.quote_total.toLocaleString()}`
                      : "Quote pending"
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
              {selectedJob.notes && (
                <div>
                  <Label className="text-white/70">Notes</Label>
                  <p className="mt-1 text-white/80">{selectedJob.notes}</p>
                </div>
              )}
              {selectedJob.status === "confirmed" && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  {/* Quote Status Display */}
                  {selectedJob.quote_total && (
                    <div className="bg-[#1E1E1E] rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/70 text-sm">Your Quote</span>
                        <span className="font-bold text-lg text-[#D9743A]">
                          KES {selectedJob.quote_total.toLocaleString()}
                        </span>
                      </div>
                      {selectedJob.quote_labor && (
                        <div className="flex justify-between text-sm text-white/50">
                          <span>Labor</span>
                          <span>KES {selectedJob.quote_labor.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedJob.quote_materials && selectedJob.quote_materials > 0 && (
                        <div className="flex justify-between text-sm text-white/50">
                          <span>Materials</span>
                          <span>KES {selectedJob.quote_materials.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Action Buttons based on quote status */}
                  {!selectedJob.quote_submitted_at ? (
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                      onClick={() => {
                        setQuoteJob(selectedJob);
                        setShowQuoteModal(true);
                      }}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit Quote
                    </Button>
                  ) : !selectedJob.quote_accepted ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                      <Hourglass className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                      <p className="text-sm text-amber-400 font-medium">Waiting for Customer</p>
                      <p className="text-xs text-white/50 mt-1">
                        Customer needs to accept your quote before you can start
                      </p>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                      onClick={() => {
                        setAuthCodeJobId(selectedJob?.id || null); // Store jobId separately to avoid race condition
                        setAuthCodeDialog("start");
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Job
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      setCancelJobId(selectedJob.id); // Store job ID before dialog opens
                      setCancelDialog(true);
                    }}
                  >
                    Cancel Job
                  </Button>
                </div>
              )}
              {selectedJob.status === "in_progress" && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  {/* Quote-Based Job Info */}
                  {selectedJob.quote_total && (
                    <div className="bg-gradient-to-br from-[#1E1E1E] to-[#121212] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                          <DollarSign className="w-4 w-4 text-green-500" />
                          Agreed Quote
                        </h4>
                        <Badge variant="success" className="bg-green-500/20 text-green-400">
                          In Progress
                        </Badge>
                      </div>
                      
                      <div className="text-center py-2">
                        <div className="text-3xl font-bold text-green-500">
                          KES {selectedJob.quote_total.toLocaleString()}
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                          You'll earn KES {Math.round(selectedJob.quote_total * 0.85).toLocaleString()} (after 15% platform fee)
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
                        Payment processed after job completion
                      </p>
                    </div>
                  )}
                  
                  {/* Provider End Code Section */}
                  <div className="bg-[#1E1E1E] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="w-4 h-4 text-[#D9743A]" />
                      <Label className="text-white font-medium">Your Completion Code</Label>
                    </div>
                    <p className="text-xs text-white/50 mb-3">
                      Share this code with the customer so they can mark the job as complete
                    </p>
                    {selectedJob.auth_code_provider ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={selectedJob.auth_code_provider}
                            readOnly
                            className="bg-black/50 border-green-500/30 text-white font-mono text-center text-xl font-bold tracking-wider"
                          />
                          <Button
                            variant="outline"
                            className="border-white/10 text-white hover:bg-white/10"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedJob.auth_code_provider || "");
                              toast({ title: "Copied!", description: "Completion code copied to clipboard" });
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-green-400 text-center">
                          ✓ Code ready to share with customer
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-sm text-yellow-400">
                            Generate a completion code when you're ready to finish the job.
                          </p>
                        </div>
                        <Button
                          className="w-full h-12 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#D9743A]/20"
                          onClick={async () => {
                            try {
                              const result = await generateCodeMutation.mutateAsync({ jobId: selectedJob.id });
                              setGeneratedCode({ code: result.code, expires_at: result.expires_at });
                              setShowCodeModal(true);
                              setSelectedJob({ ...selectedJob, auth_code_provider: result.code });
                              toast({ title: "Code Generated!", description: "Share this code with the customer." });
                            } catch (error: unknown) {
                              const errorMessage = error instanceof Error ? error.message : "Failed to generate code";
                              
                              if (errorMessage.includes("already exists")) {
                                queryClient.invalidateQueries({ queryKey: ["pro", "jobs", providerId] });
                                toast({
                                  title: "Code Already Exists",
                                  description: "A code has already been generated for this job. Refreshing...",
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
                          {generateCodeMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4 mr-2" />
                              Generate Completion Code
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      setCancelJobId(selectedJob.id); // Store job ID before dialog opens
                      setCancelDialog(true);
                    }}
                  >
                    Cancel Job
                  </Button>
                </div>
              )}
              {/* Invoice section for completed jobs */}
              {selectedJob.status === "completed" && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-green-400 font-medium">Job Completed</p>
                    <p className="text-xs text-white/50 mt-1">
                      {selectedJob.payment_status === "completed" ? "Payment received" : "Awaiting payment"}
                    </p>
                  </div>
                  <Button
                    className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
                    onClick={() => {
                      setInvoiceJob(selectedJob);
                      setShowInvoiceModal(true);
                    }}
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    Generate Invoice
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Job Dialog */}
      <Dialog open={cancelDialog} onOpenChange={(open) => {
        setCancelDialog(open);
        // Only clear reason when closing, not when opening
        if (!open) {
          setCancelReason("");
          cancelReasonRef.current = "";
          setCancelJobId(null); // Clear stored job ID
          if (cancelReasonTextareaRef.current) {
            cancelReasonTextareaRef.current.value = "";
          }
        }
      }}>
        <DialogContent className="bg-[#050505] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Cancel Job</DialogTitle>
            <DialogDescription className="text-white/60">
              Please provide a reason for cancelling this job. The customer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-white/70">Reason</Label>
              <Textarea
                ref={cancelReasonTextareaRef}
                id="cancel-reason-textarea"
                value={cancelReason}
                onChange={(e) => {
                  const newValue = e.target.value;
                  cancelReasonRef.current = newValue; // Update ref immediately
                  setCancelReason(newValue);
                }}
                onInput={(e) => {
                  const value = (e.target as HTMLTextAreaElement).value;
                  setCancelReason(value);
                  cancelReasonRef.current = value;
                }}
                placeholder="Explain why you're cancelling..."
                className="bg-black border-white/10 text-white mt-1 min-h-[100px]"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  setCancelDialog(false);
                  setCancelReason("");
                  cancelReasonRef.current = ""; // Clear ref too
                  setCancelJobId(null); // Clear stored job ID
                  if (cancelReasonTextareaRef.current) {
                    cancelReasonTextareaRef.current.value = "";
                  }
                }}
              >
                Keep Job
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={handleCancelJob}
                disabled={!cancelReason.trim() || cancelJobMutation.isPending}
              >
                {cancelJobMutation.isPending ? "Cancelling..." : "Cancel Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Code Dialog - Only for starting jobs */}
      <Dialog open={!!authCodeDialog} onOpenChange={(open) => {
        if (!open) {
          setAuthCodeDialog(null);
          setAuthCode("");
          setAuthCodeJobId(null);
        }
      }}>
        <DialogContent className="bg-[#050505] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Start Job</DialogTitle>
            <DialogDescription className="text-white/60">
              Enter the customer's auth code to start the job
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-white/70">Auth Code</Label>
              <Input
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Enter auth code"
                className="bg-black border-white/10 text-white mt-1"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/10"
                disabled={!authCode?.trim()}
                onClick={() => {
                  setAuthCodeDialog(null);
                  setAuthCode("");
                  setAuthCodeJobId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                onClick={handleStartJob}
                disabled={!authCode?.trim() || startJobMutation.isPending}
              >
                Start Job
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generated Code Modal */}
      <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
        <DialogContent className="bg-[#050505] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Completion Code Generated</DialogTitle>
            <DialogDescription className="text-white/60">
              Share this code with the customer to complete the job
            </DialogDescription>
          </DialogHeader>
          {generatedCode && (
            <div className="space-y-4">
              <div className="bg-[#1E1E1E] border border-white/10 rounded-lg p-4">
                <Label className="text-white/70 mb-2 block text-sm">Your Completion Code</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedCode.code}
                    readOnly
                    className="bg-black border-white/10 text-white font-mono text-center text-2xl font-bold tracking-wider"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-white hover:bg-white/10"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedCode.code);
                        toast({ title: "Copied!", description: "Code copied to clipboard" });
                      } catch (error) {
                        console.error("Failed to copy:", error);
                        toast({
                          title: "Error",
                          description: "Failed to copy code. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
                {generatedCode.expires_at && (
                  <p className="text-xs text-yellow-400 mt-2">
                    Expires: {format(new Date(generatedCode.expires_at), "PPp")}
                  </p>
                )}
              </div>
              <Button
                className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
                onClick={() => setShowCodeModal(false)}
              >
                Got it
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quote Submission Modal */}
      {quoteJob && (
        <ProviderQuoteSubmissionModal
          open={showQuoteModal}
          onOpenChange={(open) => {
            setShowQuoteModal(open);
            if (!open) setQuoteJob(null);
          }}
          job={quoteJob}
          onQuoteSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ["pro", "jobs", providerId] });
            setShowQuoteModal(false);
            setQuoteJob(null);
            toast({
              title: "Quote Submitted!",
              description: "Customer will be notified to review and accept your quote.",
            });
          }}
        />
      )}

      {/* Invoice Modal */}
      {invoiceJob && (
        <InvoiceModal
          open={showInvoiceModal}
          onOpenChange={(open) => {
            setShowInvoiceModal(open);
            if (!open) setInvoiceJob(null);
          }}
          job={invoiceJob}
        />
      )}
    </div>
  );
};
