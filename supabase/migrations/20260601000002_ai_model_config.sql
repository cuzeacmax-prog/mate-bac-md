CREATE TABLE IF NOT EXISTS ai_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'google', 'openai')),
  model_name TEXT NOT NULL,

  max_tokens INTEGER DEFAULT 4096,
  temperature NUMERIC DEFAULT 0.7,

  system_prompt_key TEXT,

  price_input_per_1m NUMERIC NOT NULL DEFAULT 0,
  price_output_per_1m NUMERIC NOT NULL DEFAULT 0,

  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  fallback_task_name TEXT REFERENCES ai_model_config(task_name) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_model_config_task ON ai_model_config(task_name) WHERE is_active = true;

ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_model_config"
  ON ai_model_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
    )
  );

CREATE TRIGGER set_ai_model_config_updated_at
  BEFORE UPDATE ON ai_model_config
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO ai_model_config (task_name, display_name, provider, model_name, max_tokens, temperature, price_input_per_1m, price_output_per_1m, description) VALUES
  ('classify_problem',    'Clasificare enunt',           'google',    'gemini-2.5-flash-lite',      1024,  0.3, 0.25,  1.50,  'Analiza enuntului elevului si extrage parametri JSON'),
  ('chat_free',           'Chat utilizator free',        'anthropic', 'claude-haiku-4-5-20251001',  4096,  0.7, 1.00,  5.00,  'Raspuns chat pentru utilizatori gratuiti'),
  ('chat_premium',        'Chat utilizator premium',     'anthropic', 'claude-sonnet-4-6',          8192,  0.7, 3.00,  15.00, 'Raspuns chat pentru utilizatori premium'),
  ('chat_admin',          'Chat administrator',          'anthropic', 'claude-sonnet-4-6',          8192,  0.7, 3.00,  15.00, 'Raspuns chat pentru admin (Maxim)'),
  ('generate_tikz_complex','Generare TikZ complex',     'anthropic', 'claude-opus-4-7',            16384, 0.5, 15.00, 75.00, 'Generare cod TikZ pentru cazuri rare (Faza 3+)'),
  ('validate_visual',     'Validare vizuala SVG',        'google',    'gemini-2.5-pro',             2048,  0.3, 1.25,  10.00, 'Verifica calitatea SVG prin vision'),
  ('embedding',           'Embedding text',              'google',    'gemini-embedding-001',       0,     0,   0,     0,     'Generare embedding pentru RAG'),
  ('background_tagging',  'Tagging dificultate',         'google',    'gemini-2.5-flash-lite',      512,   0.3, 0.25,  1.50,  'Tagging automat dificultate exercitii');
