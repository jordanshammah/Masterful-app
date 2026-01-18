/**
 * Paystack Payment Integration
 * Handles payment initialization, verification, and checkout flows
 * 
 * IMPORTANT: In production, secret key operations MUST be done server-side
 * This client-side implementation is for the Paystack popup/redirect flow
 */

import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface PaystackConfig {
  publicKey: string;
  currency?: string;
}

export interface InitializePaymentParams {
  email: string;
  amount: number; // In smallest currency unit (kobo for NGN, cents for USD)
  reference?: string;
  currency?: string;
  callback_url?: string;
  metadata?: {
    job_id?: string;
    customer_id?: string;
    provider_id?: string;
    payment_type?: "deposit" | "final_balance";
    custom_fields?: Array<{
      display_name: string;
      variable_name: string;
      value: string | number;
    }>;
  };
  channels?: Array<"card" | "bank" | "ussd" | "qr" | "mobile_money" | "bank_transfer">;
}

export interface PaystackTransaction {
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending";
  amount: number;
  currency: string;
  paid_at?: string;
  channel?: string;
  authorization?: {
    authorization_code: string;
    card_type: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    bank: string;
    brand: string;
    reusable: boolean;
  };
}

export interface PaystackPopupResponse {
  reference: string;
  status: "success" | "failed";
  trans: string;
  transaction: string;
  trxref: string;
  redirecturl?: string;
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: "success" | "failed" | "abandoned" | "pending";
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: Record<string, unknown>;
    fees: number;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: Record<string, unknown> | null;
    };
  };
}

// ============================================================================
// Validation Schemas
// ============================================================================

const initializePaymentSchema = z.object({
  email: z.string().email("Invalid email address"),
  amount: z.number().positive("Amount must be positive"),
  reference: z.string().optional(),
  currency: z.string().default("KES"),
  callback_url: z.string().url().optional(),
  metadata: z.object({
    job_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
    provider_id: z.string().uuid().optional(),
    payment_type: z.enum(["deposit", "final_balance"]).optional(),
    custom_fields: z.array(z.object({
      display_name: z.string(),
      variable_name: z.string(),
      value: z.union([z.string(), z.number()]),
    })).optional(),
  }).optional(),
  channels: z.array(z.enum(["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"])).optional(),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique payment reference
 */
export const generatePaymentReference = (prefix = "MF"): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
};

/**
 * Convert amount to smallest currency unit
 * KES, NGN: amount * 100 (kobo/cents)
 */
export const toSmallestUnit = (amount: number, currency = "KES"): number => {
  // Most currencies use 100 subunits
  return Math.round(amount * 100);
};

/**
 * Convert from smallest currency unit to main unit
 */
export const fromSmallestUnit = (amount: number, currency = "KES"): number => {
  return amount / 100;
};

// ============================================================================
// Paystack Service Class
// ============================================================================

class PaystackService {
  private publicKey: string;
  private currency: string;
  private isInitialized = false;

  constructor(config?: PaystackConfig) {
    // Get public key from environment or config
    this.publicKey = config?.publicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "";
    this.currency = config?.currency || "KES";
    
    if (!this.publicKey) {
      console.warn("[PaystackService] No public key provided. Payment features will be disabled.");
    }
  }

  /**
   * Check if Paystack is properly configured
   */
  get isConfigured(): boolean {
    return !!this.publicKey;
  }

  /**
   * Load Paystack inline script if not already loaded
   */
  private async loadPaystackScript(): Promise<void> {
    if (this.isInitialized) return;

    // Check if script is already loaded
    if (window.PaystackPop) {
      this.isInitialized = true;
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      
      script.onload = () => {
        this.isInitialized = true;
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error("Failed to load Paystack script"));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Public: Ensure Paystack Inline is loaded (so UI can pre-load the script).
   */
  async ensureInlineLoaded(): Promise<void> {
    await this.loadPaystackScript();
  }

  /**
   * Initialize a payment using Paystack popup
   * Returns a promise that resolves when payment is complete
   */
  async initializePopup(params: InitializePaymentParams): Promise<PaystackPopupResponse> {
    if (!this.publicKey) {
      throw new Error("Paystack public key not configured");
    }

    const validated = initializePaymentSchema.parse(params);
    
    // Ensure script is loaded
    await this.loadPaystackScript();

    if (!window.PaystackPop) {
      throw new Error("Paystack popup not available");
    }

    const reference = validated.reference || generatePaymentReference();

    return new Promise((resolve, reject) => {
      const handler = window.PaystackPop.setup({
        key: this.publicKey,
        email: validated.email,
        amount: validated.amount, // Already in smallest unit
        currency: validated.currency || this.currency,
        ref: reference,
        metadata: validated.metadata,
        channels: validated.channels,
        callback: (response: PaystackPopupResponse) => {
          resolve(response);
        },
        onClose: () => {
          reject(new Error("Payment cancelled by user"));
        },
      });

      handler.openIframe();
    });
  }

  /**
   * Initialize a payment and redirect to Paystack checkout page
   * This is an alternative to the popup for mobile-first experiences
   */
  async initializeRedirect(params: InitializePaymentParams): Promise<string> {
    if (!this.publicKey) {
      throw new Error("Paystack public key not configured");
    }

    const validated = initializePaymentSchema.parse(params);
    const reference = validated.reference || generatePaymentReference();

    // For redirect, we need to call the Paystack API server-side
    // This returns the authorization URL to redirect to
    // In a real implementation, this would call your backend
    
    // For now, we'll construct a checkout URL using the inline method
    // Note: Full redirect requires server-side initialization
    console.warn("[PaystackService] Full redirect mode requires server-side implementation. Using popup fallback.");
    
    // Return a constructed URL that the backend would generate
    const checkoutUrl = `https://checkout.paystack.com/${reference}`;
    return checkoutUrl;
  }

  /**
   * Verify a payment transaction
   * NOTE: This should be done server-side for security
   * This method is for development/demo purposes only
   */
  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse | null> {
    // In production, verification MUST happen server-side
    // The backend would call: GET https://api.paystack.co/transaction/verify/:reference
    // with the secret key in the Authorization header
    
    console.warn(
      "[PaystackService] Payment verification should be done server-side. " +
      "Client-side verification is not secure."
    );

    // Return null to indicate server-side verification is needed
    return null;
  }

  /**
   * Get transaction status from callback URL parameters
   */
  parseCallbackParams(searchParams: URLSearchParams): { reference: string; trxref: string } | null {
    const reference = searchParams.get("reference");
    const trxref = searchParams.get("trxref");

    if (!reference && !trxref) {
      return null;
    }

    return {
      reference: reference || trxref || "",
      trxref: trxref || reference || "",
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const paystackService = new PaystackService();

/**
 * Convenience export (keeps call sites clean)
 */
export const ensurePaystackInlineLoaded = async (): Promise<void> => {
  await paystackService.ensureInlineLoaded();
};

// ============================================================================
// Type Declarations for Paystack Window Object
// ============================================================================

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        metadata?: Record<string, unknown>;
        channels?: string[];
        callback: (response: PaystackPopupResponse) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

// ============================================================================
// Helper Functions for Common Payment Scenarios
// ============================================================================

/**
 * Create deposit payment for a booking
 */
export const createDepositPayment = (params: {
  email: string;
  depositAmount: number; // In main currency unit (KES)
  jobId: string;
  customerId: string;
  providerId: string;
  providerName: string;
  serviceName: string;
}): InitializePaymentParams => {
  return {
    email: params.email,
    amount: toSmallestUnit(params.depositAmount),
    reference: generatePaymentReference("DEP"),
    metadata: {
      job_id: params.jobId,
      customer_id: params.customerId,
      provider_id: params.providerId,
      payment_type: "deposit",
      custom_fields: [
        { display_name: "Provider", variable_name: "provider_name", value: params.providerName },
        { display_name: "Service", variable_name: "service_name", value: params.serviceName },
        { display_name: "Payment Type", variable_name: "payment_type", value: "Deposit (1 Hour)" },
      ],
    },
    channels: ["card", "bank_transfer", "mobile_money"],
  };
};

/**
 * Create final balance payment after job completion
 */
export const createFinalBalancePayment = (params: {
  email: string;
  amountDue: number; // In main currency unit (KES) - amount after deposit deduction
  jobId: string;
  customerId: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  totalCost: number;
  depositPaid: number;
}): InitializePaymentParams => {
  return {
    email: params.email,
    amount: toSmallestUnit(params.amountDue),
    reference: generatePaymentReference("FIN"),
    metadata: {
      job_id: params.jobId,
      customer_id: params.customerId,
      provider_id: params.providerId,
      payment_type: "final_balance",
      custom_fields: [
        { display_name: "Provider", variable_name: "provider_name", value: params.providerName },
        { display_name: "Service", variable_name: "service_name", value: params.serviceName },
        { display_name: "Total Cost", variable_name: "total_cost", value: params.totalCost },
        { display_name: "Deposit Paid", variable_name: "deposit_paid", value: params.depositPaid },
        { display_name: "Balance Due", variable_name: "balance_due", value: params.amountDue },
      ],
    },
    channels: ["card", "bank_transfer", "mobile_money"],
  };
};

export default paystackService;


