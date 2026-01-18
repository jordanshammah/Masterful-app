/**
 * Enhanced Customer Hooks
 * React Query hooks for customer dashboard
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  customerJobsApi,
  customerWalletApi,
  customerAddressApi,
  customerSupportApi,
} from "@/lib/api/customer-enhanced";
import { generateCustomerStartCode } from "@/lib/api/job-codes-edge";
import type {
  CustomerJob,
  PaymentMethod,
  Transaction,
  Address,
  SupportTicket,
} from "@/types/customer-dashboard";

// Jobs hooks
export const useCustomerJobs = (customerId: string) => {
  return useQuery({
    queryKey: ["customer", "jobs", customerId],
    queryFn: () => customerJobsApi.getAllJobs(customerId),
    enabled: !!customerId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useCustomerJob = (jobId: string) => {
  return useQuery({
    queryKey: ["customer", "job", jobId],
    queryFn: () => customerJobsApi.getJobById(jobId),
    enabled: !!jobId,
  });
};

export const useCancelJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; reason: string }) =>
      customerJobsApi.cancelJob(params),
    onSuccess: (_, variables) => {
      if (user?.id) {
        // Invalidate customer queries
        queryClient.invalidateQueries({ queryKey: ["customer", "jobs", user.id] });
        queryClient.invalidateQueries({ queryKey: ["customer", "job", variables.jobId] });
        
        // Invalidate all provider job queries so they see the cancellation
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    },
  });
};

export const useRescheduleJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; newDate: string; newTime?: string }) =>
      customerJobsApi.rescheduleJob(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "jobs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["customer", "job", variables.jobId] });
    },
  });
};

export const useValidateStart = () => {
  return useMutation({
    mutationFn: (params: { jobId: string; customerAuthCode: string }) =>
      customerJobsApi.validateStart(params),
  });
};

export const useValidateComplete = () => {
  return useMutation({
    mutationFn: (params: { jobId: string; providerAuthCode: string }) =>
      customerJobsApi.validateComplete(params),
  });
};

export const useCompleteJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; providerAuthCode: string }) =>
      customerJobsApi.completeJob(params),
    onSuccess: (_, variables) => {
      if (user?.id) {
        // Invalidate customer queries to refresh job list
        queryClient.invalidateQueries({ queryKey: ["customer", "jobs", user.id] });
        queryClient.invalidateQueries({ queryKey: ["customer", "job", variables.jobId] });
        
        // Invalidate provider queries so they see the job is completed
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    },
  });
};

export const useGenerateCustomerStartCode = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { jobId: string; method?: "ui" | "email" }) =>
      generateCustomerStartCode({ jobId: params.jobId, method: params.method || "ui" }),
    onSuccess: (_, variables) => {
      if (user?.id) {
        // Delay query invalidation slightly to ensure database commit completes
        // This prevents race condition where query refetches before code is saved
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["customer", "jobs", user.id] });
          queryClient.invalidateQueries({ queryKey: ["customer", "job", variables.jobId] });
        }, 500); // 500ms delay to ensure DB commit
      }
    },
  });
};

// Wallet hooks
export const usePaymentMethods = (customerId: string) => {
  return useQuery({
    queryKey: ["customer", "payment-methods", customerId],
    queryFn: () => customerWalletApi.getPaymentMethods(customerId),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useTransactions = (customerId: string) => {
  return useQuery({
    queryKey: ["customer", "transactions", customerId],
    queryFn: () => customerWalletApi.getTransactions(customerId),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Address hooks
export const useAddresses = (customerId: string) => {
  return useQuery({
    queryKey: ["customer", "addresses", customerId],
    queryFn: () => customerAddressApi.getAddresses(customerId),
    enabled: !!customerId,
  });
};

export const useAddAddress = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ customerId, address }: { customerId: string; address: Omit<Address, "id" | "owner_type" | "owner_id" | "created_at" | "updated_at"> }) =>
      customerAddressApi.addAddress(customerId, address),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "addresses", variables.customerId] });
    },
    retry: false,
  });
};

export const useUpdateAddress = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ addressId, address }: { addressId: string; address: Partial<Omit<Address, "id" | "owner_type" | "owner_id" | "created_at" | "updated_at">> }) =>
      customerAddressApi.updateAddress(addressId, address),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["customer", "addresses", user.id] });
      }
    },
  });
};

export const useDeleteAddress = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (addressId: string) => customerAddressApi.deleteAddress(addressId),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["customer", "addresses", user.id] });
      }
    },
  });
};

// Support hooks
export const useCreateSupportTicket = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ customerId, ticket }: { customerId: string; ticket: Omit<SupportTicket, "id" | "status" | "created_at" | "updated_at" | "messages"> }) =>
      customerSupportApi.createTicket(customerId, ticket),
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["customer", "support-tickets", user.id] });
      }
    },
  });
};

export const useSupportTicket = (ticketId: string) => {
  return useQuery({
    queryKey: ["customer", "support-ticket", ticketId],
    queryFn: () => customerSupportApi.getTicket(ticketId),
    enabled: !!ticketId,
  });
};








