/**
 * ETAPA 72 P2 — regresie pentru BUG-ul mesajelor dispărute:
 * un eveniment SSE tăiat la graniță de chunk NU se mai pierde.
 */
import { describe, it, expect } from 'vitest';
import { feedSse } from '@/lib/chat/sse';

describe('feedSse — buffer purtat între chunk-uri', () => {
  it('evenimentul done TĂIAT între două chunk-uri se reasamblează (bug-ul real)', () => {
    const done = `data: ${JSON.stringify({ done: true, conversationId: 'c1', metadata: { svgs: ['<svg>'.repeat(50)] } })}\n`;
    const cut = Math.floor(done.length / 2);
    const r1 = feedSse('', done.slice(0, cut));
    expect(r1.events).toHaveLength(0); // încă incomplet — NIMIC aruncat
    const r2 = feedSse(r1.buffer, done.slice(cut));
    expect(r2.events).toHaveLength(1);
    expect(r2.events[0].done).toBe(true); // done-ul SOSEȘTE — mesajul se comite
  });

  it('mai multe evenimente într-un chunk', () => {
    const r = feedSse('', 'data: {"text":"a"}\ndata: {"text":"b"}\ndata: {"done":true}\n');
    expect(r.events.map((e) => e.text ?? e.done)).toEqual(['a', 'b', true]);
    expect(r.buffer).toBe('');
  });

  it('text cu newline-uri în JSON escaped trece întreg', () => {
    const ev = `data: ${JSON.stringify({ text: 'linia 1\nlinia 2' })}\n`;
    const r = feedSse('', ev);
    expect(r.events[0].text).toBe('linia 1\nlinia 2');
  });

  it('ultima linie fără newline rămâne în buffer, nu se pierde', () => {
    const r1 = feedSse('', 'data: {"text":"x"}\ndata: {"te');
    expect(r1.events).toHaveLength(1);
    expect(r1.buffer).toBe('data: {"te');
    const r2 = feedSse(r1.buffer, 'xt":"y"}\n');
    expect(r2.events[0].text).toBe('y');
  });
});
