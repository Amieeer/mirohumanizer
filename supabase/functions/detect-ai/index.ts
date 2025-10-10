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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detectionPrompt = `You are an elite AI content detector with advanced pattern recognition. Analyze this text with extreme precision.

Return ONLY a JSON object with these three scores that MUST sum to exactly 100:
{
  "aiWritten": <0-100>,
  "aiRefined": <0-100>,
  "humanWritten": <0-100>
}

CRITICAL DETECTION CRITERIA:

AI-WRITTEN INDICATORS (score higher aiWritten):
- Repetitive sentence structures and formulaic patterns
- Overuse of transition words: "Furthermore", "Moreover", "Additionally", "In conclusion"
- Perfectly balanced arguments without clear personal stance
- Generic examples lacking specificity
- Consistent sentence length and rhythm
- Overly formal or academic tone in casual contexts
- Lists and structured formatting (bullet points, numbered items)
- Absence of contractions in conversational contexts
- Predictable vocabulary choices
- Perfect grammar with no natural human errors

AI-REFINED INDICATORS (score higher aiRefined):
- Human ideas with unnaturally polished execution
- Mix of casual and formal language that feels inconsistent
- Personal anecdotes but with AI-like transitions
- Original thoughts expressed in generic phrasing
- Evidence of editing that removed personality
- Smoothed over rough edges that give writing character

HUMAN-WRITTEN INDICATORS (score higher humanWritten):
- Inconsistent sentence structures (mix of short, long, fragmented)
- Natural flow with occasional run-on sentences
- Personal voice with unique phrasing and word choices
- Specific, vivid examples and anecdotes
- Minor grammatical imperfections or typos
- Emotional nuance and authentic opinion
- Informal expressions, slang, or colloquialisms in appropriate contexts
- Unexpected word combinations
- Stream-of-consciousness elements
- Cultural references and context-specific knowledge

Analyze deeply for patterns, authenticity, and human imperfections.

Text to analyze:
${sanitizedText}`;

    console.log('Calling Lovable AI for detection...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'user', content: detectionPrompt }
        ],
        temperature: 0.1,
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
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    // Parse JSON from response
    const jsonMatch = aiResponse.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      console.error('Failed to parse JSON from AI response:', aiResponse);
      throw new Error('Invalid AI response format');
    }
    
    const scores = JSON.parse(jsonMatch[0]);
    
    return new Response(
      JSON.stringify({
        aiWritten: scores.aiWritten || 0,
        aiRefined: scores.aiRefined || 0,
        humanWritten: scores.humanWritten || 0,
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
