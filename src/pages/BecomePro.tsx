/**
 * Provider Registration Flow - 4 Steps
 * Step 1: Choose Service Category
 * Step 2: Provider Profile Setup
 * Step 3: Upload Verification Documents
 * Step 4: Tier Selection
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { providerAddressApi } from "@/lib/api/customer-enhanced";
import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const categories = [
  { id: 1, name: "Plumbing", icon: "🔧" },
  { id: 2, name: "Electrician", icon: "⚡" },
  { id: 3, name: "Gardening", icon: "🌿" },
  { id: 4, name: "House Cleaning", icon: "🧹" },
];

const tiers = [
  {
    id: "standard",
    name: "Standard",
    price: "$29.99/month",
    features: ["Platform access", "Basic analytics", "Customer messaging"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$79.99/month",
    features: ["Everything in Standard", "Featured listings", "Advanced analytics", "Priority support"],
    popular: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$149.99/month",
    features: ["Everything in Premium", "Top placement in search", "Unlimited bookings", "Dedicated account manager"],
  },
];

const BecomePro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    categoryId: 0,
    businessName: "",
    bio: "",
    location: "",
    startingPrice: "",
    idDocument: null as File | null,
    certification: null as File | null,
    goodConduct: null as File | null,
    selectedTier: "",
    // Address fields
    addressLabel: "Business Address",
    addressStreet: "",
    addressCity: "",
    addressRegion: "",
    addressPostalCode: "",
    addressCountry: "US",
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleNext = () => {
    if (step === 1 && formData.categoryId === 0) {
      toast({
        title: "Please select a category",
        variant: "destructive",
      });
      return;
    }
    if (step === 2) {
      if (!formData.businessName.trim() || !formData.bio.trim() || !formData.location.trim() || !formData.startingPrice) {
        toast({
          title: "Please fill all required fields",
          variant: "destructive",
        });
        return;
      }
      // Validate address fields if provided
      if (formData.addressStreet && (!formData.addressCity || !formData.addressRegion || !formData.addressPostalCode)) {
        toast({
          title: "Please complete all address fields",
          variant: "destructive",
        });
        return;
      }
    }
    if (step === 3) {
      if (!formData.idDocument || !formData.goodConduct) {
        toast({
          title: "Please upload required documents",
          variant: "destructive",
        });
        return;
      }
    }
    if (step === 4 && !formData.selectedTier) {
      toast({
        title: "Please select a tier",
        variant: "destructive",
      });
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // First, update the user's profile with business info
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.businessName || user.user_metadata?.full_name,
          city: formData.location,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        // Don't throw - profile might already exist, continue with provider setup
      }

      // Set provider role (upsert to handle if it already exists)
      const { error: roleError } = await supabase.from("user_roles").upsert(
        {
          user_id: user.id,
          role: "provider",
        },
        {
          onConflict: "user_id,role",
        }
      );

      if (roleError) {
        console.error("Role error:", roleError);
        throw roleError;
      }

      // Create provider profile with correct column names
      // The providers table uses 'id' (not 'user_id') which references auth.users(id)
      const { error: providerError } = await supabase.from("providers").upsert(
        {
          id: user.id, // This is the correct column name per schema
          category_id: formData.categoryId,
          bio: formData.bio,
          hourly_rate: parseFloat(formData.startingPrice),
          is_verified: false, // Will be verified after document review
          is_active: true,
        },
        {
          onConflict: "id",
        }
      );

      if (providerError) {
        console.error("Provider error:", providerError);
        throw providerError;
      }

      // Save provider address if provided
      if (formData.addressStreet && formData.addressCity && formData.addressRegion && formData.addressPostalCode) {
        try {
          await providerAddressApi.addAddress(user.id, {
            label: formData.addressLabel || "Business Address",
            street: formData.addressStreet,
            city: formData.addressCity,
            region: formData.addressRegion,
            postal_code: formData.addressPostalCode,
            country: formData.addressCountry || "US",
            is_primary: true, // Set as primary address
          });
        } catch (addressError: any) {
          console.warn("Failed to save provider address:", addressError);
          // Don't fail registration if address save fails
        }
      }

      toast({
        title: "Registration successful!",
        description: "Your provider account is being reviewed. You'll be notified once verified.",
      });

      navigate("/dashboard/pro");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (field: "idDocument" | "certification" | "goodConduct", file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));
  };

  const progress = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 max-w-4xl">
          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#A6A6A6]">Step {step} of 4</span>
              <span className="text-sm text-[#A6A6A6]">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-[#1E1E1E] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#D9743A] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step 1: Choose Service Category */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Choose Your Service Category</h1>
                <p className="text-[#A6A6A6]">Select the type of service you'll provide</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setFormData((prev) => ({ ...prev, categoryId: category.id }))}
                    className={`p-8 bg-[#121212] border-2 rounded-[12px] transition-all ${
                      formData.categoryId === category.id
                        ? "border-[#D9743A] bg-[#D9743A]/10"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="text-4xl mb-3">{category.icon}</div>
                    <div className="font-semibold text-white">{category.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Provider Profile Setup */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Set Up Your Profile</h1>
                <p className="text-[#A6A6A6]">Tell customers about your business</p>
              </div>

              <div className="space-y-6 max-w-2xl mx-auto">
                <div>
                  <Label className="text-white mb-2 block">Business Name or Display Name *</Label>
                  <Input
                    value={formData.businessName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
                    placeholder="Your business name"
                    className="bg-[#1E1E1E] border-white/10 text-white h-12"
                  />
                </div>

                <div>
                  <Label className="text-white mb-2 block">Bio *</Label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                    placeholder="Brief description of your services (1-2 sentences)"
                    className="bg-[#1E1E1E] border-white/10 text-white min-h-[100px]"
                    maxLength={200}
                  />
                  <p className="text-xs text-[#A6A6A6] mt-1">{formData.bio.length}/200</p>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Location (City, State) *</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="City, State"
                    className="bg-[#1E1E1E] border-white/10 text-white h-12"
                  />
                </div>

                <div className="pt-4 border-t border-white/10">
                  <Label className="text-white mb-4 block text-lg">Business Address (Optional)</Label>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white/70 mb-2 block">Street Address</Label>
                      <Input
                        value={formData.addressStreet}
                        onChange={(e) => setFormData((prev) => ({ ...prev, addressStreet: e.target.value }))}
                        placeholder="123 Main St"
                        className="bg-[#1E1E1E] border-white/10 text-white h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white/70 mb-2 block">City</Label>
                        <Input
                          value={formData.addressCity}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressCity: e.target.value }))}
                          placeholder="City"
                          className="bg-[#1E1E1E] border-white/10 text-white h-12"
                        />
                      </div>
                      <div>
                        <Label className="text-white/70 mb-2 block">Region/State</Label>
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
                        <Label className="text-white/70 mb-2 block">Postal Code</Label>
                        <Input
                          value={formData.addressPostalCode}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressPostalCode: e.target.value }))}
                          placeholder="12345"
                          className="bg-[#1E1E1E] border-white/10 text-white h-12"
                        />
                      </div>
                      <div>
                        <Label className="text-white/70 mb-2 block">Country</Label>
                        <Input
                          value={formData.addressCountry}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressCountry: e.target.value }))}
                          placeholder="US"
                          className="bg-[#1E1E1E] border-white/10 text-white h-12"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Starting Price (per hour) *</Label>
                  <Input
                    type="number"
                    value={formData.startingPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startingPrice: e.target.value }))}
                    placeholder="50"
                    className="bg-[#1E1E1E] border-white/10 text-white h-12"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Upload Verification Documents */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Upload Verification Documents</h1>
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
                  <Label className="text-white mb-2 block">Certification (Optional)</Label>
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
              </div>
            </div>
          )}

          {/* Step 4: Tier Selection */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Choose Your Plan</h1>
                <p className="text-[#A6A6A6]">Select a subscription tier that fits your needs</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {tiers.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setFormData((prev) => ({ ...prev, selectedTier: tier.id }))}
                    className={`p-8 bg-[#121212] border-2 rounded-[12px] text-left transition-all ${
                      formData.selectedTier === tier.id
                        ? "border-[#D9743A] bg-[#D9743A]/10"
                        : "border-white/10 hover:border-white/20"
                    } ${tier.popular ? "ring-2 ring-[#D9743A]/30" : ""}`}
                  >
                    {tier.popular && (
                      <div className="text-xs font-semibold text-[#D9743A] mb-2">POPULAR</div>
                    )}
                    <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                    <div className="text-2xl font-bold text-white mb-4">{tier.price}</div>
                    <ul className="space-y-2">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-[#A6A6A6]">
                          <Check className="w-4 h-4 text-[#D9743A] mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-12">
            <Button
              variant="ghost"
              onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : navigate("/")}
              className="text-[#A6A6A6] hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step > 1 ? "Back" : "Cancel"}
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
              className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-12 px-8"
            >
              {loading ? "Processing..." : step === 4 ? "Complete Registration" : "Continue"}
              {step < 4 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BecomePro;
