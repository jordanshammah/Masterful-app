/**
 * Secure Booking API - Backend Authority Enforced
 * 
 * RULES:
 * 1. All mutations return success/error
 * 2. No optimistic updates
 * 3. No client-side state predictions
 * 4. Amounts always from server
 * 5. Codes fetched on-demand
 */

import { supabase } from "@/integrations/supabase/client";

export interface BookingResponse {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Fetch current booking state
 * ALWAYS call this after mutations
 */
export async function fetchBooking(bookingId: string): Promise<BookingResponse> {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        provider_id,
        customer_id,
        scheduled_date,
        quote_amount,
        agreed_amount,
        start_code,
        end_code,
        payment_required,
        breakdown,
        providers (
          display_name,
          business_name
        )
      `)
      .eq("id", bookingId)
      .single();

    if (error) throw error;

    // Map database status to canonical state
    const stateMap: Record<string, string> = {
      "pending": "pending",
      "confirmed": "quote_approved",
      "in_progress": "in_progress",
      "completed": "completed",
      "cancelled": "cancelled",
    };

    return {
      success: true,
      data: {
        id: data.id,
        state: stateMap[data.status] || "pending",
        provider_name: data.providers?.display_name || data.providers?.business_name || "Provider",
        scheduled_date: data.scheduled_date,
        quote_amount: data.quote_amount,
        agreed_amount: data.agreed_amount,
        start_code: data.start_code,
        end_code: data.end_code,
        payment_required: data.payment_required,
        breakdown: data.breakdown,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: "Unable to load booking details",
    };
  }
}

/**
 * Customer approves provider quote
 */
export async function approveQuote(bookingId: string): Promise<BookingResponse> {
  try {
    const { error } = await supabase.rpc("approve_booking_quote", {
      booking_id: bookingId,
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unable to approve quote",
    };
  }
}

/**
 * Provider starts job with customer's START CODE
 */
export async function startJob(bookingId: string, code: string): Promise<BookingResponse> {
  try {
    const { data, error } = await supabase.rpc("verify_start_code", {
      booking_id: bookingId,
      input_code: code,
    });

    if (error) throw error;

    if (!data || !data.success) {
      return {
        success: false,
        error: "Invalid code. Please try again.",
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: "Unable to start job. Please try again.",
    };
  }
}

/**
 * Customer completes job with provider's END CODE
 */
export async function completeJob(bookingId: string, code: string): Promise<BookingResponse> {
  try {
    const { data, error } = await supabase.rpc("verify_end_code", {
      booking_id: bookingId,
      input_code: code,
    });

    if (error) throw error;

    if (!data || !data.success) {
      return {
        success: false,
        error: "Invalid code. Please try again.",
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: "Unable to complete job. Please try again.",
    };
  }
}

/**
 * Customer initiates payment
 * Amount is NEVER sent from client
 */
export async function initiatePayment(bookingId: string): Promise<BookingResponse> {
  try {
    const { data, error } = await supabase.rpc("initiate_booking_payment", {
      booking_id: bookingId,
    });

    if (error) throw error;

    if (!data || !data.payment_url) {
      return {
        success: false,
        error: "Unable to initiate payment",
      };
    }

    // Redirect to payment URL (server provides)
    window.location.href = data.payment_url;

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: "Payment initiation failed. Please try again.",
    };
  }
}

/**
 * Cancel booking (customer or provider)
 */
export async function cancelBooking(bookingId: string, reason?: string): Promise<BookingResponse> {
  try {
    const { error } = await supabase.rpc("cancel_booking", {
      booking_id: bookingId,
      cancellation_reason: reason || "User cancelled",
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: "Unable to cancel booking",
    };
  }
}


