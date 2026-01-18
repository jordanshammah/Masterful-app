/**
 * Pro Setup - Step 2: Address
 * Uses unified addresses table
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { providerAddressApi } from "@/lib/api/customer-enhanced";
import { upgradeToProvider, clearWantsProvider } from "@/lib/utils/auth-redirect";

export const AddressStep = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    addressLabel: "Business Address",
    addressStreet: "",
    addressCity: "",
    addressRegion: "",
    addressPostalCode: "",
    addressCountry: "US",
    isPrimaryAddress: true,
  });

  // Load from sessionStorage if available
  useEffect(() => {
    const saved = sessionStorage.getItem("pro_setup_address");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.warn("[AddressStep] Failed to parse saved form data");
      }
    }
  }, []);

  const handleBecomePro = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to complete setup",
        variant: "destructive",
      });
      return;
    }

    if (!formData.addressStreet || !formData.addressCity || !formData.addressRegion || !formData.addressPostalCode) {
      toast({
        title: "Please complete all address fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Save address and continue to payout setup step
    try {
      sessionStorage.setItem("pro_setup_address", JSON.stringify(formData));
      navigate("/pro/setup/payouts");
    } finally {
      setLoading(false);
    }
    return;
    
    try {
      console.log("[AddressStep] Starting provider setup completion");

      // Get saved form data from sessionStorage
      const basicInfoStr = sessionStorage.getItem("pro_setup_basic_info");
      
      if (!basicInfoStr) {
        throw new Error("Basic info not found. Please start over.");
      }

      const basicInfo = JSON.parse(basicInfoStr);

      console.log("[AddressStep] Form data:", { basicInfo, address: formData });
      console.log("[AddressStep] basicInfo keys:", Object.keys(basicInfo));

      // Step 1: Get current profile to retrieve profile_image_url
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("id", user.id)
        .single();

      // Step 2: Update profile with business info
      // Store display_name as full_name, and business_name if provided
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: basicInfo.displayName,
          city: formData.addressCity || null,
          // Note: If profiles table has business_name column, add it here
          // business_name: basicInfo.businessName || null,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("[AddressStep] Profile update error:", profileError);
      }

      // Step 3: Save provider address (optional - don't fail if this doesn't work)
      // NOTE: We're NOT sending latitude/longitude since they don't exist in the addresses table
      if (formData.addressStreet && formData.addressCity && formData.addressRegion && formData.addressPostalCode) {
        try {
          console.log("[AddressStep] Step 3: Saving provider address...");
          await providerAddressApi.addAddress(user.id, {
            label: formData.addressLabel || "Business Address",
            street: formData.addressStreet,
            city: formData.addressCity,
            region: formData.addressRegion,
            postal_code: formData.addressPostalCode,
            country: formData.addressCountry || "US",
            // DO NOT include latitude/longitude - they don't exist in addresses table
            is_primary: formData.isPrimaryAddress,
          });
          console.log("[AddressStep] Address saved successfully");
        } catch (addressError: any) {
          console.warn("[AddressStep] Failed to save provider address (non-critical):", addressError);
          // Don't throw - address save is optional, continue with provider creation
        }
      } else {
        console.log("[AddressStep] Step 3: Skipping address save (incomplete address data)");
      }

      // Step 4: Upgrade to provider role FIRST
      // The RLS policy requires: auth.uid() = id AND public.has_role(auth.uid(), 'provider')
      // So we MUST add the role before we can insert into providers
      console.log("[AddressStep] Step 4: Upgrading user to provider role...");
      try {
        await upgradeToProvider(user.id);
        console.log("[AddressStep] User upgraded to provider role successfully");
        
        // Wait a moment for the database to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Invalidate and refetch user roles cache to ensure fresh data
        await queryClient.invalidateQueries({ queryKey: ["userRoles", user.id] });
        // Refetch to ensure fresh data is available before redirect
        await queryClient.refetchQueries({ queryKey: ["userRoles", user.id] });
        console.log("[AddressStep] Invalidated and refetched user roles cache");
        
        // Wait another moment to ensure roles are fully loaded
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (roleError: any) {
        console.error("[AddressStep] Error upgrading to provider role:", roleError);
        console.error("[AddressStep] Full error object:", JSON.stringify(roleError, null, 2));
        // Check if error is actually about providers table (which would be strange)
        if (roleError.message?.includes("providers") || roleError.message?.includes("latitude")) {
          console.error("[AddressStep] ERROR: Role upgrade error mentions providers/latitude!");
          console.error("[AddressStep] This suggests a database trigger or RLS policy issue");
          console.error("[AddressStep] The error might be from a previous operation that's cached");
        }
        throw new Error(`Failed to upgrade role: ${roleError.message || roleError}`);
      }

      // Step 5: Create provider profile AFTER role upgrade
      // Build explicit payload matching the ACTUAL database schema:
      // id, user_id, display_name, business_name, bio, profile_image_url, city, rating, is_active, is_verified, category_id, hourly_rate, created_at
      // Note: rating defaults to 0, created_at defaults to now() - don't include
      console.log("[AddressStep] Step 5: Creating provider profile...");
      const profileImageUrl = currentProfile?.photo_url || user.user_metadata?.avatar_url || user.user_metadata?.photo_url || null;
      
      // Build payload with ONLY fields that exist in providers table
      // CRITICAL: Do NOT include latitude, longitude, or any other fields that don't exist
      const payload = {
        id: user.id, // UUID primary key
        user_id: user.id, // Required - must equal auth.uid() for RLS
        display_name: basicInfo.displayName ?? null,
        business_name: basicInfo.businessName ?? null,
        bio: basicInfo.bio ?? null,
        profile_image_url: profileImageUrl,
        city: formData.addressCity ?? null,
        category_id: basicInfo.categoryId,
        hourly_rate: parseFloat(basicInfo.hourlyRate),
        is_verified: false,
        is_active: false,
      };

      console.log("[AddressStep] Provider upsert payload:", payload);
      console.log("[AddressStep] Payload keys:", Object.keys(payload));
      
      // Verify no latitude/longitude in payload
      if ('latitude' in payload || 'longitude' in payload || 'location_lat' in payload || 'location_lng' in payload) {
        console.error("[AddressStep] ERROR: latitude/longitude found in payload!");
        throw new Error("Invalid payload: latitude/longitude should not be in providers payload");
      }

      console.log("[AddressStep] Attempting provider upsert...");
      const { data, error: providerError } = await supabase
        .from("providers")
        .upsert(payload as any, { onConflict: "id" });

      if (providerError) {
        console.error("[AddressStep] Provider upsert error:", providerError);
        console.error("[AddressStep] Error code:", providerError.code);
        console.error("[AddressStep] Error message:", providerError.message);
        console.error("[AddressStep] Error details:", JSON.stringify(providerError, null, 2));
        console.error("[AddressStep] Payload that was sent:", JSON.stringify(payload, null, 2));
        throw new Error(`Failed to create provider profile: ${providerError.message || JSON.stringify(providerError)}`);
      } else {
        console.log("[AddressStep] Provider upsert succeeded:", data);
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

      // Redirect to pro dashboard
      console.log("[AddressStep] Redirecting to /dashboard/pro");
      // Use a small delay to ensure all state is updated
      setTimeout(() => {
        navigate("/dashboard/pro", { replace: true });
      }, 100);
    } catch (error: any) {
      console.error("[AddressStep] Setup failed:", error);
      toast({
        title: "Setup failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate("/pro/setup/basic-info");
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Business Address</h1>
        <p className="text-[#A6A6A6]">Where will you provide services?</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <Label className="text-white mb-2 block">Address Label</Label>
          <Input
            value={formData.addressLabel}
            onChange={(e) => setFormData((prev) => ({ ...prev, addressLabel: e.target.value }))}
            placeholder="Business Address"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>

        <div>
          <Label className="text-white mb-2 block">Street Address *</Label>
          <Input
            value={formData.addressStreet}
            onChange={(e) => setFormData((prev) => ({ ...prev, addressStreet: e.target.value }))}
            placeholder="123 Main St"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-white mb-2 block">City *</Label>
            <Input
              value={formData.addressCity}
              onChange={(e) => setFormData((prev) => ({ ...prev, addressCity: e.target.value }))}
              placeholder="City"
              className="bg-[#1E1E1E] border-white/10 text-white h-12"
            />
          </div>
          <div>
            <Label className="text-white mb-2 block">Region/State *</Label>
            <Input
              value={formData.addressRegion}
              onChange={(e) => setFormData((prev) => ({ ...prev, addressRegion: e.target.value }))}
              placeholder="CA"
              className="bg-[#1E1E1E] border-white/10 text-white h-12"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-white mb-2 block">Postal Code *</Label>
            <Input
              value={formData.addressPostalCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, addressPostalCode: e.target.value }))}
              placeholder="12345"
              className="bg-[#1E1E1E] border-white/10 text-white h-12"
            />
          </div>
          <div>
            <Label className="text-white mb-2 block">Country</Label>
            <Input
              value={formData.addressCountry}
              onChange={(e) => setFormData((prev) => ({ ...prev, addressCountry: e.target.value }))}
              placeholder="US"
              className="bg-[#1E1E1E] border-white/10 text-white h-12"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-4 bg-[#121212] border border-white/10 rounded-[12px]">
          <input
            type="checkbox"
            id="is-primary"
            checked={formData.isPrimaryAddress}
            onChange={(e) => setFormData((prev) => ({ ...prev, isPrimaryAddress: e.target.checked }))}
            className="w-4 h-4 rounded border-white/20 bg-black text-[#D9743A]"
          />
          <Label htmlFor="is-primary" className="text-white/80 cursor-pointer flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Set as primary address
          </Label>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-12">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              clearWantsProvider();
              navigate("/");
            }}
            className="text-[#A6A6A6] hover:text-white"
          >
            Cancel
          </Button>
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-[#A6A6A6] hover:text-white"
        >
          Back
        </Button>
        </div>

        <Button
          onClick={handleBecomePro}
          disabled={loading}
          className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-12 px-8"
        >
          {loading ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
};

