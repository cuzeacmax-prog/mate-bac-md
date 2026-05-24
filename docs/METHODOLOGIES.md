# Metodologii BAC MD — Documentație (ETAPA 6)

## Ce sunt metodologiile?

Metodologiile sunt **metode pedagogice specifice BAC Republica Moldova** — pași de rezolvare, notații obligatorii, greșeli frecvente și exemple complete pentru fiecare tip de exercițiu BAC MD.

Spre deosebire de biblioteca de exerciții (care stochează *exerciții rezolvate*), metodologiile stochează **cum se rezolvă** un tip de problemă conform rigorilor BAC MD.

---

## Schema DB: `solution_methods`

Migrare: `supabase/migrations/20260603000000_solution_methods.sql`

### Câmpuri cheie

| Câmp | Tip | Descriere |
|------|-----|-----------|
| `exercise_type` | text | Identificator unic tip exercițiu (`ecuatie_gradul_2`) |
| `exercise_type_label` | text | Eticheta afișată utilizatorului |
| `method_name` | text | Numele metodei pedagogice |
| `grade_level` | int | Clasa (10, 11, 12) |
| `topic` | text | Domeniu: algebra, analiza, geometrie, trigonometrie… |
| `steps` | jsonb | Pași numerotați `[{step, title, content, formula}]` |
| `notation_rules` | jsonb | Notații BAC MD obligatorii `{key: "notație"}` |
| `required_elements` | jsonb | Ce trebuie obligatoriu în rezolvare |
| `forbidden_shortcuts` | text[] | Scurtături interzise |
| `examples` | jsonb | Exemple complete cu soluție |
| `common_mistakes` | jsonb | Greșeli frecvente + corectări |
| `validated` | boolean | Validat de profesor → apare în RAG |
| `embedding` | vector(1536) | Pentru semantic search (Gemini, opțional) |

---

## Schema DB: `tool_capabilities`

Migrare: `supabase/migrations/20260603100000_tool_capabilities.sql`

Mapare calculator → tipuri de exerciții pe care le rezolvă. Permite RAG tool lookup — AI-ul știe ce calculator e disponibil pentru ce problemă.

---

## RAG Integration (ETAPA 6)

### Fluxul în `/api/chat`

```
POST /api/chat
  ↓
generateEmbeddingForQuery(message)
  ↓
match_exercises RPC          → exercițiu similar din bibliotecă
match_solution_methods RPC   → metodă de rezolvare BAC MD
  ↓
System prompt enhanced:
  - SYSTEM_PROMPT_V1 (base)
  - + metodă BAC MD (dacă similarity ≥ 0.55)
  - + exercițiu similar (dacă similarity ∈ [0.65, 0.85))
  ↓
Claude → SSE stream
```

### Backwards compatibility

Dacă tabela `solution_methods` nu există sau nu e populată:
- `findRelevantMethod()` returnează `null`
- System prompt rămâne nemodificat (SYSTEM_PROMPT_V1)
- **Nu există nicio eroare** — fallback transparent

---

## Cum se adaugă metode noi

### Opțiunea 1: Admin UI (recomandat)

1. Mergi la `/admin/methodologies`
2. Click **+ Metodă nouă**
3. Completează formularul
4. Marchează **Validată** când e gata
5. (**Opțional**) Generează embedding separat pentru semantic search

### Opțiunea 2: Seed script (batch)

```bash
# NU rula fără verificare manuală
npx ts-node --project tsconfig.scripts.json scripts/seed/methodologies-seed.ts
```

Script-ul inserează 30 metode predefinite cu `upsert` (nu duplică dacă rulezi de mai multe ori).

**Note:**
- Seed-ul NU generează embeddings (ZERO AI cost)
- Semantic search funcționează doar după generare embeddings
- Text search (ILIKE) funcționează imediat, fără embeddings

### Opțiunea 3: Direct în Supabase Studio

Aplică migrările manual și inserează direct în tabelă.

---

## Semantic Search fără embeddings

Endpoint-ul `/api/search/methods` are fallback automat:

1. **Dacă există Gemini API key**: semantic search (cosine similarity)
2. **Dacă nu**: text search cu ILIKE pe `method_name`, `exercise_type_label`, `description`

---

## Notații BAC MD standard

BAC Republica Moldova are notații specifice obligatorii:

| Element | Notație BAC MD |
|---------|----------------|
| Discriminant | `Δ` (nu `D`) |
| Mulțimea soluțiilor | `S = {x₁, x₂}` |
| Mulțimea vidă | `∅` (nu `{}`) |
| Răspuns final | `R: ...` |
| Condiții existență log | `CE: ...` |

---

## Prioritate tipur de metode (importance_score)

| Score | Tipul |
|-------|-------|
| 10 | Ecuație gradul II, Derivate, Studiul funcției |
| 9 | Limite, Integrale, Inecuații gr.II, Sisteme, Aria triunghiului, Pitagora, Volum piramidă |
| 8 | Progresii, Ecuații exp/log, Teoreme sin/cos, Cilindru, Con, Sferă, Combinări |
| 7 | Modul, Vectori, Trig, Probabilitate clasică |
| 6 | Probabilitate condiționată |

---

## Structura pașilor (JSON format)

```json
[
  {
    "step": 1,
    "title": "Forma standard",
    "content": "Aduce la ax² + bx + c = 0",
    "formula": "ax^2 + bx + c = 0"
  },
  {
    "step": 2,
    "title": "Calculează Δ",
    "formula": "\\Delta = b^2 - 4ac"
  }
]
```

**Note:**
- `formula` folosește LaTeX (fără `$...$` — Claude le adaugă)
- `content` e text simplu
- Ambele sunt opționale, dar cel puțin unul trebuie prezent

---

## Structura greșelilor comune (JSON format)

```json
[
  {
    "mistake": "Uită cazul Δ < 0",
    "correction": "Dacă Δ < 0, S = ∅ (mulțimea vidă)"
  }
]
```

---

## Teste

Pentru a testa că metodologiile funcționează în chat:

1. Aplică migrarea `20260603000000_solution_methods.sql` în Supabase Studio
2. Rulează seed-ul manual
3. Validează câteva metode (toggle din admin UI)
4. Testează în chat: întreabă "Rezolvă ecuația x² - 5x + 6 = 0"
5. Verifică în logs că apare: `[chat/route] Method match: Metoda discriminantului...`

**Fără embeddings**: semantic search nu va funcționa, dar text search da.
**Cu embeddings**: rulează un script separat de generare embeddings (costă puțin la Gemini).
