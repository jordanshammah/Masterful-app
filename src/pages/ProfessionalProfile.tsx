import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Clock, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ProfessionalProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProvider();
  }, [id]);

  const fetchProvider = async () => {
    try {
      const { data, error } = await supabase
        .from("providers")
        .select(`
          *,
          profiles(full_name, photo_url, city),
          service_categories(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setProvider(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-20 flex items-center justify-center">
          <div className="text-xl">Loading...</div>
        </main>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-20 flex items-center justify-center">
          <div className="text-xl">Professional not found</div>
        </main>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 mb-8">
              <div className="flex items-start gap-6 mb-6">
                <div className="relative">
                  <img
                    src={provider.profile_image_url || "/placeholder.svg"}
                    alt={provider.display_name?.trim() 
                      || provider.business_name?.trim() 
                      || "Professional"}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                  {provider.is_verified && (
                    <div className="absolute -bottom-2 -right-2 bg-success rounded-full p-2">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">
                    {provider.display_name?.trim() 
                      || provider.business_name?.trim() 
                      || "Professional"}
                  </h1>
                  <p className="text-lg text-muted-foreground mb-4">{provider.service_categories.name}</p>
                  
                  <div className="flex items-center gap-1 mb-4">
                    <Star className="w-5 h-5 fill-primary text-primary" />
                    <span className="font-semibold text-lg">{provider.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({provider.review_count} reviews)</span>
                  </div>

                  <div className="flex items-center gap-6 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{provider.city || "Location not available"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>~{provider.avg_response_time} min</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">${provider.hourly_rate}</div>
                  <div className="text-sm text-muted-foreground">per hour</div>
                </div>
              </div>

              {provider.bio && (
                <div className="border-t pt-6">
                  <h2 className="text-xl font-bold mb-3">About</h2>
                  <p className="text-muted-foreground">{provider.bio}</p>
                </div>
              )}
            </Card>

            <Card className="p-8 bg-gradient-to-r from-[#C25A2C]/10 via-[#C25A2C]/5 to-transparent border-[#C25A2C]/20">
              <h2 className="text-2xl font-bold mb-4">Book This Professional</h2>
              <p className="text-white/60 mb-6">
                Ready to book? Click below to start the booking process with date selection, rush options, and payment.
              </p>
              <Button
                className="w-full bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold h-14 text-lg"
                onClick={() => navigate(`/booking?proId=${id}`)}
              >
                Book Now
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfessionalProfile;
