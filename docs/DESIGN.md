# DESIGN „GLASS DARK" — sursa unică de adevăr (ETAPA 73 → 74)

Identitate vizuală v2, pe referința aprobată de Maxim (stil gizmo.ai):
dark + panouri glass + orb-uri gradient + controale pilulă.
ETAPA 74 a PRESCRIS arta tehnică-cu-tehnică (după respingerea „dark mode plat"):
fundal viu pe 3 straturi, glass real cu inner glow, hartă luminoasă,
registru central de animații per eveniment, micro-viață.
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

## 8. ETAPA 74 — arta prescrisă

- **Fundalul viu** (`LivingBackdrop`, în layout-urile /app și /onboarding,
  fixed -z-10): (1) bază = gradient radial dublu static (violet 8% stânga-sus,
  indigo 6% dreapta-jos); (2) 3 orburi 42-55vw, radial-gradient
  (violet→roz / lime→teal prin `--orb-1..4`), blur 80px, opacity 0.25-0.35,
  drift 42-58s; (3) 10 glife matematice (∫ π Σ √ ∞ θ ± Δ ∂ lim) la
  opacity 0.04-0.07, 40-120px, drift 50-90s pe 4 trasee desincronizate.
  Toate DOAR transform/opacity. ATENȚIE (defect dovedit): NICIUN fundal opac
  (`bg-background`) pe un strămoș al backdrop-ului — îl acoperă (-z pictează
  sub fundalul părintelui). Reduced-motion → totul static.
- **Glass real**: `.glass-1/2/3` cu blur 16/20/24px + inner glow
  (`inset 0 1px 0 alb ~10%`); hover spre accent DOAR cu `.glass-hover`.
  **`.glass-solid`** = suprafață opacă (--card) cu rama glass — OBLIGATORIE
  sub carduri cu matematică (REGULA SACRĂ: zero blur sub formule).
- **Harta luminează**: noduri r=30 cu radial-gradient pe culoarea domeniului
  + halo (radial-gradient, NU filter blur — perf 72), disponibil = halo
  pulsând (max 15), muchii cu gradient de la nodul-sursă (w=1.5), spălare
  de culoare a domeniului (6-8%) sub cluster, etichete 12px alb 70% pe pill
  (`--map-label-fg/bg`).
- **Registrul de feedback** (`src/lib/motion/feedback.ts`): evenimentele
  corect / greșit / indiciu / lectie-completa / streak / concept-stapanit →
  O SINGURĂ definiție per eveniment; componentele cheamă `playFeedback()`,
  NICIODATĂ animații ad-hoc. Lecția completă emite `mate:backdrop-boost`
  (orbii se intensifică 2s). Reduced-motion → doar schimbări de culoare.
- **Micro-viață**: `.btn-living` (gradient animat lent pe hover, pe butonul
  primar), `.progress-shimmer` (bara de progres a lecției), empty-state-urile
  primesc `.empty-orb` + glife (chat gol).

## 9. ETAPA 76 — cerul Skyrim pe hartă

Referința aprobată: ecranul de skill-uri din Skyrim (constelații pe nebuloasă).
- **Cerul** (`SkyBackdrop`, static sub SVG — nu se re-randează la pan):
  nebuloasă din gradiente radiale în culoarea domeniului ACTIV (cross-fade
  0.7s la comutare), zgomot feTurbulence 5%, 110 stele deterministe (1-2px,
  ~18% cu `star-twinkle` desincronizat), sigiliul domeniului (`.sky-seal`,
  36vh, opacity 0.07 — fade-ul are keyframes PROPRII care se opresc la 0.07;
  defect dovedit: clasa generică de fade îl ducea la opacity 1).
- **Nodurile = stele**: halo radial-gradient, raze de difracție (4) pe
  stăpânite, mărimi pe importanță (3 trepte după exercițiile servibile:
  r 22/28/34).
- **Drumul de quest** (`.quest-edge`): lanțul ultimul-stăpânit → recomandat →
  următoarele 2 (frontier_concepts, determinist) — dash animat care CURGE în
  direcția înaintării; restul muchiilor stinse (0.15). Nodul recomandat =
  halo dublu pulsând + eticheta „⭐ Următorul". Pan automat blând la deschidere
  (o dată), tween rAF — NU CSS pe transformul SVG (perf 72 sacru).
- **Clase**: layout v2 per domeniu×clasă (dagre BT, fundament jos; ranker ales
  scriptat după minimul de încrucișări — 42→23 total); selector 9-12 cu
  dezactivare onestă; portaluri cross-grade pe prerechizite (🌀 + breadcrumb).
- **Vederea**: fit-to-view cu clamp jos la scale 0.45 (constelațiile înalte nu
  devin puncte); fit animat la comutarea domeniului/clasei.
