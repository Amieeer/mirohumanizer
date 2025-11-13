import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DetectionScore } from "./useAIDetection";

export const useHumanization = () => {
  const [isLoading, setIsLoading] = useState(false);

  const humanizeText = async (
    text: string, 
    currentScore?: DetectionScore, 
    tone?: 'casual' | 'professional' | 'preserve'
  ): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('humanize-text', {
        body: { text, currentScore, tone }
      });

      if (error) {
        console.error('Humanization error:', error);
        
        if (error.message?.includes('429')) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
        } else if (error.message?.includes('402')) {
          toast.error('AI credits depleted. Please add credits to continue.');
        } else {
          toast.error(error.message || 'Failed to humanize text');
        }
        return null;
      }

      return data.humanizedText;
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { humanizeText, isLoading };
};

