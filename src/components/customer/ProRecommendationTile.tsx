import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Star, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProRecommendationTileProps {
  id: string;
  name: string;
  photoUrl?: string;
  rating: number;
  category: string;
  location?: string;
  onViewProfile?: () => void;
  className?: string;
}

const ProRecommendationTile = React.forwardRef<HTMLDivElement, ProRecommendationTileProps>(
  ({ name, photoUrl, rating, category, location, onViewProfile, className }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "min-w-[280px] p-4",
          "flex flex-col gap-3",
          "transition-all duration-300",
          "hover:shadow-lg hover:shadow-primary/10",
          "bg-card/50 backdrop-blur-sm",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-14 h-14">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate mb-1">{name}</h4>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-primary text-primary" />
                <span className="text-sm font-medium">{rating.toFixed(1)}</span>
              </div>
              {location && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs truncate">{location}</span>
                </div>
              )}
            </div>
            <Badge variant="secondary" className="text-xs">
              {category}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewProfile}
          className="w-full"
        >
          View Profile
        </Button>
      </Card>
    );
  }
);
ProRecommendationTile.displayName = "ProRecommendationTile";

export { ProRecommendationTile };

