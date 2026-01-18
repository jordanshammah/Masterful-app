/**
 * Notifications API
 * Handle urgent booking notifications and pro acceptance flows
 */

import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const bookingIdSchema = z.string().uuid("Invalid booking ID");
const proIdSchema = z.string().uuid("Invalid provider ID");
const customerIdSchema = z.string().uuid("Invalid customer ID");

const urgentNotificationSchema = z.object({
  bookingId: bookingIdSchema,
  proId: proIdSchema,
  customerId: customerIdSchema,
  serviceName: z.string().min(1),
  scheduledAt: z.string().datetime(),
  address: z.string().min(5),
  totalPrice: z.number().min(0),
});

export interface NotificationRecord {
  id: string;
  user_id: string;
  booking_id: string;
  type: "urgent_booking" | "job_update" | "payment" | "system";
  priority: "high" | "normal";
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  sent_at: string;
  read_at?: string;
  action_url?: string;
}

/**
 * Send urgent booking notification to pro
 */
export const notificationsApi = {
  /**
   * Send urgent booking notification
   */
  sendUrgentBookingNotification: async (params: {
    bookingId: string;
    proId: string;
    customerId: string;
    serviceName: string;
    scheduledAt: string;
    address: string;
    totalPrice: number;
  }): Promise<void> => {
    const validated = urgentNotificationSchema.parse(params);

    const scheduledDate = new Date(validated.scheduledAt);
    const formattedDate = scheduledDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = scheduledDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const title = "🚨 URGENT Booking Request";
    const message = `URGENT booking — ${validated.serviceName}, ${formattedDate} at ${formattedTime}, ${validated.address}, estimated total $${validated.totalPrice.toFixed(2)}. Accept now.`;

    // Create notification record (if notifications table exists)
    try {
      const { error: notifyError } = await supabase
        .from("notifications")
        .insert({
          user_id: validated.proId,
          booking_id: validated.bookingId,
          type: "urgent_booking",
          priority: "high",
          title,
          message,
          payload: {
            bookingId: validated.bookingId,
            customerId: validated.customerId,
            serviceName: validated.serviceName,
            scheduledAt: validated.scheduledAt,
            address: validated.address,
            totalPrice: validated.totalPrice,
            acceptUrl: `/dashboard/pro?view=jobs&jobId=${validated.bookingId}&action=accept`,
            declineUrl: `/dashboard/pro?view=jobs&jobId=${validated.bookingId}&action=decline`,
          },
          sent_at: new Date().toISOString(),
        });

      if (notifyError) {
        // If notifications table doesn't exist, use messages table as fallback
        await supabase.from("messages").insert({
          sender_id: validated.customerId,
          receiver_id: validated.proId,
          job_id: validated.bookingId,
          message: `${title}: ${message}`,
          is_read: false,
        });
      }
    } catch (error) {
      // Fallback to messages table
      await supabase.from("messages").insert({
        sender_id: validated.customerId,
        receiver_id: validated.proId,
        job_id: validated.bookingId,
        message: `${title}: ${message}`,
        is_read: false,
      });
    }

    // TODO: Send push notification, email, SMS via webhooks
    // This would integrate with:
    // - Push notifications (Firebase, OneSignal, etc.)
    // - Email (Resend, SendGrid, etc.)
    // - SMS (Twilio, etc.)
    // For now, in-app notification is created above
  },

  /**
   * Get notifications for a user
   */
  getNotifications: async (userId: string): Promise<NotificationRecord[]> => {
    const validatedId = z.string().uuid().parse(userId);

    // Try notifications table first
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, booking_id, type, priority, title, message, payload, sent_at, read_at, action_url")
      .eq("user_id", validatedId)
      .order("sent_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      // Fallback: return empty array if table doesn't exist
      return [];
    }

    return data.map((n: unknown) => {
      const notification = n as Record<string, unknown>;
      return {
        id: (notification.id as string) || "",
        user_id: (notification.user_id as string) || validatedId,
        booking_id: (notification.booking_id as string) || "",
        type: (notification.type || "system") as NotificationRecord["type"],
        priority: (notification.priority || "normal") as NotificationRecord["priority"],
        title: (notification.title as string) || "",
        message: (notification.message as string) || "",
        payload: (notification.payload as Record<string, unknown>) || undefined,
        sent_at: (notification.sent_at as string) || new Date().toISOString(),
        read_at: (notification.read_at as string) || undefined,
        action_url: (notification.action_url as string) || undefined,
      };
    });
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId: string): Promise<void> => {
    const validatedId = z.string().uuid().parse(notificationId);

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", validatedId);
  },
};








