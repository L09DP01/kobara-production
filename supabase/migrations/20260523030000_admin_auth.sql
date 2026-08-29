-- Migration pour le système d'authentification Super Admin

-- 1. Table des Super Admins
CREATE TABLE IF NOT EXISTS public.super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des administrateurs par défaut
INSERT INTO public.super_admins (email)
VALUES 
    ('admin@kobara.com'),
    ('Lorvensondp4282@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Table pour les OTPs (Codes à usage unique)
CREATE TABLE IF NOT EXISTS public.admin_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer la recherche des OTPs
CREATE INDEX IF NOT EXISTS idx_admin_otps_email ON public.admin_otps(email);

-- Activer RLS mais avec des politiques qui bloquent tout accès direct par le client API
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;

-- Seul le rôle "service_role" (notre backend / admin client) peut lire ou écrire
CREATE POLICY "super_admins_service_role" ON public.super_admins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "admin_otps_service_role" ON public.admin_otps FOR ALL USING (auth.role() = 'service_role');
