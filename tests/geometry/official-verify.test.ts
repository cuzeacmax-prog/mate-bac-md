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
  it('frustum (trunchi de piramidă) — operator lipsă', () => {
    const r = verifyGeometry('Aflați volumul unui trunchi de piramidă patrulateră regulată...', 'F(x) = ...');
    expect(r.verdict).toBe('nerezolvabil-cas');
    expect(r.capability).toMatch(/frustum/i);
  });
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
