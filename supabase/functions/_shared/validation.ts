// Shared validation utilities for edge functions

export function sanitizeText(text: string): string {
  // Remove null bytes and other control characters
  return text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function validateTextInput(text: unknown, maxLength: number = 50000): { valid: boolean; error?: string; sanitized?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Text is required and must be a string' };
  }
  
  if (text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }
  
  if (text.length > maxLength) {
    return { valid: false, error: `Text exceeds maximum length of ${maxLength} characters` };
  }
  
  const sanitized = sanitizeText(text);
  return { valid: true, sanitized };
}

export function createErrorResponse(error: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

export function createSuccessResponse(data: unknown, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
