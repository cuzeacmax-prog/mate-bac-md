-- ETAPA 61 PAS 2: re-linkarea curată exercițiu↔concept.
-- (aplicate pe remote prin MCP: etapa61_concept_family_membership,
--  etapa61_relink_curat, etapa61_modulul_vii_orfan_deliberat)
--
-- Un link există DOAR dacă: (a) conceptul ∈ familia modulului exercițiului
-- (concept_family_membership, calculată din muchii de scripts/relink/build-membership.ts)
-- și (b) similaritate ≥ 0.50.
-- PRAG 0.50, ales empiric: p10 in-family = 0.476, p10 out-family = 0.510 →
-- sub 0.50 chiar și potrivirile din același domeniu sunt în decila slabă;
-- distribuția e netedă (FĂRĂ vale naturală — recunoscut), poarta primară = curriculum-ul.
-- Max 3 linkuri/exercițiu. Exercițiu fără link valid = ORFAN (lipsește onest).
-- Legacy avea 2452 perechi duplicate → dedup cu max(similarity) per pereche.

-- 0) apartenența concept→familie (persistată, nu ghicită)
CREATE TABLE IF NOT EXISTS public.concept_family_membership (
  module text NOT NULL,
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  root_slug text NOT NULL,
  created_by text NOT NULL DEFAULT 'etapa61',
  PRIMARY KEY (module, concept_id, root_slug)
);
ALTER TABLE public.concept_family_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.concept_family_membership
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concept_family_membership TO service_role;
CREATE INDEX IF NOT EXISTS idx_cfm_module ON public.concept_family_membership (module, concept_id);

-- 1) arhivare intactă
ALTER TABLE public.exercise_concept_link RENAME TO exercise_concept_link_legacy;
COMMENT ON TABLE public.exercise_concept_link_legacy IS
  'ARHIVAT ETAPA 61: top-K embedding pur (median 9 linkuri/exercițiu, fără constrângere de domeniu). Înlocuit de exercise_concept_link (curriculum + prag 0.50 + top-3).';

-- 2) tabelul nou cu proveniență
CREATE TABLE public.exercise_concept_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercise_raw(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  similarity real NOT NULL,
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 3),
  module_ok boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'etapa61',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, concept_id)
);
ALTER TABLE public.exercise_concept_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.exercise_concept_link
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_concept_link TO service_role;
CREATE INDEX idx_ecl_concept ON public.exercise_concept_link (concept_id);
CREATE INDEX idx_ecl_exercise ON public.exercise_concept_link (exercise_id);

-- 3) popularea: legacy (dedup) ∩ familie ∩ prag, top-3 per exercițiu
INSERT INTO public.exercise_concept_link (exercise_id, concept_id, similarity, rank, module_ok)
SELECT exercise_id, concept_id, similarity, rn, true
FROM (
  SELECT d.exercise_id, d.concept_id, d.similarity,
    row_number() OVER (PARTITION BY d.exercise_id ORDER BY d.similarity DESC, d.concept_id) AS rn
  FROM (
    SELECT l.exercise_id, l.concept_id, max(l.similarity) AS similarity
    FROM public.exercise_concept_link_legacy l
    GROUP BY l.exercise_id, l.concept_id
  ) d
  JOIN public.exercise_raw er ON er.id = d.exercise_id
  WHERE d.similarity >= 0.50
    AND EXISTS (
      SELECT 1 FROM public.concept_family_membership m
      WHERE m.module = er.module AND m.concept_id = d.concept_id
    )
) t
WHERE rn <= 3;

-- 4) Modulul VII (teste MIXTE) = ORFAN DELIBERAT.
-- Dovadă din testul canonic: cu familia-uniune, integrale din testele VII se
-- linkau la „g10-modulul-numarului-real" cu sim 0.59–0.62 — poarta de curriculum
-- e vidă la un modul mixt. Mai bine fără link decât link otrăvit.
DELETE FROM public.exercise_concept_link
WHERE exercise_id IN (SELECT id FROM public.exercise_raw WHERE module = 'Modulul VII');
DELETE FROM public.concept_family_membership WHERE module = 'Modulul VII';
