/**
 * Realtime Connection Status Indicator
 * Shows a small dot indicating live update connection status
 */

import { cn } from "@/lib/utils";

interface RealtimeStatusProps {
  isConnected: boolean;
  className?: string;
  showLabel?: boolean;
}

export const RealtimeStatus = ({ 
  isConnected, 
  className,
  showLabel = false 
}: RealtimeStatusProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "w-2 h-2 rounded-full transition-colors duration-300",
          isConnected 
            ? "bg-green-500 animate-pulse" 
            : "bg-gray-500"
        )}
        title={isConnected ? "Live updates active" : "Connecting..."}
      />
      {showLabel && (
        <span className="text-xs text-white/50">
          {isConnected ? "Live" : "Connecting..."}
        </span>
      )}
    </div>
  );
};




