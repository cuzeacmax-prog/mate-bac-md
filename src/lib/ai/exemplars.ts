/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REVIZUIRE UMANĂ OBLIGATORIE — Maxim taie/aprobă 2-3 din cele 5          ║
 * ║  candidate de mai jos. PÂNĂ la aprobare (status: 'pending') NICIUNUL     ║
 * ║  nu intră în prompt. După aprobare: schimbă status în 'approved' —       ║
 * ║  approvedExemplarsBlock() le include în prefixul STATIC cache-uit        ║
 * ║  (cost marginal ~0, stilul de redactare ancorat).                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * exemplars.ts — ETAPA 75 FAZA G: ETALOANELE DE BAREM.
 *
 * Sursa: exclusiv exerciții VERIFICATE CAS din bibliotecă (exercise_verification,
 * verified=true), cu rezultatul calculat de CAS — enunțul și răspunsul NU sunt
 * inventate (R5). Redactarea îmi aparține și urmează regulile sacre BAC MD:
 * domeniu/DVA unde există, pași numerotați cu „De ce/Cum", verificare, R: final.
 *
 * NOTĂ ONESTĂ (abatere de la spec): pool-ul verificat CAS de azi acoperă DOAR
 * integrale (cas_sympy_integral/definite/area_volume/rotation_volume/
 * verify_primitive) — nu există încă ecuații cu DVA sau geometrie cu figură
 * VERIFICATE. Cele 5 candidate sunt diverse ÎN INTERIORUL clasei verificate
 * (părți duble, substituție, fracții simple, corp de rotație, radical compus);
 * candidate din alte clase se adaugă când CAS le acoperă.
 */

export type ExemplarStatus = 'pending' | 'approved' | 'rejected';

export interface BaremExemplar {
  /** id-ul exercițiului din exercise_raw (verificat CAS) */
  exerciseId: string;
  titlu: string;
  status: ExemplarStatus;
  /** enunțul EXACT din bibliotecă */
  enunt: string;
  /** rezultatul verificat de CAS (computed_latex) — ancora de corectitudine */
  rezultatCas: string;
  /** redactarea-etalon, stil barem BAC MD */
  redactare: string;
}

export const BAREM_EXEMPLARS: BaremExemplar[] = [
  {
    exerciseId: '179ade80-e0a9-42e2-9447-3ee07cd15fc0',
    titlu: 'Integrală definită — integrare prin părți (de două ori)',
    status: 'pending',
    enunt: '$\\int_{0}^{\\pi} e^x \\cdot \\sin x \\, dx$.',
    rezultatCas: '\\frac{1}{2} + \\frac{e^{\\pi}}{2}',
    redactare: `📋 PASUL 1 — Notăm integrala și alegem metoda
De ce: Produsul $e^x \\sin x$ nu are primitivă imediată — integrarea prin părți este metoda standard.
Cum: Fie $I = \\int_{0}^{\\pi} e^x \\sin x \\, dx$. Alegem $u = \\sin x$, $dv = e^x dx$, deci $du = \\cos x \\, dx$, $v = e^x$.
✦ $I = \\left. e^x \\sin x \\right|_{0}^{\\pi} - \\int_{0}^{\\pi} e^x \\cos x \\, dx$

📋 PASUL 2 — Aplicăm părțile a doua oară
De ce: Noua integrală are aceeași structură — după a doua aplicare reapare $I$ și obținem o ecuație.
Cum: Cu $u = \\cos x$, $dv = e^x dx$: $\\int_{0}^{\\pi} e^x \\cos x \\, dx = \\left. e^x \\cos x \\right|_{0}^{\\pi} + I = (-e^{\\pi} - 1) + I$.
✦ $I = (0 - 0) - (-e^{\\pi} - 1) - I \\iff 2I = e^{\\pi} + 1$

📋 PASUL 3 — Rezolvăm ecuația în $I$
Cum: $I = \\dfrac{e^{\\pi} + 1}{2}$

📋 VERIFICARE
$e^{\\pi} > 0$, deci $I > 0$ — consistent: pe $[0; \\pi]$, $\\sin x \\geq 0$ și $e^x > 0$, deci integrala unei funcții nenegative e nenegativă. ✓ (rezultat confirmat CAS)

📋 R: $I = \\dfrac{1 + e^{\\pi}}{2}$

**Capcana la BAC:** la a doua integrare prin părți, păstrează aceeași convenție de alegere ($u$ = funcția trigonometrică) — inversarea o anulează pe prima și obții identitatea $I = I$.`,
  },
  {
    exerciseId: '03ee1511-a508-42fa-bcf4-650c070810c6',
    titlu: 'Integrală nedefinită — substituție cu discuția domeniului',
    status: 'pending',
    enunt: '$\\int \\dfrac{1 + \\cos x}{x + \\sin x}dx$.',
    rezultatCas: '\\log{\\left(x + \\sin{\\left(x \\right)} \\right)}',
    redactare: `📋 PASUL 1 — Stabilim domeniul
De ce: Numitorul nu poate fi 0 — integrandul e definit doar unde $x + \\sin x \\neq 0$.
Cum: Funcția $g(x) = x + \\sin x$ are $g'(x) = 1 + \\cos x \\geq 0$ și se anulează doar în $x = 0$, deci lucrăm pe intervale care nu conțin $0$.
✦ Domeniu: $x + \\sin x \\neq 0$

📋 PASUL 2 — Recunoaștem structura $\\frac{g'(x)}{g(x)}$
De ce: Numărătorul $1 + \\cos x$ este EXACT derivata numitorului — formula $\\int \\frac{g'(x)}{g(x)}dx = \\ln|g(x)| + C$.
Cum: Cu $t = x + \\sin x$, $dt = (1 + \\cos x)dx$: $\\int \\dfrac{dt}{t} = \\ln|t| + C$.

📋 VERIFICARE
$\\left( \\ln|x + \\sin x| \\right)' = \\dfrac{1 + \\cos x}{x + \\sin x}$ ✓ (rezultat confirmat CAS)

📋 R: $\\int \\dfrac{1 + \\cos x}{x + \\sin x}dx = \\ln|x + \\sin x| + C$

**Capcana la BAC:** nu uita modulul în $\\ln|x + \\sin x|$ și constanta $+C$ — ambele se punctează separat în barem.`,
  },
  {
    exerciseId: '5e7f1ff7-c28b-4a08-aa5f-175df1b44a68',
    titlu: 'Volumul corpului de rotație (BAC 2001, profil real)',
    status: 'pending',
    enunt: 'Calculați volumul corpului de rotație determinat de funcția $f(x)=-x^2+4x$, dacă $x\\in[0;2]$',
    rezultatCas: '\\frac{256 \\pi}{15}',
    redactare: `📋 PASUL 1 — Scriem formula volumului de rotație
De ce: Corpul obținut prin rotirea subgraficului lui $f$ în jurul axei $Ox$ are volumul dat de formula standard.
Cum: $V = \\pi \\int_{0}^{2} f^2(x)\\,dx = \\pi \\int_{0}^{2} (-x^2 + 4x)^2\\,dx$

📋 PASUL 2 — Dezvoltăm pătratul
Cum: $(-x^2 + 4x)^2 = x^4 - 8x^3 + 16x^2$
✦ $V = \\pi \\int_{0}^{2} (x^4 - 8x^3 + 16x^2)\\,dx$

📋 PASUL 3 — Integrăm termen cu termen
Cum: $V = \\pi \\left[ \\dfrac{x^5}{5} - 2x^4 + \\dfrac{16x^3}{3} \\right]_{0}^{2} = \\pi \\left( \\dfrac{32}{5} - 32 + \\dfrac{128}{3} \\right)$

📋 PASUL 4 — Aducem la numitor comun
Cum: $\\dfrac{96 - 480 + 640}{15} = \\dfrac{256}{15}$

📋 VERIFICARE
$f(x) = -x^2 + 4x = x(4 - x) \\geq 0$ pe $[0; 2]$, deci rotația e bine definită și $V > 0$. ✓ (rezultat confirmat CAS)

📋 R: $V = \\dfrac{256\\pi}{15}$ u.c.

**Capcana la BAC:** formula cere $f^2(x)$, nu $f(x)$ — uitarea pătratului e cea mai frecventă greșeală; și nu omite $\\pi$ și unitățile cubice (u.c.).`,
  },
  {
    exerciseId: '5dcc6ba1-5384-4255-b21d-7be9a0edfb4b',
    titlu: 'Integrală nedefinită — fracții simple după extragerea părții întregi',
    status: 'pending',
    enunt: '$\\int \\dfrac{x^2}{x^2 - 9}dx$.',
    rezultatCas: 'x + \\frac{3 \\log{\\left(x - 3 \\right)}}{2} - \\frac{3 \\log{\\left(x + 3 \\right)}}{2}',
    redactare: `📋 PASUL 1 — Stabilim domeniul
De ce: Numitorul $x^2 - 9 = (x-3)(x+3)$ se anulează în $x = \\pm 3$.
✦ Domeniu: $x \\in \\R \\setminus \\{-3; 3\\}$ (pe fiecare interval separat)

📋 PASUL 2 — Extragem partea întreagă a fracției
De ce: Gradul numărătorului = gradul numitorului — împărțim întâi.
Cum: $\\dfrac{x^2}{x^2 - 9} = 1 + \\dfrac{9}{x^2 - 9}$

📋 PASUL 3 — Descompunem în fracții simple
Cum: $\\dfrac{9}{(x-3)(x+3)} = \\dfrac{A}{x-3} + \\dfrac{B}{x+3}$; din $9 = A(x+3) + B(x-3)$: la $x=3$, $A = \\dfrac{3}{2}$; la $x=-3$, $B = -\\dfrac{3}{2}$.

📋 PASUL 4 — Integrăm termen cu termen
Cum: $\\int 1\\,dx + \\dfrac{3}{2}\\int \\dfrac{dx}{x-3} - \\dfrac{3}{2}\\int \\dfrac{dx}{x+3} = x + \\dfrac{3}{2}\\ln|x-3| - \\dfrac{3}{2}\\ln|x+3| + C$

📋 VERIFICARE
Derivăm: $1 + \\dfrac{3/2}{x-3} - \\dfrac{3/2}{x+3} = 1 + \\dfrac{9}{x^2-9} = \\dfrac{x^2}{x^2-9}$ ✓ (rezultat confirmat CAS)

📋 R: $x + \\dfrac{3}{2}\\ln\\left|\\dfrac{x-3}{x+3}\\right| + C$

**Capcana la BAC:** nu descompune direct în fracții simple când gradul de sus ≥ gradul de jos — întâi împărțirea; altfel coeficienții ies greșiți.`,
  },
  {
    exerciseId: '96626496-6189-4b3b-81ec-2d26aa0e38b2',
    titlu: 'Integrală definită — radical compus, substituție liniară',
    status: 'pending',
    enunt: '$\\int_{1/2}^{3} \\sqrt{4x-2}\\,dx$.',
    rezultatCas: '\\frac{5 \\sqrt{10}}{3}',
    redactare: `📋 PASUL 1 — Verificăm domeniul pe intervalul de integrare
De ce: Radicalul cere $4x - 2 \\geq 0 \\iff x \\geq \\dfrac{1}{2}$.
✦ Pe $\\left[\\dfrac{1}{2}; 3\\right]$ integrandul e definit; în capătul stâng radicalul e $0$.

📋 PASUL 2 — Integrăm cu formula puterii (substituție liniară)
De ce: $\\int (ax+b)^{1/2}dx = \\dfrac{(ax+b)^{3/2}}{a \\cdot \\frac{3}{2}} + C$.
Cum: $\\int \\sqrt{4x-2}\\,dx = \\dfrac{(4x-2)^{3/2}}{6} + C$

📋 PASUL 3 — Aplicăm Leibniz–Newton
Cum: $\\left. \\dfrac{(4x-2)^{3/2}}{6} \\right|_{1/2}^{3} = \\dfrac{10^{3/2}}{6} - 0 = \\dfrac{10\\sqrt{10}}{6} = \\dfrac{5\\sqrt{10}}{3}$

📋 VERIFICARE
$\\left( \\dfrac{(4x-2)^{3/2}}{6} \\right)' = \\dfrac{3}{2} \\cdot \\dfrac{4}{6}(4x-2)^{1/2} = \\sqrt{4x-2}$ ✓ (rezultat confirmat CAS)

📋 R: $\\dfrac{5\\sqrt{10}}{3}$

**Capcana la BAC:** la substituția liniară nu uita împărțirea la coeficientul $a = 4$ — fără ea rezultatul iese de 4 ori mai mare.`,
  },
];

/**
 * Blocul de prompt cu etaloanele APROBATE — gol cât timp totul e 'pending'.
 * Se concatenează în prefixul STATIC (cache-uit) al prompturilor de chat,
 * DOAR după aprobarea lui Maxim.
 */
export function approvedExemplarsBlock(): string {
  const approved = BAREM_EXEMPLARS.filter((e) => e.status === 'approved');
  if (approved.length === 0) return '';
  return `\n\nETALOANE DE REDACTARE BAREM (verificate CAS, aprobate de profesor — imită STILUL lor):\n${approved
    .map((e) => `--- ${e.titlu} ---\nEnunț: ${e.enunt}\n${e.redactare}`)
    .join('\n\n')}`;
}
