import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("🚀 Starting app initialization...");
console.log("Environment check:", {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? "SET" : "MISSING",
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "SET" : "MISSING",
});

// Helper function to safely escape HTML to prevent XSS
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Add error handling for initial render
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found! Make sure index.html has a <div id='root'></div>");
  }

  console.log("✅ Root element found");
  console.log("✅ Rendering App component...");
  
  createRoot(rootElement).render(<App />);
  
  console.log("✅ App rendered successfully");
} catch (error) {
  console.error("❌ Fatal error during initialization:", error);
  const rootElement = document.getElementById("root");
  
  // Safely escape error messages to prevent XSS
  const errorMessage = error instanceof Error ? escapeHtml(error.toString()) : escapeHtml(String(error));
  const errorStack = error instanceof Error && error.stack ? escapeHtml(error.stack) : '';
  
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height: 100vh; background: #000000; color: white; display: flex; align-items: center; justify-content: center; padding: 2rem; font-family: system-ui;">
        <div style="max-width: 600px;">
          <h1 style="color: #C25A2C; margin-bottom: 1rem;">Fatal Error</h1>
          <p style="color: #A6A6A6; margin-bottom: 1rem;">A fatal error occurred during app initialization.</p>
          <pre style="background: #121212; padding: 1rem; border-radius: 8px; overflow: auto; font-size: 12px; color: #ff4d4f; white-space: pre-wrap;">${errorMessage}
${errorStack}</pre>
          <p style="color: #A6A6A6; margin-top: 1rem; font-size: 14px;">Check the browser console (F12) for more details.</p>
        </div>
      </div>
    `;
  } else {
    document.body.innerHTML = `
      <div style="min-height: 100vh; background: #000000; color: white; display: flex; align-items: center; justify-content: center; padding: 2rem; font-family: system-ui;">
        <div style="max-width: 600px;">
          <h1 style="color: #C25A2C;">Critical Error</h1>
          <p style="color: #A6A6A6;">Root element not found. Check index.html</p>
        </div>
      </div>
    `;
  }
}
