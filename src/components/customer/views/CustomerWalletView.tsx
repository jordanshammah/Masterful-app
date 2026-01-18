/**
 * Customer Wallet & Billing View
 * Payment methods and transaction history
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Plus, CreditCard, Download, Eye } from "lucide-react";
import { usePaymentMethods, useTransactions } from "@/hooks/useCustomerEnhanced";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CustomerWalletViewProps {
  customerId: string;
}

export const CustomerWalletView = ({ customerId }: CustomerWalletViewProps) => {
  const { toast } = useToast();
  const [addCardDialog, setAddCardDialog] = useState(false);

  const { data: paymentMethods, isLoading: methodsLoading } = usePaymentMethods(customerId);
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(customerId);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: { className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pending" },
      completed: { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Completed" },
      failed: { className: "bg-red-500/10 text-red-400 border-red-500/20", label: "Failed" },
      refunded: { className: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Refunded" },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={cn("border px-3 py-1", variant.className)}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Billing</p>
          <h1 className="text-3xl font-semibold mt-2">Wallet & Billing</h1>
        </div>
        <Button
          className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold gap-2"
          onClick={() => setAddCardDialog(true)}
        >
          <Plus className="w-4 h-4" />
          Add Payment Method
        </Button>
      </div>

      {/* Payment Methods */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-[0.3em]">Payment Methods</p>
            <h3 className="text-xl font-semibold mt-1">Linked Cards</h3>
          </div>
        </div>
        {methodsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : paymentMethods && paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between border border-white/5 rounded-xl p-4"
              >
                <div className="flex items-center gap-4">
                  <CreditCard className="w-8 h-8 text-[#C25A2C]" />
                  <div>
                    <p className="font-medium">
                      {method.brand || "Card"} •••• {method.last4 || "0000"}
                    </p>
                    {method.expiry_month && method.expiry_year && (
                      <p className="text-sm text-white/50">
                        Expires {method.expiry_month}/{method.expiry_year}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {method.is_primary && (
                    <Badge className="bg-white/10 text-white border-white/10">Primary</Badge>
                  )}
                  <Button variant="ghost" className="text-white/60 hover:text-white">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="font-semibold mb-2">No payment methods</h3>
            <p className="text-sm text-white/50 mb-4">Add a payment method to get started</p>
            <Button
              className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
              onClick={() => setAddCardDialog(true)}
            >
              Add Payment Method
            </Button>
          </div>
        )}
      </Card>

      {/* Transaction History */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-white/50 uppercase tracking-[0.3em]">History</p>
            <h3 className="text-xl font-semibold mt-1">Transaction History</h3>
          </div>
        </div>
        {transactionsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : transactions && transactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-white/5">
                <TableHead className="text-white/50">Date</TableHead>
                <TableHead className="text-white/50">Description</TableHead>
                <TableHead className="text-white/50">Amount</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
                <TableHead className="text-white/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="text-white">
                    {format(new Date(transaction.created_at), "PPP")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">
                        {transaction.job?.provider?.display_name?.trim() 
                          || transaction.job?.provider?.business_name?.trim() 
                          || "Service Payment"}
                      </p>
                      <p className="text-sm text-white/50">
                        {transaction.job?.service_category?.name || "Service"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-white font-semibold">
                    ${transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                      <Download className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="font-semibold mb-2">No transactions yet</h3>
            <p className="text-sm text-white/50">Your transaction history will appear here</p>
          </div>
        )}
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={addCardDialog} onOpenChange={setAddCardDialog}>
        <DialogContent className="bg-[#050505] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription className="text-white/60">
              Securely add a new payment method
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-white/70">Card Number</Label>
              <Input
                placeholder="1234 5678 9012 3456"
                className="bg-black border-white/10 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white/70">Expiry</Label>
                <Input placeholder="MM/YY" className="bg-black border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-white/70">CVV</Label>
                <Input placeholder="123" className="bg-black border-white/10 text-white mt-1" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/10"
                onClick={() => setAddCardDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                onClick={() => {
                  toast({
                    title: "Payment method added",
                    description: "Your payment method has been added successfully.",
                  });
                  setAddCardDialog(false);
                }}
              >
                Add Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};








