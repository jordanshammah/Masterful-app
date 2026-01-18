/**
 * Realtime subscription hook for provider jobs
 * Subscribes to broadcast channel user:{provider_id}:jobs for real-time job updates
 * Updates React Query cache when booking_created, booking_updated, or booking_deleted events occur
 */

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProviderTableId } from "@/lib/api/pro-enhanced";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseProviderJobsRealtimeOptions {
  /** Provider auth user ID (not the provider table ID) */
  providerId: string;
  /** Whether the subscription is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time job updates for a provider
 * 
 * Subscribes to the broadcast channel: user:{providerTableId}:jobs
 * Listens for events:
 * - booking_created: New job created (payload is NEW row)
 * - booking_updated: Job updated (payload is NEW row)
 * - booking_deleted: Job deleted (payload is OLD row)
 * 
 * Updates React Query cache to reflect changes immediately
 */
export const useProviderJobsRealtime = ({
  providerId,
  enabled = true,
}: UseProviderJobsRealtimeOptions) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [providerTableId, setProviderTableId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Get provider table ID from auth user ID
  useEffect(() => {
    if (!providerId || !enabled) {
      setProviderTableId(null);
      return;
    }

    let mounted = true;

    getProviderTableId(providerId)
      .then((tableId) => {
        if (mounted) {
          setProviderTableId(tableId);
          if (import.meta.env.DEV) {
            console.log("[useProviderJobsRealtime] Provider table ID:", tableId);
          }
        }
      })
      .catch((error) => {
        if (mounted) {
          console.error("[useProviderJobsRealtime] Error getting provider table ID:", error);
          setProviderTableId(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [providerId, enabled]);

  // Subscribe to broadcast channel
  useEffect(() => {
    if (!providerTableId || !enabled) {
      // Cleanup if conditions not met
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsSubscribed(false);
      }
      return;
    }

    // Prevent double subscription
    if (channelRef.current && channelRef.current.state === "SUBSCRIBED") {
      return;
    }

    // Construct topic: user:{provider_id}:jobs
    const topic = `user:${providerTableId}:jobs`;

    if (import.meta.env.DEV) {
      console.log("[useProviderJobsRealtime] Subscribing to channel:", topic);
    }

    // Create channel with private config
    const channel = supabase.channel(topic, { config: { private: true } });
    channelRef.current = channel;

    // Handle booking_created event (INSERT)
    channel.on(
      "broadcast",
      { event: "booking_created" },
      (payload) => {
        const job = payload?.payload;
        if (!job || !job.id) {
          if (import.meta.env.DEV) {
            console.warn("[useProviderJobsRealtime] booking_created: Invalid payload", payload);
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log("[useProviderJobsRealtime] booking_created:", job.id);
        }

        // Invalidate all job queries to refetch with full details (customer profiles, etc.)
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    );

    // Handle booking_updated event (UPDATE)
    channel.on(
      "broadcast",
      { event: "booking_updated" },
      (payload) => {
        const job = payload?.payload;
        if (!job || !job.id) {
          if (import.meta.env.DEV) {
            console.warn("[useProviderJobsRealtime] booking_updated: Invalid payload", payload);
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log("[useProviderJobsRealtime] booking_updated:", job.id, job.status);
        }

        // Invalidate all job queries to refetch with updated details
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    );

    // Handle booking_deleted event (DELETE)
    channel.on(
      "broadcast",
      { event: "booking_deleted" },
      (payload) => {
        const deletedJob = payload?.payload;
        if (!deletedJob || !deletedJob.id) {
          if (import.meta.env.DEV) {
            console.warn("[useProviderJobsRealtime] booking_deleted: Invalid payload", payload);
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log("[useProviderJobsRealtime] booking_deleted:", deletedJob.id);
        }

        // Remove job from all status-specific caches
        const statuses: Array<"pending" | "confirmed" | "in_progress" | "completed" | "cancelled"> = [
          "pending",
          "confirmed",
          "in_progress",
          "completed",
          "cancelled",
        ];

        statuses.forEach((status) => {
          queryClient.setQueryData<unknown[]>(
            ["pro", "jobs", status, providerId],
            (oldData) => {
              if (!oldData || !Array.isArray(oldData)) return oldData;
              return oldData.filter((job: any) => job.id !== deletedJob.id);
            }
          );
        });

        // Also update the "all" jobs cache
        queryClient.setQueryData<unknown[]>(
          ["pro", "jobs", "all", providerId],
          (oldData) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            return oldData.filter((job: any) => job.id !== deletedJob.id);
          }
        );

        // Invalidate to ensure consistency
        queryClient.invalidateQueries({ queryKey: ["pro", "jobs"] });
      }
    );

    // Handle channel errors
    channel.on("error", (error) => {
      console.error("[useProviderJobsRealtime] Channel error:", error);
      setIsSubscribed(false);
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (import.meta.env.DEV) {
        console.log("[useProviderJobsRealtime] Channel subscription status:", status);
      }
      
      // Check if subscription failed
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setIsSubscribed(false);
        if (import.meta.env.DEV) {
          console.warn("[useProviderJobsRealtime] Subscription failed with status:", status);
        }
      } else {
        setIsSubscribed(status === "SUBSCRIBED");
      }
    });

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        if (import.meta.env.DEV) {
          console.log("[useProviderJobsRealtime] Unsubscribing from channel:", topic);
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsSubscribed(false);
      }
    };
  }, [providerTableId, enabled, providerId, queryClient]);

  return {
    isSubscribed,
    providerTableId,
  };
};
