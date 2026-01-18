/**
 * Customer Support View
 * Support tickets and help resources
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LifeBuoy, Mail, HelpCircle, FileText } from "lucide-react";
import { useCreateSupportTicket } from "@/hooks/useCustomerEnhanced";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CustomerSupportViewProps {
  customerId: string;
}

export const CustomerSupportView = ({ customerId }: CustomerSupportViewProps) => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"general" | "billing" | "technical" | "trust_safety">("general");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const createTicketMutation = useCreateSupportTicket();

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createTicketMutation.mutateAsync({
        customerId,
        ticket: {
          subject,
          category,
          message,
          priority,
        },
      });
      toast({
        title: "Ticket submitted",
        description: "We'll get back to you within 15 minutes.",
      });
      setSubject("");
      setCategory("general");
      setMessage("");
      setPriority("medium");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit ticket";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const tickets = [
    {
      id: "TCK-001",
      subject: "Payment issue",
      status: "open" as const,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "TCK-002",
      subject: "Account verification",
      status: "resolved" as const,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      open: { className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Open" },
      in_progress: { className: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "In Progress" },
      resolved: { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Resolved" },
      closed: { className: "bg-gray-500/10 text-gray-400 border-gray-500/20", label: "Closed" },
    };
    const variant = variants[status] || variants.open;
    return <Badge className={cn("border px-3 py-1", variant.className)}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Support</p>
          <h1 className="text-3xl font-semibold mt-2">Help & Support</h1>
        </div>
        <Badge className="bg-white/10 text-white border-white/10">Response ETA • 15 min</Badge>
      </div>

      {/* Submit Ticket */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <LifeBuoy className="w-6 h-6 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Submit a Ticket</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70 mb-2 block">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What can we help you with?"
              className="bg-black border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white/70 mb-2 block">Category</Label>
              <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                <SelectTrigger className="bg-black border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10">
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="trust_safety">Trust & Safety</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70 mb-2 block">Priority</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger className="bg-black border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-white/10">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-white/70 mb-2 block">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              className="bg-black border-white/10 text-white min-h-[120px] placeholder:text-white/40"
            />
          </div>
          <Button
            className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
            onClick={handleSubmitTicket}
            disabled={createTicketMutation.isPending}
          >
            {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>
        </div>
      </Card>

      {/* Recent Tickets */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Recent Support Tickets</h3>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            View All
          </Button>
        </div>
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between p-4 rounded-xl bg-black/50 border border-white/5"
            >
              <div>
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-sm text-white/50">
                  {ticket.id} • {format(new Date(ticket.created_at), "PPP")}
                </p>
              </div>
              {getStatusBadge(ticket.status)}
            </div>
          ))}
        </div>
      </Card>

      {/* FAQ */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-6 h-6 text-[#C25A2C]" />
            <h3 className="text-xl font-semibold">FAQ</h3>
          </div>
          <div className="space-y-4">
            {[
              { q: "How do I cancel a job?", a: "You can cancel pending jobs from the My Jobs page." },
              { q: "What payment methods are accepted?", a: "We accept all major credit cards and PayPal." },
              { q: "How do I contact my pro?", a: "Use the messaging feature in your job details." },
            ].map((faq, idx) => (
              <div key={idx} className="border border-white/5 rounded-xl p-4">
                <p className="font-medium mb-2">{faq.q}</p>
                <p className="text-sm text-white/60">{faq.a}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-[#C25A2C]" />
            <h3 className="text-xl font-semibold">Help Articles</h3>
          </div>
          <div className="space-y-3">
            {[
              "Getting started guide",
              "How to book a service",
              "Understanding job statuses",
              "Payment and billing FAQ",
            ].map((article, idx) => (
              <Button
                key={idx}
                variant="ghost"
                className="w-full justify-start text-white/80 hover:text-white hover:bg-white/5"
              >
                {article}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};








