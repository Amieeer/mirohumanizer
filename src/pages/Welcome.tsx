import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, Zap } from "lucide-react";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Miro Write</h1>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Main Heading */}
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">
              AI Detection & Humanization
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Detect AI-generated content and refine it to pass as human-written. Perfect for academic, marketing, and professional use.
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 my-12">
            <div className="p-6 rounded-xl bg-card border border-border hover:border-primary transition-colors">
              <Shield className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">AI Detection</h3>
              <p className="text-sm text-muted-foreground">
                Analyze text to identify AI-generated, AI-refined, and human-written content
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border hover:border-primary transition-colors">
              <Zap className="h-8 w-8 text-warning mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Smart Humanization</h3>
              <p className="text-sm text-muted-foreground">
                Iteratively refine content until AI detection drops below 20%
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border hover:border-primary transition-colors">
              <Sparkles className="h-8 w-8 text-success mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Session History</h3>
              <p className="text-sm text-muted-foreground">
                Track all iterations and export refined content with full transparency
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            >
              Get Started
            </Button>
            <p className="text-sm text-muted-foreground">
              Sign up or log in to start analyzing
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2025 Miro Write. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
