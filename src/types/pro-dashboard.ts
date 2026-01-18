/**
 * Pro Dashboard Types
 * Centralized type definitions for the professional dashboard
 */

export type DashboardView = 
  | "home" 
  | "jobs" 
  | "jobs-active" 
  | "jobs-pending" 
  | "jobs-completed"
  | "calendar"
  | "earnings" 
  | "payouts"
  | "profile" 
  | "settings";

export interface ProDashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingJobs: number;
  totalEarnings: number;
  rating: number;
  reviewCount: number;
}

export interface JobWithDetails {
  id: string;
  customer_id: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "awaiting_payment" | "disputed";
  scheduled_date: string;
  scheduled_time?: string;
  total_price: number;
  base_price: number;
  address: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  job_start_time?: string; // ISO timestamp when job started (status changed to in_progress)
  materials_cost?: number; // Optional materials cost added by provider at completion
  
  // NEW: Quote-Based Pricing Model Fields
  quote_total?: number; // Total quoted price
  quote_labor?: number; // Labor component of quote
  quote_materials?: number; // Materials component of quote
  quote_breakdown?: string; // Optional detailed breakdown
  quote_submitted_at?: string; // When provider submitted quote
  quote_accepted?: boolean; // Whether customer accepted quote
  quote_accepted_at?: string; // When customer accepted quote
  quote_locked?: boolean; // Quote locked from editing
  
  // NEW: Handshake Code Fields
  start_code?: string; // Customer-visible code to authorize job start
  start_code_hash?: string; // Hash for verification
  start_code_used?: boolean; // Whether start code has been used
  start_code_used_at?: string; // When start code was used
  end_code?: string; // Provider-visible code after completion
  end_code_hash?: string; // Hash for verification
  end_code_used?: boolean; // Whether end code has been used
  end_code_used_at?: string; // When end code was used
  
  // NEW: Payment Fields
  payment_amount?: number; // Amount customer paid
  payment_tip?: number; // Optional tip
  payment_total?: number; // Total payment (amount + tip)
  payment_method?: 'mpesa' | 'card' | 'cash';
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial' | 'disputed';
  payment_completed_at?: string; // When payment completed
  payment_reference?: string; // Payment gateway reference
  is_partial_payment?: boolean; // True if customer paid less than quote
  partial_payment_reason?: string; // Customer reason for partial payment
  
  // NEW: Dispute Tracking
  dispute_flagged?: boolean; // Job flagged for dispute
  dispute_reason?: string; // Reason for dispute
  dispute_flagged_at?: string; // When dispute was flagged
  dispute_resolved?: boolean; // Whether dispute resolved
  dispute_resolved_at?: string; // When dispute resolved
  dispute_resolution?: string; // Resolution details
  
  // NEW: Rating status
  has_rating?: boolean;
  review?: {
    id: string;
    rating: number;
    review_text?: string | null;
    created_at: string;
    author_id?: string;
  };
  
  // NEW: Commission Tracking
  platform_commission_percent?: number; // Platform commission %
  platform_commission_amount?: number; // Platform commission amount
  provider_payout?: number; // Amount provider receives
  provider_payout_status?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Legacy Hourly Pricing Model Fields (for backward compatibility)
  hourly_rate_snapshot?: number; // Locked provider rate for this job
  deposit_amount?: number; // Deposit required (1 hour of work)
  deposit_paid?: boolean;
  deposit_paid_at?: string;
  initial_estimated_hours?: number; // Initial estimate (default 1-2 hours)
  approved_estimated_hours?: number; // Customer-approved estimate
  approved_materials_cost?: number; // Customer-approved materials
  job_started_at?: string; // Server timestamp when start code verified
  job_completed_at?: string; // Server timestamp when end code verified
  actual_duration_minutes?: number; // Actual duration from timestamps
  final_billed_hours?: number; // Final billed hours (rounded)
  final_labor_cost?: number; // Final labor cost
  final_materials_cost?: number; // Final materials cost
  final_subtotal?: number; // Subtotal before platform fee
  platform_fee_percent?: number; // Platform commission %
  platform_fee_amount?: number; // Platform commission amount
  final_total_cost?: number; // Total including fee
  final_amount_due?: number; // Amount customer still owes
  final_billed?: boolean; // Whether final bill calculated
  final_paid?: boolean; // Whether customer paid final amount
  final_paid_at?: string;
  provider_payout_amount?: number; // Amount provider receives
  provider_paid_out?: boolean; // Whether provider has been paid
  provider_paid_out_at?: string;
  
  customer?: {
    id: string;
    profiles?: {
      full_name: string;
      photo_url?: string;
      phone?: string;
    };
  };
  service_category?: {
    id: number;
    name: string;
  };
  auth_code_customer?: string;
  auth_code_provider?: string;
}

export interface EarningsPeriod {
  amount: number;
  jobs: number;
  sparkline: number[];
}

export interface EarningsData {
  today: EarningsPeriod;
  week: EarningsPeriod;
  month: EarningsPeriod;
  lifetime: EarningsPeriod;
  pendingPayouts: number;
  nextPayoutDate?: string;
}

export interface Payout {
  id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  requested_at: string;
  processed_at?: string;
  payment_method?: string;
}

export interface ProProfile {
  id: string;
  category_id: number;
  display_name?: string;
  business_name?: string;
  profile_image_url?: string;
  bio?: string;
  hourly_rate: number;
  hourly_rate_last_updated?: string; // Track when rate was last changed
  minimum_job_price?: number; // NEW: Minimum price provider will accept
  rating: number;
  review_count: number;
  is_active: boolean;
  is_verified: boolean;
  avg_response_time: number;
  profiles?: {
    full_name: string;
    photo_url?: string;
    city?: string;
    phone?: string;
    email?: string;
  };
  service_categories?: {
    name: string;
  };
}

export interface VerificationDocument {
  id: string;
  type: "id" | "license" | "certificate";
  url: string;
  status: "pending" | "approved" | "rejected";
  uploaded_at: string;
}

export interface BankDetails {
  account_holder_name: string;
  account_number: string;
  routing_number: string;
  bank_name: string;
}

export interface PayoutMethod {
  id: string;
  provider_id: string;
  type: "bank" | "mpesa" | "mobile_money" | "other";
  label?: string;
  account_name?: string;
  account_number: string;
  bank_code?: string;
  country: string;
  is_default: boolean;
  paystack_subaccount_id?: string | null;
  verification_status?: "unverified" | "pending" | "verified" | "failed";
  created_at?: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  type: "job_request" | "job_update" | "payment" | "verification" | "system";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  job_id?: string;
}

// NEW: Job Estimate Revision Types
export interface JobEstimate {
  id: string;
  job_id: string;
  revised_hours: number;
  revised_materials_cost: number;
  explanation: string;
  photo_urls?: string[];
  created_by: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  customer_response?: string;
  created_at: string;
  responded_at?: string;
}

export interface CreateEstimateParams {
  jobId: string;
  revisedHours: number;
  revisedMaterialsCost: number;
  explanation: string;
  photoUrls?: string[];
}

export interface EstimateResponse {
  approved: boolean;
  response?: string;
}

// NEW: Quote-Based Pricing Types
export interface QuoteSubmission {
  jobId: string;
  quoteTotal: number;
  quoteLabor?: number;
  quoteMaterials?: number;
  quoteBreakdown?: string;
}

export interface QuoteAcceptance {
  jobId: string;
  accepted: boolean;
}

export interface HandshakeCode {
  code: string;
  expiresAt?: string;
}

export interface PaymentSubmission {
  jobId: string;
  paymentAmount: number;
  paymentTip?: number;
  paymentMethod: 'mpesa' | 'card' | 'cash';
  paymentReference?: string;
  partialPaymentReason?: string;
}









