/**
 * src/lib/tools/calculator-registry.ts
 *
 * Vercel AI SDK Tool definitions pentru calculatoarele matematice BAC MD.
 * Fiecare tool apelează funcțiile din @/lib/geometry sau @/lib/analysis DIRECT
 * (nu HTTP round-trip), compilează TikZ→SVG via Railway service (TIKZ_COMPILE_URL).
 *
 * Design:
 *  - `compileSafe` — eșec silențios (svg: null) dacă serviciul nu e configurat
 *  - Dacă SVG eșuează, AI răspunde cu text + calcule (backward compat)
 *  - Parametri Zod corespund exact tipurilor din @/lib/geometry / @/lib/analysis
 */

import { tool } from 'ai';
import { z } from 'zod';
import { compileTikz } from '@/lib/tikz/compile';

// ─── Geometry: corpi de rotație ───────────────────────────────────────────────
import {
  generateConeAdvanced,
  generateCylinderAdvanced,
  generateSphereAdvanced,
} from '@/lib/geometry/rotational';

// ─── Geometry: prisme, cuburi ─────────────────────────────────────────────────
import { generateRectangularPrismAdvanced } from '@/lib/geometry/solid3d';

// ─── Geometry: piramide ───────────────────────────────────────────────────────
import { generateRegularPyramidAdvanced } from '@/lib/geometry/pyramid';

// ─── Analysis: funcții elementare ────────────────────────────────────────────
import {
  generateQuadraticFunctionPlot,
  generateLinearFunctionPlot,
} from '@/lib/analysis/functionElementary';

// ─── Analysis: integrală, monotonie ──────────────────────────────────────────
import { generateIntegralVisualization } from '@/lib/analysis/integral';
import { generateMonotonicityPlot } from '@/lib/analysis/derivativeApplications';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Compilează TikZ la SVG via Railway service.
 * Returnează null dacă serviciul nu e configurat sau eșuează —
 * AI-ul continuă cu răspuns text fără imagine.
 */
async function compileSafe(tikzCode: string): Promise<string | null> {
  if (!process.env.TIKZ_COMPILE_URL) return null;
  try {
    const result = await compileTikz(tikzCode);
    return result.svg ?? null;
  } catch (err) {
    console.warn(
      '[calculator-registry] TikZ compile failed:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ─── Tool definitions (Vercel AI SDK v6) ─────────────────────────────────────

export const CALCULATOR_TOOLS = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3D — Corpi de rotație
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  render_cone: tool({
    description:
      'Generează desen SVG al unui con circular drept. Apelează când elevul cere vizualizarea unui con sau rezolvarea problemei de con (volum, arie). Returnează SVG + {volume, lateral_area, slant_height}.',
    inputSchema: z.object({
      base_radius: z.number().positive().describe('Raza bazei conului (ex: 3)'),
      height: z.number().positive().describe('Înălțimea conului (ex: 4)'),
      show_slant_height: z.boolean().optional().describe('Afișează generatoarea l (default true)'),
    }),
    execute: async ({ base_radius, height, show_slant_height = true }) => {
      const result = generateConeAdvanced({
        base_radius,
        height,
        show_axis: true,
        show_radius: true,
        show_slant_height,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'cone' as const };
    },
  }),

  render_cylinder: tool({
    description:
      'Generează desen SVG al unui cilindru circular drept. Returnează SVG + {volume, lateral_area, total_area}.',
    inputSchema: z.object({
      radius: z.number().positive().describe('Raza bazei cilindrului'),
      height: z.number().positive().describe('Înălțimea cilindrului'),
    }),
    execute: async ({ radius, height }) => {
      const result = generateCylinderAdvanced({
        radius,
        height,
        show_axis: true,
        show_radius: true,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'cylinder' as const };
    },
  }),

  render_sphere: tool({
    description:
      'Generează desen SVG al unei sfere. Returnează SVG + {volume, total_area}.',
    inputSchema: z.object({
      radius: z.number().positive().describe('Raza sferei'),
    }),
    execute: async ({ radius }) => {
      const result = generateSphereAdvanced({
        radius,
        show_radius: true,
        show_equator: true,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'sphere' as const };
    },
  }),

  render_pyramid: tool({
    description:
      'Generează desen SVG al unei piramide regulate. Apelează pentru piramide cu baza pătrat (base_sides=4), triunghi (3), hexagon (6).',
    inputSchema: z.object({
      base_sides: z.number().int().min(3).max(8).describe('Numărul de laturi ale bazei (3=triunghi, 4=pătrat, 6=hexagon)'),
      base_radius: z.number().positive().describe('Raza cercului circumscris bazei (ex: 2)'),
      height: z.number().positive().describe('Înălțimea piramidei'),
    }),
    execute: async ({ base_sides, base_radius, height }) => {
      const result = generateRegularPyramidAdvanced({
        base_sides,
        base_radius,
        height,
        show_height: true,
        show_hidden_lines: true,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'pyramid' as const };
    },
  }),

  render_prism: tool({
    description:
      'Generează desen SVG al unui paralelipiped dreptunghic (prismă dreptunghiulară). Returnează SVG + {volume, surface_area, diagonal_3d}.',
    inputSchema: z.object({
      length: z.number().positive().describe('Lungimea bazei'),
      width: z.number().positive().describe('Lățimea bazei'),
      height: z.number().positive().describe('Înălțimea prismei'),
    }),
    execute: async ({ length, width, height }) => {
      const result = generateRectangularPrismAdvanced({ length, width, height });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'prism' as const };
    },
  }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Analysis — Funcții și grafice
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  render_quadratic_function: tool({
    description:
      'Graficul parabolei f(x) = ax² + bx + c. Afișează parabola, vârful V, rădăcinile x₁,x₂, discriminantul. Apelează pentru probleme cu ecuații de gradul 2 sau funcții pătratice.',
    inputSchema: z.object({
      a: z.number().describe('Coeficientul lui x² (≠0, determină deschiderea parabolei)'),
      b: z.number().describe('Coeficientul lui x'),
      c: z.number().describe('Termenul liber'),
    }),
    execute: async ({ a, b, c }) => {
      if (a === 0) return { error: 'a≠0 pentru funcție pătratică', type: 'error' as const, svg: null, computed: {} };
      const result = generateQuadraticFunctionPlot({
        a, b, c,
        show_vertex: true,
        show_discriminant: true,
        show_x_intercepts: true,
        show_y_intercept: true,
        show_grid: true,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'quadratic' as const };
    },
  }),

  render_linear_function: tool({
    description:
      'Graficul funcției liniare f(x) = ax + b. Afișează dreapta, panta, intersecțiile cu Ox și Oy.',
    inputSchema: z.object({
      a: z.number().describe('Panta dreptei (coeficientul lui x)'),
      b: z.number().describe('Ordonata la origine'),
    }),
    execute: async ({ a, b }) => {
      const result = generateLinearFunctionPlot({
        a, b,
        show_grid: true,
        show_intercepts: true,
        show_equation: true,
        show_slope_triangle: Math.abs(a) < 10,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'linear' as const };
    },
  }),

  render_integral: tool({
    description:
      'Vizualizează aria de sub graficul funcției f(x) pe intervalul [a, b] (hașurată). Apelează pentru integrare definită și calcul de arii la BAC MD.',
    inputSchema: z.object({
      expression: z.string().describe(
        'Expresia f(x) în JavaScript: "x**2", "3*x+1", "Math.sin(x)", "x**3-3*x". Folosește "**" pentru putere.'
      ),
      a: z.number().describe('Capătul stâng al intervalului de integrare'),
      b: z.number().describe('Capătul drept al intervalului de integrare'),
    }),
    execute: async ({ expression, a, b }) => {
      const result = generateIntegralVisualization({
        expression, a, b,
        show_riemann: false,
        show_bounds: true,
        fill_color: 'blue!25',
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'integral' as const };
    },
  }),

  render_monotonicity: tool({
    description:
      'Graficul funcției cu intervale de monotonie colorate (verde=crescătoare, roșu=descrescătoare) și extremele locale marcate. Apelează pentru studiul funcțiilor, derivate, monotonie, min/max.',
    inputSchema: z.object({
      expression: z.string().describe(
        'Expresia f(x) în JavaScript: "x**3-3*x", "x**2-4*x+3", "Math.exp(x)"'
      ),
      domain_min: z.number().describe('Capătul stâng al domeniului de vizualizat'),
      domain_max: z.number().describe('Capătul drept al domeniului de vizualizat'),
      show_derivative: z.boolean().optional().describe(
        'Dacă true, afișează graficul derivatei f\'(x) (portocaliu dashed)'
      ),
    }),
    execute: async ({ expression, domain_min, domain_max, show_derivative = false }) => {
      const result = generateMonotonicityPlot({
        expression,
        domain: [domain_min, domain_max],
        show_extrema: true,
        show_derivative,
      });
      const svg = await compileSafe(result.tikz);
      return { svg, computed: result.computed, type: 'monotonicity' as const };
    },
  }),

} as const;

export type CalculatorToolName = keyof typeof CALCULATOR_TOOLS;

// ─── Keyword → Tool mapping ───────────────────────────────────────────────────

/**
 * Keywords asociate fiecărui tool.
 * Folosite de `resolveToolsForMethod` pentru a mapa câmpul
 * `required_tools` din solution_methods la tool-urile concrete.
 */
export const TOOL_KEYWORDS: Record<CalculatorToolName, string[]> = {
  render_cone:               ['con', 'cone', 'solid3d', 'rotational', 'con_arii_volum'],
  render_cylinder:           ['cilindru', 'cylinder', 'solid3d', 'rotational', 'cilindru_arii_volum'],
  render_sphere:             ['sfera', 'sphere', 'solid3d', 'rotational', 'sfera_arii_volum'],
  render_pyramid:            ['piramida', 'pyramid', 'solid3d', 'piramida_arii_volum'],
  render_prism:              ['prisma', 'prism', 'paralelipiped', 'solid3d'],
  render_quadratic_function: ['ecuatie_grad_2', 'quadratic', 'parabola', 'functie_patratica', 'functionPlot2D'],
  render_linear_function:    ['ecuatie_grad_1', 'linear', 'liniara', 'dreapta'],
  render_integral:           ['integrala', 'integral', 'arie', 'areaUnderCurve', 'integrala_definita', 'primitiva'],
  render_monotonicity:       ['monotonie', 'monotonicity', 'derivata', 'extreme', 'derivata_aplicatii_monotonie'],
};
