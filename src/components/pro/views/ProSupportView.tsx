/**
 * Pro Support View
 * Support and help resources
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  LifeBuoy,
  Mail,
  MessageSquare,
  Book,
  HelpCircle,
  FileText,
} from "lucide-react";

export const ProSupportView = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Support</p>
        <h1 className="text-3xl font-semibold mt-2">Help & Support</h1>
      </div>

      {/* Contact Support */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <LifeBuoy className="w-5 h-5 text-[#C25A2C]" />
          <h3 className="text-xl font-semibold">Contact Support</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70 mb-2 block">Subject</Label>
            <Input
              placeholder="What can we help you with?"
              className="bg-black border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <Label className="text-white/70 mb-2 block">Message</Label>
            <Textarea
              placeholder="Describe your issue or question..."
              className="bg-black border-white/10 text-white placeholder:text-white/40 min-h-[120px]"
            />
          </div>
          <Button className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold">
            <Mail className="w-4 h-4 mr-2" />
            Send Message
          </Button>
        </div>
      </Card>

      {/* Quick Help */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl hover:border-white/10 transition-all cursor-pointer">
          <Book className="w-8 h-8 text-[#C25A2C] mb-4" />
          <h3 className="text-lg font-semibold mb-2">Documentation</h3>
          <p className="text-sm text-white/60 mb-4">
            Browse our comprehensive guides and tutorials
          </p>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            View Docs
          </Button>
        </Card>

        <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl hover:border-white/10 transition-all cursor-pointer">
          <HelpCircle className="w-8 h-8 text-[#C25A2C] mb-4" />
          <h3 className="text-lg font-semibold mb-2">FAQ</h3>
          <p className="text-sm text-white/60 mb-4">
            Find answers to commonly asked questions
          </p>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            View FAQ
          </Button>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card className="bg-[#050505] border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Recent Support Tickets</h3>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
            View All
          </Button>
        </div>
        <div className="space-y-4">
          {[
            { id: "TCK-001", subject: "Payment issue", status: "Open", date: "2 hours ago" },
            { id: "TCK-002", subject: "Account verification", status: "Resolved", date: "1 day ago" },
          ].map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between p-4 rounded-xl bg-black/50 border border-white/5"
            >
              <div>
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-sm text-white/50">{ticket.id} • {ticket.date}</p>
              </div>
              <Badge
                className={
                  ticket.status === "Open"
                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : "bg-green-500/10 text-green-400 border-green-500/20"
                }
              >
                {ticket.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};








