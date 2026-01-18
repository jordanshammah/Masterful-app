/**
 * End-to-End Test: Customer Address Creation and Pro View
 * 
 * Tests the complete flow:
 * 1. Customer creates address
 * 2. Customer creates booking with address
 * 3. Pro views booking
 * 4. Pro fetches customer address
 * 5. Verify address fields match
 */

import { supabase } from "@/integrations/supabase/client";
import { customerAddressApi } from "../customer-enhanced";
import { servicesApi } from "../services-enhanced";

export interface E2ETestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
  timestamp: string;
}

export class AddressE2ETest {
  private results: E2ETestResult[] = [];
  private testCustomerId: string | null = null;
  private testProviderId: string | null = null;
  private testAddressId: string | null = null;
  private testBookingId: string | null = null;

  private log(step: string, success: boolean, data?: any, error?: any) {
    this.results.push({
      step,
      success,
      data,
      error: error?.message || error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Step 1: Create test customer address
   */
  async step1_CreateAddress(customerId: string): Promise<boolean> {
    try {
      const testAddress = {
        label: "E2E Test Address",
        street: "123 Test Street",
        city: "Test City",
        region: "CA",
        postal_code: "12345",
        country: "US",
        is_primary: true,
      };

      const address = await customerAddressApi.addAddress(customerId, testAddress);
      this.testAddressId = address.id;
      this.testCustomerId = customerId;

      this.log("Step 1: Create Customer Address", true, { addressId: address.id, address });
      return true;
    } catch (error: any) {
      this.log("Step 1: Create Customer Address", false, null, error);
      return false;
    }
  }

  /**
   * Step 2: Create booking with address
   */
  async step2_CreateBooking(providerId: string, categoryId: number): Promise<boolean> {
    if (!this.testCustomerId || !this.testAddressId) {
      this.log("Step 2: Create Booking", false, null, new Error("Missing customer ID or address ID"));
      return false;
    }

    try {
      // Get the address details from unified addresses table
      const { data: addressData, error: addressError } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", this.testAddressId)
        .single();

      if (addressError || !addressData) {
        throw new Error(`Failed to fetch address: ${addressError?.message}`);
      }

      // Format address for booking
      const formattedAddress = `${addressData.street}, ${addressData.city}, ${addressData.region} ${addressData.postal_code}`;

      // Create booking
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1); // Tomorrow

      const { data: bookingData, error: bookingError } = await supabase
        .from("jobs")
        .insert({
          customer_id: this.testCustomerId,
          provider_id: providerId,
          category_id: categoryId,
          scheduled_date: scheduledDate.toISOString(),
          address: formattedAddress,
          base_price: 100,
          total_price: 100,
          status: "pending",
        })
        .select()
        .single();

      if (bookingError || !bookingData) {
        throw new Error(`Failed to create booking: ${bookingError?.message}`);
      }

      this.testBookingId = bookingData.id;
      this.testProviderId = providerId;

      this.log("Step 2: Create Booking", true, {
        bookingId: bookingData.id,
        address: formattedAddress,
        booking: bookingData,
      });
      return true;
    } catch (error: any) {
      this.log("Step 2: Create Booking", false, null, error);
      return false;
    }
  }

  /**
   * Step 3: Pro views booking
   */
  async step3_ProViewBooking(providerId: string): Promise<boolean> {
    if (!this.testBookingId) {
      this.log("Step 3: Pro View Booking", false, null, new Error("Missing booking ID"));
      return false;
    }

    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customer_id(
            profiles:profiles!inner(
              full_name,
              email
            )
          )
        `)
        .eq("id", this.testBookingId)
        .eq("provider_id", providerId)
        .single();

      if (bookingError || !bookingData) {
        throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
      }

      this.log("Step 3: Pro View Booking", true, {
        booking: bookingData,
        addressFromBooking: bookingData.address,
      });
      return true;
    } catch (error: any) {
      this.log("Step 3: Pro View Booking", false, null, error);
      return false;
    }
  }

  /**
   * Step 4: Pro fetches customer address
   */
  async step4_ProFetchAddress(): Promise<boolean> {
    if (!this.testCustomerId || !this.testProviderId) {
      this.log("Step 4: Pro Fetch Address", false, null, new Error("Missing customer ID or provider ID"));
      return false;
    }

    try {
      // Pro should be able to view customer addresses for their jobs
      const { data: addressData, error: addressError } = await supabase
        .from("addresses")
        .select("*")
        .eq("owner_type", "customer")
        .eq("owner_id", this.testCustomerId);

      if (addressError) {
        throw new Error(`Failed to fetch address: ${addressError.message}`);
      }

      if (!addressData || addressData.length === 0) {
        throw new Error("No addresses found for customer");
      }

      const testAddress = addressData.find((addr) => addr.id === this.testAddressId);
      if (!testAddress) {
        throw new Error("Test address not found");
      }

      this.log("Step 4: Pro Fetch Address", true, {
        addresses: addressData,
        testAddress,
      });
      return true;
    } catch (error: any) {
      this.log("Step 4: Pro Fetch Address", false, null, error);
      return false;
    }
  }

  /**
   * Step 5: Verify address fields match
   */
  async step5_VerifyAddressMatch(): Promise<boolean> {
    if (!this.testAddressId || !this.testBookingId) {
      this.log("Step 5: Verify Address Match", false, null, new Error("Missing address ID or booking ID"));
      return false;
    }

    try {
      // Get address from unified addresses table
      const { data: addressData, error: addressError } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", this.testAddressId)
        .single();

      if (addressError || !addressData) {
        throw new Error(`Failed to fetch address: ${addressError?.message}`);
      }

      // Get booking address
      const { data: bookingData, error: bookingError } = await supabase
        .from("jobs")
        .select("address")
        .eq("id", this.testBookingId)
        .single();

      if (bookingError || !bookingData) {
        throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
      }

      // Format address from unified addresses table
      const formattedAddress = `${addressData.street}, ${addressData.city}, ${addressData.region} ${addressData.postal_code}`;

      // Verify addresses match
      const addressesMatch = bookingData.address === formattedAddress;

      this.log("Step 5: Verify Address Match", addressesMatch, {
        addressFromTable: {
          street: addressData.street,
          city: addressData.city,
          region: addressData.region,
          postal_code: addressData.postal_code,
          formatted: formattedAddress,
        },
        addressFromBooking: bookingData.address,
        match: addressesMatch,
      });

      if (!addressesMatch) {
        throw new Error(`Address mismatch: Table="${formattedAddress}", Booking="${bookingData.address}"`);
      }

      return true;
    } catch (error: any) {
      this.log("Step 5: Verify Address Match", false, null, error);
      return false;
    }
  }

  /**
   * Cleanup: Delete test data
   */
  async cleanup(): Promise<void> {
    try {
      if (this.testBookingId) {
        await supabase.from("jobs").delete().eq("id", this.testBookingId);
      }
      if (this.testAddressId) {
        await supabase.from("addresses").delete().eq("id", this.testAddressId);
      }
      this.log("Cleanup", true, { deletedBooking: this.testBookingId, deletedAddress: this.testAddressId });
    } catch (error: any) {
      this.log("Cleanup", false, null, error);
    }
  }

  /**
   * Run full E2E test
   */
  async runFullTest(
    customerId: string,
    providerId: string,
    categoryId: number
  ): Promise<{ success: boolean; results: E2ETestResult[] }> {
    console.log("[AddressE2ETest] Starting E2E test...");

    try {
      // Step 1: Create address
      const step1 = await this.step1_CreateAddress(customerId);
      if (!step1) {
        return { success: false, results: this.results };
      }

      // Step 2: Create booking
      const step2 = await this.step2_CreateBooking(providerId, categoryId);
      if (!step2) {
        await this.cleanup();
        return { success: false, results: this.results };
      }

      // Step 3: Pro views booking
      const step3 = await this.step3_ProViewBooking(providerId);
      if (!step3) {
        await this.cleanup();
        return { success: false, results: this.results };
      }

      // Step 4: Pro fetches address
      const step4 = await this.step4_ProFetchAddress();
      if (!step4) {
        await this.cleanup();
        return { success: false, results: this.results };
      }

      // Step 5: Verify match
      const step5 = await this.step5_VerifyAddressMatch();
      if (!step5) {
        await this.cleanup();
        return { success: false, results: this.results };
      }

      // Cleanup
      await this.cleanup();

      console.log("[AddressE2ETest] E2E test completed successfully");
      return { success: true, results: this.results };
    } catch (error: any) {
      console.error("[AddressE2ETest] E2E test failed:", error);
      await this.cleanup();
      this.log("E2E Test", false, null, error);
      return { success: false, results: this.results };
    }
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    const report = [
      "=".repeat(80),
      "CUSTOMER ADDRESS E2E TEST REPORT",
      "=".repeat(80),
      `Generated: ${new Date().toISOString()}`,
      "",
    ];

    const allPassed = this.results.every((r) => r.success);
    report.push(`Overall Result: ${allPassed ? "✓ PASSED" : "✗ FAILED"}`);
    report.push("");

    this.results.forEach((result) => {
      report.push(`${result.success ? "✓" : "✗"} ${result.step}`);
      report.push(`  Timestamp: ${result.timestamp}`);
      
      if (result.error) {
        report.push(`  Error: ${result.error}`);
      }
      
      if (result.data) {
        report.push(`  Data: ${JSON.stringify(result.data, null, 2)}`);
      }
      
      report.push("");
    });

    report.push("=".repeat(80));
    return report.join("\n");
  }

  getResults(): E2ETestResult[] {
    return this.results;
  }
}




