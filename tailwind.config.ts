import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Design System Colors - Exact Brand Tokens (via CSS variables)
        primary: {
          DEFAULT: "hsl(var(--color-primary))", // #D9743A Burnt Orange
          hover: "hsl(var(--color-primary-hover))", // #C25A2C Primary Accent Hover
          foreground: "hsl(0 0% 0%)", // Black text on orange
        },
        dark: {
          base: "hsl(var(--color-dark-base))", // #0A0A0A Dark Background
        },
        surface: {
          DEFAULT: "hsl(var(--color-surface))", // #121212 Card Surface
          muted: "hsl(var(--color-surface-muted))", // #1E1E1E Muted Surface
        },
        text: {
          primary: "hsl(var(--color-text-primary))", // #FFFFFF Text Primary
          muted: "hsl(var(--color-text-muted))", // #A6A6A6 Text Secondary
        },
        cream: "hsl(var(--color-cream))", // #F5EFE8 Cream Accent
        error: "hsl(var(--color-error))", // #FF4D4F Error Red
        success: "hsl(var(--color-success))", // #22C55E Success Green
        // Legacy compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-premium': 'var(--gradient-premium)',
        'gradient-overlay': 'var(--gradient-overlay)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        'glow': 'var(--shadow-glow)',
        'glow-lg': 'var(--shadow-glow-lg)',
        'elevation-1': 'var(--elevation-1)',
        'elevation-2': 'var(--elevation-2)',
      },
      transitionProperty: {
        'smooth': 'var(--transition-smooth)',
      },
      borderRadius: {
        DEFAULT: "var(--radius-default)",
        lg: "var(--radius-default)",
        md: "calc(var(--radius-default) - 2px)",
        sm: "calc(var(--radius-default) - 4px)",
        button: "var(--radius-button)",
        modal: "var(--radius-modal)",
      },
      spacing: {
        'grid': 'var(--spacing-grid)',
        'container-desktop': 'var(--container-padding-desktop)',
        'container-tablet': 'var(--container-padding-tablet)',
        'container-mobile': 'var(--container-padding-mobile)',
        'card': 'var(--card-padding)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "button-press": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.985)" },
          "100%": { transform: "scale(1)" },
        },
        "rush-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "button-press": "button-press 80ms ease-out",
        "rush-pulse": "rush-pulse 80ms ease-out 2",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
