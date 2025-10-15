const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TEXT_LENGTH = 50000;
const BATCH_SIZE = 10; // Process sentences in batches for performance

interface SentenceAnalysis {
  text: string;
  classification: 'Human' | 'Likely AI' | 'AI';
  confidence: number;
  reasoning: string;
}

// Helper function to split text into sentences
function splitIntoSentences(text: string): string[] {
  // Split on common sentence endings while preserving the delimiter
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

// Helper function to process sentences in batches
async function analyzeSentenceBatch(
  sentences: string[],
  lovableApiKey: string
): Promise<SentenceAnalysis[]> {
  const batchPrompt = `You are a sentence-level AI text classifier. Analyze each of the following sentences and return ONLY a JSON array with your analysis.

Analyze for AI indicators like predictability, overly formal transition words, uniform sentence structure, and lack of a unique voice.

Sentences:
${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return a JSON array where each element corresponds to a sentence in order:
[
  {
    "classification": "<'Human'|'Likely AI'|'AI'>",
    "confidence": <0.0-1.0>,
    "reasoning": "<A brief, 2-5 word explanation>"
  }
]`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: batchPrompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Batch analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  try {
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const analyses = JSON.parse(jsonMatch[0]);
      return sentences.map((text, i) => ({
        text,
        classification: analyses[i]?.classification || 'Likely AI',
        confidence: analyses[i]?.confidence || 0.5,
        reasoning: analyses[i]?.reasoning || 'Unable to classify'
      }));
    }
  } catch (error) {
    console.error('Error parsing batch analysis:', error);
  }

  // Fallback: return default classification for all sentences
  return sentences.map(text => ({
    text,
    classification: 'Likely AI' as const,
    confidence: 0.5,
    reasoning: 'Analysis error'
  }));
}

// Helper function to synthesize overall scores
async function synthesizeOverallScores(
  sentenceAnalyses: SentenceAnalysis[],
  lovableApiKey: string
): Promise<{ overallScores: any; summary: string }> {
  const synthesisPrompt = `You are an AI detection summarizer. Given the following sentence-by-sentence analysis, calculate the overall percentage scores for the entire document and provide a one-sentence summary. The scores for aiWritten, aiRefined, and humanWritten must sum to 100.

Analysis Data:
${JSON.stringify(sentenceAnalyses, null, 2)}

Return ONLY a JSON object in this exact format:
{
  "overallScores": {
    "aiWritten": <percentage>,
    "aiRefined": <percentage>,
    "humanWritten": <percentage>
  },
  "summary": "<A single-sentence summary of the document's composition.>"
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Synthesis failed: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        overallScores: result.overallScores,
        summary: result.summary
      };
    }
  } catch (error) {
    console.error('Error parsing synthesis:', error);
  }

  // Fallback: calculate simple averages
  const aiCount = sentenceAnalyses.filter(s => s.classification === 'AI').length;
  const likelyAiCount = sentenceAnalyses.filter(s => s.classification === 'Likely AI').length;
  const humanCount = sentenceAnalyses.filter(s => s.classification === 'Human').length;
  const total = sentenceAnalyses.length;

  return {
    overallScores: {
      aiWritten: Math.round((aiCount / total) * 100),
      aiRefined: Math.round((likelyAiCount / total) * 100),
      humanWritten: Math.round((humanCount / total) * 100)
    },
    summary: 'Analysis completed with mixed results.'
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedText = text.replace(/\0/g, '');
    const wordCount = sanitizedText.split(/\s+/).filter(w => w.length > 0).length;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting sentence-level AI detection analysis...');

    // Step 1: Split text into sentences
    const sentences = splitIntoSentences(sanitizedText);
    console.log(`Analyzing ${sentences.length} sentences in batches of ${BATCH_SIZE}...`);

    // Step 2: Analyze sentences in batches
    const allAnalyses: SentenceAnalysis[] = [];
    
    for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
      const batch = sentences.slice(i, i + BATCH_SIZE);
      try {
        const batchAnalyses = await analyzeSentenceBatch(batch, LOVABLE_API_KEY);
        allAnalyses.push(...batchAnalyses);
        console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sentences.length / BATCH_SIZE)}`);
      } catch (error) {
        console.error(`Error analyzing batch ${i / BATCH_SIZE}:`, error);
        
        if (error instanceof Error && error.message.includes('429')) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (error instanceof Error && error.message.includes('402')) {
          return new Response(
            JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Add fallback analyses for failed batch
        allAnalyses.push(...batch.map(text => ({
          text,
          classification: 'Likely AI' as const,
          confidence: 0.5,
          reasoning: 'Analysis error'
        })));
      }
    }

    // Step 3: Synthesize overall scores and summary
    let synthesis;
    try {
      synthesis = await synthesizeOverallScores(allAnalyses, LOVABLE_API_KEY);
    } catch (error) {
      console.error('Error in synthesis:', error);
      
      // Fallback synthesis
      const aiCount = allAnalyses.filter(s => s.classification === 'AI').length;
      const likelyAiCount = allAnalyses.filter(s => s.classification === 'Likely AI').length;
      const humanCount = allAnalyses.filter(s => s.classification === 'Human').length;
      const total = allAnalyses.length;

      synthesis = {
        overallScores: {
          aiWritten: Math.round((aiCount / total) * 100),
          aiRefined: Math.round((likelyAiCount / total) * 100),
          humanWritten: Math.round((humanCount / total) * 100)
        },
        summary: 'Analysis completed successfully.'
      };
    }

    console.log('Analysis complete:', synthesis);
    
    return new Response(
      JSON.stringify({
        overallScores: synthesis.overallScores,
        summary: synthesis.summary,
        sentences: allAnalyses,
        wordCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in detect-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
