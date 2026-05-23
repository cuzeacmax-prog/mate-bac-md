# Troubleshooting

## DB: "permission denied for table solved_exercises"

**Cauza:** service_role nu are GRANT pe tabelul solved_exercises.

**Fix:** Aplică în Supabase Studio SQL Editor:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON solved_exercises TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON tikz_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON gap_analysis TO service_role;
```
Sau rulează migrarea: `supabase/migrations/20260602200000_grants_for_service_role.sql`

---

## DB: "column tikz_code does not exist"

**Cauza:** Coloana se numește `tikz_source` în schema actuală, nu `tikz_code`.

**Schema corectă:** `tikz_source`, `svg_static` (nu `tikz_code`, nu `svg_preview`).

---

## Embedding: "dimension mismatch"

**Cauza:** Schema DB are `vector(3072)` dar codul generează 1536d (sau invers).

**Fix:**
1. Aplică `supabase/migrations/20260602050000_fix_embedding_dimension.sql` în Supabase Studio
2. Verifică că `EMBEDDING_DIMENSIONS = 1536` în `src/lib/embeddings/gemini.ts`
3. Verifică cu `npm run test:embedding`

---

## match_exercises: "function does not exist" (cod 42883)

**Cauza:** Migrarea RPC nu a fost aplicată.

**Fix:** Rulează `npm run db:apply-rpc` și urmează instrucțiunile afișate.
Aplică SQL-ul din `supabase/migrations/20260602100000_match_exercises_rpc.sql` în Supabase Studio.

---

## TikZ compile: timeout sau 503

**Cauza:** Railway service oprit (free tier sleep) sau indisponibil.

**Fix:**
1. Verifică `/admin/health` → status Railway
2. Deschide Railway dashboard și verifică deployment-ul
3. Trimite un request de test: `curl https://xxx.railway.app/health`

---

## Gemini: "API key not valid"

**Cauza:** `GOOGLE_GENERATIVE_AI_API_KEY` incorectă sau lipsă.

**Fix:**
1. Verifică că `.env.local` conține `GOOGLE_GENERATIVE_AI_API_KEY=AIza...`
2. Testează: `npm run test:embedding`

---

## Sonnet: "429 Too Many Requests" în batch

**Cauza:** Rate limit Anthropic API.

**Fix:** Batch-ul are retry automat (3 încercări, backoff exponențial).
Dacă persistă, crește `RATE_LIMIT_MS` în `batch-generate-all.ts` de la 800ms la 2000ms.

---

## supabase db push eșuat

**Cauza:** Docker nu rulează (necesar pentru `supabase db push` local).

**Alternativă:** Aplică migrările manual în Supabase Studio SQL Editor.
Rulează `npm run db:apply-rpc` pentru instrucțiuni complete.
