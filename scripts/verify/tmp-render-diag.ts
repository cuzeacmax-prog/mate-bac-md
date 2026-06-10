/** ETAPA 72 P2 — diagnoză: randez mesajele REALE recente prin renderToString.
 *  Un throw la randare = mesajul care „dispare". NECOMIS. */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServiceClient } from '../../src/lib/supabase/service';
import { MessageBubble } from '../../src/app/app/chat/_components/MessageBubble';

async function main() {
  const svc = createServiceClient();
  const { data: msgs } = await svc
    .from('messages')
    .select('id, role, content, created_at, conversation_id')
    .order('created_at', { ascending: false })
    .limit(40);
  console.log(`mesaje recente: ${msgs?.length}`);
  let ok = 0, failed = 0;
  for (const m of msgs ?? []) {
    try {
      renderToString(
        createElement(MessageBubble, {
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
          messageId: m.id as string,
        })
      );
      ok++;
    } catch (e) {
      failed++;
      console.log(`\n✗ CRAPĂ randarea: ${m.id} (${m.role}, ${m.created_at})`);
      console.log(`  eroare: ${e instanceof Error ? e.message : e}`);
      console.log(`  conținut (primii 300): ${JSON.stringify((m.content as string).slice(0, 300))}`);
    }
  }
  console.log(`\nrandate OK: ${ok}, CRĂPATE: ${failed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
