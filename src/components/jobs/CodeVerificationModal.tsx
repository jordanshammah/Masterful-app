/**
 * CodeVerificationModal Component
 * Secure modal for entering auth codes
 * Never stores codes in localStorage or logs them
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CodeVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  onSubmit: (code: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export const CodeVerificationModal = ({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder = "Enter code",
  onSubmit,
  isLoading = false,
  error,
}: CodeVerificationModalProps) => {
  const [code, setCode] = useState("");

  // Reset code when modal closes
  useEffect(() => {
    if (!open) {
      setCode("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:53',message:'handleSubmit called',data:{codeLength:code.length,codeTrimmed:code.trim().length,isLoading,hasCode:!!code.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    e.preventDefault();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:56',message:'After preventDefault, checking conditions',data:{codeTrimmed:code.trim(),willReturn:!code.trim() || isLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!code.trim() || isLoading) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:59',message:'Early return triggered',data:{reason:!code.trim() ? 'empty_code' : 'isLoading'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return;
    }

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:66',message:'Calling onSubmit prop',data:{code:code.trim(),onSubmitType:typeof onSubmit},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      await onSubmit(code.trim());
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:68',message:'onSubmit completed successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // Don't clear code here - let parent handle success/error
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:71',message:'onSubmit threw error',data:{errorMessage:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Error handled by parent via error prop
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#050505] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-white/60">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="code" className="text-white/70">
              {label}
            </Label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={placeholder}
              className="bg-black border-white/10 text-white font-mono text-center text-lg mt-1"
              autoFocus
              disabled={isLoading}
              maxLength={20}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/10 text-white hover:bg-white/10"
              onClick={() => {
                setCode("");
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
              disabled={!code.trim() || isLoading}
              onClick={(e) => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/df23b15e-07a0-4ff3-8a72-f38f11d35870',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CodeVerificationModal.tsx:113',message:'Verify button clicked',data:{codeLength:code.length,codeTrimmed:code.trim().length,isLoading,disabled:!code.trim() || isLoading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};






