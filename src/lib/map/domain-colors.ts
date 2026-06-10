/**
 * domain-colors.ts — ETAPA 71 A2: maparea modul → culoarea de domeniu.
 * Valorile CSS trăiesc în globals.css (cu variante dark + poarta de contrast);
 * aici e doar cheia și etichetele. Culoarea e în ramă — matematica rămâne
 * monocromă (--math-fg).
 */

export interface DomainColor {
  /** sufixul tokenului: var(--domain-<key>) / -bg / -fg */
  key: 'i' | 'ii' | 'iii' | 'iv' | 'v' | 'vi' | 'viii';
  label: string;
}

export const MODULE_DOMAINS: Record<string, DomainColor> = {
  'Modulul I': { key: 'i', label: 'Primitive și integrale nedefinite' },
  'Modulul II': { key: 'ii', label: 'Integrala definită și arii' },
  'Modulul III': { key: 'iii', label: 'Combinatorică și binom' },
  'Modulul IV': { key: 'iv', label: 'Probabilități și statistică' },
  'Modulul V': { key: 'v', label: 'Poliedre' },
  'Modulul VI': { key: 'vi', label: 'Corpuri de rotație' },
  'Modulul VIII': { key: 'viii', label: 'Polinoame' },
};

export function domainVar(module: string, kind: '' | 'bg' | 'fg' = ''): string {
  const d = MODULE_DOMAINS[module];
  if (!d) return kind === 'bg' ? 'var(--muted)' : kind === 'fg' ? 'var(--muted-foreground)' : 'var(--primary)';
  return `var(--domain-${d.key}${kind ? `-${kind}` : ''})`;
}
