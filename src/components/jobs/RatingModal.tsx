/**
 * Rating Modal
 * Allows customers to rate and review providers after job completion
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface RatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  providerId: string;
  providerName: string;
  onRatingSuccess?: () => void;
}

export function RatingModal({
  open,
  onOpenChange,
  jobId,
  providerId,
  providerName,
  onRatingSuccess,
}: RatingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to submit a rating");
      }

      // Check if review already exists
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("job_id", jobId)
        .eq("author_id", user.id)
        .maybeSingle();

      if (existingReview) {
        throw new Error("You have already rated this job");
      }

      // Insert review
      const { error: insertError } = await supabase
        .from("reviews")
        .insert({
          job_id: jobId,
          provider_id: providerId,
          author_id: user.id,
          rating: rating,
          review_text: reviewText.trim() || null,
        });

      if (insertError) {
        throw insertError;
      }

      // Update provider's average rating and review count
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("provider_id", providerId);

      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        await supabase
          .from("providers")
          .update({
            rating: Number(avgRating.toFixed(2)),
            review_count: reviews.length,
          })
          .eq("id", providerId);
      }

      setSuccess(true);
      toast({
        title: "Rating Submitted!",
        description: "Thank you for your feedback.",
      });

      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["customer", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["pro", "dashboard"] });
      // Refresh service cards (providers and professionals lists)
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["professionals"] });

      setTimeout(() => {
        onRatingSuccess?.();
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to submit rating");
      toast({
        title: "Error",
        description: err.message || "Failed to submit rating",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      setRating(0);
      setHoverRating(0);
      setReviewText("");
      setError("");
      setSuccess(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            How was your experience with {providerName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={isSubmitting || success}
                  className={cn(
                    "transition-all duration-200 hover:scale-110",
                    isSubmitting || success ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                  )}
                >
                  <Star
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12",
                      (hoverRating >= star || rating >= star)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label htmlFor="review">Review (Optional)</Label>
            <Textarea
              id="review"
              placeholder="Share your experience with this professional..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              disabled={isSubmitting || success}
              maxLength={1000}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {reviewText.length}/1000
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Rating submitted successfully!</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting || success}
          >
            {success ? "Close" : "Cancel"}
          </Button>
          {!success && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Rating"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
