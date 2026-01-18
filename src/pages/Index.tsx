/**
 * Landing Page - Real, Specific, Human
 * Problem-first. No marketing fluff. Actual use cases.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  ArrowRight, 
  Wrench, 
  Zap, 
  Sprout, 
  Sparkles,
  Star,
  Shield,
  Clock,
  MapPin,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const services = [
    { 
      name: 'Plumbing', 
      icon: Wrench,
      examples: 'Burst pipe? Clogged drain? Leaky faucet?',
      urgency: 'Available today'
    },
    { 
      name: 'Electrician', 
      icon: Zap,
      examples: 'Outlet not working? Need new wiring? Panel upgrade?',
      urgency: 'Licensed pros'
    },
    { 
      name: 'Cleaning', 
      icon: Sparkles,
      examples: 'Deep clean before guests? Regular maintenance?',
      urgency: 'Book this week'
    },
    { 
      name: 'Gardening', 
      icon: Sprout,
      examples: 'Overgrown lawn? Landscaping? Tree removal?',
      urgency: 'Local experts'
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navigation />
      
      <main>
        {/* Hero - Problem First */}
        <section className="relative pt-20 pb-12 md:pt-28 md:pb-20 px-4 md:px-8 lg:px-12">
          <div className="container mx-auto max-w-5xl">
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Problem statement first */}
              <div className="text-center space-y-4">
                <p className="text-lg md:text-xl text-[#A6A6A6]">
                  Need a plumber today? Electrician this week? Cleaner for Saturday?
                </p>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-white">
                  Find local professionals.<br />
                  <span className="text-[#D9743A]">Pay after the job.</span>
              </h1>
                
                <p className="text-base md:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
                  No upfront payment. Get a quote on-site. Approve the price. Pay only when you're satisfied.
                </p>
              </div>
              
              {/* Trust - Specific, not vague */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#D9743A]" />
                  <span>No upfront payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#D9743A]" />
                  <span>Quote before work</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D9743A]" />
                  <span>Pay after completion</span>
                </div>
              </div>
              
              {/* Primary CTA - Action */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6">
                <Button
                  onClick={() => navigate('/services')}
                  className="h-12 px-8 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold rounded-lg text-base"
                >
                  See Available Pros
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/signup')}
                  className="h-12 px-8 border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-medium rounded-lg text-base"
                >
                  Sign up
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Real Use Cases - Not Testimonials */}
        <section className="py-12 px-4 md:px-8 lg:px-12 border-y border-white/10 bg-[#0a0a0a]">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-[#121212] border-white/10 p-5">
                    <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#D9743A] flex-shrink-0 mt-0.5" />
                      <div>
                      <p className="text-white font-medium text-sm mb-1">Kitchen sink backed up</p>
                      <p className="text-white/60 text-xs leading-relaxed">
                        Booked plumber for 2pm. Got quote on arrival. Approved $120. Fixed in 45 min. Paid after.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="bg-[#121212] border-white/10 p-5">
                    <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#D9743A] flex-shrink-0 mt-0.5" />
                      <div>
                      <p className="text-white font-medium text-sm mb-1">Outlets stopped working</p>
                      <p className="text-white/60 text-xs leading-relaxed">
                        Electrician came next morning. Inspected wiring. Got quote. Accepted. Work done. Paid $280.
                      </p>
                    </div>
                  </div>
              </div>
              </Card>

              <Card className="bg-[#121212] border-white/10 p-5">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#D9743A] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium text-sm mb-1">Moving out cleaning</p>
                      <p className="text-white/60 text-xs leading-relaxed">
                        Booked cleaner for Saturday. Quoted $180 on arrival. Cleaned 3-bed in 4 hours. Paid after.
                </p>
              </div>
                  </div>
              </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Services - Specific Problems */}
        <section className="py-16 px-4 md:px-8 lg:px-12">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3 text-center">What's broken? What do you need?</h2>
              <p className="text-base text-[#A6A6A6] text-center max-w-xl mx-auto">
                Click a service to see who's available near you right now
                </p>
              </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {services.map((service, idx) => {
                const IconComponent = service.icon;
                return (
                    <Card 
                    key={idx}
                    className="bg-[#121212] border border-white/10 p-6 hover:border-[#D9743A]/50 hover:bg-[#1a1a1a] transition-all duration-200 cursor-pointer"
                      onClick={() => navigate('/services')}
                    >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#D9743A]/20 flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-[#D9743A]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white text-lg">{service.name}</h3>
                          <span className="text-xs text-[#D9743A] font-medium">{service.urgency}</span>
                        </div>
                        <p className="text-sm text-white/60 mb-2">{service.examples}</p>
                        <p className="text-xs text-white/40">Click to see available professionals →</p>
                      </div>
                    </div>
                    </Card>
                );
              })}
            </div>

              <div className="text-center">
                <Button
                  onClick={() => navigate('/services')}
                  variant="outline"
                className="border border-[#D9743A] hover:bg-[#D9743A] hover:text-black text-[#D9743A] font-medium h-11 px-6"
              >
                Browse All Services
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works - Direct, No Fluff */}
        <section className="py-16 px-4 md:px-8 lg:px-12 bg-[#0a0a0a] border-y border-white/10">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-10 text-center">How it works</h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D9743A] flex items-center justify-center text-sm font-bold text-black">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Search your area</h3>
                  <p className="text-[#A6A6A6] text-sm leading-relaxed">
                    Enter your address or let us find you. See professionals sorted by distance. Read reviews, check ratings, compare prices.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D9743A] flex items-center justify-center text-sm font-bold text-black">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Book - no payment needed</h3>
                  <p className="text-[#A6A6A6] text-sm leading-relaxed">
                    Choose a time slot. Book instantly. No upfront payment required. Get confirmation immediately.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D9743A] flex items-center justify-center text-sm font-bold text-black">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Get quote, approve, pay after</h3>
                  <p className="text-[#A6A6A6] text-sm leading-relaxed">
                    Pro arrives, assesses job, gives quote. You accept or decline. Work gets done. You verify completion and pay.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Provider Section - Direct, No Fluff */}
        <section className="py-16 px-4 md:px-8 lg:px-12">
          <div className="container mx-auto max-w-4xl">
            <Card className="bg-[#121212] border-[#D9743A]/30 p-8 md:p-10">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="w-5 h-5 text-[#D9743A]" />
                    <h2 className="text-2xl md:text-3xl font-bold text-white">Are you a professional?</h2>
                  </div>
                  <p className="text-base text-white/80 leading-relaxed">
                    Get booked by customers who need your services. Quote each job on-site. Get paid after completion. Keep 85% + tips.
                  </p>
                </div>
                
                <div className="space-y-2 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D9743A]"></div>
                    <span>Set minimum price, quote per job</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D9743A]"></div>
                    <span>Customer approves before you start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D9743A]"></div>
                    <span>Payment guaranteed after completion</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => navigate('/signup')}
                  className="bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-11 px-6"
                >
                  Sign up as a Pro
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
