/**
 * Pro Setup - Step 1: Basic Info
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { clearWantsProvider } from "@/lib/utils/auth-redirect";
import { User, Wrench, Zap, Sprout, Sparkles, Check } from "lucide-react";

interface ServiceCategory {
  id: number;
  name: string;
  description?: string;
}

// Map category names to icons with neon outline style
const getCategoryIcon = (name: string, isSelected: boolean = false) => {
  const iconClass = `w-8 h-8 stroke-2 ${isSelected ? "stroke-[#D9743A]" : "stroke-[#D9743A]/70"} fill-none`;
  const lowerName = name.toLowerCase();
  if (lowerName.includes("plumb")) return <Wrench className={iconClass} />;
  if (lowerName.includes("electric")) return <Zap className={iconClass} />;
  if (lowerName.includes("garden")) return <Sprout className={iconClass} />;
  if (lowerName.includes("clean")) return <Sparkles className={iconClass} />;
  return <Wrench className={iconClass} />;
};

export const BasicInfoStep = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  
  const [formData, setFormData] = useState({
    displayName: "",
    businessName: "",
    categoryId: 0,
    hourlyRate: "",
    bio: "",
  });

  // Fetch service categories from database
    const fetchCategories = async () => {
      try {
      console.log("[BasicInfoStep] Fetching service categories...");
      setLoadingCategories(true);
      
        const { data, error } = await supabase
          .from("service_categories")
          .select("id, name, description")
          .order("name");
        
      console.log("[BasicInfoStep] Categories query result:", { data, error });
      
      if (error) {
        console.error("[BasicInfoStep] Supabase error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
        
      if (data && Array.isArray(data) && data.length > 0) {
        console.log("[BasicInfoStep] Categories loaded from database:", data.length, data);
          setCategories(data);
      } else {
        console.warn("[BasicInfoStep] No categories found in database, data:", data);
        // Set fallback categories if database is empty
        const fallbackCategories = [
          { id: 1, name: "Plumbing", description: "Professional plumbing services" },
          { id: 2, name: "Electrician", description: "Licensed electrical services" },
          { id: 3, name: "Gardening", description: "Garden maintenance and landscaping" },
          { id: 4, name: "House Cleaning", description: "Professional cleaning services" },
        ];
        console.log("[BasicInfoStep] Using fallback categories:", fallbackCategories);
        setCategories(fallbackCategories);
        }
      } catch (error: any) {
        console.error("[BasicInfoStep] Error fetching categories:", error);
      // Set fallback categories on error
      const fallbackCategories = [
        { id: 1, name: "Plumbing", description: "Professional plumbing services" },
        { id: 2, name: "Electrician", description: "Licensed electrical services" },
        { id: 3, name: "Gardening", description: "Garden maintenance and landscaping" },
        { id: 4, name: "House Cleaning", description: "Professional cleaning services" },
      ];
      console.log("[BasicInfoStep] Using fallback categories due to error:", fallbackCategories);
      setCategories(fallbackCategories);
        toast({
        title: "Warning",
        description: "Using default categories. Please check database connection.",
        variant: "default",
        });
      } finally {
        setLoadingCategories(false);
      }
    };

  // Fetch service categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Debug: Log when categories change
  useEffect(() => {
    console.log("[BasicInfoStep] Categories state updated:", categories.length, categories);
  }, [categories]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .single();
      
      if (data) {
        setUserProfile(data);
        setFormData(prev => ({ ...prev, displayName: data.full_name || "" }));
      }
    };

    fetchProfile();
  }, [user]);

  const handleNext = () => {
    if (!formData.displayName.trim() || !formData.categoryId || !formData.hourlyRate || !formData.bio.trim()) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    // Save to sessionStorage for persistence across steps
    sessionStorage.setItem("pro_setup_basic_info", JSON.stringify(formData));
    console.log("[BasicInfoStep] Saved form data, navigating to address step");
    navigate("/pro/setup/address");
  };

  // Load from sessionStorage if available
  useEffect(() => {
    const saved = sessionStorage.getItem("pro_setup_basic_info");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.warn("[BasicInfoStep] Failed to parse saved form data");
      }
    }
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Basic Pro Details</h1>
        <p className="text-[#A6A6A6]">Tell us about yourself and your services</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Contact Details Preview (Read-only) */}
        <div className="p-6 bg-[#121212] border border-white/10 rounded-[12px]">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[#D9743A]" />
            Contact Details
          </h3>
          <div className="space-y-2 text-sm">
            <p className="text-[#A6A6A6]">
              <span className="text-white/70">Email:</span> {userProfile?.email || user?.email || "N/A"}
            </p>
            {userProfile?.phone && (
              <p className="text-[#A6A6A6]">
                <span className="text-white/70">Phone:</span> {userProfile.phone}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label className="text-white mb-2 block">Display Name *</Label>
          <Input
            value={formData.displayName}
            onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
            placeholder="Your name"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>

        <div>
          <Label className="text-white mb-2 block">Business Name (Optional)</Label>
          <Input
            value={formData.businessName}
            onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
            placeholder="Your business name (leave blank for solo freelancers)"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
        </div>

        <div>
          <Label className="text-white mb-4 block text-lg font-semibold">Service Category *</Label>
          {loadingCategories ? (
            <div className="text-center py-12 text-[#A6A6A6]">
              <div className="w-8 h-8 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-[#A6A6A6] space-y-4">
              <p>No categories available</p>
              <p className="text-xs text-[#A6A6A6]/70">Check browser console (F12) for details</p>
              <Button
                onClick={() => {
                  console.log("[BasicInfoStep] Retrying category fetch...");
                  fetchCategories();
                }}
                variant="outline"
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((category) => {
                const isSelected = formData.categoryId === category.id;
                return (
                <button
                  key={category.id}
                    type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, categoryId: category.id }))}
                    className={`group relative p-6 bg-[#121212] border-2 rounded-[12px] transition-all text-left hover:scale-[1.02] ${
                      isSelected
                        ? "border-[#D9743A] bg-[#D9743A]/10 shadow-lg shadow-[#D9743A]/20"
                        : "border-white/10 hover:border-[#D9743A]/50 hover:bg-[#121212]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`relative flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-[#D9743A]/10"
                          : "bg-white/5 group-hover:bg-[#D9743A]/10"
                      }`}>
                        <div className={`transition-all ${
                          isSelected ? "drop-shadow-[0_0_12px_rgba(217,116,58,0.8)]" : "group-hover:drop-shadow-[0_0_8px_rgba(217,116,58,0.5)]"
                        }`}>
                          {getCategoryIcon(category.name, isSelected)}
                        </div>
                        {isSelected && (
                          <div className="absolute inset-0 rounded-lg border-2 border-[#D9743A] shadow-[0_0_12px_rgba(217,116,58,0.5)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white text-lg">{category.name}</h3>
                          {isSelected && (
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#D9743A] flex items-center justify-center">
                              <Check className="w-4 h-4 text-black" />
                            </div>
                          )}
                        </div>
                  {category.description && (
                          <p className="text-sm text-[#A6A6A6] leading-relaxed">{category.description}</p>
                  )}
                      </div>
                    </div>
                </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Label className="text-white mb-2 block">Hourly Rate (USD) *</Label>
          <Input
            type="number"
            value={formData.hourlyRate}
            onChange={(e) => setFormData((prev) => ({ ...prev, hourlyRate: e.target.value }))}
            placeholder="50"
            className="bg-[#1E1E1E] border-white/10 text-white h-12"
          />
          <p className="text-xs text-[#A6A6A6] mt-1">Baseline rate, material costs can be added separately</p>
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
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-12">
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
          onClick={handleNext}
          className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-12 px-8"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

