# Batch Generator — Ghid complet

## ⚠️ Cost real AI

Batch generator apelează **Anthropic Sonnet** (enunțuri + soluții) și **Google Gemini** (embeddings).
- Gemini embeddings: gratuit (free tier, 1500 RPM)
- Sonnet: ~$0.10-0.15 per exercițiu → $15-20 pentru 200 exerciții

**NU rula fără supervizare.** Folosește întotdeauna `batch:test` mai întâi.

## Scripturi disponibile

```bash
npm run batch:test          # 2 exerciții (~$0.20-0.30)
npm run batch:full          # 200 exerciții (~$15-20)
npm run test:embedding      # Testare Gemini fără Sonnet (gratuit)
npm run db:apply-rpc        # Afișează instrucțiuni SQL pentru migrare
npm run backup:export       # Export JSON bibliotecă
npm run backup:import -- backups/library-TIMESTAMP.json  # Import
```

## Fluxul per exercițiu

1. **Geometry calculator** — TypeScript pur, zero cost
2. **TikZ compile** → SVG via Railway (pre-plătit)
3. **Sonnet** → enunț + soluție (⚠️ costă)
4. **Gemini embed** → vector 1536d (gratuit)
5. **INSERT** → `solved_exercises` în Supabase

## Resume & retry

La crash, scriptul salvează progresul în `scripts/library/batch-progress.json`.
La relansare, variațiile deja procesate (identificate prin hash SHA-1 al parametrilor)
sunt sărite automat.

Fiecare pas critic are retry automat: max 3 încercări cu backoff exponențial (1s, 2s, 4s).

## Pre-requisite

1. Variabile de mediu în `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_GENERATIVE_AI_API_KEY=AIza...
   TIKZ_COMPILE_URL=https://xxx.railway.app/compile
   ```

2. GRANT pentru service_role (aplică `20260602200000_grants_for_service_role.sql`):
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON solved_exercises TO service_role;
   ```

3. Fix embedding dimension (aplică `20260602050000_fix_embedding_dimension.sql`):
   Schimbă coloana `embedding` din `vector(3072)` la `vector(1536)`.

## Matrice de variații

`scripts/library/variation-matrices.ts` conține ~200 variații:
- 50 triunghiuri (SSS, ASA, SAS, AAS, cu construcții)
- 30 cercuri (coarde, tangente, secante)
- 20 paralelograme + 20 trapeze
- 20 poligoane regulate (3-8 laturi)
- 6 cuburi + 9 paralelipipede
- 20 piramide (3/4/6 laturi bază)
- 8 cilindre + 9 conuri + 8 sfere

## Verificare post-rulare

```sql
SELECT topic, COUNT(*) as count,
       AVG(difficulty) as avg_difficulty
FROM solved_exercises
GROUP BY topic
ORDER BY count DESC;
```
