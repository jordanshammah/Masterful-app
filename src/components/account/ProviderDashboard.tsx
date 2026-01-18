import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Calendar, Star, Users } from "lucide-react";

interface ProviderDashboardProps {
  providerId: string;
}

const ProviderDashboard = ({ providerId }: ProviderDashboardProps) => {
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    rating: 0,
  });
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [providerId]);

  const fetchDashboardData = async () => {
    try {
      // Fetch jobs stats
      const { data: jobs } = await supabase
        .from("jobs")
        .select("status, total_price")
        .eq("provider_id", providerId);

      if (jobs) {
        const completed = jobs.filter(j => j.status === "completed");
        setStats({
          totalJobs: jobs.length,
          completedJobs: completed.length,
          totalEarnings: completed.reduce((sum, j) => sum + parseFloat(String(j.total_price)), 0),
          rating: 0, // Will be calculated from reviews
        });
      }

      // Fetch provider info for rating
      const { data: provider } = await supabase
        .from("providers")
        .select("rating")
        .eq("id", providerId)
        .single();

      if (provider) {
        setStats(prev => ({ ...prev, rating: provider.rating }));
      }

      // Fetch subscription
      const { data: sub } = await supabase
        .from("provider_subscriptions")
        .select(`
          *,
          subscription_plans(name, price)
        `)
        .eq("provider_id", providerId)
        .eq("status", "active")
        .single();

      setSubscription(sub);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching dashboard data:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center">Loading dashboard...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {subscription && (
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold mb-2">Current Plan</h3>
              <p className="text-2xl font-bold text-primary">
                {subscription.subscription_plans.name}
              </p>
              <p className="text-muted-foreground">
                ${subscription.subscription_plans.price}/month
              </p>
            </div>
            <Badge className={subscription.auto_renew ? "bg-success" : "bg-muted"}>
              {subscription.auto_renew ? "Auto-renew ON" : "Auto-renew OFF"}
            </Badge>
          </div>
          <Button variant="outline" className="mt-4">
            Manage Subscription
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalJobs}</div>
              <div className="text-sm text-muted-foreground">Total Jobs</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <Users className="w-6 h-6 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.completedJobs}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Earnings</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.rating.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Rating</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="outline" className="w-full">
            View Schedule
          </Button>
          <Button variant="outline" className="w-full">
            Marketing Tools
          </Button>
          <Button variant="outline" className="w-full">
            Payment History
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProviderDashboard;
