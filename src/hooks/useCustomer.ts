import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  customerApi,
  categoriesApi,
  recommendationsApi,
  bookingsApi,
  paymentsApi,
  notificationsApi,
  CustomerProfile,
  ServiceCategory,
  ProfessionalRecommendation,
  Booking,
  Payment,
  Notification,
} from "@/lib/api/customer";

export const useCustomerProfile = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "profile", user?.id],
    queryFn: () => customerApi.getProfile(user!.id),
    enabled: !!user,
  });
};

export const useServiceCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.getAll(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useRecommendations = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "recommendations", user?.id],
    queryFn: () => recommendationsApi.getForCustomer(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAllBookings = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "bookings", "all", user?.id],
    queryFn: () => bookingsApi.getForCustomer(user!.id),
    enabled: !!user,
    refetchInterval: 1000 * 60, // Refetch every minute
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useActiveBookings = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "bookings", "active", user?.id],
    queryFn: () => bookingsApi.getActive(user!.id),
    enabled: !!user,
    refetchInterval: 1000 * 60, // Refetch every minute
  });
};

export const useCompletedJobs = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "bookings", "completed", user?.id],
    queryFn: () => bookingsApi.getCompleted(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const usePaymentHistory = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "payments", user?.id],
    queryFn: () => paymentsApi.getForCustomer(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useNotifications = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["customer", "notifications", user?.id],
    queryFn: () => notificationsApi.getForCustomer(user!.id),
    enabled: !!user,
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
    staleTime: 1000 * 15, // 15 seconds
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (updates: Partial<CustomerProfile>) =>
      customerApi.updateProfile(user!.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "profile", user?.id] });
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (bookingId: string) => bookingsApi.cancel(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "bookings"] });
    },
  });
};

