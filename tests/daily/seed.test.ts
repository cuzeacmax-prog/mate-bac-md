import { describe, it, expect } from 'vitest';
import { hashSeed, mulberry32, pickDeterministic, chisinauToday } from '@/lib/daily/daily';

describe('daily — determinism (ETAPA 14 P1)', () => {
  it('hashSeed e stabil pentru același input', () => {
    expect(hashSeed('user:2026-06-10')).toBe(hashSeed('user:2026-06-10'));
    expect(hashSeed('user:2026-06-10')).not.toBe(hashSeed('user:2026-06-11'));
  });

  it('mulberry32 produce aceeași secvență pentru același seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('pickDeterministic: același seed → aceeași alegere; seed diferit → poate diferi', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const p1 = pickDeterministic(items, 3, 1234);
    const p2 = pickDeterministic(items, 3, 1234);
    expect(p1).toEqual(p2);
    expect(p1).toHaveLength(3);
    expect(new Set(p1).size).toBe(3); // fără duplicate
  });

  it('pickDeterministic nu depășește mărimea listei', () => {
    expect(pickDeterministic(['x'], 3, 7)).toEqual(['x']);
  });

  it('chisinauToday întoarce YYYY-MM-DD', () => {
    expect(chisinauToday(new Date('2026-06-10T12:00:00Z'))).toBe('2026-06-10');
    // miezul nopții UTC = 03:00 la Chișinău (vara) → aceeași zi
    expect(chisinauToday(new Date('2026-06-10T00:30:00Z'))).toBe('2026-06-10');
    // 22:30 UTC = 01:30 a doua zi la Chișinău
    expect(chisinauToday(new Date('2026-06-10T22:30:00Z'))).toBe('2026-06-11');
  });
});
