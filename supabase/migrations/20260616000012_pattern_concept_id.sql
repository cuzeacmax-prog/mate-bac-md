-- ETAPA 51: tipare legate REAL de teoria din graf. Fiecare tipar ancorat la un CONCEPT real din `concepts`
-- (concept_id FK), iar derived_from = extras din body-ul real al conceptului (nu propoziție de mână).
-- Concept-metodă relevant figurilor dar fără teorie (body gol) → rând MARCAT (pattern NULL), nu inventat.

ALTER TABLE concept_construction_pattern
  ADD COLUMN IF NOT EXISTS concept_id uuid REFERENCES concepts(id),
  ADD COLUMN IF NOT EXISTS marked boolean DEFAULT false;

-- repornire seed: înlocuim tiparele de slug-text (ETAPA 50) cu tipare ancorate la graf
DELETE FROM concept_construction_pattern;

INSERT INTO concept_construction_pattern (concept, concept_id, title, derived_from, pattern, marked, human_status)
SELECT s.concept, c.id, s.title, s.derived_from, s.pattern::jsonb, false, NULL
FROM (VALUES
  ('g11-masura-unghiului-diedru','Măsura unghiului diedru',
   'concepts.body: «măsura unui unghi liniar; intersecția diedrului cu un plan perpendicular pe muchie» → perpendiculare pe muchie în fiecare plan.',
   '{"requires":[{"el":"dihedralMark","role":"unghi liniar"},{"el":"rightAngle","role":"perpendiculara pe muchie"},{"el":"segment","role":"perpendiculara"}]}'),
  ('g11-distanta-de-la-un-punct-la-un-plan','Distanța punct–plan',
   'concepts.body: «lungimea segmentului cu o extremitate punctul si cealalta proiectia lui pe plan» → perpendiculara + piciorul.',
   '{"requires":[{"el":"segment","role":"perpendiculara"},{"el":"point","role":"picior"},{"el":"rightAngle"}]}'),
  ('g11-unghiul-format-de-o-dreapta-si-un-plan','Unghiul dreaptă–plan',
   'concepts.body: «unghiul ascutit dintre dreapta si proiectia ei ortogonala pe plan» → proiectia + piciorul + unghiul.',
   '{"requires":[{"el":"segment","role":"proiectia"},{"el":"point","role":"picior"},{"el":"rightAngle","role":"proiectie perp"},{"el":"dihedralMark","role":"unghiul"}]}'),
  ('g11-dreapta-perpendiculara-pe-un-plan','Perpendiculara pe plan (înălțimea corpului)',
   'concepts.body: «dreapta perpendiculara pe orice dreapta din plan». Inaltimea corpului = perpendiculara din varf pe planul bazei; piciorul in baza.',
   '{"requires":[{"el":"segment","role":"height"},{"el":"point","role":"foot"},{"el":"rightAngle"}]}'),
  ('g11-proiectie-ortogonala-a-unui-punct-pe-un-plan','Proiecția ortogonală a unui punct pe plan',
   'concepts.body: «piciorul perpendicularei M1 din M pe plan; MM1 perp alpha, M1 in alpha».',
   '{"requires":[{"el":"point","role":"foot"},{"el":"segment","role":"MM1"},{"el":"rightAngle"}]}'),
  ('g11-teorema-celor-trei-perpendiculare','Teorema celor trei perpendiculare',
   'concepts.body: «daca proiectia a1 a oblicei a este perp pe b din plan, atunci si a perp b» → oblica + proiectie + doua unghiuri drepte.',
   '{"requires":[{"el":"segment","role":"oblica/proiectie"},{"el":"rightAngle"},{"el":"point","role":"picior"}]}'),
  ('g8-teorema-lui-pitagora','Triunghi dreptunghic auxiliar (Pitagora)',
   'concepts.body: «patratul ipotenuzei = suma patratelor catetelor» → triunghi dreptunghic auxiliar.',
   '{"requires":[{"el":"segment","role":"cateta/ipotenuza"},{"el":"rightAngle"}]}'),
  ('g12-triunghi-dreptunghic','Triunghi dreptunghic (relații metrice)',
   'concepts.body: «catete a,b, ipotenuza c; c^2=a^2+b^2» → triunghi dreptunghic marcat.',
   '{"requires":[{"el":"segment","role":"cateta/ipotenuza"},{"el":"rightAngle"}]}'),
  ('g10-relatii-metrice-in-triunghiul-dreptunghic','Relații metrice în triunghiul dreptunghic',
   'concepts.body: «CD inaltimea corespunzatoare ipotenuzei AB; triunghiurile ACB, CDB, ADC» → inaltimea + piciorul D + unghi drept.',
   '{"requires":[{"el":"segment","role":"inaltimea CD"},{"el":"point","role":"piciorul D"},{"el":"rightAngle"}]}'),
  ('g12-sectiunea-piramidei-cu-plan-paralel-cu-baza','Secțiunea piramidei cu plan paralel cu baza',
   'concepts.body: «plan paralel cu baza la distanta h de varf sectioneaza piramida dupa un poligon asemenea bazei».',
   '{"requires":[{"el":"sectionCurve","role":"poligon de sectiune"}]}'),
  ('g12-sectiune-a-poliedrului','Secțiune a poliedrului',
   'concepts.body: «intersectia nevida a unui poliedru cu un plan (plan secant)» → poligonul de sectiune.',
   '{"requires":[{"el":"sectionCurve","role":"poligon de sectiune"}]}'),
  ('g12-sectiuni-conice','Secțiuni conice',
   'concepts.body: «curbele obtinute sectionand suprafata conica cu un plan (cerc/elipsa/parabola/hiperbola)».',
   '{"requires":[{"el":"sectionCurve","role":"curba de sectiune"}]}'),
  ('g12-piramida-regulata','Piramidă regulată (înălțime + centru bază)',
   'concepts.body: «proiectia varfului pe planul bazei coincide cu centrul de simetrie al bazei» → centrul O + inaltimea VO perp baza.',
   '{"requires":[{"el":"point","role":"centrul bazei O"},{"el":"segment","role":"inaltimea VO"},{"el":"rightAngle","role":"VO perp baza"}]}'),
  ('g12-prisma-regulata','Prismă regulată (apotemă bază)',
   'concepts.body: «prisma dreapta cu baza poligon regulat»; apotema bazei = perpendiculara din centru pe o latura.',
   '{"requires":[{"el":"point","role":"centrul bazei"},{"el":"segment","role":"apotema"},{"el":"rightAngle","role":"pe latura"}]}')
) AS s(concept, title, derived_from, pattern)
JOIN concepts c ON c.slug = s.concept;

-- MARCAT: concept-metodă relevant figurilor, dar fără teorie în graf (body gol) → tipar ne-draftat, NU inventat.
INSERT INTO concept_construction_pattern (concept, concept_id, title, derived_from, pattern, marked, human_status)
SELECT 'g9-apotema', c.id, 'Apotemă (MARCAT)',
       'concepts(g9-apotema).body GOL — tipar ne-draftat (nu inventat); apotema acoperita indirect prin g12-prisma-regulata / g12-piramida-regulata.',
       NULL, true, 'marcat'
FROM concepts c WHERE c.slug = 'g9-apotema';
