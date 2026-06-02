-- ETAPA 46: suprafața web de autorat. Remarci pe desenul GENERAT (text + pini localizați {x,y,text})
-- alimentează bucla de corecție. Status extins: pending → (coadă) → auto-acceptat/marcat-uman →
-- (remarci) needs_revision → (om) approved/rejected.

ALTER TABLE figura_autor ADD COLUMN IF NOT EXISTS remarci jsonb;  -- { text, pins:[{x,y,text}] }

-- Bucket public pentru DESENELE DORITE încărcate din web (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('figuri-dorite', 'figuri-dorite', true)
ON CONFLICT (id) DO NOTHING;
