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
import type { DetectionResult, DetectionScore } from "@/hooks/useAIDetection";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Palette } from "lucide-react";

interface Iteration {
  text: string;
  result: DetectionResult;
  timestamp: Date;
  round: number;
}

const Detector = () => {
  const navigate = useNavigate();
  const { detectAI, isLoading: isAnalyzing } = useAIDetection();
  const { humanizeText, isLoading: isHumanizing } = useHumanization();
  
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [currentResult, setCurrentResult] = useState<DetectionResult | null>(null);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [tone, setTone] = useState<'casual' | 'professional' | 'preserve'>('casual');

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
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
    if (!inputText.trim()) {
      toast.error("Please enter text to analyze");
      return;
    }

    if (inputText.length > 50000) {
      toast.error("Text exceeds maximum length of 50,000 characters");
      return;
    }

    const result = await detectAI(inputText);
    if (result) {
      setCurrentResult(result);
      setOutputText(inputText);
      setIterations([{
        text: inputText,
        result,
        timestamp: new Date(),
        round: 1
      }]);
      toast.success(`Analysis complete: ${result.summary}`);
    }
  };

  const humanize = async () => {
    if (!outputText.trim()) {
      toast.error("No text to humanize");
      return;
    }

    const humanizedText = await humanizeText(outputText, currentResult?.overallScores || null, tone);
    if (humanizedText) {
      // Re-analyze the humanized text
      const newResult = await detectAI(humanizedText);
      if (newResult) {
        setCurrentResult(newResult);
        setOutputText(humanizedText);
        setIterations(prev => [...prev, {
          text: humanizedText,
          result: newResult,
          timestamp: new Date(),
          round: prev.length + 1
        }]);
        
        const humanScore = newResult.overallScores.humanWritten;
        if (humanScore >= 90) {
          toast.success(`🎉 Excellent! Text is ${humanScore}% human!`);
        } else if (humanScore >= 80) {
          toast.success(`Great progress! Text is ${humanScore}% human.`);
        } else {
          toast.info(`Text is ${humanScore}% human. Continue refining for better results.`);
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
- AI Written: ${currentResult?.overallScores.aiWritten}%
- AI Refined: ${currentResult?.overallScores.aiRefined}%
- Human Written: ${currentResult?.overallScores.humanWritten}%

Summary: ${currentResult?.summary || 'N/A'}

Word Count: ${currentResult?.wordCount || 0}

Total Iterations: ${iterations.length}

Sentence-Level Analysis:
${currentResult?.sentences.map((s, i) => 
  `${i + 1}. [${s.classification}] (${(s.confidence * 100).toFixed(0)}% confidence) - ${s.reasoning}\n   "${s.text}"`
).join('\n\n') || 'N/A'}
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
    setCurrentResult(null);
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
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
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
                disabled={isAnalyzing || !inputText.trim()}
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
            {currentResult && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Detection Results</h2>
                
                {/* Summary */}
                <p className="text-sm text-muted-foreground mb-4 italic">"{currentResult.summary}"</p>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>AI Written</span>
                      <span className="font-semibold text-destructive">{currentResult.overallScores.aiWritten}%</span>
                    </div>
                    <Progress value={currentResult.overallScores.aiWritten} className="bg-muted [&>div]:bg-destructive" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>AI Refined</span>
                      <span className="font-semibold text-warning">{currentResult.overallScores.aiRefined}%</span>
                    </div>
                    <Progress value={currentResult.overallScores.aiRefined} className="bg-muted [&>div]:bg-warning" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Human Written</span>
                      <span className="font-semibold text-success">{currentResult.overallScores.humanWritten}%</span>
                    </div>
                    <Progress value={currentResult.overallScores.humanWritten} className="bg-muted [&>div]:bg-success" />
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Overall AI Detection</span>
                      <span className="text-destructive">{currentResult.overallScores.aiWritten + currentResult.overallScores.aiRefined}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Writing Tone</label>
                    <ToggleGroup type="single" value={tone} onValueChange={(value) => value && setTone(value as 'casual' | 'professional' | 'preserve')} className="justify-start gap-2">
                      <ToggleGroupItem value="casual" aria-label="Casual tone" className="flex-1">
                        <Coffee className="h-4 w-4 mr-2" />
                        Casual
                      </ToggleGroupItem>
                      <ToggleGroupItem value="professional" aria-label="Professional tone" className="flex-1">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Professional
                      </ToggleGroupItem>
                      <ToggleGroupItem value="preserve" aria-label="Preserve original tone" className="flex-1">
                        <Palette className="h-4 w-4 mr-2" />
                        Preserve
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={humanize}
                      disabled={isHumanizing}
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

            {/* Output Text with Sentence Highlighting */}
            <Card className="p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Refined Output</h2>
                {currentResult && (
                  <span className="text-xs text-muted-foreground">
                    {currentResult.wordCount} words • {currentResult.sentences.length} sentences
                  </span>
                )}
              </div>
              
              {currentResult ? (
                <div className="flex-1 min-h-[250px] p-3 border rounded-md bg-muted/30 overflow-auto">
                  <div className="space-y-2 leading-relaxed">
                    {currentResult.sentences.map((sentence, idx) => {
                      const bgClass = 
                        sentence.classification === 'AI' ? 'bg-destructive/20 border-l-4 border-destructive' :
                        sentence.classification === 'Likely AI' ? 'bg-warning/20 border-l-4 border-warning' :
                        'bg-success/10 border-l-4 border-success';
                      
                      return (
                        <div key={idx} className={`px-3 py-2 rounded ${bgClass} group cursor-help`}>
                          <span className="text-sm">{sentence.text}</span>
                          <div className="mt-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="font-semibold">{sentence.classification}</span>
                            {' • '}
                            {(sentence.confidence * 100).toFixed(0)}% confidence
                            {' • '}
                            {sentence.reasoning}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Textarea
                  placeholder="Results will appear here..."
                  className="flex-1 min-h-[250px] resize-none"
                  value={outputText}
                  readOnly
                />
              )}
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
                        <span className="text-destructive">{iter.result.overallScores.aiWritten}% AI</span>
                        <span className="text-warning">{iter.result.overallScores.aiRefined}% Refined</span>
                        <span className="text-success">{iter.result.overallScores.humanWritten}% Human</span>
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
