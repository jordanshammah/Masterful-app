/**
 * Pro Dashboard Home View
 * Overview with stats, earnings, and job requests
 */

import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EarningTile } from "@/components/pro/EarningTile";
import { JobRequestCard } from "@/components/pro/JobRequestCard";
import {
  Calendar,
  Star,
  Users,
  DollarSign,
  Briefcase,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  useProProfileEnhanced,
  useProEarningsEnhanced,
  useProJobsByStatus,
  useAcceptJobEnhanced,
  useDeclineJobEnhanced,
  usePayoutMethods,
} from "@/hooks/useProEnhanced";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { ProDashboardStats } from "@/types/pro-dashboard";

interface ProDashboardHomeProps {
  providerId: string;
}

export const ProDashboardHome = ({ providerId }: ProDashboardHomeProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useProProfileEnhanced(providerId);
  const { data: earnings, isLoading: earningsLoading } = useProEarningsEnhanced(providerId);
  const { data: pendingJobs } = useProJobsByStatus(providerId, "pending");
  const { data: activeJobs } = useProJobsByStatus(providerId, "confirmed");
  const { data: inProgressJobs } = useProJobsByStatus(providerId, "in_progress");
  const { data: completedJobs } = useProJobsByStatus(providerId, "completed");
  const { data: payoutMethods = [], isLoading: payoutMethodsLoading } = usePayoutMethods(providerId);

  // Debug logging
  React.useEffect(() => {
    console.log(`[DEBUG ProDashboardHome] Component props:`, {
      providerId,
      userAuthId: user?.id,
      matches: providerId === user?.id,
    });
    console.log(`[DEBUG ProDashboardHome] Payout methods data:`, {
      count: payoutMethods.length,
      methods: payoutMethods.map((m) => ({
        id: m.id,
        provider_id: (m as any).provider_id,
        type: m.type,
        account_number: m.account_number,
        label: m.label,
        paystack_subaccount_id: m.paystack_subaccount_id,
      })),
      isLoading: payoutMethodsLoading,
    });
  }, [providerId, user?.id, payoutMethods, payoutMethodsLoading]);

  const acceptJobMutation = useAcceptJobEnhanced();
  const declineJobMutation = useDeclineJobEnhanced();

  // Calculate stats
  const stats: ProDashboardStats = useMemo(() => {
    const totalJobs = (pendingJobs?.length || 0) + 
                     (activeJobs?.length || 0) + 
                     (inProgressJobs?.length || 0) + 
                     (completedJobs?.length || 0);
    
    return {
      totalJobs,
      activeJobs: (activeJobs?.length || 0) + (inProgressJobs?.length || 0),
      completedJobs: completedJobs?.length || 0,
      pendingJobs: pendingJobs?.length || 0,
      totalEarnings: earnings?.lifetime.amount || 0,
      rating: profile?.rating || 0,
      reviewCount: profile?.review_count || 0,
    };
  }, [pendingJobs, activeJobs, inProgressJobs, completedJobs, earnings, profile]);

  // Get professional's name with fallbacks
  const firstName = useMemo(() => {
    // Try to get from profile first
    const profileName = profile?.profiles?.full_name;
    if (profileName) {
      return profileName.split(" ")[0];
    }
    
    // Fall back to user metadata
    const metadataName = user?.user_metadata?.full_name;
    if (metadataName) {
      return metadataName.split(" ")[0];
    }
    
    // Last resort fallback
    return "Professional";
  }, [profile?.profiles?.full_name, user?.user_metadata?.full_name]);

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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Overview</p>
          <h1 className="text-3xl font-semibold mt-2">Welcome back, {firstName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-white/60">Here's what's happening with your business today</p>
            {profile?.service_categories?.name && (
              <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border border-[#C25A2C]/20">
                <Wrench className="w-3 h-3 mr-1" />
                {profile.service_categories.name}
              </Badge>
            )}
          </div>
        </div>
        {profile?.rating && (
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#050505] border border-white/10">
            <Star className="w-5 h-5 fill-[#C25A2C] text-[#C25A2C]" />
            <span className="text-lg font-bold">{profile.rating.toFixed(1)}</span>
            <span className="text-sm text-white/50">
              ({profile.review_count || 0} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <Wrench className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Service</p>
              <p className="text-lg font-semibold mt-1 truncate">
                {profile?.service_categories?.name || "N/A"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[#C25A2C]/20">
              <Briefcase className="w-5 h-5 text-[#C25A2C]" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Total Jobs</p>
              <p className="text-3xl font-semibold mt-1">{stats.totalJobs}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/20">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Active</p>
              <p className="text-3xl font-semibold mt-1">{stats.activeJobs}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-green-500/20">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Completed</p>
              <p className="text-3xl font-semibold mt-1">{stats.completedJobs}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[#C25A2C]/20">
              <DollarSign className="w-5 h-5 text-[#C25A2C]" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Total Earnings</p>
              <p className="text-3xl font-semibold mt-1">${stats.totalEarnings.toFixed(0)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payout Methods Summary */}
      <Card className="bg-[#050505] border-white/5 text-white p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Payout Methods</p>
            <p className="text-lg font-semibold mt-2">Manage where you receive payments</p>
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => navigate("/dashboard/pro?view=payouts")}
          >
            View Payouts
          </Button>
        </div>

      

        <div className="mt-4 space-y-3">
          {payoutMethodsLoading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : payoutMethods.length === 0 ? (
            <p className="text-sm text-white/60">No payout methods yet.</p>
          ) : (
            payoutMethods.slice(0, 2).map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {method.label || (method.type === "bank" ? "Bank Account" : "M-Pesa")}
                  </p>
                  <p className="text-xs text-white/60">
                    {method.type.toUpperCase()} • {method.account_number}
                  </p>
                </div>
                <Badge className="border-[#D9743A]/40 bg-[#D9743A]/10 text-[#D9743A]">
                  {method.paystack_subaccount_id ? "Subaccount Ready" : "Pending Subaccount"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Earnings Tiles */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Earnings</p>
            <h2 className="text-2xl font-semibold mt-2">Revenue Overview</h2>
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => navigate("/dashboard/pro?view=earnings")}
          >
            View Details
          </Button>
        </div>

        {earningsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : earnings ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <EarningTile
              label="Today"
              amount={earnings.today.amount}
              jobs={earnings.today.jobs}
              sparklineData={earnings.today.sparkline}
            />
            <EarningTile
              label="This Week"
              amount={earnings.week.amount}
              jobs={earnings.week.jobs}
              sparklineData={earnings.week.sparkline}
            />
            <EarningTile
              label="This Month"
              amount={earnings.month.amount}
              jobs={earnings.month.jobs}
              sparklineData={earnings.month.sparkline}
            />
            <EarningTile
              label="Lifetime"
              amount={earnings.lifetime.amount}
              jobs={earnings.lifetime.jobs}
              sparklineData={earnings.lifetime.sparkline}
            />
          </div>
        ) : null}
      </div>

      {/* Job Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Jobs</p>
            <h2 className="text-2xl font-semibold mt-2">Pending Requests</h2>
          </div>
          {pendingJobs && pendingJobs.length > 0 && (
            <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border border-[#C25A2C]/20">
              {pendingJobs.length} {pendingJobs.length === 1 ? "request" : "requests"}
            </Badge>
          )}
        </div>

        {pendingJobs && pendingJobs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingJobs.slice(0, 4).map((job) => (
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
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="font-semibold mb-2">No pending requests</h3>
            <p className="text-sm text-white/50">New job requests will appear here</p>
          </Card>
        )}

        {pendingJobs && pendingJobs.length > 4 && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => navigate("/dashboard/pro?view=jobs-pending")}
            >
              View All Requests ({pendingJobs.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

