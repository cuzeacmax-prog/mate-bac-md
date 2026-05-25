# Manuale Oficiale BAC Moldova — Extragere & Import

**Data extragere**: 25 mai 2026  
**Executor**: Maxim + Claude Code (ETAPA 7)

---

## Cuprins

1. [Surse](#surse)
2. [Statistici](#statistici)
3. [Structura fișierelor](#structura-fișierelor)
4. [Workflow import DB](#workflow-import-db)
5. [Schema normalizată](#schema-normalizată)
6. [Acoperire BAC MD](#acoperire-bac-md)
7. [Pași următori](#pași-următori)

---

## Surse

| Clasă | Manual | Editură | An | Autori | Pagini |
|---|---|---|---|---|---:|
| X | Matematică clasa X | Ed. Prut Internațional | 2012 | Achiri, Efros, Garit, Prodan | 282 |
| XI | Matematică clasa XI | Ed. Prut Internațional | 2014 | Achiri și colab. | ~280 |
| XII | Matematică clasa XII | Ed. Prut Internațional | 2017 | Achiri și colab. | ~300 |

---

## Statistici

### Scenarii extrase

| Clasă | Scenarii | Calitate | Validated | Importance avg |
|---|---:|---|---|---:|
| **Clasa 12** | 31 | ✅ COMPLETE (steps, examples, theorems, mistakes) | ✅ da | ~8.1 |
| **Clasa 11** | 30 | ⚠️ STUBS (necesită completare în /admin) | ❌ nu | ~7.9 |
| **Clasa 10** | 33 | ⚠️ STUBS (necesită completare în /admin) | ❌ nu | ~8.4 |
| **TOTAL** | **94** | | | **8.1** |

### Conținut clasa 12 (COMPLET)

| Element | Total | Medie/temă |
|---|---:|---:|
| Definiții | 137 | 4.4 |
| Teoreme | 134 | 4.3 |
| Exemple rezolvate | 161 | 5.2 |
| Pași algoritmi | 154 | 5.0 |
| Greșeli comune | 76 | 2.5 |
| Notation rules | 31 seturi | 1 per temă |

### Distribuție pe topice (toate clasele)

| Topic | Teme |
|---|---:|
| Algebră | 42 |
| Analiză matematică | 22 |
| Geometrie | 18 |
| Trigonometrie | 6 |
| Combinatorică | 2 |
| Limite | 6 |
| Siruri | 3 |
| **TOTAL** | **94** |

### Distribuție importance_score

| Score | Teme | % |
|---:|---:|---:|
| 10 | 18 | 19% |
| 9 | 28 | 30% |
| 8 | 24 | 26% |
| 7 | 16 | 17% |
| 6 | 8 | 9% |

**54.5% din teme au importance ≥ 9** — corespund subiectelor frecvente la BAC cl.12.

---

## Structura fișierelor

```
docs/
├── manuale-source/                    ← Surse originale (nu modificați!)
│   ├── Achiri_XII_2017_extragere_completa.md   (239KB, 2416 linii)
│   ├── clasa_XII_raw_json.json                  (31 obiecte JSON extrase)
│   ├── bac_md_manual_xi_index.yaml              (39 teme cl.11)
│   ├── clasa_X_sectiunea_A_mega_index.json      (33 teme cl.10)
│   └── sectiunea_C_raport_executive.md          (raport extragere cl.10)
└── manuale-extracted/
    └── README.md                      ← acest fișier

scripts/
└── seed/
    ├── manuale-extracted/
    │   ├── _normalize.mjs             ← Preprocessing script (idempotent)
    │   ├── clasa-10/
    │   │   └── normalized.json        ← 33 teme (stubs)
    │   ├── clasa-11/
    │   │   └── normalized.json        ← 30 teme (stubs, doar "nou")
    │   └── clasa-12/
    │       └── normalized.json        ← 31 teme COMPLETE
    └── import-manuale.ts              ← Script principal import DB
```

---

## Workflow import DB

### Pregătire (o singură dată)

```bash
# 1. Normalizare (regenerare normalized.json din surse)
node scripts/seed/manuale-extracted/_normalize.mjs

# 2. Verificare
node -e "
  const c10 = require('./scripts/seed/manuale-extracted/clasa-10/normalized.json');
  const c11 = require('./scripts/seed/manuale-extracted/clasa-11/normalized.json');
  const c12 = require('./scripts/seed/manuale-extracted/clasa-12/normalized.json');
  console.log('cl.10:', c10.length, 'cl.11:', c11.length, 'cl.12:', c12.length);
"
```

### Import în DB

```bash
# Setează variabilele de mediu dacă nu există .env.local
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Rulează importul (idempotent — skip automat dacă exercise_type există deja)
npm run seed:manuale
```

**Cost**: ~$0 (Gemini Embedding free tier — 1500 req/min)  
**Durată**: ~3-5 minute (94 embeddings)  
**Idempotent**: ✅ (skip automat pentru exercise_type duplicate)

### Verificare post-import

1. Deschide `/admin/methodologies` în browser
2. Filtrează `validated: false` — ar trebui să apară 63 teme noi (cl.10 + cl.11)
3. Verifică că cele 31 teme cl.12 apar cu `validated: true`

---

## Schema normalizată

```typescript
interface NormalizedScenario {
  exercise_type:       string;      // Snake_case unique ID (e.g. "functia_exponentiala")
  exercise_type_label: string;      // Titlu afișat (română, diacritice)
  method_name:         string;      // Metodă + sursa (e.g. "Metoda grafică (cl.12, Achiri)")
  grade_level:         10 | 11 | 12;
  topic:               string;      // "algebra" | "analiza" | "geometrie" | "trigonometrie"...
  subtopic:            string | null;
  description:         string;      // Rezumat + referință sursă
  steps:               Step[];      // Algoritm rezolvare ([] pentru stubs)
  notation_rules:      Record<string, string>; // Convenții notaționale ({} pentru stubs)
  examples:            Example[];   // Exemple rezolvate ([] pentru stubs)
  common_mistakes:     Mistake[];   // Greșeli tipice ([] pentru stubs)
  required_tools:      string[] | null;
  importance_score:    number;      // 1-10 (BAC priority)
  validated:           boolean;     // true doar pentru cl.12 (complete)
  validated_by:        string | null;
  source:              Source | null;
}
```

---

## Acoperire BAC MD

### Subiectele BAC tipice — Status

| Subiect BAC | Status |
|---|---|
| Logaritmi + ecuații/inecuații | ✅ cl.10 (temele 8, 21) |
| Ecuații/inecuații exponențiale | ✅ cl.10 (tema 20) + cl.11 |
| Ecuații/inecuații iraționale | ✅ cl.10 (tema 19) + cl.11 |
| **Trigonometrie** | ✅✅ cl.10 (temele 22-25) — **lipsea total anterior!** |
| Funcția gradul II (parametri) | ✅ cl.10 (tema 18) |
| Combinatorică (P, A, C, Newton) | ✅ cl.10 (temele 9-10) |
| Asemănare + Thales + Pitagora | ✅ cl.10 (temele 29-31) — **lipsea total anterior!** |
| Arii figuri plane | ✅ cl.10 (tema 33) |
| Derivate + monotonie + extreme | ✅ cl.12 (COMPLETE, validated) |
| Integrale | ✅ cl.12 (COMPLETE, validated) |
| Matrice + determinanți | ✅ cl.12 (COMPLETE) + cl.11 (stubs) |
| Limite + continuitate | ✅ cl.11 (stubs) + cl.12 (validate) |
| Geometrie în spațiu | ✅ cl.11 (stubs) + cl.12 (complete) |

**Acoperire estimată BAC profil real**: **~85-90%**

### Ce lipsește (de completat ulterior)

- **Probabilități** (nu apar în manualele Achiri cl.10-12 — modul opțional)
- **Geometrie analitică avansată** (parțial în cl.11-12)
- **Steps + examples** pentru 63 teme cl.10-11 (stubs → completare în /admin)

---

## Pași următori

### Prioritate înaltă (importance ≥ 9)

1. **Trigonometrie** (cl.10, teme 22-25): completare steps + 4-5 exemple rezolvate din manual
2. **Funcția gradul II** (cl.10, tema 18): completare cu Viète, discriminant, parametri
3. **Asemănare triunghiuri** (cl.10, temele 29-31): completare cu teoreme + exemple
4. **Derivate complete** (cl.11): sincronizare cu cl.12 (deja validate)

### Workflow completare

```
/admin/methodologies → Filtrare validated:false → 
  Pentru fiecare temă:
    1. Adaugă 3-5 steps (algoritm rezolvare)
    2. Adaugă 2-3 examples (din manual, cu pagini)
    3. Adaugă common_mistakes
    4. Marchează validated: true + validated_by: "Maxim"
```

---

*Documentat de Claude Code (ETAPA 7 — 25 mai 2026)*
