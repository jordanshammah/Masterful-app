/**
 * Provider Quote Submission Modal
 * Allows provider to submit on-site quote after assessment
 * Quote is locked after submission
 */

import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertTriangle, Calculator, Info } from "lucide-react";
import { quotesApi } from "@/lib/api/quote-pricing";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface ProviderQuoteSubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobWithDetails;
  onQuoteSubmitted?: () => void;
}

export function ProviderQuoteSubmissionModal({
  open,
  onOpenChange,
  job,
  onQuoteSubmitted,
}: ProviderQuoteSubmissionModalProps) {
  const [quoteLabor, setQuoteLabor] = useState<number>(0);
  const [quoteMaterials, setQuoteMaterials] = useState<number>(0);
  const [quoteBreakdown, setQuoteBreakdown] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  // Calculate total
  const quoteTotal = quoteLabor + quoteMaterials;

  // Validate quote
  const validateQuote = (): boolean => {
    if (quoteLabor <= 0) {
      setError("Labor cost must be greater than 0");
      return false;
    }

    if (quoteMaterials < 0) {
      setError("Materials cost cannot be negative");
      return false;
    }

    if (quoteTotal <= 0) {
      setError("Total quote must be greater than 0");
      return false;
    }

    if (quoteTotal > 1000000) {
      setError("Quote amount seems unusually high. Please verify.");
      return false;
    }

    return true;
  };

  // Handle quote submission
  const handleSubmitQuote = async () => {
    if (!validateQuote()) return;

    setIsProcessing(true);
    setError("");

    try {
      await quotesApi.submitQuote({
        jobId: job.id,
        quoteTotal,
        quoteLabor,
        quoteMaterials: quoteMaterials > 0 ? quoteMaterials : undefined,
        quoteBreakdown: quoteBreakdown.trim() || undefined,
      });

      setSuccess(true);

      setTimeout(() => {
        onQuoteSubmitted?.();
        onOpenChange(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit quote");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset state when modal closes
  const handleClose = (open: boolean) => {
    if (!open) {
      setQuoteLabor(0);
      setQuoteMaterials(0);
      setQuoteBreakdown("");
      setError("");
      setSuccess(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="text-lg">Submit Quote</DialogTitle>
          <DialogDescription className="text-sm">
            Provide a detailed quote for this job. Once submitted, the quote cannot be edited.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-4">
          {/* Job Details */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 sm:pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Customer</span>
                  <span className="font-medium text-right truncate">
                    {job.customer?.profiles?.full_name || "Unknown"}
                  </span>
                </div>
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
              </div>
            </CardContent>
          </Card>

          {/* Labor Cost */}
          <div className="space-y-1.5">
            <Label htmlFor="labor" className="text-sm">Labor Cost (KES) *</Label>
            <Input
              id="labor"
              type="number"
              inputMode="numeric"
              min="0"
              step="50"
              value={quoteLabor || ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setQuoteLabor(value);
                setError("");
              }}
              placeholder="e.g., 2500"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Your fee for completing this job
            </p>
          </div>

          {/* Materials Cost */}
          <div className="space-y-1.5">
            <Label htmlFor="materials" className="text-sm">Materials Cost (KES)</Label>
            <Input
              id="materials"
              type="number"
              inputMode="numeric"
              min="0"
              step="50"
              value={quoteMaterials || ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setQuoteMaterials(value);
                setError("");
              }}
              placeholder="e.g., 500"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Cost of materials needed (optional)
            </p>
          </div>

          {/* Breakdown (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="breakdown" className="text-sm">Detailed Breakdown (Optional)</Label>
            <Textarea
              id="breakdown"
              value={quoteBreakdown}
              onChange={(e) => setQuoteBreakdown(e.target.value)}
              placeholder="e.g., Replace 3 pipes (KES 300), Fix leak (KES 1500)..."
              rows={3}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Provide a detailed breakdown to build trust
            </p>
          </div>

          {/* Total Calculation */}
          <Separator />
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 sm:pt-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Labor</span>
                  <span className="font-medium">KES {quoteLabor.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Materials</span>
                  <span className="font-medium">KES {quoteMaterials.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold flex items-center gap-1.5 text-sm">
                    <Calculator className="h-4 w-4" />
                    Total Quote
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    KES {quoteTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Info */}
          <Alert className="py-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm">
              <strong>Important:</strong> Once submitted, this quote cannot be edited. 
              The customer will need to accept it before you can start work.
            </AlertDescription>
          </Alert>

          {/* Platform Commission Info */}
          <Alert className="py-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm">
              Platform commission: 15%. You'll receive KES {Math.round(quoteTotal * 0.85).toLocaleString()} 
              (85% of total).
            </AlertDescription>
          </Alert>

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm">
                Quote submitted successfully! Waiting for customer acceptance.
              </AlertDescription>
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
            onClick={handleSubmitQuote}
            disabled={isProcessing || success || quoteTotal <= 0}
            className="w-full sm:w-auto h-11"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              `Submit (KES ${quoteTotal.toLocaleString()})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

