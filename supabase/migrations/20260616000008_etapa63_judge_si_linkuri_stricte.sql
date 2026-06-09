-- ETAPA 63: evaluarea răspunsurilor elevului în chat-ul ancorat.
-- (aplicată pe remote prin MCP apply_migration: etapa63_judge_si_linkuri_stricte)
--
-- AUDIT (FAZA 2 P2, înainte de această migrație):
--   exercise_answer_link avea 276 rânduri istorice (39 'exact' + 237 'fuzzy').
--   Eșantion de 5 linkuri 'exact' unice: 3-4 vizibil GREȘITE (răspunsuri din altă
--   secțiune, potrivite doar pe numărul problemei). Criteriul strict
--   (sursă + secțiune identică + număr identic) aplicat pe linkurile istorice: 0 unice.
--   => linkurile istorice NU se folosesc pentru evaluare deterministă.
--
--   RE-POTRIVIRE strictă direct între tabele (exercise_raw × exercise_answers):
--   sursă identică + lower(trim(secțiune)) identic + trim(număr) identic,
--   păstrate DOAR perechile bijective (1 exercițiu ↔ 1 răspuns): 91 perechi.
--   Eșantion de 8: toate semantic plauzibile (2 verificate prin calcul).
--
-- 1) Linkuri noi cu match_confidence='strict-bijectiv' (cele istorice rămân,
--    dar nimic în afară de 'strict-bijectiv' nu e tratat ca neambiguu).
-- 2) Task nou 'judge_answer' în ai_model_config (Haiku, temperatura 0).

-- ── 1) Linkuri stricte bijective ────────────────────────────────────────────
WITH cand AS (
  SELECT er.id AS eid, a.id AS aid
  FROM exercise_raw er
  JOIN exercise_answers a
    ON a.source = er.source
   AND lower(trim(a.test_or_section)) = lower(trim(er.section))
   AND trim(a.problem_number) = trim(er.exercise_number)
  WHERE er.section IS NOT NULL
),
per_e AS (SELECT eid, count(*) n FROM cand GROUP BY eid),
per_a AS (SELECT aid, count(*) n FROM cand GROUP BY aid),
bij AS (
  SELECT c.eid, c.aid FROM cand c
  JOIN per_e e ON e.eid = c.eid
  JOIN per_a a ON a.aid = c.aid
  WHERE e.n = 1 AND a.n = 1
)
INSERT INTO public.exercise_answer_link (exercise_id, answer_id, subpart, match_confidence)
SELECT eid, aid, NULL, 'strict-bijectiv' FROM bij
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercise_answer_link l
  WHERE l.exercise_id = bij.eid AND l.match_confidence = 'strict-bijectiv'
);

-- un singur link strict per exercițiu (garanția de neambiguitate)
CREATE UNIQUE INDEX IF NOT EXISTS uq_answer_link_strict
  ON public.exercise_answer_link (exercise_id)
  WHERE match_confidence = 'strict-bijectiv';

-- ── 2) Task judecător ───────────────────────────────────────────────────────
INSERT INTO public.ai_model_config
  (task_name, display_name, provider, model_name, max_tokens, temperature,
   price_input_per_1m, price_output_per_1m, description, is_active)
VALUES
  ('judge_answer', 'Judecător răspuns elev (Nivel B)', 'anthropic',
   'claude-haiku-4-5-20251001', 512, 0,
   1.0, 5.0,
   'ETAPA 63: judecă încercarea elevului pe un exercițiu servit (enunț + răspuns elev + răspuns oficial dacă există). JSON {correct, confidence, motiv}. confidence < 0.8 nu mișcă mastery.',
   true)
ON CONFLICT (task_name) DO NOTHING;
