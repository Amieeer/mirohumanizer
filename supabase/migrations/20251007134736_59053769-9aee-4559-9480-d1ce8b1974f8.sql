-- Remove public access to api_call_logs table
-- This is internal system data that should not be exposed to clients
-- Edge functions will continue to work as they use service role privileges

-- Drop the public select policy
DROP POLICY IF EXISTS "Allow public select on api_call_logs" ON public.api_call_logs;

-- Drop the public insert policy  
DROP POLICY IF EXISTS "Allow public insert on api_call_logs" ON public.api_call_logs;

-- Note: In the future, when authentication is implemented, 
-- admin-only policies should be added for viewing logs:
-- CREATE POLICY "Admins can view logs" ON public.api_call_logs
-- FOR SELECT USING (public.has_role(auth.uid(), 'admin'));