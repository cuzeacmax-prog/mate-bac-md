# Batch Generator Scripts

## ⚠️ ATENȚIE — Cost real AI

Batch generator apelează Anthropic Sonnet + Google Gemini.
**Nu rula fără supervizare utilizator.** Costul estimat:
- `batch:test` (2 exerciții) → ~$0.20-0.30
- `batch:full` (200 exerciții) → ~$15-20

## Scripturi disponibile

### `npm run batch:test`
Generează 2 exerciții (primele 2 variații din lista completă).
Folosit pentru validare pipeline înainte de rulare full.

### `npm run batch:full`
Generează 200 exerciții. Rulează ~20-30 minute.
Necesită: TIKZ_COMPILE_URL, GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

### `npm run batch:triangles`
Rulează variații specifice de triunghi (scriptul vechi, pentru backward compat).

## Pre-requisites înainte de batch:full

1. **Permisiuni DB**: Aplică GRANT-ul pentru service_role în Supabase Studio:
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON solved_exercises TO service_role;
   ```

2. **match_exercises RPC**: Aplică migrarea RAG:
   ```
   supabase/migrations/20260602100000_match_exercises_rpc.sql
   ```

3. **Testează mai întâi** cu `npm run batch:test` și verifică în Supabase Studio că apar 2 rânduri.

## Variation matrices

Fișierul `variation-matrices.ts` conține ~200 variații geometrice predefinite:
- 50 triunghiuri (SSS, ASA, SAS, AAS, cu construcții)
- 30 cercuri (coarde, tangente, secante, arce, sectoare)
- 20 paralelograme + 20 trapeze
- 20 poligoane regulate
- 6 cuburi + 9 paralelipipede
- 20 piramide
- 8 cilindre + 9 conuri + 8 sfere

Total: ~200 variații.
