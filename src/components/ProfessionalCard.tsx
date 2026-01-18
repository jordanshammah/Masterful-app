import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";

interface ProfessionalCardProps {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  location: string;
  hourlyRate: number;
  avatar: string;
  isVerified: boolean;
  responseTime: string;
  bio?: string;
  distanceKm?: number;
  distanceMiles?: number;
  showDistance?: boolean;
}

const ProfessionalCard = ({
  id,
  name,
  category,
  rating,
  reviewCount,
  location,
  hourlyRate,
  avatar,
  isVerified,
  responseTime,
  bio,
  distanceKm,
  distanceMiles,
  showDistance = true,
}: ProfessionalCardProps) => {
  const formatDistance = () => {
    if (!distanceKm && !distanceMiles) return null;
    if (distanceKm !== undefined && distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m away`;
    }
    if (distanceKm !== undefined) {
      return `${distanceKm.toFixed(1)} km away`;
    }
    if (distanceMiles !== undefined) {
      return `${distanceMiles.toFixed(1)} mi away`;
    }
    return null;
  };

  const distanceText = formatDistance();
  return (
    <Card className="group overflow-hidden border border-white/5 hover:border-[#C25A2C]/30 transition-all duration-300 hover:shadow-xl bg-[#050505] backdrop-blur-sm hover:-translate-y-1">
      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-white/10 group-hover:ring-[#C25A2C]/50 transition-all duration-300 shadow-md group-hover:shadow-glow">
              <img
                src={avatar}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-success rounded-full p-1.5 shadow-lg ring-2 ring-background">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white group-hover:text-[#C25A2C] transition-colors duration-300 mb-1 truncate">
              {name}
            </h3>
            <p className="text-sm text-white/60 mb-2">{category}</p>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                <Star className="w-4 h-4 fill-[#C25A2C] text-[#C25A2C]" />
                <span className="font-semibold text-white">{rating.toFixed(1)}</span>
              </div>
              <span className="text-xs text-white/50">
                ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-[#C25A2C] mb-0.5">${hourlyRate}</div>
            <div className="text-xs text-white/50">per hour</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-white/60 mb-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#C25A2C]" />
            <span className="truncate">{location}</span>
            {showDistance && distanceText && (
              <span className="text-[#C25A2C] font-medium">• {distanceText}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#C25A2C]" />
            <span>{responseTime}</span>
          </div>
        </div>

        {bio && (
          <p className="text-sm text-white/70 mb-4 line-clamp-2">{bio}</p>
        )}

        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="flex-1 border-white/10 text-white hover:bg-white/10" 
            asChild
          >
            <Link to={`/professional/${id}`}>View Profile</Link>
          </Button>
          <Button 
            className="flex-1 bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold shadow-md hover:shadow-glow transition-all duration-300" 
            asChild
          >
            <Link to={`/booking?proId=${id}`}>Book Now</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ProfessionalCard;
