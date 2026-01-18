/**
 * Address Creation Diagnostics
 * 
 * This script tests customer address creation and validates database state
 */

import { supabase } from "@/integrations/supabase/client";
import { customerAddressApi } from "../customer-enhanced";

export interface DiagnosticResult {
  timestamp: string;
  testName: string;
  success: boolean;
  error?: string;
  data?: any;
  sqlQuery?: string;
  stackTrace?: string;
}

export class AddressDiagnostics {
  private results: DiagnosticResult[] = [];

  private log(testName: string, success: boolean, data?: any, error?: any, sqlQuery?: string) {
    this.results.push({
      timestamp: new Date().toISOString(),
      testName,
      success,
      data,
      error: error?.message || error,
      sqlQuery,
      stackTrace: error?.stack,
    });
  }

  /**
   * Test 1: Check if customer_addresses table exists
   */
  async testTableExists(): Promise<boolean> {
    try {
      // Try to query the unified addresses table
      const { data, error } = await supabase
        .from("addresses")
        .select("id")
        .eq("owner_type", "customer")
        .limit(1);

      if (error) {
        this.log(
          "Table Existence Check",
          false,
          null,
          error,
          "SELECT id FROM customer_address LIMIT 1"
        );
        return false;
      }

      this.log(
        "Table Existence Check",
        true,
        { tableExists: true, sampleData: data },
        null,
        "SELECT id FROM customer_addresses LIMIT 1"
      );
      return true;
    } catch (error: any) {
      this.log(
        "Table Existence Check",
        false,
        null,
        error,
        "SELECT id FROM customer_addresses LIMIT 1"
      );
      return false;
    }
  }

  /**
   * Test 2: Check for alternative table names
   */
  async testAlternativeTableNames(): Promise<string | null> {
    const alternatives = ["Customer_address", "customer_addresses", "customerAddresses"];
    
    for (const tableName of alternatives) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select("id")
          .limit(1);

        if (!error) {
          this.log(
            "Alternative Table Check",
            true,
            { foundTable: tableName },
            null,
            `SELECT id FROM ${tableName} LIMIT 1`
          );
          return tableName;
        }
      } catch (error: any) {
        // Continue checking other alternatives
      }
    }

    this.log(
      "Alternative Table Check",
      false,
      { checkedTables: alternatives },
      new Error("No alternative table names found"),
      null
    );
    return null;
  }

  /**
   * Test 3: Attempt to create an address
   */
  async testAddressCreation(customerId: string, testAddress: any): Promise<boolean> {
    try {
      const result = await customerAddressApi.addAddress(customerId, testAddress);
      this.log(
        "Address Creation Test",
        true,
        { createdAddress: result },
        null,
        `INSERT INTO customer_addresses (customer_id, label, street, city, state, zip_code, is_default) VALUES (...)`
      );
      return true;
    } catch (error: any) {
      this.log(
        "Address Creation Test",
        false,
        null,
        error,
        `INSERT INTO customer_addresses (customer_id, label, street, city, state, zip_code, is_default) VALUES (...)`
      );
      return false;
    }
  }

  /**
   * Test 4: Check database schema via information_schema
   */
  async testDatabaseSchema(): Promise<any> {
    try {
      // Note: This requires admin access or a function that can query information_schema
      // For now, we'll try to infer from error messages
      const { data, error } = await supabase.rpc('get_table_info', {
        table_pattern: 'customer%'
      }).catch(() => ({ data: null, error: new Error('RPC not available') }));

      if (error) {
        // Fallback: Try direct query (may not work due to RLS)
        const { error: directError } = await supabase
          .from("addresses")
          .select("*")
          .eq("owner_type", "customer")
          .limit(0);

        this.log(
          "Database Schema Check",
          false,
          { errorMessage: directError?.message },
          directError || error,
          "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%customer%' OR table_name ILIKE '%address%'"
        );
        return null;
      }

      this.log(
        "Database Schema Check",
        true,
        { schemaInfo: data },
        null,
        "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%customer%' OR table_name ILIKE '%address%'"
      );
      return data;
    } catch (error: any) {
      this.log(
        "Database Schema Check",
        false,
        null,
        error,
        "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%customer%' OR table_name ILIKE '%address%'"
      );
      return null;
    }
  }

  /**
   * Run all diagnostic tests
   */
  async runAllTests(customerId: string): Promise<DiagnosticResult[]> {
    console.log("[AddressDiagnostics] Starting diagnostic tests...");

    // Test 1: Check if table exists
    const tableExists = await this.testTableExists();

    // Test 2: Check alternative table names
    if (!tableExists) {
      await this.testAlternativeTableNames();
    }

    // Test 3: Check database schema
    await this.testDatabaseSchema();

    // Test 4: Attempt address creation
    if (tableExists) {
      const testAddress = {
        label: "Test Address",
        street: "123 Test St",
        city: "Test City",
        region: "CA",
        postal_code: "12345",
        country: "US",
        is_primary: false,
      };
      await this.testAddressCreation(customerId, testAddress);
    }

    console.log("[AddressDiagnostics] Diagnostic tests completed");
    return this.results;
  }

  /**
   * Generate diagnostic report
   */
  generateReport(): string {
    const report = [
      "=".repeat(80),
      "CUSTOMER ADDRESS CREATION DIAGNOSTIC REPORT",
      "=".repeat(80),
      `Generated: ${new Date().toISOString()}`,
      "",
    ];

    this.results.forEach((result, index) => {
      report.push(`Test ${index + 1}: ${result.testName}`);
      report.push(`  Timestamp: ${result.timestamp}`);
      report.push(`  Success: ${result.success ? "✓" : "✗"}`);
      
      if (result.error) {
        report.push(`  Error: ${result.error}`);
      }
      
      if (result.sqlQuery) {
        report.push(`  SQL Query: ${result.sqlQuery}`);
      }
      
      if (result.data) {
        report.push(`  Data: ${JSON.stringify(result.data, null, 2)}`);
      }
      
      if (result.stackTrace) {
        report.push(`  Stack Trace: ${result.stackTrace}`);
      }
      
      report.push("");
    });

    report.push("=".repeat(80));
    return report.join("\n");
  }

  getResults(): DiagnosticResult[] {
    return this.results;
  }
}




