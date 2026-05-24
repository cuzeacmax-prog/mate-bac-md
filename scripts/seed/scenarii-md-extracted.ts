/**
 * 44 scenarii BAC MD extrase din "Repere Metodologice Matematică 2024-2025"
 * Clasa 10: 12 | Clasa 11: 13 | Clasa 12: 19
 */

export interface ExtractedScenario {
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  grade_level: number;
  topic: string;
  subtopic: string;
  description: string;
  steps: Array<{ step: number; title: string; content?: string }>;
  notation_rules: Record<string, string>;
  examples: Array<{ problem: string; solution: string; answer: string }>;
  common_mistakes: Array<{ mistake: string; correction: string }>;
  importance_score: number;
  validated: boolean;
  required_tools?: string[];
}

export const EXTRACTED_SCENARIOS: ExtractedScenario[] = [

  // ══════════════════════════════════════════════════════════
  // CLASA 10 — 12 scenarii
  // ══════════════════════════════════════════════════════════

  // ── ȘIRURI (4) ────────────────────────────────────────────

  {
    exercise_type: 'sir_aritmetic_termen_general',
    exercise_type_label: 'Șir aritmetic — termenul general',
    method_name: 'Formula termenului general al șirului aritmetic',
    grade_level: 10,
    topic: 'siruri',
    subtopic: 'sir_aritmetic',
    description: 'Calculul termenului de rang n dintr-un șir aritmetic folosind formula a_n = a_1 + (n-1)·r. Se identifică rația r și se aplică formula. Obligatoriu: se verifică că rația este constantă.',
    steps: [
      { step: 1, title: 'Identifică a₁ și rația r', content: 'Calculează r = a₂ - a₁ = a₃ - a₂ (verifică că e constant)' },
      { step: 2, title: 'Aplică formula termenului general', content: 'a_n = a₁ + (n-1)·r' },
      { step: 3, title: 'Calculează valoarea cerută', content: 'Substituie n și simplifică' },
      { step: 4, title: 'Scrie răspunsul', content: 'R: a_n = ...' },
    ],
    notation_rules: { termen_general: 'a_n', ratio: 'r = a_{n+1} - a_n', raspuns: 'R: ...' },
    examples: [
      { problem: 'Șirul 3, 7, 11, 15, ... Calculați a₁₀.', solution: 'r = 7-3 = 4; a₁₀ = 3 + 9·4 = 3 + 36 = 39', answer: 'R: a₁₀ = 39' },
    ],
    common_mistakes: [
      { mistake: 'Scrie a_n = a₁ + n·r (fără -1)', correction: 'Formula corectă: a_n = a₁ + (n-1)·r' },
      { mistake: 'Nu verifică că rația e constantă', correction: 'Verifică r = a₂-a₁ = a₃-a₂ înainte de aplicare' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'sir_aritmetic_suma_n',
    exercise_type_label: 'Șir aritmetic — suma primilor n termeni',
    method_name: 'Formula sumei S_n pentru șir aritmetic',
    grade_level: 10,
    topic: 'siruri',
    subtopic: 'sir_aritmetic',
    description: 'Calculul sumei primilor n termeni dintr-un șir aritmetic. Două formule echivalente. BAC MD: de obicei se cere și calculul unui termen intermediar.',
    steps: [
      { step: 1, title: 'Identifică a₁, r (sau a_n) și n' },
      { step: 2, title: 'Formula cu primul și ultimul termen', content: 'S_n = n·(a₁ + a_n)/2' },
      { step: 3, title: 'Formula cu primul termen și rația', content: 'S_n = n·(2a₁ + (n-1)·r)/2' },
      { step: 4, title: 'Calculează și scrie R: S_n = ...' },
    ],
    notation_rules: { suma: 'S_n', formula1: 'S_n = n(a₁+a_n)/2', formula2: 'S_n = n(2a₁+(n-1)r)/2' },
    examples: [
      { problem: 'Șirul aritmetic cu a₁=2, r=3. Calculați S₁₀.', solution: 'a₁₀ = 2 + 9·3 = 29; S₁₀ = 10·(2+29)/2 = 10·31/2 = 155', answer: 'R: S₁₀ = 155' },
    ],
    common_mistakes: [
      { mistake: 'Confundă S_n cu a_n', correction: 'S_n = suma, a_n = termenul de rang n' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'sir_geometric_termen_general',
    exercise_type_label: 'Șir geometric — termenul general',
    method_name: 'Formula termenului general al șirului geometric',
    grade_level: 10,
    topic: 'siruri',
    subtopic: 'sir_geometric',
    description: 'Calculul termenului de rang n dintr-un șir geometric. Rația q ≠ 0, 1. Atenție la semnul lui q (dacă q < 0: termenii alternează semn).',
    steps: [
      { step: 1, title: 'Identifică a₁ și rația q', content: 'q = a₂/a₁ (verifică că e constant)' },
      { step: 2, title: 'Aplică formula', content: 'a_n = a₁ · q^(n-1)' },
      { step: 3, title: 'Calculează q^(n-1) — atenție la puteri negative' },
      { step: 4, title: 'Scrie R: a_n = ...' },
    ],
    notation_rules: { formula: 'a_n = a₁·q^(n-1)', conditie: 'q ≠ 0' },
    examples: [
      { problem: 'Șirul 2, 6, 18, 54, ... Calculați a₅.', solution: 'q = 6/2 = 3; a₅ = 2·3^4 = 2·81 = 162', answer: 'R: a₅ = 162' },
    ],
    common_mistakes: [
      { mistake: 'Scrie a_n = a₁·q^n (exponent greșit)', correction: 'Exponentul corect este n-1, nu n' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'sir_geometric_suma_si_infinita',
    exercise_type_label: 'Șir geometric — suma S_n și suma infinită',
    method_name: 'Suma primilor n termeni și suma seriei geometrice infinite',
    grade_level: 10,
    topic: 'siruri',
    subtopic: 'sir_geometric',
    description: 'Suma primilor n termeni (q≠1) și suma seriei geometrice infinite (|q|<1). Ambele formule apar la BAC MD clasa 10.',
    steps: [
      { step: 1, title: 'Verifică tipul cerut: S_n finită sau S infinită' },
      { step: 2, title: 'Suma finită (q≠1)', content: 'S_n = a₁·(q^n - 1)/(q - 1)' },
      { step: 3, title: 'Cazul q=1', content: 'S_n = n·a₁' },
      { step: 4, title: 'Suma infinită (|q|<1)', content: 'S = a₁/(1-q)' },
      { step: 5, title: 'Verifică condiția |q|<1 pentru suma infinită' },
    ],
    notation_rules: { suma_finita: 'S_n = a₁(q^n-1)/(q-1)', suma_infinita: 'S = a₁/(1-q)', conditie_infinita: '|q| < 1' },
    examples: [
      { problem: 'Șirul geometric 8, 4, 2, 1, ... Calculați suma infinită.', solution: 'q = 4/8 = 1/2, |q| < 1; S = 8/(1-1/2) = 8/(1/2) = 16', answer: 'R: S = 16' },
    ],
    common_mistakes: [
      { mistake: 'Aplică suma infinită fără a verifica |q|<1', correction: 'Suma infinită există DOAR dacă |q| < 1. Altfel, seria diverge.' },
    ],
    importance_score: 7,
    validated: true,
  },

  // ── ALGEBRĂ gr.10 (8) ──────────────────────────────────────

  {
    exercise_type: 'ecuatie_liniara_cu_fractii',
    exercise_type_label: 'Ecuație liniară cu fracții',
    method_name: 'Aducerea la același numitor — ecuație liniară',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'ecuatii',
    description: 'Rezolvarea ecuațiilor de gradul I care conțin fracții algebrice. Pas obligatoriu BAC MD: precizarea condițiilor de existență (numitorii ≠ 0) și verificarea soluției.',
    steps: [
      { step: 1, title: 'Precizează CE (condiții de existență)', content: 'Toți numitorii ≠ 0; scrie CE: x ≠ ...' },
      { step: 2, title: 'Calculează CMMMC al numitorilor' },
      { step: 3, title: 'Înmulțește ambele membre cu CMMMC' },
      { step: 4, title: 'Rezolvă ecuația liniară obținută' },
      { step: 5, title: 'Verifică că soluția respectă CE' },
      { step: 6, title: 'Scrie S = {x₀} sau S = ∅ dacă soluția violează CE' },
    ],
    notation_rules: { ce: 'CE: x ≠ ...', solutie: 'S = {x₀}', vid: 'S = ∅' },
    examples: [
      { problem: 'Rezolvați: x/(x-1) + 2/(x+1) = 1', solution: 'CE: x≠1, x≠-1; înmulțim cu (x-1)(x+1): x(x+1)+2(x-1) = (x-1)(x+1); x²+x+2x-2 = x²-1; 3x-2 = -1; x = 1/3. Verificare: 1/3 ∉ {1,-1} ✓', answer: 'S = {1/3}' },
    ],
    common_mistakes: [
      { mistake: 'Omite CE', correction: 'CE sunt obligatorii la ecuații fracționare — pierdere de puncte la BAC MD' },
      { mistake: 'Nu verifică soluția față de CE', correction: 'Chiar dacă x are valoare, poate viola CE → S = ∅' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'inecuatie_liniara',
    exercise_type_label: 'Inecuație liniară',
    method_name: 'Rezolvarea inecuației de gradul I',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'inecuatii',
    description: 'Rezolvarea inecuațiilor ax + b > c (sau <, ≤, ≥). Regula de bază: la înmulțire/împărțire cu număr NEGATIV, sensul inecuației se inversează.',
    steps: [
      { step: 1, title: 'Aduce toți termenii cu x în stânga, constante în dreapta' },
      { step: 2, title: 'Simplifică — ATENȚIE: dacă împarți cu număr negativ, inversezi sensul!' },
      { step: 3, title: 'Scrie soluția ca interval', content: 'x > a → x ∈ (a, +∞)' },
      { step: 4, title: 'Scrie S = interval' },
    ],
    notation_rules: { interval_deschis: '(a, b)', interval_inchis: '[a, b]', solutie: 'S = (a, +∞) etc.' },
    examples: [
      { problem: 'Rezolvați: -2x + 5 > 1', solution: '-2x > 1-5; -2x > -4; x < 2 (sens inversat!)', answer: 'S = (-∞, 2)' },
    ],
    common_mistakes: [
      { mistake: 'Nu inversează sensul la împărțire cu număr negativ', correction: 'La a·x > b cu a < 0: x < b/a (sensul se inversează)' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'ecuatie_modul_ax_plus_b',
    exercise_type_label: 'Ecuație cu modul |ax + b| = c',
    method_name: 'Desfacerea modulului — două cazuri',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'modul',
    description: 'Rezolvarea ecuațiilor de forma |ax+b| = c. Dacă c < 0 → S = ∅. Dacă c ≥ 0: două cazuri (ax+b = c și ax+b = -c).',
    steps: [
      { step: 1, title: 'Verifică dacă c < 0', content: 'Dacă c < 0 → S = ∅ (modulul e întotdeauna ≥ 0)' },
      { step: 2, title: 'Cazul 1: ax + b = c', content: 'Rezolvă și găsește x₁' },
      { step: 3, title: 'Cazul 2: ax + b = -c', content: 'Rezolvă și găsește x₂' },
      { step: 4, title: 'Scrie S = {x₁, x₂}' },
    ],
    notation_rules: { cazuri: 'ax+b = ±c', solutie: 'S = {x₁, x₂}' },
    examples: [
      { problem: 'Rezolvați: |2x - 3| = 5', solution: 'Cazul 1: 2x-3=5 → x=4; Cazul 2: 2x-3=-5 → 2x=-2 → x=-1', answer: 'S = {-1, 4}' },
    ],
    common_mistakes: [
      { mistake: 'Scrie doar cazul pozitiv (un singur caz)', correction: 'OBLIGATORIU două cazuri: ax+b = c ȘI ax+b = -c' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'inecuatie_modul_tip_mai_mic',
    exercise_type_label: 'Inecuație cu modul |f(x)| < a',
    method_name: 'Inecuație modul — intersecție de intervale',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'modul',
    description: 'Rezolvarea inecuațiilor cu modul prin echivalare cu sistem/interval dublu. Cele două tipuri fundamentale: |f(x)| < a și |f(x)| > a.',
    steps: [
      { step: 1, title: '|f(x)| < a (a > 0)', content: 'Echivalent cu: -a < f(x) < a' },
      { step: 2, title: 'Rezolvă inecuația dublă ca sistem', content: 'f(x) > -a ȘI f(x) < a' },
      { step: 3, title: '|f(x)| > a', content: 'Echivalent cu: f(x) < -a SAU f(x) > a' },
      { step: 4, title: 'Scrie soluția ca interval(e)' },
    ],
    notation_rules: { tip1: '|f(x)| < a ↔ -a < f(x) < a', tip2: '|f(x)| > a ↔ f(x)<-a ∪ f(x)>a' },
    examples: [
      { problem: 'Rezolvați: |x - 2| < 3', solution: '-3 < x-2 < 3; -1 < x < 5', answer: 'S = (-1, 5)' },
    ],
    common_mistakes: [
      { mistake: 'Confundă tipul < cu tipul >', correction: '< dă intersecție (interval finit); > dă reuniune (două intervale infinite)' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'functie_domeniu_definitie_calcul',
    exercise_type_label: 'Domeniu de definiție al funcției',
    method_name: 'Determinarea domeniului de definiție',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'functii',
    description: 'Calculul domeniului de definiție pentru funcții algebrice, radicali, fracții și logaritmi. Condiții de existență cumulate cu AND (∩).',
    steps: [
      { step: 1, title: 'Fracții: numitor ≠ 0', content: 'Rezolvă numitor = 0, exclud din domeniu' },
      { step: 2, title: 'Radical: expresia sub radical ≥ 0', content: 'Rezolvă inecuația' },
      { step: 3, title: 'Logaritm: argument > 0 și baza > 0, ≠ 1' },
      { step: 4, title: 'Combină condițiile cu intersecție', content: 'D = C₁ ∩ C₂ ∩ ...' },
      { step: 5, title: 'Scrie D = ... (interval, reuniune)' },
    ],
    notation_rules: { domeniu: 'D = ...', intersectie: '∩', reuniune: '∪' },
    examples: [
      { problem: 'Găsiți domeniul: f(x) = √(x-1) / (x-3)', solution: 'C₁: x-1 ≥ 0 → x ≥ 1; C₂: x-3 ≠ 0 → x ≠ 3; D = [1, 3) ∪ (3, +∞)', answer: 'D = [1, 3) ∪ (3, +∞)' },
    ],
    common_mistakes: [
      { mistake: 'Radical: condiție > 0 în loc de ≥ 0', correction: 'Sub radical: expresie ≥ 0 (radicalul de grad par)' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'paritate_functie_metoda',
    exercise_type_label: 'Paritatea funcției — par sau impar',
    method_name: 'Verificarea parității prin f(-x)',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'functii',
    description: 'Verificarea dacă o funcție este pară (f(-x)=f(x)), impară (f(-x)=-f(x)) sau niciuna. Condiție prealabilă: domeniu simetric față de origine.',
    steps: [
      { step: 1, title: 'Verifică că D este simetric față de O', content: 'Dacă x ∈ D ⟹ -x ∈ D (altfel: funcție fără paritate)' },
      { step: 2, title: 'Calculează f(-x)', content: 'Înlocuiește x cu -x în expresia funcției' },
      { step: 3, title: 'Compară f(-x) cu f(x) și -f(x)' },
      { step: 4, title: 'Concluzie', content: 'f(-x)=f(x) → par; f(-x)=-f(x) → impar; altfel → nici par, nici impar' },
    ],
    notation_rules: { para: 'f(-x) = f(x)', impara: 'f(-x) = -f(x)' },
    examples: [
      { problem: 'Este f(x) = x³ - x par sau impară?', solution: 'f(-x) = (-x)³-(-x) = -x³+x = -(x³-x) = -f(x)', answer: 'f este funcție impară.' },
    ],
    common_mistakes: [
      { mistake: 'Nu verifică simetria domeniului', correction: 'Dacă D nu e simetric față de O, funcția NU are paritate' },
    ],
    importance_score: 6,
    validated: true,
  },

  {
    exercise_type: 'ecuatie_bipatratica',
    exercise_type_label: 'Ecuație biquadratică ax⁴ + bx² + c = 0',
    method_name: 'Substituția t = x² pentru ecuație biquadratică',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'ecuatii',
    description: 'Rezolvarea ecuațiilor de gradul IV simetrice prin substituție t = x². Se obține ecuație de gradul II în t, se iau doar soluțiile t ≥ 0.',
    steps: [
      { step: 1, title: 'Substituie t = x², t ≥ 0', content: 'Ecuația devine at² + bt + c = 0' },
      { step: 2, title: 'Rezolvă ecuația de gradul II în t', content: 'Calculează Δ = b² - 4ac' },
      { step: 3, title: 'Reține DOAR soluțiile t ≥ 0' },
      { step: 4, title: 'Din t = x²: x = ±√t (pentru fiecare t > 0); x = 0 (dacă t = 0)' },
      { step: 5, title: 'Scrie S = {...}' },
    ],
    notation_rules: { substitutie: 't = x², t ≥ 0', atentie: 'Se reține t ≥ 0' },
    examples: [
      { problem: 'Rezolvați: x⁴ - 5x² + 4 = 0', solution: 't=x²: t²-5t+4=0; Δ=9; t₁=4, t₂=1; x=±2, x=±1', answer: 'S = {-2, -1, 1, 2}' },
    ],
    common_mistakes: [
      { mistake: 'Reține soluții t < 0', correction: 'Dacă t < 0, ecuația x² = t nu are soluții reale → se ignoră' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'inecuatie_produs_factori',
    exercise_type_label: 'Inecuație — metoda tabelului de semne',
    method_name: 'Tabelul de semne pentru produs/câit de factori liniari',
    grade_level: 10,
    topic: 'algebra',
    subtopic: 'inecuatii',
    description: 'Rezolvarea inecuațiilor de forma (ax+b)(cx+d) > 0 sau <0 prin tabelul de semne. Se găsesc rădăcinile, se analizează semnul fiecărui factor pe intervale.',
    steps: [
      { step: 1, title: 'Găsește rădăcinile factorilor liniari', content: 'ax+b=0 → x₁; cx+d=0 → x₂' },
      { step: 2, title: 'Ordonează rădăcinile: x₁ < x₂' },
      { step: 3, title: 'Construiește tabelul de semne pe intervalele (-∞,x₁), (x₁,x₂), (x₂,+∞)' },
      { step: 4, title: 'Determină semnul produsului pe fiecare interval' },
      { step: 5, title: 'Scrie soluția ca reuniune de intervale' },
    ],
    notation_rules: { tabel: 'linii: factori + produs; coloane: intervale', solutie: 'S = ... ∪ ...' },
    examples: [
      { problem: 'Rezolvați: (x-1)(x+3) < 0', solution: 'Rădăcini: x₁=-3, x₂=1; tabel: (-∞,-3): (+)(-)=(-); (-3,1): (+)(+)=(+) — greșit, refac: (x-1): -, (x+3): + → produs neg; soluție: (-3,1)', answer: 'S = (-3, 1)' },
    ],
    common_mistakes: [
      { mistake: 'Nu include rădăcinile la ≤ sau ≥', correction: 'La ≤ sau ≥: include rădăcinile (intervale închise la capete)' },
    ],
    importance_score: 8,
    validated: true,
  },

  // ══════════════════════════════════════════════════════════
  // CLASA 11 — 13 scenarii
  // ══════════════════════════════════════════════════════════

  // ── LIMITE (3) ─────────────────────────────────────────────

  {
    exercise_type: 'limita_calcul_substitutie_directa',
    exercise_type_label: 'Limita — calcul prin substituție directă',
    method_name: 'Substituție directă și operații cu limite',
    grade_level: 11,
    topic: 'limite',
    subtopic: 'calcul_limite',
    description: 'Prima metodă de calcul al limitei: substituirea directă a valorii x→a. Dacă rezultă formă determinată → aceea este limita. Proprietăți: limita sumei, produsului, câitului.',
    steps: [
      { step: 1, title: 'Substituie x = a direct în expresie' },
      { step: 2, title: 'Dacă rezultă valoare finită definită → aceasta e limita' },
      { step: 3, title: 'Dacă rezultă 0/0 sau ∞/∞ → formă nedeterminată, altă metodă' },
      { step: 4, title: 'Proprietăți: lim(f+g)=lim f+lim g, lim(f·g)=lim f·lim g' },
    ],
    notation_rules: { limita: 'lim_{x→a} f(x)', forma_det: 'Dacă f(a) definit → lim = f(a)' },
    examples: [
      { problem: 'Calculați lim_{x→2} (x² + 3x - 1)', solution: 'Substituție directă: 2² + 3·2 - 1 = 4 + 6 - 1 = 9', answer: 'lim = 9' },
    ],
    common_mistakes: [
      { mistake: 'Aplică alte metode când substituția directă funcționează', correction: 'Încearcă mai întâi substituția directă — e cea mai simplă' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'limita_forma_0_0_factorizare',
    exercise_type_label: 'Limita de forma 0/0 — factorizare',
    method_name: 'Eliminarea formei nedeterminate 0/0 prin factorizare',
    grade_level: 11,
    topic: 'limite',
    subtopic: 'forme_nedeterminate',
    description: 'Calculul limitelor de forma 0/0 prin factorizarea numărătorului și numitorului și simplificarea factorului comun care se anulează. Metoda principală BAC MD.',
    steps: [
      { step: 1, title: 'Verifică că rezultă 0/0 prin substituție directă' },
      { step: 2, title: 'Factorizează numărătorul', content: 'Dacă x→a anulează expresia, (x-a) este factor comun' },
      { step: 3, title: 'Factorizează numitorul la fel' },
      { step: 4, title: 'Simplifică factorul (x-a) comun' },
      { step: 5, title: 'Aplică substituția directă la expresia simplificată' },
    ],
    notation_rules: { forma: '0/0 → factorizare → simplificare → substituție' },
    examples: [
      { problem: 'lim_{x→2} (x²-4)/(x-2)', solution: '(x²-4)/(x-2) = (x-2)(x+2)/(x-2) = x+2; lim_{x→2}(x+2) = 4', answer: 'lim = 4' },
    ],
    common_mistakes: [
      { mistake: 'Scrie 0/0 = 0 sau = 1', correction: '0/0 este formă nedeterminată — necesită calcul suplimentar' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'limita_la_infinit_polinoame',
    exercise_type_label: 'Limita la infinit — polinoame și rapoarte',
    method_name: 'Limita la ±∞ prin extragerea gradului maxim',
    grade_level: 11,
    topic: 'limite',
    subtopic: 'limita_infinit',
    description: 'Calculul limitelor la ∞ pentru rapoarte de polinoame. Regula: împarte numărătorul și numitorul la x^(gradul maxim) și folosește lim(1/x^n) = 0.',
    steps: [
      { step: 1, title: 'Identifică gradul maxim la numărător (m) și numitor (n)' },
      { step: 2, title: 'Împarte totul cu x^(max(m,n))' },
      { step: 3, title: 'Aplică lim(c/x^k) = 0 pentru k > 0' },
      { step: 4, title: 'Concluzie: m<n→0; m=n→raport coef.; m>n→±∞' },
    ],
    notation_rules: { regula: 'm<n: lim=0; m=n: lim=a_m/b_n; m>n: lim=±∞' },
    examples: [
      { problem: 'lim_{x→∞} (3x²+2x)/(x²-1)', solution: 'Grade egale (2=2); lim = 3/1 = 3', answer: 'lim = 3' },
    ],
    common_mistakes: [
      { mistake: 'Nu identifică corect gradul maxim', correction: 'Gradul polinomului = puterea cea mai mare a lui x cu coeficient ≠ 0' },
    ],
    importance_score: 8,
    validated: true,
  },

  // ── ANALIZĂ gr.11 (5) ─────────────────────────────────────

  {
    exercise_type: 'derivata_reguli_elementare',
    exercise_type_label: 'Derivata — reguli elementare BAC MD',
    method_name: 'Tabel de derivate și reguli de bază',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'derivate',
    description: 'Derivatele funcțiilor elementare și regulile de calcul: sumă, produs, câit. Tabelul complet obligatoriu pentru BAC MD.',
    steps: [
      { step: 1, title: 'Identifică tipul funcției (elementară, compusă, produs, câit)' },
      { step: 2, title: 'Tabel derivate: (x^n)\'=nx^(n-1), (e^x)\'=e^x, (ln x)\'=1/x, (sin x)\'=cos x, (cos x)\'=-sin x' },
      { step: 3, title: 'Regula sumei: (f+g)\'=f\'+g\'' },
      { step: 4, title: 'Regula produsului: (fg)\'=f\'g+fg\'' },
      { step: 5, title: 'Regula câitului: (f/g)\'=(f\'g-fg\')/g²' },
    ],
    notation_rules: { notatie_derivata: "f'(x) sau f'", putere: "(x^n)' = nx^(n-1)" },
    examples: [
      { problem: 'Calculați f\'(x) dacă f(x) = x³ - 2x² + 5x - 1.', solution: 'f\'(x) = 3x² - 4x + 5', answer: "f'(x) = 3x² - 4x + 5" },
    ],
    common_mistakes: [
      { mistake: 'Derivata constantei: (c)\'=c', correction: 'Derivata oricărei constante este 0: (c)\' = 0' },
    ],
    importance_score: 10,
    validated: true,
  },

  {
    exercise_type: 'derivata_regula_lantului',
    exercise_type_label: 'Derivata funcției compuse — regula lanțului',
    method_name: 'Regula lanțului: [f(g(x))]\' = f\'(g(x))·g\'(x)',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'derivate',
    description: 'Derivarea funcțiilor compuse prin regula lanțului. Identificarea funcției "exterioare" și "interioare". Aplicații: (e^(g(x)))\', (ln(g(x)))\', (sin(g(x)))\'.',
    steps: [
      { step: 1, title: 'Identifică g(x) — funcția interioară' },
      { step: 2, title: 'Identifică f — funcția exterioară' },
      { step: 3, title: 'Aplică regula lanțului', content: '[f(g(x))]\' = f\'(g(x)) · g\'(x)' },
      { step: 4, title: 'Cazuri frecvente BAC: (e^(ax+b))\'=a·e^(ax+b); (ln(ax+b))\'=a/(ax+b)' },
      { step: 5, title: 'Simplifică rezultatul' },
    ],
    notation_rules: { regula: "[f(g(x))]' = f'(g(x))·g'(x)", exterior_interior: 'f = exterior, g = interior' },
    examples: [
      { problem: "Calculați f'(x) dacă f(x) = e^(x²+1).", solution: "g(x) = x²+1, g'=2x; f = e^u, f'=e^u; f'(x) = e^(x²+1)·2x", answer: "f'(x) = 2x·e^(x²+1)" },
    ],
    common_mistakes: [
      { mistake: 'Uită să înmulțească cu derivata interiorului', correction: 'Regula lanțului ÎNTOTDEAUNA înmulțește cu g\'(x)' },
    ],
    importance_score: 10,
    validated: true,
  },

  {
    exercise_type: 'tangenta_la_grafic_ecuatia',
    exercise_type_label: 'Ecuația tangentei la graficul funcției',
    method_name: 'Tangenta la grafic prin derivată în punct',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'aplicatii_derivate',
    description: 'Determinarea ecuației tangentei la graficul y=f(x) în punctul (x₀, f(x₀)). Panta tangentei = f\'(x₀).',
    steps: [
      { step: 1, title: 'Calculează f\'(x)' },
      { step: 2, title: 'Calculează panta tangentei m = f\'(x₀)' },
      { step: 3, title: 'Calculează y₀ = f(x₀) — ordonata punctului de tangență' },
      { step: 4, title: 'Scrie ecuația tangentei', content: 'y - y₀ = m·(x - x₀)' },
      { step: 5, title: 'Simplifică și scrie în forma y = mx + b' },
    ],
    notation_rules: { tangenta: 'y - f(x₀) = f\'(x₀)·(x - x₀)', panta: "m = f'(x₀)" },
    examples: [
      { problem: 'Ecuația tangentei la f(x)=x² în x₀=1.', solution: "f'(x)=2x; m=f'(1)=2; y₀=1; y-1=2(x-1); y=2x-1", answer: 'y = 2x - 1' },
    ],
    common_mistakes: [
      { mistake: 'Confundă ecuația tangentei cu normala', correction: 'Tangenta: y-y₀=m(x-x₀); Normala: y-y₀=(-1/m)(x-x₀)' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'extreme_locale_derivata_prima',
    exercise_type_label: 'Maxime și minime locale cu derivata',
    method_name: 'Criteriulderivateiprime — puncte critice și extreme',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'aplicatii_derivate',
    description: 'Determinarea extremelor locale ale funcției prin semnul derivatei prime. Condiție necesară: f\'(x₀)=0. Condiție suficientă: schimbarea semnului lui f\'.',
    steps: [
      { step: 1, title: 'Calculează f\'(x)' },
      { step: 2, title: 'Rezolvă f\'(x) = 0 → puncte critice x₁, x₂, ...' },
      { step: 3, title: 'Construiește tabelul de semn al lui f\'' },
      { step: 4, title: 'Dacă f\' schimbă + → -: maxim local în x₀' },
      { step: 5, title: 'Dacă f\' schimbă - → +: minim local în x₀' },
      { step: 6, title: 'Calculează valorile extreme f(x₀)' },
    ],
    notation_rules: { maxim: "f'(x₀)=0, f' schimbă +→-", minim: "f'(x₀)=0, f' schimbă -→+", valoare: 'y_max = f(x₀)' },
    examples: [
      { problem: 'Găsiți extremele f(x)=x³-3x.', solution: "f'=3x²-3=3(x²-1); x=±1; tabel: f'<0 pe (-1,1) → min la x=1, max la x=-1; f(-1)=2, f(1)=-2", answer: 'Max local: f(-1)=2; Min local: f(1)=-2' },
    ],
    common_mistakes: [
      { mistake: 'f\'(x₀)=0 ⟹ x₀ extrem (concluzie imediată)', correction: 'f\'(x₀)=0 e condiție necesară, nu suficientă. Verifică schimbarea semnului!' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'monotonie_tabel_semn_f_prim',
    exercise_type_label: 'Monotonia funcției prin derivată',
    method_name: 'Tabel de variație — monotonie cu f\'',
    grade_level: 11,
    topic: 'analiza',
    subtopic: 'monotonie',
    description: 'Determinarea intervalelor de monotonie ale funcției cu ajutorul semnului derivatei prime. f\'>0: funcția crește; f\'<0: funcția descreșete.',
    steps: [
      { step: 1, title: 'Calculează f\'(x)' },
      { step: 2, title: 'Rezolvă f\'(x) = 0 → puncte critice' },
      { step: 3, title: 'Determină semnul lui f\' pe fiecare interval' },
      { step: 4, title: 'f\'(x) > 0 pe (a,b) → f strict crescătoare pe [a,b]' },
      { step: 5, title: 'f\'(x) < 0 pe (a,b) → f strict descrescătoare pe [a,b]' },
      { step: 6, title: 'Scrie intervalele de monotonie' },
    ],
    notation_rules: { crescatoare: 'f crescătoare pe [a,b]', descrescatoare: 'f descrescătoare pe [a,b]' },
    examples: [
      { problem: 'Monotonia f(x) = x² - 4x + 3.', solution: "f'=2x-4; f'=0 → x=2; f'<0 pe (-∞,2): descrescătoare; f'>0 pe (2,+∞): crescătoare", answer: 'Descrescătoare pe (-∞,2], crescătoare pe [2,+∞)' },
    ],
    common_mistakes: [
      { mistake: 'Include punctele critice în ambele intervale', correction: 'Punctul critic x₀ e la graniță — inclus în ambele intervale (cu [])' },
    ],
    importance_score: 9,
    validated: true,
  },

  // ── ALGEBRĂ gr.11 — exp/log (4) ───────────────────────────

  {
    exercise_type: 'ecuatie_exponentiala_baza_egala',
    exercise_type_label: 'Ecuație exponențială — aducere la baza egală',
    method_name: 'Metoda bazei egale și substituția t = a^x',
    grade_level: 11,
    topic: 'algebra',
    subtopic: 'ecuatii_exp',
    description: 'Rezolvarea ecuațiilor exponențiale prin: (1) aducere la baza egală sau (2) substituție t=a^x (t>0). Cazuri: a^f(x)=a^g(x) → f(x)=g(x).',
    steps: [
      { step: 1, title: 'Încearcă aducerea ambelor membre la aceeași bază' },
      { step: 2, title: 'Dacă a^f(x)=a^g(x) (a>0, a≠1) → f(x)=g(x)' },
      { step: 3, title: 'Substituție (dacă apar a^(2x) și a^x)', content: 't = a^x, t > 0 (obligatoriu!)' },
      { step: 4, title: 'Rezolvă ecuația în t (grad 1 sau 2)' },
      { step: 5, title: 'Revin la x: t=a^x → x=log_a(t)' },
      { step: 6, title: 'Verifică t > 0 (soluțiile negative în t se ignoră)' },
    ],
    notation_rules: { substitutie: 't = a^x > 0', ecuatie_exp: 'a^f(x) = a^g(x) ↔ f(x) = g(x)' },
    examples: [
      { problem: 'Rezolvați: 4^x - 5·2^x + 4 = 0', solution: 't=2^x, t>0; t²-5t+4=0; (t-1)(t-4)=0; t=1: 2^x=1→x=0; t=4: 2^x=4→x=2', answer: 'S = {0, 2}' },
    ],
    common_mistakes: [
      { mistake: 'Acceptă t < 0 din ecuație', correction: 'a^x > 0 ÎNTOTDEAUNA → t > 0 obligatoriu' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'ecuatie_logaritmica_proprietati',
    exercise_type_label: 'Ecuație logaritmică — proprietăți log',
    method_name: 'Rezolvare prin proprietăți log și condiții de existență',
    grade_level: 11,
    topic: 'algebra',
    subtopic: 'ecuatii_log',
    description: 'Rezolvarea ecuațiilor cu logaritmi. OBLIGATORIU: condiții de existență (CE) la start. Proprietăți: log(ab)=log a+log b, log(a/b)=log a-log b, log(a^n)=n·log a.',
    steps: [
      { step: 1, title: 'Scrie CE', content: 'Toate argumentele log > 0; scrie CE: ...' },
      { step: 2, title: 'Aplică proprietățile logaritmilor pentru a simplifica' },
      { step: 3, title: 'Aduce la forma log_a(f(x)) = log_a(g(x)) → f(x) = g(x)' },
      { step: 4, title: 'Sau: log_a(f(x)) = c → f(x) = a^c' },
      { step: 5, title: 'Rezolvă ecuația obținută' },
      { step: 6, title: 'VERIFICĂ că soluțiile satisfac CE!' },
    ],
    notation_rules: { ce: 'CE: argumente > 0', proprietate: 'log_a(fg) = log_a(f) + log_a(g)', verificare: 'Verificare CE obligatorie' },
    examples: [
      { problem: 'log₂(x+1) + log₂(x-1) = 3', solution: 'CE: x>1; log₂((x+1)(x-1))=3; x²-1=8; x²=9; x=±3. Verificare CE (x>1): x=3 ✓, x=-3 ✗', answer: 'S = {3}' },
    ],
    common_mistakes: [
      { mistake: 'Omite verificarea CE la final', correction: 'Verificarea CE este OBLIGATORIE — soluții care violează CE se elimină' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'inecuatie_exponentiala',
    exercise_type_label: 'Inecuație exponențială',
    method_name: 'Inecuații exponențiale — sens în funcție de bază',
    grade_level: 11,
    topic: 'algebra',
    subtopic: 'inecuatii_exp',
    description: 'Rezolvarea inecuațiilor a^f(x) > a^g(x). Dacă a>1: sensul se păstrează (f(x)>g(x)). Dacă 0<a<1: sensul se inversează (f(x)<g(x)).',
    steps: [
      { step: 1, title: 'Aduce la aceeași bază a (dacă posibil)' },
      { step: 2, title: 'a>1: a^f(x) > a^g(x) ↔ f(x) > g(x)' },
      { step: 3, title: '0<a<1: a^f(x) > a^g(x) ↔ f(x) < g(x) (sens inversat!)' },
      { step: 4, title: 'Rezolvă inecuația obținută' },
      { step: 5, title: 'Scrie S = interval' },
    ],
    notation_rules: { baza_mare: 'a>1: sens păstrat', baza_mica: '0<a<1: sens inversat' },
    examples: [
      { problem: '(1/2)^(x-1) > (1/2)^(3-x)', solution: 'Baza 1/2<1 → sens inversat: x-1 < 3-x; 2x < 4; x < 2', answer: 'S = (-∞, 2)' },
    ],
    common_mistakes: [
      { mistake: 'Nu inversează sensul la 0<a<1', correction: 'Funcția a^x cu 0<a<1 este DESCRESCĂTOARE → sens inecuație se inversează' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'inecuatie_logaritmica',
    exercise_type_label: 'Inecuație logaritmică',
    method_name: 'Inecuații logaritmice — CE + sens funcție',
    grade_level: 11,
    topic: 'algebra',
    subtopic: 'inecuatii_log',
    description: 'Rezolvarea inecuațiilor cu logaritmi. CE obligatorii. Sens: log_a monoton crescătoare (a>1) sau descrescătoare (0<a<1).',
    steps: [
      { step: 1, title: 'Scrie CE: argumentele > 0' },
      { step: 2, title: 'Aduce la forma log_a(f(x)) > log_a(g(x))' },
      { step: 3, title: 'a>1: f(x) > g(x); 0<a<1: f(x) < g(x)' },
      { step: 4, title: 'Rezolvă inecuația obținută' },
      { step: 5, title: 'Intersectează cu CE', content: 'Soluția = (soluție inecuație) ∩ CE' },
    ],
    notation_rules: { intersectie_ce: 'S_final = S_inecuatie ∩ CE' },
    examples: [
      { problem: 'log₃(x-1) > 2', solution: 'CE: x>1; log₃(x-1)>log₃(9) (baza 3>1 → sens păstrat); x-1>9; x>10. S_final=(10,+∞)∩(1,+∞)=(10,+∞)', answer: 'S = (10, +∞)' },
    ],
    common_mistakes: [
      { mistake: 'Nu intersectează cu CE', correction: 'Soluția finală = soluție inecuație ∩ domeniu CE' },
    ],
    importance_score: 8,
    validated: true,
  },

  // ── POLINOAME (1) ──────────────────────────────────────────

  {
    exercise_type: 'polinom_schema_horner',
    exercise_type_label: 'Polinoame — schema lui Horner și teorema restului',
    method_name: 'Schema lui Horner pentru împărțire și evaluare polinom',
    grade_level: 11,
    topic: 'polinoame',
    subtopic: 'impartire_polinoame',
    description: 'Schema lui Horner pentru: (1) calculul eficient al valorii P(a), (2) împărțirea P(x):(x-a), (3) teorema restului: R=P(a), (4) teorema Bezout: dacă P(a)=0 atunci (x-a)|P(x).',
    steps: [
      { step: 1, title: 'Scrie coeficienții polinomului P(x) în ordine descrescătoare a puterilor' },
      { step: 2, title: 'Schema Horner: prima valoare = a₀; fiecare următor = valoare precedentă × a + coeficient curent' },
      { step: 3, title: 'Ultimul număr din schemă = R = P(a) (teorema restului)' },
      { step: 4, title: 'Dacă R=0: (x-a) este factor al lui P(x) (teorema Bezout)' },
      { step: 5, title: 'Celelalte numere din schemă = coeficienții câtului' },
    ],
    notation_rules: { rest: 'R = P(a)', bezout: 'P(a)=0 ↔ (x-a)|P(x)' },
    examples: [
      { problem: 'P(x)=x³-6x²+11x-6. Verificați că x=1 este rădăcină și factorizați.', solution: 'Horner cu a=1: 1|1 -6 11 -6| → 1·1=1; 1+(-6)=-5; -5·1=-5; -5+11=6; 6·1=6; 6+(-6)=0. R=0 ✓; câtul: x²-5x+6=(x-2)(x-3)', answer: 'P(x) = (x-1)(x-2)(x-3)' },
    ],
    common_mistakes: [
      { mistake: 'Omite coeficienții zero', correction: 'Dacă lipsesc termeni (ex: x³+x+1 — lipsește x²), scrie 0 pentru coeficientul lipsă' },
    ],
    importance_score: 7,
    validated: true,
  },

  // ══════════════════════════════════════════════════════════
  // CLASA 12 — 19 scenarii
  // ══════════════════════════════════════════════════════════

  // ── ANALIZĂ gr.12 — primitive + integrale (8) ─────────────

  {
    exercise_type: 'primitiva_functii_elementare',
    exercise_type_label: 'Primitiva — funcții elementare (tabel)',
    method_name: 'Tabelul primitivelor elementare BAC MD',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'primitive',
    description: 'Calculul primitivei (antiderivata) funcțiilor elementare. F(x) este primitiva lui f(x) dacă F\'(x)=f(x). Tabelul complet obligatoriu pentru BAC MD.',
    steps: [
      { step: 1, title: 'Identifică tipul funcției din tabel' },
      { step: 2, title: 'Tabel primitive esențiale', content: '∫x^n dx = x^(n+1)/(n+1)+C (n≠-1); ∫1/x dx = ln|x|+C; ∫e^x dx = e^x+C; ∫sin x dx = -cos x+C; ∫cos x dx = sin x+C' },
      { step: 3, title: 'Aplică liniaritatea: ∫(af+bg)dx = a∫f dx + b∫g dx' },
      { step: 4, title: 'Adaugă ÎNTOTDEAUNA constanta +C (la integrale nedefinite)' },
    ],
    notation_rules: { primitiva: 'F(x) + C', liniara: '∫(af+bg)dx = a∫f + b∫g', constanta: 'Nu uita +C!' },
    examples: [
      { problem: 'Calculați ∫(3x² + 2x - 5) dx', solution: '3·x³/3 + 2·x²/2 - 5x + C = x³ + x² - 5x + C', answer: 'x³ + x² - 5x + C' },
    ],
    common_mistakes: [
      { mistake: 'Uită constanta +C', correction: 'Primitiva include OBLIGATORIU +C (familie de funcții, nu o singură funcție)' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'primitiva_substitutie_simpla',
    exercise_type_label: 'Primitiva prin substituție simplă',
    method_name: 'Metoda substituției t = g(x) pentru primitive',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'primitive',
    description: 'Calculul primitivelor funcțiilor compuse prin substituție t=g(x). Recunoașterea formei ∫f(g(x))·g\'(x)dx. Primitivele funcțiilor de tip f(ax+b).',
    steps: [
      { step: 1, title: 'Identifică g(x) — funcția interioară' },
      { step: 2, title: 'Substituie t=g(x), dt=g\'(x)dx' },
      { step: 3, title: 'Transformă integrala în variabila t', content: '∫f(t) dt (formă simplă)' },
      { step: 4, title: 'Calculează primitiva în t' },
      { step: 5, title: 'Revino la variabila x: înlocuiește t cu g(x)' },
    ],
    notation_rules: { substitutie: 't=g(x), dt=g\'(x)dx', forma: '∫f(g(x))·g\'(x)dx = F(g(x))+C' },
    examples: [
      { problem: '∫(2x+3)⁵ dx', solution: 't=2x+3, dt=2dx → dx=dt/2; ∫t⁵·(dt/2) = t⁶/12 + C = (2x+3)⁶/12 + C', answer: '(2x+3)⁶/12 + C' },
    ],
    common_mistakes: [
      { mistake: 'Uită dt = g\'(x)dx (nu înlocuiește dx corect)', correction: 'Dacă t=g(x), atunci dt=g\'(x)dx → dx=dt/g\'(x)' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'integrare_prin_parti',
    exercise_type_label: 'Integrare prin părți',
    method_name: 'Formula integrării prin părți: ∫u dv = uv - ∫v du',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'primitive',
    description: 'Calculul primitivelor prin formula integrării prin părți. Alegerea corectă a lui u și dv: "ILATE" (Invers-Log-Algebric-Trig-Exp — u în această ordine).',
    steps: [
      { step: 1, title: 'Alege u și dv', content: 'u = factor ușor de derivat; dv = restul (ușor de integrat)' },
      { step: 2, title: 'Calculează du=u\'dx și v=∫dv' },
      { step: 3, title: 'Aplică formula: ∫u dv = u·v - ∫v du' },
      { step: 4, title: 'Calculează ∫v du (mai simplă decât integrala inițială)' },
      { step: 5, title: 'Adaugă +C la final' },
    ],
    notation_rules: { formula: '∫u dv = uv - ∫v du', alegere: 'u: log, algebric; dv: exp, trig' },
    examples: [
      { problem: '∫x·eˣ dx', solution: 'u=x, du=dx; dv=eˣdx, v=eˣ; ∫x·eˣdx = x·eˣ - ∫eˣdx = x·eˣ - eˣ + C = eˣ(x-1)+C', answer: 'eˣ(x-1) + C' },
    ],
    common_mistakes: [
      { mistake: 'Alege dv = ln(x)dx (ln greu de integrat)', correction: 'ln(x) se pune la u (se derivează ușor), nu la dv' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'integrala_definita_newton_leibniz',
    exercise_type_label: 'Integrala definită — formula Newton-Leibniz',
    method_name: 'Calculul integralei definite cu formula Newton-Leibniz',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'integrale_definite',
    description: 'Calculul integralei definite ∫ₐᵇ f(x)dx = F(b)-F(a). Verificarea condițiilor (f continuă pe [a,b]). Proprietăți: liniaritate, aditivitate față de interval.',
    steps: [
      { step: 1, title: 'Găsește primitiva F(x) a lui f(x)' },
      { step: 2, title: 'Aplică formula Newton-Leibniz', content: '∫ₐᵇ f(x)dx = F(b) - F(a) = [F(x)]ₐᵇ' },
      { step: 3, title: 'Calculează F(b) - F(a)' },
      { step: 4, title: 'Scrie rezultatul (număr real, nu funcție — fără +C!)' },
    ],
    notation_rules: { formula: '∫ₐᵇ f(x)dx = F(b)-F(a)', notatie: '[F(x)]ₐᵇ', fara_c: 'La integrală definită: NU +C' },
    examples: [
      { problem: '∫₁³ (2x+1) dx', solution: 'F(x)=x²+x; [x²+x]₁³ = (9+3)-(1+1) = 12-2 = 10', answer: '10' },
    ],
    common_mistakes: [
      { mistake: 'Adaugă +C la integrala definită', correction: 'Integrala definită e un număr real — NU se adaugă +C' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'aria_suprafata_domeniu',
    exercise_type_label: 'Aria suprafeței plane prin integrare',
    method_name: 'Aria domeniului delimitat de curbe prin integrale definite',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'aplicatii_integrale',
    description: 'Calculul ariei suprafeței delimitate de graficul funcției și axa Ox, sau aria dintre două grafice. Atenție la semnul funcției pe intervalul de integrare.',
    steps: [
      { step: 1, title: 'Dacă f(x) ≥ 0 pe [a,b]', content: 'A = ∫ₐᵇ f(x) dx' },
      { step: 2, title: 'Dacă f(x) ≤ 0 pe [a,b]', content: 'A = -∫ₐᵇ f(x) dx = ∫ₐᵇ |f(x)| dx' },
      { step: 3, title: 'Funcție cu semne mixte', content: 'Identifică punctele unde f(x)=0; calculează separat pe fiecare interval; sumă module' },
      { step: 4, title: 'Aria dintre două grafice', content: 'A = ∫ₐᵇ |f(x) - g(x)| dx; găsește intersecțiile' },
    ],
    notation_rules: { aria: 'A = ∫ₐᵇ f(x)dx (dacă f≥0)', aria_abs: 'A = ∫ₐᵇ |f(x)|dx (general)' },
    examples: [
      { problem: 'Aria suprafeței delimitate de y=x²-4 și axa Ox între x=-2 și x=2.', solution: 'f(x)≤0 pe (-2,2) (f(-2)=0, f(2)=0, f(0)=-4); A = -∫₋₂² (x²-4)dx = -[x³/3-4x]₋₂² = -[(8/3-8)-(-8/3+8)] = -[8/3-8+8/3-8] = -[16/3-16] = 16-16/3 = 32/3', answer: 'A = 32/3 u.p.' },
    ],
    common_mistakes: [
      { mistake: 'Calculează ∫f(x)dx direct fără a verifica semnul funcției', correction: 'Dacă f<0, integrala dă valoare negativă — aria e modulul!' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'studiu_complet_functie_gr12',
    exercise_type_label: 'Studiul complet al funcției (clasa 12)',
    method_name: 'Schema completă de studiu — clasa 12 BAC MD',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'studiu_functii',
    description: 'Studiul complet al funcției la clasa 12: domeniu, paritate, asimptote, monotonie cu f\', extreme, convexitate/concavitate cu f\'\', inflexiune, grafic. Schemă obligatorie BAC MD.',
    steps: [
      { step: 1, title: 'D — Domeniu de definiție' },
      { step: 2, title: 'Paritate (dacă D simetric față de O)' },
      { step: 3, title: 'Intersecții cu axele: Ox (f(x)=0), Oy (f(0))' },
      { step: 4, title: 'Asimptote verticale, orizontale (sau oblice)' },
      { step: 5, title: 'Calculează f\'. Semn f\' → monotonie + extreme' },
      { step: 6, title: 'Calculează f\'\'. Semn f\'\' → convexitate/concavitate + inflexiune' },
      { step: 7, title: 'Tabel de variație complet' },
      { step: 8, title: 'Schiță grafic cu toate elementele marcate' },
    ],
    notation_rules: { convex: "f''>0: convex (curba deasupra tangentelor)", concav: "f''<0: concav" },
    examples: [
      { problem: 'Schema de studiu pentru f(x)=x³-3x.', solution: "D=ℝ; impar; Ox: x=0,±√3; Oy: 0; fără asimptote; f'=3x²-3=3(x-1)(x+1); max(-1,2), min(1,-2); f''=6x; inflexiune(0,0); grafic S-shaped", answer: 'Grafic complet cu toate elementele.' },
    ],
    common_mistakes: [
      { mistake: 'Omite punctele de inflexiune', correction: 'Inflexiune obligatorie la clasa 12 — punctele unde f\'\' schimbă semnul' },
    ],
    importance_score: 10,
    validated: true,
  },

  {
    exercise_type: 'asimptote_toate_tipurile',
    exercise_type_label: 'Asimptotele funcției — toate tipurile',
    method_name: 'Calculul asimptotelor verticale, orizontale și oblice',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'asimptote',
    description: 'Determinarea tuturor tipurilor de asimptote ale funcției. Metode sistematice pentru fiecare tip.',
    steps: [
      { step: 1, title: 'Asimptote verticale', content: 'x=a unde lim_{x→a} |f(x)|=+∞ (de regulă: numitor=0 sau log)' },
      { step: 2, title: 'Asimptote orizontale', content: 'y=L dacă lim_{x→±∞} f(x) = L (finit)' },
      { step: 3, title: 'Asimptote oblice (dacă nu există orizontală)', content: 'm = lim_{x→∞} f(x)/x; n = lim_{x→∞} (f(x)-mx)' },
      { step: 4, title: 'Asimptota oblică: y = mx + n' },
    ],
    notation_rules: { verticala: 'x = a', orizontala: 'y = L', oblica: 'y = mx + n' },
    examples: [
      { problem: 'Asimptotele funcției f(x) = (x²+1)/(x-1)', solution: 'AV: x=1; AO: nu există (grad numărător>grad numitor); AO: m=lim(x²+1)/(x(x-1))=1; n=lim((x²+1)/(x-1)-x)=lim(x+1+2/(x-1))=... n=1; y=x+1', answer: 'AV: x=1; AO: y=x+1' },
    ],
    common_mistakes: [
      { mistake: 'Caută AO când există AH', correction: 'Dacă există asimptotă orizontală (L finit), nu există asimptotă oblică' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'inflexiune_concavitate_f2',
    exercise_type_label: 'Convexitate, concavitate și puncte de inflexiune',
    method_name: 'Criteriul derivatei a doua pentru convexitate și inflexiune',
    grade_level: 12,
    topic: 'analiza',
    subtopic: 'convexitate',
    description: 'Determinarea convexității/concavității funcției și a punctelor de inflexiune cu ajutorul derivatei a doua. Obligatoriu la BAC MD clasa 12.',
    steps: [
      { step: 1, title: 'Calculează f\'\'(x)' },
      { step: 2, title: 'Rezolvă f\'\'(x) = 0 → candidați la inflexiune' },
      { step: 3, title: 'f\'\'(x) > 0 pe (a,b) → f convexă (cupa în sus) pe [a,b]' },
      { step: 4, title: 'f\'\'(x) < 0 pe (a,b) → f concavă (cupa în jos) pe [a,b]' },
      { step: 5, title: 'Punct de inflexiune la x₀ dacă f\'\' schimbă semnul în x₀' },
      { step: 6, title: 'Coordonate: (x₀, f(x₀))' },
    ],
    notation_rules: { convex: "f''>0: convex", concav: "f''<0: concav", inflexiune: "f'' schimbă semn" },
    examples: [
      { problem: "Convexitatea f(x)=x³-3x².", solution: "f''=6x-6; f''=0→x=1; f''<0 pe (-∞,1): concav; f''>0 pe (1,+∞): convex; inflexiune (1,-2)", answer: 'Concavă pe (-∞,1], convexă pe [1,+∞). Inflexiune: (1,-2).' },
    ],
    common_mistakes: [
      { mistake: 'Confundă convex cu concav', correction: 'Convex (cupa sus, curba sub tangente): f\'\'>0; Concav (cupa jos): f\'\'<0' },
    ],
    importance_score: 8,
    validated: true,
  },

  // ── GEOMETRIE 3D (4) ───────────────────────────────────────

  {
    exercise_type: 'piramida_arii_volum_calcul',
    exercise_type_label: 'Piramida regulată — arii și volum (calcul complet)',
    method_name: 'Formulele piramidei regulate cu calcul geometric complet',
    grade_level: 12,
    topic: 'geometrie',
    subtopic: 'piramida',
    description: 'Calculul tuturor elementelor piramidei regulate (n laturi): înălțimea apotema bazei, apotema laterală, aria bazei, aria laterală, aria totală, volumul.',
    steps: [
      { step: 1, title: 'Identifică n (nr. laturi bazei), latura a, și elementul dat (înălțime h sau muche m)' },
      { step: 2, title: 'Apotema bazei', content: 'a_b = (a/2)·ctg(π/n) sau a_b = R·cos(π/n) (R = raza circumscrisă)' },
      { step: 3, title: 'Apotema laterală (generatoarea)', content: 'l = √(h² + a_b²)' },
      { step: 4, title: 'Aria bazei', content: 'S_b = (n·a·a_b)/2 sau formula poligon' },
      { step: 5, title: 'Aria laterală', content: 'S_lat = (n·a·l)/2 = (P·l)/2' },
      { step: 6, title: 'Volumul', content: 'V = (1/3)·S_b·h' },
    ],
    notation_rules: { apotema_baza: 'a_b', apotema_lat: 'l (generatoarea)', volum: 'V = S_b·h/3' },
    examples: [
      { problem: 'Piramidă pătrată regulată cu latura a=6 și h=4. Calculați V și S_lat.', solution: 'a_b=3; l=√(16+9)=5; S_b=36; V=36·4/3=48; S_lat=(4·6·5)/2=60', answer: 'V = 48 u.c.; S_lat = 60 u.p.' },
    ],
    common_mistakes: [
      { mistake: 'Confundă apotema bazei cu apotema laterală', correction: 'Apotema BAZEI: de la centrul bazei la mijlocul laturii; Apotema LATERALĂ: de la vârf la mijlocul laturii bazei' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'con_arii_volum_calcul',
    exercise_type_label: 'Conul drept — arii și volum',
    method_name: 'Formulele conului circular drept',
    grade_level: 12,
    topic: 'geometrie',
    subtopic: 'con',
    description: 'Calculul elementelor conului circular drept: generatoarea l=√(r²+h²), aria laterală S_lat=πrl, aria totală S_tot=πr(r+l), volumul V=πr²h/3.',
    steps: [
      { step: 1, title: 'Identifică r și h (sau l dacă e dat)' },
      { step: 2, title: 'Calculează generatoarea', content: 'l = √(r² + h²)' },
      { step: 3, title: 'Aria laterală', content: 'S_lat = π·r·l' },
      { step: 4, title: 'Aria bazei', content: 'S_b = π·r²' },
      { step: 5, title: 'Aria totală', content: 'S_tot = π·r·(r + l)' },
      { step: 6, title: 'Volumul', content: 'V = (1/3)·π·r²·h' },
    ],
    notation_rules: { generatoarea: 'l = √(r²+h²)', volum: 'V = πr²h/3', arie_lat: 'S_lat = πrl' },
    examples: [
      { problem: 'Con cu r=3 și h=4. Calculați l, S_lat, V.', solution: 'l=√(9+16)=5; S_lat=3π·5=15π; V=π·9·4/3=12π', answer: 'l=5, S_lat=15π u.p., V=12π u.c.' },
    ],
    common_mistakes: [
      { mistake: 'V = π·r²·h (fără 1/3)', correction: 'Volumul conului are factorul 1/3: V = (1/3)π·r²·h' },
    ],
    importance_score: 9,
    validated: true,
  },

  {
    exercise_type: 'cilindru_arii_volum_calcul',
    exercise_type_label: 'Cilindrul drept — arii și volum',
    method_name: 'Formulele cilindrului circular drept',
    grade_level: 12,
    topic: 'geometrie',
    subtopic: 'cilindru',
    description: 'Calculul elementelor cilindrului circular drept: aria laterală S_lat=2πrh, aria totală S_tot=2πr(r+h), volumul V=πr²h. Relații cu secțiunea axială și diagonala.',
    steps: [
      { step: 1, title: 'Identifică r și h' },
      { step: 2, title: 'Aria laterală (desfășurare = dreptunghi)', content: 'S_lat = 2π·r·h' },
      { step: 3, title: 'Aria bazei', content: 'S_b = π·r²' },
      { step: 4, title: 'Aria totală', content: 'S_tot = 2π·r·(r + h)' },
      { step: 5, title: 'Volumul', content: 'V = π·r²·h' },
      { step: 6, title: 'Diagonala secțiunii axiale', content: 'd = √((2r)² + h²) = √(4r²+h²)' },
    ],
    notation_rules: { volum: 'V = πr²h', arie_lat: 'S_lat = 2πrh', arie_tot: 'S_tot = 2πr(r+h)' },
    examples: [
      { problem: 'Cilindru cu r=2 și h=5. Calculați S_tot și V.', solution: 'S_tot=2π·2·(2+5)=28π; V=π·4·5=20π', answer: 'S_tot = 28π u.p., V = 20π u.c.' },
    ],
    common_mistakes: [
      { mistake: 'S_tot = 2πrh (uită bazele)', correction: 'S_tot = S_lat + 2·S_b = 2πrh + 2πr² = 2πr(r+h)' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'sfera_arii_volum_calcul',
    exercise_type_label: 'Sfera — arie și volum',
    method_name: 'Formulele sferei și relații cu corpuri înscrise/circumscrise',
    grade_level: 12,
    topic: 'geometrie',
    subtopic: 'sfera',
    description: 'Calculul ariei suprafeței și volumului sferei. Relații între sferă și cilindrul/conul circumscris sau înscris.',
    steps: [
      { step: 1, title: 'Identifică R (raza sferei)' },
      { step: 2, title: 'Aria suprafeței', content: 'S = 4π·R²' },
      { step: 3, title: 'Volumul', content: 'V = (4/3)·π·R³' },
      { step: 4, title: 'Secțiune cu plan la distanța d de centru', content: 'Raza secțiunii: r = √(R²-d²)' },
      { step: 5, title: 'Cilindru circumscris sferei', content: 'r_cil = R, h_cil = 2R' },
    ],
    notation_rules: { arie: 'S = 4πR²', volum: 'V = (4/3)πR³', sectiune: "r' = √(R²-d²)" },
    examples: [
      { problem: 'Sferă cu R=3. Calculați S și V.', solution: 'S=4π·9=36π; V=(4/3)·π·27=36π', answer: 'S = 36π u.p., V = 36π u.c.' },
    ],
    common_mistakes: [
      { mistake: 'V = (2/3)πR³ sau (1/3)πR³', correction: 'Volumul sferei: V = (4/3)πR³' },
    ],
    importance_score: 8,
    validated: true,
  },

  // ── PROBABILITĂȚI (3) ──────────────────────────────────────

  {
    exercise_type: 'probabilitate_clasica_aplicatii',
    exercise_type_label: 'Probabilitate clasică — aplicații BAC MD',
    method_name: 'Formula lui Laplace: P(A) = n(A)/n(Ω)',
    grade_level: 12,
    topic: 'probabilitati',
    subtopic: 'probabilitate_clasica',
    description: 'Aplicarea formulei lui Laplace în contexte BAC MD: extrageri, aranjare în rând, selecție. Evenimentele complementare P(A̅) = 1 - P(A).',
    steps: [
      { step: 1, title: 'Identifică spațiul de probabilitate Ω (toate rezultatele posibile)' },
      { step: 2, title: 'Numără n(Ω) = total rezultate posibile' },
      { step: 3, title: 'Identifică evenimentul A și numără n(A) = rezultate favorabile' },
      { step: 4, title: 'P(A) = n(A)/n(Ω)' },
      { step: 5, title: 'P(A̅) = 1 - P(A) (eveniment complementar)' },
    ],
    notation_rules: { formula: 'P(A) = n(A)/n(Ω)', complementar: 'P(Ā) = 1 - P(A)', interval: '0 ≤ P(A) ≤ 1' },
    examples: [
      { problem: 'O urnă conține 3 bile roșii și 7 albe. Se extrage o bilă. P(roșie) = ?', solution: 'n(Ω)=10, n(A)=3; P(A)=3/10', answer: 'P(roșie) = 3/10 = 0.3' },
    ],
    common_mistakes: [
      { mistake: 'n(Ω) = n(A) + n(B) când A și B nu sunt complementare', correction: 'n(Ω) = toate rezultatele posibile, nu suma favorabilelor unor evenimente' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'probabilitate_totala_formula',
    exercise_type_label: 'Probabilitate totală și formula lui Bayes',
    method_name: 'Teorema probabilității totale + Bayes',
    grade_level: 12,
    topic: 'probabilitati',
    subtopic: 'probabilitate_conditionata',
    description: 'Calculul probabilității unui eveniment A prin sistem complet de ipoteze H₁,...,Hₙ. Formula lui Bayes pentru probabilitate a posteriori.',
    steps: [
      { step: 1, title: 'Identifică sistemul complet de ipoteze H_i (partiție a Ω)', content: 'ΣP(H_i)=1, H_i disjuncte' },
      { step: 2, title: 'Probabilități condiționate P(A|H_i)' },
      { step: 3, title: 'Teorema probabilității totale', content: 'P(A) = Σ P(H_i)·P(A|H_i)' },
      { step: 4, title: 'Formula lui Bayes (dacă cerut)', content: 'P(H_k|A) = P(H_k)·P(A|H_k) / P(A)' },
    ],
    notation_rules: { prob_totala: 'P(A)=ΣP(H_i)·P(A|H_i)', bayes: 'P(H_k|A)=P(H_k)·P(A|H_k)/P(A)' },
    examples: [
      { problem: 'Urnă 1: 2R+3A; Urnă 2: 4R+1A. Selectăm urnă cu P=1/2 fiecare, tragem bilă. P(roșie)?', solution: 'P(R|U1)=2/5, P(R|U2)=4/5; P(R)=(1/2)(2/5)+(1/2)(4/5)=1/5+2/5=3/5', answer: 'P(roșie) = 3/5' },
    ],
    common_mistakes: [
      { mistake: 'Nu verifică că ipotezele formează partiție', correction: 'Ipotezele H_i trebuie să fie disjuncte și să acopere tot Ω: ΣP(H_i)=1' },
    ],
    importance_score: 7,
    validated: true,
  },

  {
    exercise_type: 'schema_bernoulli_binomiala',
    exercise_type_label: 'Schema lui Bernoulli — variabilă binomială',
    method_name: 'Probabilitatea k succese în n probe independente',
    grade_level: 12,
    topic: 'probabilitati',
    subtopic: 'schema_bernoulli',
    description: 'Calculul probabilității obținerii exact k succese în n probe Bernoulli independente cu probabilitatea de succes p. P_n(k) = C(n,k)·p^k·q^(n-k), q=1-p.',
    steps: [
      { step: 1, title: 'Identifică n (numărul de probe) și p (probabilitatea succesului)' },
      { step: 2, title: 'Calculează q = 1 - p' },
      { step: 3, title: 'Formula Bernoulli', content: 'P_n(k) = C(n,k)·p^k·q^(n-k)' },
      { step: 4, title: 'Calculează C(n,k) = n!/k!(n-k)!' },
      { step: 5, title: 'Calculează p^k și q^(n-k)' },
    ],
    notation_rules: { formula: 'P_n(k) = C(n,k)·p^k·q^(n-k)', q: 'q = 1-p', combinari: 'C(n,k) = n!/k!(n-k)!' },
    examples: [
      { problem: 'Aruncăm o monedă de 4 ori. P(exact 3 steme)?', solution: 'n=4, k=3, p=1/2, q=1/2; P_4(3)=C(4,3)·(1/2)³·(1/2)¹=4·1/8·1/2=4/16=1/4', answer: 'P = 1/4' },
    ],
    common_mistakes: [
      { mistake: 'P_n(k) = p^k·q^(n-k) (fără C(n,k))', correction: 'OBLIGATORIU înmulțit cu C(n,k) — numărul de moduri de a alege k probe cu succes' },
    ],
    importance_score: 7,
    validated: true,
  },

  // ── COMBINATORICĂ (2) ──────────────────────────────────────

  {
    exercise_type: 'permutari_aranjamente_aplicatii',
    exercise_type_label: 'Permutări, aranjamente și combinări — aplicații',
    method_name: 'Principiul numărării și formulele de bază',
    grade_level: 12,
    topic: 'combinatorica',
    subtopic: 'combinatorica',
    description: 'Aplicarea sistematică a permutărilor, aranjamentelor și combinărilor la probleme concrete. Regula produsului și a sumei.',
    steps: [
      { step: 1, title: 'Identifică dacă ordinea contează', content: 'Ordinea contează → permutări sau aranjamente; nu contează → combinări' },
      { step: 2, title: 'Permutări de n elemente', content: 'P_n = n!' },
      { step: 3, title: 'Aranjamente', content: 'A(n,k) = n!/(n-k)!' },
      { step: 4, title: 'Combinări', content: 'C(n,k) = n!/k!(n-k)!' },
      { step: 5, title: 'Regula produsului: dacă alegem independent k₁ din n₁ și k₂ din n₂: total = n₁k₁ × n₂k₂' },
    ],
    notation_rules: { permutari: 'P_n = n!', aranjamente: 'A(n,k)=n!/(n-k)!', combinari: 'C(n,k)=n!/k!(n-k)!' },
    examples: [
      { problem: 'Câte echipe de 3 din 8 jucători se pot forma?', solution: 'Ordinea nu contează → combinări; C(8,3)=8!/(3!·5!)=56', answer: '56 echipe' },
    ],
    common_mistakes: [
      { mistake: 'Confundă A(n,k) cu C(n,k)', correction: 'Dacă ordinea selecției contează (delegat 1, delegat 2,...): A(n,k); dacă nu: C(n,k)' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'binom_newton_termen_general',
    exercise_type_label: 'Binomul lui Newton — termenul general T(k+1)',
    method_name: 'Termenul general din dezvoltarea (a+b)^n',
    grade_level: 12,
    topic: 'combinatorica',
    subtopic: 'binom_newton',
    description: 'Formula termenului general T(k+1) = C(n,k)·a^(n-k)·b^k din dezvoltarea binomului lui Newton. Aplicații: termenul care nu conține x, termenul de rang dat.',
    steps: [
      { step: 1, title: 'Identifică a, b, n din (a+b)^n' },
      { step: 2, title: 'Termenul general', content: 'T(k+1) = C(n,k)·a^(n-k)·b^k, k=0,1,...,n' },
      { step: 3, title: 'Găsește k pentru termenul cerut', content: 'Rezolvă condiția (ex: exponent = 0 pentru termenul liber)' },
      { step: 4, title: 'Calculează T(k+1) cu valoarea găsită a lui k' },
    ],
    notation_rules: { termen_general: 'T_{k+1} = C(n,k)·a^{n-k}·b^k', index: 'k = 0, 1, ..., n' },
    examples: [
      { problem: 'Termenul liber (fără x) din (x + 1/x)^6.', solution: 'T(k+1)=C(6,k)·x^(6-k)·(1/x)^k=C(6,k)·x^(6-2k); 6-2k=0→k=3; T₄=C(6,3)=20', answer: 'Termenul liber = 20' },
    ],
    common_mistakes: [
      { mistake: 'T_k = C(n,k)·... (indexarea de la 1)', correction: 'Termenul de index k+1 corespunde combinării C(n,k). T₁ corespunde k=0.' },
    ],
    importance_score: 7,
    validated: true,
  },

  // ── NUMERE COMPLEXE (2) ────────────────────────────────────

  {
    exercise_type: 'complex_forma_algebrica_operatii',
    exercise_type_label: 'Numere complexe — operații în formă algebrică',
    method_name: 'Adunare, scădere, înmulțire și împărțire complexe',
    grade_level: 12,
    topic: 'numere_complexe',
    subtopic: 'forma_algebrica',
    description: 'Operații cu numere complexe în forma z=a+bi. Conjugatul z̄=a-bi. Modulul |z|=√(a²+b²). Împărțire prin înmulțire cu conjugatul numitorului.',
    steps: [
      { step: 1, title: 'Adunare/scădere: (a+bi)±(c+di) = (a±c)+(b±d)i' },
      { step: 2, title: 'Înmulțire: (a+bi)(c+di) = (ac-bd)+(ad+bc)i, deoarece i²=-1' },
      { step: 3, title: 'Conjugatul: z̄ = a-bi; z·z̄ = a²+b² = |z|²' },
      { step: 4, title: 'Împărțire: z₁/z₂ = (z₁·z̄₂)/(z₂·z̄₂) = (z₁·z̄₂)/|z₂|²' },
      { step: 5, title: 'Separă partea reală și imaginară, scrie în forma a+bi' },
    ],
    notation_rules: { conjugat: 'z̄ = a-bi', modul: '|z| = √(a²+b²)', i2: 'i² = -1' },
    examples: [
      { problem: '(2+3i)/(1-i)', solution: 'Înmulțim cu (1+i)/(1+i): (2+3i)(1+i)/((1-i)(1+i)) = (2+2i+3i+3i²)/2 = (2+5i-3)/2 = (-1+5i)/2 = -1/2 + 5i/2', answer: '-1/2 + 5i/2' },
    ],
    common_mistakes: [
      { mistake: 'i² = 1', correction: 'i² = -1 (definiția numărului imaginar i = √(-1))' },
    ],
    importance_score: 8,
    validated: true,
  },

  {
    exercise_type: 'complex_modul_argument_forme',
    exercise_type_label: 'Modulul, argumentul și forma trigonometrică',
    method_name: 'Forma trigonometrică z=r(cosφ+i sinφ) și formula lui Moivre',
    grade_level: 12,
    topic: 'numere_complexe',
    subtopic: 'forma_trigonometrica',
    description: 'Convertirea numărului complex din forma algebrică în forma trigonometrică și invers. Formula lui Moivre pentru puteri. Argummentul (unghiul) φ ∈ [0, 2π).',
    steps: [
      { step: 1, title: 'Calculează modulul r = |z| = √(a²+b²)' },
      { step: 2, title: 'Calculează argumentul φ', content: 'cos φ = a/r, sin φ = b/r; φ = atan2(b,a) ∈ [0,2π)' },
      { step: 3, title: 'Forma trigonometrică: z = r(cos φ + i sin φ)' },
      { step: 4, title: 'Formula lui Moivre', content: 'z^n = r^n(cos nφ + i sin nφ)' },
      { step: 5, title: 'Înmulțire/împărțire în formă trig: modulele se înmulțesc/împart, argumentele se adună/scad' },
    ],
    notation_rules: { modul: 'r = |z| = √(a²+b²)', argument: 'φ = arg(z)', moivre: 'z^n = r^n(cos nφ + i sin nφ)' },
    examples: [
      { problem: 'z = 1+i. Scrie în formă trigonometrică și calculează z⁴.', solution: 'r=√2, φ=π/4; z=√2(cos π/4+i sin π/4); z⁴=(√2)⁴(cos π+i sin π)=4(-1+0i)=-4', answer: 'z = √2(cos π/4 + i sin π/4); z⁴ = -4' },
    ],
    common_mistakes: [
      { mistake: 'Argumentul φ greșit (cadranul ignorat)', correction: 'Verifică cadranul: dacă a<0, b>0 → φ ∈ (π/2, π). atan2(b,a) ≠ arctan(b/a) în general.' },
    ],
    importance_score: 7,
    validated: true,
  },

  // ── MATRICE (1) ────────────────────────────────────────────

  {
    exercise_type: 'matrice_operatii_determinant',
    exercise_type_label: 'Matrice — operații și determinanți',
    method_name: 'Operații cu matrice și calculul determinanților',
    grade_level: 12,
    topic: 'matrice',
    subtopic: 'matrice',
    description: 'Operații cu matrice: adunare, înmulțire cu scalar, înmulțire de matrice. Determinantul ordinului 2 și 3 (regula lui Sarrus). Inversa matricei 2×2.',
    steps: [
      { step: 1, title: 'Adunare: A+B (elementele corespunzătoare); condiție: aceleași dimensiuni' },
      { step: 2, title: 'Produs A·B: rândul i al lui A cu coloana j al lui B', content: '(AB)ij = Σ a_ik · b_kj' },
      { step: 3, title: 'Det(2×2): |a b; c d| = ad - bc' },
      { step: 4, title: 'Det(3×3) — Regula lui Sarrus', content: 'suma diagonalelor principale minus suma diagonalelor secundare' },
      { step: 5, title: 'Inversa: A⁻¹ = (1/det A)·adj(A); există dacă det(A) ≠ 0' },
    ],
    notation_rules: { det2: 'det = ad-bc', produs: 'AB≠BA în general', inversa: 'A⁻¹ dacă det≠0' },
    examples: [
      { problem: 'A=[1 2; 3 4]. Calculați det(A) și A⁻¹.', solution: 'det=1·4-2·3=4-6=-2; A⁻¹=(1/-2)·[4 -2; -3 1]=[-2 1; 3/2 -1/2]', answer: 'det(A)=-2; A⁻¹=[−2 1; 3/2 −1/2]' },
    ],
    common_mistakes: [
      { mistake: 'AB = BA (comutativitate incorectă)', correction: 'Înmulțirea matricelor NU este comutativă în general: AB ≠ BA' },
    ],
    importance_score: 7,
    validated: true,
  },

];
