import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });

    // In production, you might want to log to an error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Use window.location for error recovery only - this is acceptable
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <Card className="bg-[#050505] border-white/10 p-8 max-w-2xl w-full">
            <div className="flex items-center gap-4 mb-6">
              <AlertTriangle className="w-8 h-8 text-[#C25A2C]" />
              <h1 className="text-2xl font-semibold">Something went wrong</h1>
            </div>
            
            <p className="text-white/70 mb-6">
              We're sorry, but something unexpected happened. Please try refreshing the page or returning to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-black/50 rounded-lg border border-white/10">
                <p className="text-sm font-mono text-red-400 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-white/60">
                    <summary className="cursor-pointer mb-2">Stack trace</summary>
                    <pre className="overflow-auto max-h-48">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={this.handleReset}
                className="bg-[#C25A2C] hover:bg-[#e97645] text-black font-semibold"
              >
                Return to Home
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-white/10 text-white hover:bg-white/10"
              >
                Refresh Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;








