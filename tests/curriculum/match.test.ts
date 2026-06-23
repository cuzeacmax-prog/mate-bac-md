import { describe, it, expect } from 'vitest';
import { fold, conceptTokens, buildClassIndex, matchConcept, type ClassCuprins } from '@/lib/curriculum/match';

// fixtură controlată (NU manualul real) — determinism pentru eșec-întâi
const FIXTURE: ClassCuprins[] = [
  {
    grade: 9,
    modules: [
      { title: 'Algebră — Capitolul 2. Funcții', page: 22, themes: [{ title: '§ 3. Funcția de gradul II', page: 31 }] },
      { title: 'Geometrie — Capitolul 2. Cercul', page: 141, themes: [{ title: '§ 2. Unghiuri înscrise în cerc', page: 148 }] },
    ],
  },
  {
    grade: 10,
    modules: [
      { title: 'Modulul 3. Radicali. Puteri. Logaritmi', page: 27, themes: [{ title: '§ 3. Logaritmi', page: 38 }] },
      { title: 'Modulul 4. Elemente de combinatorică. Binomul lui Newton', page: 46, themes: [{ title: '§ 2. Binomul lui Newton', page: 57 }] },
      { title: 'Modulul 7. Funcţii elementare', page: 106, themes: [{ title: '§ 2. Funcţia de gradul II', page: 111 }] },
    ],
  },
  {
    grade: 12,
    modules: [
      { title: 'Modulul 2. PRIMITIVE ȘI INTEGRALE NEDEFINITE', page: 11, themes: [{ title: '§ 1. Noțiunea de primitivă a unei funcții', page: 12 }] },
      { title: 'Modulul 9. RECAPITULARE FINALĂ', page: 181, isRecap: true, themes: [{ title: '§ 8. Binomul lui Newton', page: 219 }] },
    ],
  },
];

describe('ETAPA 83 A2 — matcher concept→clasă (din manuale, onest)', () => {
  it('fold normalizează diacritice + caz', () => {
    expect(fold('Funcția de Gradul II')).toBe('functia de gradul ii');
    expect(fold('binomul lui Newton')).toBe('binomul lui newton');
  });

  it('conceptTokens scoate stopwords structurale, păstrează nouni de conținut', () => {
    const t = conceptTokens('aria sectorului de disc');
    expect(t).toContain('aria');
    expect(t).toContain('sectorului');
    expect(t).toContain('disc');
    expect(t).not.toContain('de');
  });

  it('potrivire FERMĂ unică: binomul lui Newton → clasa 10', () => {
    const idx = buildClassIndex(FIXTURE);
    const r = matchConcept({ slug: 'g10-binomul-lui-newton', name: 'binomul lui Newton', grade_level: 10 }, idx);
    expect(r.proposedGrade).toBe(10);
    expect(r.confidence).toBe('firm');
    expect(r.source).toMatch(/clasa-10|Newton/i);
  });

  it('potrivire FERMĂ: primitivă → clasa 12 (modul de bază, nu recap)', () => {
    const idx = buildClassIndex(FIXTURE);
    const r = matchConcept({ slug: 'g12-primitiva', name: 'primitivă', grade_level: 12 }, idx);
    expect(r.proposedGrade).toBe(12);
    expect(r.confidence).toBe('firm');
  });

  it('AMBIGUU → NESIGUR: funcția de gradul II apare în clasa 9 ȘI 10', () => {
    const idx = buildClassIndex(FIXTURE);
    const r = matchConcept({ slug: 'g10-functia-de-gradul-ii', name: 'funcția de gradul II', grade_level: 10 }, idx);
    expect(r.confidence).toBe('nesigur');
    expect(new Set(r.candidates.map((c) => c.grade)).size).toBeGreaterThan(1);
  });

  it('un singur cuvânt GENERIC (real) NU produce o potrivire fermă', () => {
    const idx = buildClassIndex(FIXTURE);
    const r = matchConcept({ slug: 'g9-modulul-numarului-real', name: 'modulul numărului real', grade_level: 9 }, idx);
    expect(r.confidence).toBe('nesigur');
  });

  it('fără potrivire → NESIGUR (nu ghicim)', () => {
    const idx = buildClassIndex(FIXTURE);
    const r = matchConcept({ slug: 'g11-xyzzy-inexistent', name: 'xyzzy inexistent qwerty', grade_level: 11 }, idx);
    expect(r.confidence).toBe('nesigur');
    expect(r.proposedGrade).toBeNull();
  });

  it('potrivire DOAR în modul de recapitulare → NESIGUR (recap nu e clasa de origine)', () => {
    // un concept al cărui singur match e în Modulul 9 RECAPITULARE FINALĂ (clasa 12)
    const idx = buildClassIndex([
      { grade: 12, modules: [{ title: 'Modulul 9. RECAPITULARE FINALĂ', page: 181, isRecap: true, themes: [{ title: '§ 9. Geometrie în plan și în spațiu', page: 223 }] }] },
    ]);
    const r = matchConcept({ slug: 'g10-geometrie-plana', name: 'geometrie în plan', grade_level: 10 }, idx);
    expect(r.confidence).toBe('nesigur');
  });

  it('confirmare: proposedGrade poate fi egal cu grade_level curent (nu e o schimbare)', () => {
    const idx = buildClassIndex(FIXTURE);
    const r = matchConcept({ slug: 'g10-logaritmi', name: 'logaritmi', grade_level: 10 }, idx);
    expect(r.proposedGrade).toBe(10);
    expect(r.isChange).toBe(false);
  });
});
