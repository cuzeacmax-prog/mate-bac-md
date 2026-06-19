import { describe, it, expect } from 'vitest';
import { verifyGeometry } from '@/lib/geometry/official-verify';

/** Cazuri REALE din Modulele V-VI (enunț + răspuns oficial legat strict-bijectiv). */
const CONE_VERIFICAT: Array<{ name: string; statement: string; official: string }> = [
  {
    name: 'R=5,H=12 → generatoare 13',
    statement: 'Un con circular drept are raza bazei egală cu $5\\,cm$ și înălțimea de $12\\,cm$. Să se afle lungimea generatoarei conului.',
    official: '13\\,cm',
  },
  {
    name: 'H=4,R=3 → unghi sector 216°',
    statement: 'Înălțimea unui con are lungimea de $4\\,cm$, iar raza bazei conului de $3\\,cm$. Să se afle măsura unghiului la centru a sectorului de cerc care reprezintă desfășurata suprafeței laterale a conului.',
    official: '216°',
  },
  {
    name: 'g=10, α=30° → raza 5√3',
    statement: 'Generatoarea unui con are lungimea de $10\\,cm$ și formează cu planul bazei un unghi cu măsura de $30°$. Să se afle lungimea razei bazei conului.',
    official: '5\\sqrt{3}\\,cm',
  },
  {
    name: 'R=3, secțiune axială dreptunghică → aria 9',
    statement: 'Raza bazei unui con are lungimea $3\\,cm$. Secțiunea axială a conului este un triunghi dreptunghic. Să se afle aria acestei secțiuni.',
    official: '9\\,cm^2',
  },
  {
    name: 'axial echilateral, perimetru 3 → A_tot=3π/4, V=√3π/24',
    statement: 'Secțiunea axială a unui con este un triunghi echilateral cu perimetrul de $3\\,cm$. Să se afle aria totală și volumul conului.',
    official: 'S_t = \\dfrac{3\\pi}{4}\\,cm^2,\\quad V = \\dfrac{\\sqrt{3}\\pi}{24}\\,cm^3',
  },
  {
    name: 'unghi la vârf 120° → raport A_tot/A_lat=(2+√3)/2',
    statement: 'Măsura unghiului de la vîrful secțiunii axiale a unui con este egală cu $120°$. Să se afle raportul dintre aria totală și aria laterală a conului.',
    official: '\\dfrac{A_{tot}}{A_{lat}} = \\dfrac{2+\\sqrt{3}}{2}',
  },
  {
    name: 'g=6, α=60° → volum 9√3π',
    statement: 'Generatoarea unui con are lungimea $6\\,cm$ și formează cu planul bazei un unghi cu măsura de $60°$. Să se afle volumul conului.',
    official: '9\\sqrt{3}\\pi\\,cm^3',
  },
  {
    name: 'A_lat=65π, A_tot=90π → volum 100π',
    statement: 'Un con circular drept are aria laterală $65\\pi\\,cm^2$, iar aria totală $90\\pi\\,cm^2$. Să se afle volumul conului.',
    official: '100\\pi\\,cm^3',
  },
  {
    name: 'A_bază=9π, A_tot=24π → volum 12π',
    statement: 'Aria bazei unui con circular drept este $9\\pi\\,cm^2$, iar aria suprafeței totale este $24\\pi\\,cm^2$. Aflați volumul conului.',
    official: '12\\pi\\,cm^3',
  },
  {
    name: 'con echilater, V=9√3π → A_lat=18π, A_tot=27π',
    statement: 'Un con echilater (secțiunea axială este un triunghi echilateral) are volumul de $9\\sqrt{3}\\pi\\,cm^3$. Calculați aria laterală și aria totală a conului.',
    official: 'A_l = 18\\pi\\,cm^2,\\quad A_t = 27\\pi\\,cm^2',
  },
  {
    name: 'perimetru axial 18, A_tot=36π → A_lat=20π, V=16π',
    statement: 'Un con circular drept are secțiunea axială un triunghi isoscel cu perimetrul de $18\\,cm$. Aflați aria laterală și volumul conului, știind că aria totală a conului este de $36\\pi\\,cm^2$.',
    official: 'A_{lat} = 20\\pi\\,cm^2,\\quad V = 16\\pi\\,cm^3',
  },
];

const TETRA_VERIFICAT = [
  {
    name: 'tetraedru h=2√2 → A_tot=12√3',
    statement: 'Înălțimea unui tetraedru regulat este egală cu $2\\sqrt{2}\\, cm$. Aflați aria totală a tetraedrului.',
    official: 'A_{tot} = 12\\sqrt{3} \\text{ cm}^2',
  },
  {
    name: 'tetraedru desfășurare 144√3 → V=144√2',
    statement: 'Aria suprafeței care reprezintă desfășurarea ambalajului unei cutii de lapte de forma unui tetraedru regulat este egală cu $144\\sqrt{3}\\, cm^2$. Încap $250\\, ml$ de lapte în această cutie?',
    official: 'V = 144\\sqrt{2} \\text{ cm}^3. \\text{ Nu încap } 250\\,ml.',
  },
];

describe('FAZA A — con: răspuns oficial reprodus → VERIFICAT', () => {
  for (const c of CONE_VERIFICAT) {
    it(c.name, () => {
      const r = verifyGeometry(c.statement, c.official);
      expect(r.verdict, `${c.name} → ${r.note}`).toBe('verificat');
    });
  }
});

describe('FAZA A — tetraedru regulat → VERIFICAT', () => {
  for (const c of TETRA_VERIFICAT) {
    it(c.name, () => {
      const r = verifyGeometry(c.statement, c.official);
      expect(r.verdict, `${c.name} → ${r.note}`).toBe('verificat');
    });
  }
});

describe('FAZA A — forme neacoperite → NEREZOLVABIL (nu fals NECONCORDANT)', () => {
  it('secțiune oblică prin vârf (con) — capabilitate lipsă', () => {
    const r = verifyGeometry(
      'Înălțimea unui con are lungimea de $20\\,cm$, iar raza bazei conului de $25\\,cm$. Să se afle aria secțiunii duse prin vîrful conului, știind că distanța de la centrul bazei conului la planul secant este egală cu $12\\,cm$.',
      '500\\,cm^2'
    );
    expect(r.verdict).toBe('nerezolvabil-cas');
  });
  it('trunchi fără laturile bazelor → NEREZOLVABIL (date insuficiente)', () => {
    const r = verifyGeometry('Aflați volumul unui trunchi de piramidă patrulateră regulată...', 'F(x) = ...');
    expect(r.verdict).toBe('nerezolvabil-cas');
    expect(r.capability).toMatch(/trunchi|frustum|baze/i);
  });
});

// ════════════ ETAPA 80 — solvere extinse + POARTĂ ANTI-REGRES ════════════
// Fiecare familie: ≥1 pozitiv (răspuns cunoscut → VERIFICAT) + 1 negativ-control
// (răspuns greșit injectat → TREBUIE neconcordant; un solver care nu prinde
// răspunsul greșit e respins).
interface Caz { name: string; statement: string; official: string; expect: 'verificat' | 'neconcordant' | 'nerezolvabil-cas' }

const PARALELIPIPED: Caz[] = [
  { name: 'laturi 6,8 unghi 30, muchie 5 → A_tot=188', expect: 'verificat',
    statement: 'Lungimile laturilor bazei unui paralelipiped drept sunt egale cu $6\\,cm$ și $8\\,cm$, iar măsura unghiului dintre ele este de $30°$. Aflați aria totală a paralelipipedului, știind că muchia laterală are lungimea de $5\\,cm$.',
    official: 'A_t = 188\\,cm^2' },
  { name: 'NEGATIV-CONTROL: același enunț, oficial greșit 200 → neconcordant', expect: 'neconcordant',
    statement: 'Lungimile laturilor bazei unui paralelipiped drept sunt egale cu $6\\,cm$ și $8\\,cm$, iar măsura unghiului dintre ele este de $30°$. Aflați aria totală a paralelipipedului, știind că muchia laterală are lungimea de $5\\,cm$.',
    official: 'A_t = 200\\,cm^2' },
  { name: 'romb diagonale 6,8, diag-față 13 → A_tot=288', expect: 'verificat',
    statement: 'Baza unui paralelipiped drept este un romb cu diagonalele de $6\\,cm$ și $8\\,cm$, iar diagonala feței laterale are lungimea $13\\,cm$. Aflați aria totală a paralelipipedului.',
    official: 'A_t = 288\\,cm^2' },
  { name: 'laturi 6,8, o diagonală bază 12, muchie 5 → diagonale 9,13', expect: 'verificat',
    statement: 'Muchia laterală a unui paralelipiped drept are lungimea $5\\,cm$, laturile bazei au lungimile $6\\,cm$ și $8\\,cm$, iar una din diagonalele bazei are $12\\,cm$. Aflați lungimile diagonalelor paralelipipedului.',
    official: 'd_1 = 9\\,cm,\\; d_2 = 13\\,cm' },
  { name: 'unghi 30, fețe 6&12, bază 4 → V=12', expect: 'verificat',
    statement: 'Baza unui paralelipiped drept este un paralelogram cu unghiul ascuțit de $30°$. Două fețe laterale ale paralelipipedului au ariile respectiv egale cu $6\\,cm^2$ și $12\\,cm^2$, iar aria bazei este egală cu $4\\,cm^2$. Aflați volumul paralelipipedului.',
    official: 'V = 12\\,cm^3' },
  { name: 'muchie 10, laturi 23,11, raport diag 2:3 → secțiuni 200,300', expect: 'verificat',
    statement: 'Muchia laterală a unui paralelipiped drept are lungimea $10\\,cm$, laturile bazei au lungimile $23\\,cm$ și $11\\,cm$, iar raportul lungimilor diagonalelor bazei este de $2:3$. Aflați ariile secțiunilor diagonale ale paralelipipedului.',
    official: 'A_1 = 200\\,cm^2,\\; A_2 = 300\\,cm^2' },
];

const PIRAMIDA: Caz[] = [
  { name: 'tri regulată a=24, m=16 → h=8, A_lat=144√7', expect: 'verificat',
    statement: 'O piramidă triunghiulară regulată are latura bazei de $24\\,cm$ și muchia laterală de $16\\,cm$. Calculați înălțimea și aria laterală.',
    official: 'h = 8\\,cm;\\; A_{lat} = 144\\sqrt{7}\\,cm^2' },
  { name: 'NEGATIV-CONTROL: h greșit 9 → neconcordant', expect: 'neconcordant',
    statement: 'O piramidă triunghiulară regulată are latura bazei de $24\\,cm$ și muchia laterală de $16\\,cm$. Calculați înălțimea și aria laterală.',
    official: 'h = 9\\,cm;\\; A_{lat} = 144\\sqrt{7}\\,cm^2' },
];

const PRISMA: Caz[] = [
  { name: 'tri 4,5,7, muchie=înălț. mare → V=48', expect: 'verificat',
    statement: 'Laturile bazei unei prisme triunghiulare drepte au lungimile $4\\,cm$, $5\\,cm$, $7\\,cm$, iar muchia laterală a prismei are aceeași lungime ca și înălțimea mai mare a triunghiului din bază. Să se afle volumul prismei.',
    official: 'V=48\\,cm^3' },
  { name: 'NEGATIV-CONTROL: V greșit 50 → neconcordant', expect: 'neconcordant',
    statement: 'Laturile bazei unei prisme triunghiulare drepte au lungimile $4\\,cm$, $5\\,cm$, $7\\,cm$, iar muchia laterală a prismei are aceeași lungime ca și înălțimea mai mare a triunghiului din bază. Să se afle volumul prismei.',
    official: 'V=50\\,cm^3' },
];

const FRUSTUM: Caz[] = [
  { name: 'patrulater L=6,l=4,h=3 → V=76', expect: 'verificat',
    statement: 'Aflați volumul unui trunchi de piramidă patrulateră regulată cu laturile bazelor de $6\\,cm$ și $4\\,cm$ și înălțimea de $3\\,cm$.',
    official: 'V = 76\\,cm^3' },
  { name: 'NEGATIV-CONTROL: V greșit 80 → neconcordant', expect: 'neconcordant',
    statement: 'Aflați volumul unui trunchi de piramidă patrulateră regulată cu laturile bazelor de $6\\,cm$ și $4\\,cm$ și înălțimea de $3\\,cm$.',
    official: 'V = 80\\,cm^3' },
];

describe('ETAPA 80 — paralelipiped drept', () => {
  for (const c of PARALELIPIPED) it(c.name, () => { const r = verifyGeometry(c.statement, c.official); expect(r.verdict, r.note).toBe(c.expect); });
});
describe('ETAPA 80 — piramidă regulată', () => {
  for (const c of PIRAMIDA) it(c.name, () => { const r = verifyGeometry(c.statement, c.official); expect(r.verdict, r.note).toBe(c.expect); });
});
describe('ETAPA 80 — prismă dreaptă', () => {
  for (const c of PRISMA) it(c.name, () => { const r = verifyGeometry(c.statement, c.official); expect(r.verdict, r.note).toBe(c.expect); });
});
describe('ETAPA 80 — trunchi (frustum) regulat', () => {
  for (const c of FRUSTUM) it(c.name, () => { const r = verifyGeometry(c.statement, c.official); expect(r.verdict, r.note).toBe(c.expect); });
});

describe('FAZA A — răspuns oficial mis-legat (numeric, dar al altei probleme) → NECONCORDANT', () => {
  it('prismă base sides cerute, dar oficial e despre altă mărime', () => {
    // con cu g=10,α=30 (raza=5√3≈8.66) dar „oficial" pretinde 99 → neconcordant
    const r = verifyGeometry(
      'Generatoarea unui con are lungimea de $10\\,cm$ și formează cu planul bazei un unghi cu măsura de $30°$. Să se afle lungimea razei bazei conului.',
      'R = 99\\,cm'
    );
    expect(r.verdict).toBe('neconcordant');
  });
});
