import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchUserRolesWithProviderFallback } from "@/lib/utils/roles";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import AccountPayouts from "@/components/account/AccountPayouts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const Account = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roleCheckLoading, setRoleCheckLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [activePage, setActivePage] = useState("dashboard");
  const [profileDetails, setProfileDetails] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    role: "Customer",
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [notificationsSettings, setNotificationsSettings] = useState({
    jobUpdates: true,
    paymentUpdates: true,
    marketing: false,
    product: true,
  });
  const [supportTickets] = useState([
    { id: "TCK-1021", subject: "Schedule adjustment", status: "Open", updated: "2h ago" },
    { id: "TCK-1018", subject: "Payment dispute", status: "Resolved", updated: "1d ago" },
    { id: "TCK-1004", subject: "Feature request", status: "Pending", updated: "3d ago" },
  ]);
  const [sessions] = useState([
    { id: "macos", location: "San Francisco, CA", device: "MacOS • Chrome", lastActive: "Active now" },
    { id: "ios", location: "Los Angeles, CA", device: "iOS • Safari", lastActive: "2 hours ago" },
  ]);
  const [devices] = useState([
    { name: "MacBook Pro", type: "Desktop", added: "Jan 12, 2025" },
    { name: "iPhone 15", type: "Mobile", added: "Feb 02, 2025" },
  ]);
  const [invoices] = useState([
    { id: "INV-2025-001", date: "Mar 01, 2025", amount: "$149.00", status: "Paid" },
    { id: "INV-2025-002", date: "Feb 01, 2025", amount: "$149.00", status: "Paid" },
    { id: "INV-2025-003", date: "Jan 01, 2025", amount: "$149.00", status: "Paid" },
  ]);
  const [transactions] = useState([
    { id: "TX-9812", type: "Job payment", amount: "$420.00", date: "Mar 04, 2025" },
    { id: "TX-9771", type: "Subscription", amount: "-$149.00", date: "Mar 01, 2025" },
    { id: "TX-9708", type: "Job payment", amount: "$260.00", date: "Feb 25, 2025" },
  ]);
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("en");
  const [region, setRegion] = useState("us");

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        setLoading(true);
        setRoleCheckLoading(true);

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!mounted) return;

        if (userError || !user) {
          navigate("/login");
          return;
        }

        setUser(user);
        setProfileDetails((prev) => ({ ...prev, email: user.email || "" }));

        const userRoles = await fetchUserRolesWithProviderFallback(user.id);
        if (!mounted) return;

          setRoles(userRoles);
          
          // Redirect customers to customer-specific account page IMMEDIATELY
          // Use replace: true to prevent back button from going to wrong page
          if (userRoles.includes("customer") && !userRoles.includes("provider")) {
            navigate("/account/customer", { replace: true });
            return;
          }
          
          // Redirect providers to the new pro dashboard IMMEDIATELY
          // Use replace: true to prevent back button from going to wrong page
          if (userRoles.includes("provider")) {
            navigate("/dashboard/pro", { replace: true });
            return;
          }
          
          // Only continue if user has no specific role or has both roles
          // In that case, they can use the general account page
          await fetchProfileDetails(user.id, userRoles);
      } catch (error: unknown) {
        if (!mounted) return;
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        if (mounted) {
          setLoading(false);
          setRoleCheckLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [navigate, toast]);

  const fetchProfileDetails = async (userId: string, userRoles: string[] = []) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, address")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // Continue with existing profile details
        return;
      }

      setProfileDetails((prev) => ({
        ...prev,
        name: data?.full_name || "",
        phone: data?.phone || "",
        address: data?.address || "",
        role: userRoles.includes("provider") ? "Pro" : "Customer",
      }));
    } catch (error) {
      console.error("Error in fetchProfileDetails:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDetailsSave = async () => {
    if (!user) return;
    setSavingDetails(true);
    try {
      await supabase
        .from("profiles")
        .update({
          full_name: profileDetails.name,
          phone: profileDetails.phone,
          address: profileDetails.address,
        })
        .eq("id", user.id);

      toast({
        title: "Saved",
        description: "Account details updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  // Show loading state
  if (loading || roleCheckLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-lg text-white/60">Loading account...</div>
      </div>
    );
  }

  // Don't render if no user (redirect will happen in useEffect)
  if (!user) {
    return null;
  }

  const isProvider = roles.includes("provider");
  const isCustomer = roles.includes("customer");

  // If customer only (not provider), don't render - redirect should happen
  // This prevents showing pro dashboard content to customers
  if (isCustomer && !isProvider) {
    return null;
  }

  // If provider only (not customer), don't render - redirect should happen
  // This prevents showing account page to providers
  if (isProvider && !isCustomer) {
    return null;
  }

  const renderMetricCard = (title: string, value: string, meta: string, accent?: string) => (
    <Card className="bg-[#050505] border-white/5 text-white p-5 rounded-2xl">
      <p className="text-sm uppercase tracking-[0.2em] text-white/50">{title}</p>
      <div className="flex items-end justify-between mt-4">
        <span className="text-3xl font-semibold">{value}</span>
        <span className="text-xs text-white/40">{meta}</span>
      </div>
      {accent && <span className="inline-flex mt-4 text-xs text-[#C25A2C]">{accent}</span>}
    </Card>
  );

  const dashboardContent = (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Overview</p>
          <h2 className="text-3xl font-semibold mt-2">Business health snapshot</h2>
        </div>
        <Button
          className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold px-6"
          onClick={() => toast({ title: "Sync requested", description: "Data refresh queued." })}
        >
          Sync Data
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {renderMetricCard("Total Jobs", isCustomer ? "42" : "128", "+6 this week")}
        {renderMetricCard("Completed", isCustomer ? "38" : "112", "92% completion")}
        {renderMetricCard("Account Status", "Active", "Verified", "All systems operational")}
        {renderMetricCard("Support Tickets", "2", "1 waiting on reply")}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Velocity</p>
              <h3 className="text-xl font-semibold">Job volume trend</h3>
            </div>
            <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border border-[#C25A2C]/20">
              Last 30 days
            </Badge>
          </div>
          <div className="h-48 bg-gradient-to-b from-white/10 via-transparent to-transparent rounded-xl relative overflow-hidden">
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C25A2C" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#C25A2C" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#C25A2C"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="20,140 80,100 140,120 200,80 260,90 320,50 380,70 440,30"
              />
              <polygon
                fill="url(#lineGradient)"
                points="20,140 80,100 140,120 200,80 260,90 320,50 380,70 440,30 440,180 20,180"
              />
            </svg>
            <div className="absolute inset-0 grid grid-rows-4 opacity-20">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="border-t border-white/5" />
              ))}
            </div>
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Revenue</p>
              <h3 className="text-xl font-semibold">Monthly earnings</h3>
            </div>
            <Select defaultValue="mtd">
              <SelectTrigger className="w-32 bg-black border-white/10 text-white">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-white/10">
                <SelectItem value="mtd">MTD</SelectItem>
                <SelectItem value="qtd">QTD</SelectItem>
                <SelectItem value="ytd">YTD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between h-48 gap-3">
            {[20, 50, 30, 70, 60, 90, 40, 80, 55, 95, 65, 110].map((value, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-[#C25A2C]/20 to-[#C25A2C]"
                  style={{ height: `${value}%`, borderRadius: "8px 8px 0 0" }}
                />
                <span className="text-[10px] text-white/40 mt-2">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][idx]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Announcements</p>
            <h3 className="text-xl font-semibold">Platform updates</h3>
          </div>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            View changelog
          </Button>
        </div>
        <div className="space-y-4">
          {[
            {
              title: "Realtime messaging",
              description: "Secure messaging between customers and pros now available.",
              date: "2 hours ago",
            },
            {
              title: "New billing center",
              description: "Manage invoices, payment methods, and subscriptions from one view.",
              date: "Yesterday",
            },
            {
              title: "Advanced security controls",
              description: "Device trust and biometric fallback rolled out to all pros.",
              date: "Mar 05",
            },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{item.title}</h4>
                <span className="text-xs text-white/40">{item.date}</span>
              </div>
              <p className="text-sm text-white/60 mt-2">{item.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const accountDetailsContent = (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Identity</p>
        <h2 className="text-3xl font-semibold mt-2">Account details</h2>
      </div>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/70">Name</Label>
            <Input
              value={profileDetails.name}
              onChange={(e) => setProfileDetails({ ...profileDetails, name: e.target.value })}
              className="bg-black border-white/10 text-white placeholder:text-white/40"
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Email</Label>
            <Input value={profileDetails.email} disabled className="bg-white/5 border-white/10 text-white/60" />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Phone</Label>
            <Input
              value={profileDetails.phone}
              onChange={(e) => setProfileDetails({ ...profileDetails, phone: e.target.value })}
              className="bg-black border-white/10 text-white placeholder:text-white/40"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Role</Label>
            <Select
              value={profileDetails.role}
              onValueChange={(value) => setProfileDetails({ ...profileDetails, role: value })}
            >
              <SelectTrigger className="bg-black border-white/10 text-white">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-white/10">
                <SelectItem value="Customer">Customer</SelectItem>
                <SelectItem value="Pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2 mt-6">
          <Label className="text-white/70">Address</Label>
          <Textarea
            value={profileDetails.address}
            onChange={(e) => setProfileDetails({ ...profileDetails, address: e.target.value })}
            className="bg-black border-white/10 text-white placeholder:text-white/40"
            placeholder="Street, City, Country"
          />
        </div>
        <div className="flex items-center gap-3 mt-6">
          <Button
            className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
            onClick={handleDetailsSave}
            disabled={savingDetails}
          >
            {savingDetails ? "Saving..." : "Save changes"}
          </Button>
          <p className="text-sm text-white/50">Changes go live instantly across all dashboards.</p>
        </div>
      </Card>
    </div>
  );

  const securityContent = (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Security</p>
        <h2 className="text-3xl font-semibold mt-2">Protection & Controls</h2>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Password</h3>
              <p className="text-sm text-white/50">Last updated 32 days ago</p>
            </div>
            <Button 
              variant="outline" 
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => toast({ title: "Password reset", description: "Check your email for reset instructions." })}
            >
              Reset
            </Button>
          </div>
          <Input type="password" value="••••••••••••" disabled className="bg-white/5 border-white/10" />
        </Card>

        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Two-factor authentication</h3>
              <p className="text-sm text-white/50">Keep your account locked to your devices</p>
            </div>
            <Switch
              checked
              onCheckedChange={(value) =>
                toast({ title: value ? "2FA enabled" : "2FA disabled", description: "Security settings updated." })
              }
            />
          </div>
          <p className="text-sm text-white/60">Use passkeys or SMS codes. Biometric fallback is supported on enrolled devices.</p>
        </Card>
      </div>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold mb-4">Active sessions</h3>
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between border border-white/5 p-4 rounded-xl">
              <div>
                <p className="font-medium">{session.device}</p>
                <p className="text-sm text-white/50">{session.location}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white/40">{session.lastActive}</span>
                <Button variant="ghost" className="text-white/60 hover:text-white">Revoke</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold mb-4">Authorized devices</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <div key={device.name} className="border border-white/5 rounded-xl p-4">
              <p className="font-medium">{device.name}</p>
              <p className="text-sm text-white/50">{device.type}</p>
              <p className="text-xs text-white/40 mt-2">Added {device.added}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold mb-4">Audit log</h3>
        <div className="space-y-3">
          {[
            { action: "Session created", time: "2h ago" },
            { action: "Password reset link requested", time: "1d ago" },
            { action: "Profile updated", time: "3d ago" },
          ].map((log) => (
            <div key={log.time} className="flex items-center justify-between text-sm">
              <p className="text-white/80">{log.action}</p>
              <p className="text-white/40">{log.time}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const notificationsContent = (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Notifications</p>
        <h2 className="text-3xl font-semibold mt-2">Stay informed on your terms</h2>
      </div>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-6">
        {[
          { id: "jobUpdates", label: "Job updates", description: "Status changes, reminders, ETA confirmations" },
          { id: "paymentUpdates", label: "Payment updates", description: "Invoices, receipts, failed payment alerts" },
          { id: "marketing", label: "Product updates", description: "Launches, beta invites, experiments" },
          { id: "product", label: "Growth stories", description: "Masterful insights and best practices" },
        ].map((item) => (
          <div key={item.id} className="flex items-center justify-between border border-white/5 rounded-xl p-4">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-white/50">{item.description}</p>
            </div>
            <Switch
              checked={notificationsSettings[item.id as keyof typeof notificationsSettings]}
              onCheckedChange={(value) =>
                setNotificationsSettings((prev) => ({ ...prev, [item.id]: value }))
              }
            />
          </div>
        ))}
      </Card>
    </div>
  );

  const billingContent = (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Billing</p>
          <h2 className="text-3xl font-semibold mt-2">Plan & Payments</h2>
        </div>
        <Button 
          className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
          onClick={() => toast({ title: "Add payment method", description: "Payment method form coming soon." })}
        >
          Add payment method
        </Button>
      </div>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Subscription</p>
            <h3 className="text-2xl font-semibold mt-1">Masterful Premium</h3>
            <p className="text-sm text-white/50">Renewing Apr 02, 2025 • $149 / month</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#C25A2C]/20 text-[#C25A2C] border border-[#C25A2C]/20">Active</Badge>
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
              Manage
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <h3 className="text-xl font-semibold mb-4">Payment methods</h3>
        <div className="space-y-4">
          {[
            { type: "Visa •••• 4242", exp: "09 / 28", primary: true },
            { type: "Amex •••• 1120", exp: "05 / 27", primary: false },
          ].map((card) => (
            <div key={card.type} className="flex items-center justify-between border border-white/5 rounded-xl p-4">
              <div>
                <p className="font-medium">{card.type}</p>
                <p className="text-sm text-white/50">Expires {card.exp}</p>
              </div>
              <div className="flex items-center gap-3">
                {card.primary && <Badge className="bg-white/10 text-white border-white/10">Primary</Badge>}
                <Button variant="ghost" className="text-white/60 hover:text-white">
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Invoices</h3>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            Download all
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-white/5">
              <TableHead className="text-white/50">Invoice</TableHead>
              <TableHead className="text-white/50">Date</TableHead>
              <TableHead className="text-white/50">Amount</TableHead>
              <TableHead className="text-white/50">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-white">{invoice.id}</TableCell>
                <TableCell className="text-white/60">{invoice.date}</TableCell>
                <TableCell className="text-white">{invoice.amount}</TableCell>
                <TableCell>
                  <Badge className="bg-white/10 text-white border-white/10">{invoice.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Transaction history</h3>
          <Select defaultValue="30d">
            <SelectTrigger className="w-32 bg-black border-white/10 text-white">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-white/10">
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border border-white/5 rounded-xl p-4">
              <div>
                <p className="font-medium">{tx.type}</p>
                <p className="text-sm text-white/50">{tx.date}</p>
              </div>
              <span className={cn("font-semibold", tx.amount.startsWith("-") ? "text-red-400" : "text-green-400")}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const supportContent = (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Support</p>
          <h2 className="text-3xl font-semibold mt-2">We're on-call</h2>
        </div>
        <Badge className="bg-white/10 text-white border-white/10">Response ETA • 15 min</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="text-xl font-semibold">Submit a ticket</h3>
            <p className="text-sm text-white/50">Priority routed to the right operator</p>
          </div>
          <div className="space-y-3">
            <Input placeholder="Subject" className="bg-black border-white/10 text-white placeholder:text-white/40" />
            <Select defaultValue="general">
              <SelectTrigger className="bg-black border-white/10 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-white/10">
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="trustSafety">Trust & Safety</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Describe your issue..." className="bg-black border-white/10 text-white h-32 placeholder:text-white/40" />
          </div>
          <Button 
            className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
            onClick={() => toast({ title: "Ticket submitted", description: "We'll get back to you within 15 minutes." })}
          >
            Open ticket
          </Button>
        </Card>

        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Previous tickets</h3>
            <Button variant="ghost" className="text-white/60 hover:text-white">
              View all
            </Button>
          </div>
          <div className="space-y-4">
            {supportTickets.map((ticket) => (
              <div key={ticket.id} className="border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{ticket.subject}</p>
                    <p className="text-xs text-white/40">{ticket.id}</p>
                  </div>
                  <Badge
                    className={cn(
                      "border px-3 py-1",
                      ticket.status === "Open" && "bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/20",
                      ticket.status === "Resolved" && "bg-green-500/10 text-green-400 border-green-500/20",
                      ticket.status === "Pending" && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    )}
                  >
                    {ticket.status}
                  </Badge>
                </div>
                <p className="text-xs text-white/40 mt-2">Updated {ticket.updated}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const settingsContent = (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Preferences</p>
        <h2 className="text-3xl font-semibold mt-2">Product behavior</h2>
      </div>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-6">
        <div className="space-y-2">
          <Label className="text-white/70">Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="bg-black border-white/10 text-white">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-white/10">
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-white/50">Choose your preferred color scheme</p>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-black border-white/10 text-white">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-white/10">
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-white/50">Interface language preference</p>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="bg-black border-white/10 text-white">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent className="bg-[#050505] border-white/10">
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="ca">Canada</SelectItem>
              <SelectItem value="au">Australia</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-white/50">Regional settings and currency</p>
        </div>
      </Card>

      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">Accessibility</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">High contrast mode</p>
                <p className="text-sm text-white/50">Increase contrast for better visibility</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Reduced motion</p>
                <p className="text-sm text-white/50">Minimize animations and transitions</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Screen reader support</p>
                <p className="text-sm text-white/50">Enhanced ARIA labels and navigation</p>
              </div>
              <Switch checked />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return dashboardContent;
      case "account":
        return accountDetailsContent;
      case "security":
        return securityContent;
      case "notifications":
        return notificationsContent;
      case "billing":
        return billingContent;
      case "payouts":
        return <AccountPayouts />;
      case "support":
        return supportContent;
      case "settings":
        return settingsContent;
      default:
        return dashboardContent;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      <AccountSidebar activePage={activePage} onNavigate={setActivePage} onLogout={handleSignOut} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Account;
