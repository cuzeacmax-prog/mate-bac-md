/**
 * state.ts — ETAPA 71 B2: stările nodurilor hărții cunoașterii.
 *
 * REFOLOSEȘTE sursele existente, nu le duplică:
 *  - frontier_concepts (RPC, ETAPA 60/61) → „disponibil";
 *  - concept_mastery + MASTERY_THRESHOLD (ETAPA 68) → „în lucru"/„stăpânit";
 *  - restul = „blocat" (prerechizite nestăpânite).
 * Regula stării (documentată, fără coeficienți noi):
 *  stăpânit: mastery ≥ 0.6 · în lucru: 0 < mastery < 0.6 ·
 *  disponibil: pe frontieră cu mastery 0 · blocat: restul.
 * Folosit ȘI de pagina /app/harta, ȘI de scriptul de acceptanță (R1).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MASTERY_THRESHOLD } from '@/lib/progres/data';
import { MODULE_DOMAINS, type DomainColor } from './domain-colors';
import { MAP_LAYOUTS, type MapLayout, type MapLayoutNode } from './layouts';
import { milestoneOf, type Milestone } from './milestones';
import { getActiveFocus, type ActiveFocus } from './focus';

export type NodeStatus = 'blocat' | 'disponibil' | 'in-lucru' | 'stapanit';

export interface MapNode extends MapLayoutNode {
  status: NodeStatus;
  mastery: number;
  milestone: Milestone | null;
  /** prereq-urile cu starea lor (pentru sheet: „Deblocat de / Cere întâi") */
  prereqState: Array<{ slug: string; name: string; mastered: boolean }>;
}

export interface MapDomain {
  key: DomainColor['key'];
  module: string;
  label: string;
  width: number;
  height: number;
  edges: MapLayout['edges'];
  nodes: MapNode[];
  counts: Record<NodeStatus, number>;
}

export interface KnowledgeMap {
  domains: MapDomain[];
  focus: ActiveFocus | null;
  /** nota-țintă din onboarding (lentila Nota-țintă); null = fără țintă */
  targetGrade: number | null;
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
    service.from('concept_mastery').select('concept_id, mastery').eq('user_id', userId),
    service.rpc('frontier_concepts', { p_user_id: userId, p_grade: grade, p_limit: 500 }),
    getActiveFocus(service, userId),
    service.from('user_profiles').select('target_bac_score').eq('id', userId).maybeSingle(),
  ]);

  const masteryById = new Map(
    (mastery.data ?? []).map((m) => [m.concept_id as string, Number(m.mastery)])
  );
  const frontierIds = new Set(
    ((frontier.data ?? []) as Array<{ concept_id: string }>).map((r) => r.concept_id)
  );

  const domains: MapDomain[] = [];
  for (const [module, d] of Object.entries(MODULE_DOMAINS)) {
    const layout = MAP_LAYOUTS[d.key];
    if (!layout) continue;
    const nodes: MapNode[] = layout.nodes.map((n) => {
      const m = masteryById.get(n.id);
      return {
        ...n,
        status: deriveStatus(m, frontierIds.has(n.id)),
        mastery: m ?? 0,
        milestone: milestoneOf(n.slug),
        prereqState: n.prereqs.map((p) => ({
          slug: p.slug,
          name: p.name,
          mastered: (masteryById.get(p.id) ?? 0) >= MASTERY_THRESHOLD,
        })),
      };
    });
    const counts: Record<NodeStatus, number> = { blocat: 0, disponibil: 0, 'in-lucru': 0, stapanit: 0 };
    for (const n of nodes) counts[n.status]++;
    domains.push({
      key: d.key,
      module,
      label: layout.label,
      width: layout.width,
      height: layout.height,
      edges: layout.edges,
      nodes,
      counts,
    });
  }

  const rawTarget = (profile.data as { target_bac_score?: number | string | null } | null)?.target_bac_score;
  return {
    domains,
    focus,
    targetGrade: rawTarget != null ? Number(rawTarget) : null,
  };
}
