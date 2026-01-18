/**
 * Customer Account Details View
 * Profile information and address management
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserCircle, MapPin, Plus, Trash2, Edit } from "lucide-react";
import { useCustomerProfile } from "@/hooks/useCustomer";
import { useAddresses, useAddAddress, useDeleteAddress } from "@/hooks/useCustomerEnhanced";
import { useUpdateProfile } from "@/hooks/useCustomer";
import { useToast } from "@/hooks/use-toast";
import type { Address } from "@/types/customer-dashboard";

interface CustomerAccountViewProps {
  customerId: string;
}

export const CustomerAccountView = ({ customerId }: CustomerAccountViewProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [addAddressDialog, setAddAddressDialog] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  const { data: profile } = useCustomerProfile();
  const { data: addresses } = useAddresses(customerId);
  const updateProfileMutation = useUpdateProfile();
  const addAddressMutation = useAddAddress();
  const deleteAddressMutation = useDeleteAddress();

  const [newAddress, setNewAddress] = useState({
    label: "",
    street: "",
    city: "",
    region: "",
    postal_code: "",
    country: "US",
    is_primary: false,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.full_name || "");
      setPhone(profile.phone || "");
      setCity(profile.city || "");
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        full_name: name,
        phone: phone || undefined,
        city: city || undefined,
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

  const handleAddAddress = async () => {
    try {
      await addAddressMutation.mutateAsync({
        customerId,
        address: newAddress,
      });
      toast({
        title: "Address added",
        description: "Your address has been added successfully.",
      });
      setAddAddressDialog(false);
      setNewAddress({
        label: "",
        street: "",
        city: "",
        region: "",
        postal_code: "",
        country: "US",
        is_primary: false,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add address";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await deleteAddressMutation.mutateAsync(addressId);
      toast({
        title: "Address deleted",
        description: "Your address has been removed.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete address";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Account</p>
          <h1 className="text-3xl font-semibold mt-2">Account Details</h1>
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

      {/* Profile Information */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <UserCircle className="w-6 h-6 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Profile Information</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label className="text-white/70 mb-2 block">Full Name</Label>
            {isEditing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-black border-white/10 text-white"
              />
            ) : (
              <p className="text-white/80 bg-black/50 border border-white/10 rounded-lg p-3">
                {profile?.full_name || "Not set"}
              </p>
            )}
          </div>
          <div>
            <Label className="text-white/70 mb-2 block">Email</Label>
            <Input
              value={profile?.email || ""}
              disabled
              className="bg-white/5 border-white/10 text-white/60"
            />
          </div>
          <div>
            <Label className="text-white/70 mb-2 block">Phone</Label>
            {isEditing ? (
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-black border-white/10 text-white"
                placeholder="+1 (555) 123-4567"
              />
            ) : (
              <p className="text-white/80 bg-black/50 border border-white/10 rounded-lg p-3">
                {profile?.phone || "Not set"}
              </p>
            )}
          </div>
          <div>
            <Label className="text-white/70 mb-2 block">City</Label>
            {isEditing ? (
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-black border-white/10 text-white"
                placeholder="City, State"
              />
            ) : (
              <p className="text-white/80 bg-black/50 border border-white/10 rounded-lg p-3">
                {profile?.city || "Not set"}
              </p>
            )}
          </div>
        </div>
        {isEditing && (
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => {
                setIsEditing(false);
                setName(profile?.full_name || "");
                setPhone(profile?.phone || "");
                setCity(profile?.city || "");
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
      </Card>

      {/* Address Book */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Addresses</p>
            <h3 className="text-xl font-semibold mt-1">Address Book</h3>
          </div>
          <Button
            className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold gap-2"
            onClick={() => setAddAddressDialog(true)}
          >
            <Plus className="w-4 h-4" />
            Add Address
          </Button>
        </div>
        {addresses && addresses.length > 0 ? (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="flex items-start justify-between border border-white/5 rounded-xl p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-[#C25A2C]" />
                    <h4 className="font-semibold">{address.label}</h4>
                    {address.is_primary && (
                      <Badge className="bg-white/10 text-white border-white/10">Primary</Badge>
                    )}
                  </div>
                  <p className="text-sm text-white/60">
                    {address.street}, {address.city}, {address.region} {address.postal_code}
                    {address.country && `, ${address.country}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400/60 hover:text-red-400"
                  onClick={() => handleDeleteAddress(address.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="font-semibold mb-2">No addresses</h3>
            <p className="text-sm text-white/50 mb-4">Add an address to get started</p>
            <Button
              className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
              onClick={() => setAddAddressDialog(true)}
            >
              Add Address
            </Button>
          </div>
        )}
      </Card>

      {/* Add Address Dialog */}
      <Dialog open={addAddressDialog} onOpenChange={setAddAddressDialog}>
        <DialogContent className="bg-[#050505] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Address</DialogTitle>
            <DialogDescription className="text-white/60">
              Add a new address to your address book
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-white/70">Label</Label>
              <Input
                value={newAddress.label}
                onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                placeholder="Home, Work, etc."
                className="bg-black border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white/70">Street Address</Label>
              <Input
                value={newAddress.street}
                onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                placeholder="123 Main St"
                className="bg-black border-white/10 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white/70">City</Label>
                <Input
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="bg-black border-white/10 text-white mt-1"
                  placeholder="City"
                />
              </div>
              <div>
                <Label className="text-white/70">Region/State</Label>
                <Input
                  value={newAddress.region}
                  onChange={(e) => setNewAddress({ ...newAddress, region: e.target.value })}
                  placeholder="CA or State"
                  className="bg-black border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white/70">Postal Code</Label>
                <Input
                  value={newAddress.postal_code}
                  onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                  placeholder="12345"
                  className="bg-black border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white/70">Country</Label>
                <Input
                  value={newAddress.country}
                  onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                  placeholder="US"
                  className="bg-black border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-primary"
                checked={newAddress.is_primary}
                onChange={(e) => setNewAddress({ ...newAddress, is_primary: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-black text-[#C25A2C]"
              />
              <Label htmlFor="is-primary" className="text-white/80 cursor-pointer">
                Set as primary address
              </Label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  setAddAddressDialog(false);
                  setNewAddress({
                    label: "",
                    street: "",
                    city: "",
                    region: "",
                    postal_code: "",
                    country: "US",
                    is_primary: false,
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                onClick={handleAddAddress}
                disabled={addAddressMutation.isPending}
              >
                {addAddressMutation.isPending ? "Adding..." : "Add Address"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};








