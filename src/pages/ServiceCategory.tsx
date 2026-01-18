/**
 * Service Category Page - Complete Rebuild
 * Geo-sorted professionals by category
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ProfessionalCard from "@/components/ProfessionalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Loader2, ArrowLeft } from "lucide-react";
import { useProfessionalsByCategory } from "@/hooks/useServicesEnhanced";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";

// Map category slugs to IDs
const categoryMap: Record<string, { name: string; categoryId: number }> = {
  plumbing: { name: "Plumbing", categoryId: 1 },
  electrician: { name: "Electrician", categoryId: 2 },
  gardening: { name: "Gardening", categoryId: 3 },
  cleaning: { name: "House Cleaning", categoryId: 4 },
};

const ServiceCategory = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"distance" | "rating" | "price">("distance");
  const { location, loading: locationLoading, requestLocation } = useGeolocation();

  const categoryInfo = category ? categoryMap[category] : null;

  const { data: professionals, isLoading, error: professionalsError } = useProfessionalsByCategory({
    categoryId: categoryInfo?.categoryId || 0,
    lat: location?.lat,
    lng: location?.lng,
    sort: sortBy,
    limit: 50,
    enabled: !!categoryInfo,
  });

  // Filter by search query
  const filteredProfessionals = (professionals || []).filter((provider) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (provider.display_name || provider.business_name || "").toLowerCase().includes(query) ||
      provider.service_categories?.name?.toLowerCase().includes(query) ||
      provider.profiles?.city?.toLowerCase().includes(query)
    );
  });

  if (!categoryInfo) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <Navigation />
        <main className="flex-1 pt-24 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-3xl font-bold mb-4">Category Not Found</h1>
            <p className="text-white/60 mb-8">The category you're looking for doesn't exist.</p>
            <Button
              className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
              onClick={() => navigate("/services")}
            >
              Browse All Services
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <Navigation />

      <main className="flex-1 pt-24">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#C25A2C]/5 via-transparent to-[#C25A2C]/5"></div>
          <div className="container mx-auto px-4 py-16 relative">
            <div className="max-w-3xl mb-12 animate-fade-in-up">
              <Button
                variant="ghost"
                onClick={() => navigate("/services")}
                className="mb-6 text-white/60 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Services
              </Button>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                {categoryInfo.name} Services
              </h1>
              <p className="text-xl md:text-2xl text-white/60 leading-relaxed">
                Find verified {categoryInfo.name.toLowerCase()} professionals near you
              </p>
            </div>

            <div className="max-w-5xl">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5 group-focus-within:text-[#C25A2C] transition-colors" />
                  <Input
                    placeholder="Search by name or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-14 bg-[#050505] border-white/10 text-white placeholder:text-white/40 focus:border-[#C25A2C]/50 focus:ring-2 focus:ring-[#C25A2C]/20"
                  />
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={requestLocation}
                  disabled={locationLoading}
                  className="md:w-auto h-14 bg-[#050505] border-white/10 text-white hover:bg-white/10 hover:border-[#C25A2C]/50"
                >
                  {locationLoading ? (
                    <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  ) : (
                    <MapPin className="mr-2 w-5 h-5" />
                  )}
                  {location ? "Location On" : "Enable Location"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <p className="text-white/60 font-medium">
              Showing <span className="text-white font-semibold">{filteredProfessionals.length}</span>{" "}
              {filteredProfessionals.length === 1 ? "professional" : "professionals"}
              {!location && sortBy === "distance" && (
                <span className="text-xs text-white/40 ml-2">(sorted by rating - enable location for distance)</span>
              )}
            </p>
            <Select
              value={sortBy}
              onValueChange={(value: "distance" | "rating" | "price") => setSortBy(value)}
            >
              <SelectTrigger className="w-full sm:w-[220px] h-11 bg-[#050505] border-white/10 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-white/10">
                <SelectItem value="distance">Closest First</SelectItem>
                <SelectItem value="rating">Best Rated</SelectItem>
                <SelectItem value="price">Price: Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center gap-3 text-xl text-white/60">
                <Loader2 className="w-6 h-6 animate-spin text-[#C25A2C]" />
                <span>Loading professionals...</span>
              </div>
            </div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Search className="w-10 h-10 text-white/40" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">No professionals found</h3>
                <p className="text-white/60 mb-6">Try adjusting your search or filters to find more results.</p>
                <Button
                  className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
                  onClick={() => navigate("/services")}
                >
                  Browse All Services
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredProfessionals.map((provider, index) => (
                <div
                  key={provider.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
                >
                  <ProfessionalCard
                    id={provider.id}
                    name={provider.display_name?.trim() 
                      || provider.business_name?.trim() 
                      || "Unknown"}
                    category={provider.service_categories?.name || "Service"}
                    rating={provider.rating}
                    reviewCount={provider.review_count}
                    location={provider.profiles?.city || "Local"}
                    hourlyRate={provider.hourly_rate}
                    avatar={provider.profiles?.photo_url || "/placeholder.svg"}
                    isVerified={provider.is_verified}
                    responseTime={`~${provider.avg_response_time || 0} min`}
                    bio={provider.bio}
                    distanceKm={provider.distance_km}
                    distanceMiles={provider.distance_miles}
                    showDistance={!!location}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ServiceCategory;

