/**
 * BookingStatusPanel - State-Driven UI Controller
 * 
 * RULES:
 * 1. Backend state is the ONLY source of truth
 * 2. ONE primary action per state
 * 3. No client-side calculations
 * 4. No state assumptions
 * 5. Always re-fetch after mutations
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Key,
  Copy,
  CreditCard,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type BookingState = 
  | "pending"
  | "quote_submitted"
  | "quote_approved"
  | "in_progress"
  | "awaiting_payment"
  | "completed"
  | "cancelled";

interface BookingData {
  id: string;
  state: BookingState;
  provider_name: string;
  scheduled_date?: string;
  quote_amount?: number;
  agreed_amount?: number;
  start_code?: string;
  end_code?: string;
  payment_required?: number;
  breakdown?: {
    labor: number;
    materials: number;
    platform_fee: number;
    provider_payout: number;
  };
}

interface BookingStatusPanelProps {
  booking: BookingData;
  userRole: "customer" | "provider";
  onAction: (action: string, data?: any) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => Promise<void>;
  className?: string;
}

export const BookingStatusPanel = ({
  booking,
  userRole,
  onAction,
  onRefresh,
  className,
}: BookingStatusPanelProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");

  // PATTERN: Execute mutation → Re-fetch → Update UI
  const executeAction = async (action: string, data?: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onAction(action, data);
      
      if (!result.success) {
        setError(result.error || "Action failed");
        return;
      }

      // ALWAYS re-fetch after successful mutation
      await onRefresh();
      setCodeInput(""); // Reset any inputs
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // STATE HEADER - Always visible, read-only
  const renderHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">{booking.provider_name}</h3>
        {renderStateBadge()}
      </div>
      {booking.scheduled_date && (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Clock className="w-4 h-4" />
          {format(new Date(booking.scheduled_date), "PPP 'at' p")}
        </div>
      )}
      {booking.agreed_amount && (
        <div className="text-2xl font-bold text-[#D9743A]">
          KES {booking.agreed_amount.toFixed(2)}
        </div>
      )}
      <Separator className="bg-white/10" />
    </div>
  );

  const renderStateBadge = () => {
    const stateConfig = {
      pending: { label: "Awaiting Quote", icon: Clock, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
      quote_submitted: { label: "Quote Submitted", icon: AlertCircle, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      quote_approved: { label: "Approved - Awaiting Start", icon: CheckCircle2, color: "bg-green-500/10 text-green-400 border-green-500/20" },
      in_progress: { label: "In Progress", icon: Loader2, color: "bg-[#D9743A]/20 text-[#D9743A] border-[#D9743A]/30" },
      awaiting_payment: { label: "Awaiting Payment", icon: CreditCard, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
      completed: { label: "Completed", icon: CheckCircle2, color: "bg-green-500/10 text-green-400 border-green-500/20" },
      cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
    };

    const config = stateConfig[booking.state];
    const Icon = config.icon;

    return (
      <Badge className={cn("border px-3 py-1 flex items-center gap-1", config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  // PRIMARY ACTION PANEL - Changes based on state
  const renderPrimaryPanel = () => {
    // STATE: pending
    if (booking.state === "pending") {
      return (
        <div className="bg-[#1E1E1E] rounded-xl p-4 text-center">
          <p className="text-white/70 text-sm">
            Waiting for provider quote.
            <br />
            You will pay nothing until work is completed.
          </p>
        </div>
      );
    }

    // STATE: quote_submitted (Customer only)
    if (booking.state === "quote_submitted" && userRole === "customer") {
      return (
        <div className="space-y-4">
          <div className="bg-[#1E1E1E] rounded-xl p-4">
            <p className="text-white/50 text-xs mb-2">Provider Quote</p>
            <div className="text-3xl font-bold text-white">
              KES {booking.quote_amount?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => executeAction("approve_quote")}
              disabled={isLoading}
              className="w-full h-12 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
            >
              {isLoading ? "Processing..." : "Approve Quote"}
            </Button>
            <Button
              onClick={() => executeAction("cancel_booking")}
              disabled={isLoading}
              variant="outline"
              className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10"
            >
              Cancel Booking
            </Button>
          </div>
        </div>
      );
    }

    // STATE: quote_approved - START CODE
    if (booking.state === "quote_approved") {
      if (userRole === "customer") {
        // Customer sees their START CODE
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#D9743A]/20 to-[#C25A2C]/10 border border-[#D9743A]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#D9743A] mb-3">
                <Key className="w-5 h-5" />
                <span className="font-semibold">Your Start Code</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Input
                  value={booking.start_code || ""}
                  readOnly
                  className="bg-black/50 border-white/10 text-white font-mono text-center text-2xl font-bold tracking-wider"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (booking.start_code) {
                      navigator.clipboard.writeText(booking.start_code);
                    }
                  }}
                  className="border-white/10 text-white hover:bg-white/10 flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-white/60 text-center">
                Give this code to the provider when they arrive.
                <br />
                The job starts only after the provider enters it.
              </p>
            </div>
          </div>
        );
      } else {
        // Provider enters START CODE
        return (
          <div className="space-y-4">
            <div className="bg-[#1E1E1E] rounded-xl p-4">
              <label className="text-white/70 text-sm mb-2 block">
                Enter Customer Start Code
              </label>
              <Input
                type="text"
                maxLength={6}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="bg-black border-white/10 text-white font-mono text-center text-2xl tracking-wider mb-3"
                disabled={isLoading}
              />
              <Button
                onClick={() => executeAction("start_job", { code: codeInput })}
                disabled={isLoading || codeInput.length !== 6}
                className="w-full h-12 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
              >
                {isLoading ? "Verifying..." : "Start Job"}
              </Button>
            </div>
          </div>
        );
      }
    }

    // STATE: in_progress
    if (booking.state === "in_progress") {
      if (userRole === "provider") {
        // Provider sees END CODE
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-400 mb-3">
                <Key className="w-5 h-5" />
                <span className="font-semibold">Your Completion Code</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Input
                  value={booking.end_code || ""}
                  readOnly
                  className="bg-black/50 border-white/10 text-white font-mono text-center text-2xl font-bold tracking-wider"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (booking.end_code) {
                      navigator.clipboard.writeText(booking.end_code);
                    }
                  }}
                  className="border-white/10 text-white hover:bg-white/10 flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-white/60 text-center">
                Give this code to the customer once work is complete.
              </p>
            </div>
          </div>
        );
      } else {
        // Customer sees status only - NO ACTIONS
        return (
          <div className="bg-[#1E1E1E] rounded-xl p-4 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-[#D9743A] animate-spin" />
            <p className="text-white/70 text-sm">
              Job in progress
              <br />
              <span className="text-xs text-white/50">
                You'll be notified when the provider completes the work
              </span>
            </p>
          </div>
        );
      }
    }

    // STATE: awaiting_payment (Customer only)
    if (booking.state === "awaiting_payment" && userRole === "customer") {
      return (
        <div className="space-y-4">
          {booking.breakdown && (
            <div className="bg-[#1E1E1E] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Labor</span>
                <span className="text-white">KES {booking.breakdown.labor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Materials</span>
                <span className="text-white">KES {booking.breakdown.materials.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Platform Fee (15%)</span>
                <span className="text-white/60">KES {booking.breakdown.platform_fee.toFixed(2)}</span>
              </div>
              <Separator className="bg-white/10 my-2" />
              <div className="flex justify-between font-semibold">
                <span className="text-white">Total</span>
                <span className="text-[#D9743A] text-lg">
                  KES {booking.payment_required?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          )}
          <Button
            onClick={() => executeAction("initiate_payment")}
            disabled={isLoading}
            className="w-full h-14 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold text-lg"
          >
            {isLoading ? "Processing..." : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay via M-Pesa
              </>
            )}
          </Button>
        </div>
      );
    }

    // STATE: completed
    if (booking.state === "completed") {
      return (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
          <p className="text-white font-semibold mb-1">Job Completed</p>
          <p className="text-white/60 text-sm">Thank you for using Masterful</p>
        </div>
      );
    }

    // STATE: cancelled
    if (booking.state === "cancelled") {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <XCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
          <p className="text-white font-semibold mb-1">Booking Cancelled</p>
        </div>
      );
    }

    // FALLBACK: Unknown state
    return (
      <div className="bg-[#1E1E1E] rounded-xl p-4 text-center">
        <p className="text-white/50 text-sm">Loading...</p>
      </div>
    );
  };

  return (
    <Card className={cn("bg-[#121212] border-white/10 p-5 space-y-6", className)}>
      {renderHeader()}
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Primary Action Panel */}
      {renderPrimaryPanel()}
    </Card>
  );
};

export default BookingStatusPanel;


