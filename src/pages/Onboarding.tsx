import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setWantsProvider, clearWantsProvider } from "@/lib/utils/auth-redirect";
import { User, Briefcase, ArrowRight, Mail, CheckCircle2 } from "lucide-react";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<"customer" | "pro" | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleRoleSelect = (role: "customer" | "pro") => {
    setSelectedRole(role);
    // Set wants_provider flag if pro
    if (role === "pro") {
      setWantsProvider();
    } else {
      clearWantsProvider();
    }
    console.log("[Onboarding] User selected role:", role);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !email) return;

    setLoading(true);
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", email)
        .single();

      if (existingUser) {
        // User exists, redirect to login
        toast({
          title: "Account found",
          description: "Please log in to continue",
        });
        navigate("/login");
        return;
      }

      // Set wants_provider flag if pro
      const wantsToBeProvider = selectedRole === "pro";
      if (wantsToBeProvider) {
        setWantsProvider();
      } else {
        clearWantsProvider();
      }
      console.log("[Onboarding] Sending OTP - wants_provider:", wantsToBeProvider);

      // Send magic link for new user
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?wants_provider=${wantsToBeProvider}`,
        },
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a verification link",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo/Brand */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">Masterful</h1>
          <p className="text-muted-foreground text-lg">Choose your path</p>
        </div>

        {!emailSent ? (
          <>
            {/* Role Selection */}
            {!selectedRole ? (
              <div className="space-y-6 animate-fade-in-up">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Customer Card */}
                  <Card
                    className="p-8 cursor-pointer transition-all duration-300 hover:shadow-lg border-2 hover:border-primary/50 group"
                    onClick={() => handleRoleSelect("customer")}
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <User className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-2xl font-semibold">Customer</h3>
                      <p className="text-muted-foreground">
                        Find trusted professionals for your home service needs
                      </p>
                    </div>
                  </Card>

                  {/* Pro Card */}
                  <Card
                    className="p-8 cursor-pointer transition-all duration-300 hover:shadow-lg border-2 hover:border-primary/50 group"
                    onClick={() => handleRoleSelect("pro")}
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Briefcase className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-2xl font-semibold">Pro</h3>
                      <p className="text-muted-foreground">
                        Grow your business and connect with customers
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              /* Email Input */
              <Card className="p-8 animate-fade-in-up">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-3xl font-semibold mb-2">
                      {selectedRole === "customer" ? "Welcome, Customer" : "Welcome, Pro"}
                    </h2>
                    <p className="text-muted-foreground">
                      Enter your email to get started
                    </p>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="pl-10 h-14"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedRole(null)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary-hover"
                        disabled={loading}
                      >
                        {loading ? "Sending..." : "Continue"}
                        {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>
            )}
          </>
        ) : (
          /* Email Sent Confirmation */
          <Card className="p-8 animate-fade-in-up">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="text-3xl font-semibold mb-2">Check your email</h2>
                <p className="text-muted-foreground mb-4">
                  We've sent a verification link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to complete your registration
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
              >
                Use a different email
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Onboarding;











