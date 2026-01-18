import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Payment } from "@/lib/api/customer";

export interface PaymentHistoryCardProps {
  payment: Payment;
  onClick?: () => void;
  className?: string;
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  completed: {
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  pending: {
    icon: Clock,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  refunded: {
    icon: RefreshCw,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
  },
};

const PaymentHistoryCard = React.forwardRef<HTMLDivElement, PaymentHistoryCardProps>(
  ({ payment, onClick, className }, ref) => {
    const config = statusConfig[payment.status] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <Card
        ref={ref}
        onClick={onClick}
        className={cn(
          "p-4",
          "flex items-center justify-between gap-4",
          "transition-all duration-300",
          "hover:shadow-lg",
          "bg-card/50 backdrop-blur-sm",
          onClick && "cursor-pointer",
          className
        )}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config.bgColor)}>
            <StatusIcon className={cn("w-6 h-6", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate">
                {payment.job?.proName || "Unknown Professional"}
              </h4>
              <Badge
                variant={payment.status === "completed" ? "default" : "outline"}
                className={cn("text-xs", payment.status === "completed" && "bg-success/20 text-success border-success/30")}
              >
                {payment.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {payment.job?.serviceCategory || "Service"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {payment.processedAt
                ? new Date(payment.processedAt).toLocaleDateString()
                : new Date(payment.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">${payment.amount.toFixed(2)}</p>
          {payment.paymentMethod && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
              <CreditCard className="w-3 h-3" />
              {payment.paymentMethod}
            </p>
          )}
        </div>
      </Card>
    );
  }
);
PaymentHistoryCard.displayName = "PaymentHistoryCard";

export { PaymentHistoryCard };

