-- Fase 4 — Engine de Projeção, Parte A (itens #70 e #71)
-- Executado no Supabase SQL Editor em Jun/2026

-- 1. Coluna projection_rule na tabela categorias
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS projection_rule TEXT DEFAULT 'media_3';

-- 2. Tabela projecoes_manuais (overrides manuais por categoria/tipo/competência)
CREATE TABLE IF NOT EXISTS public.projecoes_manuais (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_slug    TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('R','D')),
  comp        TEXT NOT NULL,   -- formato YYYY-MM-01
  valor       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cat_slug, tipo, comp)
);

-- 3. Grants e RLS
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.projecoes_manuais
  TO authenticated;

GRANT SELECT
  ON public.projecoes_manuais
  TO anon;

ALTER TABLE public.projecoes_manuais
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON public.projecoes_manuais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
