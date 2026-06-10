/**
 * ETAPA 72 P2 — ACCEPTANȚĂ pe date REALE: toate mesajele recente din DB
 * (inclusiv ale lui Maxim) se randează fără să arunce, plus mesajul construit
 * să spargă randarea (LaTeX nebalansat + bloc invalid) trece prin MessageBubble
 * fără throw. (Boundary-ul per mesaj e dovedit în tests/chat/message-boundary.)
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa72-messages-acceptance.ts
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServiceClient } from '../../src/lib/supabase/service';
import { MessageBubble } from '../../src/app/app/chat/_components/MessageBubble';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

function renderOne(role: 'user' | 'assistant', content: string, id: string): string | null {
  try {
    renderToString(createElement(MessageBubble, { role, content, messageId: id }));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function main() {
  const svc = createServiceClient();
  const { data: msgs } = await svc
    .from('messages')
    .select('id, role, content, created_at')
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(60);
  if (!msgs || msgs.length === 0) fail('fără mesaje în DB');

  let ok = 0;
  for (const m of msgs) {
    const err = renderOne(m.role as 'user' | 'assistant', (m.content as string) ?? '', m.id as string);
    if (err) {
      fail(`mesaj REAL crăpat la randare: ${m.id} (${m.created_at}) — ${err}\n  conținut: ${JSON.stringify((m.content as string).slice(0, 200))}`);
    }
    ok++;
  }
  console.log(`✓ ${ok}/${msgs.length} mesaje reale (cele mai recente) se randează fără throw`);

  // mesajul construit să spargă: LaTeX nebalansat + bloc invalid + JSON fals
  const bombs = [
    'Formula este $$x_G = \\frac{x_1 m_1 + x_2 m_2}{m_1 + m_2} Pentru acest concept nu am încă exerciții servibile $alfa$ și $',
    '$\\frac{a}{b$ text după $$ \\begin{cases} x \\end{cases',
    '{"lesson":true,"blocks":[{"tip":"???"]}',
    '```tikz\n\\draw[->] (0,0)',
  ];
  for (const b of bombs) {
    const err = renderOne('assistant', b, `bomb-${bombs.indexOf(b)}`);
    if (err) fail(`mesajul construit ARUNCĂ în loc să cadă pe fallback-ul randerului: ${err}`);
  }
  console.log(`✓ ${bombs.length} mesaje-bombă (LaTeX nebalansat, bloc invalid) se randează fără throw`);
  console.log('  (dacă totuși ceva aruncă vreodată: boundary-ul per mesaj — testat în vitest — păstrează conversația)');

  console.log('\n✅ ETAPA 72 P2 acceptată: mesajele reale + bombele se randează; boundary-ul per mesaj e plasa de siguranță.');
}
main().catch((e) => { console.error(e); process.exit(1); });
