/**
 * src/lib/tools/tool-resolver.ts
 *
 * Mapare: required_tools[] + exercise_type (din solution_methods) → CalculatorTools subset
 *
 * Logica:
 *  1. `resolveToolsForMethod` → determină ce tooluri să activeze
 *  2. `buildToolSubset` → returnează un subset din CALCULATOR_TOOLS pentru `streamText`
 */

import {
  CALCULATOR_TOOLS,
  TOOL_KEYWORDS,
  type CalculatorToolName,
} from './calculator-registry';

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Determină ce tooluri să activeze pentru o metodă BAC MD.
 *
 * Primește `required_tools` din solution_methods (ex: ["solid3d", "areaUnderCurve"])
 * și `exerciseType` (ex: "con_arii_volum") pentru a rafina alegerea.
 *
 * Returnează lista de CalculatorToolName relevante.
 */
export function resolveToolNamesForMethod(
  requiredTools: string[] | null | undefined,
  exerciseType?: string
): CalculatorToolName[] {
  if (!requiredTools || requiredTools.length === 0) return [];

  const resolved = new Set<CalculatorToolName>();
  const allToolNames = Object.keys(CALCULATOR_TOOLS) as CalculatorToolName[];

  for (const reqKey of requiredTools) {
    const keyLower = reqKey.toLowerCase();

    for (const toolName of allToolNames) {
      const keywords = TOOL_KEYWORDS[toolName];
      const matches = keywords.some(
        (kw) => keyLower.includes(kw) || kw.includes(keyLower)
      );
      if (matches) {
        resolved.add(toolName);
      }
    }
  }

  // Dacă exerciseType e furnizat, filtrăm mai precis:
  // "solid3d" mapează la mai multe corpuri — exerciseType ne spune care
  if (exerciseType) {
    const etLower = exerciseType.toLowerCase();

    const solid3dTools: CalculatorToolName[] = [
      'render_cone', 'render_cylinder', 'render_sphere',
      'render_pyramid', 'render_prism',
    ];

    // Dacă avem mai mult de un solid3d tool și exercise_type e specific
    const solid3dResolved = solid3dTools.filter(t => resolved.has(t));
    if (solid3dResolved.length > 1) {
      // Eliminăm toolurile care nu se potrivesc cu exerciseType
      for (const solid of solid3dTools) {
        if (resolved.has(solid)) {
          const isRelevant = TOOL_KEYWORDS[solid].some(kw =>
            etLower.includes(kw) || kw.includes(etLower.split('_')[0])
          );
          if (!isRelevant) {
            resolved.delete(solid);
          }
        }
      }
    }
  }

  return Array.from(resolved);
}

/**
 * Construiește un subset din CALCULATOR_TOOLS pentru a fi pasat la `streamText`.
 * Returnează obiect vid dacă nu există tooluri relevante.
 */
export function buildToolSubset(
  toolNames: CalculatorToolName[]
): Partial<typeof CALCULATOR_TOOLS> {
  if (toolNames.length === 0) return {};
  return Object.fromEntries(
    toolNames.map(name => [name, CALCULATOR_TOOLS[name]])
  ) as Partial<typeof CALCULATOR_TOOLS>;
}

/**
 * Shortcut: combină resolveToolNamesForMethod + buildToolSubset.
 */
export function resolveToolsForMethod(
  requiredTools: string[] | null | undefined,
  exerciseType?: string
): Partial<typeof CALCULATOR_TOOLS> {
  const names = resolveToolNamesForMethod(requiredTools, exerciseType);
  return buildToolSubset(names);
}

/**
 * True dacă există cel puțin un tool disponibil pentru această metodă.
 */
export function hasTools(
  requiredTools: string[] | null | undefined,
  exerciseType?: string
): boolean {
  return resolveToolNamesForMethod(requiredTools, exerciseType).length > 0;
}
