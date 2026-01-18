/**
 * Pro Profile View
 * Profile management and verification
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCircle,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  DollarSign,
} from "lucide-react";
import { usePayoutMethods, useProProfileEnhanced, useUpdateProProfileEnhanced, useUploadDocuments } from "@/hooks/useProEnhanced";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ProProfileViewProps {
  providerId: string;
}

export const ProProfileView = ({ providerId }: ProProfileViewProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [minimumJobPrice, setMinimumJobPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");

  const { data: profile, isLoading } = useProProfileEnhanced(providerId);
  const { data: payoutMethods = [], isLoading: payoutMethodsLoading } = usePayoutMethods(providerId);
  const updateProfileMutation = useUpdateProProfileEnhanced();
  const uploadDocumentsMutation = useUploadDocuments();

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
      setMinimumJobPrice(profile.minimum_job_price?.toString() || "");
      setIsActive(profile.is_active);
      setBusinessName(profile.business_name || "");
      setCity(profile.profiles?.city || "");
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        id: providerId,
        updates: {
          bio: bio || undefined,
          minimum_job_price: minimumJobPrice ? parseFloat(minimumJobPrice) : undefined,
          is_active: isActive,
          business_name: businessName || undefined,
          city: city || undefined,
        },
      });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      await uploadDocumentsMutation.mutateAsync({
        providerId,
        files: Array.from(files),
      });
      toast({
        title: "Documents uploaded",
        description: "Your verification documents have been uploaded successfully.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload documents";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getVerificationStatus = () => {
    if (profile?.is_verified) {
      return {
        status: "verified",
        icon: CheckCircle2,
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        label: "Verified",
      };
    }
    return {
      status: "pending",
      icon: Clock,
      className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      label: "Pending Verification",
    };
  };

  const verificationStatus = getVerificationStatus();
  const StatusIcon = verificationStatus.icon;

  const displayName =
    profile?.profiles?.full_name?.trim() ||
    profile?.display_name?.trim() ||
    profile?.business_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    "Professional";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Profile</p>
          <h1 className="text-3xl font-semibold mt-2">Profile & Verification</h1>
        </div>
        {!isEditing && (
          <Button
            className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </Button>
        )}
      </div>

      {/* Verification Status */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#050505] border border-white/10">
              <Shield className="w-6 h-6 text-[#C25A2C]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Verification Status</h3>
              <Badge className={cn("border", verificationStatus.className)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {verificationStatus.label}
              </Badge>
            </div>
          </div>
          {!profile?.is_verified && (
            <div>
              <input
                type="file"
                id="document-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/10"
                onClick={() => document.getElementById("document-upload")?.click()}
                disabled={uploadDocumentsMutation.isPending}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadDocumentsMutation.isPending ? "Uploading..." : "Upload Documents"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Payout Methods</p>
            <p className="text-lg font-semibold mt-2">Saved payout details</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {payoutMethodsLoading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : payoutMethods.length === 0 ? (
            <p className="text-sm text-white/60">No payout methods saved yet.</p>
          ) : (
            payoutMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {method.label || (method.type === "bank" ? "Bank Account" : "M-Pesa")}
                  </p>
                  <p className="text-xs text-white/60">
                    {method.type.toUpperCase()} • {method.account_number}
                  </p>
                </div>
                <Badge className="border-[#D9743A]/40 bg-[#D9743A]/10 text-[#D9743A]">
                  {method.paystack_subaccount_id ? "Subaccount Ready" : "Pending Subaccount"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Profile Information */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-start gap-6 mb-6">
          <Avatar className="w-24 h-24 border-2 border-[#C25A2C]/30">
            <AvatarImage src={profile?.profiles?.photo_url || profile?.profile_image_url || undefined} alt={displayName} />
            <AvatarFallback className="bg-[#C25A2C]/20 text-[#C25A2C] text-2xl font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-1">
              {displayName}
            </h2>
            <p className="text-white/60 mb-2">{profile?.service_categories?.name || "Service Provider"}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#C25A2C]" />
                <span className="font-semibold">KES {profile?.minimum_job_price?.toLocaleString() || "0"} min</span>
              </div>
              {profile?.rating && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{profile.rating.toFixed(1)}</span>
                  <span className="text-sm text-white/50">({profile.review_count || 0} reviews)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Label className="text-white/70 mb-2 block">Bio</Label>
            {isEditing ? (
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell customers about your experience and expertise..."
                className="bg-black border-white/10 text-white placeholder:text-white/40 min-h-[120px]"
                maxLength={500}
              />
            ) : (
              <p className="text-white/80 bg-black/50 border border-white/10 rounded-lg p-4 min-h-[120px]">
                {profile?.bio || "No bio provided"}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Business Name */}
            <div>
              <Label className="text-white/70 mb-2 block">
                Business Name
              </Label>
              {isEditing ? (
                <Input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., ABC Plumbing Services"
                  className="bg-black border-white/10 text-white"
                  maxLength={120}
                />
              ) : (
                <div className="bg-black/50 border border-white/10 rounded-lg p-3">
                  <p className="text-white/80 font-semibold">
                    {profile?.business_name || "Not set"}
                  </p>
                </div>
              )}
            </div>

            {/* City */}
            <div>
              <Label className="text-white/70 mb-2 block">
                City
              </Label>
              {isEditing ? (
                <Input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Nairobi"
                  className="bg-black border-white/10 text-white"
                  maxLength={100}
                />
              ) : (
                <div className="bg-black/50 border border-white/10 rounded-lg p-3">
                  <p className="text-white/80 font-semibold">
                    {profile?.profiles?.city || "Not set"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Minimum Job Price - NEW for quote-based model */}
            <div>
              <Label className="text-white/70 mb-2 block">
                Minimum Job Price (KES) *
              </Label>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={minimumJobPrice}
                    onChange={(e) => setMinimumJobPrice(e.target.value)}
                    placeholder="e.g., 500"
                    className="bg-black border-white/10 text-white"
                    min="0"
                    step="50"
                  />
                  <p className="text-xs text-white/50">
                    The minimum amount you'll accept for any job. Customers will see this before booking.
                  </p>
                </div>
              ) : (
                <div className="bg-black/50 border border-white/10 rounded-lg p-3">
                  <p className="text-white/80 font-semibold">
                    KES {profile?.minimum_job_price?.toLocaleString() || "Not set"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Customers cannot pay below this amount
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label className="text-white/70 mb-2 block">Status</Label>
              {isEditing ? (
                <div className="flex items-center gap-3 p-3 bg-black/50 border border-white/10 rounded-lg">
                  <input
                    type="checkbox"
                    id="is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-black text-[#C25A2C] focus:ring-[#C25A2C]"
                  />
                  <Label htmlFor="is-active" className="text-white/80 cursor-pointer">
                    Available for new jobs
                  </Label>
                </div>
              ) : (
                <Badge
                  className={cn(
                    "border",
                    profile?.is_active
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  {profile?.is_active ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>

            {/* Quote-based pricing info */}
            <div>
              <Label className="text-white/70 mb-2 block">Pricing Model</Label>
              <div className="bg-[#D9743A]/10 border border-[#D9743A]/20 rounded-lg p-3">
                <p className="text-sm text-[#D9743A] font-medium">Quote-Based</p>
                <p className="text-xs text-white/50 mt-1">
                  You'll submit quotes on-site. Customers pay after job completion.
                </p>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  setIsEditing(false);
                  setBio(profile?.bio || "");
                  setMinimumJobPrice(profile?.minimum_job_price?.toString() || "");
                  setIsActive(profile?.is_active || false);
                  setBusinessName(profile?.business_name || "");
                  setCity(profile?.profiles?.city || "");
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

