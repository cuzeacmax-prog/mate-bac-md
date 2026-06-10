/**
 * sse.ts — ETAPA 72 P2: parser SSE cu BUFFER între chunk-uri.
 *
 * CAUZA mesajelor dispărute (dovedită): useChat făcea split("\n") PER CHUNK,
 * fără să poarte restul — un eveniment `data: {...}` tăiat la graniță de
 * chunk pica la JSON.parse și era aruncat tăcut. Când evenimentul `done`
 * (mare: metadata+svgs) era cel tăiat, mesajul nu se mai comitea în listă,
 * iar finally() ștergea streamingContent → mesaj „dispărut" (dar salvat în DB).
 * Pur + testat în tests/chat/sse.test.ts.
 */

export interface SseFeedResult {
  /** restul nedecodat încă (se dă înapoi la următorul feed) */
  buffer: string;
  /** evenimentele JSON complete din acest chunk */
  events: Array<Record<string, unknown>>;
}

export function feedSse(buffer: string, chunk: string): SseFeedResult {
  const combined = buffer + chunk;
  const lines = combined.split('\n');
  const rest = lines.pop() ?? ''; // ultima linie poate fi INCOMPLETĂ — o purtăm
  const events: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(line.slice(6)) as Record<string, unknown>);
    } catch {
      // linie data: coruptă DE TOT (nu doar tăiată) — singurul caz aruncat
      console.error('[sse] eveniment corupt, aruncat:', line.slice(0, 120));
    }
  }
  return { buffer: rest, events };
}
