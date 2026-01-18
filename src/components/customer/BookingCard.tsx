import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BookingCardProps {
  id: string;
  proName: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  onViewJob?: () => void;
  className?: string;
}

const BookingCard = React.forwardRef<HTMLDivElement, BookingCardProps>(
  ({ proName, status, scheduledDate, scheduledTime, location, onViewJob, className }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "p-4",
          "flex flex-col gap-3",
          "transition-all duration-300",
          "hover:shadow-lg",
          "bg-card/50 backdrop-blur-sm",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-sm truncate">{proName}</h4>
              <StatusBadge status={status} />
            </div>
            <div className="space-y-1.5">
              {scheduledDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(scheduledDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {new Date(scheduledDate).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    }) !== "Invalid Date" && (
                      <span className="ml-1">
                        at {new Date(scheduledDate).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewJob}
          className="w-full"
        >
          View Job
        </Button>
      </Card>
    );
  }
);
BookingCard.displayName = "BookingCard";

export { BookingCard };

