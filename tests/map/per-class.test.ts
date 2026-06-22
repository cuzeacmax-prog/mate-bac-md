import { describe, it, expect } from 'vitest';
import {
  domainsForGrade,
  nodesForGrade,
  graphTotalNodes,
  gradesWithContent,
} from '@/lib/map/per-class';

// hartă minimală de test: domeniul A are clasele 10 & 12, domeniul B doar 12.
const fakeMap = {
  domains: [
    {
      key: 'a',
      grades: {
        '10': { nodes: [{ id: '1' }, { id: '2' }] },
        '12': { nodes: [{ id: '3' }] },
      },
    },
    {
      key: 'b',
      grades: {
        '12': { nodes: [{ id: '4' }, { id: '5' }, { id: '6' }] },
      },
    },
  ],
} as unknown as Parameters<typeof graphTotalNodes>[0];

describe('ETAPA 82 B — filtrarea hărții per clasă', () => {
  it('graphTotalNodes numără tot graful', () => {
    expect(graphTotalNodes(fakeMap)).toBe(6);
  });

  it('nodesForGrade numără DOAR clasa cerută (dovada numărată)', () => {
    expect(nodesForGrade(fakeMap, 10)).toBe(2); // doar domeniul A clasa 10
    expect(nodesForGrade(fakeMap, 12)).toBe(4); // A(1) + B(3)
    expect(nodesForGrade(fakeMap, 9)).toBe(0); // clasă fără conținut
    expect(nodesForGrade(fakeMap, 11)).toBe(0);
  });

  it('un elev de clasa 10 vede strict mai puține noduri decât tot graful', () => {
    expect(nodesForGrade(fakeMap, 10)).toBeLessThan(graphTotalNodes(fakeMap));
  });

  it('domainsForGrade întoarce doar domeniile cu acea clasă', () => {
    expect(domainsForGrade(fakeMap, 10)).toEqual(['a']);
    expect(domainsForGrade(fakeMap, 12).sort()).toEqual(['a', 'b']);
    expect(domainsForGrade(fakeMap, 9)).toEqual([]);
  });

  it('gradesWithContent listează clasele care există undeva în graf, sortate', () => {
    expect(gradesWithContent(fakeMap)).toEqual([10, 12]);
  });
});
