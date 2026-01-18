/**
 * Auth Callback Handler - Simplified
 * Handles OAuth redirects and email verification callbacks
 * All users get customer role initially, provider signups go to onboarding
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handlePostAuthRedirect } from "@/lib/utils/auth-redirect";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

    const handleCallback = async () => {
      // Prevent multiple redirects
      if (hasRedirected) {
        console.log("[AuthCallback] Already redirected, skipping");
        return;
      }

      try {
        // Check if user wants to be a provider (from URL params or sessionStorage)
        const wantsProviderFlag = searchParams.get("wants_provider") === "true" || 
                                  sessionStorage.getItem("wants_provider") === "true";

        // Get the session - Supabase automatically handles the OAuth callback
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          // Try to exchange the code for a session (for OAuth flows)
          const currentUrl = window.location.href;
          console.log("[AuthCallback] Exchanging code for session, URL:", currentUrl);
          
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            currentUrl
          );
          
          if (error) {
            console.error("[AuthCallback] Exchange error:", error);
            // Provide more helpful error message for redirect URL mismatches
            if (error.message?.includes("redirect") || error.message?.includes("URL")) {
              throw new Error(
                "OAuth redirect URL mismatch. Please ensure your redirect URL is configured in Supabase. " +
                "Current URL: " + currentUrl
              );
            }
            throw error;
          }
          
          if (!data.session?.user) {
            throw new Error("No session found after authentication");
          }
        }

        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error("Failed to get user after authentication");
        }

        if (!isMounted || hasRedirected) return;

        // Check if wants_provider is in user metadata (persists across devices)
        const wantsProviderFromMetadata = user.user_metadata?.wants_provider === true;
        const finalWantsProviderFlag = wantsProviderFlag || wantsProviderFromMetadata;

        // All users get customer role (handled by database trigger)
        // If they want to be a provider, set flag for redirect
        if (finalWantsProviderFlag) {
          sessionStorage.setItem("wants_provider", "true");
          console.log("[AuthCallback] User wants to be provider, will redirect to onboarding", {
            fromUrl: wantsProviderFlag,
            fromMetadata: wantsProviderFromMetadata
          });
        } else {
          sessionStorage.removeItem("wants_provider");
        }

        // Mark as redirected before calling redirect handler
        hasRedirected = true;
        setStatus("success");

        // Redirect immediately
        await handlePostAuthRedirect(user.id, navigate);

      } catch (error: any) {
        if (!isMounted) return;

        console.error("Auth callback error:", error);
        setStatus("error");
        
        toast({
          title: "Authentication failed",
          description: error.message || "Something went wrong during sign in",
          variant: "destructive",
        });

        // Redirect to login immediately
        if (isMounted && !hasRedirected) {
          hasRedirected = true;
          navigate("/login", { replace: true });
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center space-y-4">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 border-4 border-[#D9743A] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white text-lg">Completing sign in...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-lg">Success! Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-white text-lg">Authentication failed</p>
            <p className="text-[#A6A6A6]">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
