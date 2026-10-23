-- Tabela principal de Leads de Prospecção Ativa (Protocolo V.L.A.E.G.)
-- Rode este script no SQL Editor do seu projeto no Supabase

CREATE TABLE IF NOT EXISTS public.prospect_leads (
  id TEXT PRIMARY KEY,
  niche_id TEXT NOT NULL,
  niche_name TEXT NOT NULL,
  location TEXT DEFAULT 'Brasil',
  username TEXT NOT NULL UNIQUE,
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
  pipeline_status TEXT DEFAULT 'novo',
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS com política aberta para uso do sistema (ajuste conforme necessidade de autenticação)
ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura e escrita publica prospect_leads" ON public.prospect_leads;
CREATE POLICY "Permitir leitura e escrita publica prospect_leads"
  ON public.prospect_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
