# ETAPA 83 FAZA B — Paleta albastru-negru completă (inventar)

> Un singur sistem de tokeni în `src/app/globals.css`. Schimbarea VALORILOR
> tokenilor propagă peste tot prin utilitarele Tailwind (`bg-background`,
> `bg-card`, `bg-primary`, `text-foreground`…) — fără a atinge sute de fișiere.

## Paleta nouă (anchore)
| Token | Valoare | Rol |
|---|---|---|
| `--bg-black` | `#05060c` | negru de bază |
| `--bg-night` | `#131936` | fundalul principal al aplicației |
| `--bg-deep` | `#001D51` | suprafață albastră profundă (hartă, accente) |
| `--bg-electric` | `#3B82F6` | **al treilea albastru: electric** (accente/gradiente) |
| `--text-on-deep` | `oklch(0.97 …)` | text deschis pe fundaluri închise |

## Tokeni de chrome re-pointați (violet/lime „energic-modern" → albastru-electric)
- `--background` → albastru-noapte; `--card`/`--popover`/`--muted` → navy elevat;
- `--primary` + `--ring` + `--chart-1` → **albastru electric** (#3B82F6); `--accent` → albastru-cyan;
- `--secondary` → albastru profund; `--sidebar*` → asortat;
- `--orb-1..4` (LivingBackdrop) → familia albastră (electric→indigo→cyan→navy), nu violet/roz/lime;
- `--math-surface` → navy solid (regula SACRĂ: math aproape-alb pe suprafață solidă, neatinsă);
- păstrate funcțional: `--destructive`, `--success*`, `--danger*`; nou: `--warning*` (ambră, ca token).

## Contrast — FIECARE pereche verificată (`scripts/verify/etapa83-contrast.ts`)
**37/37 perechi trec WCAG** (parser oklch + hex + rezolvă `var()`):
- text principal/fundal **16.0:1** (AAA), math/fundal **17.0:1**, math/suprafață **18.0:1**;
- text pe buton electric **5.32:1** (AA), accent **7.95:1**, secundar **11.2:1**;
- text deschis pe #001D51 **14.9:1**, pe #131936 **15.8:1**, pe negru **18.6:1**;
- text pe #3B82F6 electric **5.35:1** (AA); cele 7 domenii **≥6.5:1**.
- `etapa70-contrast` (acceptanțele 60-82) rămâne **verde** (zero regresie).

## Inventar culori hardcodate (onestitate)
- **Chrome brand (student): 0 hardcodate** — totul prin tokeni albastru-negru.
- **Feedback semantic (onboarding): migrat la tokeni** — diagnostic (corect/greșit/dificil),
  trial (streak), plan (niveluri prioritate) → `success/danger/warning/secondary`.
- **Rămase (raportate, NU brand):**
  - `src/components/chat/{VerificationBadge,VoicePlayer,InlineMiniChat}.tsx` — badge-uri
    de feedback verde/ambru/roșu cu variante `dark:` (deja adaptive); migrare la tokeni — follow-up.
  - `src/app/admin/**` (~1079 utilitare) — **temă LIGHT internă a operatorului**, intenționat
    separată de paleta elevului; în afara scopului FAZA B.
  - SVG de figuri (`src/lib/figures`, `src/components/figures`) — **culori de conținut
    matematic** (corectitudine sacră), nu paletă de brand.
