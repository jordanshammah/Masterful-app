/**
 * Handshake Code Verification Components
 * Start code (customer to provider) and End code (provider to customer)
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, Key, Info } from "lucide-react";
import { handshakeApi } from "@/lib/api/quote-pricing";

// ============================================================================
// START CODE VERIFICATION (Provider enters customer's code)
// ============================================================================

interface StartCodeVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onCodeVerified?: () => void;
}

export function StartCodeVerificationModal({
  open,
  onOpenChange,
  jobId,
  onCodeVerified,
}: StartCodeVerificationModalProps) {
  const [code, setCode] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the start code");
      return;
    }

    if (code.length !== 6) {
      setError("Start code must be 6 characters");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await handshakeApi.verifyStartCode(jobId, code);

      if (isValid) {
        setSuccess(true);
        setTimeout(() => {
          onCodeVerified?.();
          onOpenChange(false);
        }, 2000);
      } else {
        setError("Invalid start code. Please check and try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify start code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setCode("");
      setError("");
      setSuccess(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0 gap-0"
        onInteractOutside={(e) => {
          // Allow closing on backdrop click
          handleClose(false);
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Enter Start Code
          </DialogTitle>
          <DialogDescription className="text-sm">
            Enter the 6-character code provided by the customer to begin work
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-4">
          <Alert className="py-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm">
              The customer will share this code with you when you arrive. 
              This confirms they're ready for you to start work.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm">Start Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="ABC123"
              className="text-center text-2xl sm:text-3xl font-mono tracking-wider h-14"
              disabled={isVerifying || success}
            />
          </div>

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
                Start code verified! You can now begin work.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isVerifying || success}
            className="w-full sm:w-auto h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerifyCode}
            disabled={isVerifying || success || code.length !== 6}
            className="w-full sm:w-auto h-11"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Start Job"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// END CODE GENERATION (Provider generates code after completion)
// ============================================================================

interface EndCodeGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onCodeGenerated?: (code: string) => void;
}

export function EndCodeGenerationModal({
  open,
  onOpenChange,
  jobId,
  onCodeGenerated,
}: EndCodeGenerationModalProps) {
  const [endCode, setEndCode] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>("");

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const result = await handshakeApi.generateEndCode(jobId);
      setEndCode(result.code);
      onCodeGenerated?.(result.code);
    } catch (err: any) {
      setError(err.message || "Failed to generate end code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setEndCode("");
      setError("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0 gap-0"
        onInteractOutside={(e) => {
          // Allow closing on backdrop click
          handleClose(false);
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Generate End Code
          </DialogTitle>
          <DialogDescription className="text-sm">
            Generate a completion code to give to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-4">
          {!endCode ? (
            <>
              <Alert className="py-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  After completing the job, generate this code and share it with the customer. 
                  They'll enter it to unlock the payment process.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerateCode}
                disabled={isGenerating}
                className="w-full h-11"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate End Code"
                )}
              </Button>
            </>
          ) : (
            <>
              <Alert className="bg-green-50 text-green-900 border-green-200 py-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-sm">
                  End code generated successfully!
                </AlertDescription>
              </Alert>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 sm:pt-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">End Code</p>
                  <p className="text-3xl sm:text-4xl font-mono font-bold text-primary tracking-wider">
                    {endCode}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 sm:mt-4">
                    Share this code with the customer to complete the job
                  </p>
                </CardContent>
              </Card>

              <Alert className="py-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <AlertDescription className="text-xs sm:text-sm">
                  <strong>Important:</strong> Keep this code safe until you give it to the customer. 
                  They'll need it to verify job completion and make payment.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background">
          <Button 
            onClick={() => handleClose(false)} 
            className="w-full h-11 text-base"
            variant={endCode ? "default" : "outline"}
          >
            {endCode ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// END CODE VERIFICATION (Customer enters provider's code)
// ============================================================================

interface EndCodeVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onCodeVerified?: () => void;
}

export function EndCodeVerificationModal({
  open,
  onOpenChange,
  jobId,
  onCodeVerified,
}: EndCodeVerificationModalProps) {
  const [code, setCode] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the end code");
      return;
    }

    if (code.length !== 6) {
      setError("End code must be 6 characters");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await handshakeApi.verifyEndCode(jobId, code);

      if (isValid) {
        setSuccess(true);
        setTimeout(() => {
          onCodeVerified?.();
          onOpenChange(false);
        }, 2000);
      } else {
        setError("Invalid end code. Please check and try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify end code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setCode("");
      setError("");
      setSuccess(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0 gap-0"
        onInteractOutside={(e) => {
          // Allow closing on backdrop click
          handleClose(false);
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Enter Completion Code
          </DialogTitle>
          <DialogDescription className="text-sm">
            Enter the 6-character code provided by the provider after job completion
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 space-y-4">
          <Alert className="py-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm">
              The provider will give you this code after completing the job. 
              Entering it confirms you're satisfied with the work and unlocks the payment process.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm">End Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="XYZ789"
              className="text-center text-2xl sm:text-3xl font-mono tracking-wider h-14"
              disabled={isVerifying || success}
            />
          </div>

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
                Job completion verified! You can now proceed to payment.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isVerifying || success}
            className="w-full sm:w-auto h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerifyCode}
            disabled={isVerifying || success || code.length !== 6}
            className="w-full sm:w-auto h-11"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Pay"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

