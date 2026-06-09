/**
 * history.ts — ETAPA 66 FAZA D1: dieta de tokeni pe istoricul conversației.
 *
 * Înainte: ultimele 20 de mesaje integrale la fiecare apel.
 * Acum: ultimele 6 mesaje integrale + REZUMAT compact persistat pe conversație
 * (conversations.summary / summary_through), actualizat incremental cu Haiku
 * DOAR când fereastra alunecă cu ≥4 mesaje (nu la fiecare mesaj). Mesajele
 * ieșite din fereastră dar încă nerezumate (<4) merg integrale — nimic nu se
 * pierde între actualizări.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { callAI } from '@/lib/ai/router';
import type { AiMessage } from '@/lib/ai/router.types';

export const HISTORY_FULL_WINDOW = 6;
export const SUMMARY_BATCH = 4;
const SUMMARY_MAX_CHARS = 1500;

const SUMMARIZE_SYSTEM = `Comprimi istoricul unei conversații elev-profesor de matematică (BAC Moldova).
Scrii un rezumat FACTUAL în română, max 10 propoziții: ce exerciții s-au lucrat,
ce a greșit/înțeles elevul, unde a rămas discuția. Fără sfaturi, fără formule lungi.
Dacă primești un rezumat existent, îl actualizezi integrând mesajele noi (nu repeta).
Răspunzi DOAR cu rezumatul.`;

export interface ConversationHistory {
  /** mesajele trimise modelului: nerezumate (<4) + ultimele 6 integrale */
  messages: AiMessage[];
  /** rezumatul mesajelor mai vechi (null dacă nu există încă) */
  summary: string | null;
}

export async function buildConversationHistory(
  service: SupabaseClient,
  conversationId: string
): Promise<ConversationHistory> {
  const { data: rows, error } = await service
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[chat/history] messages fetch failed:', error.message);
    return { messages: [], summary: null };
  }
  const msgs: AiMessage[] = (rows ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: (m.content as string | null) ?? '' }));

  const total = msgs.length;
  if (total <= HISTORY_FULL_WINDOW) return { messages: msgs, summary: null };

  const { data: conv } = await service
    .from('conversations')
    .select('summary, summary_through')
    .eq('id', conversationId)
    .maybeSingle();
  let summary = (conv?.summary as string | null) ?? null;
  let through = (conv?.summary_through as number | null) ?? 0;
  if (through > total) through = 0; // defensiv (conversație rescrisă)

  const cutoff = total - HISTORY_FULL_WINDOW;

  // fereastra a alunecat cu ≥ batch → actualizare incrementală (un apel Haiku)
  if (cutoff - through >= SUMMARY_BATCH) {
    const batch = msgs.slice(through, cutoff);
    try {
      const promptParts = [
        summary ? `Rezumat existent:\n${summary}` : null,
        'Mesaje noi de integrat:',
        ...batch.map((m) => `${m.role === 'user' ? 'Elev' : 'Profesor'}: ${m.content.slice(0, 800)}`),
      ].filter(Boolean);
      const { text } = await callAI(
        'summarize_history',
        [{ role: 'user', content: promptParts.join('\n\n') }],
        { system: SUMMARIZE_SYSTEM, endpoint: '/api/chat#summary' }
      );
      if (text.trim()) {
        summary = text.trim().slice(0, SUMMARY_MAX_CHARS);
        through = cutoff;
        const { error: upErr } = await service
          .from('conversations')
          .update({ summary, summary_through: through })
          .eq('id', conversationId);
        if (upErr) console.error('[chat/history] summary persist failed:', upErr.message);
      }
    } catch (err) {
      // rezumatul e optimizare — la eșec, mesajele rămân integrale (mai scump, nu greșit)
      console.error('[chat/history] summarize failed:', err instanceof Error ? err.message : err);
    }
  }

  return { messages: msgs.slice(through), summary };
}
