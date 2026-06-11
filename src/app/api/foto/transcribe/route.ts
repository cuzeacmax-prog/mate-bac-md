/**
 * POST /api/foto/transcribe — ETAPA 77 F1: poza exercițiului → enunț LaTeX +
 * nivel de încredere (model cu vision, task photo_transcribe din config).
 *
 * GARDURI (F3): poza intră în COTA de mesaje (check + increment, ca /api/chat);
 * mărime ≤ 6MB, format jpeg/png/webp; imagine fără matematică → refuz politicos
 * (has_math=false); costul se loghează per transcriere.
 * Transcrierea NU declanșează rezolvarea — confirmarea elevului (F2) e în UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logApiUsage, computeLlmCost } from '@/lib/ai/usage-log';

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
/**
 * PRAGUL DE RE-POZĂ (documentat, F4): sub 0.55 încredere transcrierea e prea
 * nesigură — UI-ul cere o poză mai bună în loc să riște o rezolvare greșită.
 */
export const RETAKE_THRESHOLD = 0.55;

const SYSTEM = `Transcrii EXACT exercițiul de matematică din imagine, pentru un elev din Republica Moldova.
Răspunde DOAR cu un obiect JSON: {"has_math": bool, "statement": string, "confidence": number}.
- statement: enunțul complet în română, cu TOATĂ matematica în LaTeX delimitat cu $...$;
  transcrie ce VEZI — nu rezolva, nu completa, nu corecta enunțul.
- confidence: 0-1 — cât de sigur ești că transcrierea e fidelă (scris ilizibil/tăiat/blurat → scăzut).
- has_math=false dacă imaginea NU conține un exercițiu de matematică (atunci statement="").`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const dataUrl = body.image ?? '';
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return NextResponse.json({ error: 'Format acceptat: JPEG/PNG/WebP (data URL)' }, { status: 400 });
  const [, mediaType, b64] = m;
  if (!ALLOWED.has(mediaType)) return NextResponse.json({ error: 'Format neacceptat' }, { status: 400 });
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_BYTES) return NextResponse.json({ error: 'Poza e prea mare (max 6MB)' }, { status: 400 });

  // F3: poza intră în cota de mesaje (free)
  const service = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles').select('subscription_status').eq('id', user.id).single();
  const status: string = profile?.subscription_status ?? 'free';
  const isPremium = status === 'premium' || status.startsWith('family') || status === 'admin';
  if (!isPremium) {
    try {
      const { data: allowed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id, p_action_type: 'message',
      });
      if (allowed === false) {
        return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
      }
    } catch { /* fail-open, ca /api/chat */ }
  }

  const { data: cfg } = await service
    .from('ai_model_config')
    .select('model_name, max_tokens, price_input_per_1m, price_output_per_1m')
    .eq('task_name', 'photo_transcribe')
    .eq('is_active', true)
    .single();
  if (!cfg) return NextResponse.json({ error: 'photo_transcribe neconfigurat' }, { status: 500 });

  const t0 = Date.now();
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: cfg.model_name as string,
      max_tokens: (cfg.max_tokens as number) || 1500,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: b64 } },
            { type: 'text', text: 'Transcrie exercițiul din imagine (JSON).' },
          ],
        },
      ],
    });
    const text = resp.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const inTok = resp.usage.input_tokens;
    const outTok = resp.usage.output_tokens;
    void logApiUsage({
      userId: user.id,
      taskName: 'photo_transcribe',
      model: cfg.model_name as string,
      endpoint: '/api/foto/transcribe',
      inputTokens: inTok,
      outputTokens: outTok,
      latencyMsTotal: Date.now() - t0,
      costUsd: computeLlmCost({
        inputTokens: inTok, outputTokens: outTok,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        priceInputPer1M: Number(cfg.price_input_per_1m),
        priceOutputPer1M: Number(cfg.price_output_per_1m),
      }),
    });
    if (!isPremium) {
      try {
        await supabase.rpc('increment_rate_limit', { p_user_id: user.id, p_action_type: 'message' });
      } catch { /* identic cu /api/chat */ }
    }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('răspuns ne-JSON');
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      has_math?: boolean; statement?: string; confidence?: number;
    };
    if (!parsed.has_math || !parsed.statement?.trim()) {
      return NextResponse.json({
        hasMath: false,
        message: 'Nu văd un exercițiu de matematică în poza asta — încearcă o poză cu enunțul exercițiului.',
      });
    }
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    return NextResponse.json({
      hasMath: true,
      statement: parsed.statement.trim(),
      confidence,
      retake: confidence < RETAKE_THRESHOLD,
      retakeThreshold: RETAKE_THRESHOLD,
    });
  } catch (err) {
    console.error('[foto/transcribe] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Transcrierea a eșuat — încearcă din nou.' }, { status: 502 });
  }
}
