/**
 * Pro Settings View
 * Account settings and preferences
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Bell,
  Shield,
  Globe,
  Moon,
  Sun,
} from "lucide-react";

export const ProSettingsView = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Settings</p>
        <h1 className="text-3xl font-semibold mt-2">Settings & Preferences</h1>
      </div>

      {/* Notifications */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white/80">Job Requests</Label>
              <p className="text-sm text-white/50">Get notified when new jobs are available</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white/80">Job Updates</Label>
              <p className="text-sm text-white/50">Notifications about job status changes</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white/80">Payment Notifications</Label>
              <p className="text-sm text-white/50">Get notified when payments are processed</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white/80">Marketing Emails</Label>
              <p className="text-sm text-white/50">Receive tips, updates, and promotions</p>
            </div>
            <Switch />
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Security</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white/80">Two-Factor Authentication</Label>
              <p className="text-sm text-white/50">Add an extra layer of security to your account</p>
            </div>
            <Switch />
          </div>
          <div>
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
            >
              Change Password
            </Button>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Preferences</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-white/80 mb-2 block">Language</Label>
            <select className="w-full bg-black border border-white/10 text-white rounded-lg px-3 py-2">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
          <div>
            <Label className="text-white/80 mb-2 block">Timezone</Label>
            <select className="w-full bg-black border border-white/10 text-white rounded-lg px-3 py-2">
              <option value="utc">UTC</option>
              <option value="est">Eastern Time</option>
              <option value="pst">Pacific Time</option>
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
};








