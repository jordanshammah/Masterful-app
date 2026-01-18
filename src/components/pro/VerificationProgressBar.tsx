import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Upload, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerificationStatus = "not_verified" | "pending" | "verified";

export interface VerificationProgressBarProps {
  status: VerificationStatus;
  completion: number;
  onUploadDocuments?: () => void;
  onCompleteProfile?: () => void;
  className?: string;
}

const statusConfig: Record<
  VerificationStatus,
  { label: string; icon: any; color: string; bgColor: string }
> = {
  not_verified: {
    label: "Not Verified",
    icon: AlertCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  pending: {
    label: "Pending Verification",
    icon: Clock,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  verified: {
    label: "Verified Professional",
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
};

const VerificationProgressBar = React.forwardRef<
  HTMLDivElement,
  VerificationProgressBarProps
>(({ status, completion, onUploadDocuments, onCompleteProfile, className }, ref) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card
      ref={ref}
      className={cn(
        "p-4",
        "flex items-center justify-between gap-4",
        "transition-all duration-300",
        "bg-card/50 backdrop-blur-sm",
        status === "verified" ? "border-success/30" : "border-primary/20",
        className
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            config.bgColor
          )}
        >
          <StatusIcon className={cn("w-6 h-6", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-sm">Verification Status</h3>
            <Badge
              variant={status === "verified" ? "default" : "outline"}
              className={cn(
                "text-xs",
                status === "verified" && "bg-success/20 text-success border-success/30"
              )}
            >
              {config.label}
            </Badge>
          </div>
          {status !== "verified" && (
            <div className="space-y-2">
              <Progress value={completion} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {completion}% profile complete
              </p>
            </div>
          )}
          {status === "verified" && (
            <p className="text-xs text-muted-foreground">
              Your profile is verified and visible to customers
            </p>
          )}
        </div>
      </div>

      {status !== "verified" && (
        <div className="flex gap-2">
          {completion < 80 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onCompleteProfile}
              className="whitespace-nowrap"
            >
              Complete Profile
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onUploadDocuments}
              className="whitespace-nowrap bg-primary hover:bg-primary-hover"
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload Documents
            </Button>
          )}
        </div>
      )}
    </Card>
  );
});
VerificationProgressBar.displayName = "VerificationProgressBar";

export { VerificationProgressBar };
