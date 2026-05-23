# Arhitectura Mate BAC MD

## Stack

| Layer | Tehnologie |
|---|---|
| Frontend | Next.js 16.2.6 App Router, React 19, Tailwind 4 |
| Backend | Next.js Route Handlers (Server Actions + SSE) |
| DB | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| AI | Anthropic Claude (Sonnet/Haiku via AI SDK) |
| Embeddings | Google Gemini embedding-001 (1536d) |
| TikZ compile | Railway service (custom LaTeX compiler) |
| Stocare fișiere | Supabase Storage (SVG-uri statice) |

## Fluxuri principale

### 1. Chat cu RAG
```
User → POST /api/chat
  → Auth + rate limit
  → Gemini embed query (1536d, free tier)
  → match_exercises RPC (cosine similarity)
    → similarity ≥ 0.85: răspuns direct din bibliotecă (zero AI cost)
    → 0.65–0.85: injectare context în prompt Sonnet
    → < 0.65: apel Sonnet normal + log gap_analysis
  → SSE stream înapoi la client
```

### 2. Batch generator
```
npm run batch:test / batch:full
  → variation-matrices.ts (200 variații predefinite)
  → Geometrie calculator (TypeScript, zero AI)
  → Railway TikZ compile → SVG
  → Sonnet: enunț + soluție (⚠️ costă bani)
  → Gemini embed (free tier)
  → INSERT solved_exercises
  → batch-progress.json (resume dacă script crăpat)
```

### 3. Admin review
```
/admin/library/review
  → Listare exerciții cu needs_review=true
  → Editare statement/solution inline
  → Aprobare → reviewed_by_admin=true, needs_review=false
```

## Structura directoarelor

```
src/
  app/
    api/
      chat/           → SSE stream + RAG
      admin/
        generate-*/   → API-uri geometrie (Triangle, Circle, etc.)
        library/      → CRUD bibliotecă
      search/
        library/      → RAG search endpoint
    admin/
      health/         → System health dashboard
      library/
        review/       → Review UI
        preview/      → Compilare vizuală variații
      test-construction/ → Testare interactivă forme geometrice
  lib/
    geometry/         → Calculatoare TypeScript (11 module)
    embeddings/       → Gemini embedding helper
    library/          → exerciseGenerator.ts (Sonnet)
    ai/               → router, system-prompt
    supabase/         → server, service, types

scripts/
  library/            → batch-generate-all, variation-matrices, test-embedding
  db/                 → apply-rpc (instrucțiuni migrare)
  backup/             → export/import JSON

supabase/
  migrations/         → Schema SQL (aplicat în ordine timestamp)
```

## Securitate

- `createClient()` — client cu RLS activ (user autentificat)
- `createServiceClient()` — bypass RLS (doar server, scripturi batch)
- Admin check: `subscription_status === 'admin'` pe tabelul `profiles`
- Rate limit: RPC `check_rate_limit` / `increment_rate_limit` (30 msg/lună free)
