/**
 * math-verifier.ts — Verificare matematică silențioasă (background)
 * Model: Haiku 4.5 (rapid, cost mic: ~$0.001/verificare)
 * Rulează DUPĂ ce stream-ul principal s-a terminat.
 */

// ETAPA 59 (P7): modelul vine din ai_model_config (task 'verify_math'), prin router —
// zero modele hardcodate în src/lib.
import { callAI } from '@/lib/ai/router';

export interface VerificationResult {
  isCorrect: boolean;
  confidence: number;   // 0.0–1.0
  issues: string[];     // probleme detectate (gol dacă corect)
  suggestions: string[]; // sugestii corectare
  verifiedAt: Date;
}

const VERIFIER_PROMPT = `Ești validator matematic strict pentru BAC Republica Moldova.

Primești o întrebare de matematică și răspunsul unui AI.

Verifici:
1. Calcule aritmetice corecte (Δ = b²-4ac, rădăcini, fracții)
2. Transformări algebrice corecte (pași equivalenți)
3. DVA respectat (soluțiile verificate în domeniu)
4. Logica pasilor (ordinea corectă)
5. Răspunsul final consistent cu calculul

OUTPUT: JSON valid ȘI NIMIC ALTCEVA (fără text în afara JSON):
{
  "isCorrect": true,
  "confidence": 0.95,
  "issues": [],
  "suggestions": []
}

Dacă sunt probleme:
{
  "isCorrect": false,
  "confidence": 0.85,
  "issues": ["Discriminantul calculat greșit: b² = 25, nu 20"],
  "suggestions": ["Recalculați Δ = (-5)² - 4·1·6 = 25 - 24 = 1"]
}

Fii STRICT cu calculele, TOLERANT cu stilul de prezentare.
Dacă nu ești sigur (confidence < 0.6), returnează isCorrect: true.`;

export async function verifyMath(
  question: string,
  aiResponse: string,
): Promise<VerificationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return makeDefault();
  }

  try {
    const { text } = await callAI(
      'verify_math',
      [
        {
          role: 'user',
          content: `Întrebare elev:\n${question.slice(0, 500)}\n\nRăspuns AI:\n${aiResponse.slice(0, 2000)}\n\nReturnează JSON.`,
        },
      ],
      { system: VERIFIER_PROMPT }
    );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return makeDefault();

    const parsed = JSON.parse(jsonMatch[0]) as {
      isCorrect?: boolean;
      confidence?: number;
      issues?: string[];
      suggestions?: string[];
    };

    return {
      isCorrect: parsed.isCorrect !== false,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      verifiedAt: new Date(),
    };
  } catch (err) {
    console.error('[math-verifier] Error:', err instanceof Error ? err.message : err);
    return makeDefault();
  }
}

function makeDefault(): VerificationResult {
  return {
    isCorrect: true,
    confidence: 0,
    issues: [],
    suggestions: [],
    verifiedAt: new Date(),
  };
}
