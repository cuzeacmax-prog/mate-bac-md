/**
 * POST /api/lesson/start — ETAPA 67 FAZA B: lecția structurată streamată.
 *
 * Study mode + ancoră de concept → modelul emite blocuri tipizate
 * (streamText + Output.array pe schema STRUCTURALĂ); serverul validează
 * STRICT fiecare bloc (parseLessonBlock): blocul invalid se respinge, se
 * loghează și se RECERE o singură dată la final. quiz.corecta NU pleacă la
 * client — lecția completă (cu răspunsuri) se persistă în messages, iar
 * verificarea răspunsului A-D e determinist pe server (/api/lesson/quiz).
 * Fallback robust: orice eșec → eveniment SSE {fallback:true}, logat —
 * clientul cade pe chat-ul markdown existent, fără ecran alb.
 * Cale NOUĂ: /api/chat și Solve mode rămân neatinse.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { callAIStreamArray, getTaskPricing } from '@/lib/ai/router';
import { logApiUsage, computeLlmCost } from '@/lib/ai/usage-log';
import { checkCostGuard, KILL_SWITCH_MESSAGE } from '@/lib/cost/guard';
import { getConceptAnchor } from '@/lib/concepts/anchor';
import {
  LessonBlockModelSchema,
  parseLessonBlock,
  stripQuizAnswer,
  type LessonBlock,
} from '@/lib/lesson/blocks';
import { LESSON_SYSTEM_PROMPT, buildLessonConceptBlock, buildLessonUserMessage, buildRetryMessage } from '@/lib/lesson/prompt';
import { getCanonicalLesson } from '@/lib/lesson/canonical';
import { getTheoryFigure } from '@/lib/lesson/theory-figures/registry';
import { renderPlotSVG } from '@/lib/lesson/plot';
import { renderManipulative } from '@/lib/lesson/manipulatives';
import type { SystemBlock } from '@/lib/ai/router.types';

export const dynamic = 'force-dynamic';
const FREE_MONTHLY_LIMIT = 30;

export async function POST(req: NextRequest) {
  const requestStart = Date.now();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { concept?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const conceptSlug = body.concept?.trim();
  if (!conceptSlug) return NextResponse.json({ error: 'concept este obligatoriu' }, { status: 400 });

  const service = createServiceClient();

  // tier + gard de cost (ETAPA 66) + rate limit (o lecție = un mesaj din cotă)
  const { data: profile } = await supabase
    .from('profiles').select('subscription_status').eq('id', user.id).single();
  const status: string = profile?.subscription_status ?? 'free';
  const isPremium = status === 'premium' || status.startsWith('family') || status === 'admin';
  const tierTask =
    status === 'admin' ? 'chat_admin'
    : isPremium ? 'chat_premium'
    : 'chat_free';
  const guard = await checkCostGuard(service, user.id, tierTask, status);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.notice ?? KILL_SWITCH_MESSAGE }, { status: 503 });
  }
  const taskName = guard.effectiveTask;

  if (!isPremium) {
    try {
      const { data: allowed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id, p_action_type: 'message',
      });
      if (allowed === false) {
        return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', limit: FREE_MONTHLY_LIMIT }, { status: 429 });
      }
    } catch { /* fail-open, identic cu /api/chat */ }
  }

  const anchor = await getConceptAnchor(service, conceptSlug);
  if (!anchor) return NextResponse.json({ error: 'Concept inexistent în graf' }, { status: 404 });

  const { data: gradeRow } = await supabase
    .from('user_profiles').select('grade_level').eq('id', user.id).maybeSingle();
  const gradeLevel = (gradeRow?.grade_level as number | null) ?? 12;

  // conversația lecției (istoricul rămâne compatibil cu chat-ul liber)
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, title: `Lecție: ${anchor.name}`.slice(0, 60) })
    .select('id').single();
  if (convErr || !conv) {
    console.error('[lesson] conversation insert failed:', convErr?.message);
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 });
  }
  const convId = conv.id as string;
  await supabase.from('messages').insert({
    conversation_id: convId, role: 'user', content: `Începe lecția: ${anchor.name}`,
  });

  // ── ETAPA 75 FAZA B3: lecția CANONICĂ se servește FĂRĂ LLM ───────────────
  // Scheletul lecției = blocuri persistate (generate o dată, revizuite de
  // profesor); LIVE rămân doar evaluarea quiz-urilor, remedierea, chatul
  // îngrădit. Personalizarea intro-ului = template DETERMINIST (zero cost).
  // Concept fără canonică → generarea live de mai jos (fallback intact).
  const canonical = await getCanonicalLesson(service, anchor.id);
  if (canonical) {
    const { data: prof } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const firstName = (prof?.full_name as string | null)?.trim().split(/\s+/)[0] ?? null;

    const encoder = new TextEncoder();
    const canonicalStream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        send({ ping: true });
        // badge-ul „verificată de profesor" DOAR la status aprobat (B4)
        send({ canonical: { status: canonical.status } });
        try {
          const serverBlocks: LessonBlock[] = [];
          let quizCount = 0;
          for (const raw of canonical.blocks) {
            let block = raw;
            // personalizare deterministă: salutul în intro (nu se persistă)
            if (block.tip === 'intro' && firstName) {
              block = { ...block, ideea_mare: `Salut, ${firstName}! ${block.ideea_mare}` };
            }
            if (block.tip === 'plot') {
              const r = renderPlotSVG(block.expr, block.domain, block.puncte_marcate);
              if (!r.ok) { console.error('[lesson/canonic] plot respins:', r.error); continue; }
              serverBlocks.push(block);
              send({ block: { ...block, svg: r.svg } });
              continue;
            }
            if (block.tip === 'manipulative') {
              const r = renderManipulative(block.kind, block.params);
              if (!r.ok) { console.error('[lesson/canonic] manipulative respins:', r.error); continue; }
              serverBlocks.push(block);
              send({ block: { ...block, svg: r.svg } });
              continue;
            }
            serverBlocks.push(block);
            if (block.tip === 'quiz') {
              quizCount++;
              send({ block: stripQuizAnswer(block, `q${quizCount}`) });
            } else {
              send({ block });
            }
          }
          // persistă lecția COMPLETĂ (cu corecta) — sursa verificării quiz-urilor
          const { data: saved, error: saveErr } = await service
            .from('messages')
            .insert({
              conversation_id: convId,
              role: 'assistant',
              content: JSON.stringify({ lesson: true, concept: anchor.slug, blocks: serverBlocks }),
            })
            .select('id')
            .single();
          if (saveErr) console.error('[lesson/canonic] save failed:', saveErr.message);
          send({
            done: true,
            conversationId: convId,
            messageId: saved?.id ?? null,
            blocks: serverBlocks.length,
            invalidCount: 0,
          });
        } catch (err) {
          console.error('[lesson/canonic] FALLBACK la markdown:', err instanceof Error ? err.message : err);
          send({ fallback: true, reason: 'servirea canonică a eșuat' });
        } finally {
          controller.close();
          if (!isPremium) {
            try {
              await supabase.rpc('increment_rate_limit', { p_user_id: user.id, p_action_type: 'message' });
            } catch { /* identic cu /api/chat */ }
          }
          // ZERO apeluri LLM pe schelet — nimic de logat în api_usage_log
        }
      },
    });
    return new NextResponse(canonicalStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Conversation-Id': convId,
      },
    });
  }

  // ETAPA 70 B3: figura canonică de teorie, dacă registrul o are
  const theoryEntry = getTheoryFigure(anchor.slug);
  // ETAPA 75 FAZA A: contextul conceptului = al DOILEA bloc cache-uit
  // (semi-static per concept) — prefixul cumulat trece de minimul Haiku (2048),
  // re-cererea + lecțiile repetate pe concept citesc din cache.
  const systemBlocks: SystemBlock[] = [
    { text: LESSON_SYSTEM_PROMPT, cache: true },
    {
      text: buildLessonConceptBlock({
        conceptName: anchor.name,
        gradeLevel,
        theory: anchor.theory,
        exercises: anchor.exercises.map((e) => ({
          id: e.id, statement: e.statement, official_answer: e.official_answer, has_figure: e.has_figure,
        })),
        theoryFigure: theoryEntry ? { slug: anchor.slug, descriere: theoryEntry.descriere } : null,
      }),
      cache: true,
    },
  ];
  const userMessage = buildLessonUserMessage({ conceptName: anchor.name, gradeLevel });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ ping: true });

      const serverBlocks: LessonBlock[] = [];
      const invalid: Array<{ raw: unknown; error: string }> = [];
      let quizCount = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheRead = 0;
      let cacheWrite = 0;

      const emitBlock = (block: LessonBlock) => {
        // ETAPA 70 B: blocurile servite de sistem se VERIFICĂ înainte de emit;
        // invalidul se pierde (logat), lecția continuă fără el.
        if (block.tip === 'figure' && block.kind === 'theory') {
          if (!block.theory_slug || !getTheoryFigure(block.theory_slug)) {
            console.error('[lesson] figure theory respins: slug inexistent în registru:', block.theory_slug);
            return;
          }
        }
        if (block.tip === 'plot') {
          const rendered = renderPlotSVG(block.expr, block.domain, block.puncte_marcate);
          if (!rendered.ok) {
            console.error('[lesson] plot respins:', rendered.error, '| expr:', block.expr);
            return;
          }
          serverBlocks.push(block);
          send({ block: { ...block, svg: rendered.svg } });
          return;
        }
        // ETAPA 71 C2: manipulativul se validează pe schema kind-ului
        if (block.tip === 'manipulative') {
          const rendered = renderManipulative(block.kind, block.params);
          if (!rendered.ok) {
            console.error('[lesson] manipulative respins:', rendered.error, '| kind:', block.kind);
            return;
          }
          serverBlocks.push(block);
          send({ block: { ...block, svg: rendered.svg } });
          return;
        }
        serverBlocks.push(block);
        if (block.tip === 'quiz') {
          quizCount++;
          send({ block: stripQuizAnswer(block, `q${quizCount}`) });
        } else {
          send({ block });
        }
      };

      try {
        const result = await callAIStreamArray(taskName, [{ role: 'user', content: userMessage }], {
          system: systemBlocks,
          elementSchema: LessonBlockModelSchema,
          schemaName: 'lectie_blocuri',
        });
        for await (const element of result.elementStream) {
          const parsed = parseLessonBlock(element);
          if (parsed.ok) emitBlock(parsed.block);
          else {
            invalid.push({ raw: element, error: parsed.error });
            console.error('[lesson] bloc respins de validator:', parsed.error);
          }
        }
        const usage = await result.usage;
        inputTokens += usage.inputTokens ?? 0;
        outputTokens += usage.outputTokens ?? 0;
        cacheRead += usage.inputTokenDetails?.cacheReadTokens ?? 0;
        cacheWrite += usage.inputTokenDetails?.cacheWriteTokens ?? 0;

        // ── RE-CEREREA blocurilor respinse (o singură dată) ────────────────
        if (invalid.length > 0) {
          console.error(`[lesson] recer ${invalid.length} blocuri respinse`);
          send({ retrying: invalid.length });
          try {
            const retry = await callAIStreamArray(
              taskName,
              [
                { role: 'user', content: userMessage },
                { role: 'assistant', content: `Am emis lecția; ${invalid.length} blocuri au fost respinse.` },
                { role: 'user', content: buildRetryMessage(invalid) },
              ],
              { system: systemBlocks, elementSchema: LessonBlockModelSchema, schemaName: 'lectie_blocuri' }
            );
            for await (const element of retry.elementStream) {
              const parsed = parseLessonBlock(element);
              if (parsed.ok) emitBlock(parsed.block);
              else console.error('[lesson] bloc respins ȘI la re-cerere (abandonat):', parsed.error);
            }
            const ru = await retry.usage;
            inputTokens += ru.inputTokens ?? 0;
            outputTokens += ru.outputTokens ?? 0;
            cacheRead += ru.inputTokenDetails?.cacheReadTokens ?? 0;
          } catch (rErr) {
            console.error('[lesson] retry failed:', rErr instanceof Error ? rErr.message : rErr);
          }
        }

        if (serverBlocks.length === 0) throw new Error('zero blocuri valide');

        // persistă lecția COMPLETĂ (cu corecta) — sursa verificării quiz-urilor
        const { data: saved, error: saveErr } = await service
          .from('messages')
          .insert({
            conversation_id: convId,
            role: 'assistant',
            content: JSON.stringify({ lesson: true, concept: anchor.slug, blocks: serverBlocks }),
            tokens_input: inputTokens,
            tokens_output: outputTokens,
          })
          .select('id')
          .single();
        if (saveErr) console.error('[lesson] save failed:', saveErr.message);

        send({
          done: true,
          conversationId: convId,
          messageId: saved?.id ?? null,
          blocks: serverBlocks.length,
          invalidCount: invalid.length,
        });
      } catch (err) {
        // FALLBACK robust: clientul cade pe chat-ul markdown existent
        console.error('[lesson] FALLBACK la markdown:', err instanceof Error ? err.message : err);
        send({ fallback: true, reason: err instanceof Error ? err.message : 'stream structurat eșuat' });
      } finally {
        controller.close();
        if (!isPremium) {
          try {
            await supabase.rpc('increment_rate_limit', { p_user_id: user.id, p_action_type: 'message' });
          } catch { /* identic cu /api/chat */ }
        }
        if (inputTokens > 0) {
          try {
            const pricing = await getTaskPricing(taskName);
            void logApiUsage({
              userId: user.id,
              taskName,
              model: pricing.model_name,
              endpoint: '/api/lesson/start',
              inputTokens,
              outputTokens,
              cachedInputTokens: cacheRead,
              latencyMsTotal: Date.now() - requestStart,
              costUsd: computeLlmCost({
                inputTokens, outputTokens,
                cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite,
                priceInputPer1M: pricing.price_input_per_1m,
                priceOutputPer1M: pricing.price_output_per_1m,
              }),
            });
          } catch (logErr) {
            console.error('[lesson] usage log failed:', logErr instanceof Error ? logErr.message : logErr);
          }
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Conversation-Id': convId,
    },
  });
}
