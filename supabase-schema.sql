-- ============================================================================
-- SALLES PROSPECTOR (Protocolo V.L.A.E.G.) — Schema Oficial Supabase
-- Banco de Dados Multi-Usuário (Logins, Pré-Formulário de Nicho, Leads e Histórico)
-- ============================================================================

-- 1. Tabela de Contas / Logins (armazena cada usuário, seu pré-formulário, leads e configurações)
CREATE TABLE IF NOT EXISTS public.prospector_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT '123',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}'::jsonb,
  leads JSONB DEFAULT '[]'::jsonb,
  history JSONB DEFAULT '[]'::jsonb,
  deleted_usernames JSONB DEFAULT '[]'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prospector_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospector_users_all_policy" ON public.prospector_users;
CREATE POLICY "prospector_users_all_policy"
  ON public.prospector_users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Tabela Relacional de Leads de Prospecção Ativa (espelho analítico por lead)
CREATE TABLE IF NOT EXISTS public.prospect_leads (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'user-salles',
  niche_id TEXT NOT NULL,
  niche_name TEXT NOT NULL,
  location TEXT DEFAULT 'Brasil',
  username TEXT NOT NULL,
  full_name TEXT,
  profile_url TEXT,
  followers_count INTEGER DEFAULT 0,
  biography TEXT,
  external_url TEXT,
  in_ad_library BOOLEAN DEFAULT FALSE,
  active_ads_count INTEGER DEFAULT 0,
  ad_library_status_label TEXT DEFAULT 'Não está na Biblioteca',
  ad_library_url TEXT,
  priority TEXT DEFAULT 'ALTA',
  closing_potential TEXT DEFAULT 'ALTO',
  closing_score INTEGER DEFAULT 0,
  closing_reason TEXT,
  whatsapp_number TEXT,
  whatsapp_link TEXT,
  personalized_message TEXT,
  pipeline_status TEXT DEFAULT 'novo',
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura e escrita publica prospect_leads" ON public.prospect_leads;
CREATE POLICY "Permitir leitura e escrita publica prospect_leads"
  ON public.prospect_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
