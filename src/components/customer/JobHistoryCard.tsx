import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Calendar, MapPin, DollarSign, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Booking } from "@/lib/api/customer";

export interface JobHistoryCardProps {
  booking: Booking;
  onViewDetails?: () => void;
  onReview?: () => void;
  showReviewButton?: boolean;
  className?: string;
}

const JobHistoryCard = React.forwardRef<HTMLDivElement, JobHistoryCardProps>(
  ({ booking, onViewDetails, onReview, showReviewButton, className }, ref) => {
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
              <h4 className="font-semibold text-sm truncate">{booking.proName}</h4>
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {booking.serviceCategory || "Service"}
            </p>
            <div className="space-y-1.5">
              {booking.scheduledDate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(booking.scheduledDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {booking.location && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{booking.location}</span>
                </div>
              )}
              {booking.totalPrice && booking.totalPrice > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  <span className="font-semibold text-foreground">
                    ${booking.totalPrice.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDetails}
              className="flex-1"
            >
              View Details
            </Button>
          )}
          {showReviewButton && booking.status === "completed" && onReview && (
            <Button
              variant="default"
              size="sm"
              onClick={onReview}
              className="flex-1"
            >
              <Star className="w-4 h-4 mr-1" />
              Review
            </Button>
          )}
        </div>
      </Card>
    );
  }
);
JobHistoryCard.displayName = "JobHistoryCard";

export { JobHistoryCard };

