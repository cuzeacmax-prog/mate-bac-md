/**
 * state.ts — ETAPA 71 B2 → ETAPA 76 B+C: stările nodurilor hărții cunoașterii.
 *
 * REFOLOSEȘTE sursele existente, nu le duplică:
 *  - frontier_concepts (RPC, ETAPA 60/61) → „disponibil" + DRUMUL recomandat;
 *  - concept_mastery + MASTERY_THRESHOLD (ETAPA 68) → „în lucru"/„stăpânit";
 *  - restul = „blocat" (prerechizite nestăpânite).
 * Regula stării (documentată, fără coeficienți noi):
 *  stăpânit: mastery ≥ 0.6 · în lucru: 0 < mastery < 0.6 ·
 *  disponibil: pe frontieră cu mastery 0 · blocat: restul.
 *
 * ETAPA 76:
 *  - domeniile au FELII PE CLASĂ (layout v2) — selectorul comută instant;
 *  - QUEST (FAZA B): ultimul concept stăpânit → recomandatul → următoarele 2
 *    de pe frontieră (determinist, din frontier_concepts);
 *  - prereq-urile cară clasa+domeniul (FAZA C2: portaluri cross-grade).
 * Folosit ȘI de pagina /app/harta, ȘI de scriptul de acceptanță (R1).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MASTERY_THRESHOLD } from '@/lib/progres/data';
import { resolveGoal, type Goal } from '@/lib/profile/goal';
import { MODULE_DOMAINS, type DomainColor } from './domain-colors';
import { MAP_LAYOUTS, placeForSlug, type MapLayoutNode } from './layouts';
import { milestoneOf, type Milestone } from './milestones';
import { getActiveFocus, type ActiveFocus } from './focus';

export type NodeStatus = 'blocat' | 'disponibil' | 'in-lucru' | 'stapanit';

export interface MapNode extends MapLayoutNode {
  status: NodeStatus;
  mastery: number;
  milestone: Milestone | null;
  /** prereq-urile cu starea lor + LOCUL lor pe hartă (portaluri cross-grade) */
  prereqState: Array<{
    slug: string;
    name: string;
    mastered: boolean;
    grade: number | null;
    domain: DomainColor['key'] | null;
  }>;
}

export interface MapGradeSlice {
  grade: number;
  width: number;
  height: number;
  edges: Array<{ from: string; to: string }>;
  nodes: MapNode[];
  counts: Record<NodeStatus, number>;
}

export interface MapDomain {
  key: DomainColor['key'];
  module: string;
  label: string;
  /** feliile pe clasă — DOAR clasele cu noduri (selector onest) */
  grades: Record<string, MapGradeSlice>;
}

/** FAZA B: un pas de pe drumul recomandat */
export interface QuestStep {
  id: string;
  slug: string;
  name: string;
  kind: 'stapanit' | 'recomandat' | 'urmeaza';
}

export interface KnowledgeMap {
  domains: MapDomain[];
  focus: ActiveFocus | null;
  /** nota-țintă din onboarding (lentila Nota-țintă); null = fără țintă */
  targetGrade: number | null;
  /** clasa elevului (selectorul de clasă pornește aici) */
  studentGrade: number;
  /** ETAPA 82: obiectivul elevului (BAC ca mod, nu cadru) */
  goal: Goal;
  /** drumul: ultimul stăpânit → recomandat → următoarele 2 (determinist) */
  quest: QuestStep[];
}

export function deriveStatus(mastery: number | undefined, onFrontier: boolean): NodeStatus {
  const m = mastery ?? 0;
  if (m >= MASTERY_THRESHOLD) return 'stapanit';
  if (m > 0) return 'in-lucru';
  if (onFrontier) return 'disponibil';
  return 'blocat';
}

/** UN singur fetch agregat pentru toată harta (zero LLM). */
export async function getKnowledgeMap(
  service: SupabaseClient,
  userId: string,
  grade: number
): Promise<KnowledgeMap> {
  const [mastery, frontier, focus, profile] = await Promise.all([
    service
      .from('concept_mastery')
      .select('concept_id, mastery, last_evidence_at')
      .eq('user_id', userId),
    service.rpc('frontier_concepts', { p_user_id: userId, p_grade: grade, p_limit: 500 }),
    getActiveFocus(service, userId),
    service.from('user_profiles').select('target_bac_score, goal').eq('id', userId).maybeSingle(),
  ]);
  const goal = resolveGoal((profile.data as { goal?: string | null } | null)?.goal);

  const masteryById = new Map(
    (mastery.data ?? []).map((m) => [m.concept_id as string, Number(m.mastery)])
  );
  const frontierRows = (frontier.data ?? []) as Array<{ concept_id: string; slug: string; name: string }>;
  const frontierIds = new Set(frontierRows.map((r) => r.concept_id));

  const domains: MapDomain[] = [];
  for (const [module, d] of Object.entries(MODULE_DOMAINS)) {
    const layout = MAP_LAYOUTS[d.key];
    if (!layout) continue;
    const grades: Record<string, MapGradeSlice> = {};
    for (const [gradeKey, gl] of Object.entries(layout.grades)) {
      const nodes: MapNode[] = gl.nodes.map((n) => {
        const m = masteryById.get(n.id);
        return {
          ...n,
          status: deriveStatus(m, frontierIds.has(n.id)),
          mastery: m ?? 0,
          milestone: milestoneOf(n.slug),
          prereqState: n.prereqs.map((p) => {
            const place = placeForSlug(p.slug);
            return {
              slug: p.slug,
              name: p.name,
              mastered: (masteryById.get(p.id) ?? 0) >= MASTERY_THRESHOLD,
              grade: p.grade ?? place?.grade ?? null,
              domain: place?.domain ?? null,
            };
          }),
        };
      });
      const counts: Record<NodeStatus, number> = { blocat: 0, disponibil: 0, 'in-lucru': 0, stapanit: 0 };
      for (const n of nodes) counts[n.status]++;
      grades[gradeKey] = { grade: Number(gradeKey), width: gl.width, height: gl.height, edges: gl.edges, nodes, counts };
    }
    domains.push({ key: d.key, module, label: layout.label, grades });
  }

  // ── FAZA B: drumul recomandat (determinist, din sursele existente) ────────
  const nameById = new Map<string, { slug: string; name: string }>();
  for (const dom of domains) {
    for (const slice of Object.values(dom.grades)) {
      for (const n of slice.nodes) nameById.set(n.id, { slug: n.slug, name: n.name });
    }
  }
  // ETAPA 82 C3: drumul recomandat se calculează în cadrul clasei+obiectivului.
  // explorare → „fără presiune de traseu obligatoriu" (quest gol, hartă liberă).
  const quest: QuestStep[] = [];
  if (goal !== 'explorare') {
    const masteredSorted = (mastery.data ?? [])
      .filter((m) => Number(m.mastery) >= MASTERY_THRESHOLD && nameById.has(m.concept_id as string))
      .sort((a, b) => String(b.last_evidence_at ?? '').localeCompare(String(a.last_evidence_at ?? '')));
    if (masteredSorted[0]) {
      const id = masteredSorted[0].concept_id as string;
      quest.push({ id, ...nameById.get(id)!, kind: 'stapanit' });
    }
    for (const [i, r] of frontierRows.slice(0, 3).entries()) {
      if (!nameById.has(r.concept_id)) continue;
      quest.push({
        id: r.concept_id,
        ...nameById.get(r.concept_id)!,
        kind: i === 0 ? 'recomandat' : 'urmeaza',
      });
    }
  }

  const rawTarget = (profile.data as { target_bac_score?: number | string | null } | null)?.target_bac_score;
  return {
    domains,
    focus,
    targetGrade: rawTarget != null ? Number(rawTarget) : null,
    studentGrade: grade,
    goal,
    quest,
  };
}
