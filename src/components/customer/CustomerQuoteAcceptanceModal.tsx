/**
 * Customer Quote Acceptance Modal
 * Allows customer to review and accept/reject provider's quote
 * Generates start codes upon acceptance
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertTriangle, FileText, Calculator, Info } from "lucide-react";
import { quotesApi, handshakeApi } from "@/lib/api/quote-pricing";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface CustomerQuoteAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobWithDetails;
  onQuoteResponded?: () => void;
}

export function CustomerQuoteAcceptanceModal({
  open,
  onOpenChange,
  job,
  onQuoteResponded,
}: CustomerQuoteAcceptanceModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<"accepted" | "rejected" | null>(null);
  const [startCode, setStartCode] = useState<string>("");
  const [quoteStatus, setQuoteStatus] = useState<any>(null);

  // Fetch quote status when modal opens
  useEffect(() => {
    if (open && job.id) {
      fetchQuoteStatus();
    }
  }, [open, job.id]);

  const fetchQuoteStatus = async () => {
    try {
      const status = await quotesApi.getQuoteStatus(job.id);
      setQuoteStatus(status);
    } catch (err: any) {
      setError(err.message || "Failed to load quote details");
    }
  };

  // Handle quote acceptance
  const handleAcceptQuote = async () => {
    setIsProcessing(true);
    setError("");

    try {
      // Accept the quote
      await quotesApi.acceptQuote({
        jobId: job.id,
        accepted: true,
      });

      // Generate start code
      const codeResult = await handshakeApi.generateStartCode(job.id);
      setStartCode(codeResult.code);
      setSuccess("accepted");

      setTimeout(() => {
        onQuoteResponded?.();
      }, 5000); // Give user time to save the code
    } catch (err: any) {
      setError(err.message || "Failed to accept quote");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle quote rejection
  const handleRejectQuote = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reject this quote? The job will be cancelled."
    );

    if (!confirmed) return;

    setIsProcessing(true);
    setError("");

    try {
      await quotesApi.acceptQuote({
        jobId: job.id,
        accepted: false,
      });

      setSuccess("rejected");

      setTimeout(() => {
        onQuoteResponded?.();
        onOpenChange(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reject quote");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset state when modal closes
  const handleClose = (open: boolean) => {
    if (!open) {
      setError("");
      setSuccess(null);
      setStartCode("");
    }
    onOpenChange(open);
  };

  if (!quoteStatus) {
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

  // Show success screen with start code
  if (success === "accepted" && startCode) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Quote Accepted!
            </DialogTitle>
            <DialogDescription className="text-sm">
              Your start code has been generated
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-4">
            <Alert className="bg-green-50 text-green-900 border-green-200 py-2">
              <Info className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm">
                Quote accepted successfully! The provider has been notified.
              </AlertDescription>
            </Alert>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 sm:pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Your Start Code</p>
                <p className="text-3xl sm:text-4xl font-mono font-bold text-primary tracking-wider">
                  {startCode}
                </p>
                <p className="text-xs text-muted-foreground mt-3 sm:mt-4">
                  Save this code securely. Share it with the provider when they arrive to authorize job start.
                </p>
              </CardContent>
            </Card>

            <Alert className="py-2">
              <Info className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm">
                <strong>Important:</strong> Do not share this code until the provider arrives and you're ready to begin work.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background">
            <Button onClick={() => handleClose(false)} className="w-full h-11">
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show rejection success
  if (success === "rejected") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">Quote Rejected</DialogTitle>
          </DialogHeader>

          <Alert className="bg-yellow-50 text-yellow-900 border-yellow-200 py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-sm">
              You have rejected this quote. The job has been cancelled and the provider has been notified.
            </AlertDescription>
          </Alert>

          <DialogFooter className="mt-4">
            <Button onClick={() => handleClose(false)} className="w-full sm:w-auto h-11">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show quote details and acceptance/rejection options
  const quote = quoteStatus.quote;
  if (!quote) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-sm">No quote has been submitted yet.</AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="text-lg">Review Provider's Quote</DialogTitle>
          <DialogDescription className="text-sm">
            Review the quote details and decide whether to accept or reject
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-3 sm:space-y-4">
          {/* Provider Info */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 sm:pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Service</span>
                  <span className="font-medium text-right truncate">
                    {job.service_category?.name || "Service"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Location</span>
                  <span className="font-medium text-right truncate">{job.address}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Submitted</span>
                  <span className="font-medium text-right">
                    {new Date(quote.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quote Breakdown */}
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Quote Breakdown</h3>
                </div>

                {quote.labor && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Labor</span>
                    <span className="font-medium">KES {quote.labor.toLocaleString()}</span>
                  </div>
                )}

                {quote.materials && quote.materials > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Materials</span>
                    <span className="font-medium">KES {quote.materials.toLocaleString()}</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">Total Quote</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    KES {quote.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Breakdown */}
          {quote.breakdown && (
            <Card>
              <CardContent className="p-3 sm:pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Detailed Breakdown</h3>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {quote.breakdown}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Important Info */}
          <Alert className="py-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm">
              By accepting this quote, you agree to pay KES {quote.total.toLocaleString()} upon job completion.
              You'll receive a start code to authorize the provider to begin work.
            </AlertDescription>
          </Alert>

          {/* Payment Info */}
          <Alert className="py-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm">
              <strong>No upfront payment required.</strong> Pay after the job is completed. Payment via M-Pesa.
            </AlertDescription>
          </Alert>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={handleRejectQuote}
            disabled={isProcessing}
            className="w-full sm:w-auto h-11"
          >
            Reject Quote
          </Button>
          <Button
            onClick={handleAcceptQuote}
            disabled={isProcessing}
            className="w-full sm:w-auto h-11 bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Accept (KES ${quote.total.toLocaleString()})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

