import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface StatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

const statusConfig: Record<BookingStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  pending: {
    label: "Pending Approval",
    variant: "outline",
    className: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default",
    className: "bg-primary/20 text-primary border-primary/30",
  },
  in_progress: {
    label: "In Progress",
    variant: "secondary",
    className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  completed: {
    label: "Completed",
    variant: "default",
    className: "bg-success/20 text-success border-success/30",
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive",
  },
};

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, className }, ref) => {
    const config = statusConfig[status];
    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={cn("text-xs font-semibold", config.className, className)}
      >
        {config.label}
      </Badge>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge };

