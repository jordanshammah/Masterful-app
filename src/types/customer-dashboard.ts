/**
 * Customer Dashboard Types
 * Centralized type definitions for the customer dashboard
 */

export type CustomerDashboardView = 
  | "home" 
  | "jobs" 
  | "wallet" 
  | "account" 
  | "security" 
  | "support" 
  | "settings";

export interface CustomerDashboardStats {
  activeJobs: number;
  completedJobs: number;
  upcomingVisits: number;
  walletBalance: number;
}

export interface CustomerJob {
  id: string;
  provider_id: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  scheduled_date: string;
  scheduled_time?: string;
  total_price: number;
  base_price: number;
  address: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  job_start_time?: string; // ISO timestamp when job started (status changed to in_progress)
  category_id: number;
  auth_code_customer?: string;
  auth_code_provider?: string;
  customer_code_expires_at?: string; // Expiry timestamp for customer code
  provider_code_expires_at?: string; // Expiry timestamp for provider code
  
  // Quote-based pricing fields
  quote_total?: number; // Total quoted price
  quote_labor?: number; // Labor component of quote
  quote_materials?: number; // Materials component of quote
  quote_breakdown?: string; // Optional detailed breakdown
  quote_submitted_at?: string; // When provider submitted quote
  quote_accepted?: boolean; // Whether customer accepted quote
  quote_accepted_at?: string; // When customer accepted quote
  quote_locked?: boolean; // Quote locked from editing
  
  // Handshake code fields
  start_code?: string; // Customer-visible code to authorize job start
  start_code_used?: boolean; // Whether start code has been used
  start_code_used_at?: string; // When start code was used
  end_code?: string; // Provider-visible code after completion
  end_code_used?: boolean; // Whether end code has been used
  end_code_used_at?: string; // When end code was used
  
  // Payment fields
  payment_amount?: number; // Amount customer paid
  payment_tip?: number; // Optional tip
  payment_total?: number; // Total payment (amount + tip)
  payment_method?: 'mpesa' | 'card' | 'cash';
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial' | 'disputed';
  payment_completed_at?: string; // When payment completed
  payment_reference?: string; // Payment gateway reference
  is_partial_payment?: boolean; // True if customer paid less than quote
  partial_payment_reason?: string;
  
  // Dispute tracking
  dispute_flagged?: boolean;
  dispute_reason?: string;
  
  // Rating status
  has_rating?: boolean;
  review?: {
    id: string;
    rating: number;
    review_text?: string | null;
    created_at: string;
  };
  
  provider?: {
    id: string;
    display_name?: string;
    business_name?: string;
    profile_image_url?: string;
    rating?: number;
    review_count?: number;
  };
  service_category?: {
    id: number;
    name: string;
  };
}

export interface PaymentMethod {
  id: string;
  type: "card" | "paypal" | "bank_account";
  last4?: string;
  brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  is_primary: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  job_id: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "refunded";
  payment_method: string;
  processed_at?: string;
  created_at: string;
  job?: {
    id: string;
    provider?: {
      display_name?: string;
      business_name?: string;
    };
    service_category?: {
      name: string;
    };
  };
}

export interface Address {
  id: string;
  owner_type: "customer" | "provider";
  owner_id: string;
  label: string;
  street: string;
  city: string;
  region: string; // Replaces state
  postal_code: string; // Replaces zip_code
  country: string;
  latitude?: number | null; // Optional geocoordinates
  longitude?: number | null; // Optional geocoordinates
  is_primary: boolean; // Replaces is_default
  created_at: string;
  updated_at?: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: "general" | "billing" | "technical" | "trust_safety";
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at?: string;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  message: string;
  is_from_customer: boolean;
  created_at: string;
}

export interface LoginSession {
  id: string;
  device: string;
  location: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}








