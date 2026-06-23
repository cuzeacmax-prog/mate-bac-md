/**
 * greeting.ts — ETAPA 83 FAZA F (momentele 1 & 4): salutul „viu", DETERMINIST din
 * date reale (zero LLM). Produsul „vorbește" la intrare (pe nume + stare) și la
 * întoarcerea după pauză. Restul produsului rămâne sobru.
 */

export interface GreetingInput {
  name: string | null;
  /** ultimul concept stăpânit (ieri) — null dacă nu există istoric */
  lastConcept: string | null;
  /** următorul concept recomandat — null dacă nu se cunoaște */
  nextConcept: string | null;
  /** zile de la ultima activitate (0 = azi) */
  daysSinceActive: number;
}

export interface Greeting {
  title: string;
  sub: string;
  /** marcaj pentru ton vizual (întoarcere = mai cald) */
  tone: 'return' | 'start' | 'continue';
}

/** prenumele = primul cuvânt din numele complet, curățat */
function firstName(name: string | null): string | null {
  const t = (name ?? '').trim();
  if (!t) return null;
  return t.split(/\s+/)[0];
}

const PAUSE_DAYS = 3;

export function buildGreeting(input: GreetingInput): Greeting {
  const fn = firstName(input.name);
  const hi = fn ? `, ${fn}` : '';

  // moment 4: întoarcere după pauză
  if (input.daysSinceActive >= PAUSE_DAYS) {
    const sub = input.nextConcept
      ? `Ți-am păstrat locul — reluăm cu ${input.nextConcept}.`
      : 'Ți-am păstrat locul — reluăm de unde ai rămas.';
    return { title: `Bine ai revenit${hi}!`, sub, tone: 'return' };
  }

  // moment 1 (start): fără istoric
  if (!input.lastConcept) {
    const sub = input.nextConcept
      ? `Astăzi pornim cu ${input.nextConcept}.`
      : 'Hai să vedem de unde începem azi.';
    return { title: `Bună${hi}!`, sub, tone: 'start' };
  }

  // moment 1 (continuare): stare reală — ieri X → azi Y
  const sub = input.nextConcept
    ? `Ieri ai terminat ${input.lastConcept} — azi continuă cu ${input.nextConcept}.`
    : `Ieri ai lucrat la ${input.lastConcept}. Continuăm de aici.`;
  return { title: `Bună${hi}.`, sub, tone: 'continue' };
}
