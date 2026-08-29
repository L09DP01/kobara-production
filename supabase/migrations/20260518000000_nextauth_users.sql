-- Create public.users table for NextAuth custom authentication
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    verification_token TEXT,
    verification_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy for public.users: Only server-side admin client can access users table,
-- or if needed we can add simple select policies. Since we bypass RLS with Service Role,
-- we don't need any public read/write policies. But let's add a policy allowing users to read their own data:
CREATE POLICY "Users can view their own profile" ON public.users 
    FOR SELECT USING (id = auth.uid());

-- Re-target merchants foreign key from auth.users to public.users
ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS merchants_user_id_fkey;
ALTER TABLE public.merchants ADD CONSTRAINT merchants_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Re-target merchant_members foreign key from auth.users to public.users
ALTER TABLE public.merchant_members DROP CONSTRAINT IF EXISTS merchant_members_user_id_fkey;
ALTER TABLE public.merchant_members ADD CONSTRAINT merchant_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Re-target audit_logs foreign key from auth.users to public.users
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Update get_current_merchant_id function to work with NextAuth user context if it passes auth.uid() or similar,
-- but since we run server-side and pass user_id directly or bypass it via Admin Client, this is stable.
