/**
 * ETAPA 75 FAZA F — TTS PRE-GENERAT LA BUILD.
 *
 * Batch: vocea (nova, vocea implicită a produsului) pentru:
 *  - textele rostibile din blocurile lecțiilor CANONICE (intro/step/formula/
 *    example/quiz/recap);
 *  - enunțurile SERVIBILE.
 * Scrie în cache-ul TTS EXISTENT (același bucket, ACELEAȘI chei — pipeline-ul
 * partajat din src/lib/voice/tts-cache.ts) → hit la servire fără OpenAI.
 *
 * GARDĂ idempotentă: nu re-generează ce există deja în cache.
 *
 *   npx tsx --env-file=.env.local scripts/etapa75/pregen-tts.ts
 *   DRY=1 ... (doar numără + estimează costul)
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { TTS_BUCKET, TTS_SPEED, TTS_PRICE_PER_CHAR, toSpeechText, ttsCacheKey } from '../../src/lib/voice/tts-cache';
import type { LessonBlock } from '../../src/lib/lesson/blocks';

const VOICE = 'nova';

/** textele rostibile ale unui bloc de lecție (ce ar primi VoicePlayer) */
function blockTexts(b: LessonBlock): string[] {
  switch (b.tip) {
    case 'intro': return [`${b.titlu}. ${b.ideea_mare}`];
    case 'step': return [`${b.titlu_scurt}. ${b.corp}${b.formula ? ` $${b.formula}$` : ''}`];
    case 'formula': return [`$${b.latex}$. ${b.explicatie}`];
    case 'example': return [`${b.enunt} ${b.pasi.map((p) => p.text + (p.formula ? ` $${p.formula}$` : '')).join(' ')}`];
    case 'quiz': return [b.intrebare];
    case 'recap': return [b.puncte.join(' ')];
    default: return [];
  }
}

async function listExistingKeys(svc: ReturnType<typeof createServiceClient>): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let page = 0; ; page++) {
    const { data, error } = await svc.storage.from(TTS_BUCKET).list('', { limit: 1000, offset: page * 1000 });
    if (error) throw new Error(`storage list: ${error.message}`);
    for (const f of data ?? []) keys.add(f.name);
    if (!data || data.length < 1000) break;
  }
  return keys;
}

async function main() {
  const svc = createServiceClient();
  const dry = process.env.DRY === '1';
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey && !dry) throw new Error('OPENAI_API_KEY lipsește');

  // ── corpusul ──────────────────────────────────────────────────────────────
  const texts: string[] = [];
  const { data: lessons } = await svc.from('lesson_canonical').select('blocks');
  for (const l of lessons ?? []) {
    for (const b of (l.blocks as LessonBlock[]) ?? []) texts.push(...blockTexts(b));
  }
  const lessonTexts = texts.length;
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id');
  const ids = (servable ?? []).map((s) => s.exercise_id as string);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: ex } = await svc.from('exercise_raw').select('statement').in('id', ids.slice(i, i + 200));
    for (const e of ex ?? []) if (e.statement) texts.push(e.statement as string);
  }
  console.log(`corpus: ${lessonTexts} texte din lecțiile canonice + ${texts.length - lessonTexts} enunțuri servibile`);

  // ── dedup pe cheie + garda idempotentă ───────────────────────────────────
  const existing = await listExistingKeys(svc);
  const work = new Map<string, string>(); // key → speechText
  let alreadyCached = 0;
  for (const t of texts) {
    const speech = toSpeechText(t);
    if (!speech.trim()) continue;
    const key = ttsCacheKey(speech, VOICE);
    if (existing.has(key)) { alreadyCached++; continue; }
    work.set(key, speech);
  }
  const totalChars = [...work.values()].reduce((a, s) => a + s.length, 0);
  const estCost = totalChars * TTS_PRICE_PER_CHAR;
  console.log(`de generat: ${work.size} fișiere (${alreadyCached} deja în cache) · ~${totalChars} caractere · cost estimat $${estCost.toFixed(2)}`);
  if (dry) return;

  let done = 0, failed = 0, bytes = 0, cost = 0;
  for (const [key, speech] of work) {
    try {
      const resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', voice: VOICE, input: speech, response_format: 'mp3', speed: TTS_SPEED }),
      });
      if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${(await resp.text()).slice(0, 120)}`);
      const audio = await resp.arrayBuffer();
      const { error: upErr } = await svc.storage
        .from(TTS_BUCKET)
        .upload(key, Buffer.from(audio), { contentType: 'audio/mpeg', upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);
      bytes += audio.byteLength;
      cost += speech.length * TTS_PRICE_PER_CHAR;
      done++;
      if (done % 100 === 0) console.log(`  …${done}/${work.size}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${key.slice(0, 12)}: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
      if (failed > 25) throw new Error('prea multe eșecuri — opresc');
    }
  }
  // log agregat (o linie per batch, nu per fișier)
  await svc.from('api_usage_log').insert({
    user_id: null, task_name: 'tts', model: 'tts-1', endpoint: 'build:tts-pregen',
    tokens_input: totalChars, tokens_output: 0, cost_usd: cost,
  });
  const coverage = Math.round(((alreadyCached + done) * 100) / (alreadyCached + done + failed || 1));
  console.log(`\n✅ FAZA F: ${done} fișiere generate (${(bytes / 1e6).toFixed(1)} MB), ${failed} eșuate, cost o-singură-dată $${cost.toFixed(2)}.`);
  console.log(`   hit-rate așteptat la servire pe corpusul canonic+servibil: ${coverage}% (țintă >90%).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
