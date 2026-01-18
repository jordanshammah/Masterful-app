/**
 * Customer Settings View
 * Preferences and notification settings
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Bell, Globe, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerSettingsViewProps {
  customerId: string;
}

export const CustomerSettingsView = ({ customerId }: CustomerSettingsViewProps) => {
  const { toast } = useToast();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Settings</p>
        <h1 className="text-3xl font-semibold mt-2">Settings & Preferences</h1>
      </div>

      {/* Notifications */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Notifications</h3>
        </div>
        <div className="space-y-4">
          {[
            {
              id: "jobUpdates",
              label: "Job Updates",
              description: "Get notified when new jobs are available or status changes",
            },
            {
              id: "paymentUpdates",
              label: "Payment Notifications",
              description: "Notifications about payment processing and invoices",
            },
            {
              id: "accountAlerts",
              label: "Account Alerts",
              description: "Security updates and profile changes",
            },
            {
              id: "marketing",
              label: "Marketing Emails",
              description: "Receive tips, updates, and promotions",
            },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between border border-white/5 rounded-xl p-4">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-white/50">{item.description}</p>
              </div>
              <Switch
                defaultChecked={item.id !== "marketing"}
                onCheckedChange={(value) => {
                  toast({
                    title: value ? `${item.label} enabled` : `${item.label} disabled`,
                    description: "Notification settings updated.",
                  });
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Preferences */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-6 h-6 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Preferences</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70 mb-2 block">Language</Label>
            <Select defaultValue="en">
              <SelectTrigger className="bg-black border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-white/10">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white/70 mb-2 block">Timezone</Label>
            <Select defaultValue="utc">
              <SelectTrigger className="bg-black border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-white/10">
                <SelectItem value="utc">UTC</SelectItem>
                <SelectItem value="est">Eastern Time</SelectItem>
                <SelectItem value="pst">Pacific Time</SelectItem>
                <SelectItem value="cst">Central Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
};








