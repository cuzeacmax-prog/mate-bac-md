-- ETAPA 45: bucla de AUTORAT supervizat. Adevăr-de-referință (condiție + desen dorit) → motorul generează
-- + porți → se persistă pentru review uman (compari DORIT vs GENERAT alături, aprobi/respingi).

CREATE TABLE IF NOT EXISTS figura_autor (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        UNIQUE,        -- identificator stabil al cazului din setul de bootstrap
  condition         text        NOT NULL,      -- enunțul (condiția)
  desired_kind      text,                      -- 'image' | 'description'
  desired_ref       text,                      -- descriere text SAU data-URL/base64 al scanului dorit
  input_kind        text,                      -- coneCut | geo | geo3d | spec2d | scene
  spec_generat      jsonb,                     -- FigureSpec2D/3D generat de motor
  gates             jsonb,                     -- rezultatele porților numerice + vizuale + potrivirea cu doritul
  render_png        text,                      -- PNG-ul randat (data-URL base64) pentru afișare
  status            text,                      -- 'auto-acceptat' | 'marcat-uman'
  verdict_uman      text,                      -- 'aprobat' | 'respins' | NULL (nerevizuit)
  iteratii          int         DEFAULT 1,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_figura_autor_status ON figura_autor (status);
CREATE INDEX IF NOT EXISTS idx_figura_autor_verdict ON figura_autor (verdict_uman);

GRANT ALL ON TABLE figura_autor TO service_role;
GRANT ALL ON TABLE figura_autor TO authenticated;

ALTER TABLE figura_autor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON figura_autor
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read" ON figura_autor
  FOR SELECT TO authenticated USING (true);
