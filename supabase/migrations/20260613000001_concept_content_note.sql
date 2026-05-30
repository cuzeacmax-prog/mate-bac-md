-- ETAPA 7b: coloană `note` pentru a marca eșecurile de parsare (parse_fail) la extracția de conținut.

ALTER TABLE concept_content_proposals ADD COLUMN IF NOT EXISTS note text;
