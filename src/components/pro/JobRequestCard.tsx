import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, DollarSign, CheckCircle2, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobWithDetails } from "@/types/pro-dashboard";

export interface JobRequestCardProps {
  job: JobWithDetails;
  onAccept: (jobId: string) => void;
  onDecline: (jobId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const JobRequestCard = React.forwardRef<HTMLDivElement, JobRequestCardProps>(
  ({ job, onAccept, onDecline, isLoading, className }, ref) => {
    const customerName = job.customer?.profiles?.full_name?.trim() || "Customer";
    const customerPhoto = job.customer?.profiles?.photo_url;
    const serviceCategory = job.service_category?.name || "Service";

    const handleAccept = () => {
      onAccept(job.id);
    };

    const handleDecline = () => {
      onDecline(job.id);
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "p-4",
          "flex flex-col gap-4",
          "transition-all duration-300",
          "hover:shadow-lg",
          "bg-[#050505] border-white/5 backdrop-blur-sm",
          "hover:border-[#C25A2C]/30",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={customerPhoto} alt={customerName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {customerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate">{customerName}</h4>
              <Badge variant="secondary" className="text-xs">
                {serviceCategory}
              </Badge>
              {(job as any).is_rush && (
                <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/30 text-xs flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  URGENT
                </Badge>
              )}
            </div>
            <div className="space-y-1.5">
              {job.scheduled_date && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(job.scheduled_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {job.address && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{job.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <DollarSign className="w-3 h-3 text-primary" />
                <span className="font-semibold text-foreground">
                  ${Number(job.total_price || 0).toFixed(2)}
                </span>
              </div>
            </div>
            {job.notes && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {job.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDecline}
            disabled={isLoading}
            className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Decline
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAccept}
            disabled={isLoading}
            className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Accept
          </Button>
        </div>
      </Card>
    );
  }
);
JobRequestCard.displayName = "JobRequestCard";

export { JobRequestCard };
