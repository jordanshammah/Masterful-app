import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserCheck,
  Briefcase,
  TrendingUp,
  Clock,
  FileText,
  Download,
  BarChart3,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    customerCount: 0,
    proCount: 0,
    visits24h: 0,
    visits7d: 0,
    visits30d: 0,
    avgSessionTime: "0m",
    waitlistSubmissions: 0,
  });
  const [signups, setSignups] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    checkAdminAccess();
    loadDashboardData();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "Admin access required",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const loadDashboardData = async () => {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Customer count
      const { count: customerCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "customer");

      // Pro count
      const { count: proCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "provider");

      // Recent signups
      const { data: recentSignups } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, city, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      setSignups(recentSignups || []);

      // Generate chart data (last 30 days)
      const chartDataArray = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dateStr)
          .lt("created_at", new Date(date.getTime() + 86400000).toISOString().split("T")[0]);

        chartDataArray.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          users: count || 0,
        });
      }
      setChartData(chartDataArray);

      // Calculate visit metrics (simplified - in production, use analytics)
      const last24h = new Date();
      last24h.setHours(last24h.getHours() - 24);
      const last7d = new Date();
      last7d.setDate(last7d.getDate() - 7);
      const last30d = new Date();
      last30d.setDate(last30d.getDate() - 30);

      const { count: visits24h } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last24h.toISOString());

      const { count: visits7d } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last7d.toISOString());

      const { count: visits30d } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last30d.toISOString());

      setStats({
        totalUsers: totalUsers || 0,
        customerCount: customerCount || 0,
        proCount: proCount || 0,
        visits24h: visits24h || 0,
        visits7d: visits7d || 0,
        visits30d: visits30d || 0,
        avgSessionTime: "5m", // Placeholder - integrate with analytics
        waitlistSubmissions: 0, // Placeholder
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportSignups = () => {
    // Escape CSV cells properly to prevent CSV injection
    const escapeCSV = (cell: string): string => {
      // Escape double quotes by doubling them
      const escaped = cell.replace(/"/g, '""');
      // Wrap in quotes and escape formula injection chars
      if (escaped.startsWith('=') || escaped.startsWith('+') || escaped.startsWith('-') || escaped.startsWith('@')) {
        return `"'${escaped}"`;
      }
      return `"${escaped}"`;
    };

    const csv = [
      ["Name", "Email", "Phone", "City", "Created At"],
      ...signups.map((s) => [
        s.full_name || "",
        s.email || "",
        s.phone || "",
        s.city || "",
        new Date(s.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.map((cell) => escapeCSV(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signups-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white admin-theme">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">Investor-facing analytics and metrics</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-gray-800 text-white hover:bg-gray-900"
          >
            Back to App
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats.totalUsers}</div>
            <div className="text-sm text-gray-400">Total Users</div>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats.customerCount}</div>
            <div className="text-sm text-gray-400">Customers</div>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats.proCount}</div>
            <div className="text-sm text-gray-400">Professionals</div>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stats.visits30d}</div>
            <div className="text-sm text-gray-400">Visits (30d)</div>
          </Card>
        </div>

        {/* Visit Metrics */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="text-2xl font-bold mb-1">{stats.visits24h}</div>
            <div className="text-sm text-gray-400">Visits (24h)</div>
          </Card>
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="text-2xl font-bold mb-1">{stats.visits7d}</div>
            <div className="text-sm text-gray-400">Visits (7d)</div>
          </Card>
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="text-2xl font-bold mb-1">{stats.avgSessionTime}</div>
            <div className="text-sm text-gray-400">Avg Session Time</div>
          </Card>
        </div>

        {/* Chart */}
        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">User Growth (30 Days)</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }}
                labelStyle={{ color: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#D9743A"
                strokeWidth={2}
                dot={{ fill: "#D9743A", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Signups Table */}
        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Recent Signups</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={exportSignups}
              className="border-gray-800 text-white hover:bg-gray-800"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Phone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">City</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {signups.slice(0, 10).map((signup) => (
                  <tr key={signup.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-4">{signup.full_name || "—"}</td>
                    <td className="py-3 px-4 text-gray-400">{signup.email || "—"}</td>
                    <td className="py-3 px-4 text-gray-400">{signup.phone || "—"}</td>
                    <td className="py-3 px-4 text-gray-400">{signup.city || "—"}</td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(signup.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;











