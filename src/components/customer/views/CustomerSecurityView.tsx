/**
 * Customer Security View
 * Password, 2FA, and session management
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Smartphone, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CustomerSecurityViewProps {
  customerId: string;
}

export const CustomerSecurityView = ({ customerId }: CustomerSecurityViewProps) => {
  const { toast } = useToast();

  const sessions = [
    {
      id: "1",
      device: "MacOS • Chrome",
      location: "San Francisco, CA",
      ip_address: "192.168.1.1",
      last_active: new Date().toISOString(),
      is_current: true,
    },
    {
      id: "2",
      device: "iOS • Safari",
      location: "Los Angeles, CA",
      ip_address: "192.168.1.2",
      last_active: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      is_current: false,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Security</p>
        <h1 className="text-3xl font-semibold mt-2">Security & Privacy</h1>
      </div>

      {/* Password */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Password</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70 mb-2 block">Current Password</Label>
            <Input
              type="password"
              value="••••••••••••"
              disabled
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-white/50 mt-1">Last updated 32 days ago</p>
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => {
              toast({
                title: "Password reset",
                description: "Check your email for reset instructions.",
              });
            }}
          >
            Change Password
          </Button>
        </div>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-[#C25A2C]" />
            <div>
              <h3 className="text-xl font-semibold">Two-Factor Authentication</h3>
              <p className="text-sm text-white/50">Keep your account locked to your devices</p>
            </div>
          </div>
          <Switch
            defaultChecked
            onCheckedChange={(value) => {
              toast({
                title: value ? "2FA enabled" : "2FA disabled",
                description: "Security settings updated.",
              });
            }}
          />
        </div>
        <p className="text-sm text-white/60">
          Use passkeys or SMS codes. Biometric fallback is supported on enrolled devices.
        </p>
      </Card>

      {/* Active Sessions */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Monitor className="w-6 h-6 text-[#C25A2C]" />
            <h3 className="text-xl font-semibold">Active Sessions</h3>
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => {
              toast({
                title: "Sessions terminated",
                description: "All other sessions have been logged out.",
              });
            }}
          >
            Terminate All Sessions
          </Button>
        </div>
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between border border-white/5 p-4 rounded-xl"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{session.device}</p>
                  {session.is_current && (
                    <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/20">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-white/50">{session.location}</p>
                <p className="text-xs text-white/40 mt-1">IP: {session.ip_address}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white/40">
                  {session.is_current
                    ? "Active now"
                    : format(new Date(session.last_active), "MMM d, h:mm a")}
                </span>
                {!session.is_current && (
                  <Button variant="ghost" className="text-white/60 hover:text-white">
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Login Activity */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold mb-4">Login Activity Log</h3>
        <div className="space-y-3">
          {[
            { action: "Login successful", location: "San Francisco, CA", time: "2h ago" },
            { action: "Password reset link requested", location: "Los Angeles, CA", time: "1d ago" },
            { action: "Profile updated", location: "San Francisco, CA", time: "3d ago" },
          ].map((log, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
              <div>
                <p className="text-white/80">{log.action}</p>
                <p className="text-white/40 text-xs">{log.location}</p>
              </div>
              <p className="text-white/40">{log.time}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};








