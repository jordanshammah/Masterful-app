/**
 * Customer Dashboard Home View
 * Overview with stats, recent activity, and quick actions
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  CheckCircle2,
  Calendar,
  Wallet,
  Plus,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useCustomerJobs } from "@/hooks/useCustomerEnhanced";
import { useCustomerProfile } from "@/hooks/useCustomer";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import type { CustomerDashboardStats } from "@/types/customer-dashboard";

interface CustomerDashboardHomeProps {
  customerId: string;
}

export const CustomerDashboardHome = ({ customerId }: CustomerDashboardHomeProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useCustomerJobs(customerId);
  const { data: profile, isLoading: profileLoading } = useCustomerProfile();

  // Calculate stats
  const stats: CustomerDashboardStats = useMemo(() => {
    if (!jobs) {
      return {
        activeJobs: 0,
        completedJobs: 0,
        upcomingVisits: 0,
        walletBalance: 0,
      };
    }

    const active = jobs.filter(
      (j) => j.status === "confirmed" || j.status === "in_progress"
    );
    const completed = jobs.filter((j) => j.status === "completed");
    const upcoming = jobs.filter(
      (j) => j.status === "confirmed" && new Date(j.scheduled_date) > new Date()
    );
    // Calculate total spent from actual payments (prefer payment_total which includes tips, fallback to payment_amount or quote_total)
    const totalSpent = completed.reduce((sum, j) => {
      // Use payment_total if available (includes tip), otherwise payment_amount, otherwise quote_total, otherwise total_price
      const paymentAmount = j.payment_total || j.payment_amount || j.quote_total || j.total_price || 0;
      // Only count if payment is completed or if no payment status (legacy jobs)
      if (j.payment_status === 'completed' || !j.payment_status) {
        return sum + paymentAmount;
      }
      return sum;
    }, 0);

    return {
      activeJobs: active.length,
      completedJobs: completed.length,
      upcomingVisits: upcoming.length,
      walletBalance: totalSpent,
    };
  }, [jobs]);

  // Get recent jobs
  const recentJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter((j) => j.status !== "cancelled")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [jobs]);

  // Get customer's first name with fallbacks
  const firstName = useMemo(() => {
    // Try to get from profile first
    const profileName = profile?.full_name;
    if (profileName) {
      return profileName.split(" ")[0];
    }
    
    // Fall back to user metadata
    const metadataName = user?.user_metadata?.full_name;
    if (metadataName) {
      return metadataName.split(" ")[0];
    }
    
    // Last resort fallback
    return "there";
  }, [profile?.full_name, user?.user_metadata?.full_name]);

  if (jobsLoading || profileLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Overview</p>
          <h1 className="text-3xl font-semibold mt-2">Welcome back, {firstName}</h1>
          <p className="text-white/60 mt-1">Here's what's happening with your jobs</p>
        </div>
        <Button
          className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold gap-2"
          onClick={() => navigate("/services")}
        >
          <Plus className="w-4 h-4" />
          Book a Service
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[#C25A2C]/20">
              <Briefcase className="w-5 h-5 text-[#C25A2C]" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Active Jobs</p>
              <p className="text-3xl font-semibold mt-1">{stats.activeJobs}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-green-500/20">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Completed</p>
              <p className="text-3xl font-semibold mt-1">{stats.completedJobs}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-blue-500/20">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Upcoming</p>
              <p className="text-3xl font-semibold mt-1">{stats.upcomingVisits}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[#C25A2C]/20">
              <Wallet className="w-5 h-5 text-[#C25A2C]" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Total Spent</p>
              <p className="text-3xl font-semibold mt-1">KES {stats.walletBalance.toLocaleString('en-KE', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Book Service CTA */}
      <Card className="bg-gradient-to-r from-[#C25A2C]/10 via-[#C25A2C]/5 to-transparent border-[#C25A2C]/20 p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2">Need a service?</h3>
            <p className="text-white/60">Book a professional for your next project</p>
          </div>
          <Button
            className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold gap-2"
            onClick={() => navigate("/services")}
          >
            Book a Service
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Activity</p>
            <h2 className="text-2xl font-semibold mt-2">Recent Jobs</h2>
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => navigate("/dashboard/customer?view=jobs")}
          >
            View All
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {recentJobs.length > 0 ? (
          <div className="space-y-3">
            {recentJobs.map((job) => {
              const getStatusBadge = (status: string) => {
                const variants: Record<string, { className: string; label: string }> = {
                  pending: { className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pending Approval" },
                  confirmed: { className: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Confirmed" },
                  in_progress: { className: "bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/20", label: "In Progress" },
                  completed: { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Completed" },
                };
                const variant = variants[status] || variants.pending;
                return (
                  <Badge key={status} className={`border px-3 py-1 ${variant.className}`}>
                    {variant.label}
                  </Badge>
                );
              };

              return (
                <Card
                  key={job.id}
                  className="bg-[#050505] border-white/5 p-4 rounded-xl hover:border-white/10 transition-all cursor-pointer"
                  onClick={() => navigate(`/dashboard/customer?view=jobs&jobId=${job.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">
                          {job.provider?.display_name?.trim() 
                            || job.provider?.business_name?.trim() 
                            || "Professional"}
                        </h4>
                        {getStatusBadge(job.status)}
                      </div>
                      <p className="text-sm text-white/60 mb-1">
                        {job.service_category?.name || "Service"}
                      </p>
                      {job.scheduled_date && (
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(job.scheduled_date), "PPP")}</span>
                        </div>
                      )}
                      <p className="text-sm font-semibold mt-2 text-[#C25A2C]">
                        KES {(job.payment_total || job.payment_amount || job.quote_total || job.total_price || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40" />
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-[#050505] border-white/5 p-12 text-center rounded-2xl">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="font-semibold mb-2">No jobs yet</h3>
            <p className="text-sm text-white/50 mb-4">
              Book your first service to get started
            </p>
            <Button
              className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
              onClick={() => navigate("/services")}
            >
              Book a Service
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};








