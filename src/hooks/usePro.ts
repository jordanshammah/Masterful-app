import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  proApi,
  earningsApi,
  jobsApi,
  ProProfile,
  EarningsData,
  JobRequest,
  Job,
} from "@/lib/api/pro";

export const useProProfile = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "profile", providerId],
    queryFn: () => proApi.getProfile(providerId),
    enabled: !!providerId,
  });
};

export const useProEarnings = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "earnings", providerId],
    queryFn: () => earningsApi.getEarnings(providerId),
    enabled: !!providerId,
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
};

export const useProJobRequests = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "jobRequests", providerId],
    queryFn: () => jobsApi.getJobRequests(providerId),
    enabled: !!providerId,
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
  });
};

export const useProJobs = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "jobs", providerId],
    queryFn: () => jobsApi.getAllJobs(providerId),
    enabled: !!providerId,
  });
};

export const useJobsByDate = (providerId: string) => {
  return useQuery({
    queryKey: ["pro", "jobsByDate", providerId],
    queryFn: () => jobsApi.getJobsByDate(providerId),
    enabled: !!providerId,
    refetchInterval: 1000 * 60, // Refetch every minute
  });
};

export const useAcceptJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) => jobsApi.acceptJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pro", "jobRequests", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["pro", "jobs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["pro", "jobsByDate", user?.id] });
    },
  });
};

export const useDeclineJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) => jobsApi.declineJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pro", "jobRequests", user?.id] });
    },
  });
};

export const useCompleteJob = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (jobId: string) => jobsApi.completeJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pro", "jobs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["pro", "earnings", user?.id] });
    },
  });
};

export const useUpdateProProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProProfile> }) =>
      proApi.updateProfile(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pro", "profile", variables.id] });
    },
  });
};
