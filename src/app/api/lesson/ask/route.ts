/**
 * POST /api/lesson/ask — ETAPA 70 FAZA E: chatul ÎNGRĂDIT în lecție.
 *
 * Întrebarea liberă din player pleacă cu ancora conceptului + instrucțiune
 * FERMĂ (ASK_GUARD_PROMPT): răspuns DOAR în limitele temei; off-topic →
 * refuz blând cu trimitere la „Azi". Fără clasificator suplimentar.
 * Răspunsul = blocuri validate (max 3; quiz/figure respinse aici).
 * Intră în check_rate_limit existent (un mesaj din cotă).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { callAIStreamArray, getTaskPricing } from '@/lib/ai/router';
import { logApiUsage, computeLlmCost } from '@/lib/ai/usage-log';
import { checkCostGuard, KILL_SWITCH_MESSAGE } from '@/lib/cost/guard';
import { getConceptAnchor } from '@/lib/concepts/anchor';
import { LessonBlockModelSchema, parseLessonBlock, type LessonBlock } from '@/lib/lesson/blocks';
import { ASK_GUARD_PROMPT, buildAskUserMessage } from '@/lib/lesson/prompt';
import { renderPlotSVG } from '@/lib/lesson/plot';
import type { SystemBlock } from '@/lib/ai/router.types';

export const dynamic = 'force-dynamic';
const FREE_MONTHLY_LIMIT = 30;
const MAX_ANSWER_BLOCKS = 3;
const ALLOWED_TIPS = new Set(['step', 'formula', 'example', 'table', 'plot']);

export async function POST(req: NextRequest) {
  const requestStart = Date.now();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { concept?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const conceptSlug = body.concept?.trim();
  const question = body.question?.trim();
  if (!conceptSlug || !question) {
    return NextResponse.json({ error: 'concept și question sunt obligatorii' }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: 'Întrebare prea lungă' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles').select('subscription_status').eq('id', user.id).single();
  const status: string = profile?.subscription_status ?? 'free';
  const isPremium = status === 'premium' || status.startsWith('family') || status === 'admin';
  const tierTask = status === 'admin' ? 'chat_admin' : isPremium ? 'chat_premium' : 'chat_free';
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

  const systemBlocks: SystemBlock[] = [{ text: ASK_GUARD_PROMPT, cache: true }];
  const userMessage = buildAskUserMessage({
    conceptName: anchor.name,
    theory: anchor.theory,
    question,
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  try {
    const result = await callAIStreamArray(taskName, [{ role: 'user', content: userMessage }], {
      system: systemBlocks,
      elementSchema: LessonBlockModelSchema,
      schemaName: 'raspuns_blocuri',
    });
    const blocks: Array<LessonBlock | (LessonBlock & { svg: string })> = [];
    for await (const element of result.elementStream) {
      if (blocks.length >= MAX_ANSWER_BLOCKS) break; // gardul de lungime e mecanic
      const parsed = parseLessonBlock(element);
      if (!parsed.ok) {
        console.error('[lesson/ask] bloc respins:', parsed.error);
        continue;
      }
      if (!ALLOWED_TIPS.has(parsed.block.tip)) {
        console.error('[lesson/ask] tip nepermis în răspuns:', parsed.block.tip);
        continue;
      }
      if (parsed.block.tip === 'plot') {
        const rendered = renderPlotSVG(parsed.block.expr, parsed.block.domain, parsed.block.puncte_marcate);
        if (!rendered.ok) {
          console.error('[lesson/ask] plot respins:', rendered.error);
          continue;
        }
        blocks.push({ ...parsed.block, svg: rendered.svg });
      } else {
        blocks.push(parsed.block);
      }
    }
    const usage = await result.usage;
    inputTokens = usage.inputTokens ?? 0;
    outputTokens = usage.outputTokens ?? 0;
    cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;

    if (blocks.length === 0) {
      return NextResponse.json({ error: 'Răspunsul nu a produs blocuri valide' }, { status: 502 });
    }
    return NextResponse.json({ blocks });
  } catch (err) {
    console.error('[lesson/ask] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Eroare la generarea răspunsului' }, { status: 500 });
  } finally {
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
          endpoint: '/api/lesson/ask',
          inputTokens,
          outputTokens,
          cachedInputTokens: cacheRead,
          latencyMsTotal: Date.now() - requestStart,
          costUsd: computeLlmCost({
            inputTokens, outputTokens,
            cacheReadTokens: cacheRead, cacheWriteTokens: 0,
            priceInputPer1M: pricing.price_input_per_1m,
            priceOutputPer1M: pricing.price_output_per_1m,
          }),
        });
      } catch (logErr) {
        console.error('[lesson/ask] usage log failed:', logErr instanceof Error ? logErr.message : logErr);
      }
    }
  }
}
