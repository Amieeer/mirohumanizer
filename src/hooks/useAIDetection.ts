import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DetectionScore {
  aiWritten: number;
  aiRefined: number;
  humanWritten: number;
}

export const useAIDetection = () => {
  const [isLoading, setIsLoading] = useState(false);

  const detectAI = async (text: string): Promise<DetectionScore | null> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('detect-ai', {
        body: { text }
      });

      if (error) {
        console.error('Detection error:', error);
        
        if (error.message?.includes('429')) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
        } else if (error.message?.includes('402')) {
          toast.error('AI credits depleted. Please add credits to continue.');
        } else {
          toast.error(error.message || 'Failed to analyze text');
        }
        return null;
      }

      return data as DetectionScore;
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { detectAI, isLoading };
};
