import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface EarningTileProps {
  label: string;
  amount: number;
  jobs: number;
  sparklineData: number[];
  className?: string;
}

const EarningTile = React.forwardRef<HTMLDivElement, EarningTileProps>(
  ({ label, amount, jobs, sparklineData, className }, ref) => {
    const maxValue = Math.max(...sparklineData, 1);
    const minValue = Math.min(...sparklineData, 0);
    const range = maxValue - minValue || 1;

    // Calculate trend (comparing recent average to earlier average)
    const hasData = sparklineData.length > 0 && sparklineData.some(v => v > 0);
    
    let trendUp = true;
    let trendPercent = "0.0";
    
    if (hasData && sparklineData.length >= 2) {
      // Compare second half average to first half average for more stable trend
      const midPoint = Math.floor(sparklineData.length / 2);
      const firstHalf = sparklineData.slice(0, midPoint);
      const secondHalf = sparklineData.slice(midPoint);
      
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      trendUp = secondAvg >= firstAvg;
      
      if (firstAvg > 0) {
        const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
        trendPercent = Math.abs(percentChange).toFixed(1);
      } else if (secondAvg > 0) {
        // If first half was 0 but second half has data, it's a 100%+ increase
        trendPercent = "100.0";
        trendUp = true;
      }
    }

    // Normalize sparkline data to 0-100 for display
    const normalizedData = sparklineData.map((value) => {
      return ((value - minValue) / range) * 100;
    });

    // Create smooth curve path using cardinal spline
    const createSmoothPath = (points: number[]) => {
      if (points.length < 2) return "";
      
      const tension = 0.3;
      const segments: string[] = [];
      const stepX = 100 / Math.max(points.length - 1, 1);
      
      points.forEach((point, i) => {
        const x = i * stepX;
        const y = 100 - point;
        
        if (i === 0) {
          segments.push(`M ${x} ${y}`);
        } else {
          const prevPoint = points[i - 1];
          const prevX = (i - 1) * stepX;
          const prevY = 100 - prevPoint;
          
          const cp1x = prevX + (x - prevX) * tension;
          const cp1y = prevY;
          const cp2x = x - (x - prevX) * tension;
          const cp2y = y;
          
          segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`);
        }
      });
      
      return segments.join(" ");
    };

    const smoothPath = createSmoothPath(normalizedData);
    const gradientId = `gradient-${label.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <Card
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          "p-4 sm:p-5 lg:p-6",
          "flex flex-col gap-3 sm:gap-4",
          "transition-all duration-300",
          "hover:shadow-xl hover:shadow-[#D9743A]/10",
          "hover:scale-[1.02]",
          "bg-[#0A0A0A] border-white/5",
          "hover:border-[#D9743A]/30",
          "group",
          className
        )}
      >
        {/* Ambient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#D9743A]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative z-10 space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-white/50 uppercase tracking-wider">
              {label}
            </span>
            {hasData && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300",
                trendUp 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : "bg-red-500/10 text-red-400"
              )}>
                {trendUp ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{trendPercent}%</span>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <p className="text-2xl sm:text-3xl lg:text-3xl font-bold text-white mb-1 leading-none">
              KES {amount.toFixed(2)}
            </p>
            <p className="text-xs text-white/40">
              {jobs} {jobs === 1 ? "job" : "jobs"}
            </p>
          </div>

          {/* Enhanced Sparkline Chart */}
          <div className="h-16 sm:h-20 w-full relative -mx-2 px-2">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Gradient for fill */}
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#D9743A" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#D9743A" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#D9743A" stopOpacity="0" />
                </linearGradient>
                
                {/* Glow filter */}
                <filter id={`glow-${label.replace(/\s+/g, "-").toLowerCase()}`}>
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Area fill */}
              <path
                d={`${smoothPath} L 100 100 L 0 100 Z`}
                fill={`url(#${gradientId})`}
              />
              
              {/* Stroke line with glow */}
              <path
                d={smoothPath}
                fill="none"
                stroke="#D9743A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#glow-${label.replace(/\s+/g, "-").toLowerCase()})`}
                className="drop-shadow-[0_0_8px_rgba(217,116,58,0.6)]"
              />
              
              {/* Data point indicators */}
              {normalizedData.map((point, index) => {
                const x = (index * 100) / Math.max(normalizedData.length - 1, 1);
                const y = 100 - point;
                
                // Only show points at intervals for cleaner look
                if (normalizedData.length > 10 && index % Math.ceil(normalizedData.length / 5) !== 0) {
                  return null;
                }
                
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="2"
                    fill="#D9743A"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </Card>
    );
  }
);
EarningTile.displayName = "EarningTile";

export { EarningTile };
