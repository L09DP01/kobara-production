-- Create 'products' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Setup RLS for the 'products' bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can upload product images" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'products');

CREATE POLICY "Users can update their own product images" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (bucket_id = 'products' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own product images" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'products' AND auth.uid() = owner);
