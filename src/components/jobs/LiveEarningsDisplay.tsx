/**
 * LiveEarningsDisplay Component
 * Shows real-time earnings tracking for in-progress jobs
 * Updates every minute with animated transitions
 */

import { useEffect, useState, useMemo } from "react";
import { DollarSign, Clock, TrendingUp, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface LiveEarningsDisplayProps {
  startTime: string | null | undefined;
  hourlyRate: number;
  depositPaid?: number;
  estimatedHours?: number;
  materialsApproved?: number;
  platformFeePercent?: number;
  className?: string;
  variant?: "compact" | "detailed" | "provider";
}

interface EarningsState {
  elapsedMinutes: number;
  elapsedHours: number;
  laborCost: number;
  totalCost: number;
  platformFee: number;
  providerEarnings: number;
  amountDue: number;
  progress: number;
}

export const LiveEarningsDisplay = ({
  startTime,
  hourlyRate,
  depositPaid = 0,
  estimatedHours = 2,
  materialsApproved = 0,
  platformFeePercent = 15,
  className,
  variant = "detailed",
}: LiveEarningsDisplayProps) => {
  const [earnings, setEarnings] = useState<EarningsState>({
    elapsedMinutes: 0,
    elapsedHours: 0,
    laborCost: 0,
    totalCost: 0,
    platformFee: 0,
    providerEarnings: 0,
    amountDue: 0,
    progress: 0,
  });

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate earnings in real-time
  useEffect(() => {
    if (!startTime || !hourlyRate) return;

    const calculateEarnings = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsedMs = Math.max(0, now - start);
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
      const elapsedHours = elapsedMinutes / 60;

      // Round to 15-minute increments for billing (minimum 30 minutes)
      const billableMinutes = Math.max(30, Math.ceil(elapsedMinutes / 15) * 15);
      const billableHours = billableMinutes / 60;

      // Calculate costs
      const laborCost = Math.round(billableHours * hourlyRate * 100) / 100;
      const subtotal = laborCost + materialsApproved;
      const platformFee = Math.round(subtotal * (platformFeePercent / 100) * 100) / 100;
      const totalCost = subtotal + platformFee;
      const providerEarnings = Math.round(subtotal * ((100 - platformFeePercent) / 100) * 100) / 100;
      const amountDue = Math.max(0, totalCost - depositPaid);

      // Progress towards estimated time
      const progress = Math.min(100, (elapsedHours / estimatedHours) * 100);

      const newEarnings: EarningsState = {
        elapsedMinutes,
        elapsedHours: Math.round(elapsedHours * 100) / 100,
        laborCost,
        totalCost,
        platformFee,
        providerEarnings,
        amountDue,
        progress,
      };

      // Trigger animation if values changed significantly
      setEarnings((prev) => {
        if (Math.abs(prev.laborCost - newEarnings.laborCost) > 0.01) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 300);
        }
        return newEarnings;
      });

      setLastUpdate(new Date());
    };

    // Calculate immediately
    calculateEarnings();

    // Update every minute for live display
    const interval = setInterval(calculateEarnings, 60000);

    return () => clearInterval(interval);
  }, [startTime, hourlyRate, depositPaid, estimatedHours, materialsApproved, platformFeePercent]);

  // Format duration
  const formatDuration = useMemo(() => {
    const hours = Math.floor(earnings.elapsedMinutes / 60);
    const minutes = earnings.elapsedMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [earnings.elapsedMinutes]);

  if (!startTime) {
    return null;
  }

  // Compact variant for cards
  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/60">
            <Timer className="w-4 h-4" />
            <span className="text-sm">{formatDuration}</span>
          </div>
          <div className={cn(
            "text-[#D9743A] font-bold text-lg transition-all duration-300",
            isAnimating && "scale-110"
          )}>
            KES {earnings.laborCost.toFixed(2)}
          </div>
        </div>
        <Progress 
          value={earnings.progress} 
          className="h-1 bg-white/10"
        />
      </div>
    );
  }

  // Provider variant - shows provider earnings
  if (variant === "provider") {
    return (
      <Card className={cn(
        "bg-gradient-to-br from-[#1E1E1E] to-[#121212] border-white/10 p-4 space-y-4",
        className
      )}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Live Earnings
          </h4>
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Clock className="w-3 h-3" />
            {formatDuration}
          </div>
        </div>

        <div className="text-center py-2">
          <div className={cn(
            "text-3xl font-bold text-green-500 transition-all duration-300",
            isAnimating && "scale-105"
          )}>
            KES {earnings.providerEarnings.toFixed(2)}
          </div>
          <p className="text-xs text-white/50 mt-1">
            Your earnings (after {platformFeePercent}% platform fee)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-black/30 rounded-lg p-3">
            <p className="text-white/50 text-xs mb-1">Labor Cost</p>
            <p className="font-medium text-white">KES {earnings.laborCost.toFixed(2)}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-3">
            <p className="text-white/50 text-xs mb-1">Rate</p>
            <p className="font-medium text-white">KES {hourlyRate}/hr</p>
          </div>
        </div>

        <Progress 
          value={earnings.progress} 
          className="h-2 bg-white/10"
        />
        <p className="text-xs text-white/40 text-center">
          {earnings.progress < 100 
            ? `${Math.round(earnings.progress)}% of estimated ${estimatedHours}h`
            : "Exceeded estimated time"}
        </p>
      </Card>
    );
  }

  // Detailed variant (default) - for customer view
  return (
    <Card className={cn(
      "bg-gradient-to-br from-[#1E1E1E] to-[#121212] border-white/10 p-5 space-y-4 animate-fade-in",
      className
    )}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#D9743A]" />
          Live Cost Tracking
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Duration:</span>
          <span className="text-sm font-medium text-white flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration}
          </span>
        </div>
      </div>

      {/* Main Cost Display */}
      <div className="text-center py-3 border-y border-white/5">
        <p className="text-xs text-white/50 mb-1">Estimated Total</p>
        <div className={cn(
          "text-4xl font-bold text-[#D9743A] transition-all duration-300",
          isAnimating && "scale-105"
        )}>
          KES {earnings.totalCost.toFixed(2)}
        </div>
        <p className="text-xs text-white/40 mt-1">
          Updates every minute
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Labor ({earnings.elapsedHours.toFixed(2)}h × KES {hourlyRate})</span>
          <span className="text-white font-medium">KES {earnings.laborCost.toFixed(2)}</span>
        </div>
        
        {materialsApproved > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Materials</span>
            <span className="text-white font-medium">KES {materialsApproved.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Platform Fee ({platformFeePercent}%)</span>
          <span className="text-white/60">KES {earnings.platformFee.toFixed(2)}</span>
        </div>
        
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Deposit Paid</span>
            <span className="text-green-500">- KES {depositPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold mt-1">
            <span className="text-white">Balance Due</span>
            <span className={cn(
              "transition-all duration-300",
              earnings.amountDue > 0 ? "text-[#D9743A]" : "text-green-500"
            )}>
              KES {earnings.amountDue.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress 
          value={earnings.progress} 
          className="h-2 bg-white/10"
        />
        <div className="flex justify-between text-xs text-white/40">
          <span>0h</span>
          <span className={earnings.progress > 100 ? "text-yellow-500" : ""}>
            {earnings.progress < 100 
              ? `${Math.round(earnings.progress)}% of estimated time`
              : "Exceeded estimate"}
          </span>
          <span>{estimatedHours}h</span>
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-white/40 text-center italic">
        Final bill calculated upon job completion using verified timestamps
      </p>
    </Card>
  );
};

export default LiveEarningsDisplay;



