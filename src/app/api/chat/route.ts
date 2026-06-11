import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STUDY_SYSTEM_PROMPT, SOLVE_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { callAI, callAIStream, callAIStreamWithTools, getTaskPricing } from "@/lib/ai/router";
import { computeLlmCost } from "@/lib/ai/usage-log";
import type { AiMessage, SystemBlock } from "@/lib/ai/router.types";
import { generateEmbeddingForQuery } from "@/lib/embeddings/gemini";
import {
  findRelevantMethods,
  buildMultiMethodInstruction,
  buildMethodInstruction,
  type SolutionMethod,
} from "@/lib/rag/solution-methods";
import { decomposeQuery, type DecomposedQuery } from "@/lib/chat/query-decomposer";
import { resolveToolsForMethod, hasTools } from "@/lib/tools/tool-resolver";
import { verifyMath, type VerificationResult } from "@/lib/chat/math-verifier";
import { getConceptAnchor, buildConceptSystemAddendum, type ConceptAnchor } from "@/lib/concepts/anchor";
import { recordConceptEvidence } from "@/lib/mastery/evidence";
import { pickCurrentExercise, evaluateAttempt, type AttemptEvaluation } from "@/lib/evaluare/evaluate";
import {
  buildHelpInstruction,
  recordHelpUsage,
  getHelpKindsUsed,
  helpWeight,
  type HelpKind,
} from "@/lib/evaluare/help";
import { buildConversationHistory, type ConversationHistory } from "@/lib/chat/history";
import { checkCostGuard, maybeWriteDailyCostAlert, KILL_SWITCH_MESSAGE } from "@/lib/cost/guard";
import { classifyDifficulty, routeChatTask } from "@/lib/ai/difficulty";

const FREE_MONTHLY_LIMIT = 30;
const IS_DEV = process.env.NODE_ENV === "development";

const RAG_DIRECT_THRESHOLD = 0.85;
const RAG_CONTEXT_THRESHOLD = 0.65;
const METHOD_THRESHOLD = 0.45; // relaxat: 0.55 → 0.45 pentru match-uri mai dese

interface RagMatch {
  id: string;
  statement: string;
  solution: string;
  topic: string;
  subtopic: string;
  similarity: number;
  svg_static: string | null;
  tags: string[];
}

function serverError(label: string, err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[chat/route] ${label}:`, err instanceof Error ? err.stack : err);
  return NextResponse.json(
    { error: IS_DEV ? `${label}: ${msg}` : "Eroare internă. Încearcă din nou." },
    { status: 500 }
  );
}

/** ETAPA 75 E: match și pe exercițiile SERVIBILE (embeddings persistate pe exercise_raw) */
interface ServableMatch {
  id: string;
  statement: string;
  similarity: number;
}

async function lookupLibrary(
  message: string
): Promise<{ match: RagMatch | null; servable: ServableMatch | null; embedding: number[] | null }> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return { match: null, servable: null, embedding: null };
  try {
    const embedding = await generateEmbeddingForQuery(message);
    const service = createServiceClient();
    // ETAPA 75 D+E: biblioteca rezolvată (solved_exercises) ∥ pool-ul servibil
    // (exercise_raw cu embeddings persistate — zero re-embedding pe bibliotecă)
    const [solvedRes, servableRes] = await Promise.all([
      service.rpc("match_exercises", {
        query_embedding: embedding,
        match_threshold: RAG_CONTEXT_THRESHOLD,
        match_count: 1,
      }),
      service.rpc("match_servable_exercises", {
        query_embedding: embedding,
        match_threshold: RAG_CONTEXT_THRESHOLD,
        match_count: 1,
      }),
    ]);
    const match = solvedRes.data && solvedRes.data.length > 0 ? (solvedRes.data[0] as RagMatch) : null;
    const servable =
      servableRes.data && servableRes.data.length > 0 ? (servableRes.data[0] as ServableMatch) : null;
    return { match, servable, embedding };
  } catch {
    return { match: null, servable: null, embedding: null };
  }
}

/**
 * ETAPA 75 D: compune răspunsul VERIFICAT pentru un exercițiu servibil —
 * metoda + rezultatul CAS + răspunsul oficial, EXTRASE, nu re-rezolvate.
 */
async function buildVerifiedAnswer(exerciseId: string, statement: string): Promise<string | null> {
  const service = createServiceClient();
  const [{ data: ver }, { data: ans }] = await Promise.all([
    service
      .from("exercise_verification")
      .select("subpart, method, computed_latex")
      .eq("exercise_id", exerciseId)
      .eq("verified", true),
    service
      .from("exercise_answer_link")
      .select("exercise_answers(answer_text)")
      .eq("exercise_id", exerciseId)
      .eq("match_confidence", "strict-bijectiv")
      .maybeSingle(),
  ]);
  const answerRow = ans?.exercise_answers as unknown as { answer_text: string } | { answer_text: string }[] | null;
  const official = (Array.isArray(answerRow) ? answerRow[0] : answerRow)?.answer_text ?? null;
  if ((!ver || ver.length === 0) && !official) return null; // fără conținut verificat → flux normal
  const parts = [`**Exercițiul din culegere:**\n> ${statement}`];
  for (const v of ver ?? []) {
    parts.push(
      `**Rezolvarea verificată${v.subpart ? ` (${v.subpart})` : ""}** — metoda: ${v.method}\n$$${v.computed_latex}$$`
    );
  }
  if (official) parts.push(`**Răspunsul oficial din culegere:** ${official}`);
  return parts.join("\n\n");
}

// findRelevantMethods este importat din @/lib/rag/solution-methods

export async function POST(req: NextRequest) {
  console.log("[chat/route] POST started");
  // ETAPA 66 FAZA A: latența se măsoară de la intrarea în handler
  const requestStart = Date.now();

  // ── Auth ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────
  let body: {
    message: string;
    conversationId?: string;
    mode?: string;
    concept?: string;
    /** ETAPA 70 D: chip de ajutor pe exercițiul activ (mesaj din cota normală) */
    help?: { kind?: string; level?: number };
  };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[chat/route] body parse failed:", err);
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const { message, conversationId, mode, concept: conceptSlug } = body;
  const helpKind: HelpKind | null =
    body.help?.kind === 'start' || body.help?.kind === 'hint' || body.help?.kind === 'solution'
      ? body.help.kind
      : null;
  const helpLevel = Math.min(Math.max(Number(body.help?.level) || 1, 1), 3);
  const chatMode: 'study' | 'solve' = mode === 'solve' ? 'solve' : 'study';
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mesaj gol" }, { status: 400 });
  }

  // ── ETAPA 59 (P6): pașii independenți rulează CONCURENT ─────────
  // profil ∥ embedding+match bibliotecă ∥ istoric (ETAPA 66 D1: 6 integrale + rezumat)
  const [profileResult, libraryResult, historyResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single(),
    lookupLibrary(message),
    conversationId
      ? buildConversationHistory(createServiceClient(), conversationId)
      : Promise.resolve({ messages: [], summary: null } as ConversationHistory),
  ]);

  const { data: profile, error: profileErr } = profileResult;
  if (profileErr) {
    return serverError("profile fetch", profileErr);
  }

  const status: string = profile?.subscription_status ?? "free";
  const isPremium =
    status === "premium" || status.startsWith("family") || status === "admin";

  // ── ETAPA 75 C: rutarea pe DIFICULTATE, nu doar pe tier ──────────
  // clasificator determinist (zero LLM): simple → Haiku, hard → Sonnet
  // (și pe free — aprobat); gardul de buget din 66 rămâne arbitrul.
  const difficulty = classifyDifficulty(message, conceptSlug);
  const tierTask = routeChatTask(difficulty.level, status);

  // ── ETAPA 66 F1: gardul de cost (kill-switch + buget lunar per tier) ──
  const guard = await checkCostGuard(createServiceClient(), user.id, tierTask, status);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.notice ?? KILL_SWITCH_MESSAGE }, { status: 503 });
  }
  const taskName = guard.effectiveTask;
  const budgetNotice = guard.notice;

  const { match: ragMatch, servable: servableMatch, embedding: queryEmbedding } = libraryResult;
  // ETAPA 75 D: „biblioteca răspunde prima" — direct și pe pool-ul servibil
  const servableDirect = servableMatch !== null && servableMatch.similarity >= RAG_DIRECT_THRESHOLD;
  const isDirectMatch =
    (ragMatch !== null && ragMatch.similarity >= RAG_DIRECT_THRESHOLD) || servableDirect;
  const isContextMatch = ragMatch !== null && ragMatch.similarity >= RAG_CONTEXT_THRESHOLD && !isDirectMatch;

  // ── Rate limit ∥ metode BAC MD (independente între ele) ─────────
  const [allowed, relevantMethods] = await Promise.all([
    (async (): Promise<boolean> => {
      if (isPremium) return true;
      try {
        const { data, error: rpcErr } = await supabase.rpc("check_rate_limit", {
          p_user_id: user.id,
          p_action_type: "message",
        });
        if (rpcErr) throw rpcErr;
        return data !== false;
      } catch (err) {
        console.error("[chat/route] check_rate_limit threw:", err instanceof Error ? err.stack : err);
        return true; // fail-open
      }
    })(),
    (async (): Promise<SolutionMethod[]> =>
      queryEmbedding
        ? findRelevantMethods(queryEmbedding, { threshold: METHOD_THRESHOLD, limit: 2 })
        : [])(),
  ]);

  if (!allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED", limit: FREE_MONTHLY_LIMIT },
      { status: 429 }
    );
  }

  // ── Conversation create or load (abia DUPĂ rate-limit, ca un 429 să nu lase rânduri) ──
  let convId: string = conversationId ?? "";
  if (!convId) {
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();

    if (convErr || !conv) {
      return serverError("conversations insert", convErr ?? new Error("no data returned"));
    }
    convId = conv.id as string;
  }

  // ETAPA 66 D1: ultimele 6 mesaje integrale + rezumat compact persistat
  const priorMessages = historyResult.messages;
  const historySummary = historyResult.summary;

  // ── Save user message ───────────────────────────────────────────
  const { error: userMsgErr } = await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message,
  });

  if (userMsgErr) {
    return serverError("user message insert", userMsgErr);
  }

  // ── System prompt pe BLOCURI (ETAPA 66 FAZA B — prompt caching) ──
  // Bloc 1 STATIC (cache): promptul de bază al modului — identic pentru toți.
  // Bloc 2 SEMI-STATIC (cache): ancora conceptului — stabilă pe conversație.
  // Bloc 3 DINAMIC (necacheat): metodele + contextul RAG — variază per mesaj.
  const basePrompt = chatMode === 'solve' ? SOLVE_SYSTEM_PROMPT : STUDY_SYSTEM_PROMPT;

  // ── ETAPA 60 (PAS 5): sesiune ancorată în concept din graf ─────
  // Teoria conceptului (max 2000 chars) + exerciții servibile.
  let anchoredConceptSlug: string | null = null;
  let conceptAnchor: ConceptAnchor | null = null;
  let anchorAddendum = "";
  if (conceptSlug) {
    try {
      const anchor = await getConceptAnchor(createServiceClient(), conceptSlug);
      if (anchor) {
        anchorAddendum = buildConceptSystemAddendum(anchor);
        anchoredConceptSlug = anchor.slug;
        conceptAnchor = anchor;
      } else {
        console.error(`[chat/route] concept inexistent în graf, ignorat: ${conceptSlug}`);
      }
    } catch (err) {
      console.error("[chat/route] concept anchor failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── ETAPA 70 D: chip de ajutor — instrucțiune fermă + folosirea persistată ──
  // Cererea de ajutor NU e o încercare de răspuns (evaluarea 63 se sare).
  let helpInstruction = "";
  if (helpKind && conceptAnchor && conceptAnchor.exercises.length > 0) {
    try {
      const service = createServiceClient();
      const exercise = await pickCurrentExercise(service, user.id, convId, conceptAnchor);
      if (exercise) {
        await recordHelpUsage(service, user.id, convId, exercise.id, helpKind, helpLevel);
        helpInstruction = buildHelpInstruction(helpKind, helpLevel, exercise.statement);
      }
    } catch (err) {
      console.error("[chat/route] help handling failed:", err instanceof Error ? err.message : err);
    }
  }

  // Contextul PER-MESAJ (metode + RAG + rezumat). ETAPA 75 FAZA A: NU mai e
  // bloc system — un bloc dinamic între system și istoric SPĂRGEA prefixul de
  // cache (orice breakpoint pe istoric devenea inutil). Acum intră în mesajul
  // user curent, iar prefixul system+istoric rămâne stabil și cache-uibil.
  let dynamicAddendum = "";
  if (helpInstruction) dynamicAddendum += helpInstruction;
  const methodInstruction = buildMultiMethodInstruction(relevantMethods);
  if (methodInstruction) {
    dynamicAddendum += `\n\n${methodInstruction}`;
  }
  if (isContextMatch && ragMatch) {
    dynamicAddendum += `\n\n---\nContext relevant din biblioteca de exerciții (similaritate ${(ragMatch.similarity * 100).toFixed(0)}%):\nExercițiu: ${ragMatch.statement}\nSoluție: ${ragMatch.solution}`;
  }
  // ETAPA 66 D1: rezumatul mesajelor mai vechi (fereastra de 6 a alunecat)
  if (historySummary) {
    dynamicAddendum += `\n\n---\nREZUMATUL conversației de până acum (mesajele mai vechi, comprimate):\n${historySummary}`;
  }
  // mesajul user trimis modelului: contextul per-mesaj + mesajul elevului
  // (în DB se persistă DOAR mesajul elevului — neschimbat)
  const userTurnContent = dynamicAddendum
    ? `[CONTEXT PENTRU ACEST MESAJ — de la sistem]\n${dynamicAddendum}\n\n[MESAJUL ELEVULUI]\n${message}`
    : message;

  const systemBlocks: SystemBlock[] = [
    { text: basePrompt, cache: true },
    ...(anchorAddendum ? [{ text: anchorAddendum, cache: true }] : []),
  ];

  // ETAPA 75 FAZA A: cache incremental al conversației — breakpoint pe ULTIMUL
  // mesaj din istoric: prefixul system+istoric se scrie la mesajul N și se
  // CITEȘTE la mesajul N+1 (minimul Haiku de 4096 e depășit de system singur).
  const historyMessages: AiMessage[] = priorMessages.map((m, i) =>
    i === priorMessages.length - 1 ? { ...m, cache: true } : m
  );

  // ── ETAPA 63: evaluarea încercării rulează CONCURENT cu stream-ul ─────
  // (Nivel A determinist pe linkuri strict-bijectiv, altfel judecător Haiku
  //  izolat — vede DOAR enunț + răspuns elev + răspuns oficial.)
  // ETAPA 70 D: reușita după un chip de ajutor are pas EMA înjumătățit
  // (rezolvarea arătată → zero); cererile de ajutor NU se evaluează.
  let attemptPromise: Promise<{ evaluation: AttemptEvaluation | null; weight: number } | null> | null = null;
  if (!helpKind && conceptAnchor && conceptAnchor.exercises.length > 0) {
    const anchorForEval = conceptAnchor;
    attemptPromise = (async () => {
      const service = createServiceClient();
      const exercise = await pickCurrentExercise(service, user.id, convId, anchorForEval);
      if (!exercise) return null;
      const helpKinds = await getHelpKindsUsed(service, user.id, convId, exercise.id);
      const evaluation = await evaluateAttempt(service, {
        userId: user.id,
        conversationId: convId,
        message,
        exercise,
        helped: helpKinds.length > 0,
      });
      return { evaluation, weight: helpWeight(helpKinds) };
    })().catch((err) => {
      console.error("[chat/route] attempt evaluation failed:", err instanceof Error ? err.message : err);
      return null;
    });
  }

  // ── Multi-exercise decompose (regex fast-path → Haiku) ────────
  let decomposed: DecomposedQuery | null = null;
  try {
    decomposed = await decomposeQuery(message);
  } catch {
    decomposed = { isMulti: false, exercises: [{ id: 1, text: message, detectedType: 'other' }], rawQuery: message };
  }
  const isMultiExercise = decomposed.isMulti && decomposed.exercises.length > 1;

  // ── Tool Use: determină dacă există tooluri disponibile ────────
  const topMethod = relevantMethods[0] ?? null;
  const toolsAvailable = hasTools(topMethod?.required_tools, topMethod?.exercise_type);
  const toolsToUse = topMethod
    ? resolveToolsForMethod(topMethod.required_tools, topMethod.exercise_type)
    : {};

  // ── Telemetrie structurată ─────────────────────────────────────
  console.log('[chat] Request telemetry:', {
    userQueryLength: message.length,
    methodsFound: relevantMethods.length,
    topMethod: relevantMethods[0]?.exercise_type ?? 'none',
    topSimilarity: relevantMethods[0]?.similarity?.toFixed(3) ?? 'n/a',
    exercisesFound: ragMatch ? 1 : 0,
    ragDirectMatch: isDirectMatch,
    ragContextMatch: isContextMatch,
    isMultiExercise,
    toolsAvailable,
    toolCount: Object.keys(toolsToUse).length,
  });

  // ── SSE stream ─────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let assistantText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  // ETAPA 66 FAZA A: TTFB (primul chunk de text) + tokeni cache din usage
  let ttfbMs: number | null = null;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  const markTtfb = () => {
    if (ttfbMs === null) ttfbMs = Date.now() - requestStart;
  };

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));

      // ETAPA 66 F1: nota politicoasă de downgrade (peste buget) — în mesaj, nu tăcere
      if (budgetNotice) {
        assistantText += budgetNotice;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: budgetNotice })}\n\n`));
      }

      // ── ETAPA 75 D: BIBLIOTECA RĂSPUNDE PRIMA ───────────────────────────
      // Peste prag: rezolvarea VERIFICATĂ din bibliotecă (metoda + rezultatul
      // CAS + răspunsul oficial), cu etichetă; Haiku doar LEAGĂ narativ
      // (max 2 paragrafe scurte) — nu re-rezolvă. Sub prag → fluxul normal.
      if (isDirectMatch) {
        // preferă sursa cu similaritatea mai mare; servibilul cade pe solved la lipsă de conținut
        let verified: string | null = null;
        let matchedSim = 0;
        if (
          servableDirect &&
          servableMatch &&
          (!ragMatch || servableMatch.similarity >= ragMatch.similarity)
        ) {
          verified = await buildVerifiedAnswer(servableMatch.id, servableMatch.statement);
          matchedSim = servableMatch.similarity;
        }
        if (!verified && ragMatch && ragMatch.similarity >= RAG_DIRECT_THRESHOLD) {
          verified = ragMatch.solution;
          matchedSim = ragMatch.similarity;
        }
        if (!verified && servableMatch) {
          // servibil fără conținut verificat exploatabil → fluxul normal ar fi
          // mai bun, dar păstrăm comportamentul determinist: enunț + trimitere
          verified = `**Exercițiul din culegere:**\n> ${servableMatch.statement}`;
          matchedSim = servableMatch.similarity;
        }
        console.log(`[chat/route] bibliotecă-întâi (similaritate=${matchedSim.toFixed(3)}) — fără re-rezolvare`);

        // legătura narativă: 1 apel Haiku scurt (chat_simple); eșecul ei nu
        // blochează răspunsul verificat
        let liaison = "";
        try {
          const l = await callAI(
            "chat_simple",
            [
              {
                role: "user",
                content: `Mesajul elevului:\n${message}\n\nRezolvarea VERIFICATĂ din bibliotecă (nu o modifica):\n${verified}`,
              },
            ],
            {
              system:
                "Ești Profesor Maxim. Scrie MAXIM 2 paragrafe scurte în română care leagă mesajul elevului de rezolvarea verificată primită: confirmă că exercițiul există în bibliotecă și spune-i cum să citească rezolvarea. NU re-rezolva, NU recalcula, NU repeta rezolvarea. Matematica doar între $...$.",
              userId: user.id,
              endpoint: "/api/chat#liaison",
            }
          );
          liaison = l.text.trim();
        } catch (err) {
          console.error("[chat/route] liaison failed (servim doar verificatul):", err instanceof Error ? err.message : err);
        }

        assistantText = `✅ **Rezolvare verificată din bibliotecă**\n\n${liaison ? `${liaison}\n\n---\n\n` : ""}${verified}`;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: assistantText, source: "library" })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              conversationId: convId,
              source: "library",
              metadata: {
                method_used: relevantMethods[0]?.exercise_type ?? null,
                method_similarity: relevantMethods[0]?.similarity ?? null,
                exercises_matched: 1,
              },
            })}\n\n`
          )
        );
        controller.close();
      } else {
        // ── AI stream (tool use + multi-exercise paths) ──────────────
        try {
          if (isContextMatch) {
            console.log(`[chat/route] RAG context match (similarity=${ragMatch!.similarity.toFixed(3)}) — context injected`);
          }
          if (relevantMethods.length > 0) {
            console.log(`[chat/route] Methods matched (${relevantMethods.length}):`);
            for (const m of relevantMethods) {
              console.log(`  - ${m.exercise_type} "${m.method_name}" (similarity=${m.similarity.toFixed(3)})`);
            }
          }
          if (toolsAvailable) {
            console.log(`[chat/route] Tool use enabled: ${Object.keys(toolsToUse).join(', ')}`);
          }

          // ── Multi-exercise: rezolvare per-exercițiu ──────────────
          if (isMultiExercise && decomposed) {
            const parts: string[] = [];
            const allSvgs: string[] = [];

            for (const ex of decomposed.exercises) {
              // RAG pentru sub-exercițiu (refolosim embedding global dacă textul e similar)
              // bloc static cache-uit + metoda per sub-exercițiu necacheată
              let exMethodAddendum = '';
              let exTools = {};

              // Metodă specifică sub-exercițiului (Gemini call per exercițiu)
              if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                try {
                  const exEmbedding = await generateEmbeddingForQuery(ex.text);
                  const exMethods = await findRelevantMethods(exEmbedding, { threshold: METHOD_THRESHOLD, limit: 1 });
                  if (exMethods.length > 0) {
                    exMethodAddendum += `\n\n${buildMethodInstruction(exMethods[0])}`;
                    exTools = resolveToolsForMethod(exMethods[0].required_tools, exMethods[0].exercise_type);
                  }
                } catch { /* continue without method */ }
              }

              const exResult = await callAIStreamWithTools(
                taskName,
                [...historyMessages, { role: "user", content: ex.text }],
                {
                  system: [
                    { text: basePrompt, cache: true },
                    ...(exMethodAddendum ? [{ text: exMethodAddendum }] : []),
                  ] satisfies SystemBlock[],
                  tools: Object.keys(exTools).length > 0 ? exTools : undefined,
                  maxToolSteps: 3,
                }
              );

              let exText = '';
              for await (const event of exResult.fullStream) {
                if (event.type === 'text-delta') {
                  // Guard: ensure we have a real string — SDK may surprise at runtime
                  const chunk = event.text;
                  if (typeof chunk !== 'string') continue;
                  markTtfb();
                  exText += chunk;
                  assistantText += chunk;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                }
                if (event.type === 'tool-result') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const out = (event as any).output as Record<string, unknown> | undefined;
                  if (typeof out?.svg === 'string' && out.svg) allSvgs.push(out.svg);
                }
              }

              parts.push(exText);

              // Separator between exercises (stream to client)
              if (ex.id < decomposed.exercises.length) {
                const sep = '\n\n---\n\n';
                assistantText += sep;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: sep })}\n\n`));
              }

              const exUsage = await exResult.usage;
              inputTokens += exUsage.inputTokens ?? 0;
              outputTokens += exUsage.outputTokens ?? 0;
              cacheReadTokens += exUsage.inputTokenDetails?.cacheReadTokens ?? 0;
              cacheWriteTokens += exUsage.inputTokenDetails?.cacheWriteTokens ?? 0;
            }

            console.log(`[chat/route] multi-exercise complete. exercises=${decomposed.exercises.length} svgs=${allSvgs.length}`);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  conversationId: convId,
                  metadata: {
                    isMulti: true,
                    exerciseCount: decomposed.exercises.length,
                    method_used: relevantMethods[0]?.exercise_type ?? null,
                    method_similarity: relevantMethods[0]?.similarity ?? null,
                    exercises_matched: isContextMatch ? 1 : 0,
                    svgs: allSvgs,
                  },
                })}\n\n`
              )
            );

          // ── Single exercise (with or without tools) ───────────────
          } else {
            const svgOutputs: string[] = [];

            const result = toolsAvailable
              ? await callAIStreamWithTools(taskName, [...historyMessages, { role: "user", content: userTurnContent }], { system: systemBlocks, tools: toolsToUse, maxToolSteps: 3 })
              : await callAIStream(taskName, [...historyMessages, { role: "user", content: userTurnContent }], { system: systemBlocks });

            let chunkCount = 0;

            if (toolsAvailable) {
              // Use fullStream to capture both text and tool results
              for await (const event of result.fullStream) {
                if (event.type === 'text-delta') {
                  // Guard: ensure we have a real string — SDK may surprise at runtime
                  const chunk = event.text;
                  if (typeof chunk !== 'string') continue;
                  markTtfb();
                  assistantText += chunk;
                  chunkCount++;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                }
                if (event.type === 'tool-result') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const out = (event as any).output as Record<string, unknown> | undefined;
                  if (typeof out?.svg === 'string' && out.svg) {
                    svgOutputs.push(out.svg);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    console.log(`[chat/route] SVG collected from tool: ${(event as any).toolName}`);
                  }
                }
              }
            } else {
              // No tools: use textStream (simpler)
              for await (const chunk of result.textStream) {
                markTtfb();
                assistantText += chunk;
                chunkCount++;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
              }
            }

            const usage = await result.usage;
            inputTokens = usage.inputTokens ?? 0;
            outputTokens = usage.outputTokens ?? 0;
            cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;
            cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens ?? 0;

            console.log(`[chat/route] stream complete. task=${taskName} chunks=${chunkCount} svgs=${svgOutputs.length} in=${inputTokens} out=${outputTokens}`);

            // ── ETAPA 59 (P5): done pleacă IMEDIAT după ultimul token ──
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  conversationId: convId,
                  metadata: {
                    isMulti: false,
                    exerciseCount: 1,
                    method_used: relevantMethods[0]?.exercise_type ?? null,
                    method_similarity: relevantMethods[0]?.similarity ?? null,
                    exercises_matched: isContextMatch ? 1 : 0,
                    svgs: svgOutputs,
                  },
                })}\n\n`
              )
            );

            // ── Verificare matematică DUPĂ done (eveniment separat) ──
            // Sărită când răspunsul conține SVG-uri din calculatoare
            // (matematica e deja calculată determinist de tool-uri).
            if (assistantText && chatMode === 'study' && svgOutputs.length === 0) {
              try {
                const vResult = await Promise.race([
                  verifyMath(message, assistantText),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                ]);
                if (vResult && vResult.confidence > 0) {
                  const verificationData: Pick<VerificationResult, 'isCorrect' | 'confidence'> =
                    { isCorrect: vResult.isCorrect, confidence: vResult.confidence };
                  console.log(`[chat/route] verification done (post-done): isCorrect=${vResult.isCorrect} confidence=${vResult.confidence.toFixed(2)}`);
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ verification: verificationData })}\n\n`)
                  );
                }
              } catch (vErr) {
                console.warn('[chat/route] verification skipped:', vErr instanceof Error ? vErr.message : vErr);
              }
            }
          }

          // ── ETAPA 63: verdictul încercării — eveniment separat, după done ──
          if (attemptPromise) {
            try {
              const attemptResult = await Promise.race([
                attemptPromise,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
              ]);
              const evaluation = attemptResult?.evaluation ?? null;
              if (evaluation) {
                console.log(`[chat/route] attempt evaluated: method=${evaluation.method} correct=${evaluation.correct} confidence=${evaluation.confidence.toFixed(2)}`);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      attempt: {
                        correct: evaluation.correct,
                        method: evaluation.method,
                        confidence: evaluation.confidence,
                        helped: attemptResult ? attemptResult.weight < 1 : false,
                      },
                    })}\n\n`
                  )
                );
              }
            } catch (aErr) {
              console.warn("[chat/route] attempt event skipped:", aErr instanceof Error ? aErr.message : aErr);
            }
          }

          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Eroare AI";
          console.error("[chat/route] stream error:", err instanceof Error ? err.stack : err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
      }

      // ── Post-stream saves ───────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let service: any;
      try {
        service = createServiceClient();
      } catch (err) {
        console.error("[chat/route] createServiceClient failed:", err instanceof Error ? err.stack : err);
        return;
      }

      if (assistantText) {
        const { error: asstErr } = await service.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantText,
          tokens_input: inputTokens,
          tokens_output: outputTokens,
        });
        if (asstErr) {
          console.error("[chat/route] assistant message insert error:", JSON.stringify(asstErr, null, 2));
        }
      }

      // ── Log gap if no library match ─────────────────────────────
      if (!ragMatch && queryEmbedding) {
        service.from("gap_analysis").insert({
          query: message,
          query_embedding: queryEmbedding,
          user_id: user.id,
          conversation_id: convId,
          max_similarity_found: 0,
        }).then(({ error }: { error: unknown }) => {
          if (error) console.error("[chat/route] gap_analysis insert error:", error);
        });
      }

      // ── Cost log (only for AI calls) — ETAPA 66: + latență + cache ──
      if (!isDirectMatch && inputTokens > 0) {
        try {
          const pricing = await getTaskPricing(taskName);
          const cost = computeLlmCost({
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheWriteTokens,
            priceInputPer1M: pricing.price_input_per_1m,
            priceOutputPer1M: pricing.price_output_per_1m,
          });

          const { error: logErr } = await service.from("api_usage_log").insert({
            user_id: user.id,
            model: pricing.model_name,
            task_name: taskName,
            tokens_input: inputTokens,
            tokens_output: outputTokens,
            cached_input_tokens: cacheReadTokens,
            latency_ms_total: Date.now() - requestStart,
            latency_ms_ttfb: ttfbMs,
            cost_usd: cost,
            endpoint: "/api/chat",
            // ETAPA 75 C3: decizia de rutare se loghează (audit + distribuție)
            routed_difficulty: `${difficulty.level}:${difficulty.score}`,
          });
          if (logErr) {
            console.error("[chat/route] api_usage_log insert error:", JSON.stringify(logErr, null, 2));
          }
        } catch (err) {
          console.error("[chat/route] pricing/log error:", err instanceof Error ? err.stack : err);
        }
      }

      if (!isPremium) {
        try {
          const { error: rlErr } = await supabase.rpc("increment_rate_limit", {
            p_user_id: user.id,
            p_action_type: "message",
          });
          if (rlErr) {
            console.error("[chat/route] increment_rate_limit error:", JSON.stringify(rlErr, null, 2));
          }
        } catch (err) {
          console.error("[chat/route] increment_rate_limit threw:", err instanceof Error ? err.stack : err);
        }
      }

      // ── ETAPA 66 F3: alerta de cost zilnic (o dată pe zi, best-effort) ──
      void maybeWriteDailyCostAlert(service);

      // ── ETAPA 60 (PAS 5) + ETAPA 63 + ETAPA 70 D: evidență pentru sesiunea ancorată ──
      // Cu verdict de încredere (determinist sau judecător ≥ 0.8) → EMA se mișcă;
      // fără verdict → correct=null = doar urmă de expunere (mastery neatins).
      // Reușita CU ajutor → pas înjumătățit; după rezolvarea arătată → zero.
      if (anchoredConceptSlug) {
        try {
          const attemptResult = attemptPromise ? await attemptPromise : null;
          const evaluation = attemptResult?.evaluation ?? null;
          const weight = evaluation?.correct === true ? (attemptResult?.weight ?? 1) : 1;
          await recordConceptEvidence(
            service,
            user.id,
            [anchoredConceptSlug],
            evaluation?.correct ?? null,
            "chat",
            weight
          );
        } catch (err) {
          console.error("[chat/route] chat evidence failed:", err instanceof Error ? err.message : err);
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": convId,
    },
  });
}
