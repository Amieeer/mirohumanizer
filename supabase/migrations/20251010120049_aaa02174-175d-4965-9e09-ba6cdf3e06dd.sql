-- Fix critical security issues

-- 1. Fix api_call_logs RLS - only allow authenticated users to see their own logs via documents
DROP POLICY IF EXISTS "System can view api call logs" ON api_call_logs;
DROP POLICY IF EXISTS "System can insert api call logs" ON api_call_logs;

CREATE POLICY "Users can view their own api call logs"
ON api_call_logs FOR SELECT
TO authenticated
USING (
  document_id IN (
    SELECT id FROM documents WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert api call logs"
ON api_call_logs FOR INSERT
WITH CHECK (true);

-- 2. Fix documents RLS - remove NULL user_id access (guest access will be handled differently)
DROP POLICY IF EXISTS "Anyone can view their own documents" ON documents;
DROP POLICY IF EXISTS "Anyone can insert documents" ON documents;
DROP POLICY IF EXISTS "Anyone can update their own documents" ON documents;
DROP POLICY IF EXISTS "Anyone can delete their own documents" ON documents;

-- Make user_id NOT NULL to enforce ownership
ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;

CREATE POLICY "Users can view their own documents"
ON documents FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own documents"
ON documents FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own documents"
ON documents FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
ON documents FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 3. Fix iterations RLS - remove NULL user_id access
DROP POLICY IF EXISTS "Anyone can view their own iterations" ON iterations;
DROP POLICY IF EXISTS "Anyone can insert iterations" ON iterations;

ALTER TABLE iterations ALTER COLUMN user_id SET NOT NULL;

CREATE POLICY "Users can view their own iterations"
ON iterations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own iterations"
ON iterations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());