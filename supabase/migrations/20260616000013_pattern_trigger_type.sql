-- ETAPA 52: cheia tiparului = TIPUL DE RELAȚIE/OBIECT extras de CAS (nu exercise_concept_link).
-- trigger_type devine cheia logică; ancorarea în teorie rămâne (concept_id + derived_from din body).
-- Tip relevant fără tipar → rând MARCAT (pattern NULL), nu inventat.

ALTER TABLE concept_construction_pattern
  ADD COLUMN IF NOT EXISTS trigger_type text,
  ADD COLUMN IF NOT EXISTS kind text;

ALTER TABLE concept_construction_pattern DROP CONSTRAINT IF EXISTS concept_construction_pattern_concept_key;

DELETE FROM concept_construction_pattern;

INSERT INTO concept_construction_pattern (trigger_type, kind, concept, concept_id, title, derived_from, pattern, marked, human_status)
SELECT s.trigger_type, s.kind, s.concept, c.id, s.title, s.derived_from, s.pattern::jsonb, false, NULL
FROM (VALUES
  ('obj:pyramid-regular','object','g12-piramida-regulata','Piramidă regulată (înălțime + centru bază)',
   'concepts.body: «proiectia varfului pe planul bazei coincide cu centrul de simetrie al bazei» → O + inaltime VO perp baza + apotema.',
   '{"trigger":"obj:pyramid-regular","requires":[{"el":"point","role":"centrul bazei O"},{"el":"segment","role":"inaltimea VO"},{"el":"rightAngle","role":"VO perp baza"}]}'),
  ('obj:prism-regular','object','g12-prisma-regulata','Prismă regulată (apotemă + muchie laterală)',
   'concepts.body: «prisma dreapta cu baza poligon regulat»; apotema = perpendiculara din centru pe latura.',
   '{"trigger":"obj:prism-regular","requires":[{"el":"point","role":"centrul bazei"},{"el":"segment","role":"apotema"},{"el":"rightAngle","role":"pe latura"}]}'),
  ('obj:cuboid','object','g12-triunghi-dreptunghic','Paralelipiped/cub (triunghi dreptunghic diagonala)',
   'concepts.body: «c^2=a^2+b^2» → triunghi dreptunghic diagonala-fetei / muchie (Pitagora in spatiu).',
   '{"trigger":"obj:cuboid","requires":[{"el":"segment","role":"diagonala/muchie"},{"el":"rightAngle"}]}'),
  ('rel:angle(plane,plane)','relation','g11-masura-unghiului-diedru','Diedru (unghi intre plane)',
   'concepts.body: «masura unui unghi liniar; intersectia diedrului cu un plan perpendicular pe muchie».',
   '{"trigger":"rel:angle(plane,plane)","requires":[{"el":"dihedralMark","role":"unghi liniar"},{"el":"rightAngle","role":"perpendiculara pe muchie"},{"el":"segment"}]}'),
  ('rel:angle(line,plane)','relation','g11-unghiul-format-de-o-dreapta-si-un-plan','Unghi dreapta-plan',
   'concepts.body: «unghiul ascutit dintre dreapta si proiectia ei ortogonala pe plan».',
   '{"trigger":"rel:angle(line,plane)","requires":[{"el":"segment","role":"proiectia"},{"el":"point","role":"picior"},{"el":"rightAngle"},{"el":"dihedralMark","role":"unghiul"}]}'),
  ('rel:distance(point,plane)','relation','g11-distanta-de-la-un-punct-la-un-plan','Distanta punct-plan',
   'concepts.body: «lungimea segmentului cu o extremitate punctul si cealalta proiectia lui pe plan».',
   '{"trigger":"rel:distance(point,plane)","requires":[{"el":"segment","role":"perpendiculara"},{"el":"point","role":"picior"},{"el":"rightAngle"}]}'),
  ('rel:perpendicular(line,plane)','relation','g11-dreapta-perpendiculara-pe-un-plan','Perpendiculara pe plan (inaltime)',
   'concepts.body: «dreapta perpendiculara pe orice dreapta din plan» (inaltimea din varf pe baza).',
   '{"trigger":"rel:perpendicular(line,plane)","requires":[{"el":"segment","role":"perpendiculara"},{"el":"point","role":"picior"},{"el":"rightAngle"}]}'),
  ('rel:projection(point,plane)','relation','g11-proiectie-ortogonala-a-unui-punct-pe-un-plan','Proiectia ortogonala pe plan',
   'concepts.body: «piciorul perpendicularei din punct pe plan».',
   '{"trigger":"rel:projection(point,plane)","requires":[{"el":"point","role":"picior"},{"el":"segment"},{"el":"rightAngle"}]}'),
  ('rel:three-perpendiculars','relation','g11-teorema-celor-trei-perpendiculare','Teorema celor trei perpendiculare',
   'concepts.body: «daca proiectia oblicei e perp pe o dreapta din plan, atunci si oblica e perp pe ea».',
   '{"trigger":"rel:three-perpendiculars","requires":[{"el":"segment","role":"oblica/proiectie"},{"el":"rightAngle"},{"el":"point","role":"picior"}]}'),
  ('rel:right-triangle','relation','g8-teorema-lui-pitagora','Triunghi dreptunghic auxiliar (Pitagora)',
   'concepts.body: «patratul ipotenuzei = suma patratelor catetelor».',
   '{"trigger":"rel:right-triangle","requires":[{"el":"segment","role":"cateta/ipotenuza"},{"el":"rightAngle"}]}'),
  ('rel:metric-right-triangle','relation','g10-relatii-metrice-in-triunghiul-dreptunghic','Relatii metrice in triunghiul dreptunghic',
   'concepts.body: «CD inaltimea corespunzatoare ipotenuzei; triunghiurile ACB, CDB, ADC».',
   '{"trigger":"rel:metric-right-triangle","requires":[{"el":"segment","role":"inaltimea"},{"el":"point","role":"piciorul"},{"el":"rightAngle"}]}'),
  ('rel:midpoint','relation','g10-relatii-metrice-in-triunghiul-dreptunghic','Mijloc -> mediana/inaltime (triunghi dreptunghic)',
   'concepts.body: mijlocul unei laturi -> mediana/inaltimea care formeaza triunghi dreptunghic auxiliar.',
   '{"trigger":"rel:midpoint","requires":[{"el":"point","role":"mijloc"},{"el":"segment"},{"el":"rightAngle"}]}'),
  ('rel:parallel-section(cone)','relation','g12-sectiuni-conice','Sectiune conica (plan paralel cu baza)',
   'concepts.body: «curbele obtinute sectionand suprafata conica cu un plan».',
   '{"trigger":"rel:parallel-section(cone)","requires":[{"el":"sectionCurve","role":"curba de sectiune"}]}'),
  ('rel:parallel-section(pyramid)','relation','g12-sectiunea-piramidei-cu-plan-paralel-cu-baza','Sectiune piramida cu plan paralel cu baza',
   'concepts.body: «plan paralel cu baza sectioneaza piramida dupa un poligon asemenea bazei».',
   '{"trigger":"rel:parallel-section(pyramid)","requires":[{"el":"sectionCurve","role":"poligon de sectiune"}]}'),
  ('rel:plane-section(polyhedron)','relation','g12-sectiune-a-poliedrului','Sectiune a poliedrului',
   'concepts.body: «intersectia nevida a unui poliedru cu un plan secant».',
   '{"trigger":"rel:plane-section(polyhedron)","requires":[{"el":"sectionCurve","role":"poligon de sectiune"}]}')
) AS s(trigger_type, kind, concept, title, derived_from, pattern)
JOIN concepts c ON c.slug = s.concept;

-- MARCATE: tipuri relevante figurilor, fara tipar draftat → NU inventate.
INSERT INTO concept_construction_pattern (trigger_type, kind, concept, concept_id, title, derived_from, pattern, marked, human_status)
SELECT 'obj:frustum', 'object', 'g12-trunchi-de-piramida-regulata', c.id, 'Trunchi de piramida (MARCAT)',
       'constructia trunchiului (apotema trapez + inaltime + sectiune diagonala) inca ne-draftata; ancorat la concept real.',
       NULL, true, 'marcat'
FROM concepts c WHERE c.slug = 'g12-trunchi-de-piramida-regulata';

INSERT INTO concept_construction_pattern (trigger_type, kind, concept, concept_id, title, derived_from, pattern, marked, human_status)
SELECT 'rel:inscribed-sphere(cone)', 'relation', 'g12-conul-circular-drept', c.id, 'Sfera inscrisa in con (MARCAT)',
       'sectiune axiala cu cerc inscris; tipar dedicat ne-draftat.',
       NULL, true, 'marcat'
FROM concepts c WHERE c.slug = 'g12-conul-circular-drept';

CREATE UNIQUE INDEX IF NOT EXISTS concept_construction_pattern_trigger_key ON concept_construction_pattern (trigger_type);
