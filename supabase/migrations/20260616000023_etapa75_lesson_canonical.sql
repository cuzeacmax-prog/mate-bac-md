-- ETAPA 75 FAZA B1: lecțiile CANONICE — generate o singură dată (build-time),
-- servite cu cost LLM ~0, revizuite de profesor în /admin/lectii.
-- (aplicată pe remote prin MCP apply_migration: etapa75_lesson_canonical)
--
-- R5 întărit: blocks se construiesc EXCLUSIV din teoria grafului + exerciții
-- servibile + figurile existente; poarta anti-fabricație (scriptul de validare)
-- verifică fiecare referință înainte de persistare/servire.

CREATE TABLE IF NOT EXISTS public.lesson_canonical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  -- blocurile lecției (schema EXISTENTĂ de LessonBlock, validată la generare)
  blocks jsonb NOT NULL,
  -- sursele folosite: {exercise_ids: uuid[], theory_figure: slug|null}
  surse jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'generat' CHECK (status IN ('generat', 'aprobat-profesor')),
  observatii text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (concept_id, version)
);

-- RLS: scriere DOAR service; citirea către elev trece exclusiv prin server
-- (service role) — zero policies pentru anon/authenticated.
ALTER TABLE public.lesson_canonical ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_canonical TO service_role;

CREATE INDEX IF NOT EXISTS lesson_canonical_concept_idx
  ON public.lesson_canonical (concept_id, version DESC);
