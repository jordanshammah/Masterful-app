import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      // Security headers for development server
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(self), microphone=(), camera=()",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Security: Generate source maps only in development
    sourcemap: mode === "development",
    // Improve build security
    rollupOptions: {
      output: {
        // Sanitize file names
        sanitizeFileName: (name) => {
          const INVALID_CHAR_REGEX = /[<>:"/\\|?*\x00-\x1F]/g;
          const DRIVE_LETTER_REGEX = /^[a-z]:/i;
          
          const sanitized = name.replace(INVALID_CHAR_REGEX, '');
          
          if (DRIVE_LETTER_REGEX.test(sanitized)) {
            return sanitized.slice(2);
          }
          
          return sanitized;
        },
      },
    },
  },
}));
