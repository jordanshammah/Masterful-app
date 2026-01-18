/**
 * Provider Card Component - Longer, More Spacious
 * High-trust, conversion-focused with breathing room
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Shield, MapPin, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Provider } from "@/lib/api/providers";

interface ProviderCardProps {
  provider: Provider;
  index?: number;
}

const ProviderCard = ({ provider, index = 0 }: ProviderCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Get display name - prioritize business_name for businesses, fall back to display_name for freelancers
  const displayName = provider.business_name?.trim() 
    || provider.display_name?.trim() 
    || "Professional";
  const serviceName = provider.service_categories?.name || "Service";
  const location = provider.city || "Local area";
  const avatar = provider.profile_image_url;
  const rating = provider.rating || 0;
  const reviewCount = provider.review_count || 0;
  const minimumPrice = provider.minimum_job_price || provider.hourly_rate || 0;
  const bio = provider.bio;
  const isVerified = provider.is_verified || false;
  const distanceKm = provider.distance_km;
  const distanceMiles = provider.distance_miles;

  const formatDistance = () => {
    if (distanceMiles !== undefined) {
      if (distanceMiles < 1) {
        return `${Math.round(distanceMiles * 5280)} ft away`;
      }
      return `${distanceMiles.toFixed(1)} mi away`;
    }
    if (distanceKm !== undefined) {
      if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m away`;
      }
      return `${distanceKm.toFixed(1)} km away`;
    }
    return null;
  };

  const distanceText = formatDistance();
  const isAvailableToday = true;
  const responseTime = provider.avg_response_time || 45;

  const handleBookNow = () => {
    setIsBooking(true);
    setTimeout(() => {
      navigate(`/booking?proId=${provider.id}`);
    }, 150);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarFallback = (
    <div className="w-full h-full bg-gradient-to-br from-[#D9743A]/20 to-[#C25A2C]/20 flex items-center justify-center text-[#D9743A] font-semibold text-lg sm:text-xl">
      {getInitials(displayName)}
    </div>
  );

  return (
    <Card
      className={`
        group relative bg-[#121212] border border-white/10 
        hover:border-[#D9743A]/40 hover:shadow-[0_8px_24px_rgba(217,116,58,0.15)]
        transition-all duration-300 ease-out
        overflow-hidden
        ${isHovered ? 'shadow-lg -translate-y-1' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Header: Avatar + Name + Price */}
        <div className="flex items-start gap-3 sm:gap-5">
          {/* Avatar - Responsive */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-2 ring-white/10 group-hover:ring-[#D9743A]/40 transition-all duration-300">
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      // Safely remove image and create fallback
                      target.parentElement.removeChild(target);
                      const fallback = document.createElement('div');
                      fallback.className = 'w-full h-full bg-gradient-to-br from-[#D9743A]/20 to-[#C25A2C]/20 flex items-center justify-center text-[#D9743A] font-semibold text-lg sm:text-xl';
                      fallback.textContent = getInitials(displayName);
                      target.parentElement.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                avatarFallback
              )}
            </div>
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-[#D9743A] rounded-full p-1 sm:p-1.5 shadow-lg ring-2 ring-[#121212]">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
              </div>
            )}
          </div>

          {/* Name + Service + Rating */}
          <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-0.5 sm:mb-1 group-hover:text-[#D9743A] transition-colors duration-200 truncate">
                {displayName}
              </h3>
              <p className="text-xs sm:text-sm text-white/60 truncate">{serviceName}</p>
            </div>
            
            {/* Rating + Reviews + Verification */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#D9743A] text-[#D9743A]" />
                <span className="text-xs sm:text-sm font-semibold text-white">{rating.toFixed(1)}</span>
              </div>
              {reviewCount > 0 && (
                <span className="text-xs sm:text-sm text-white/50">
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              )}
              {isVerified && (
                <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-[#D9743A]">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Price - Responsive */}
          <div className="text-right flex-shrink-0 hidden sm:block">
            <div className="text-xs text-white/50 uppercase tracking-wide mb-1">From</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#D9743A] leading-none mb-1">
              KES {minimumPrice.toLocaleString()}
            </div>
            <div className="text-xs text-white/50">minimum</div>
          </div>
        </div>

        {/* Price - Mobile (shown below name on mobile) */}
        <div className="sm:hidden pt-1 pb-2 border-b border-white/5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-white/50 uppercase tracking-wide">From</span>
            <span className="text-2xl font-bold text-[#D9743A] leading-none">
              KES {minimumPrice.toLocaleString()}
            </span>
            <span className="text-xs text-white/50">minimum</span>
          </div>
        </div>

        {/* Bio - Expanded, More Space */}
        {bio && (
          <div className="pt-1 sm:pt-2">
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed line-clamp-2 sm:line-clamp-3">
              {bio}
            </p>
          </div>
        )}
        
        {/* Pricing Info */}
        <div className="pt-1 sm:pt-2 pb-1 sm:pb-2">
          <p className="text-[10px] sm:text-xs text-white/50 leading-relaxed">
            Exact quote provided on-site after assessment • Pay after job completion
          </p>
        </div>

        {/* Location + Availability - Responsive */}
        <div className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm text-white/60 pt-2 border-t border-white/5 flex-wrap">
          {distanceText && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">{distanceText}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </div>
          {isAvailableToday && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[#D9743A]">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>Available today</span>
            </div>
          )}
        </div>

        {/* CTAs - Responsive */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-3">
          <Button
            onClick={handleBookNow}
            disabled={isBooking}
            className={`
              w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-11 text-sm sm:text-base
              transition-all duration-200
              ${isHovered ? 'shadow-lg shadow-[#D9743A]/20' : ''}
              ${isBooking ? 'opacity-75 cursor-wait' : ''}
            `}
          >
            <span className="truncate">{isBooking ? 'Booking...' : 'Book Now'}</span>
            <ArrowRight className="ml-2 w-4 h-4 flex-shrink-0" />
          </Button>
        </div>
      </div>

      {/* Subtle hover glow */}
      <div className={`
        absolute inset-0 pointer-events-none
        bg-gradient-to-br from-[#D9743A]/0 to-[#D9743A]/0
        group-hover:from-[#D9743A]/5 group-hover:to-[#D9743A]/0
        transition-opacity duration-300
        rounded-lg
      `} />
    </Card>
  );
};

export default ProviderCard;
