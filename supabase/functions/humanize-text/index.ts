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
    const { text, currentScore, tone = 'casual' } = await req.json();
    
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
    const MAX_ITERATIONS = 5;
    const TARGET_HUMAN_SCORE = 100;

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

    // Iterate with Lovable AI until 100% human or max iterations
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      console.log(`Humanization iteration ${iterations}...`);

      const textToHumanize = humanizedText || sanitizedText;
      
      const toneGuidance = tone === 'professional' 
        ? `Maintain professional tone while still being authentically human:
- Use industry-appropriate language but avoid corporate jargon
- Keep formality without sounding robotic
- Include subtle personal insights that show expertise
- Use measured, confident language`
        : `Write in a casual, conversational tone:
- Use contractions freely (I'm, you're, it's)
- Include colloquialisms and everyday expressions
- Write like you're talking to a friend
- Don't be afraid of sentence fragments or run-ons for emphasis`;
      
      const systemPrompt = `You are an elite text transformation specialist. Your ONLY job is to rewrite text so it passes as 100% human-written.

CRITICAL MISSION: Achieve 100% human detection score. Nothing less is acceptable.

TONE: ${tone.toUpperCase()}
${toneGuidance}

ADVANCED HUMANIZATION TECHNIQUES:

1. DESTROY AI PATTERNS:
   - Eliminate "Furthermore", "Moreover", "Additionally", "In conclusion"
   - Break up perfectly balanced sentence structures
   - Remove symmetrical paragraph lengths
   - Vary rhythm unpredictably

2. INJECT AUTHENTIC HUMAN TRAITS:
   - Add minor imperfections (occasional repetition, slight redundancy)
   - Use unexpected word choices that feel natural
   - Include personal observations or asides
   - Add emotional undertones appropriate to content
   - Use specific, vivid details instead of generic statements

3. NATURAL FLOW:
   - Mix sentence lengths dramatically (3 words to 30+ words)
   - Use fragments for emphasis. Like this.
   - Occasional run-on sentences that flow naturally
   - Start sentences with "And", "But", "So" when it feels right

4. PERSONALITY INJECTION:
   - Add subtle humor or irony where appropriate
   - Include rhetorical questions
   - Use parenthetical asides (like this one)
   - Show opinion, don't just present facts

5. REMOVE ALL AI SIGNATURES:
   - No formulaic structures
   - No overly balanced arguments
   - No perfect grammar (slight natural imperfections are human)
   - No generic examples

Current detection: ${currentScore?.humanWritten || 0}% human, ${currentScore?.aiWritten || 0}% AI, ${currentScore?.aiRefined || 0}% refined
Iteration: ${iterations}/${MAX_ITERATIONS}
TARGET: 100% HUMAN DETECTION

Transform this text to achieve 100% human score:`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: textToHumanize }
          ],
          temperature: 0.95,
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

      // Check if we've achieved 100% human
      const detectionPrompt = `Analyze this text with extreme precision and return ONLY JSON with AI detection scores that sum to 100:
{"aiWritten": <0-100>, "aiRefined": <0-100>, "humanWritten": <0-100>}

Be extremely strict. Only score 100 humanWritten if the text is indistinguishable from authentic human writing.

Text to analyze:
${humanizedText}`;

      const detectionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [{ role: 'user', content: detectionPrompt }],
          temperature: 0.1,
        }),
      });

      if (detectionResponse.ok) {
        const detectionData = await detectionResponse.json();
        const detectionText = detectionData.choices[0].message.content;
        const jsonMatch = detectionText.match(/\{[^}]+\}/);
        
        if (jsonMatch) {
          const scores = JSON.parse(jsonMatch[0]);
          console.log(`Iteration ${iterations} score: ${scores.humanWritten}% human, ${scores.aiWritten}% AI, ${scores.aiRefined}% refined`);
          
          if (scores.humanWritten >= TARGET_HUMAN_SCORE) {
            console.log(`🎉 TARGET ACHIEVED! ${scores.humanWritten}% human detection`);
            break;
          }
          
          // If we're at 98-99%, do one more verification pass
          if (scores.humanWritten >= 98 && iterations < MAX_ITERATIONS) {
            console.log('Close to target, verifying...');
            continue;
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
