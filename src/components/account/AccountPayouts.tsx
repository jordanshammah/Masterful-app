import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCreatePayoutMethod, useCreateSubaccount, usePayoutMethods, useSetDefaultPayoutMethod } from "@/hooks/useProEnhanced";

const normalizeMpesaNumber = (input: string): string => {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return digits;
};

const AccountPayouts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const providerId = user?.id || "";

  const { data: payoutMethods = [], isLoading, error: payoutMethodsError } = usePayoutMethods(providerId);
  const createPayoutMethod = useCreatePayoutMethod();
  const createSubaccount = useCreateSubaccount();
  const setDefault = useSetDefaultPayoutMethod();

  const [formData, setFormData] = useState({
    type: "mpesa" as "mpesa" | "bank",
    label: "",
    accountName: "",
    accountNumber: "",
    bankCode: "",
    country: "KE",
  });

  const handleCreate = async () => {
    if (!providerId) return;
    if (!formData.accountName || !formData.accountNumber) {
      toast({
        title: "Missing details",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.type === "bank" && !formData.bankCode) {
      toast({
        title: "Missing bank code",
        description: "Please provide a bank code.",
        variant: "destructive",
      });
      return;
    }

    try {
      const accountNumber =
        formData.type === "mpesa" ? normalizeMpesaNumber(formData.accountNumber) : formData.accountNumber;

      const payoutMethod = await createPayoutMethod.mutateAsync({
        providerId,
        type: formData.type,
        label: formData.label || (formData.type === "bank" ? "Bank Account" : "M-Pesa"),
        accountName: formData.accountName,
        accountNumber,
        bankCode: formData.type === "bank" ? formData.bankCode : undefined,
        country: formData.country,
        isDefault: true,
      });

      try {
        await createSubaccount.mutateAsync({
          providerId,
          payoutMethodId: payoutMethod.id,
        });
      } catch (error: any) {
        console.warn("[AccountPayouts] Subaccount creation warning:", error?.message || error);
      }

      toast({
        title: "Payout method added",
        description: "Your payout method has been saved successfully.",
      });

      setFormData({
        type: "mpesa",
        label: "",
        accountName: "",
        accountNumber: "",
        bankCode: "",
        country: "KE",
      });
    } catch (error: any) {
      toast({
        title: "Failed to save payout method",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Payout Methods</h2>
        <p className="text-sm text-white/60">Manage where you receive payments</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-white/60">Loading payout methods...</div>
        ) : payoutMethodsError ? (
          <div className="border border-red-500/50 rounded-xl p-4 bg-red-500/10">
            <p className="text-sm text-red-400 font-medium">Error loading payout methods</p>
            <p className="text-xs text-red-300 mt-1">
              {payoutMethodsError instanceof Error ? payoutMethodsError.message : "Unknown error"}
            </p>
            <p className="text-xs text-white/60 mt-2">
              Check browser console (F12) for details. If this persists, ensure the Edge Function "list-payout-methods" is deployed.
            </p>
          </div>
        ) : payoutMethods.length === 0 ? (
          <div className="text-sm text-white/60">No payout methods yet.</div>
        ) : (
          payoutMethods.map((method) => (
            <div key={method.id} className="border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-white">
                  {method.label || (method.type === "bank" ? "Bank Account" : "M-Pesa")}
                </p>
                <p className="text-xs text-white/60">
                  {method.type.toUpperCase()} • {method.account_number}
                </p>
                <p className="text-xs text-white/50">
                  Subaccount: {method.paystack_subaccount_id ? "Created" : "Not created"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!method.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDefault.mutateAsync({ providerId, payoutMethodId: method.id })
                    }
                  >
                    Set Default
                  </Button>
                )}
                {!method.paystack_subaccount_id && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await createSubaccount.mutateAsync({ providerId, payoutMethodId: method.id });
                        toast({
                          title: "Subaccount created",
                          description: "Paystack subaccount has been created successfully.",
                        });
                      } catch (error: any) {
                        console.error("[AccountPayouts] Subaccount creation error:", error);
                        toast({
                          title: "Failed to create subaccount",
                          description: error.message || "Please try again or check the console for details.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={createSubaccount.isPending}
                  >
                    {createSubaccount.isPending ? "Creating..." : "Create Subaccount"}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-4 border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold">Add Payout Method</h3>
        <div className="grid gap-4">
          <div>
            <Label className="text-white mb-2 block">Payout Method *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as "bank" | "mpesa" }))}
            >
              <SelectTrigger className="bg-[#1E1E1E] border-white/10 text-white h-11">
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
              className="bg-[#1E1E1E] border-white/10 text-white h-11"
            />
          </div>

          <div>
            <Label className="text-white mb-2 block">
              {formData.type === "bank" ? "Account Number *" : "M-Pesa Number *"}
            </Label>
            <Input
              value={formData.accountNumber}
              onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
              className="bg-[#1E1E1E] border-white/10 text-white h-11"
            />
          </div>

          {formData.type === "bank" && (
            <div>
              <Label className="text-white mb-2 block">Bank Code *</Label>
              <Input
                value={formData.bankCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, bankCode: e.target.value }))}
                className="bg-[#1E1E1E] border-white/10 text-white h-11"
              />
            </div>
          )}

          <div>
            <Label className="text-white mb-2 block">Label (Optional)</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
              className="bg-[#1E1E1E] border-white/10 text-white h-11"
            />
          </div>

          <Button onClick={handleCreate} disabled={createPayoutMethod.isPending}>
            {createPayoutMethod.isPending ? "Saving..." : "Add Payout Method"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccountPayouts;
