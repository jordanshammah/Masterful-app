/**
 * FinalBillingCard Component
 * Displays the final bill breakdown after job completion
 * Shows time-based billing with transparent cost breakdown
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Receipt, CheckCircle2 } from "lucide-react";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface FinalBillingCardProps {
  job: JobWithDetails;
  onPayNow?: () => void;
  isPaymentPending?: boolean;
}

export const FinalBillingCard = ({ 
  job, 
  onPayNow,
  isPaymentPending = false 
}: FinalBillingCardProps) => {
  // Check if final billing is available
  if (!job.final_billed || !job.hourly_rate_snapshot) {
    return (
      <Card className="bg-[#121212] border-white/10 p-6">
        <p className="text-white/70 text-center">
          Final billing will be calculated after job completion
        </p>
      </Card>
    );
  }

  const {
    hourly_rate_snapshot,
    actual_duration_minutes,
    final_billed_hours,
    final_labor_cost,
    final_materials_cost,
    final_subtotal,
    platform_fee_percent,
    platform_fee_amount,
    final_total_cost,
    deposit_amount,
    final_amount_due,
    final_paid,
    job_started_at,
    job_completed_at,
  } = job;

  // Format duration as HH:MM
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Card className="bg-[#121212] border-white/10 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#D9743A]/20 flex items-center justify-center">
          <Receipt className="w-6 h-6 text-[#D9743A]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Final Bill</h3>
          <p className="text-sm text-white/60">
            Calculated from handshake timestamps
          </p>
        </div>
      </div>

      {/* Job Duration */}
      <div className="bg-black/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/70 text-sm">Job Duration</span>
          <div className="flex items-center gap-2 text-[#D9743A]">
            <Clock className="w-4 h-4" />
            <span className="font-mono font-semibold">
              {actual_duration_minutes ? formatDuration(actual_duration_minutes) : 'N/A'}
            </span>
          </div>
        </div>
        
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-white/50">
            <span>Started:</span>
            <span>
              {job_started_at ? new Date(job_started_at).toLocaleString() : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-white/50">
            <span>Completed:</span>
            <span>
              {job_completed_at ? new Date(job_completed_at).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-white/70">Hourly Rate:</span>
          <span className="text-white font-medium">
            KES {hourly_rate_snapshot.toFixed(2)}/hour
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/70">Billed Hours:</span>
          <span className="text-white font-medium">
            {final_billed_hours?.toFixed(2) || '0.00'} hours
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/70">Labor Cost:</span>
          <span className="text-white font-medium">
            KES {final_labor_cost?.toFixed(2) || '0.00'}
          </span>
        </div>

        {final_materials_cost !== undefined && final_materials_cost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Materials:</span>
            <span className="text-white font-medium">
              KES {final_materials_cost.toFixed(2)}
            </span>
          </div>
        )}

        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Subtotal:</span>
            <span className="text-white font-medium">
              KES {final_subtotal?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="flex justify-between text-sm mt-2">
            <span className="text-white/70">
              Platform Fee ({platform_fee_percent || 15}%):
            </span>
            <span className="text-white font-medium">
              KES {platform_fee_amount?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>

        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="flex justify-between">
            <span className="text-white font-semibold">Total Cost:</span>
            <span className="text-white font-bold text-lg">
              KES {final_total_cost?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="flex justify-between text-sm mt-2">
            <span className="text-white/70">Less Deposit Paid:</span>
            <span className="text-green-400">
              -KES {deposit_amount?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Amount Due */}
      <div className="bg-[#D9743A]/10 border border-[#D9743A]/20 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-white font-bold text-lg">Amount Due:</span>
          <span className="text-[#D9743A] font-bold text-2xl">
            KES {final_amount_due?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>

      {/* Payment Status / Action */}
      {final_paid ? (
        <div className="flex items-center justify-center gap-2 py-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-medium">Payment Completed</span>
        </div>
      ) : (
        <Button
          onClick={onPayNow}
          disabled={isPaymentPending || !onPayNow}
          className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold py-6 text-lg"
        >
          {isPaymentPending ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <DollarSign className="w-5 h-5 mr-2" />
              Pay Now via M-Pesa
            </>
          )}
        </Button>
      )}

      {/* Billing Notes */}
      <div className="mt-6 p-4 bg-black/30 rounded-lg">
        <p className="text-xs text-white/60 leading-relaxed">
          <strong className="text-white/80">Billing Details:</strong><br/>
          • Minimum billing: 30 minutes<br/>
          • Rounded to nearest 15 minutes<br/>
          • Timer cannot be paused (incentive alignment)<br/>
          • Provider receives 85% • Platform keeps 15%
        </p>
      </div>
    </Card>
  );
};




