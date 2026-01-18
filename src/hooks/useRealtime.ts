/**
 * Realtime Subscriptions Hook
 * Provides live updates for jobs, messages, and notifications
 * Uses Supabase Realtime for instant data synchronization
 */

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = "jobs" | "messages" | "payments" | "reviews" | "providers" | "profiles";

interface RealtimeOptions {
  /** Tables to subscribe to */
  tables?: TableName[];
  /** Callback when data changes */
  onDataChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** Whether to enable subscriptions (default: true when user is authenticated) */
  enabled?: boolean;
}

/**
 * Hook for subscribing to realtime database changes
 * Automatically invalidates React Query cache when changes occur
 */
export const useRealtime = (options: RealtimeOptions = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { tables = ["jobs", "messages"], onDataChange, enabled = true } = options;

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const table = payload.table as TableName;
      
      if (import.meta.env.DEV) {
        console.log("[Realtime] Change detected:", {
          table,
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        });
      }

      // Invalidate relevant queries based on table
      switch (table) {
        case "jobs":
          // Invalidate all job-related queries
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          queryClient.invalidateQueries({ queryKey: ["customer", "jobs"] });
          queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
          break;
          
        case "messages":
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          break;
          
        case "payments":
          queryClient.invalidateQueries({ queryKey: ["payments"] });
          queryClient.invalidateQueries({ queryKey: ["earnings"] });
          break;
          
        case "reviews":
          queryClient.invalidateQueries({ queryKey: ["reviews"] });
          queryClient.invalidateQueries({ queryKey: ["providers"] });
          break;
          
        case "providers":
          queryClient.invalidateQueries({ queryKey: ["providers"] });
          queryClient.invalidateQueries({ queryKey: ["professionals"] });
          break;
          
        case "profiles":
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["customer"] });
          break;
      }

      // Call custom callback if provided
      if (onDataChange) {
        onDataChange(payload);
      }
    },
    [queryClient, onDataChange]
  );

  useEffect(() => {
    if (!user || !enabled) {
      return;
    }

    // Create a unique channel name for this user
    const channelName = `realtime-${user.id}-${Date.now()}`;
    
    if (import.meta.env.DEV) {
      console.log("[Realtime] Setting up subscriptions for tables:", tables);
    }

    // Create the channel
    const channel = supabase.channel(channelName);

    // Subscribe to each table
    tables.forEach((table) => {
      // Subscribe to changes where user is involved
      // For jobs: user is either customer or provider
      if (table === "jobs") {
        channel
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "jobs",
              filter: `customer_id=eq.${user.id}`,
            },
            handleChange
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "jobs",
              filter: `provider_id=eq.${user.id}`,
            },
            handleChange
          );
      } else if (table === "messages") {
        channel
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `sender_id=eq.${user.id}`,
            },
            handleChange
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `receiver_id=eq.${user.id}`,
            },
            handleChange
          );
      } else if (table === "payments") {
        channel
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "payments",
              filter: `customer_id=eq.${user.id}`,
            },
            handleChange
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "payments",
              filter: `provider_id=eq.${user.id}`,
            },
            handleChange
          );
      } else if (table === "profiles") {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          handleChange
        );
      } else if (table === "providers") {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "providers",
            filter: `id=eq.${user.id}`,
          },
          handleChange
        );
      } else if (table === "reviews") {
        // Subscribe to reviews where user is the provider
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "reviews",
            filter: `provider_id=eq.${user.id}`,
          },
          handleChange
        );
      }
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (import.meta.env.DEV) {
        console.log("[Realtime] Subscription status:", status);
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        if (import.meta.env.DEV) {
          console.log("[Realtime] Unsubscribing from channel");
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, enabled, tables.join(","), handleChange]);

  return {
    isConnected: !!channelRef.current,
  };
};

/**
 * Hook specifically for job realtime updates
 * Use this in customer and provider dashboards
 */
export const useJobsRealtime = (options?: Omit<RealtimeOptions, "tables">) => {
  return useRealtime({
    ...options,
    tables: ["jobs", "payments"],
  });
};

/**
 * Hook for provider-specific realtime updates
 * Includes jobs, reviews, and provider profile changes
 */
export const useProviderRealtime = (options?: Omit<RealtimeOptions, "tables">) => {
  return useRealtime({
    ...options,
    tables: ["jobs", "payments", "reviews", "providers"],
  });
};

/**
 * Hook for customer-specific realtime updates
 * Includes jobs, payments, and profile changes
 */
export const useCustomerRealtime = (options?: Omit<RealtimeOptions, "tables">) => {
  return useRealtime({
    ...options,
    tables: ["jobs", "payments", "profiles"],
  });
};

/**
 * Hook for messages realtime updates
 */
export const useMessagesRealtime = (options?: Omit<RealtimeOptions, "tables">) => {
  return useRealtime({
    ...options,
    tables: ["messages"],
  });
};




