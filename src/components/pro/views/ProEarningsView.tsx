/**
 * Pro Earnings View
 * Earnings dashboard with charts - Payouts are processed automatically
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EarningTile } from "@/components/pro/EarningTile";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, CheckCircle2, Wallet, Info } from "lucide-react";
import { useProEarningsEnhanced, useProPayouts } from "@/hooks/useProEnhanced";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProEarningsViewProps {
  providerId: string;
}

export const ProEarningsView = ({ providerId }: ProEarningsViewProps) => {
  const { data: earnings, isLoading: earningsLoading } = useProEarningsEnhanced(providerId);
  const { data: payouts, isLoading: payoutsLoading } = useProPayouts(providerId);

  // Prepare chart data
  const chartData = earnings
    ? earnings.month.sparkline.map((value, index) => ({
        day: index + 1,
        earnings: value,
      }))
    : [];

  const getPayoutStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: {
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        label: "Pending",
      },
      processing: {
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: "Processing",
      },
      completed: {
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        label: "Completed",
      },
      failed: {
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        label: "Failed",
      },
    };

    const variant = variants[status] || variants.pending;
    return (
      <Badge className={cn("border px-3 py-1", variant.className)}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Earnings</p>
          <h1 className="text-3xl font-semibold mt-2">Earnings Overview</h1>
        </div>
        {/* Automatic Payout Notice */}
        <div className="flex items-center gap-2 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg px-4 py-2">
          <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0" />
          <div className="text-sm">
            <p className="text-[#22C55E] font-medium">Auto-Payouts Enabled</p>
            <p className="text-white/50 text-xs">Earnings are transferred automatically</p>
          </div>
        </div>
      </div>

      {/* Earnings Tiles */}
      {earningsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : earnings ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <EarningTile
            label="Today"
            amount={earnings.today.amount}
            jobs={earnings.today.jobs}
            sparklineData={earnings.today.sparkline}
          />
          <EarningTile
            label="This Week"
            amount={earnings.week.amount}
            jobs={earnings.week.jobs}
            sparklineData={earnings.week.sparkline}
          />
          <EarningTile
            label="This Month"
            amount={earnings.month.amount}
            jobs={earnings.month.jobs}
            sparklineData={earnings.month.sparkline}
          />
          <EarningTile
            label="Lifetime"
            amount={earnings.lifetime.amount}
            jobs={earnings.lifetime.jobs}
            sparklineData={earnings.lifetime.sparkline}
          />
        </div>
      ) : null}

      {/* Pending Payouts - Automatic Processing */}
      {earnings && earnings.pendingPayouts > 0 && (
        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Processing</p>
              <h3 className="text-2xl font-semibold mt-1">KES {earnings.pendingPayouts.toLocaleString()}</h3>
              <p className="text-sm text-white/50 mt-1">Will be transferred automatically</p>
            </div>
            <Wallet className="w-12 h-12 text-[#D9743A]/30" />
          </div>
        </Card>
      )}

      {/* Automatic Payout Info */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10">
            <Info className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Automatic Payouts</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Your earnings are automatically transferred to your registered M-Pesa account after each completed job.
              Payouts are processed within 24-48 hours after the customer completes payment.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-white/50">Platform Fee</p>
                <p className="text-lg font-semibold text-white">15%</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-white/50">Processing Time</p>
                <p className="text-lg font-semibold text-white">24-48 hrs</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Earnings Chart - ENHANCED */}
      <Card className="bg-[#0A0A0A] border-white/5 p-4 sm:p-6 rounded-2xl">
        <div className="mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-white/50 uppercase tracking-[0.3em]">Trend</p>
          <h3 className="text-lg sm:text-xl font-semibold mt-1">Monthly Earnings</h3>
        </div>
        {earningsLoading ? (
          <Skeleton className="h-64 sm:h-80 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 250 : 320}>
            <LineChart 
              data={chartData}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <defs>
                {/* Gradient for area fill */}
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D9743A" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#D9743A" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#D9743A" stopOpacity={0} />
                </linearGradient>
                
                {/* Glow filter for the line */}
                <filter id="lineGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(255,255,255,0.05)" 
                vertical={false}
              />
              
              <XAxis 
                dataKey="day" 
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              
              <YAxis 
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickFormatter={(value) => `${value}`}
              />
              
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0A0A0A",
                  border: "1px solid rgba(217, 116, 58, 0.2)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  color: "#fff",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
                }}
                labelStyle={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
                itemStyle={{
                  color: "#D9743A",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
                formatter={(value: number) => [`KES ${value.toFixed(2)}`, "Earnings"]}
                labelFormatter={(label) => `Day ${label}`}
                cursor={{ stroke: 'rgba(217, 116, 58, 0.2)', strokeWidth: 2 }}
              />
              
              {/* Area fill under the line */}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D9743A" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#D9743A" stopOpacity={0} />
                </linearGradient>
              </defs>
              
              {/* Main line with enhanced styling */}
              <Line
                type="monotone"
                dataKey="earnings"
                stroke="#D9743A"
                strokeWidth={3}
                dot={{ 
                  fill: "#D9743A", 
                  r: 4,
                  strokeWidth: 2,
                  stroke: "#0A0A0A",
                }}
                activeDot={{ 
                  r: 6, 
                  fill: "#D9743A",
                  stroke: "#fff",
                  strokeWidth: 2,
                  filter: "drop-shadow(0 0 8px rgba(217, 116, 58, 0.8))"
                }}
                fill="url(#areaGradient)"
                filter="url(#lineGlow)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Transfer History */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="mb-6">
          <p className="text-sm text-white/50 uppercase tracking-[0.3em]">History</p>
          <h3 className="text-xl font-semibold mt-1">Transfer History</h3>
        </div>
        {payoutsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : payouts && payouts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-white/5">
                <TableHead className="text-white/50">Date</TableHead>
                <TableHead className="text-white/50">Amount</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
                <TableHead className="text-white/50">Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="text-white">
                    {format(new Date(payout.requested_at), "PPP")}
                  </TableCell>
                  <TableCell className="text-white font-semibold">
                    KES {payout.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{getPayoutStatusBadge(payout.status)}</TableCell>
                  <TableCell className="text-white/60">
                    {payout.payment_method || "M-Pesa"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="font-semibold mb-2">No transfers yet</h3>
            <p className="text-sm text-white/50">Your transfer history will appear here after completed jobs</p>
          </div>
        )}
      </Card>

    </div>
  );
};








