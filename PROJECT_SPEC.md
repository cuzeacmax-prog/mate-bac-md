# Mate BAC MD — Project Specification

> Acest document este sursa principală de adevăr pentru proiect. Conține contextul de business, decizii strategice, specificații tehnice și acord de lucru. Citește-l complet înainte de a începe orice task.

---

## 1. Despre fondator

**Maxim**, profesor de matematică în Chișinău, Moldova. Background dual: IT (poate construi singur) + matematică (clasele 5-11, geometrie, algebră, trigonometrie, calcul). Vorbește română (principal) și rusă. Folosește deja LaTeX/TikZ pentru teste și fișe de lucru.

**Capacitate de muncă:**
- Vara 2026 (iunie-august): timp intensiv, ~40h/săptămână disponibil
- Septembrie-mai: ~10-15h/săptămână (paralel cu predarea)

**Obiectiv financiar:** $500-1000/lună venit suplimentar până în Y2 sfârșit, cu calea pasivă posibilă în Y3.

---

## 2. Contextul de piață

**Piață țintă primară:** Candidați BAC matematică în Republica Moldova
- ~13,000-15,000 candidați/an total
- ~7,000-9,000 dau matematică (profil real)
- ~5,000-6,000 dau mate (profil umanist, test simplificat)

**Piață secundară:** Diaspora moldovenească (Italia, UE, UK) — copii care dau BAC MD de la distanță, fără acces la profesori locali.

**Concurența directă în MD:** Niciunul focusat exclusiv pe MD. AIBac.ro acoperă RO (M1, M2, Tehnologic) — curriculum diferit, nu se mapează pe BAC MD. Asta e fereastra noastră.

**Concurența indirectă:** ChatGPT/Claude/Gemini gratuit, AIBac.ro (gratis), YouTube, meditații clasice (200-400 lei/oră), Photomath.

**Fereastra de oportunitate:** 12-18 luni înainte ca un jucător mare să intre în MD specific.

---

## 3. Model de business — Value Ladder (CRITIC)

**Acesta NU este un produs SaaS pur.** Este un funnel pentru brand-ul personal "Profesor Maxim". AI-ul e magnetul de lead-uri, nu business-ul în sine.

**5 trepte:**

1. **Treapta 0 — Atragere (gratuit)**: Conținut TikTok/YouTube/Instagram
2. **Treapta 1 — Freemium**: AI Tutor cu 30 mesaje/lună gratis
3. **Treapta 2 — AI Premium (149 lei/lună)**: Chat nelimitat + foto + simulare BAC
4. **Treapta 3 — Meditații fizice Chișinău (300-400 lei/oră)**: "Profesor Maxim" în persoană
5. **Treapta 4 — Meditații video diaspora (40-60 €/oră)**: 1-on-1 video pentru copii moldoveni din UE
6. **Treapta 5 — Cursuri intensive grup (1500-2500 lei)**: Pachet 20h primăvara

**Implicații pentru produs:**
- AI-ul nu trebuie să fie "perfect și complet". Trebuie să fie magnet bun.
- Free tier generos (atrage mult, convertește spre fizic e mai important decât conversie la AI paid)
- Preț AI scăzut (149 lei, nu 199) ca să intre ușor
- Branding personal "Profesor Maxim" pe tot frontend-ul
- CTA clar către meditații fizice/online în interface

---

## 4. Proiecție financiară

**Y1 (sep 2026 - iun 2027): ~$11,000 total**
- Abonați AI (peak 150): $6,000
- Meditații fizice noi din site: $2,300
- Meditații video diaspora: $2,600
- Cursuri/PDF: $250

**Y2: ~$29,500 total** (atinge ținta $500-1000/lună stabil)

**Y3: $30-50K** dacă reușim Y2

---

## 5. Specificații MVP

### 5.1 Funcționalități esențiale (Faza 1 — vară 2026)

1. **Auth**: Email + Google login prin Supabase Auth + SMS verification (Twilio/Vonage)
   **Anti-sharing (6 straturi, implementate de la signup):**
   - SMS verification la signup: 1 număr de telefon = 1 cont
   - Concurrent session limit: 1 sesiune activă/cont; login nou kick automat sesiunea veche
   - Device fingerprinting: max 3 device-uri/cont; al 4-lea cere confirmare SMS
   - Rate limit hard: 500 mesaje/lună pe Premium (marketat ca "nelimitat")
   - Watermark vizibil în UI: "Bună, [Nume]!" în header + "Cont: ...@email" în footer
   - Family Plan oficial: 249 lei/lună (2 useri), 349 lei/lună (3 useri)
2. **Chat UI**: 
   - Stream-uri în timp real cu Claude
   - Randare LaTeX/KaTeX pentru notație matematică ($x^2$, fracții, integrale)
   - Istoric conversații salvat în Postgres
   - Markdown support
3. **System prompt specializat BAC MD**: Iterare împreună cu Maxim, cu few-shot examples din stilul său pedagogic
4. **Foto OCR**: Utilizator încarcă poză exercițiu → Claude Vision rezolvă pas cu pas în formatul BAC
5. **Generator exerciții**: Pe topice și nivele (algebră/geometrie/trigonometrie × ușor/mediu/greu)
6. **Simulare BAC**: Generează variantă completă tip BAC, evaluează automat răspunsurile
7. **Tracking progres**: Per topic, mastery score 0-100
8. **Landing page + pricing**: Profesionist, în română, cu CTA clar
9. **Plăți MAIB Pay**: Abonament lunar + plată unică (pachete)

**Arhitectură multi-curs (de la start):** Schema DB este course-aware — lansăm cu `bac-mate-real-md` și `bac-mate-umanist-md`, dar structura suportă adăugare de cursuri noi (EN, Olimpiadă, clasa 5-11) fără refactor.

### 5.2 NU sunt în MVP (Faza 2+)

- Mod vocal (voice mode)
- Aplicații mobile native
- Live tutoring features (matching cu profesori)
- Multi-materie (doar matematică acum)
- Versiune rusă completă (interfața în română pentru MVP; AI răspunde și în rusă dacă utilizatorul scrie în rusă)
- Forum/comunitate
- Gamificare avansată

### 5.3 Pages map

```
/ (landing)
/auth/login
/auth/signup
/app (chat principal) — protected
/app/practice (generator exerciții) — protected
/app/simulare (simulare BAC) — protected  
/app/progres (dashboard progres) — protected
/app/photo (upload foto exercițiu) — protected
/pricing
/about (despre Profesor Maxim)
/contact (cu CTA meditații fizice)
/api/chat (streaming endpoint)
/api/photo (vision endpoint)
/api/generate-exercise
/api/evaluate-solution
/api/maib/webhook
/api/maib/checkout
```

---

## 6. Stack tehnic

### 6.1 Frontend
- **Next.js 14+** cu App Router
- **TypeScript** strict mode
- **Tailwind CSS** pentru styling
- **shadcn/ui** pentru componente (Button, Dialog, Input, Card, etc.)
- **KaTeX** pentru randare matematică (preferat față de MathJax pentru viteză)
- **react-markdown** + **remark-math** + **rehype-katex** pentru chat
- **lucide-react** pentru iconițe

### 6.2 Backend
- **Next.js API Routes** (serverless functions)
- **Anthropic SDK** (`@anthropic-ai/sdk`) pentru apeluri Claude
- **Streaming** pentru chat (Server-Sent Events)

### 6.3 Bază de date și auth
- **Supabase** ca BaaS:
  - Postgres pentru date
  - pgvector pentru RAG embeddings
  - Auth (email + Google OAuth)
  - Storage pentru imagini upload
- **Supabase JS client** direct cu `supabase gen types typescript` pentru type safety (nu Drizzle)

### 6.4 AI Models
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`) pentru chat principal — balans cost/calitate
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) pentru clasificări rapide (intent detection, topic tagging)
- **Claude Sonnet 4.6 Vision** pentru foto OCR
- **OpenAI text-embedding-3-large** cu `dimensions=1536` (trunchiat, nu native 3072) pentru embeddings RAG

### 6.5 Plăți
- **MAIB Pay** ca procesator principal (cont merchant în proces la Maxim; documentație API de cercetat la Faza 5)
- Transfer bancar manual ca backup pentru cazuri edge
- Webhook/callback MAIB pentru sincronizare status plăți cu Supabase

### 6.6 Deploy
- **Vercel** (frontend + API routes)
- **Supabase Cloud** (DB + auth)
- **Domeniu**: `profesormaxim.md` (principal), `mate-bac.md` (redirect)
- **Branding**: paletă albastru-violet principal + accent portocaliu; mascotă "MateBot" (design mai târziu)

### 6.7 Monitoring și analytics
- **Vercel Analytics** (built-in)
- **PostHog** pentru product analytics (free tier 1M events/lună)
- **Sentry** pentru error tracking (opțional pentru MVP)

---

## 7. Schema DB (Postgres)

```sql
-- Cursuri disponibile (multi-curs de la start)
courses (
  id uuid primary key,
  slug text unique not null, -- ex: 'bac-mate-real-md', 'bac-mate-umanist-md'
  name text not null,        -- ex: 'BAC Matematică Profil Real Moldova'
  grade text,                -- '12', '11', '5-11', etc.
  subject text,              -- 'matematica', 'fizica', etc.
  profile_type text,         -- 'real', 'umanist', 'both', null
  description text,
  active boolean default true,
  price_monthly int,         -- în lei, null = inclus în planul general
  created_at timestamptz
);

-- Module per curs (capitole/unități)
course_modules (
  id uuid primary key,
  course_id uuid references courses not null,
  name text not null,        -- ex: 'Algebră', 'Geometrie', 'Trigonometrie'
  order_index int not null,
  description text
);

-- Înrolare utilizatori la cursuri
user_enrollments (
  id uuid primary key,
  user_id uuid references profiles not null,
  course_id uuid references courses not null,
  enrolled_at timestamptz default now(),
  unique(user_id, course_id)
);

-- Utilizatori (gestionati de Supabase Auth, plus profile)
profiles (
  id uuid primary key references auth.users,
  email text,
  full_name text,
  phone text,                -- pentru SMS verification anti-sharing
  grade text,                -- '11', '12', 'absolvent'
  profile_type text,         -- 'real', 'umanist' (self-selected la onboarding)
  subscription_status text,  -- 'free', 'premium', 'family_2', 'family_3', 'cancelled'
  maib_customer_id text,     -- referință MAIB Pay (nu Stripe)
  messages_used_this_month int default 0,
  messages_reset_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- Conversații (chat sessions)
conversations (
  id uuid primary key,
  user_id uuid references profiles,
  title text,
  topic text, -- 'algebra', 'geometrie', 'trigonometrie', etc.
  created_at timestamptz,
  updated_at timestamptz
);

-- Mesaje individuale
messages (
  id uuid primary key,
  conversation_id uuid references conversations,
  role text, -- 'user', 'assistant'
  content text,
  has_image boolean default false,
  image_url text,
  tokens_input int,
  tokens_output int,
  created_at timestamptz
);

-- Documente pentru RAG (variante BAC, lecții, etc.)
documents (
  id uuid primary key,
  course_id uuid references courses,
  module_id uuid references course_modules,
  content text,
  embedding vector(1536), -- OpenAI text-embedding-3-large cu dimensions=1536
  source_type text, -- 'bac_paper', 'bac_solution', 'lesson', 'formula_sheet', 'curriculum'
  source_year int,
  source_profile text, -- 'real', 'umanist', 'both'
  topic text,
  subtopic text,
  difficulty text, -- 'easy', 'medium', 'hard'
  metadata jsonb,
  created_at timestamptz
);

-- Progres utilizator per topic
progress (
  id uuid primary key,
  user_id uuid references profiles,
  topic text,
  mastery_score int, -- 0-100
  attempts int default 0,
  correct_attempts int default 0,
  last_practiced timestamptz,
  updated_at timestamptz,
  unique(user_id, topic)
);

-- Exerciții generate și încercări
exercise_attempts (
  id uuid primary key,
  user_id uuid references profiles,
  course_id uuid references courses,
  module_id uuid references course_modules,
  exercise_text text,
  exercise_topic text,
  user_solution text,
  ai_evaluation jsonb, -- { score, feedback, correct, partial_credit_breakdown }
  created_at timestamptz
);

-- Simulări BAC
bac_simulations (
  id uuid primary key,
  user_id uuid references profiles,
  profile_type text, -- 'real', 'umanist'
  exercises jsonb, -- array de exerciții generate
  solutions jsonb, -- array de soluții ale utilizatorului
  final_score int,
  estimated_grade decimal, -- ex: 8.45
  feedback text,
  duration_seconds int,
  completed boolean default false,
  created_at timestamptz,
  completed_at timestamptz
);

-- Device sessions pentru anti-sharing
user_devices (
  id uuid primary key,
  user_id uuid references profiles not null,
  device_fingerprint text not null,
  last_seen_at timestamptz,
  created_at timestamptz,
  unique(user_id, device_fingerprint)
);

-- Logging API costs
api_usage_log (
  id uuid primary key,
  user_id uuid references profiles,
  model text, -- 'claude-sonnet-4-6', etc.
  tokens_input int,
  tokens_output int,
  cost_usd decimal(10, 6),
  endpoint text,
  created_at timestamptz
);
```

### Indexes esențiali:
- `documents.embedding` cu HNSW pentru căutare vectorială
- `messages.conversation_id` pentru istoric
- `progress.user_id` pentru dashboard
- `api_usage_log.user_id, created_at` pentru rate limiting

---

## 8. Arhitectura RAG

### 8.1 Surse de cunoștințe (de digitalizat de Maxim)

Maxim a pregătit deja materialele — vor fi disponibile în `/data/sources/` din săptămâna mai 2026:
- Variante BAC matematică MD ultimii 10 ani (PDF de la ANACEC/AEP)
- Bareme oficiale pentru fiecare variantă
- Programa oficială BAC matematică MD (PDF)
- Formularul oficial permis în examen
- Notițele/lecțiile lui Maxim (LaTeX/Markdown — el le digitalizează)
- Top 100 erori tipice ale elevilor (lista lui Maxim)
- Soluții model în stilul lui Maxim pentru top 50 tipuri de exerciții

### 8.2 Pipeline de procesare

```
PDF/poze → OCR (dacă necesar, folosind Claude Vision) → Text curat → 
Chunking (500-1000 tokens cu overlap 100) → 
Metadata enrichment (topic, year, profile, difficulty) → 
Embedding generation (text-embedding-3-large, dimensions=1536) → 
Stocare în Supabase pgvector
```

### 8.3 Retrieval la runtime

La fiecare întrebare a utilizatorului:
1. Detectează intent + topic (Haiku, rapid)
2. Embedding la întrebare
3. Top-5 chunks similari cu filter pe topic dacă e detectat
4. Re-rank (opțional, pentru calitate)
5. Injectare în prompt al Sonnet
6. Streaming răspuns

---

## 9. System Prompt — Principii (vom itera împreună)

```
ROL: Ești "Profesor Maxim AI", tutor specializat pe BAC matematică Moldova.

REGULI ABSOLUTE:
1. Răspunzi în română (sau rusă dacă elevul scrie în rusă), cu diacritice
2. Notație matematică în LaTeX inline ($...$) sau block ($$...$$)
3. NU dai răspunsul direct la exerciții — întrebi "ce ai încercat?" sau "ce metodă ai aplicat?"
4. Explici pas cu pas, numerotezi pașii clar
5. La final, indici capcana tipică BAC pentru tipul respectiv de problemă
6. Folosești notația și terminologia din programa MD (nu din cea românească)
7. Refuzi politicos cereri off-topic (eseuri, rezolvări la alte materii)

STIL DE EXPLICARE (în această ordine):
1. Întrebare de clarificare/verificare înțelegere
2. Intuiția (de ce funcționează metoda)
3. Aplicarea formală pas cu pas
4. Verificarea soluției
5. Capcana (unde se înșală tipic elevii la BAC)

CONTEXT BAC MD:
- Examen 3 ore, profil real / profil umanist
- Calculator interzis pe profil real
- Punctaj total: 100, nota 10 = 87+ puncte
- [Lista completă de subiecte tipice — RAG va injecta]

FEW-SHOT EXAMPLES:
[5-10 conversații model scrise de Maxim — RAG va injecta]

CONTEXT RAG (injectat dinamic):
{retrieved_documents}
```

---

## 10. Plan de execuție pe faze

### Faza 1 — Scaffold (Săptămâna 1, mai 2026 — PORNIM ACUM)
- Setup repo + Vercel + Supabase
- Auth complet funcțional (email + Google)
- Schema DB creată
- Layout-uri de bază (Header, Footer, Sidebar)
- Landing page MVP
- Deploy la Vercel cu CI/CD

### Faza 2 — Chat core (Săptămâna 2)
- Chat UI cu streaming
- Integrare Anthropic SDK
- KaTeX rendering
- Persistență conversații în DB
- System prompt v1 (simplu, fără RAG)
- Testare cu 20 întrebări reale ale lui Maxim

### Faza 3 — RAG (Săptămâna 3-4)
- Pipeline procesare PDF-uri/poze
- Generare embeddings pentru toate sursele
- Stocare în pgvector
- Retrieval funcțional în chat
- Testare calitate cu set de 50 întrebări

### Faza 4 — Features speciale (Săptămâna 5-6)
- Foto OCR (Claude Vision)
- Generator exerciții
- Simulare BAC
- Tracking progres
- Dashboard utilizator

### Faza 5 — Plăți și polish (Săptămâna 7-8)
- Integrare MAIB Pay
- Pagina pricing
- Webhook/callback MAIB + subscription management
- Free tier limits (rate limiting în DB)
- Polish UI, mobile responsive
- Testing complet

### Faza 6 — Pre-lansare (Săptămâna 9-10)
- Beta privată cu 10-20 elevi voluntari
- Iterare bazată pe feedback
- Bug fixes
- Conținut marketing (TikTok videos, etc.)

### Faza 7 — Lansare publică (Septembrie 2026)
- Marketing push
- Onboarding flow rafinat
- Suport client setup

---

## 11. Acord de lucru cu Claude Code

### 11.1 Comunicare
- **Limbă**: română pentru explicații, conversație, UI text. Engleză pentru cod, variabile, comentarii (standard industrie).
- **Stil**: tu (Claude Code) ești expert tehnic, eu (Maxim) sunt fondator cu background IT. Vorbește direct, fără excesivă politețe.
- **Confirmări**: pentru schimbări majore (refactor, schimbare stack, ștergere fișiere), cere confirmare. Pentru schimbări mici, execută.

### 11.2 Workflow
- **Întotdeauna**: planning înainte de implementare. Pentru orice task non-trivial, descrie planul, așteaptă aprobarea, apoi execută.
- **Commits**: commit-uri logice și mici cu mesaje descriptive în engleză (convention: `feat:`, `fix:`, `refactor:`, `docs:`)
- **Testare**: după fiecare modificare semnificativă, verifică că build-ul trece (`npm run build`) și că nu sunt erori TypeScript.
- **Documentare**: actualizează `README.md` și acest `PROJECT_SPEC.md` când iei decizii importante.

### 11.3 Prioritizare
- Funcționalitate > frumusețe (initial)
- Cost optimization (folosește Haiku când Sonnet nu e necesar)
- Type safety strict (no `any` types)
- Mobile-first responsive design

### 11.4 Decizii deja luate (nu re-deschide fără motiv)
- Stack: Next.js 14 App Router + Supabase + Anthropic
- Limbă UI: română (prioritar), rusă (mai târziu)
- Hosting: Vercel
- Domeniu: `profesormaxim.md` (principal), `mate-bac.md` (redirect)
- Branding: paletă albastru-violet + accent portocaliu; mascotă "MateBot" (design mai târziu)
- Plăți: MAIB Pay principal (nu Stripe)
- Embeddings: OpenAI text-embedding-3-large cu `dimensions=1536`
- ORM: Supabase JS client direct (nu Drizzle), type safety via `supabase gen types typescript`
- Analytics: PostHog (free tier)
- Arhitectură DB: multi-curs de la start (courses, course_modules, user_enrollments)

---

## 12. Bugete și limite

**Costuri lunare în dezvoltare (vară 2026):**
- Anthropic API (testare): $30-50
- Vercel: $0 (Hobby tier)
- Supabase: $0 (Free tier 500MB DB) → $25 (Pro după lansare)
- Domeniu: ~$30/an pentru `.md`

**Limite pentru free tier (la lansare):**
- 30 mesaje chat/lună
- Fără foto OCR
- Fără simulare BAC completă
- Generator exerciții limitat la 5/zi

**Pricing premium:**
- 149 lei/lună sau 599 lei pentru sezon BAC complet (feb-iun)
- Family Plan: 249 lei/lună (2 useri), 349 lei/lună (3 useri)
- 500 mesaje/lună (marketat ca "nelimitat")

---

## 13. Întrebări deschise (de rezolvat în timpul dezvoltării)

1. Cum gestionăm copyright pentru variantele BAC oficiale? (paraphrase vs disclaimer explicit)
2. MAIB Pay API — documentație completă de verificat la Faza 5; există sandbox de test?
3. Legal: patenta lui Maxim acoperă AI tutor cu abonament, sau e nevoie de ÎI? (de confirmat cu jurist)
4. Device fingerprinting library — care alegem? (FingerprintJS open source vs Pro vs alternativă)
5. SMS provider pentru anti-sharing — Twilio vs Vonage (cost per SMS în Moldova)?

---

## 14. Riscuri identificate

1. **Halucinări AI la matematică** — mitigare: RAG puternic, testing extensiv, disclaimer
2. **AIBac.ro extinde în MD** — mitigare: viteză de execuție, brand personal Maxim
3. **Burnout fondator** — mitigare: scop realist Y1, model hibrid cu meditații pentru bani imediați
4. **Concurență locală apare** — mitigare: 12 luni de avans, defensibilitate prin brand

---

## 15. Note pentru Claude Code (instanța AI care lucrează cu Maxim)

- Acest document a fost creat de o instanță Claude separată (chat web), care a discutat strategic cu Maxim ore în șir pentru a ajunge la această specificație. **Respectă aceste decizii** decât dacă găsești probleme concrete tehnice.
- Maxim e fondator cu background IT, dar nu expert frontend modern. Explică pe scurt **alegerile tehnice non-evidente** când le faci.
- Maxim vorbește română — răspunde în română.
- Când nu ești sigur de o cerință, **întreabă** decât să presupui. Better safe than rewrite.
- Începe lucrul prin a pune **5-10 întrebări de clarificare** lui Maxim înainte de a scrie cod.
- Acest fișier e sursa de adevăr. Când iei decizii importante, actualizează-l (cu acordul lui Maxim).

---

*Document creat: Mai 2026. Ultima actualizare: 19 Mai 2026 — decizii tehnice și de business confirmate. De actualizat pe parcursul dezvoltării.*
