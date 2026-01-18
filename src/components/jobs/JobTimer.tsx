/**
 * JobTimer Component
 * Displays live duration timer and cost for in-progress jobs with hourly pricing
 * Calculates duration from job_started_at timestamp
 * Shows estimated cost based on elapsed time × hourly rate
 */

import { useEffect, useState } from "react";
import { Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobTimerProps {
  startTime: string | null | undefined; // ISO timestamp when job started
  hourlyRate?: number; // Provider's hourly rate for this job
  className?: string;
  showCost?: boolean; // Whether to show cost tracking (default true)
}

export const JobTimer = ({ 
  startTime, 
  hourlyRate, 
  className,
  showCost = true 
}: JobTimerProps) => {
  const [duration, setDuration] = useState<string>("00:00:00");
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  useEffect(() => {
    if (!startTime) {
      setDuration("00:00:00");
      setEstimatedCost(0);
      return;
    }

    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - start);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDuration(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );

      // Calculate estimated cost if hourly rate is provided
      if (hourlyRate && hourlyRate > 0) {
        const elapsedHours = diff / (1000 * 60 * 60);
        const cost = elapsedHours * hourlyRate;
        setEstimatedCost(Math.round(cost * 100) / 100); // Round to 2 decimals
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, hourlyRate]);

  if (!startTime) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Duration Timer */}
      <div className="flex items-center gap-2 text-[#C25A2C]">
        <Clock className="w-4 h-4" />
        <span className="font-mono font-semibold text-lg">{duration}</span>
      </div>

      {/* Live Cost Tracking */}
      {showCost && hourlyRate && hourlyRate > 0 && (
        <div className="flex items-center gap-2 text-white/70">
          <DollarSign className="w-4 h-4" />
          <div className="text-sm">
            <span className="font-semibold text-white">
              KES {estimatedCost.toFixed(2)}
            </span>
            <span className="text-xs ml-1">(labor only)</span>
          </div>
        </div>
      )}

      {showCost && hourlyRate && hourlyRate > 0 && (
        <p className="text-xs text-white/50 italic">
          Live estimate • Final bill calculated at completion
        </p>
      )}
    </div>
  );
};







