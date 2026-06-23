import { describe, it, expect } from 'vitest';
import { buildGreeting } from '@/lib/daily/greeting';

describe('ETAPA 83 F — salut viu, determinist din date', () => {
  it('întoarcere după pauză (≥3 zile) → „Bine ai revenit, [nume]"', () => {
    const g = buildGreeting({ name: 'Ana', lastConcept: 'derivate', nextConcept: 'integrale', daysSinceActive: 5 });
    expect(g.title).toContain('Bine ai revenit');
    expect(g.title).toContain('Ana');
  });

  it('intrare normală: salut pe nume + stare reală (ieri X → azi Y)', () => {
    const g = buildGreeting({ name: 'Ion', lastConcept: 'derivate', nextConcept: 'integrale', daysSinceActive: 1 });
    expect(g.title).toContain('Ion');
    expect(g.sub).toContain('derivate');
    expect(g.sub).toContain('integrale');
  });

  it('fără nume → salut neutru, fără „undefined"', () => {
    const g = buildGreeting({ name: null, lastConcept: null, nextConcept: 'logaritmi', daysSinceActive: 0 });
    expect(g.title.toLowerCase()).not.toContain('undefined');
    expect(g.title.toLowerCase()).not.toContain('null');
    expect(g.title.length).toBeGreaterThan(0);
  });

  it('primul concept (fără istoric) → invitație de start cu următorul', () => {
    const g = buildGreeting({ name: 'Maria', lastConcept: null, nextConcept: 'funcția de gradul II', daysSinceActive: 0 });
    expect(g.title).toContain('Maria');
    expect(g.sub).toContain('funcția de gradul II');
  });

  it('fără next concept → nu inventează, mesaj blând', () => {
    const g = buildGreeting({ name: 'Dan', lastConcept: 'integrale', nextConcept: null, daysSinceActive: 1 });
    expect(g.sub.toLowerCase()).not.toContain('undefined');
    expect(g.sub.toLowerCase()).not.toContain('null');
  });

  it('determinist: aceeași intrare → aceeași ieșire', () => {
    const a = buildGreeting({ name: 'X', lastConcept: 'a', nextConcept: 'b', daysSinceActive: 2 });
    const b = buildGreeting({ name: 'X', lastConcept: 'a', nextConcept: 'b', daysSinceActive: 2 });
    expect(a).toEqual(b);
  });

  it('prenume extras din nume complet (primul cuvânt)', () => {
    const g = buildGreeting({ name: 'Ion Popescu', lastConcept: null, nextConcept: 'x', daysSinceActive: 0 });
    expect(g.title).toContain('Ion');
    expect(g.title).not.toContain('Popescu');
  });
});
