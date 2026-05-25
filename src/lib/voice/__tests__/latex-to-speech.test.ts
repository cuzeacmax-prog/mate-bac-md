/**
 * latex-to-speech.test.ts
 * Teste unitare pentru pipeline-ul de conversie LaTeX → speech.
 *
 * Rulare: npx jest src/lib/voice/__tests__/latex-to-speech.test.ts
 */

import { latexToSpeech } from '../latex-to-speech';

describe('latexToSpeech — Pipeline v2', () => {

  // ── Pasul 1: removeExplanatoryParens ─────────────────────────────
  describe('Pasul 1 — removeExplanatoryParens', () => {
    test('elimină paranteză explicativă după acronim', () => {
      const input = 'DVA (Domeniu Valorilor Admisibile): x > 0';
      const result = latexToSpeech(input);
      expect(result).not.toContain('Domeniu Valorilor Admisibile');
      expect(result).toContain('DVA');
    });

    test('lasă neschimbate parantezele scurte (< 12 chars)', () => {
      const input = 'dvs. (dacă e ok)';
      const result = latexToSpeech(input);
      // Paranteza are < 12 chars, nu trebuie eliminată
      expect(result).toContain('dacă e ok');
    });

    test('elimină mai mulți acronimi cu paranteză', () => {
      const input = 'RAC (Relații și Calcule Algebrice) și DVA (Domeniu Valorilor Admisibile)';
      const result = latexToSpeech(input);
      expect(result).not.toContain('Relații și Calcule Algebrice');
      expect(result).not.toContain('Domeniu Valorilor Admisibile');
      expect(result).toContain('RAC');
      expect(result).toContain('DVA');
    });
  });

  // ── Pasul 2+3: KaTeX + LaTeX → cuvinte ───────────────────────────
  describe('Pasul 2+3 — stripKatexDelimiters + applyMathRules', () => {
    test('x^2 → "la pătrat"', () => {
      const result = latexToSpeech('$x^2$');
      expect(result.toLowerCase()).toContain('la pătrat');
    });

    test('\\Delta → "delta"', () => {
      const result = latexToSpeech('$\\Delta = b^2 - 4ac$');
      expect(result.toLowerCase()).toContain('delta');
      expect(result.toLowerCase()).toContain('la pătrat');
    });

    test('\\frac{a}{b} → "a pe b"', () => {
      const result = latexToSpeech('$\\frac{x+1}{2}$');
      expect(result).toContain('pe');
    });

    test('\\sqrt{x} → "radical din x"', () => {
      const result = latexToSpeech('$\\sqrt{\\Delta}$');
      expect(result.toLowerCase()).toContain('radical din');
    });

    test('\\log_2 → "logaritm în baza 2 din"', () => {
      const result = latexToSpeech('$\\log_2(x)$');
      expect(result.toLowerCase()).toContain('logaritm');
    });

    test('\\sin, \\cos → trigonometrice', () => {
      const result = latexToSpeech('$\\sin(x) + \\cos(x)$');
      expect(result.toLowerCase()).toContain('sinus');
      expect(result.toLowerCase()).toContain('cosinus');
    });

    test('\\leq, \\geq → comparații', () => {
      const result = latexToSpeech('$x \\leq 5$ și $y \\geq 0$');
      expect(result).toContain('mai mic sau egal cu');
      expect(result).toContain('mai mare sau egal cu');
    });

    test('\\mathbb{R} → "mulțimea numerelor reale"', () => {
      const result = latexToSpeech('$x \\in \\mathbb{R}$');
      expect(result.toLowerCase()).toContain('mulțimea numerelor reale');
    });
  });

  // ── Pasul 4: expandFunctionNotation ──────────────────────────────
  describe('Pasul 4 — expandFunctionNotation', () => {
    test('f(x) → "eff de iks"', () => {
      const result = latexToSpeech('f(x) = x^2 + 1');
      expect(result.toLowerCase()).toContain('eff de iks');
    });

    test("f'(x) → \"eff prim de iks\"", () => {
      const result = latexToSpeech("f'(x) = 2x");
      expect(result.toLowerCase()).toContain('eff prim de iks');
    });

    test('g(t) → "ge de te"', () => {
      const result = latexToSpeech('g(t) = t^2');
      expect(result.toLowerCase()).toContain('ge de te');
    });

    test('h(x) → "ha de iks"', () => {
      const result = latexToSpeech('h(x) = 3x');
      expect(result.toLowerCase()).toContain('ha de iks');
    });
  });

  // ── Pasul 5: stripDecorations ─────────────────────────────────────
  describe('Pasul 5 — stripDecorations', () => {
    test('elimină block markers [[BLOCK:...]]', () => {
      const input = '[[BLOCK:step_1:DVA]]\nDVA: x > 0\n[[/BLOCK]]';
      const result = latexToSpeech(input);
      expect(result).not.toContain('[[BLOCK');
      expect(result).not.toContain('[[/BLOCK');
      expect(result.toLowerCase()).toContain('dva');
    });

    test('elimină markdown bold **text**', () => {
      const result = latexToSpeech('**Pasul 1:** calculăm discriminantul');
      expect(result).not.toContain('**');
      expect(result).toContain('Pasul 1');
    });

    test('elimină heading-uri # Titlu', () => {
      const result = latexToSpeech('# Titlu\n\nConținut.');
      expect(result).not.toContain('#');
      expect(result).toContain('Titlu');
    });

    test('elimină emoji 📋 ✦ ✓', () => {
      const result = latexToSpeech('📋 PASUL 1 — DVA\n✦ Rezultat: x > 0\n✓ Verificare');
      expect(result).not.toContain('📋');
      expect(result).not.toContain('✦');
      expect(result).not.toContain('✓');
    });
  });

  // ── Pasul 6: expandShortNotations ────────────────────────────────
  describe('Pasul 6 — expandShortNotations', () => {
    test('fracții numerice 3/4 → "3 pe 4"', () => {
      const result = latexToSpeech('Rezultatul este 3/4 din total');
      expect(result).toContain('3 pe 4');
    });
  });

  // ── Pasul 7: normalizeRhythm ──────────────────────────────────────
  describe('Pasul 7 — normalizeRhythm', () => {
    test('adaugă punct final dacă lipsește', () => {
      const result = latexToSpeech('Calculăm discriminantul');
      expect(result).toMatch(/\.$/);
    });

    test('nu adaugă punct dacă există deja semnul', () => {
      const result = latexToSpeech('Calculăm discriminantul!');
      expect(result).not.toMatch(/!\.$/); // nu dublează
    });

    test('normalizează spații multiple', () => {
      const result = latexToSpeech('x  +  y   =   z');
      expect(result).not.toContain('  ');
    });
  });

  // ── Cazuri integrale (end-to-end) ─────────────────────────────────
  describe('Cazuri integrale E2E', () => {
    test('rezolvare ecuație de gradul 2 completă', () => {
      const input = `
📋 PASUL 1 — Calculăm discriminantul
De ce: $\\Delta = b^2 - 4ac$ este formula discriminantului.
Cum: $\\Delta = (-5)^2 - 4 \\cdot 1 \\cdot 6 = 25 - 24 = 1$
✦ DVA (Domeniu Valorilor Admisibile): $x \\in \\mathbb{R}$
      `.trim();

      const result = latexToSpeech(input);
      expect(result).not.toContain('📋');
      expect(result).not.toContain('$');
      expect(result).not.toContain('\\Delta');
      expect(result).not.toContain('Domeniu Valorilor Admisibile');
      expect(result.toLowerCase()).toContain('delta');
      expect(result.toLowerCase()).toContain('la pătrat');
      expect(result.toLowerCase()).toContain('dva');
    });

    test('funcție f(x)/h(x) nu produce artefacte', () => {
      const input = 'Fie f(x) = x^2 și h(x) = 2x + 1';
      const result = latexToSpeech(input);
      expect(result.toLowerCase()).toContain('eff de iks');
      expect(result.toLowerCase()).toContain('ha de iks');
      expect(result).not.toContain('\\');
      expect(result).not.toContain('{');
    });

    test('ecuație logaritmică cu DVA', () => {
      const input = 'DVA (Domeniu Valorilor Admisibile): $x - 1 > 0 \\iff x > 1$';
      const result = latexToSpeech(input);
      expect(result).not.toContain('Domeniu Valorilor Admisibile');
      expect(result).toContain('DVA');
      expect(result).not.toContain('\\iff');
      expect(result.toLowerCase()).toContain('dacă și numai dacă');
    });
  });
});
