import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CategoryTileProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}

const CategoryTile = React.forwardRef<HTMLDivElement, CategoryTileProps>(
  ({ icon: Icon, label, onClick, className }, ref) => {
    return (
      <Card
        ref={ref}
        onClick={onClick}
        className={cn(
          "w-[120px] h-[140px] p-4",
          "flex flex-col items-center justify-center gap-3",
          "cursor-pointer transition-all duration-300",
          "hover:border-primary hover:shadow-lg hover:shadow-primary/10",
          "active:scale-[0.98]",
          "bg-card/50 backdrop-blur-sm",
          "group",
          className
        )}
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/20">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <span className="text-sm font-medium text-center">{label}</span>
      </Card>
    );
  }
);
CategoryTile.displayName = "CategoryTile";

export { CategoryTile };

