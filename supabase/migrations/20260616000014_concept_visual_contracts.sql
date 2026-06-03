-- ETAPA 56: contracte vizuale CONCEPT-ancorate (Strat 2) pentru conceptele-bază/relație folosite de coloana
-- vertebrală nouă (figura = instanțierea conceptelor specifice din graf). trigger_type='concept:<slug>', concept_id FK.
INSERT INTO concept_construction_pattern (trigger_type, kind, concept, concept_id, title, derived_from, pattern, marked, human_status)
SELECT s.trig, 'concept-contract', s.slug, c.id, s.title, s.derived_from, s.pattern::jsonb, false, NULL
FROM (VALUES
  ('concept:g10-trapez','g10-trapez','Trapez (bază)',
   'concepts(g10-trapez).body — obiect-bază; nu adaugă element auxiliar singur.', '{"requires":[]}'),
  ('concept:g9-bazele-trapezului','g9-bazele-trapezului','Bazele trapezului (AB∥CD)',
   'concepts(g9-bazele-trapezului).body — relația de paralelism a bazelor.', '{"requires":[]}'),
  ('concept:g11-drepte-perpendiculare-in-spatiu','g11-drepte-perpendiculare-in-spatiu','Drepte perpendiculare (diagonale ⊥)',
   'concepts(g11-drepte-perpendiculare-in-spatiu).body — diagonale perpendiculare ⟹ semn de unghi drept la intersecție.',
   '{"requires":[{"el":"rightAngle","role":"diagonale perpendiculare"}]}'),
  ('concept:g10-centrul-cercului-circumscris','g10-centrul-cercului-circumscris','Centrul cercului circumscris (circumcentru)',
   'concepts(g10-centrul-cercului-circumscris).body — muchii laterale egale ⟹ vârf peste circumcentrul bazei (punctul O).',
   '{"requires":[{"el":"point","role":"circumcentru O"}]}'),
  ('concept:g12-paralelipiped-dreptunghic','g12-paralelipiped-dreptunghic','Paralelipiped dreptunghic (bază)',
   'concepts(g12-paralelipiped-dreptunghic).body — obiect-bază; triunghiul dreptunghic diagonală apare prin relația invocată.',
   '{"requires":[]}')
) AS s(trig, slug, title, derived_from, pattern)
JOIN concepts c ON c.slug = s.slug
ON CONFLICT (trigger_type) DO NOTHING;
