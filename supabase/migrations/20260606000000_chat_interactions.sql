-- Tabel pentru sub-întrebări granulare per etapă de rezolvare
-- ETAPA 8 — Profesor Digital (inline interactive tutoring)

CREATE TABLE IF NOT EXISTS chat_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referință la mesajul/conversația originale
  parent_message_id UUID,
  conversation_id   UUID,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Segmentul selectat de elev
  selected_text     TEXT NOT NULL,
  selected_step_id  TEXT,           -- "step_1", "step_2" etc. dacă structurat

  -- Întrebare + răspuns
  user_question     TEXT NOT NULL,
  ai_response       TEXT,

  -- Metadata
  mode              VARCHAR(10) DEFAULT 'study',   -- 'study' | 'solve'
  is_minimized      BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pentru updated_at
CREATE OR REPLACE FUNCTION update_chat_interactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_interactions_updated_at
  BEFORE UPDATE ON chat_interactions
  FOR EACH ROW EXECUTE FUNCTION update_chat_interactions_updated_at();

-- Indecși
CREATE INDEX IF NOT EXISTS idx_chat_interactions_parent ON chat_interactions(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_user   ON chat_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_conv   ON chat_interactions(conversation_id);

-- RLS
ALTER TABLE chat_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_interactions" ON chat_interactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_interactions TO service_role;
GRANT SELECT, INSERT, UPDATE         ON chat_interactions TO authenticated;
