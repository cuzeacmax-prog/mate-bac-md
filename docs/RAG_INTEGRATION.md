# Integrarea RAG în Chat

## Cum funcționează

Fiecare mesaj al utilizatorului trece printr-un lookup în biblioteca de exerciții
**înainte** de a apela modelul Sonnet. Dacă există un exercițiu similar, răspunsul
vine din bibliotecă (mai rapid, mai ieftin).

```
Mesaj utilizator
    │
    ▼
Gemini embed query (1536d, RETRIEVAL_QUERY)
    │
    ▼
match_exercises RPC (cosine similarity pe solved_exercises)
    │
    ├── similarity ≥ 0.85 → răspuns DIRECT din bibliotecă (zero Sonnet cost)
    │                        SSE: { text: solution, source: "library" }
    │
    ├── 0.65–0.85 → context injectat în system prompt Sonnet
    │               SSE: normal (text chunks de la Sonnet)
    │
    └── < 0.65 sau RPC lipsă → Sonnet normal
                               + INSERT gap_analysis (pentru viitor batch)
```

## Praguri de similaritate

| Prag | Comportament | Modificare |
|---|---|---|
| `RAG_DIRECT_THRESHOLD = 0.85` | Răspuns direct (no AI) | `src/app/api/chat/route.ts:L14` |
| `RAG_CONTEXT_THRESHOLD = 0.65` | Context adăugat | `src/app/api/chat/route.ts:L15` |

## Graceful fallback

Dacă Gemini key lipsește sau RPC-ul nu e aplicat, chat-ul continuă normal fără eroare.
- Gemini key lipsă: `lookupLibrary` returnează `{ match: null, embedding: null }` imediat.
- RPC lipsă (cod `42883`): returnat `{ results: [], warning: "..." }` din `/api/search/library`.

## Pregătire pentru RAG activ

1. Rulează batch generator: `npm run batch:test` (validare), apoi `npm run batch:full`
2. Aplică migrarea RPC: `npm run db:apply-rpc` → urmărește instrucțiunile afișate
3. Verifică: `SELECT COUNT(*) FROM solved_exercises WHERE reviewed_by_admin = true;`

## Gap analysis

Interogările fără match bun sunt salvate în `gap_analysis` cu:
- `query`: textul mesajului
- `query_embedding`: vectorul de 1536 dimensiuni
- `user_id`, `conversation_id`, `max_similarity_found`

Adminul poate vedea aceste goluri și poate adăuga exerciții noi pentru a le acoperi.
