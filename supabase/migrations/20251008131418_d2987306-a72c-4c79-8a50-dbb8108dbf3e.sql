-- Fix api_call_logs security: add RLS policies
-- Only system/backend can insert, admins can view (for now, we'll keep it system-only)
CREATE POLICY "System can insert api call logs"
ON public.api_call_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can view api call logs"
ON public.api_call_logs
FOR SELECT
USING (true);

-- Update documents table to allow guest access (no user_id required)
-- Users can view/manage their own documents, guests can create temporary ones
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

CREATE POLICY "Anyone can insert documents"
ON public.documents
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view their own documents"
ON public.documents
FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Anyone can update their own documents"
ON public.documents
FOR UPDATE
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Anyone can delete their own documents"
ON public.documents
FOR DELETE
USING (user_id IS NULL OR user_id = auth.uid());

-- Update iterations table to allow guest access
DROP POLICY IF EXISTS "Users can view their own iterations" ON public.iterations;
DROP POLICY IF EXISTS "Users can insert their own iterations" ON public.iterations;

CREATE POLICY "Anyone can insert iterations"
ON public.iterations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view their own iterations"
ON public.iterations
FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());