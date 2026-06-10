# DESIGN „GLASS DARK" — sursa unică de adevăr (ETAPA 73)

Identitate vizuală v2, pe referința aprobată de Maxim (stil gizmo.ai):
dark + panouri glass + orb-uri gradient + controale pilulă.
**REGULA SACRĂ: matematica = lizibilitate maximă.** Frumusețea e în ramă,
claritatea în conținut: text aproape-alb pe închis, KaTeX moștenește culoarea,
formulele la 1.05em, contrast AA pe TOATE perechile (poartă scriptată),
NICIODATĂ glass/blur sub formule — matematica stă pe suprafață solidă.

## 1. Suprafețe (elevație prin glass, nu umbre grele)

| Token | Valoare | Rol |
|---|---|---|
| `--background` | `oklch(0.16 0.025 260)` | fundal bază — albastru-cărbune, NU negru pur |
| `--glass-1` | `rgba(255,255,255,0.04)` + blur 12px + bordură `rgba(255,255,255,0.08)` | panou de nivel 1 (carduri liste) |
| `--glass-2` | `rgba(255,255,255,0.07)` + blur 16px + bordură `rgba(255,255,255,0.12)` | nivel 2 (carduri active, sheet) |
| `--glass-3` | `rgba(255,255,255,0.11)` + blur 20px + bordură `rgba(255,255,255,0.16)` | nivel 3 (modale, popover) |
| `--card` | `oklch(0.205 0.03 260)` | suprafață SOLIDĂ (sub matematică, tabele) |
| `--math-surface` | `oklch(0.14 0.02 260)` | suprafața formulelor display — solidă, mai închisă |

Clasele utilitare: `.glass-1/.glass-2/.glass-3` (bg+blur+bordură împreună,
nu se compun manual). Blur NICIODATĂ sub `.katex` sau `.figura-bac`.

## 2. Culoare

- **Accent interactiv**: violet electric `--primary: oklch(0.65 0.21 295)`,
  text pe el `oklch(0.13 0.02 260)`? NU — text aproape-alb `oklch(0.985 0.01 260)`
  (verificat AA de poartă). Hover: +0.05 L.
- **Orbul gradient** (fundal ecrane-cheie, AnimatedBackdrop v2): violet
  `oklch(0.55 0.25 295)` → roz `oklch(0.65 0.24 350)` → lime `oklch(0.85 0.20 130)`,
  blur mare, opacitate 0.13–0.25, doar transform/opacity (regulile ETAPA 70/72).
- **Culorile de domeniu (7)**: variantele dark deja calibrate (ETAPA 71 `.dark`)
  devin SINGURELE: nuanță L≈0.70, fundal L≈0.27 tentat, text L≈0.88 tentat.
- **Feedback**: success/danger pe variantele dark existente.
- **Matematica**: `--math-fg: oklch(0.97 0.005 260)` — aproape-alb, monocrom.

## 3. Tipografie

- **Font**: Manrope variabil prin `next/font` (`--font-manrope`), expus în
  tokens ca `--font-sans: var(--font-manrope), ui-sans-serif, system-ui, sans-serif`.
  DEFECTUL DOVEDIT al temei vechi: `globals.css` avea `--font-sans: var(--font-sans)`
  (autoreferință circulară) → titlurile cădeau pe serif de sistem. INTERZIS
  orice token autoreferențial; poarta vizuală verifică computed font-family.
- **Scara**: display 30/700, h1 24/700, h2 18/600, body 14-15/400, caption 12/400.
  Greutăți folosite: 400/600/700 (Manrope variabil le acoperă).
- **Formulele KaTeX**: 1.05em față de textul-gazdă (`.katex { font-size: 1.05em }`).

## 4. Forme & spațiere

- Controale = **pilule** (`rounded-full`): butoane, tab-uri, chips, lentile.
- Carduri rotunjite generos: 16px (`rounded-2xl`) – 24px (`rounded-3xl`).
- Spațiere pe ritm de 4/8: padding 16/20/24, gap 8/12/16 — nimic în afara grilei.

## 5. Mișcare

Regulile ETAPA 70 rămân: 3 viteze (0.15/0.28/0.45s), spring-uri standard,
`prefers-reduced-motion` global, orb-urile doar transform/opacity (GPU),
pan/zoom pe hartă prin rAF + ref (ETAPA 72 — NU se atinge).

## 6. INTERZISE

1. Alb pur (`#fff`) pe negru pur (`#000`) — întotdeauna tente.
2. Borduri gri 1px opace (ca tema veche) — doar borduri translucide.
3. Culori în afara tokens (niciun hex/oklch în componente).
4. Serif oriunde (poarta vizuală verifică computed style).
5. Glass/blur sub formule sau figuri — matematica pe suprafață solidă.
6. Light mode în v1 — dark e tema implicită și SINGURA (decizie asumată;
   light post-lansare).

## 7. Componente de bază (FAZA B)

`GlassPanel` (nivel 1-3), `PillButton` (primar/secundar/ghost),
`PillTab`, `StatCard` (cifră+etichetă pe glass), `Sidebar` v2 (glass,
iconuri, starea activă luminoasă cu accent + pill indicator).
