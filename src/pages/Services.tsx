/**
 * Services Page - Spacious, Minimal Filters, Toggleable Map
 * Clean layout with breathing room
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ProviderCard from "@/components/ProviderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProviders } from "@/hooks/useProviders";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import { 
  MapPin, 
  SlidersHorizontal, 
  Map as MapIcon, 
  X,
  Search,
  Filter
} from "lucide-react";
import type { Provider } from "@/lib/api/providers";

const Services = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"distance" | "rating" | "price">("rating");
  const [showMap, setShowMap] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [minRating, setMinRating] = useState(0);
  const { location, loading: locationLoading, requestLocation } = useGeolocation();

  const categoryMap: Record<string, number> = {
    all: 0,
    plumbing: 1,
    electrician: 2,
    gardening: 3,
    cleaning: 4,
    movers: 5,
  };

  const categoryId = selectedCategory !== "all" ? categoryMap[selectedCategory] || 0 : undefined;

  const { data: providers = [], isLoading, error } = useProviders({
    categoryId: categoryId,
    lat: location?.lat,
    lng: location?.lng,
    sort: sortBy,
    limit: 100,
    enabled: true,
  });

  const filteredProviders = useMemo(() => {
    return providers.filter((provider: Provider) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = (provider.display_name || provider.business_name || "").toLowerCase().includes(query);
        const matchesService = provider.service_categories?.name?.toLowerCase().includes(query);
        const matchesLocation = provider.city?.toLowerCase().includes(query);
        const matchesBio = provider.bio?.toLowerCase().includes(query);
        if (!matchesName && !matchesService && !matchesLocation && !matchesBio) {
          return false;
        }
      }

      if (verifiedOnly && !provider.is_verified) {
        return false;
      }

      // Filter by minimum job price (new quote-based model) or fallback to hourly rate
      const minPrice = provider.minimum_job_price || provider.hourly_rate || 0;
      if (minPrice < priceRange[0] || minPrice > priceRange[1]) {
        return false;
      }

      if (minRating > 0 && (provider.rating || 0) < minRating) {
        return false;
      }

      return true;
    });
  }, [providers, searchQuery, verifiedOnly, priceRange, minRating]);

  const ProviderCardSkeleton = () => (
    <Card className="bg-[#121212] border-white/10 p-6 space-y-5">
      <div className="flex items-start gap-5">
        <Skeleton className="w-20 h-20 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-3 pt-3">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 flex-1" />
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <Navigation />
      
      <main className="flex-1 pt-20 relative">
        {/* Sticky Search Bar */}
        <div className="sticky top-20 z-40 bg-black/95 backdrop-blur-sm border-b border-white/10 py-3 sm:py-4 px-3 sm:px-4 md:px-8 lg:px-12">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/40 flex-shrink-0" />
                <Input
                  placeholder="Search by name, service, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 sm:pl-10 bg-[#121212] border-white/10 text-white placeholder:text-white/40 h-11 sm:h-12 text-sm sm:text-base focus:border-[#D9743A]/50"
                />
              </div>

              <div className="flex gap-2 sm:gap-3">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-40 md:w-48 bg-[#121212] border-white/10 text-white h-11 sm:h-12 text-sm sm:text-base">
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/10">
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrician">Electrician</SelectItem>
                    <SelectItem value="gardening">Gardening</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="movers">Movers</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: "distance" | "rating" | "price") => setSortBy(value)}>
                  <SelectTrigger className="w-full sm:w-40 md:w-48 bg-[#121212] border-white/10 text-white h-11 sm:h-12 text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/10">
                    <SelectItem value="rating">Best Rated</SelectItem>
                    <SelectItem value="distance">Nearest</SelectItem>
                    <SelectItem value="price">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="md:hidden bg-[#121212] border-white/10 text-white h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4"
                >
                  <SlidersHorizontal className="w-4 h-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden xs:inline">Filters</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowMap(!showMap)}
                  className="bg-[#121212] border-white/10 text-white h-11 sm:h-12 text-sm sm:text-base px-3 sm:px-4"
                >
                  <MapIcon className="w-4 h-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">{showMap ? 'Hide Map' : 'Show Map'}</span>
                  <span className="sm:hidden">Map</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-3 sm:px-4 md:px-8 lg:px-12 py-4 sm:py-6 md:py-8 max-w-7xl">
          <div className="flex gap-4 sm:gap-6 md:gap-8">
            {/* Left: Minimal Filters - Desktop Sidebar / Mobile Drawer */}
            {/* Mobile: Drawer Overlay */}
            {filtersOpen && (
              <div className="fixed inset-0 z-50 lg:hidden">
                {/* Backdrop */}
                <div 
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
                  onClick={() => setFiltersOpen(false)}
                />
                {/* Drawer */}
                <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#121212] border-r border-white/10 overflow-y-auto transform transition-transform duration-300 ease-out">
                  <Card className="bg-transparent border-0 p-4 h-full">
                    <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#121212] pb-4 border-b border-white/10">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filters
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiltersOpen(false)}
                        className="text-white/60 hover:text-white h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                <div className="space-y-4">
                  {/* Location - Compact */}
                  <div>
                    <Button
                      variant="outline"
                      onClick={requestLocation}
                      disabled={locationLoading}
                      size="sm"
                      className="w-full border-white/10 text-white hover:bg-white/5 justify-start text-xs h-9"
                    >
                      <MapPin className="w-3.5 h-3.5 mr-2" />
                      {location ? "Location on" : "Enable location"}
                    </Button>
                  </div>

                  {/* Verification - Compact */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verified"
                      checked={verifiedOnly}
                      onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-[#D9743A] data-[state=checked]:border-[#D9743A]"
                    />
                    <Label htmlFor="verified" className="text-white/80 cursor-pointer text-xs">
                      Verified only
                    </Label>
                  </div>

                  {/* Rating - Compact */}
                  <div>
                    <Label className="text-white/60 text-xs mb-2 block">Min Rating</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[0, 4, 4.5, 4.7].map((rating) => (
                        <Button
                          key={rating}
                          variant={minRating === rating ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMinRating(rating)}
                          className={`
                            text-xs h-7
                            ${minRating === rating 
                              ? 'bg-[#D9743A] text-black' 
                              : 'border-white/10 text-white/60 hover:border-white/20'
                            }
                          `}
                        >
                          {rating === 0 ? 'Any' : `${rating}+`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Minimum Price - Updated for quote-based model */}
                  <div>
                    <Label className="text-white/60 text-xs mb-2 block">Minimum Price (KES)</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        placeholder="0"
                        value={priceRange[0]}
                        onChange={(e) => setPriceRange([Number(e.target.value) || 0, priceRange[1]])}
                        className="bg-[#1E1E1E] border-white/10 text-white h-8 text-xs"
                      />
                      <span className="text-white/40 text-xs">-</span>
                      <Input
                        type="number"
                        placeholder="Any"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value) || 100000])}
                        className="bg-[#1E1E1E] border-white/10 text-white h-8 text-xs"
                      />
                    </div>
                    <p className="text-white/40 text-[10px] mt-1">Final quote on-site</p>
                  </div>
                </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Desktop: Sidebar */}
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <Card className="bg-[#121212] border-white/10 p-4 sticky top-32">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Location - Compact */}
                  <div>
                    <Button
                      variant="outline"
                      onClick={requestLocation}
                      disabled={locationLoading}
                      size="sm"
                      className="w-full border-white/10 text-white hover:bg-white/5 justify-start text-xs h-9"
                    >
                      <MapPin className="w-3.5 h-3.5 mr-2" />
                      {location ? "Location on" : "Enable location"}
                    </Button>
                  </div>

                  {/* Verification - Compact */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verified-desktop"
                      checked={verifiedOnly}
                      onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-[#D9743A] data-[state=checked]:border-[#D9743A]"
                    />
                    <Label htmlFor="verified-desktop" className="text-white/80 cursor-pointer text-xs">
                      Verified only
                    </Label>
                  </div>

                  {/* Rating - Compact */}
                  <div>
                    <Label className="text-white/60 text-xs mb-2 block">Min Rating</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[0, 4, 4.5, 4.7].map((rating) => (
                        <Button
                          key={rating}
                          variant={minRating === rating ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMinRating(rating)}
                          className={`
                            text-xs h-7
                            ${minRating === rating 
                              ? 'bg-[#D9743A] text-black' 
                              : 'border-white/10 text-white/60 hover:border-white/20'
                            }
                          `}
                        >
                          {rating === 0 ? 'Any' : `${rating}+`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Minimum Price - Updated for quote-based model */}
                  <div>
                    <Label className="text-white/60 text-xs mb-2 block">Minimum Price (KES)</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        placeholder="0"
                        value={priceRange[0]}
                        onChange={(e) => setPriceRange([Number(e.target.value) || 0, priceRange[1]])}
                        className="bg-[#1E1E1E] border-white/10 text-white h-8 text-xs"
                      />
                      <span className="text-white/40 text-xs">-</span>
                      <Input
                        type="number"
                        placeholder="Any"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value) || 100000])}
                        className="bg-[#1E1E1E] border-white/10 text-white h-8 text-xs"
                      />
                    </div>
                    <p className="text-white/40 text-[10px] mt-1">Final quote on-site</p>
                  </div>
                </div>
              </Card>
            </aside>

            {/* Center: Provider Results - Single Column for Longer Cards */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <p className="text-white/60 text-xs sm:text-sm">
                  {isLoading ? (
                    "Loading providers..."
                  ) : (
                    <>
                      <span className="text-white font-medium">{filteredProviders.length}</span>{" "}
                      {filteredProviders.length === 1 ? "provider" : "providers"} available
                    </>
                  )}
                </p>
              </div>

              {/* Error State */}
              {error && (
                <Card className="bg-[#121212] border-white/10 p-12 text-center">
                  <p className="text-white/80 mb-2">Unable to load providers</p>
                  <p className="text-white/50 text-sm mb-4">
                    {error instanceof Error ? error.message : "Please try again later"}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="border-white/10 text-white"
                  >
                    Retry
                  </Button>
                </Card>
              )}

              {/* Loading State */}
              {isLoading && !error && (
                <div className="space-y-6">
                  {[...Array(4)].map((_, i) => (
                    <ProviderCardSkeleton key={i} />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && filteredProviders.length === 0 && (
                <Card className="bg-[#121212] border-white/10 p-12 text-center">
                  <p className="text-white/80 mb-2 text-lg font-medium">No providers found</p>
                  <p className="text-white/50 text-sm mb-6">
                    {providers.length === 0 
                      ? "No providers are currently available. Check back later!"
                      : "Try adjusting your filters or search terms."
                    }
                  </p>
                  {(searchQuery || verifiedOnly || minRating > 0 || priceRange[0] > 0 || priceRange[1] < 100000) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setVerifiedOnly(false);
                        setMinRating(0);
                        setPriceRange([0, 100000]);
                      }}
                      className="border-white/10 text-white"
                    >
                      Clear Filters
                    </Button>
                  )}
                </Card>
              )}

              {/* Provider Cards - Single Column Layout */}
              {!isLoading && !error && filteredProviders.length > 0 && (
                <div className="space-y-4 sm:space-y-6">
                  {filteredProviders.map((provider, index) => (
                    <div
                      key={provider.id}
                      className="animate-fade-in-up"
                      style={{
                        animationDelay: `${Math.min(index * 50, 500)}ms`,
                        animationFillMode: 'both',
                      }}
                    >
                      <ProviderCard provider={provider} index={index} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Overlay - Toggleable, Responsive */}
        {showMap && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute right-0 sm:right-4 md:right-8 top-20 sm:top-24 sm:top-32 bottom-0 sm:bottom-4 md:bottom-8 w-full sm:w-96 max-w-[100vw] sm:max-w-[85vw] pointer-events-auto">
              <Card className="bg-[#121212] border-white/10 p-3 sm:p-4 h-full flex flex-col rounded-none sm:rounded-lg">
                <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                  <h3 className="font-medium text-sm">Map View</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMap(false)}
                    className="text-white/60 hover:text-white h-8 w-8 sm:h-6 sm:w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  {filteredProviders.length > 0 ? (
                    <Map professionals={filteredProviders} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/40 text-xs sm:text-sm">
                      Map will appear when providers are available
                    </div>
                  )}
                </div>
              </Card>
            </div>
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowMap(false)}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Services;
