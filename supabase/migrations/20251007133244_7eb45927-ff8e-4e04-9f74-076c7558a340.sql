-- Create documents table to store analysis sessions
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  humanized_text TEXT,
  final_ai_score INTEGER,
  final_human_score INTEGER,
  filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create iterations table to track humanization rounds
CREATE TABLE public.iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  text TEXT NOT NULL,
  ai_written_score INTEGER NOT NULL,
  ai_refined_score INTEGER NOT NULL,
  human_written_score INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create API call logs table for tracking
CREATE TABLE public.api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  api_type TEXT NOT NULL, -- 'detection' or 'humanization'
  api_name TEXT, -- which specific API was used
  input_text TEXT,
  output_text TEXT,
  score INTEGER,
  status TEXT NOT NULL, -- 'success', 'error', 'pending'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables (public access for guest mode)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (guest mode)
CREATE POLICY "Allow public insert on documents" 
ON public.documents 
FOR INSERT 
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public select on documents" 
ON public.documents 
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Allow public update on documents" 
ON public.documents 
FOR UPDATE 
TO anon
USING (true);

CREATE POLICY "Allow public insert on iterations" 
ON public.iterations 
FOR INSERT 
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public select on iterations" 
ON public.iterations 
FOR SELECT 
TO anon
USING (true);

CREATE POLICY "Allow public insert on api_call_logs" 
ON public.api_call_logs 
FOR INSERT 
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public select on api_call_logs" 
ON public.api_call_logs 
FOR SELECT 
TO anon
USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for documents table
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_iterations_document_id ON public.iterations(document_id);
CREATE INDEX idx_api_call_logs_document_id ON public.api_call_logs(document_id);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);