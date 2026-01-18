import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccountProfileProps {
  userId: string;
}

const AccountProfile = ({ userId }: AccountProfileProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, address, city")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          city: data.city || "",
        });
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error("Error fetching profile:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error("You must be signed in to update your profile. Please sign in and try again.");
      }

      // Verify the userId matches the authenticated user
      if (user.id !== userId) {
        throw new Error("You can only update your own profile.");
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update(profile)
        .eq("id", userId);

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Profile update error:", error);
        }
        // Provide more helpful error messages
        if (error.message.includes("API key") || error.message.includes("no API key")) {
          throw new Error("Authentication error. Please sign out and sign back in, then try again.");
        }
        if (error.code === "PGRST301" || error.code === "42501") {
          throw new Error("Permission denied. You may not have permission to update this profile.");
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error("Error updating profile:", error);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Profile Information</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={profile.full_name}
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={profile.address}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={profile.city}
            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Card>
  );
};

export default AccountProfile;
