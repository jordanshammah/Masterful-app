/**
 * Pro Setup - Step 3: Verification Documents
 * Final step - completes provider verification
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { completeProviderVerification } from "@/lib/utils/auth-redirect";
import { Upload } from "lucide-react";

export const VerificationStep = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    idDocument: null as File | null,
    goodConduct: null as File | null,
    certification: null as File | null,
  });

  const handleFileUpload = (field: "idDocument" | "certification" | "goodConduct", file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));
  };

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

    if (!formData.idDocument || !formData.goodConduct) {
      toast({
        title: "Please upload required documents",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      console.log("[VerificationStep] Starting provider setup completion");

      // Get saved form data from sessionStorage
      const basicInfoStr = sessionStorage.getItem("pro_setup_basic_info");
      const addressStr = sessionStorage.getItem("pro_setup_address");
      
      if (!basicInfoStr) {
        throw new Error("Basic info not found. Please start over.");
      }

      const basicInfo = JSON.parse(basicInfoStr);
      const address = addressStr ? JSON.parse(addressStr) : null;

      console.log("[VerificationStep] Form data:", { basicInfo, address });

      // Step 1: Persist provider profile + address via Edge Function
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
            console.warn("[VerificationStep] Failed to parse onboard-provider error:", parseError);
          }
        }
        throw new Error(errorMessage);
      }

      if (onboardData && typeof onboardData === "object" && "error" in onboardData) {
        throw new Error((onboardData as any).error || "Failed to onboard provider");
      }

      // Step 2: Complete provider verification - upgrade role from pending to provider
      await completeProviderVerification(user.id);
      console.log("[VerificationStep] Provider verification completed");

      // Clear sessionStorage
      sessionStorage.removeItem("pro_setup_basic_info");
      sessionStorage.removeItem("pro_setup_address");
      sessionStorage.removeItem("intended_role");

      toast({
        title: "Setup complete!",
        description: "Your provider account is being reviewed. You'll be notified once verified.",
      });

      // Redirect to pro dashboard
      console.log("[VerificationStep] Redirecting to /dashboard/pro");
      navigate("/dashboard/pro", { replace: true });
    } catch (error: any) {
      console.error("[VerificationStep] Setup failed:", error);
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
        <h1 className="text-3xl font-bold">Verification Documents</h1>
        <p className="text-[#A6A6A6]">Help us verify your identity and credentials</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <Label className="text-white mb-2 block">Government ID *</Label>
          <div className="border-2 border-dashed border-white/10 rounded-[12px] p-8 text-center">
            <Upload className="w-8 h-8 mx-auto mb-3 text-[#A6A6A6]" />
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileUpload("idDocument", e.target.files?.[0] || null)}
              className="hidden"
              id="id-document"
            />
            <label htmlFor="id-document" className="cursor-pointer">
              <span className="text-[#D9743A] hover:text-[#C25A2C]">Click to upload</span>
              {formData.idDocument && (
                <p className="text-sm text-white mt-2">{formData.idDocument.name}</p>
              )}
            </label>
          </div>
        </div>

        <div>
          <Label className="text-white mb-2 block">Good Conduct Certificate *</Label>
          <div className="border-2 border-dashed border-white/10 rounded-[12px] p-8 text-center">
            <Upload className="w-8 h-8 mx-auto mb-3 text-[#A6A6A6]" />
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileUpload("goodConduct", e.target.files?.[0] || null)}
              className="hidden"
              id="good-conduct"
            />
            <label htmlFor="good-conduct" className="cursor-pointer">
              <span className="text-[#D9743A] hover:text-[#C25A2C]">Click to upload</span>
              {formData.goodConduct && (
                <p className="text-sm text-white mt-2">{formData.goodConduct.name}</p>
              )}
            </label>
          </div>
        </div>

        <div>
          <Label className="text-white mb-2 block">Certification (Optional)</Label>
          <p className="text-xs text-[#A6A6A6] mb-2">Electrical, plumbing, or other professional certifications</p>
          <div className="border-2 border-dashed border-white/10 rounded-[12px] p-8 text-center">
            <Upload className="w-8 h-8 mx-auto mb-3 text-[#A6A6A6]" />
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileUpload("certification", e.target.files?.[0] || null)}
              className="hidden"
              id="certification"
            />
            <label htmlFor="certification" className="cursor-pointer">
              <span className="text-[#D9743A] hover:text-[#C25A2C]">Click to upload</span>
              {formData.certification && (
                <p className="text-sm text-white mt-2">{formData.certification.name}</p>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Navigation */}
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
          {loading ? "Processing..." : "Complete Setup"}
        </Button>
      </div>
    </div>
  );
};




