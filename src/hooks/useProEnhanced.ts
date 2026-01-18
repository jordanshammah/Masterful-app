/**
 * Enhanced Pro Hooks
 * React Query hooks for professional dashboard
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  proJobsApi,
  proEarningsApi,
  proProfileApi,
  proPayoutMethodsApi,
} from "@/lib/api/pro-enhanced";
import { generateProviderEndCode } from "@/lib/api/job-codes-edge";
import type {
  JobWithDetails,
  EarningsData,
  Payout,
  ProProfile,
  VerificationDocument,
  BankDetails,
  PayoutMethod,
} from "@/types/pro-dashboard";

// Profile hooks
export const useProProfileEnhanced = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "profile", providerId],
    queryFn: () => proProfileApi.getProfile(providerId),
    enabled: !!providerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useUpdateProProfileEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProProfile> }) =>
      proProfileApi.updateProfile(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "profile", variables.id] });
    },
  });
};

// Jobs hooks
export const useProJobsEnhanced = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "jobs", "all", providerId],
    queryFn: () => proJobsApi.getAllJobs(providerId),
    enabled: !!providerId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useProJobsByStatus = (
  providerId: string,
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
) => {
  return useQuery({
    queryKey: ["pro", "jobs", status, providerId],
    queryFn: () => proJobsApi.getJobsByStatus(providerId, status),
    enabled: !!providerId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: status === "pending" ? 1000 * 30 : false, // Poll pending jobs
  });
};

export const useAcceptJobEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) => proJobsApi.acceptJob(jobId),
    onSuccess: (job) => {
      if (user?.id) {
        // Invalidate provider queries
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
        queryClient.invalidateQueries({ queryKey: ["pro", "earnings", user.id] });
        
        // Invalidate customer queries so their dashboard updates
        if (job.customer_id) {
          queryClient.invalidateQueries({ queryKey: ["customer", "jobs", job.customer_id] });
          queryClient.invalidateQueries({ queryKey: ["customer", "job", jobId] });
        }
      }
    },
  });
};

export const useDeclineJobEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) => proJobsApi.declineJob(jobId),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    },
  });
};

export const useCancelJobEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; reason: string }) =>
      proJobsApi.cancelJob(params),
    onSuccess: (job, variables) => {
      if (user?.id) {
        // Invalidate provider queries
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
        queryClient.invalidateQueries({ queryKey: ["pro", "job", variables.jobId] });
        
        // Invalidate customer queries so they see the cancellation
        if (job.customer_id) {
          queryClient.invalidateQueries({ queryKey: ["customer", "jobs", job.customer_id] });
          queryClient.invalidateQueries({ queryKey: ["customer", "job", variables.jobId] });
        }
      }
    },
  });
};

export const useStartJobEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; customerAuthCode: string }) =>
      proJobsApi.startJob(params),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    },
  });
};

export const useCompleteJobEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; providerAuthCode: string }) =>
      proJobsApi.completeJob(params),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
        queryClient.invalidateQueries({ queryKey: ["pro", "earnings", user.id] });
      }
    },
  });
};

export const useUpdateJobStatusEnhanced = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; status: string }) =>
      proJobsApi.updateJobStatus(params),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    },
  });
};

export const useGenerateProviderEndCode = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; method?: "ui" | "email" }) =>
      generateProviderEndCode({ jobId: params.jobId, method: params.method || "ui" }),
    onSuccess: (_, variables) => {
      if (user?.id) {
        // Invalidate queries to refresh job data with new code
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
        queryClient.invalidateQueries({ queryKey: ["pro", "job", variables.jobId] });
      }
    },
  });
};

// Earnings hooks
export const useProEarningsEnhanced = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "earnings", providerId],
    queryFn: () => proEarningsApi.getEarnings(providerId),
    enabled: !!providerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
};

export const useProPayouts = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "payouts", providerId],
    queryFn: () => proEarningsApi.getPayouts(providerId),
    enabled: !!providerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useRequestPayout = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ providerId, amount }: { providerId: string; amount: number }) =>
      proEarningsApi.requestPayout(providerId, amount),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "payouts", variables.providerId] });
      queryClient.invalidateQueries({ queryKey: ["pro", "earnings", variables.providerId] });
    },
  });
};

// Document upload hook
export const useUploadDocuments = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ providerId, files }: { providerId: string; files: File[] }) =>
      proProfileApi.uploadDocuments(providerId, files),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "profile", variables.providerId] });
    },
  });
};

// Bank details hook
export const useSaveBankDetails = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ providerId, bankDetails }: { providerId: string; bankDetails: BankDetails }) =>
      proProfileApi.saveBankDetails(providerId, bankDetails),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "profile", variables.providerId] });
    },
  });
};

// Payout methods hooks
export const usePayoutMethods = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "payout-methods", providerId],
    queryFn: () => proPayoutMethodsApi.list(providerId),
    enabled: !!providerId,
    staleTime: 1000 * 60,
  });
};

export const useCreatePayoutMethod = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (payload: {
      providerId: string;
      type: "bank" | "mpesa" | "mobile_money";
      label?: string;
      accountName: string;
      accountNumber: string;
      bankCode?: string;
      country?: string;
      isDefault?: boolean;
    }) => proPayoutMethodsApi.create(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "payout-methods", variables.providerId] });
    },
  });
};

export const useCreateSubaccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerId, payoutMethodId }: { providerId: string; payoutMethodId: string }) =>
      proPayoutMethodsApi.createSubaccount(providerId, payoutMethodId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "payout-methods", variables.providerId] });
    },
  });
};

export const useSetDefaultPayoutMethod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerId, payoutMethodId }: { providerId: string; payoutMethodId: string }) =>
      proPayoutMethodsApi.setDefault(providerId, payoutMethodId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "payout-methods", variables.providerId] });
    },
  });
};








