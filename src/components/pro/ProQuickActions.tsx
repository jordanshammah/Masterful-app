import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Image,
  FileText,
  Star,
  Settings,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface ProQuickActionsProps {
  className?: string;
}

const ProQuickActions = React.forwardRef<HTMLDivElement, ProQuickActionsProps>(
  ({ className }, ref) => {
    const navigate = useNavigate();

    const actions = [
      {
        label: "Update Pricing",
        icon: DollarSign,
        onClick: () => navigate("/dashboard/pro?view=profile"),
        description: "Adjust your hourly rates",
      },
      {
        label: "Upload Portfolio",
        icon: Image,
        onClick: () => navigate("/dashboard/pro?view=profile"),
        description: "Showcase your work",
      },
      {
        label: "Update Documents",
        icon: FileText,
        onClick: () => navigate("/dashboard/pro?view=profile"),
        description: "ID, certifications",
      },
      {
        label: "View Ratings",
        icon: Star,
        onClick: () => navigate("/dashboard/pro?view=profile"),
        description: "Customer reviews",
        disabled: true,
      },
    ];

    return (
      <Card ref={ref} className={cn("bg-card/50 backdrop-blur-sm", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="outline"
                className={cn(
                  "w-full justify-start h-auto py-3 px-4",
                  "hover:bg-primary/5 hover:border-primary/50",
                  "transition-all duration-300",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  {!action.disabled && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </Button>
            );
          })}
        </CardContent>
      </Card>
    );
  }
);
ProQuickActions.displayName = "ProQuickActions";

export { ProQuickActions };
