/**
 * Paystack React Hooks
 * Provides React hooks for Paystack payment operations
 */

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import paystackService, {
  createDepositPayment,
  createFinalBalancePayment,
  generatePaymentReference,
  toSmallestUnit,
  type InitializePaymentParams,
  type PaystackPopupResponse,
} from "@/lib/api/paystack";

// ============================================================================
// Types
// ============================================================================

export interface UsePaystackDepositParams {
  email: string;
  depositAmount: number;
  jobId: string;
  customerId: string;
  providerId: string;
  providerName: string;
  serviceName: string;
}

export interface UsePaystackFinalParams {
  email: string;
  amountDue: number;
  jobId: string;
  customerId: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  totalCost: number;
  depositPaid: number;
}

export interface PaymentResult {
  success: boolean;
  reference: string;
  message?: string;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Check if Paystack is configured
 */
export const usePaystackConfig = () => {
  return {
    isConfigured: paystackService.isConfigured,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
  };
};

/**
 * Hook for processing deposit payments
 */
export const usePaystackDeposit = () => {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processDeposit = useCallback(async (params: UsePaystackDepositParams): Promise<PaymentResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      // Create payment params
      const paymentParams = createDepositPayment(params);

      // Open Paystack popup
      const response = await paystackService.initializePopup(paymentParams);

      if (response.status === "success") {
        // Record payment in database
        await recordPayment({
          reference: response.reference,
          jobId: params.jobId,
          customerId: params.customerId,
          providerId: params.providerId,
          amount: params.depositAmount,
          paymentType: "deposit",
          status: "completed",
        });

        // Update job deposit status
        await supabase
          .from("jobs")
          .update({
            deposit_paid: true,
            deposit_paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", params.jobId);

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["customer", "jobs", params.customerId] });
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs", params.providerId] });

        setIsProcessing(false);
        return {
          success: true,
          reference: response.reference,
          message: "Deposit payment successful",
        };
      } else {
        throw new Error("Payment was not successful");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      setError(errorMessage);
      setIsProcessing(false);
      return {
        success: false,
        reference: "",
        message: errorMessage,
      };
    }
  }, [queryClient]);

  return {
    processDeposit,
    isProcessing,
    error,
  };
};

/**
 * Hook for processing final balance payments after job completion
 */
export const usePaystackFinalPayment = () => {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFinalPayment = useCallback(async (params: UsePaystackFinalParams): Promise<PaymentResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      // Create payment params
      const paymentParams = createFinalBalancePayment(params);

      // Open Paystack popup
      const response = await paystackService.initializePopup(paymentParams);

      if (response.status === "success") {
        // Record payment in database
        await recordPayment({
          reference: response.reference,
          jobId: params.jobId,
          customerId: params.customerId,
          providerId: params.providerId,
          amount: params.amountDue,
          paymentType: "final_balance",
          status: "completed",
        });

        // Update job payment status
        await supabase
          .from("jobs")
          .update({
            final_paid: true,
            final_paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", params.jobId);

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["customer", "jobs", params.customerId] });
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs", params.providerId] });

        setIsProcessing(false);
        return {
          success: true,
          reference: response.reference,
          message: "Final payment successful",
        };
      } else {
        throw new Error("Payment was not successful");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      setError(errorMessage);
      setIsProcessing(false);
      return {
        success: false,
        reference: "",
        message: errorMessage,
      };
    }
  }, [queryClient]);

  return {
    processFinalPayment,
    isProcessing,
    error,
  };
};

/**
 * Generic hook for custom Paystack payments
 */
export const usePaystack = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(async (params: InitializePaymentParams): Promise<PaystackPopupResponse | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await paystackService.initializePopup(params);
      setIsProcessing(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      setError(errorMessage);
      setIsProcessing(false);
      return null;
    }
  }, []);

  return {
    initiatePayment,
    isProcessing,
    error,
    isConfigured: paystackService.isConfigured,
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record payment in the database
 */
async function recordPayment(params: {
  reference: string;
  jobId: string;
  customerId: string;
  providerId: string;
  amount: number;
  paymentType: "deposit" | "final_balance";
  status: "pending" | "completed" | "failed" | "refunded";
}): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .insert({
      job_id: params.jobId,
      customer_id: params.customerId,
      provider_id: params.providerId,
      amount: params.amount,
      status: params.status,
      payment_method: "paystack",
      processed_at: params.status === "completed" ? new Date().toISOString() : null,
    });

  if (error) {
    console.error("[usePaystack] Failed to record payment:", error);
    // Don't throw - payment was successful even if recording fails
    // This should be handled by webhook in production
  }
}

/**
 * Mutation hook for updating job after successful deposit
 */
export const useUpdateJobDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, reference }: { jobId: string; reference: string }) => {
      const { data, error } = await supabase
        .from("jobs")
        .update({
          deposit_paid: true,
          deposit_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", jobId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all job queries
      queryClient.invalidateQueries({ queryKey: ["customer", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
    },
  });
};

/**
 * Mutation hook for updating job after successful final payment
 */
export const useUpdateJobFinalPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, reference }: { jobId: string; reference: string }) => {
      const { data, error } = await supabase
        .from("jobs")
        .update({
          final_paid: true,
          final_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", jobId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all job queries
      queryClient.invalidateQueries({ queryKey: ["customer", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
    },
  });
};

export default usePaystack;



