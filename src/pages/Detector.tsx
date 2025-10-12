import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Download, RefreshCw, LogOut, Briefcase, Coffee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAIDetection } from "@/hooks/useAIDetection";
import { useHumanization } from "@/hooks/useHumanization";
import type { DetectionScore } from "@/hooks/useAIDetection";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Iteration {
  text: string;
  score: DetectionScore;
  timestamp: Date;
  round: number;
}

const Detector = () => {
  const navigate = useNavigate();
  const { detectAI, isLoading: isAnalyzing } = useAIDetection();
  const { humanizeText, isLoading: isHumanizing } = useHumanization();
  
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [currentScore, setCurrentScore] = useState<DetectionScore | null>(null);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [tone, setTone] = useState<'casual' | 'professional'>('casual');

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setAuthLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      console.error('Logout error:', error);
      toast.error("Error logging out");
    }
  };

  const analyzeText = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to use the detector");
      navigate("/auth");
      return;
    }
    
    if (!inputText.trim()) {
      toast.error("Please enter text to analyze");
      return;
    }

    if (inputText.length > 50000) {
      toast.error("Text exceeds maximum length of 50,000 characters");
      return;
    }

    const score = await detectAI(inputText);
    if (score) {
      setCurrentScore(score);
      setOutputText(inputText);
      setIterations([{
        text: inputText,
        score,
        timestamp: new Date(),
        round: 1
      }]);
      toast.success("Analysis complete");
    }
  };

  const humanize = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to use the humanizer");
      navigate("/auth");
      return;
    }
    
    if (!outputText.trim()) {
      toast.error("No text to humanize");
      return;
    }

    const humanizedText = await humanizeText(outputText, currentScore, tone);
    if (humanizedText) {
      // Re-analyze the humanized text
      const newScore = await detectAI(humanizedText);
      if (newScore) {
        setCurrentScore(newScore);
        setOutputText(humanizedText);
        setIterations(prev => [...prev, {
          text: humanizedText,
          score: newScore,
          timestamp: new Date(),
          round: prev.length + 1
        }]);
        
        if (newScore.humanWritten >= 90) {
          toast.success(`🎉 Excellent! Text is ${newScore.humanWritten}% human!`);
        } else if (newScore.humanWritten >= 80) {
          toast.success(`Great progress! Text is ${newScore.humanWritten}% human.`);
        } else {
          toast.info(`Text is ${newScore.humanWritten}% human. Continue refining for better results.`);
        }
      }
    }
  };

  const downloadResults = () => {
    const content = `Miro Write Analysis Report
=========================

Original Text:
${iterations[0]?.text || inputText}

Final Text:
${outputText}

Detection Scores:
- AI Written: ${currentScore?.aiWritten}%
- AI Refined: ${currentScore?.aiRefined}%
- Human Written: ${currentScore?.humanWritten}%

Total Iterations: ${iterations.length}
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "miro-write-report.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const reset = () => {
    setInputText("");
    setOutputText("");
    setCurrentScore(null);
    setIterations([]);
    toast.info("Session reset");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Miro Write</h1>
            </div>
            {isAuthenticated ? (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-6 h-full">
          {/* Input Panel */}
          <Card className="p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Original Text</h2>
            <Textarea
              placeholder="Paste your text here to analyze..."
              className="flex-1 min-h-[400px] resize-none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button
                onClick={analyzeText}
                disabled={isAnalyzing || !inputText.trim() || !isAuthenticated}
                className="flex-1"
                aria-label="Analyze text for AI detection"
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Text"}
              </Button>
              <Button variant="outline" onClick={reset}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          {/* Output Panel */}
          <div className="flex flex-col gap-6">
            {/* Detection Scores */}
            {currentScore && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Detection Results</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>AI Written</span>
                      <span className="font-semibold text-destructive">{currentScore.aiWritten}%</span>
                    </div>
                    <Progress value={currentScore.aiWritten} className="bg-muted [&>div]:bg-destructive" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>AI Refined</span>
                      <span className="font-semibold text-warning">{currentScore.aiRefined}%</span>
                    </div>
                    <Progress value={currentScore.aiRefined} className="bg-muted [&>div]:bg-warning" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Human Written</span>
                      <span className="font-semibold text-success">{currentScore.humanWritten}%</span>
                    </div>
                    <Progress value={currentScore.humanWritten} className="bg-muted [&>div]:bg-success" />
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Overall AI Detection</span>
                      <span className="text-destructive">{currentScore.aiWritten + currentScore.aiRefined}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Writing Tone</label>
                    <ToggleGroup type="single" value={tone} onValueChange={(value) => value && setTone(value as 'casual' | 'professional')} className="justify-start">
                      <ToggleGroupItem value="casual" aria-label="Casual tone" className="flex-1">
                        <Coffee className="h-4 w-4 mr-2" />
                        Casual
                      </ToggleGroupItem>
                      <ToggleGroupItem value="professional" aria-label="Professional tone" className="flex-1">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Professional
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={humanize}
                      disabled={isHumanizing || !isAuthenticated}
                      className="flex-1 bg-gradient-to-r from-primary to-accent"
                      aria-label="Humanize text to sound more natural"
                    >
                      {isHumanizing ? "Humanizing (targeting 90%+ human)..." : "Humanize Text"}
                    </Button>
                    <Button variant="outline" onClick={downloadResults}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Output Text */}
            <Card className="p-6 flex-1 flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Refined Output</h2>
              <Textarea
                placeholder="Results will appear here..."
                className="flex-1 min-h-[250px] resize-none"
                value={outputText}
                readOnly
              />
            </Card>

            {/* Iteration History */}
            {iterations.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Iteration History</h2>
                <div className="space-y-2">
                  {iterations.map((iter, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                      <span className="text-muted-foreground">Round {iter.round}</span>
                      <div className="flex gap-3 text-xs">
                        <span className="text-destructive">{iter.score.aiWritten}% AI</span>
                        <span className="text-warning">{iter.score.aiRefined}% Refined</span>
                        <span className="text-success">{iter.score.humanWritten}% Human</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Detector;
