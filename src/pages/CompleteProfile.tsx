import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { customerApi } from "@/lib/api/customer";
import { handlePostAuthRedirect } from "@/lib/utils/auth-redirect";

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
  });

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        // Check if profile is already complete
        const isComplete = await customerApi.isProfileComplete(user.id);
        if (isComplete) {
          // Profile is complete, redirect to dashboard
          await handlePostAuthRedirect(user.id, navigate);
          return;
        }

        // Load existing profile data
        const existingProfile = await customerApi.getProfile(user.id);
        setProfile({
          full_name: existingProfile.full_name || "",
          email: existingProfile.email || user.email || "",
          phone: existingProfile.phone || "",
          city: existingProfile.city || "",
        });
      } catch (error) {
        // Profile might not exist yet, that's okay
        console.log("Profile not found or incomplete, user needs to complete it");
        setProfile({
          full_name: "",
          email: user.email || "",
          phone: "",
          city: "",
        });
      } finally {
        setChecking(false);
      }
    };

    checkProfile();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to complete your profile.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    if (!profile.full_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Full name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number is required.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.city.trim()) {
      toast({
        title: "Validation Error",
        description: "City is required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Update profile
      await customerApi.updateProfile(user.id, {
        full_name: profile.full_name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        city: profile.city.trim(),
      });

      toast({
        title: "Success",
        description: "Profile completed successfully!",
      });

      // Redirect to dashboard
      await handlePostAuthRedirect(user.id, navigate);
    } catch (error: unknown) {
      console.error("Error completing profile:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/60">Checking profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 bg-[#1E1E1E] border-white/10">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-white/60 text-sm">
              Please provide the following information to continue using the app.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name" className="text-white">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                required
                className="bg-[#2A2A2A] border-white/10 text-white"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-white">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
                className="bg-[#2A2A2A] border-white/10 text-white"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-white">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                required
                className="bg-[#2A2A2A] border-white/10 text-white"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <Label htmlFor="city" className="text-white">
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                id="city"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                required
                className="bg-[#2A2A2A] border-white/10 text-white"
                placeholder="Enter your city"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D9743A] hover:bg-[#C6632A] text-white"
            >
              {loading ? "Saving..." : "Complete Profile"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default CompleteProfile;



