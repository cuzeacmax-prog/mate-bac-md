# RADIOGRAFIE ARHITECTURALĂ — mate-bac-md (ETAPA 58, 2026-06-09)

Document read-only pentru evaluare de către un arhitect extern. Fiecare afirmație are referință `fișier:linie` sau comandă+output. Marcaje: **NEGĂSIT** / **INCERT** unde nu există dovadă directă. Stack: Next.js 16.2.6 (Turbopack), React 19.2.4, Supabase, Vercel AI SDK v6 (`package.json:61-103`).

---

## S1. HARTA RUTELOR (`src/app`)

### Middleware
- `src/proxy.ts:7-25` — singura protecție globală: redirect la `/auth/login` pentru `/app/*` fără sesiune; redirect la `/app` pentru `/auth/*` cu sesiune. **`/admin` și `/onboarding` NU sunt protejate de middleware** — `/admin` e protejat de layout (server, `admin/layout.tsx:10-23`: user + `profiles.subscription_status === 'admin'`), `/onboarding` e public (paginile sunt client-only, datele se țin în zustand; API-urile cer auth).

### Pagini elev (publice sau protejate de proxy)
| Rută | Tip | Auth | Tabele atinse |
|---|---|---|---|
| `/` (landing) | server | publică | NEGĂSIT acces DB direct (necitit integral — **INCERT**) |
| `/auth/login,signup,forgot-password,reset-password` | client | publice | auth Supabase (browser client) |
| `/auth/callback` | route handler | publică | sesiune |
| `/onboarding/welcome,goal,grade,plan,trial,auth,diagnostic-intro,diagnostic,reveal,first-lesson` | toate client (`'use client'`, 11 fișiere) | publice ca pagini; API-urile din spate cer auth | doar prin API; state în zustand persist |
| `/app` | server | proxy | redirect `/app/chat` (`app/page.tsx:4`) |
| `/app/layout` | server | proxy | `profiles`, `rate_limits` (`app/layout.tsx:22,45`) |
| `/app/chat`, `/app/chat/[id]` | server shell + componente client | proxy | `conversations`, `messages` (`chat/[id]/page.tsx:22,30`; `ChatSidebarPanel.tsx:21`) |

### API elev
| Rută | Auth | Tabele/RPC |
|---|---|---|
| `POST /api/chat` | da (`route.ts:69-75`) | `profiles`, `conversations`, `messages`, `gap_analysis`(service), `api_usage_log`(service); RPC `check_rate_limit`, `increment_rate_limit`, `match_exercises`(service), `match_solution_methods` (via `lib/rag/solution-methods.ts:77`) |
| `POST /api/chat/clarify` | da (`clarify/route.ts:12-16`) | niciun tabel; doar LLM |
| `POST /api/diagnostic/start` | da | `diagnostic_sessions` |
| `POST /api/diagnostic/next` | da | `diagnostic_exercises` (service, `next/route.ts:131-136`) |
| `POST /api/diagnostic/submit` | da | `diagnostic_exercises`(service), `diagnostic_sessions`, `exercise_attempts` (`submit/route.ts:59,104,119`) |
| `POST /api/onboarding/complete` | da | `user_profiles`, `topic_mastery` (`complete/route.ts:12,72`) |
| `POST /api/voice/synthesize` | da (`synthesize/route.ts:26-29`) | niciun tabel; OpenAI TTS |
| `POST /api/search/library` | **FĂRĂ AUTH** (`search/library/route.ts:5-27` — niciun `getUser`) | embedding Gemini + RPC `match_exercises` cu **service client** |
| `GET /api/search/methods` | da (`methods/route.ts:16-17`) | RPC `match_solution_methods` (service) |

### Pagini + API admin (toate sub gardă `subscription_status==='admin'` — layout pentru pagini, check per-rută pentru API, ex. `api/admin/figura-autor/route.ts:15-18`)
27 pagini: conversations(+[id]), feedback, metrics, test-construction, library/review, library/preview, health, methodologies(+new+[id]), graf, continut, figuri, figuri-3d, figuri-revizie, figura-live, figura-autor, verificare — toate legate în nav (`admin/layout.tsx:29-76`).
Tabele per pagină: `admin_feedback` (feedback:34, FeedbackButtons:28), `api_usage_log`+`conversations` (metrics:38-54), `concepts`+`concept_edge_proposals` (graf:42,62,73), `concept_content_proposals` (continut:25), `exercise_figure_spec` (figuri-revizie:13), `exercise_verification` (verificare:16), `figura_autor` (figura-autor:12), `solved_exercises`+`tikz_templates`+`gap_analysis` (health:15-42).

### Rute MOARTE (zero apelanți în `src/` — dovadă: grep `fetch('/api/...` listă completă mai sus)
- `POST /api/search/library` — niciun caller intern **și fără auth** (dublu defect)
- `GET /api/search/methods` — niciun caller intern
- `POST /api/admin/compile-tikz` — niciun caller
- `api/admin/generate-{analysis,complex,drawing,probability,spatial,statistics,transformation}` — 7 din 16 generatoare fără niciun caller (apelate doar: advanced, circle, quadrilateral, polygon, solid, frustum, section, function, trig — toate din `admin/test-construction/page.tsx:226-1285`)
- Componente moarte: `TikZRenderer`, `GeoGebraEmbed`, `ThreeRenderer`+`ThreeScene`+`CabinetSVG` — comentate în `MessageRenderer.tsx:10-21,67-69` („Viz renderers disabled — will serve from library (Phase 3)"); `SelectableMessage.tsx` — niciun import extern (înlocuit de `BlockSelectableMessage`, `MessageBubble.tsx:6`)
- `public/tikzjax/` — bundle vendored folosit doar de `TikZRenderer` (mort)

---

## S2. FLUXURILE UTILIZATORULUI

### a) Onboarding → diagnostic CAT
Lanț: `welcome → goal → grade → plan → trial → auth → diagnostic-intro → diagnostic → reveal → first-lesson` (pagini client; pre-auth datele stau în `useOnboardingStore` persistat în localStorage `matebacmd-onboarding`, `onboarding-store.ts:59`).

Hop-uri diagnostic (`onboarding/diagnostic/page.tsx`):
1. `POST /api/diagnostic/start` → insert `diagnostic_sessions` (server, user client).
2. `POST /api/diagnostic/next` cu `{sessionId, history, gradeLevel}` — **istoricul vine din clientul zustand** (`page.tsx:81-85`), nu din sesiunea server. Serverul alege dificultatea cu `nextDifficulty(history)` (`lib/diagnostic/adaptive.ts:24-33` — funcție pură: +1 la corect, −1 la greșit) și ia un exercițiu aleator din `diagnostic_exercises` la `grade_level`+`difficulty` (`next/route.ts:131-144`), cu fallback 24 exerciții hardcodate (`next/route.ts:7-113`). `correct_letter` nu pleacă la client (`next/route.ts:152`).
3. `POST /api/diagnostic/submit` — corectarea pe server (`submit/route.ts:70`), update `diagnostic_sessions.exercises_log` + insert `exercise_attempts`; oprire `shouldStop` (5–8 întrebări, stabilizare dificultate, `adaptive.ts:41-49`); predicția BAC = medie ponderată pură (`adaptive.ts:55-81`).
4. Final: client → `/onboarding/reveal`; scrierea profilului la `POST /api/onboarding/complete` din pagina **trial** (`trial/page.tsx:27`) → `user_profiles` + upsert `topic_mastery` (7-8 topice per clasă, `complete/route.ts:30-74`).

**Apeluri LLM: 0.** Adaptivitatea e decisă pe server, prin funcție pură, fără LLM. Latență per întrebare: 1 round-trip (~100-300ms estimat). **INCERT:** `topic_mastery` are 0 rânduri în DB deși există 5 `user_profiles` — fie nimeni n-a terminat fluxul, fie upsert-ul eșuează silențios (eroarea nu e verificată, `complete/route.ts:72-74`).

### b) Chat tutore Study/Solve
Orchestratorul este monolitic în `src/app/api/chat/route.ts` (~530 linii). Lanț secvențial per mesaj:

1. Client: `ChatInput` → `useChat.sendMessage` → `POST /api/chat` cu `{message, conversationId, mode}` (`lib/hooks/useChat.ts:42-46`); mode din `useChatModeStore` (localStorage).
2. Server: auth → `profiles` tier → rate limit RPC pentru free (`route.ts:114-134`, limită 30/lună).
3. **RAG bibliotecă**: embedding Gemini al mesajului + RPC `match_exercises` top-1 (`route.ts:44-59,137`). Praguri: ≥0.85 răspuns direct din bibliotecă fără LLM; ≥0.65 injectat ca context (`route.ts:20-21,138-139`).
4. **Metode BAC**: `findRelevantMethods` (RPC `match_solution_methods`, top-2, prag 0.45) → instrucțiuni injectate în system prompt (`route.ts:142-144,194-197`).
5. Insert conversație+mesaj user, istoric ultimele 20 mesaje (`route.ts:146-188`).
6. **Decompose**: regex fast-path; doar dacă există markeri „2)…" → call Haiku (`query-decomposer.ts:59-94`, model hardcodat `claude-haiku-4-5`).
7. **Tools**: subset din 9 calculatoare AI-SDK (`calculator-registry.ts:70-232`: con, cilindru, sferă, piramidă, prismă, f. pătratică, f. liniară, integrală, monotonie) ales după `required_tools` al metodei (`tool-resolver.ts`); execuția tool-ului rulează matematica local și compilează TikZ→SVG prin serviciul Railway (`calculator-registry.ts:48-60`, `lib/tikz/compile.ts:35`).
8. **Stream principal**: SSE; model din DB `ai_model_config` per tier — `chat_free`=claude-haiku-4-5 (4096 tok), `chat_premium`=claude-sonnet-4-6 (8192), `chat_admin`=haiku (8192) (query DB, vezi S4); tool-loop max 3 pași (`route.ts:363-365`). Multi-exercițiu: buclă **secvențială** per sub-exercițiu, cu embedding Gemini + metode per bucată (`route.ts:287-339`).
9. **Verificare Haiku** (doar mode=study, după stream, `Promise.race` cu timeout 3s): `verifyMath` model hardcodat haiku (`math-verifier.ts:59-69`); rezultatul intră în `metadata.verification` din evenimentul `done` (`route.ts:405-435`).
10. Post-stream (service client): insert mesaj asistent, `gap_analysis` dacă nu există match, `api_usage_log` cu cost (`route.ts:462-500`).
11. Client: KaTeX randat în browser cu `rehype-katex` (`MessageRenderer.tsx:6,125`); SVG-urile din tools afișate cu `dangerouslySetInnerHTML` (`MessageBubble.tsx:66-72`); butonul Voice per mesaj (`MessageBubble.tsx:84`); mini-chat pe blocuri selectate → `POST /api/chat/clarify` (1 stream LLM separat, task `chat_admin`, `clarify/route.ts:49-53`).

**LLM per mesaj (single, study):** 1 embedding Gemini + 0–1 Haiku decompose + 1 stream principal + 0–1 Haiku verify = 2–4 apeluri. Lanț integral **secvențial**; estimare latență până la primul token: embedding (~0,2–0,4s) + 2 RPC + 3 insert/select DB + decompose (0s regex / ~1s Haiku) ≈ **0,5–2s înainte de TTFB-ul modelului**; verify adaugă până la 3s între ultimul token și evenimentul `done` (estimări, nemăsurate).

### c) Voice mode
- Pipeline-ul „7 pași" este integral **server-side, regex pur, 0 LLM**: `lib/voice/latex-to-speech.ts:5-12` (removeExplanatoryParens → stripKatexDelimiters → applyMathRules → expandFunctionNotation → stripDecorations → expandShortNotations → normalizeRhythm).
- Un singur round-trip per enunț: click în `VoicePlayer.tsx:17-49` → `POST /api/voice/synthesize` (auth → dedup → latexToSpeech → OpenAI `tts-1`, voce `nova`, speed 0.95, `synthesize/route.ts:67-80`) → mp3 ca `ArrayBuffer` → client `Audio.play()`. Re-play în aceeași sesiune refolosește blob-ul local (`VoicePlayer.tsx:56-58`).
- Header `Cache-Control: public, max-age=3600` pe răspuns **POST** (`synthesize/route.ts:93`) — browserele nu cache-uiesc POST; practic fiecare client/sesiune replătește TTS-ul.

### d) Figuri
- **În produs (elev)**: singura sursă de figuri e tool-call-ul din chat — calculator → TikZ → Railway → SVG → `metadata.svgs` în SSE `done` (`route.ts:380-388,433`) → `dangerouslySetInnerHTML` (`MessageBubble.tsx:72`). Niciun PNG base64 nu ajunge la elev.
- `figura_autor` (cu `render_png` base64 + `spec_generat`) și `exercise_figure_spec` sunt **exclusiv admin**: `admin/figura-autor/page.tsx:12` + API admin; pipeline-ul de procesare e în `scripts/figures/*` (în afara aplicației). Limbajele viz din mesaje (tikz/geogebra/three) sunt dezactivate cu placeholder „disponibilă curând" (`MessageRenderer.tsx:64-74`).

---

## S3. STRATUL DE DATE

### Instanțieri client Supabase
| Funcție | Cheie | Mediu | Fișier |
|---|---|---|---|
| `createClient` (browser) | anon | client | `lib/supabase/client.ts:4-9` |
| `createClient` (server) | anon + cookies (sesiune user, sub RLS) | server | `lib/supabase/server.ts:5-28` |
| `updateSession` | anon | middleware | `lib/supabase/middleware.ts:9-10` |
| `createServiceClient` | **service_role** | server-only | `lib/supabase/service.ts:3-14` |

`createServiceClient` are 28 call-site-uri (grep complet în secțiunea de mai sus), toate în: API routes, server components admin (fără `'use client'`), `lib/ai/router.ts:13`, `lib/rag/solution-methods.ts:76`. **Niciun fișier client-side nu importă service.ts — verificat: toate fișierele cu `'use client'` din listă nu apar printre call-site-uri. Zero service_role expus în client.** Cheia trăiește doar în `SUPABASE_SERVICE_ROLE_KEY` (env).

### Cine scrie în DB și cu ce drept
| Scriere | Drept |
|---|---|
| `conversations`, `messages`(user), `diagnostic_sessions`, `exercise_attempts`, `user_profiles`, `topic_mastery` | client server-side cu sesiune user (RLS) — `api/chat/route.ts:149-184`, `api/diagnostic/submit/route.ts:104-127`, `api/onboarding/complete/route.ts:12-74` |
| `messages`(assistant), `gap_analysis`, `api_usage_log` | service_role (`api/chat/route.ts:456-500`) |
| `figura_autor`, `exercise_figure_spec`, `solution_methods`, `solved_exercises`, `exercise_verification`(human_status) | service_role în API admin (după check admin) |
| Tot pipeline-ul graf/exerciții | service_role din `scripts/` (în afara aplicației) |

### Clasificarea celor 51 de tabele `public`
- **PRODUS (13)**: `profiles`, `user_profiles`, `conversations`, `messages`, `rate_limits`, `api_usage_log`, `gap_analysis`, `diagnostic_sessions`, `diagnostic_exercises`, `exercise_attempts`, `topic_mastery`, `solved_exercises` (via RPC `match_exercises`), `solution_methods` (via RAG).
- **ADMIN/AUTORIAT (9)**: `admin_feedback`, `ai_model_config` (citit de router la fiecare task, cache 60s — `lib/ai/router.ts:7-27`), `concepts`, `concept_edge_proposals`, `concept_content_proposals`, `tikz_templates`, `figura_autor`, `exercise_figure_spec`, `exercise_verification`.
- **PIPELINE/REZIDUU (29)** — doar scripturi sau nimic în `src/`: `concept_inventory_raw`, `concept_dedup_proposals`, `katex_error_report`, `exercise_raw`, `exercise_answers`, `exercise_answer_link`, `exercise_concept_link`, `concept_edges`, `concept_construction_pattern`, plus tabele-schelet fără niciun cititor în produs: `exercises`(0 rânduri), `exercise_concepts`(0), `documents`(0), `progress`, `bac_simulations`, `user_devices`, `chat_interactions`, `streak_log`, `daily_challenges`, `mock_bac_attempts`, `subscriptions`, `payment_attempts`, `referrals`, `notifications_log`, `push_subscriptions`, `analytics_events`, `email_list`, `user_enrollments`, `courses`+`course_modules`. (Apartenența la „nimic în src" = absența din grep-urile `from("...")` de mai sus; rândurile din `list_tables`.)

---

## S4. APELURILE LLM (inventar complet în `src/`)

| # | Call-site | Model | Streaming | System prompt | max_tokens | Plătit de |
|---|---|---|---|---|---|---|
| 1 | `lib/ai/router.ts:49,66,94` (`callAIStream/callAI/WithTools`) | din DB `ai_model_config` per task: chat_free=claude-haiku-4-5, chat_premium=claude-sonnet-4-6, chat_admin=haiku-4-5 | da (stream) / nu (callAI) | apelantul | din DB (4096/8192) | request elev |
| 2 | `lib/chat/query-decomposer.ts:89-94` | `claude-haiku-4-5` **hardcodat** | nu | hardcodat în fișier (`:66-86`) | 1024 | request elev (doar la markeri multi) |
| 3 | `lib/chat/math-verifier.ts:59-69` | `claude-haiku-4-5` **hardcodat** | nu | hardcodat (`:17-45`) | 512 | request elev (study, post-stream) |
| 4 | `lib/embeddings/gemini.ts:8` | `gemini-embedding-001` | n/a | n/a | n/a | request elev (1×/mesaj chat; +1×/sub-exercițiu la multi) |
| 5 | `lib/embeddings/openai.ts:21` | `text-embedding-3-small` | n/a | n/a | n/a | doar dacă `EMBEDDING_PROVIDER=openai` (`embeddings/index.ts:14`) — **INCERT dacă e folosit în producție** |
| 6 | `api/voice/synthesize/route.ts:74` | OpenAI `tts-1` | nu (buffer) | n/a | 4096 chars | request elev |
| 7 | `api/admin/figura-live/route.ts:224-252` | `claude-sonnet-4-6` hardcodat (`:36`) | nu | hardcodat (`SYSTEM_PROMPT`) | 3000 | admin |
| 8 | `lib/library/exerciseGenerator.ts:49-50` | `claude-sonnet-4-6` hardcodat | nu | în fișier | NEGĂSIT în liniile citite | build-time (scripturi batch) |

System prompts principale (study/solve/clarify/block) trăiesc **hardcodate** în `lib/ai/system-prompt.ts` (385 linii, măsurat cu `Measure-Object -Line`). Config DB `ai_model_config` conține și task-uri `classify_problem`, `background_tagging`, `generate_tikz_complex`, `validate_visual` — **fără call-site în `src/`** (reziduu sau scripturi).

### Apeluri per interacțiune-tip
| Interacțiune | Embedding | LLM | TTS | Total round-trip-uri AI |
|---|---|---|---|---|
| Mesaj chat single (study) | 1 Gemini | 1 stream + 0–1 decompose + 0–1 verify | 0 | 2–4 |
| Mesaj chat multi (N≤5 ex.) | 1+N Gemini | N stream + 1 decompose (verify doar pe ramura single — `route.ts:407`) | 0 | 2N+2 |
| Mesaj cu match direct ≥0.85 | 1 Gemini | 0 | 0 | 1 |
| Clarify (mini-chat) | 0 | 1 stream | 0 | 1 |
| Întrebare diagnostic | 0 | 0 | 0 | 0 |
| Enunț voice | 0 | 0 | 1 | 1 |

---

## S5. STATE & CLIENT

### Zustand (3 store-uri, toate în `src/lib/stores/`)
| Store | Conținut | Persistență | Cititori |
|---|---|---|---|
| `onboarding-store.ts` | scor țintă, clasă, sessionId diagnostic, istoric încercări, predicție, slăbiciuni | localStorage `matebacmd-onboarding` (`:59`) | toate paginile `/onboarding/*` |
| `chat-mode-store.ts` | mode study/solve | localStorage `mate-bac-md-chat-mode` (`:21`) | `ModeToggle`, `ChatView` |
| `interactions-store.ts` | mini-chat-urile per mesaj (selectedText, întrebare, răspuns stream) | doar memorie | `BlockSelectableMessage`, `InlineMiniChat` |

Alte stocări client: `sessionStorage` pentru înălțimi TikZ (`TikZRenderer.tsx:83-91` — component mort); URL: id-ul conversației (`/app/chat/[id]`).

### Granița server/client
- 35 fișiere `'use client'` în `src/app` (grep): tot onboarding-ul, tot UI-ul de chat, panourile admin interactive; shell-urile de pagină admin + layout-urile + `/app/chat/[id]` sunt server components.
- Hidratare grea: `katex/dist/katex.min.css` importat **global** în `app/layout.tsx:4` (plătit de toate paginile, inclusiv landing); `framer-motion` în tot onboarding-ul + chat (`MessageBubble`, `VoicePlayer`, `InlineMiniChat`); `react-markdown`+`remark-math`+`rehype-katex` per mesaj de chat; `@xyflow/react`+`dagre` doar în admin/graf (client).
- Dependențe shipped dar nefolosite de produs: `jsxgraph` (dynamic import doar în `FigureRenderer.tsx:424` — admin), `three`+`@react-three/*` (doar `ThreeScene` — mort), `react-confetti` (**zero importuri în `src/` — grep gol**).

### Tabel route sizes din `npm run build`
Build-ul (Turbopack, exit 0) **nu tipărește coloane de mărimi** — output integral al tabelului de rute (63 rute):

```
Route (app)
┌ ƒ /                              ├ ƒ /api/admin/generate-solid
├ ○ /_not-found                    ├ ƒ /api/admin/generate-spatial
├ ƒ /admin                         ├ ƒ /api/admin/generate-statistics
├ ƒ /admin/continut                ├ ƒ /api/admin/generate-transformation
├ ƒ /admin/conversations           ├ ƒ /api/admin/generate-trig
├ ƒ /admin/conversations/[id]      ├ ƒ /api/admin/library/list
├ ƒ /admin/feedback                ├ ƒ /api/admin/methodologies
├ ƒ /admin/figura-autor            ├ ƒ /api/admin/methodologies/[id]
├ ƒ /admin/figura-live             ├ ƒ /api/admin/verificare
├ ƒ /admin/figuri                  ├ ƒ /api/chat
├ ƒ /admin/figuri-3d               ├ ƒ /api/chat/clarify
├ ƒ /admin/figuri-revizie          ├ ƒ /api/diagnostic/next
├ ƒ /admin/graf                    ├ ƒ /api/diagnostic/start
├ ƒ /admin/health                  ├ ƒ /api/diagnostic/submit
├ ƒ /admin/library/preview         ├ ƒ /api/onboarding/complete
├ ƒ /admin/library/review          ├ ƒ /api/search/library
├ ƒ /admin/methodologies           ├ ƒ /api/search/methods
├ ƒ /admin/methodologies/[id]      ├ ƒ /api/voice/synthesize
├ ƒ /admin/methodologies/new       ├ ƒ /app
├ ƒ /admin/metrics                 ├ ƒ /app/chat
├ ƒ /admin/test-construction       ├ ƒ /app/chat/[id]
├ ƒ /admin/verificare              ├ ƒ /auth/callback
├ ƒ /api/admin/compile-tikz        ├ ○ /auth/forgot-password
├ ƒ /api/admin/figura-autor        ├ ○ /auth/login
├ ƒ /api/admin/figura-autor/create ├ ○ /auth/reset-password
├ ƒ /api/admin/figura-live         ├ ○ /auth/signup
├ ƒ /api/admin/figuri-revizie      ├ ○ /onboarding/auth
├ ƒ /api/admin/generate-advanced   ├ ○ /onboarding/diagnostic
├ ƒ /api/admin/generate-analysis   ├ ○ /onboarding/diagnostic-intro
├ ƒ /api/admin/generate-circle     ├ ○ /onboarding/first-lesson
├ ƒ /api/admin/generate-complex    ├ ○ /onboarding/goal
├ ƒ /api/admin/generate-drawing    ├ ○ /onboarding/grade
├ ƒ /api/admin/generate-frustum    ├ ○ /onboarding/plan
├ ƒ /api/admin/generate-function   ├ ○ /onboarding/reveal
├ ƒ /api/admin/generate-polygon    ├ ○ /onboarding/trial
├ ƒ /api/admin/generate-probability├ ○ /onboarding/welcome
├ ƒ /api/admin/generate-quadrilateral
ƒ Proxy (Middleware) · ○ Static · ƒ Dynamic
```
Mărimi per rută: **NEGĂSIT în output-ul Turbopack** (Next 16.2.6 nu le afișează la acest build).

---

## S6. CONFIG & DEPLOY

### Env vars folosite în `src/` (nume + loc; grep `process.env` complet)
| Var | Folosită în |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase client/server/middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/service.ts:5` |
| `ANTHROPIC_API_KEY` | query-decomposer:19, math-verifier:51, figura-live:249 (+ SDK `ai` implicit) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | embeddings/gemini:3, chat route:45,293, search/methods:28, rag:115, health:63 |
| `OPENAI_API_KEY` | voice:58, embeddings/openai:16 |
| `EMBEDDING_PROVIDER` | embeddings/index:14 (default **INCERT** — necitit) |
| `TIKZ_COMPILE_URL` | tikz/compile:1, calculator-registry:49, health:51 — **serviciul Railway** |
| `POSTHOG_KEY/HOST`, `NEXT_PUBLIC_POSTHOG_KEY/HOST` | analytics server/client |
| `NEXT_PUBLIC_APP_URL` | utils/referral:13 |

`.env.example` listează doar Supabase+Anthropic+OpenAI — **lipsesc** GOOGLE_GENERATIVE_AI_API_KEY, TIKZ_COMPILE_URL, POSTHOG, EMBEDDING_PROVIDER, NEXT_PUBLIC_APP_URL (citit integral mai sus).

### Deploy
- App Next pe **Vercel** (dovadă indirectă: mesaj de eroare „Adaugă în .env.local și Vercel", `voice/synthesize/route.ts:61`; fără `vercel.json` în repo — `Test-Path` = False).
- Compilare TikZ→SVG pe **Railway** prin `TIKZ_COMPILE_URL` (`calculator-registry.ts:6`, `tikz/compile.ts:19`); codul serviciului **NEGĂSIT în acest repo**.
- Runtime: **niciun `export const runtime`** în `src/` (grep) → totul pe Node, nimic edge. Middleware-ul (`proxy.ts`) rulează în runtime-ul implicit de middleware.
- Caching: `force-dynamic` pe admin figura-autor/verificare/continut/figuri-revizie/graf + api voice/clarify/search-methods; `revalidate = 0` pe admin/health:95; restul pe default-urile Next (pagini ○ statice doar auth+onboarding).

---

## S7. SMELLS & RISCURI (candid, prioritizat)

1. **`/api/search/library` public, fără auth, cu service client + embedding per request** (`search/library/route.ts:5-27`). Cost: oricine de pe internet poate arde cota Gemini și citi biblioteca prin endpoint nelistat. Și e mort (zero apelanți) — risc pur, zero beneficiu.
2. **Verificarea matematică dublă-personalitate**: pipeline-ul CAS a produs `exercise_verification` (660 verificări persistate) pe care produsul nu-l citește deloc; în schimb fiecare mesaj de study plătește un Haiku `verifyMath` cu prompt generic (`math-verifier.ts:59`, `route.ts:409`). Cost: $/mesaj + până la 3s latență pe `done`, pentru o verificare LLM mai slabă decât cea deterministă deja existentă.
3. **`verifyMath` blochează evenimentul `done`** (`route.ts:409-420` — race cu 3s, abia apoi se enqueue `done`). UI-ul așteaptă metadata până la 3s după ultimul token. Putea fi push separat sau backgroundat.
4. **Multi-exercițiu strict secvențial** (`route.ts:287-339`): N embeddings + N stream-uri unul după altul; la 5 exerciții latența e suma lor. Sub-exercițiile sunt independente — paralelizabile.
5. **Lanț pre-stream secvențial**: embedding → match_exercises → match_solution_methods → insert conversație → istoric → insert mesaj → decompose, toate înainte de primul token (`route.ts:137-211`). Mai multe dintre ele sunt independente (istoricul/insertul nu depind de RAG).
6. **Clientul e sursa de adevăr pentru istoricul CAT** (`next/route.ts:121-127`): dificultatea următoare se calculează din `history` trimis de client, deși `diagnostic_sessions.exercises_log` există pe server (`submit/route.ts:89-90`). Un client modificat primește orice traseu; și predicția finală din `reveal` vine din store-ul client → `onboarding/complete` o scrie în profil nefiltrată (`complete/route.ts:17-18`).
7. **`/api/chat/clarify` rulează pe task `chat_admin` și fără rate limiting** (`clarify/route.ts:49-50` — „admin tier for simplicity"): orice user free are stream nelimitat de 8192 tokens prin mini-chat, ocolind limita de 30 mesaje/lună din chatul principal.
8. **Cod mort vizibil în produs și în bundle**: TikZRenderer/GeoGebra/Three dezactivate cu placeholder „[Vizualizare disponibilă curând]" (`MessageRenderer.tsx:64-74`) + `public/tikzjax` + `SelectableMessage` + `react-confetti` (0 importuri) + 7/16 rute generate-* fără caller + `/api/admin/compile-tikz` + ambele `/api/search/*` fără apelanți. Cost: suprafață de atac, întreținere, bundle.
9. **Duplicare a adevărului în diagnostic**: cele 24 de exerciții fallback există în 2 fișiere cu răspunsurile separate (`next/route.ts:7-113` vs `submit/route.ts:11-36`) — drift garantat la prima editare. Plus fallback-ul maschează un pool DB gol (silent degradation).
10. **`topic_mastery` 0 rânduri** după 5 profiluri create — scrierea din `complete/route.ts:72-74` nu-și verifică eroarea. Bucla produsului (mastery → recomandări) nu are date și nimeni n-a observat. **INCERT cauza exactă.**
11. **`ai_model_config` cu 4 task-uri fără call-site** (`classify_problem`, `background_tagging`, `generate_tikz_complex`, `validate_visual`) și modele hardcodate care ocolesc router-ul în decomposer/verifier/figura-live/exerciseGenerator — două mecanisme de configurare în paralel.
12. **`(await createClient()) as any`** în rutele elev (`chat/route.ts:68`, `clarify/route.ts:11`, `voice/route.ts:25`) — tipurile DB generate există (`src/types/supabase.ts`) dar sunt anulate exact în rutele cele mai fierbinți.
13. **Header de cache pe POST** la voice (`synthesize/route.ts:93`) — intenția de caching nu are efect; TTS-ul (~$0.015/1K chars) se replătește per sesiune.
14. **KaTeX CSS global** (`app/layout.tsx:4`) — landing-ul și auth plătesc CSS-ul matematic; iar mesajele lungi randează KaTeX integral la fiecare re-render de stream (re-parse pe fiecare chunk, `MessageRenderer` e remountat cu `content` crescând).
15. **`.env.example` incomplet** (5 din ~10 variabile) — onboarding-ul unui dev nou eșuează tăcut pe Gemini/TikZ/PostHog.
16. **Landing `/` e ƒ (dynamic)** deși e pagină de marketing — plătește un render server per vizită (build output; cauza probabilă middleware-ul cu matcher global, `proxy.ts:27-31`). **INCERT cauza exactă fără profiling.**

---
*Generat în ETAPA 58 — read-only. Niciun fișier de cod modificat.*
