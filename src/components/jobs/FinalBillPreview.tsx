/**
 * FinalBillPreview Component
 * Shows detailed final bill before customer pays remaining balance
 * Includes breakdown of all charges and Paystack checkout button
 */

import { useMemo } from "react";
import { 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Receipt,
  Wrench,
  User,
  Calendar,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface FinalBillPreviewProps {
  job: {
    id: string;
    hourly_rate_snapshot: number;
    job_started_at: string;
    job_completed_at: string;
    actual_duration_minutes?: number;
    final_billed_hours?: number;
    final_labor_cost?: number;
    final_materials_cost?: number;
    final_subtotal?: number;
    platform_fee_percent?: number;
    platform_fee_amount?: number;
    final_total_cost?: number;
    deposit_amount?: number;
    deposit_paid?: boolean;
    final_amount_due?: number;
    provider?: {
      display_name?: string;
      business_name?: string;
    };
    service_category?: {
      name: string;
    };
  };
  onPayNow: () => void;
  isProcessing?: boolean;
  className?: string;
}

export const FinalBillPreview = ({
  job,
  onPayNow,
  isProcessing = false,
  className,
}: FinalBillPreviewProps) => {
  // Calculate values from job data or derive them
  const billData = useMemo(() => {
    const hourlyRate = job.hourly_rate_snapshot || 0;
    const startTime = new Date(job.job_started_at);
    const endTime = new Date(job.job_completed_at);
    
    // Calculate duration
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    
    // Round to 15-minute increments, minimum 30 minutes
    const billedMinutes = Math.max(30, Math.ceil(durationMinutes / 15) * 15);
    const billedHours = billedMinutes / 60;
    
    // Use server-calculated values if available, otherwise calculate
    const laborCost = job.final_labor_cost ?? (billedHours * hourlyRate);
    const materialsCost = job.final_materials_cost ?? 0;
    const subtotal = job.final_subtotal ?? (laborCost + materialsCost);
    const platformFeePercent = job.platform_fee_percent ?? 15;
    const platformFee = job.platform_fee_amount ?? (subtotal * (platformFeePercent / 100));
    const totalCost = job.final_total_cost ?? (subtotal + platformFee);
    const depositPaid = job.deposit_paid ? (job.deposit_amount ?? 0) : 0;
    const amountDue = job.final_amount_due ?? Math.max(0, totalCost - depositPaid);

    return {
      startTime,
      endTime,
      durationMinutes: job.actual_duration_minutes ?? durationMinutes,
      billedMinutes,
      billedHours: job.final_billed_hours ?? billedHours,
      hourlyRate,
      laborCost,
      materialsCost,
      subtotal,
      platformFeePercent,
      platformFee,
      totalCost,
      depositPaid,
      amountDue,
    };
  }, [job]);

  const providerName = job.provider?.display_name?.trim() 
    || job.provider?.business_name?.trim() 
    || "Provider";
  const serviceName = job.service_category?.name || "Service";

  // Format duration display
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} minutes`;
    if (m === 0) return `${h} hour${h > 1 ? "s" : ""}`;
    return `${h}h ${m}m`;
  };

  return (
    <Card className={cn(
      "bg-gradient-to-br from-[#121212] to-[#0a0a0a] border-white/10 overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="bg-[#D9743A]/10 border-b border-[#D9743A]/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#D9743A]/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#D9743A]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Final Bill</h3>
              <p className="text-xs text-white/60">Job #{job.id.slice(0, 8)}</p>
            </div>
          </div>
          <Badge className="bg-[#D9743A]/20 text-[#D9743A] border-[#D9743A]/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Job Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-white/50 flex items-center gap-1">
              <User className="w-3 h-3" /> Provider
            </p>
            <p className="font-medium text-white">{providerName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-white/50 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Service
            </p>
            <p className="font-medium text-white">{serviceName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-white/50 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Started
            </p>
            <p className="font-medium text-white">
              {format(billData.startTime, "h:mm a")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-white/50 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Completed
            </p>
            <p className="font-medium text-white">
              {format(billData.endTime, "h:mm a")}
            </p>
          </div>
        </div>

        <Separator className="bg-white/10" />

        {/* Duration */}
        <div className="bg-black/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#D9743A]" />
              <span className="text-white/70">Duration</span>
            </div>
            <div className="text-right">
              <p className="font-semibold text-white">
                {formatDuration(billData.durationMinutes)}
              </p>
              <p className="text-xs text-white/50">
                Billed: {billData.billedHours.toFixed(2)} hours
              </p>
            </div>
          </div>
        </div>

        {/* Bill Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium text-white/70 text-sm">Cost Breakdown</h4>
          
          <div className="space-y-2">
            {/* Labor */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Labor</span>
                <span className="text-xs text-white/40">
                  ({billData.billedHours.toFixed(2)}h × KES {billData.hourlyRate})
                </span>
              </div>
              <span className="text-white font-medium">
                KES {billData.laborCost.toFixed(2)}
              </span>
            </div>

            {/* Materials */}
            {billData.materialsCost > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/60">Materials</span>
                <span className="text-white font-medium">
                  KES {billData.materialsCost.toFixed(2)}
                </span>
              </div>
            )}

            {/* Platform Fee */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">
                Platform Fee ({billData.platformFeePercent}%)
              </span>
              <span className="text-white/60">
                KES {billData.platformFee.toFixed(2)}
              </span>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-medium text-white">Total</span>
            <span className="text-xl font-bold text-white">
              KES {billData.totalCost.toFixed(2)}
            </span>
          </div>

          {/* Deposit */}
          {billData.depositPaid > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Deposit Paid
              </span>
              <span className="text-green-500">
                - KES {billData.depositPaid.toFixed(2)}
              </span>
            </div>
          )}

          <Separator className="bg-white/10" />

          {/* Amount Due */}
          <div className="flex justify-between items-center py-2">
            <span className="font-semibold text-white text-lg">Amount Due</span>
            <span className={cn(
              "text-2xl font-bold",
              billData.amountDue > 0 ? "text-[#D9743A]" : "text-green-500"
            )}>
              KES {billData.amountDue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Note */}
        {billData.amountDue > 0 && (
          <div className="flex items-start gap-2 p-3 bg-[#D9743A]/10 rounded-lg border border-[#D9743A]/20">
            <AlertCircle className="w-4 h-4 text-[#D9743A] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#D9743A]/80">
              Final payment is calculated based on verified job start and end timestamps. 
              The provider will receive {100 - billData.platformFeePercent}% of the subtotal.
            </p>
          </div>
        )}

        {/* Pay Now Button */}
        {billData.amountDue > 0 ? (
          <Button
            onClick={onPayNow}
            disabled={isProcessing}
            className={cn(
              "w-full h-14 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold text-lg",
              "transition-all duration-300",
              !isProcessing && "hover:scale-[1.02] hover:shadow-lg hover:shadow-[#D9743A]/20"
            )}
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay KES {billData.amountDue.toFixed(2)} Now
              </>
            )}
          </Button>
        ) : (
          <div className="w-full h-14 bg-green-500/20 rounded-xl flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-green-500">Fully Paid</span>
          </div>
        )}

        {/* Security Note */}
        <p className="text-xs text-white/40 text-center flex items-center justify-center gap-1">
          <CreditCard className="w-3 h-3" />
          Secure payment powered by Paystack
        </p>
      </div>
    </Card>
  );
};

export default FinalBillPreview;



