/**
 * Quote-Based Payment Modal
 * Displays quote amount, allows tip, and processes payment after job completion
 * Supports partial payment with provider minimum enforcement
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { paymentApi } from "@/lib/api/quote-pricing";
import { ensurePaystackInlineLoaded, paystackService } from "@/lib/api/paystack";
import { initiatePaystack, verifyPaystack, validateKenyanPhone, debugPaymentConfig, validateJobId, validatePaymentAmount, SUPPORTED_CURRENCIES } from "@/lib/api/paystack-edge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface QuoteBasedPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobWithDetails;
  onPaymentSuccess?: () => void;
}

export function QuoteBasedPaymentModal({
  open,
  onOpenChange,
  job,
  onPaymentSuccess,
}: QuoteBasedPaymentModalProps) {
  const { user } = useAuth();
  const [paymentAmount, setPaymentAmount] = useState<number>(job.quote_total || 0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card" | "cash">("mpesa");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [mpesaPhone, setMpesaPhone] = useState<string>("");
  const [partialPaymentReason, setPartialPaymentReason] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string>("");
  const [paymentDetails, setPaymentDetails] = useState<{
    quoteTotal: number;
    minimumPrice: number;
    tipLimit: number;
  } | null>(null);

  // Payment amount options
  const [selectedAmountOption, setSelectedAmountOption] = useState<"full" | "minimum" | "custom">("full");

  // Fetch payment details when modal opens
  useEffect(() => {
    if (open && job.id) {
      fetchPaymentDetails();
      
      // Debug payment config in development
      if (import.meta.env.DEV) {
        debugPaymentConfig();
        // Make debug function available in console
        (window as any).debugPaymentConfig = debugPaymentConfig;
      }
    }
  }, [open, job.id]);

  // Nice-to-have: realtime reconciliation (webhook confirms payment asynchronously)
  useEffect(() => {
    if (!open) return;
    if (!pendingMessage) return;
    if (!job?.id) return;

    const channel = supabase
      .channel(`job-payment-${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${job.id}`,
        },
        (payload: any) => {
          const next = payload?.new as any;
          const paymentStatus = (next?.payment_status as string) || "";
          if (paymentStatus === "completed") {
            setPendingMessage("");
            setSuccess(true);
            setTimeout(() => {
              onPaymentSuccess?.();
              onOpenChange(false);
            }, 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, pendingMessage, job?.id, onOpenChange, onPaymentSuccess]);

  // Preload Paystack inline script when card is selected (better UX)
  useEffect(() => {
    if (!open) return;
    if (paymentMethod !== "card") return;
    ensurePaystackInlineLoaded().catch(() => {
      // Defer error to submit time; keeps UI resilient
    });
  }, [open, paymentMethod]);

  const fetchPaymentDetails = async () => {
    try {
      const details = await paymentApi.getPaymentDetails(job.id);
      setPaymentDetails(details);
      setPaymentAmount(details.quoteTotal);
    } catch (err: any) {
      setError(err.message || "Failed to load payment details");
    }
  };

  // Handle amount option change
  const handleAmountOptionChange = (option: "full" | "minimum" | "custom") => {
    setSelectedAmountOption(option);
    setError("");

    if (!paymentDetails) return;

    if (option === "full") {
      setPaymentAmount(paymentDetails.quoteTotal);
      setPartialPaymentReason("");
    } else if (option === "minimum") {
      setPaymentAmount(paymentDetails.minimumPrice);
      if (paymentDetails.minimumPrice < paymentDetails.quoteTotal) {
        // Prompt for reason if paying less than quote
        setPartialPaymentReason("");
      }
    }
    // For custom, let user enter amount
  };

  // Handle tip selection
  const handleTipChange = (percentage: number) => {
    if (!paymentDetails) return;
    const calculatedTip = Math.round((paymentDetails.quoteTotal * percentage) / 100);
    setTipAmount(Math.min(calculatedTip, paymentDetails.tipLimit));
  };

  // Calculate totals
  const totalPayment = paymentAmount + tipAmount;
  const isPartialPayment = paymentDetails && paymentAmount < paymentDetails.quoteTotal;

  // Validate payment
  const validatePayment = (): boolean => {
    if (!paymentDetails) {
      setError("Payment details not loaded");
      return false;
    }

    if (paymentAmount < paymentDetails.minimumPrice) {
      setError(`Payment must be at least KES ${paymentDetails.minimumPrice.toLocaleString()} (provider minimum)`);
      return false;
    }

    if (tipAmount > paymentDetails.tipLimit) {
      setError(`Tip cannot exceed KES ${paymentDetails.tipLimit.toLocaleString()} (50% of quote)`);
      return false;
    }

    if (isPartialPayment && !partialPaymentReason.trim()) {
      setError("Please provide a reason for partial payment");
      return false;
    }

    if (paymentMethod === "mpesa") {
      // For STK Push, phone is required
      if (!mpesaPhone.trim()) {
        setError("Please enter your M-Pesa phone number");
        return false;
      }
      // Validate phone format using shared validation function
      const validated = validateKenyanPhone(mpesaPhone);
      if (!validated) {
        setError("Invalid phone number format. Use format: 07XXXXXXXX or 254XXXXXXXXX");
        return false;
      }
      // Check phone length (Kenyan phone should be 10 digits for local or 12 for international)
      const phoneDigits = validated.replace(/\D/g, '');
      if (phoneDigits.length !== 12) {
        setError("Invalid phone number length. Should be 10 digits (07XXXXXXXX) or 12 digits with country code (254XXXXXXXXX)");
        return false;
      }
      // Store normalized phone for use in API call
      // (validation ensures it's in 254XXXXXXXXX format)
    }

    return true;
  };

  // Handle payment submission
  const handleSubmitPayment = async () => {
    if (!validatePayment()) return;

    // Validate job ID format using helper
    const jobIdValidation = validateJobId(job.id);
    if (!jobIdValidation.valid) {
      setError(jobIdValidation.error || "Invalid job ID. Please refresh the page and try again.");
      return;
    }

    // Validate payment amount using helper
    const amountValidation = validatePaymentAmount(totalPayment);
    if (!amountValidation.valid) {
      setError(amountValidation.error || "Invalid payment amount. Please check your payment details.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setPendingMessage("");

    try {
      // M-Pesa STK Push payments
      if (paymentMethod === "mpesa") {
        console.log('[QuoteBasedPaymentModal] Initiating M-Pesa payment for job:', job.id);
        console.log('[QuoteBasedPaymentModal] Phone input:', mpesaPhone);
        console.log('[QuoteBasedPaymentModal] Total amount:', totalPayment);

        // Normalize phone number before sending (ensure it's in correct format)
        const normalizedPhone = validateKenyanPhone(mpesaPhone);
        if (!normalizedPhone) {
          console.error('[QuoteBasedPaymentModal] Phone validation failed for:', mpesaPhone);
          setError("Invalid phone number format. Please check and try again.");
          setIsProcessing(false);
          return;
        }

        console.log('[QuoteBasedPaymentModal] Normalized phone:', normalizedPhone);

        // Prepare phone for edge: use E.164 with leading + to align with common expectations
        const phoneForEdge = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

        // Initiate STK Push via Edge Function
        // Send phoneForEdge - edge function will normalize to 254XXXXXXXXX if needed
        const init = await initiatePaystack({
          jobId: job.id,
          amountMajor: totalPayment,
          currency: 'KES', // Explicitly set to KES for M-Pesa
          phone: phoneForEdge, // Use normalized edge-friendly phone number
        });

        // DEV MOCK: simulate completion for development if enabled
        const isDevMock = (init as any)?.devMock === true;
        if (isDevMock) {
          setPendingMessage("Dev mock: STK Push simulated. Completing payment in dev environment.");
          setIsProcessing(false);
          setTimeout(() => {
            setSuccess(true);
            onPaymentSuccess?.();
            onOpenChange(false);
          }, 1500);
          return;
        }

        // Show pending message - webhook will update status
        setPendingMessage(
          `STK Push sent to ${mpesaPhone}. Please check your phone and enter your M-Pesa PIN to complete payment. We'll update your job status once payment is confirmed.`
        );
        
        // Set up realtime subscription to detect payment completion
        const channel = supabase
          .channel(`job-payment-${job.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "jobs",
              filter: `id=eq.${job.id}`,
            },
            (payload: any) => {
              const updatedJob = payload?.new as any;
              if (updatedJob?.payment_status === "completed") {
                setPendingMessage("");
                setSuccess(true);
                setTimeout(() => {
                  onPaymentSuccess?.();
                  onOpenChange(false);
                }, 2000);
              }
            }
          )
          .subscribe();

        // Cleanup subscription after 5 minutes or on close
        setTimeout(() => {
          supabase.removeChannel(channel);
        }, 5 * 60 * 1000);

        setIsProcessing(false);
        return;
      }

      // Card payments: Paystack inline -> verify -> then update job via RPC
      if (paymentMethod === "card") {
        if (!user?.email) {
          throw new Error("Missing email for Paystack checkout");
        }

        // Validate currency for card payment
        const validCurrencies = ["NGN", "GHS", "ZAR", "USD", "KES"];
        const currency = (import.meta.env.VITE_PAYSTACK_CURRENCY as string) || "NGN";
        if (!validCurrencies.includes(currency)) {
          throw new Error(`Invalid currency configuration: ${currency}`);
        }

        // Initiate Paystack (Edge Function returns reference)
        const init = await initiatePaystack({
          jobId: job.id,
          amountMajor: totalPayment,
          currency: currency as any,
        });

        const reference = init.reference;

        // Open Paystack modal
        let popupResp;
        try {
          await ensurePaystackInlineLoaded();
          popupResp = await paystackService.initializePopup({
            email: user.email,
            amount: Math.round(totalPayment * 100), // Paystack expects minor units
            reference,
            currency: (import.meta.env.VITE_PAYSTACK_CURRENCY as string) || "NGN",
            metadata: {
              job_id: job.id,
              payment_type: "final_balance",
            },
            channels: ["card", "bank_transfer", "ussd", "mobile_money"],
          } as any);
        } catch (popupErr: any) {
          // User closed/cancelled the modal
          setPendingMessage("Payment window was closed. If you completed payment, it will be confirmed shortly.");
          return;
        }

        // Verify transaction server-side
        try {
          const verify = await verifyPaystack(popupResp.reference || reference);
          const paystackStatus =
            verify?.data?.status ||
            verify?.paystack?.data?.status ||
            verify?.paystack?.status ||
            verify?.status;
          const ok = Boolean(verify?.ok ?? verify?.status ?? (paystackStatus === "success"));

          if (ok && paystackStatus === "success") {
            // Update job record (quote-based payment fields) via existing RPC path
            await paymentApi.submitPayment({
              jobId: job.id,
              paymentAmount,
              paymentTip: tipAmount,
              paymentMethod: "card",
              paymentReference: popupResp.reference || reference,
              partialPaymentReason: isPartialPayment ? partialPaymentReason : undefined,
            });

            setSuccess(true);
            setTimeout(() => {
              onPaymentSuccess?.();
              onOpenChange(false);
            }, 2000);
            return;
          }

          // If not confirmed, keep pending (webhook will reconcile)
          setPendingMessage(
            "Payment processed but awaiting confirmation. We'll update your job as soon as the webhook confirms it."
          );
          return;
        } catch (verifyErr: any) {
          // Verification failed client-side; webhook may still reconcile
          setPendingMessage(
            "Verification failed. If you were charged, the webhook will reconcile your payment shortly."
          );
          return;
        } finally {
          setIsProcessing(false);
        }
      }

      const result = await paymentApi.submitPayment({
        jobId: job.id,
        paymentAmount,
        paymentTip: tipAmount,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        partialPaymentReason: isPartialPayment ? partialPaymentReason : undefined,
      });

      setSuccess(true);

      // Show success and handle dispute flag
      if (result.disputeFlagged) {
        setTimeout(() => {
          alert(
            "Payment submitted. However, since you paid less than the agreed amount, " +
            "this job has been flagged for review. The provider has been notified."
          );
          onPaymentSuccess?.();
          onOpenChange(false);
        }, 2000);
      } else {
        setTimeout(() => {
          onPaymentSuccess?.();
          onOpenChange(false);
        }, 2000);
      }
    } catch (err: any) {
      console.error("[QuoteBasedPaymentModal] Payment error:", err);
      
      // Provide more specific error messages
      let errorMessage = err.message || "Failed to process payment";
      
      // If the error already contains detailed troubleshooting steps, use it as-is
      if (errorMessage.includes("Unable to connect to payment service") && errorMessage.includes("Please check:")) {
        // Keep the detailed error message from paystack-edge.ts
        setError(errorMessage);
        return;
      }
      
      // Check for common issues
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("Network error") || errorMessage.includes("Unable to connect")) {
        errorMessage = 
          "Unable to connect to payment service. Please check:\n" +
          "• Your internet connection\n" +
          "• Edge Functions are deployed\n" +
          "• Try again in a moment\n\n" +
          "💡 Tip: Open browser console and run: debugPaymentConfig()";
      } else if (errorMessage.includes("Not authenticated") || errorMessage.includes("Session expired")) {
        errorMessage = "Your session has expired. Please refresh the page and try again.";
      } else if (errorMessage.includes("Invalid phone number")) {
        errorMessage = "Please enter a valid M-Pesa phone number (e.g., 0741417355 or 254741417355)";
      } else if (errorMessage.includes("Edge Function") || errorMessage.includes("404")) {
        errorMessage = 
          "Payment service not available. Please contact support or try again later.\n" +
          "Error: " + errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset state when modal closes
  const handleClose = (open: boolean) => {
    if (!open) {
      setError("");
      setSuccess(false);
      setPendingMessage("");
      setPartialPaymentReason("");
      setPaymentReference("");
      setMpesaPhone("");
      setSelectedAmountOption("full");
      if (paymentDetails) {
        setPaymentAmount(paymentDetails.quoteTotal);
      }
      setTipAmount(0);
    }
    onOpenChange(open);
  };

  if (!paymentDetails) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="text-lg">Complete Payment</DialogTitle>
          <DialogDescription className="text-sm">
            Review the agreed quote and complete payment via M-Pesa
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-3 sm:space-y-4">
          {/* Quote Summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 sm:pt-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-muted-foreground">Agreed Quote</span>
                  <span className="text-xl sm:text-2xl font-bold">KES {paymentDetails.quoteTotal.toLocaleString()}</span>
                </div>
                {job.quote_labor && job.quote_materials && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Labor</span>
                      <span>KES {job.quote_labor.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Materials</span>
                      <span>KES {job.quote_materials.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Amount Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Payment Amount</Label>
            <RadioGroup value={selectedAmountOption} onValueChange={handleAmountOptionChange as any} className="space-y-2">
              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 -mx-2">
                <RadioGroupItem value="full" id="full" className="mt-0.5" />
                <Label htmlFor="full" className="font-normal cursor-pointer flex-1 text-sm">
                  Full Amount (KES {paymentDetails.quoteTotal.toLocaleString()})
                </Label>
              </div>
              
              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 -mx-2">
                <RadioGroupItem value="minimum" id="minimum" className="mt-0.5" />
                <Label htmlFor="minimum" className="font-normal cursor-pointer flex-1 text-sm">
                  <span>Provider Minimum (KES {paymentDetails.minimumPrice.toLocaleString()})</span>
                  {paymentDetails.minimumPrice < paymentDetails.quoteTotal && (
                    <Badge variant="warning" className="ml-1 text-xs">Partial</Badge>
                  )}
                </Label>
              </div>

              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 -mx-2">
                <RadioGroupItem value="custom" id="custom" className="mt-0.5" />
                <Label htmlFor="custom" className="font-normal cursor-pointer flex-1 text-sm">
                  Custom Amount
                </Label>
              </div>
            </RadioGroup>

            {selectedAmountOption === "custom" && (
              <div className="pl-6 space-y-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={paymentDetails.minimumPrice}
                  max={paymentDetails.quoteTotal * 2}
                  value={paymentAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setPaymentAmount(value);
                  }}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: KES {paymentDetails.minimumPrice.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Partial Payment Reason */}
          {isPartialPayment && (
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-sm">Reason for Partial Payment *</Label>
              <Input
                id="reason"
                placeholder="e.g., Quality issues, incomplete work..."
                value={partialPaymentReason}
                onChange={(e) => setPartialPaymentReason(e.target.value)}
                maxLength={500}
                className="h-11"
              />
              <Alert variant="warning" className="py-2 mt-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  Paying less than agreed will flag this job for dispute review.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Tip Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Tip (Optional)</Label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant={tipAmount === 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setTipAmount(0)}
                className="h-10 text-xs sm:text-sm px-1 sm:px-3"
              >
                No Tip
              </Button>
              <Button
                type="button"
                variant={tipAmount === Math.round(paymentDetails.quoteTotal * 0.1) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTipChange(10)}
                className="h-10 text-xs sm:text-sm px-1 sm:px-3"
              >
                10%
              </Button>
              <Button
                type="button"
                variant={tipAmount === Math.round(paymentDetails.quoteTotal * 0.15) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTipChange(15)}
                className="h-10 text-xs sm:text-sm px-1 sm:px-3"
              >
                15%
              </Button>
              <Button
                type="button"
                variant={tipAmount === Math.round(paymentDetails.quoteTotal * 0.20) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTipChange(20)}
                className="h-10 text-xs sm:text-sm px-1 sm:px-3"
              >
                20%
              </Button>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Custom tip amount"
              value={tipAmount || ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setTipAmount(Math.min(value, paymentDetails.tipLimit));
              }}
              className="h-11"
            />
            {tipAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                Tip amount: KES {tipAmount.toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod as any} className="flex flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mpesa" id="mpesa" />
                <Label htmlFor="mpesa" className="font-normal cursor-pointer text-sm">M-Pesa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="font-normal cursor-pointer text-sm">Card</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="font-normal cursor-pointer text-sm">Cash</Label>
              </div>
            </RadioGroup>
          </div>

          {/* M-Pesa Phone Number (STK Push) */}
          {paymentMethod === "mpesa" && (
            <div className="space-y-1.5">
              <Label htmlFor="mpesa-phone" className="text-sm">M-Pesa Phone Number *</Label>
              <Input
                id="mpesa-phone"
                type="tel"
                placeholder="07XXXXXXXX or 254XXXXXXXXX"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                maxLength={15}
                className="h-11"
              />
              <Alert className="py-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  Enter your M-Pesa phone number. After clicking "Pay", you'll receive an STK Push on your phone. Enter your PIN to complete the payment.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Cash Payment Reference (for manual entry) */}
          {paymentMethod === "cash" && (
            <div className="space-y-1.5">
              <Label htmlFor="cash-reference" className="text-sm">Payment Reference (Optional)</Label>
              <Input
                id="cash-reference"
                placeholder="e.g., Receipt number or transaction ID"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                maxLength={50}
                className="h-11"
              />
              <Alert className="py-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  If you have a receipt or transaction reference, you can enter it here for record keeping.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Total */}
          <Separator />
          <div className="flex justify-between items-center py-2">
            <span className="font-semibold">Total Payment</span>
            <span className="text-xl sm:text-2xl font-bold text-primary">KES {totalPayment.toLocaleString()}</span>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm">Payment processed successfully!</AlertDescription>
            </Alert>
          )}

          {pendingMessage && !success && (
            <Alert className="py-2">
              <Info className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm">{pendingMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isProcessing || success}
            className="w-full sm:w-auto h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitPayment}
            disabled={isProcessing || success}
            className="w-full sm:w-auto h-11"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay KES ${totalPayment.toLocaleString()}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

