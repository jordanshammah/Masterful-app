/**
 * Auth Pages - Rebuilt with Clean Role System
 * Login: Email + Password OR Google
 * Signup: Choose role → Email + Password OR Google
 * Supports intended_role parameter for OAuth preservation
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api/customer";
import { 
  handlePostAuthRedirect, 
  setWantsProvider,
  clearWantsProvider,
  wantsProvider,
} from "@/lib/utils/auth-redirect";
import { getOAuthRedirectUrl } from "@/lib/utils/oauth-redirect";
import { Mail, ArrowLeft } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"customer" | "provider" | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const hasRedirected = useRef(false);
  const hasCheckedUser = useRef(false);

  const isSignupPage = location.pathname === "/signup";
  const token = searchParams.get("token");
  const type = searchParams.get("type");
  const wantsProviderParam = searchParams.get("wants_provider") === "true";

  // If wants_provider is in URL params or sessionStorage, set it
  // Only auto-set to provider if explicitly indicated - otherwise show role selection
  useEffect(() => {
    if (isSignupPage) {
      // Check sessionStorage first (most immediate)
      if (wantsProvider()) {
        setSelectedRole("provider");
        console.log("[Auth] Found wants_provider flag in sessionStorage");
      }
      // Then check URL params
      else if (wantsProviderParam) {
        setSelectedRole("provider");
        setWantsProvider();
        console.log("[Auth] Found wants_provider in URL params");
      }
      // Don't auto-set to customer - let user choose
      // Only set if explicitly coming from a "become pro" flow
    }
  }, [wantsProviderParam, isSignupPage]);

  // REMOVED: Auth state change listener - this was causing constant re-renders
  // OAuth redirects are handled by AuthCallback component
  // Manual logins are handled by handleLogin function

  // Check for existing user ONLY once on initial mount
  // This prevents constant re-renders and page refreshes
  useEffect(() => {
    const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";
    if (!isAuthPage) return;
    
    // Only check once, ever - don't re-check on pathname changes
    if (hasCheckedUser.current || hasRedirected.current) return;
    
    // Check if redirect is in progress (from another component)
    if (sessionStorage.getItem("auth_redirect_in_progress") === "true") {
      console.log("[Auth] Redirect in progress, skipping check");
      return;
    }
    
    // Mark as checked immediately
    hasCheckedUser.current = true;
    
    const checkUser = async () => {
      // Double-check we haven't redirected
      if (hasRedirected.current) return;
      
      // Check again if redirect started
      if (sessionStorage.getItem("auth_redirect_in_progress") === "true") {
        console.log("[Auth] Redirect started during check, aborting");
        return;
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Only redirect if we have a valid session
        if (session?.user && !hasRedirected.current) {
          // Check again before redirecting
          if (sessionStorage.getItem("auth_redirect_in_progress") === "true") {
            return;
          }
          
          // User is already logged in - redirect them
          hasRedirected.current = true;
          await handlePostAuthRedirect(session.user.id, navigate);
        }
      } catch (error) {
        console.error("[Auth] Error checking user:", error);
        // Don't redirect on error - let user proceed with login
      }
    };

    // Small delay to allow page to render first
    const timeoutId = setTimeout(checkUser, 200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // Empty deps - only run once on mount, never re-run

  // Handle email verification
  useEffect(() => {
    if (token && type === "signup") {
      handleEmailVerification(token);
    }
  }, [token, type]);

  const handleEmailVerification = async (tokenHash: string) => {
    setLoading(true);
    try {
      // Verify the OTP token
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "signup",
      });

      if (verifyError) throw verifyError;

      // Get the session after verification
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("[Auth] Session error after verification:", sessionError);
        throw sessionError;
      }

      // If no session, try to get user directly
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("Failed to get user after verification");
      }

      // Check if wants_provider flag is in URL params (from email link)
      const wantsProviderFromUrl = searchParams.get("wants_provider") === "true";
      
      // Check user metadata for wants_provider flag (persists across devices)
      const wantsProviderFromMetadata = user.user_metadata?.wants_provider === true;
      
      // Set flag if found in URL or metadata
      if (wantsProviderFromUrl || wantsProviderFromMetadata) {
        setWantsProvider();
        console.log("[Auth] Email verification - wants_provider found, setting flag", {
          fromUrl: wantsProviderFromUrl,
          fromMetadata: wantsProviderFromMetadata
        });
      }

      // Check if user wants to be a provider (from sessionStorage, URL, or metadata)
      if (wantsProvider()) {
        console.log("[Auth] Email verification - user wants to be provider");
      }

      // Ensure session is refreshed
      if (!session) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn("[Auth] Could not refresh session:", refreshError);
        }
      }

      // Ensure session is established
      if (!session) {
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (!newSession) {
          throw new Error("Session not established after verification");
        }
      }

      hasRedirected.current = true;
      
      // Redirect to appropriate page
      await handlePostAuthRedirect(user.id, navigate);
    } catch (error: any) {
      console.error("[Auth] Email verification error:", error);
      toast({
        title: "Verification failed",
        description: error.message || "Something went wrong during verification",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading || hasRedirected.current) return;
    
    setLoading(true);

    try {
      const data = await authApi.login(email, password);

      if (!data || !data.user) {
        throw new Error("Login failed: No user data returned");
      }

      // Prevent multiple redirects
      if (hasRedirected.current) {
        setLoading(false);
        return;
      }

      hasRedirected.current = true;

      // Ensure session is established before redirecting
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Wait a moment for session to establish
        await new Promise(resolve => setTimeout(resolve, 300));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (!retrySession) {
          throw new Error("Session not established after login");
        }
      }

      // Show success message
      toast({
        title: "Welcome back!",
        description: "You've been successfully logged in"
      });

      // Single redirect - no fallbacks
      await handlePostAuthRedirect(data.user.id, navigate);
      
    } catch (error: any) {
      hasRedirected.current = false;
      setLoading(false);
      
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive"
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) {
      toast({
        title: "Please select a role",
        description: "Choose whether you're signing up as a Customer or Provider",
        variant: "destructive"
      });
      return;
    }

    if (!fullName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your full name",
        variant: "destructive"
      });
      return;
    }

    // Password validation: min 8 chars, at least one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      toast({
        title: "Password requirements not met",
        description: "Password must be at least 8 characters with uppercase, lowercase, and a number",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Check if user wants to be a provider
      const wantsToBeProvider = selectedRole === "provider";
      
      // Set wants_provider flag if they selected provider
      if (wantsToBeProvider) {
        setWantsProvider();
      } else {
        clearWantsProvider();
      }

      console.log("[Auth] Email signup - wants_provider:", wantsToBeProvider);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?wants_provider=${wantsToBeProvider}`,
          data: {
            full_name: fullName.trim(),
            wants_provider: wantsToBeProvider, // Store in metadata so it persists across devices
          }
        }
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a verification link"
      });
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      // Check if user wants to be a provider
      const wantsToBeProvider = selectedRole === "provider";
      
      // Set wants_provider flag if they selected provider
      if (wantsToBeProvider) {
        setWantsProvider();
      } else {
        clearWantsProvider();
      }
      
      console.log("[Auth] Google OAuth - wants_provider:", wantsToBeProvider);

      // Use the utility function to get the correct redirect URL for mobile/desktop
      const redirectUrl = getOAuthRedirectUrl('/auth/callback', {
        wants_provider: wantsToBeProvider
      });

      console.log("[Auth] OAuth redirect URL:", redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("[Auth] OAuth error:", error);
      toast({
        title: "Authentication failed",
        description: error.message || "Failed to start OAuth flow. Please check your internet connection and try again.",
        variant: "destructive"
      });
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#22C55E]/20 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-[#22C55E]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white">Check your email</h2>
              <p className="text-[#A6A6A6]">
                We've sent a verification link to <strong className="text-white">{email}</strong>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setEmailSent(false);
              setEmail("");
              setPassword("");
            }}
            className="border-white/10 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Signup: Step 1 - Choose Role
  if (isSignupPage && !selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">Create Account</h1>
            <p className="text-[#A6A6A6]">Choose how you want to use Masterful</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setSelectedRole("customer");
                clearWantsProvider(); // Clear any previous Pro intent
                console.log("[Auth] User selected 'Sign up as Customer'");
              }}
              className="w-full p-8 bg-[#121212] border-2 border-white/10 hover:border-[#D9743A] rounded-[12px] text-left transition-all"
            >
              <h3 className="text-xl font-semibold text-white mb-2">Sign up as Customer</h3>
              <p className="text-[#A6A6A6]">Book services from verified professionals</p>
            </button>

            <button
              onClick={() => {
                setSelectedRole("provider");
                setWantsProvider();
                console.log("[Auth] User selected 'Sign up as Pro'");
              }}
              className="w-full p-8 bg-[#121212] border-2 border-white/10 hover:border-[#D9743A] rounded-[12px] text-left transition-all"
            >
              <h3 className="text-xl font-semibold text-white mb-2">Sign up as Pro</h3>
              <p className="text-[#A6A6A6]">Offer your services to customers</p>
            </button>
          </div>

          <div className="text-center">
            <p className="text-[#A6A6A6] text-sm">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-[#D9743A] hover:text-[#C25A2C]"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login or Signup Step 2
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">
            {isSignupPage ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-[#A6A6A6]">
            {isSignupPage 
              ? `Signing up as ${selectedRole === "provider" ? "Pro" : "Customer"}`
              : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={isSignupPage ? handleSignup : handleLogin} className="space-y-6">
          {isSignupPage && (
            <div>
              <Label htmlFor="fullName" className="text-white mb-2 block">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Doe"
                className="bg-[#1E1E1E] border-white/10 text-white placeholder:text-[#A6A6A6] h-12"
              />
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-white mb-2 block">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="bg-[#1E1E1E] border-white/10 text-white placeholder:text-[#A6A6A6] h-12"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-white mb-2 block">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="bg-[#1E1E1E] border-white/10 text-white placeholder:text-[#A6A6A6] h-12"
            />
          </div>

          {!isSignupPage && (
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-[#D9743A] hover:text-[#C25A2C]"
                onClick={() => {
                  toast({
                    title: "Forgot Password",
                    description: "Password reset functionality coming soon",
                  });
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold h-12" 
            disabled={loading}
          >
            {loading ? "Please wait..." : (isSignupPage ? "Sign Up" : "Sign In")}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-black text-[#A6A6A6]">Or continue with</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleAuth}
            className="w-full border-white/10 text-white hover:bg-white/10 h-12"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </Button>
        </div>

        <div className="text-center">
          <p className="text-[#A6A6A6] text-sm">
            {isSignupPage ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setSelectedRole(null);
                    navigate("/login");
                  }}
                  className="text-[#D9743A] hover:text-[#C25A2C]"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => navigate("/signup")}
                  className="text-[#D9743A] hover:text-[#C25A2C]"
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
