# ETAPA 78 — RETENȚIA: PWA + push + emailuri + panoul pilotului + Exerciții (2026-06-12)

Ultimul pilon tehnic înainte de pilot. PRINCIPIUL DE BUN-SIMȚ peste tot:
notificările sunt servitori, nu spam — max 1 push/zi, liniște 21:00–09:00
Chișinău, opt-out la un click, totul în `notifications_log`.

## EȘECURILE ȘI LIMITELE ÎNTÂI

### 1. Emailurile NU pleacă încă — totul e `pending-no-key` (așteptat, prin design)
`RESEND_API_KEY` nu există în env (Maxim conectează domeniul zilele astea).
GARDA cerută e dovedită în acceptanța C2: fiecare trimitere se scrie în
`notifications_log` cu `metadata.status='pending-no-key'` și **nimic nu crapă**.
Ce rămâne pe `pending-no-key` până la conectare: **toate cele 4 emailuri**
(bun venit, streak rupt, raport săptămânal elev+părinte, trial/plată) și
trimiterea reală de test către Maxim (scriptul C2 o face automat când cheia
apare — re-rulează `etapa78-email-acceptance.ts` după conectare).

### 2. Cron-urile Vercel: 3 joburi zilnice — peste limita planului Hobby
`vercel.json` are 3 cron-uri (push-streak 16:30 UTC, push-provocare 05:30 UTC,
email-zilnic 15:00 UTC). Planul Hobby permite 2; dacă proiectul e pe Hobby,
deploy-ul va cere fie Pro, fie consolidarea push-urilor într-un singur job.
Nu am consolidat preventiv — orele diferite (dimineață/seară) sunt esența
bunului-simț, iar regulile de fereastră din `lib/notify/push.ts` NU pot
înlocui ora reală de trimitere.

### 3. Ora de iarnă mută cron-urile cu o oră (recunoscut, nealiniat)
Vercel cron e în UTC; Chișinău e UTC+3 vara / UTC+2 iarna. Iarna: streak-ul
pleacă 18:30 (tot seară, OK), provocarea ar pleca 07:30 — fereastra 08–10 din
lib o BLOCHEAZĂ (onest: iarna provocarea poate sări zile până ajustăm cron-ul
sezonier). Documentat în `api/cron/push-provocare/route.ts`.

### 4. Dificultatea exercițiilor e DERIVATĂ, nu curatoriată
Filtrul „accesibil/avansat" din /app/exercitii folosește clasificatorul
determinist din ETAPA 75 (`lib/ai/difficulty.ts`) aplicat pe enunț — zero LLM,
dar e o euristică (cuvinte-cheie + structură), nu o etichetă de profesor.
166 accesibile / 255 avansate pe biblioteca curentă.

### 5. O singură figură aprinsă în bibliotecă (gol de date din ETAPA 64, nu regresie)
Din 421 exerciții servibile, doar 1 are figură aprobată — restul figurilor
sunt legate de exerciții ne-servibile. Pagina arată figura când există;
golul e de conținut, marcat încă din ETAPA 64.

### 6. Defecte găsite ȘI reparate pe drum (prinse de porți, nu de ochi)
- **Hydration mismatch (React #418) pe /app/setari** — `pushSupported()`
  evaluat la randare dădea text diferit server vs client; prins de qa-crawl,
  mutat în efect (`supported` e stare, „Se verifică…" până la detecție).
- **`.in()` cu 422 UUID-uri sparge limita URL PostgREST** — `fetch failed`
  silențios → biblioteca apărea GOALĂ; prins de acceptanța E (a picat la prima
  rulare); reparat cu loturi de 150 (`inChunks`).
- **Lint `react-hooks/set-state-in-effect`** în PwaSetup (FAZA A, scăpat) și
  NotifSettings — setState sincron în efect; refăcut: decizia promptului PWA
  se ia în handler-ul `beforeinstallprompt`, nu într-un efect derivat.
- **`server-only` neinstalat** — import scos (pattern inexistent în codebase).
- **Tipurile Supabase generate** nu știau de `parent_email`/`is_pilot`/`status`
  — completate manual în `src/types/supabase.ts` (de regenerat la următorul
  `gen types`).

### 7. Ce NU s-a făcut (scop ținut)
- Niciun „mock BAC e gata" push/email (doar cele 2 push + 4 emailuri cerute).
- Panoul pilot nu are grafice — un ecran de cifre, citibil în 2 minute.
- Lecția (LessonPlayer) nu primește exercițiul pin-uit — pin-ul duce DIRECT
  în chat-ul ancorat (lecția își alege singură exercițiile, by design).

## CE S-A LIVRAT, PE FAZE

### FAZA A — PWA (comisă anterior, `1929062`; re-verificată azi)
Manifest instalabil (name, standalone, iconuri 192+512 + maskable), SW cu
shell offline ONEST pe brand, prompt DISCRET (după prima lecție sau al 3-lea
daily; respins → 14 zile tăcere). Poarta re-rulată azi: verde, cu refactorul
de lint inclus. `pwa-install-prompt.png`, `pwa-offline.png`.

### FAZA B — PUSH (`bd59f6b`)
- VAPID în env (+`.env.example` documentat), `push_subscriptions` user-owned
  (RLS din ETAPA 65), abonare/dezabonare `/api/push/subscribe`.
- Permisiunea DOAR după ecranul prealabil care spune CE primești — niciodată
  dialogul brut al browserului (`NotifSettings`, `push-client.ts`).
- Două tipuri prin Vercel Cron: STREAK ÎN PERICOL (seara; doar daily nefăcut
  ȘI streak ≥ 2 — nu sâcâim pe cine n-are ce pierde) și PROVOCAREA E GATA
  (dimineața; DOAR opt-in explicit, implicit OPRIT).
- TOATE regulile într-un singur loc (`lib/notify/push.ts`): max 1 push/zi
  per user, liniște 21–09, fără abonament → nimic, totul logat; endpoint-urile
  moarte (404/410) se curăță singure.
- `/app/setari`: toggle per tip + promisiunea scrisă negru pe alb; link ⚙ în header.
- **B3**: 10 reguli dovedite una câte una pe userul de audit (scriptat, re-rulabil).

### FAZA C — EMAILURI (`986e60d`)
- `lib/notify/email.ts`: garda pending-no-key, trimitere prin API-ul Resend
  (fetch direct, fără SDK nou), log obligatoriu, dedupe per tip/fereastră.
- 4 emailuri RO cu diacritice, HTML simplu pe brand, citeț pe telefon, toate
  cu dezabonare în footer (token HMAC, un click, fără login —
  `/api/email/unsubscribe`): BUN VENIT (la confirmarea contului, idempotent
  pe viață, hook în `/auth/callback`), STREAK RUPT (a doua zi, ton cald,
  doar serie pierdută ≥ 2), RAPORTUL SĂPTĂMÂNAL (duminică; elev + părinte
  când `parent_email` există — câmp nou în setări; TOATE cifrele din
  `concept_mastery`/`exercise_attempts`/`streak_log`/`conversations`; fără
  activitate → varianta scurtă de re-angajare, separată și pentru părinte),
  TRIAL EXPIRĂ (≤2 zile, din `subscriptions` ETAPA 71) + PLATA RESTANTĂ
  (past_due, link de plată).
- Un singur cron zilnic (`/api/cron/email-zilnic`) le acoperă pe toate.
- Opt-out-ul oprește re-angajarea (streak, raport); emailurile de CONT
  (bun venit, trial, plată) se trimit oricum — documentat în cod.
- **C2**: 7 HTML-uri cu datele REALE ale userului de audit în
  `docs/email-preview/` (lecții=51, încercate=123 — nimic înfrumusețat),
  garda + dedupe + token + opt-out + detecția streak-ului rupt dovedite.

### FAZA D — PANOUL PILOTULUI (`65e4dd4`)
- `user_profiles.is_pilot` (migrație `etapa78_pilot`, setabil din panou),
  `admin_feedback.status` nou/văzut/rezolvat.
- `/admin/pilot` — UN ecran, zero LLM: activi azi/7z, lecții 7z, acuratețe
  quiz, streak-uri per user, top concepte lucrate, erori recente
  (`katex_error_report` inclusiv `client-render`), inbox feedback cu stare
  (click = nou→văzut→rezolvat), cost AI per user pilot (`api_usage_log`),
  cohortă administrabilă (adaugă/scoate).
- Acceptanță scriptată pe userul de audit: cifre reale, cohorta setabilă.

### FAZA E — PAGINA EXERCIȚII (`14b5ffc`) — ultimul „Curând" a murit
- `/app/exercitii`: 421 exerciții SERVIBILE (R5 dovedit contra DB-ului:
  view-ul are 422, 1 exclus onest pentru markdown nerandabil — regula din
  daily). 345 verificate CAS + 76 sursă-oficială, badge pe fiecare.
- Filtre domeniu (doar domeniile CU conținut — nu promitem module goale) /
  clasă / dificultate; căutare insensibilă la diacritice
  („primitiva"=„primitivă"=24 rezultate); paginare; figura când există.
- Click → chat-ul ancorat pe conceptul exercițiului cu exercițiul
  PRE-ÎNCĂRCAT: pin-ul curge prin tot firul (pagină → ChatView → useChat →
  `/api/chat` → `getConceptAnchor`), deci și intro-ul determinist ȘI system
  prompt-ul văd același exercițiu primul. Pin invalid → ignorat onest.
- Sidebar: `/app/practice` (disabled, „Curând") → `/app/exercitii` viu.

### FAZA F — PORȚI
- Build + lint (0 erori) + 126 teste unitare verzi la fiecare fază.
- qa-crawl EXTINS (exerciții cu filtre+căutare+click-through în chat ancorat,
  setări) — **ZERO erori de consolă / request-uri eșuate** după fix-ul de
  hidratare.
- Screenshot-uri în `docs/design-review/etapa78/`: prompt PWA, offline,
  setări (cu ecranul prealabil deschis), panoul pilot, exerciții (+filtrat),
  cele 7 emailuri randate.
- Bateria de acceptanțe 60–78: tabelul de mai jos.

## PORȚILE (eșecurile întâi)

**27/27 VERZI** — zero eșecuri rămase. Build + lint (0 erori) + 126 teste
unitare verzi. Logul complet al bateriei: `docs/design-review/etapa78/_gates.log`.

| Poartă | Rezultat | Poartă | Rezultat |
|---|---|---|---|
| etapa14 (daily+streak) | PASS | etapa72-latex | PASS |
| etapa60 (mastery) | PASS | etapa72-messages | PASS |
| etapa63 (evaluare) | PASS | etapa73-markdown | PASS |
| etapa64 (servable) | PASS | etapa74-self-contained | PASS |
| etapa68 (progres) | PASS | etapa74-qa-crawl EXTINS | PASS (0 defecte) |
| etapa69 (simulare) | PASS | etapa75-canonical | PASS |
| etapa70-ask | PASS | etapa75-routing | PASS |
| etapa70-figures | PASS | etapa77-foto | PASS |
| etapa70-g | PASS | **etapa78-pwa (A)** | PASS |
| etapa70-help | PASS | **etapa78-push (B3)** | PASS |
| etapa70-mistake | PASS | **etapa78-email (C2)** | PASS |
| etapa71-manipulative | PASS | **etapa78-pilot (D)** | PASS |
| etapa71-map | PASS | **etapa78-exercitii (E)** | PASS |
| etapa71-payments | PASS | | |

## Decizii luate pe drum (de validat de Maxim)
1. **Dezabonarea email** = `notification_preferences.email=false` oprește
   re-angajarea, NU emailurile de cont (trial/plată) — acelea sunt informații
   despre banii lui, nu marketing. Footerul există pe toate.
2. **Tokenul de dezabonare** e HMAC-SHA256 derivat din `CRON_SECRET` (un
   secret deja în env, domeniu separat prin prefix) — fără tabel nou.
3. **Panoul pilot în screenshot** s-a făcut promovând temporar userul de
   AUDIT la admin (și retrogradat în `finally`) — contul real al lui Maxim
   nu a fost atins.
4. **`email-raport-parinte`** se loghează ca tip separat în `notifications_log`
   (destinatar diferit), deci dedupe-ul elev/părinte nu se calcă.

## Ce urmează (pentru pilot)
- Maxim: conectează domeniul Resend → pune `RESEND_API_KEY` + `RESEND_FROM`
  în Vercel → re-rulează `etapa78-email-acceptance.ts` (trimite testul real).
- Maxim: `CRON_SECRET` + cheile VAPID în env-ul Vercel de producție.
- Verifică planul Vercel pentru 3 cron-uri (vezi §2).
- Populează cohorta pilot din `/admin/pilot` (lista de candidați e acolo).
