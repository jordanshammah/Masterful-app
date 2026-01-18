/**
 * EstimateRevisionModal Component
 * Allows providers to submit revised estimates before job starts
 * Allows customers to approve or reject estimates
 */

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, FileText, DollarSign, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { JobEstimate } from "@/types/pro-dashboard";

interface EstimateRevisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "view";
  userRole: "provider" | "customer";
  hourlyRate: number;
  existingEstimate?: JobEstimate;
  onSubmitEstimate?: (data: {
    revisedHours: number;
    revisedMaterialsCost: number;
    explanation: string;
  }) => Promise<void>;
  onApproveEstimate?: () => Promise<void>;
  onRejectEstimate?: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export const EstimateRevisionModal = ({
  open,
  onOpenChange,
  mode,
  userRole,
  hourlyRate,
  existingEstimate,
  onSubmitEstimate,
  onApproveEstimate,
  onRejectEstimate,
  isLoading = false,
  error,
}: EstimateRevisionModalProps) => {
  const [revisedHours, setRevisedHours] = useState(
    existingEstimate?.revised_hours || 2
  );
  const [materialsCost, setMaterialsCost] = useState(
    existingEstimate?.revised_materials_cost || 0
  );
  const [explanation, setExplanation] = useState(
    existingEstimate?.explanation || ""
  );

  const calculatedLaborCost = revisedHours * hourlyRate;
  const estimatedTotal = calculatedLaborCost + materialsCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitEstimate || isLoading) return;

    if (revisedHours <= 0 || !explanation.trim()) {
      return;
    }

    await onSubmitEstimate({
      revisedHours,
      revisedMaterialsCost: materialsCost,
      explanation: explanation.trim(),
    });
  };

  // Provider creating estimate
  if (mode === "create" && userRole === "provider") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#050505] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Revise Job Estimate</DialogTitle>
            <DialogDescription className="text-white/60">
              Update the estimate based on on-site assessment
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div>
              <Label htmlFor="hours" className="text-white/70 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Revised Estimated Hours
              </Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                value={revisedHours}
                onChange={(e) => setRevisedHours(parseFloat(e.target.value) || 0)}
                className="bg-black border-white/10 text-white mt-1"
                disabled={isLoading}
              />
              <p className="text-xs text-white/50 mt-1">
                Labor: KES {calculatedLaborCost.toFixed(2)}
              </p>
            </div>

            <div>
              <Label htmlFor="materials" className="text-white/70 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Materials Cost
              </Label>
              <Input
                id="materials"
                type="number"
                step="0.01"
                min="0"
                value={materialsCost}
                onChange={(e) => setMaterialsCost(parseFloat(e.target.value) || 0)}
                className="bg-black border-white/10 text-white mt-1"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="explanation" className="text-white/70 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Explanation
              </Label>
              <Textarea
                id="explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="bg-black border-white/10 text-white mt-1 min-h-[100px]"
                placeholder="Explain why the estimate has changed..."
                disabled={isLoading}
                maxLength={500}
              />
            </div>

            <div className="bg-[#D9743A]/10 border border-[#D9743A]/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold">New Total:</span>
                <span className="text-[#D9743A] font-bold text-xl">
                  KES {estimatedTotal.toFixed(2)}
                </span>
              </div>
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
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                disabled={!explanation.trim() || revisedHours <= 0 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Estimate"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Customer viewing estimate  
  if (mode === "view" && userRole === "customer" && existingEstimate) {
    const laborCost = existingEstimate.revised_hours * hourlyRate;
    const total = laborCost + existingEstimate.revised_materials_cost;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#050505] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Revised Estimate</DialogTitle>
            <DialogDescription className="text-white/60">
              Provider has updated the estimate based on assessment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-black/30 rounded-lg">
                <span className="text-white/70">Hours:</span>
                <span className="text-white font-medium">
                  {existingEstimate.revised_hours.toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between p-3 bg-black/30 rounded-lg">
                <span className="text-white/70">Labor:</span>
                <span className="text-white font-medium">
                  KES {laborCost.toFixed(2)}
                </span>
              </div>
              {existingEstimate.revised_materials_cost > 0 && (
                <div className="flex justify-between p-3 bg-black/30 rounded-lg">
                  <span className="text-white/70">Materials:</span>
                  <span className="text-white font-medium">
                    KES {existingEstimate.revised_materials_cost.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <Label className="text-white/70 mb-2 block">Explanation:</Label>
              <div className="bg-black/30 rounded-lg p-4">
                <p className="text-white text-sm">{existingEstimate.explanation}</p>
              </div>
            </div>

            <div className="bg-[#D9743A]/10 border border-[#D9743A]/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold text-lg">Total:</span>
                <span className="text-[#D9743A] font-bold text-2xl">
                  KES {total.toFixed(2)}
                </span>
              </div>
            </div>

            {existingEstimate.status === "pending" && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-red-500/20 text-red-400"
                  onClick={onRejectEstimate}
                  disabled={isLoading}
                >
                  Reject
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={onApproveEstimate}
                  disabled={isLoading}
                >
                  {isLoading ? "Approving..." : "Approve"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};




