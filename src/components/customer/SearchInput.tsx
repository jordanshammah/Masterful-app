import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div
        className={cn(
          "relative transition-all duration-300",
          isFocused && "shadow-glow"
        )}
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          ref={ref}
          type="text"
          className={cn(
            "w-full h-14 pl-12 pr-4 rounded-2xl",
            "bg-card border border-border",
            "text-foreground placeholder:text-muted-foreground",
            "transition-all duration-300",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
            "focus:shadow-lg focus:shadow-primary/10",
            "hover:border-primary/30",
            className
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSearch) {
              onSearch(e.currentTarget.value);
            }
          }}
          {...props}
        />
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };

