/**
 * scripts/seed/methodologies-seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Seed cu 30 metode de rezolvare BAC MD (FĂRĂ AI — conținut pedagogic manual)
 *
 * IMPORTANT: NU rula automat. Rulează MANUAL:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed/methodologies-seed.ts
 *
 * Necesită: SUPABASE_SERVICE_ROLE_KEY în .env.local
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServiceClient } from '../../src/lib/supabase/service';

interface MethodSeed {
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  grade_level: number;
  topic: string;
  subtopic?: string;
  description?: string;
  steps: Array<{ step: number; title: string; content?: string; formula?: string }>;
  notation_rules?: Record<string, string>;
  required_elements?: string[];
  forbidden_shortcuts?: string[];
  examples?: Array<{ problem: string; solution: string[]; answer: string }>;
  common_mistakes?: Array<{ mistake: string; correction: string }>;
  required_tools?: string[];
  difficulty?: number;
  importance_score?: number;
  validated?: boolean;
}

const METHODS: MethodSeed[] = [
  // ── ALGEBRĂ ──────────────────────────────────────────────────────────────────

  {
    exercise_type: 'ecuatie_gradul_2',
    exercise_type_label: 'Ecuație de gradul II',
    method_name: 'Metoda discriminantului cu verificare Viète',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'ecuatii',
    description: 'Metoda standard BAC MD pentru ecuații de gradul II. Obligatoriu se calculează Δ, se discută cazurile, se scrie S = {x₁, x₂} și se verifică cu sumă/produs Viète.',
    steps: [
      { step: 1, title: 'Forma standard', content: 'Aduce ecuația la forma ax² + bx + c = 0', formula: 'ax^2 + bx + c = 0' },
      { step: 2, title: 'Calculează Δ', content: 'Discriminantul determină natura rădăcinilor', formula: '\\Delta = b^2 - 4ac' },
      { step: 3, title: 'Discută cazurile', content: 'Δ > 0: două rădăcini reale; Δ = 0: o rădăcină; Δ < 0: S = ∅' },
      { step: 4, title: 'Calculează rădăcinile', content: 'Dacă Δ ≥ 0', formula: 'x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}' },
      { step: 5, title: 'Verificare Viète', content: 'Obligatoriu în BAC MD', formula: 'x_1 + x_2 = -\\frac{b}{a},\\quad x_1 \\cdot x_2 = \\frac{c}{a}' },
      { step: 6, title: 'Scrie soluția', content: 'Format obligatoriu BAC MD', formula: 'S = \\{x_1, x_2\\}' },
    ],
    notation_rules: { delta: 'Δ', solution_set: 'S = {…}', final: 'R: x₁ = …, x₂ = …' },
    required_elements: ['calculul Δ', 'discutarea cazurilor', 'formula x₁,₂', 'verificarea Viète', 'scrierea S = {…}'],
    forbidden_shortcuts: ['formula Viète fără a scrie Δ', 'răspuns fără S={…}'],
    common_mistakes: [
      { mistake: 'Uită cazul Δ < 0', correction: 'Dacă Δ < 0, S = ∅ (mulțimea vidă)' },
      { mistake: 'Scrie x = … fără S = {…}', correction: 'Format obligatoriu: S = {x₁, x₂}' },
    ],
    difficulty: 2,
    importance_score: 10,
    validated: true,
  },

  {
    exercise_type: 'sistem_ecuatii_2x2',
    exercise_type_label: 'Sistem 2×2 ecuații liniare',
    method_name: 'Metoda substituției (BAC MD)',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'sisteme',
    description: 'Rezolvarea sistemelor 2×2 prin substituție — metodă preferată la BAC MD clasa 10.',
    steps: [
      { step: 1, title: 'Extrage o necunoscută', content: 'Din ecuația mai simplă, exprimă x sau y' },
      { step: 2, title: 'Substituie', content: 'Înlocuiește în cealaltă ecuație' },
      { step: 3, title: 'Rezolvă ecuația în o necunoscută' },
      { step: 4, title: 'Găsește cealaltă necunoscută', content: 'Substituie valoarea găsită' },
      { step: 5, title: 'Verifică în ambele ecuații originale' },
      { step: 6, title: 'Scrie soluția', formula: 'S = \\{(x_0, y_0)\\}' },
    ],
    required_elements: ['substituție explicită', 'verificare în ambele ecuații', 'S = {(x₀,y₀)}'],
    difficulty: 2,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'inecuatie_gradul_2',
    exercise_type_label: 'Inecuație de gradul II',
    method_name: 'Metoda graficului parabolei',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'inecuatii',
    description: 'Rezolvare inecuații de gradul II prin analiza semnului trinomului. Obligatoriu: schiță parabolă, discutarea cazurilor după Δ și a.',
    steps: [
      { step: 1, title: 'Forma standard', content: 'ax² + bx + c < 0 (sau >, ≤, ≥)' },
      { step: 2, title: 'Calculează Δ', formula: '\\Delta = b^2 - 4ac' },
      { step: 3, title: 'Găsește rădăcinile (dacă Δ ≥ 0)', formula: 'x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}' },
      { step: 4, title: 'Analizează semnul', content: 'a > 0: parabola sus → ax²+bx+c < 0 pentru x ∈ (x₁,x₂)' },
      { step: 5, title: 'Scrie soluția în interval', formula: 'S = (x_1, x_2)' },
    ],
    notation_rules: { intervals: 'interval deschis () sau închis []', union: '∪' },
    required_elements: ['calculul Δ', 'rădăcinile (dacă există)', 'analiza semnului', 'soluție în interval'],
    common_mistakes: [
      { mistake: 'Confundă intervalul deschis cu cel închis', correction: 'Verifică dacă inecuația e strictă (<, >) sau largă (≤, ≥)' },
    ],
    difficulty: 3,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'progresie_aritmetica',
    exercise_type_label: 'Progresie aritmetică',
    method_name: 'Formulele progresiei aritmetice BAC MD',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'progresii',
    description: 'Aplicarea sistematică a formulelor pentru termenul general și suma primilor n termeni.',
    steps: [
      { step: 1, title: 'Identifică a₁ și r (rația)', content: 'r = a₂ - a₁ = constant' },
      { step: 2, title: 'Formula termenului general', formula: 'a_n = a_1 + (n-1) \\cdot r' },
      { step: 3, title: 'Formula sumei', formula: 'S_n = \\frac{n(a_1 + a_n)}{2} = \\frac{n(2a_1 + (n-1)r)}{2}' },
      { step: 4, title: 'Scrie răspunsul complet' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'progresie_geometrica',
    exercise_type_label: 'Progresie geometrică',
    method_name: 'Formulele progresiei geometrice BAC MD',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'progresii',
    steps: [
      { step: 1, title: 'Identifică a₁ și q (rația)', content: 'q = a₂/a₁ ≠ 0' },
      { step: 2, title: 'Formula termenului general', formula: 'a_n = a_1 \\cdot q^{n-1}' },
      { step: 3, title: 'Suma primilor n termeni', formula: 'S_n = \\frac{a_1(q^n - 1)}{q - 1},\\; q \\neq 1' },
      { step: 4, title: 'Cazul q = 1', formula: 'S_n = n \\cdot a_1' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'modul_inecuatie',
    exercise_type_label: 'Inecuație cu modul',
    method_name: 'Desfacerea modulului (BAC MD)',
    grade_level: 11,
    topic: 'algebra',
    subtopic: 'modul',
    steps: [
      { step: 1, title: 'Identifică expresia din modul', content: 'f(x) = expresia' },
      { step: 2, title: 'Cazul |f(x)| < a', content: 'Echivalent cu -a < f(x) < a', formula: '-a < f(x) < a' },
      { step: 3, title: 'Cazul |f(x)| > a', content: 'Echivalent cu f(x) < -a sau f(x) > a', formula: 'f(x) < -a \\;\\cup\\; f(x) > a' },
      { step: 4, title: 'Rezolvă ambele condiții' },
      { step: 5, title: 'Unește sau intersectează intervalele' },
    ],
    difficulty: 3,
    importance_score: 7,
    validated: true,
  },

  // ── ANALIZĂ ───────────────────────────────────────────────────────────────────

  {
    exercise_type: 'limita_functie',
    exercise_type_label: 'Limita unei funcții',
    method_name: 'Calculul limitelor — metode BAC MD',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'limite',
    description: 'Metodele standard pentru calculul limitelor la BAC MD: substituție directă, forme nedeterminate (0/0, ∞/∞), factor comun, conjugata.',
    steps: [
      { step: 1, title: 'Substituție directă', content: 'Încearcă x → a direct' },
      { step: 2, title: 'Verifică dacă e formă nedeterminată', content: '0/0 sau ∞/∞' },
      { step: 3, title: 'Factor comun', content: 'Dacă e 0/0 — factorizează numărătorul și numitorul' },
      { step: 4, title: 'Conjugata', content: 'Dacă apare √ — înmulțește cu conjugata' },
      { step: 5, title: 'Regulă L\'Hôpital', content: 'Dacă celelalte metode nu funcționează', formula: '\\lim_{x \\to a} \\frac{f(x)}{g(x)} = \\lim_{x \\to a} \\frac{f\'(x)}{g\'(x)}' },
    ],
    difficulty: 3,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'derivata_functie',
    exercise_type_label: 'Derivata unei funcții',
    method_name: 'Regulile de derivare BAC MD',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'derivate',
    description: 'Reguli de derivare — tabel complet obligatoriu de știut la BAC MD.',
    steps: [
      { step: 1, title: 'Identifică tipul funcției', content: 'Elementară, compusă, produs, câit' },
      { step: 2, title: 'Derivata funcției compuse', formula: '[f(g(x))]^{\\prime} = f^{\\prime}(g(x)) \\cdot g^{\\prime}(x)' },
      { step: 3, title: 'Derivata produsului', formula: '(uv)^{\\prime} = u^{\\prime}v + uv^{\\prime}' },
      { step: 4, title: 'Derivata câitului', formula: '\\left(\\frac{u}{v}\\right)^{\\prime} = \\frac{u^{\\prime}v - uv^{\\prime}}{v^2}' },
      { step: 5, title: 'Simplific rezultatul' },
    ],
    notation_rules: { derivative: "f'(x) sau df/dx" },
    difficulty: 3,
    importance_score: 10,
    validated: true,
  },

  {
    exercise_type: 'studiu_functie',
    exercise_type_label: 'Studiul funcției',
    method_name: 'Schema completă de studiu — BAC MD',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'studiu_functii',
    description: 'Ordinea obligatorie la BAC MD: domeniu → paritate → intersecții cu axele → asimptote → monotonie → extreme → grafic.',
    steps: [
      { step: 1, title: 'Domeniu de definiție D' },
      { step: 2, title: 'Paritate (par/impar)', content: 'Verifică f(-x) = f(x) sau f(-x) = -f(x)' },
      { step: 3, title: 'Intersecțiile cu axele', content: 'Ox: f(x)=0; Oy: f(0)' },
      { step: 4, title: 'Asimptote', content: 'Verticale (x unde f nu e definit), orizontale (lim la ±∞), oblice' },
      { step: 5, title: 'Monotonie', content: 'Calculează f\'(x), rezolvă f\'(x) = 0, tabel de semn' },
      { step: 6, title: 'Extreme locale', content: 'x₀ — punct critic: f\'(x₀)=0. Dacă f\' schimbă semnul: extrem' },
      { step: 7, title: 'Concavitate (opțional BAC)', content: 'f\'\'(x) > 0 → convexă, < 0 → concavă' },
      { step: 8, title: 'Schiță grafic', content: 'Marchează punctele cheie' },
    ],
    difficulty: 4,
    importance_score: 10,
    validated: true,
  },

  {
    exercise_type: 'integrala_definita',
    exercise_type_label: 'Integrală definită',
    method_name: 'Calculul integralei definite (Newton-Leibniz)',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'integrale',
    steps: [
      { step: 1, title: 'Găsește primitiva F(x)', content: 'F\'(x) = f(x)' },
      { step: 2, title: 'Aplică formula Newton-Leibniz', formula: '\\int_a^b f(x)\\,dx = F(b) - F(a)' },
      { step: 3, title: 'Calculează F(b) - F(a)' },
      { step: 4, title: 'Aria sub grafic', content: 'Dacă f(x) ≥ 0 pe [a,b], aria = integrala' },
    ],
    notation_rules: { primitive: 'F(x) + C', definite: '∫ₐᵇ f(x)dx' },
    difficulty: 3,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'ecuatie_exponentiala',
    exercise_type_label: 'Ecuație exponențială',
    method_name: 'Metoda egalității exponenților',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'functii_elementare',
    steps: [
      { step: 1, title: 'Aduce ambele membre la aceeași bază', formula: 'a^{f(x)} = a^{g(x)} \\Rightarrow f(x) = g(x)' },
      { step: 2, title: 'Dacă bazele sunt diferite', content: 'Aplică logaritmul natural sau în baza comună' },
      { step: 3, title: 'Substituție', content: 'Dacă apare a^(2x) și a^x: t = a^x, t > 0' },
      { step: 4, title: 'Rezolvă ecuația în t, verifică t > 0' },
      { step: 5, title: 'Determină x din t = a^x' },
    ],
    difficulty: 3,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'ecuatie_logaritmica',
    exercise_type_label: 'Ecuație logaritmică',
    method_name: 'Metoda proprietăților logaritmilor',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'functii_elementare',
    steps: [
      { step: 1, title: 'Condiții de existență (CE)', content: 'Argumentele logaritmilor > 0' },
      { step: 2, title: 'Aplică proprietățile', content: 'log_a(xy) = log_a(x)+log_a(y) etc.' },
      { step: 3, title: 'Egalitate logaritmi cu aceeași bază', formula: '\\log_a f(x) = \\log_a g(x) \\Rightarrow f(x) = g(x)' },
      { step: 4, title: 'Substituție (dacă apar log² și log)', content: 't = log_a(x)' },
      { step: 5, title: 'Verifică CE — esențial la BAC MD!' },
    ],
    required_elements: ['condiții de existență', 'verificarea CE la final'],
    forbidden_shortcuts: ['fără CE'],
    common_mistakes: [
      { mistake: 'Uită CE', correction: 'CE sunt obligatorii — puncte pierdute dacă lipsesc' },
    ],
    difficulty: 3,
    importance_score: 8,
    validated: true,
  },

  // ── GEOMETRIE PLANĂ ────────────────────────────────────────────────────────────

  {
    exercise_type: 'triunghi_aria',
    exercise_type_label: 'Aria triunghiului',
    method_name: 'Formulele ariei triunghiului — BAC MD',
    grade_level: 10,
    topic: 'geometrie',
    subtopic: 'triunghi',
    steps: [
      { step: 1, title: 'Formula de bază', formula: 'S = \\frac{1}{2} \\cdot b \\cdot h' },
      { step: 2, title: 'Formula cu sinus', formula: 'S = \\frac{1}{2} ab \\sin C' },
      { step: 3, title: 'Formula lui Heron', formula: 'S = \\sqrt{p(p-a)(p-b)(p-c)},\\; p = \\frac{a+b+c}{2}' },
      { step: 4, title: 'Formula cu raza circumscrisă', formula: 'S = \\frac{abc}{4R}' },
      { step: 5, title: 'Formula cu raza înscrisă', formula: 'S = p \\cdot r' },
    ],
    difficulty: 2,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'pitagora_aplicat',
    exercise_type_label: 'Teorema lui Pitagora — aplicații',
    method_name: 'Pitagora și reciproca — BAC MD',
    grade_level: 10,
    topic: 'geometrie',
    subtopic: 'triunghi_dreptunghic',
    steps: [
      { step: 1, title: 'Identifică ipotenuza și catetele' },
      { step: 2, title: 'Aplică teorema', formula: 'c^2 = a^2 + b^2' },
      { step: 3, title: 'Calculează latura necunoscută' },
      { step: 4, title: 'Verifică cu reciproca (dacă e cerut)', content: 'Dacă c² = a²+b² → triunghi dreptunghic' },
    ],
    difficulty: 1,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'teorema_sinusurilor',
    exercise_type_label: 'Teorema sinusurilor',
    method_name: 'Teorema sinusurilor — BAC MD',
    grade_level: 10,
    topic: 'geometrie',
    subtopic: 'triunghi',
    steps: [
      { step: 1, title: 'Enunță teorema', formula: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R' },
      { step: 2, title: 'Identifică elementele cunoscute' },
      { step: 3, title: 'Aplică proporția corespunzătoare' },
      { step: 4, title: 'Calculează elementul necunoscut' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'teorema_cosinusurilor',
    exercise_type_label: 'Teorema cosinusurilor',
    method_name: 'Teorema cosinusurilor — BAC MD',
    grade_level: 10,
    topic: 'geometrie',
    subtopic: 'triunghi',
    steps: [
      { step: 1, title: 'Alege formula corectă', formula: 'c^2 = a^2 + b^2 - 2ab \\cos C' },
      { step: 2, title: 'Substituie valorile cunoscute' },
      { step: 3, title: 'Rezolvă pentru necunoscută' },
      { step: 4, title: 'Verifică că unghiul e în (0°, 180°)' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  // ── GEOMETRIE SPAȚIALĂ ────────────────────────────────────────────────────────

  {
    exercise_type: 'volum_piramida',
    exercise_type_label: 'Volumul piramidei',
    method_name: 'Volumul piramidei regulate — BAC MD',
    grade_level: 11,
    topic: 'geometrie',
    subtopic: 'corpuri_geometrice',
    steps: [
      { step: 1, title: 'Calculează aria bazei', content: 'Pentru piramidă regulată cu n laturi' },
      { step: 2, title: 'Calculează înălțimea h', content: 'h = √(m² - R²) unde m = muchia laterală, R = raza circumscrisă bazei' },
      { step: 3, title: 'Formula volumului', formula: 'V = \\frac{1}{3} \\cdot S_{baza} \\cdot h' },
      { step: 4, title: 'Aria laterală', formula: 'A_{lat} = \\frac{1}{2} \\cdot P_{baza} \\cdot l' },
    ],
    notation_rules: { volume: 'V = ⅓·S·h', lateral_area: 'Alat = ½·P·l' },
    difficulty: 3,
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'volum_cilindru',
    exercise_type_label: 'Volumul cilindrului',
    method_name: 'Formule cilindru circular drept — BAC MD',
    grade_level: 11,
    topic: 'geometrie',
    subtopic: 'corpuri_geometrice',
    steps: [
      { step: 1, title: 'Identifică r și h' },
      { step: 2, title: 'Volum', formula: 'V = \\pi r^2 h' },
      { step: 3, title: 'Aria laterală', formula: 'A_{lat} = 2\\pi r h' },
      { step: 4, title: 'Aria totală', formula: 'A_{tot} = 2\\pi r(r + h)' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'volum_con',
    exercise_type_label: 'Volumul conului',
    method_name: 'Formule con circular drept — BAC MD',
    grade_level: 11,
    topic: 'geometrie',
    subtopic: 'corpuri_geometrice',
    steps: [
      { step: 1, title: 'Identifică r, h', content: 'Calculează generatoarea: l = √(r² + h²)' },
      { step: 2, title: 'Volum', formula: 'V = \\frac{1}{3} \\pi r^2 h' },
      { step: 3, title: 'Aria laterală', formula: 'A_{lat} = \\pi r l' },
      { step: 4, title: 'Aria totală', formula: 'A_{tot} = \\pi r(r + l)' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'volum_sfera',
    exercise_type_label: 'Volumul sferei',
    method_name: 'Formule sferă — BAC MD',
    grade_level: 11,
    topic: 'geometrie',
    subtopic: 'corpuri_geometrice',
    steps: [
      { step: 1, title: 'Identifică raza R' },
      { step: 2, title: 'Volum', formula: 'V = \\frac{4}{3} \\pi R^3' },
      { step: 3, title: 'Aria suprafeței', formula: 'S = 4\\pi R^2' },
      { step: 4, title: 'Relație sferă-cilindru circumscris', content: 'R_cilindru = R_sfera, h_cilindru = 2R_sfera' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'trunchi_piramida',
    exercise_type_label: 'Trunchi de piramidă',
    method_name: 'Formule trunchi de piramidă — BAC MD',
    grade_level: 11,
    topic: 'geometrie',
    subtopic: 'corpuri_geometrice',
    steps: [
      { step: 1, title: 'Calculează ariile bazelor S₁ și S₂' },
      { step: 2, title: 'Formula volumului', formula: 'V = \\frac{h}{3}(S_1 + S_2 + \\sqrt{S_1 S_2})' },
      { step: 3, title: 'Generatoarea laterală', formula: 'l = \\sqrt{h^2 + (R_1 - R_2)^2}' },
      { step: 4, title: 'Aria laterală', formula: 'A_{lat} = \\frac{1}{2}(P_1 + P_2) \\cdot l' },
    ],
    difficulty: 3,
    importance_score: 7,
    validated: true,
  },

  // ── TRIGONOMETRIE ─────────────────────────────────────────────────────────────

  {
    exercise_type: 'ecuatie_trigonometrica_simpla',
    exercise_type_label: 'Ecuație trigonometrică simplă',
    method_name: 'Soluția generală (sin, cos, tg) — BAC MD',
    grade_level: 11,
    topic: 'trigonometrie',
    subtopic: 'ecuatii_trig',
    steps: [
      { step: 1, title: 'sin(x) = a', formula: 'x = (-1)^k \\arcsin a + \\pi k,\\; k \\in \\mathbb{Z}' },
      { step: 2, title: 'cos(x) = a', formula: 'x = \\pm \\arccos a + 2\\pi k,\\; k \\in \\mathbb{Z}' },
      { step: 3, title: 'tg(x) = a', formula: 'x = \\arctan a + \\pi k,\\; k \\in \\mathbb{Z}' },
      { step: 4, title: 'Verifică |a| ≤ 1 pt sin/cos; orice a pt tg' },
    ],
    required_elements: ['formula generală', 'k ∈ ℤ explicit'],
    difficulty: 3,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'identitati_trigonometrice',
    exercise_type_label: 'Identități trigonometrice',
    method_name: 'Transformări trigonometrice esențiale BAC MD',
    grade_level: 11,
    topic: 'trigonometrie',
    subtopic: 'identitati',
    steps: [
      { step: 1, title: 'Identitatea fundamentală', formula: '\\sin^2 x + \\cos^2 x = 1' },
      { step: 2, title: 'Formule unghi dublu', formula: '\\sin 2x = 2\\sin x \\cos x,\\; \\cos 2x = \\cos^2 x - \\sin^2 x' },
      { step: 3, title: 'Formule sumă/diferență', formula: '\\sin(A \\pm B) = \\sin A \\cos B \\pm \\cos A \\sin B' },
      { step: 4, title: 'Aplică identitățile pentru a simplifica' },
    ],
    difficulty: 3,
    importance_score: 7,
    validated: true,
  },

  // ── COMBINATORICĂ ─────────────────────────────────────────────────────────────

  {
    exercise_type: 'combinari_aranjamente',
    exercise_type_label: 'Combinări și aranjamente',
    method_name: 'Regula de numărare — BAC MD',
    grade_level: 12,
    topic: 'combinatorica',
    subtopic: 'combinatorica',
    steps: [
      { step: 1, title: 'Permutări', formula: 'P_n = n!' },
      { step: 2, title: 'Aranjamente', formula: 'A_n^k = \\frac{n!}{(n-k)!}' },
      { step: 3, title: 'Combinări', formula: 'C_n^k = \\binom{n}{k} = \\frac{n!}{k!(n-k)!}' },
      { step: 4, title: 'Decidă ordinea contează?', content: 'Ordinea contează → Aranjamente; nu contează → Combinări' },
    ],
    difficulty: 2,
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'binomul_lui_newton',
    exercise_type_label: 'Binomul lui Newton',
    method_name: 'Termenul general al dezvoltării (BAC MD)',
    grade_level: 12,
    topic: 'combinatorica',
    subtopic: 'binomul_newton',
    steps: [
      { step: 1, title: 'Formula binomului', formula: '(a+b)^n = \\sum_{k=0}^{n} C_n^k a^{n-k} b^k' },
      { step: 2, title: 'Termenul general (T_{k+1})', formula: 'T_{k+1} = C_n^k a^{n-k} b^k' },
      { step: 3, title: 'Găsești termenul cerut — rezolvă pentru k' },
      { step: 4, title: 'Calculează C_n^k și ridică la puteri' },
    ],
    difficulty: 3,
    importance_score: 7,
    validated: true,
  },

  // ── PROBABILITATE ─────────────────────────────────────────────────────────────

  {
    exercise_type: 'probabilitate_clasica',
    exercise_type_label: 'Probabilitate clasică',
    method_name: 'Regula lui Laplace — BAC MD',
    grade_level: 12,
    topic: 'probabilitate',
    subtopic: 'probabilitate_clasica',
    steps: [
      { step: 1, title: 'Numără cazuri posibile n(Ω)' },
      { step: 2, title: 'Numără cazuri favorabile n(A)' },
      { step: 3, title: 'Aplică formula', formula: 'P(A) = \\frac{n(A)}{n(\\Omega)}' },
      { step: 4, title: 'Verifică că 0 ≤ P(A) ≤ 1' },
    ],
    difficulty: 2,
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'probabilitate_conditionata',
    exercise_type_label: 'Probabilitate condiționată',
    method_name: 'P(A|B) și teorema lui Bayes — BAC MD',
    grade_level: 12,
    topic: 'probabilitate',
    subtopic: 'probabilitate_conditionata',
    steps: [
      { step: 1, title: 'Probabilitate condiționată', formula: 'P(A|B) = \\frac{P(A \\cap B)}{P(B)},\\; P(B) > 0' },
      { step: 2, title: 'Eveniment independent', content: 'A⊥B dacă P(A∩B) = P(A)·P(B)' },
      { step: 3, title: 'Teorema probabilității totale', formula: 'P(A) = \\sum_i P(A|H_i) \\cdot P(H_i)' },
    ],
    difficulty: 4,
    importance_score: 6,
    validated: true,
  },

  // ── ANALIZĂ VECTORIALĂ ────────────────────────────────────────────────────────

  {
    exercise_type: 'vectori_operatii',
    exercise_type_label: 'Operații cu vectori',
    method_name: 'Vectori în plan și spațiu — BAC MD',
    grade_level: 11,
    topic: 'geometrie',
    subtopic: 'vectori',
    steps: [
      { step: 1, title: 'Modulul vectorului', formula: '|\\vec{a}| = \\sqrt{a_x^2 + a_y^2}' },
      { step: 2, title: 'Produsul scalar', formula: '\\vec{a} \\cdot \\vec{b} = a_x b_x + a_y b_y = |\\vec{a}||\\vec{b}|\\cos\\theta' },
      { step: 3, title: 'Vectori perpendiculari', content: 'ā⊥b̄ ⟺ ā·b̄ = 0' },
      { step: 4, title: 'Vectori coliniari', content: 'ā∥b̄ ⟺ a_x/b_x = a_y/b_y' },
    ],
    difficulty: 2,
    importance_score: 7,
    validated: true,
  },
];

async function main() {
  console.log('\n🌱 Seed metodologii BAC MD — PORNIT\n');
  console.log(`📋 ${METHODS.length} metode de inserat...\n`);

  const supabase = createServiceClient();

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const method of METHODS) {
    try {
      const { error } = await supabase
        .from('solution_methods')
        .upsert(
          {
            ...method,
            region: 'MD',
          },
          { onConflict: 'exercise_type,method_name' }
        );

      if (error) {
        console.error(`  ❌ ${method.method_name}: ${error.message}`);
        failed++;
        errors.push(`${method.method_name}: ${error.message}`);
      } else {
        console.log(`  ✅ ${method.method_name}`);
        success++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ❌ ${method.method_name}: ${msg}`);
      failed++;
      errors.push(`${method.method_name}: ${msg}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Succes:  ${success}`);
  console.log(`❌ Erori:   ${failed}`);
  if (errors.length > 0) {
    console.log('\nErori detaliate:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log('\n⚠️  NOTĂ: Embeddings NU au fost generate (ZERO AI).');
  console.log('   Semantic search va funcționa doar după ce generezi embeddings separat.\n');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
