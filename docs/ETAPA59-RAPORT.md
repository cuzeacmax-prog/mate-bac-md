# ETAPA 59 — IGIENĂ ARHITECTURALĂ CHIRURGICALĂ (2026-06-09)

## EȘECURILE ÎNTÂI — ce N-AM putut face în această sesiune

1. **Test manual live cu user free (P2, P3, P5)** — nu există o sesiune de browser autentificată în acest mediu. Dovada pentru P2/P3/P5 e la nivel de cod + build/type-check + simulare SQL, NU un flux real prin UI. De rulat la prima sesiune cu utilizator de test.
2. **Măsurătoare reală de timing înainte/după (P5, P6)** — fără un mesaj real prin `/api/chat` nu pot măsura TTFB/done. Dovada e structurală: în cod, `done` se enqueue acum ÎNAINTE de `verifyMath` (înainte: după un `Promise.race` cu timeout 3000ms). Estimările sunt marcate ca estimări.
3. **Corecție de radiografie (P1)**: 6 din cele 7 rute `generate-*` declarate moarte în S7.8 NU erau moarte — sunt apelate dinamic printr-un config-map (`admin/test-construction/page.tsx:1337-1362`, endpoint-uri în stringuri de config, nu `fetch('...')` literal). Le-am restaurat. Doar `generate-drawing` era cu adevărat mort (grep `drawing` în test-construction: no matches).

---

## Per punct

### P1 — Suprafața de atac tăiată · commit `8dcf283`
Șterse: `/api/search/library` (era publică, fără auth, service client + embedding per request), `/api/search/methods`, `/api/admin/compile-tikz`, `/api/admin/generate-drawing`, componentele `TikZRenderer`, `GeoGebraEmbed`, `ThreeRenderer`, `ThreeScene`, `CabinetSVG`, `SelectableMessage`, `public/tikzjax/` (2 fișiere), dependențele `three`, `@react-three/drei`, `@react-three/fiber`, `@types/three`, `react-confetti` (−53 pachete npm). Restaurate (corecție): generate-{analysis,complex,probability,spatial,statistics,transformation}.
**Dovadă:** grep pe toate numele șterse în `src/` + `public/` → zero referințe (singurele match-uri: `BlockSelectableMessage` — alt component, viu — și config-map-ul care a salvat cele 6 rute); `npm run build` (cu `.next` curățat) → exit 0. Total: −1614 linii.

### P2 — Ocolirea rate-limit închisă · commit `a5102af`
`/api/chat/clarify`: task per tier (`chat_free`/`chat_premium`/`chat_admin`) în loc de `chat_admin` pentru toți; `check_rate_limit` înainte de stream (429 la depășire) + `increment_rate_limit` după, cu `action_type='message'` → **un clarify = un mesaj din aceeași cotă de 30/lună**. Fail-open identic cu `/api/chat`.
**Dovadă:** cod (fișierul rescris). Test manual cu user free: NEFĂCUT (vezi Eșecuri #1).

### P3 — Adevărul CAT pe server · commit `77dd503`
- `/api/diagnostic/next`: body nou = `{sessionId}`; istoricul din `diagnostic_sessions.exercises_log`, clasa din `diagnostic_sessions.grade_level` (citite cu clientul user → RLS garantează sesiunea proprie).
- Client (`onboarding/diagnostic/page.tsx`): nu mai trimite `history`/`gradeLevel`.
- `/api/onboarding/complete`: predicția + slăbiciunile se citesc din ultima sesiune completată (`initial_bac_prediction`, `weaknesses` — calculate pe server la submit), body-ul clientului nu mai e crezut; `trial/page.tsx` nu le mai trimite.
**Dovadă:** diff-urile + build/type-check verde. Funcționare cap-coadă live: NEFĂCUTĂ (Eșecuri #1); logica submit folosea deja log-ul server (`submit/route.ts:89`).

### P4 — topic_mastery nu mai eșuează tăcut · commit `77dd503`
- Cauza reală a celor 0 rânduri: **fluxul nu a fost rulat niciodată** — `diagnostic_sessions` are 0 rânduri total (query). Nu e RLS post-ETAPA57 și nu e schema: GRANT-uri INSERT/SELECT/UPDATE prezente pentru authenticated, politica `Users manage own mastery` (ALL, `auth.uid()=user_id`) există, constrângerea `UNIQUE(user_id, topic_id)` cerută de upsert există.
- **Dovadă că calea DB e sănătoasă:** INSERT executat ca rol `authenticated` cu `request.jwt.claims.sub` = un user real → succes, fără eroare (bloc DO cu cleanup).
- Cod: upsert-ul își verifică acum eroarea → log + răspuns 500 (înainte: ignorată complet).
- Rânduri reale dintr-un onboarding de test: NEFĂCUT — necesită sesiune browser (Eșecuri #1).

### P5 — Verify scos din calea critică · commit `6bfc9a3`
`done` se enqueue imediat după ultimul token; `verifyMath` rulează DUPĂ și sosește ca eveniment SSE separat `{verification}`; `useChat` face patch pe metadata ultimului mesaj de asistent (clientul citea deja stream-ul până la capăt). Verify e sărit complet când răspunsul conține SVG-uri din calculatoare (matematica e deterministă) — minus un call Haiku pe acele mesaje. Calea cu match direct din bibliotecă nu avea verify nici înainte.
**Dovadă:** cod — înainte: `done` după `Promise.race(verifyMath, 3000ms)` (până la +3000ms); acum: 0ms adăugat între ultimul token și `done` (ordinea enqueue-urilor în `route.ts`). Măsurătoare live: NEFĂCUTĂ.

### P6 — Pre-stream paralelizat · commit `6bfc9a3`
`Promise.all` #1: profil ∥ embedding+match_exercises ∥ istoric conversație existentă. `Promise.all` #2: check_rate_limit ∥ match_solution_methods. Bonus de corectitudine: crearea conversației mutată DUPĂ rate-limit → un 429 nu mai lasă conversație goală în DB. Decompose rămâne condiționat pe markeri regex (neatins).
**Dovadă:** diff. Estimare TTFB pre-model: ~650ms secvențial → ~400ms (dominat de embedding-ul Gemini; estimare nemăsurată).

### P7 — Config modele unificat · commit `4b2fb19`
- `query-decomposer` și `math-verifier` trec prin `callAI` (router) cu task-uri noi `decompose` și `verify_math` în `ai_model_config` (haiku 4.5, temp 0, prețuri 1.0/5.0 per 1M).
- `exerciseGenerator` mutat în `scripts/library/` (consumatori: doar 3 scripturi batch; importuri actualizate).
- Task-uri fantomă șterse din `ai_model_config`: `classify_problem`, `background_tagging`, `generate_tikz_complex`, `validate_visual` (zero call-site-uri în src+scripts, grep); `embedding` păstrat cu descriere „REZERVAT/documentare".
- Migrație: `supabase/migrations/20260616000002_etapa59_ai_model_config_unificat.sql` + aplicată pe remote.
**Dovadă:** `grep 'claude-' src/lib` → **no matches**.

### P8 — Micro · commit `c0d95e9`
- `(await createClient()) as any` scos din `/api/chat` și `/api/voice/synthesize` (clarify fusese rescris fără cast în P2). Asta a expus că tipurile scrise de mână erau GREȘITE (`conversations.topic` cerut obligatoriu, în DB e nullable) → `src/types/supabase.ts` regenerat integral din DB (gen types prin MCP, 2644 linii); doar `Database` și `Json` erau importate extern → înlocuire sigură.
- `Cache-Control` scos de pe răspunsul POST voice (browserele nu cache-uiesc POST).
- `.env.example` completat: GOOGLE_GENERATIVE_AI_API_KEY, EMBEDDING_PROVIDER, TIKZ_COMPILE_URL, POSTHOG ×4, NEXT_PUBLIC_APP_URL.
**Dovadă:** build + type-check exit 0.

---

## Verificare finală (output integral)

**`npm run build`** → exit 0:
```
▲ Next.js 16.2.6 (Turbopack)
✓ Compiled successfully in 12.1s
  Running TypeScript ...
  Finished TypeScript in 6.9s ...
✓ Generating static pages using 15 workers (60/60) in 610ms
Route (app): 60 rute (vs 63 înainte — minus search/library, search/methods,
compile-tikz, generate-drawing), toate generate fără erori.
```

**`npx eslint . --quiet`** → exit 0 (zero erori).

**`npm test`** → exit 0:
```
 Test Files  3 passed (3)
      Tests  21 passed (21)
   Duration  386ms
```
