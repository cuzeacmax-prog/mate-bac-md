/**
 * ETAPA 73 FAZA D1 — tabelele markdown din enunțuri: extragere + detecție
 * de markdown nerandabil (pipe-uri brute care nu parsează ca tabel).
 */
import { describe, it, expect } from 'vitest';
import { extractMarkdownTable, hasUnrenderableMarkdown } from '@/lib/content/markdown-table';

const TABLE_STATEMENT = `Completați tabelul pentru prisma dreaptă:

| a | h | m |
|---|---|---|
| 3 | 4 | 5 |
| 6 | 8 | 10 |

Calculați aria totală.`;

describe('extractMarkdownTable', () => {
  it('extrage tabelul cu textul dinainte și de după', () => {
    const t = extractMarkdownTable(TABLE_STATEMENT);
    expect(t).not.toBeNull();
    expect(t!.columns).toEqual(['a', 'h', 'm']);
    expect(t!.rows).toEqual([['3', '4', '5'], ['6', '8', '10']]);
    expect(t!.before).toContain('Completați tabelul');
    expect(t!.after).toContain('aria totală');
  });

  it('text fără tabel → null', () => {
    expect(extractMarkdownTable('Rezolvați ecuația $x^2 - 9 = 0$.')).toBeNull();
  });

  it('modúl matematic $|x|$ nu e confundat cu tabel', () => {
    expect(extractMarkdownTable('Calculați $|x - 3| + |x + 1|$ pentru x real.')).toBeNull();
  });
});

describe('hasUnrenderableMarkdown', () => {
  it('tabel valid → randabil (false)', () => {
    expect(hasUnrenderableMarkdown(TABLE_STATEMENT)).toBe(false);
  });
  it('pipe-uri de tabel FĂRĂ separator → nerandabil (true)', () => {
    const broken = 'Valori:\n| a | h | m |\n| 3 | 4 | 5 fără separator';
    expect(hasUnrenderableMarkdown(broken)).toBe(true);
  });
  it('modulele matematice în $ nu declanșează detecția', () => {
    expect(hasUnrenderableMarkdown('Fie $|a|=2$ și $|b|=3$.\nCalculați $|a+b|$ și $|a-b|$.')).toBe(false);
  });
});
