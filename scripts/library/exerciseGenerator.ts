import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface GeneratedExercise {
  statement: string;
  solution: string;
  topic: string;
  subtopic: string;
  difficulty: number;
  grade_level: number;
  tags: string[];
}

interface GenerationContext {
  shape: string;
  params: unknown;
  computed: Record<string, unknown>;
}

export async function generateExerciseFromTriangle(
  ctx: GenerationContext,
): Promise<GeneratedExercise> {
  const prompt = `Ești un profesor de matematică pentru bacalaureatul din Moldova.
Generează un exercițiu cu soluție completă bazat pe triunghiul descris mai jos.

Date geometrice:
- Formă: ${ctx.shape}
- Parametri: ${JSON.stringify(ctx.params, null, 2)}
- Valori calculate: ${JSON.stringify(ctx.computed, null, 2)}

Cerințe:
1. Enunțul trebuie să fie în română, clar și adecvat pentru elevi de clasa 10-12.
2. Soluția trebuie să fie completă, pas cu pas, cu justificări.
3. Dificultatea trebuie să fie un număr de la 1 (ușor) la 5 (foarte dificil).
4. Tag-urile trebuie să fie cuvinte cheie relevante în română (ex: "triunghi", "arie", "perimetru").

Răspunde EXCLUSIV cu JSON valid (fără markdown, fără backticks), cu structura:
{
  "statement": "...",
  "solution": "...",
  "topic": "geometrie_plana",
  "subtopic": "...",
  "difficulty": 2,
  "grade_level": 10,
  "tags": ["...", "..."]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  const parsed = JSON.parse(cleaned) as GeneratedExercise;
  return parsed;
}
