-- Fix RLS policies to prevent unauthorized modifications and deletions

-- 1. API Call Logs: Prevent UPDATE and DELETE (audit trail integrity)
CREATE POLICY "API logs cannot be updated"
ON public.api_call_logs
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "API logs cannot be deleted"
ON public.api_call_logs
FOR DELETE
TO authenticated
USING (false);

-- 2. Profiles: Prevent DELETE (user data protection)
CREATE POLICY "Profiles cannot be deleted by users"
ON public.profiles
FOR DELETE
TO authenticated
USING (false);

-- 3. Iterations: Prevent UPDATE and DELETE (document history integrity)
CREATE POLICY "Iterations cannot be updated"
ON public.iterations
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Iterations cannot be deleted by users"
ON public.iterations
FOR DELETE
TO authenticated
USING (false);