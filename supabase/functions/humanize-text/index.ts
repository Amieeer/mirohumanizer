const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TEXT_LENGTH = 50000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, currentScore } = await req.json();
    
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const HUMANIZEAI_API_KEY = Deno.env.get('HUMANIZEAI_API_KEY');
    let humanizedText: string = sanitizedText;
    let iterations = 0;
    const MAX_ITERATIONS = 3;

    // Try HumanizeAI API first
    if (HUMANIZEAI_API_KEY) {
      try {
        console.log('Trying HumanizeAI API...');
        const humanizeResponse = await fetch('https://humanizeai.pro/api/humanize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUMANIZEAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: sanitizedText,
            mode: 'ultra'
          }),
        });

        if (humanizeResponse.ok) {
          const humanizeData = await humanizeResponse.json();
          humanizedText = humanizeData.humanizedText || humanizeData.text || humanizeData.result;
          console.log('HumanizeAI API successful');
        } else {
          console.log('HumanizeAI API failed, falling back to Lovable AI');
          throw new Error('HumanizeAI API failed');
        }
      } catch (error) {
        console.error('HumanizeAI error:', error);
        humanizedText = sanitizedText;
      }
    }

    // Iterate with Lovable AI until >80% human or max iterations
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      console.log(`Humanization iteration ${iterations}...`);

      const textToHumanize = humanizedText || sanitizedText;
      
      const systemPrompt = `You are a master at transforming AI-generated text into authentic, natural human writing.

CRITICAL: The text MUST pass AI detection as human-written (>80% human confidence).

Your transformation strategy:
1. Break robotic patterns - vary sentence length dramatically (mix short punchy sentences with longer flowing ones)
2. Add human imperfections - occasional informal phrasing, contractions, colloquialisms
3. Inject personality - use specific examples, personal perspective, emotional nuance
4. Natural transitions - avoid "Furthermore", "Moreover", "Additionally" - use conversational connectors
5. Authentic vocabulary - mix formal/informal, use unexpected but appropriate words
6. Remove AI tells - no overly balanced viewpoints, no formulaic structure
7. Add rhythm - vary paragraph length, use rhetorical questions, fragments for emphasis
8. Show, don't tell - replace generic statements with specific, vivid language

Current AI score: ${currentScore || 'unknown'}%
Iteration: ${iterations}/${MAX_ITERATIONS}
Target: >80% human detection

Transform this text into genuinely human writing:`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: textToHumanize }
          ],
          temperature: 0.9,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      humanizedText = data.choices[0].message.content;

      // Check if we've achieved >80% human
      const detectionPrompt = `Analyze this text and return ONLY JSON with AI detection scores that sum to 100:
{"aiWritten": <0-100>, "aiRefined": <0-100>, "humanWritten": <0-100>}

Text to analyze:
${humanizedText}`;

      const detectionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: detectionPrompt }],
          temperature: 0.2,
        }),
      });

      if (detectionResponse.ok) {
        const detectionData = await detectionResponse.json();
        const detectionText = detectionData.choices[0].message.content;
        const jsonMatch = detectionText.match(/\{[^}]+\}/);
        
        if (jsonMatch) {
          const scores = JSON.parse(jsonMatch[0]);
          console.log(`Iteration ${iterations} score: ${scores.humanWritten}% human`);
          
          if (scores.humanWritten >= 80) {
            console.log(`Target achieved! ${scores.humanWritten}% human`);
            break;
          }
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        console.log('Max iterations reached');
        break;
      }
    }
    
    console.log('Humanization complete');
    
    return new Response(
      JSON.stringify({ humanizedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in humanize-text function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
