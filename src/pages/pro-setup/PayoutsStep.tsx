/**
 * Pro Setup - Step 3: Payouts
 * Collects provider payout method (bank or M-Pesa) and completes setup
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { proPayoutMethodsApi } from "@/lib/api/pro-enhanced";
import { upgradeToProvider, clearWantsProvider } from "@/lib/utils/auth-redirect";

const normalizeMpesaNumber = (input: string): string => {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return digits;
};

export const PayoutsStep = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: "mpesa" as "mpesa" | "bank",
    label: "",
    accountName: "",
    accountNumber: "",
    bankCode: "",
    country: "KE",
  });

  const handleBack = () => {
    navigate("/pro/setup/address");
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to complete setup",
        variant: "destructive",
      });
      return;
    }

    if (!formData.accountName || !formData.accountNumber) {
      toast({
        title: "Missing payout details",
        description: "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.type === "bank" && !formData.bankCode) {
      toast({
        title: "Missing bank code",
        description: "Please enter your bank code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const basicInfoStr = sessionStorage.getItem("pro_setup_basic_info");
      const addressStr = sessionStorage.getItem("pro_setup_address");

      if (!basicInfoStr) {
        throw new Error("Basic info not found. Please start over.");
      }

      const basicInfo = JSON.parse(basicInfoStr);
      const address = addressStr ? JSON.parse(addressStr) : null;

      // Step 1: Upgrade to provider role BEFORE creating provider profile
      await upgradeToProvider(user.id);
      await new Promise(resolve => setTimeout(resolve, 500));
      await queryClient.invalidateQueries({ queryKey: ["userRoles", user.id] });
      await queryClient.refetchQueries({ queryKey: ["userRoles", user.id] });

      // Step 2: Persist provider profile + address via Edge Function
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("id", user.id)
        .single();

      const profileImageUrl =
        currentProfile?.photo_url ||
        user.user_metadata?.avatar_url ||
        user.user_metadata?.photo_url ||
        null;

      const { data: onboardData, error: onboardError } = await supabase.functions.invoke("onboard-provider", {
        body: {
          display_name: basicInfo.displayName,
          business_name: basicInfo.businessName,
          category_id: basicInfo.categoryId,
          bio: basicInfo.bio,
          hourly_rate: parseFloat(basicInfo.hourlyRate),
          profile_image_url: profileImageUrl,
          address: address
            ? {
                label: address.addressLabel || "Business Address",
                street: address.addressStreet,
                city: address.addressCity,
                region: address.addressRegion,
                postal_code: address.addressPostalCode,
                country: address.addressCountry || "US",
                is_primary: address.isPrimaryAddress,
              }
            : null,
        },
      });

      if (onboardError) {
        let errorMessage = onboardError.message || "Failed to onboard provider";
        const context = (onboardError as any)?.context;
        if (context?.response) {
          try {
            const responseText = await context.response.text();
            if (responseText) {
              try {
                const parsed = JSON.parse(responseText);
                errorMessage = parsed?.error || responseText;
              } catch {
                errorMessage = responseText;
              }
            }
          } catch (parseError) {
            console.warn("[PayoutsStep] Failed to parse onboard-provider error:", parseError);
          }
        }
        throw new Error(errorMessage);
      }

      if (onboardData && typeof onboardData === "object" && "error" in onboardData) {
        throw new Error((onboardData as any).error || "Failed to onboard provider");
      }

      // Step 3: Create payout method
      const accountNumber =
        formData.type === "mpesa" ? normalizeMpesaNumber(formData.accountNumber) : formData.accountNumber;

      const payoutMethod = await proPayoutMethodsApi.create({
        providerId: user.id,
        type: formData.type,
        label: formData.label || (formData.type === "bank" ? "Bank Account" : "M-Pesa"),
        accountName: formData.accountName,
        accountNumber,
        bankCode: formData.type === "bank" ? formData.bankCode : undefined,
        country: formData.country,
        isDefault: true,
      });

      // Step 4: Create subaccount (non-blocking)
      try {
        await proPayoutMethodsApi.createSubaccount(user.id, payoutMethod.id);
      } catch (subError: any) {
        console.warn("[PayoutsStep] Subaccount creation warning:", subError?.message || subError);
      }

      // Clear sessionStorage
      sessionStorage.removeItem("pro_setup_basic_info");
      sessionStorage.removeItem("pro_setup_address");

      // Set a flag to prevent redirect loops - ProDashboard will check this
      sessionStorage.setItem("pro_setup_complete", "true");

      // Clear wants_provider flag AFTER setting the completion flag
      clearWantsProvider();

      toast({
        title: "Welcome to Masterful Pro!",
        description: "Your provider account has been created successfully.",
      });

      navigate("/dashboard/pro", { replace: true });
    } catch (error: any) {
      console.error("[PayoutsStep] Setup failed:", error);
      toast({
        title: "Setup failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Payout Details</h1>
        <p className="text-[#A6A6A6]">Add where you want to receive payments</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <Label className="text-white mb-2 block">Payout Method *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as "bank" | "mpesa" }))}
          >
            <SelectTrigger className="bg-[#1E1E1E] border-white/10 text-white h-12">
              <SelectValue placeholder="Select payout method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mpesa">M-Pesa</SelectItem>
              <SelectItem value="bank">Bank Account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-white mb-2 block">Account Holder Name *</Label>
          <Input
            value={formData.accountName}
            onChange={(e) => setFormData((prev) => ({ ...prev, accountName: e.target.value }))}
            placeholder="Full name on account"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>

        <div>
          <Label className="text-white mb-2 block">
            {formData.type === "bank" ? "Account Number *" : "M-Pesa Number *"}
          </Label>
          <Input
            value={formData.accountNumber}
            onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
            placeholder={formData.type === "bank" ? "Account number" : "2547XXXXXXXX"}
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>

        {formData.type === "bank" && (
          <div>
            <Label className="text-white mb-2 block">Bank Code *</Label>
            <Input
              value={formData.bankCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, bankCode: e.target.value }))}
              placeholder="Bank code"
              className="bg-[#1E1E1E] border-white/10 text-white h-12"
            />
          </div>
        )}

        <div>
          <Label className="text-white mb-2 block">Label (Optional)</Label>
          <Input
            value={formData.label}
            onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="e.g. Primary Account"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-12">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-[#A6A6A6] hover:text-white"
        >
          Back
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-12 px-8"
        >
          {loading ? "Saving..." : "Complete Setup"}
        </Button>
      </div>
    </div>
  );
};
