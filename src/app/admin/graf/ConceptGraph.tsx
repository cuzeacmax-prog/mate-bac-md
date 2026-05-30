"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

// ── Tipuri ───────────────────────────────────────────────────────────────────
export interface GraphConcept {
  id: string;
  name: string;
  kind: string;
  module: string | null;
  subtopic: string | null;
  order_in_grade: number;
  sub_points: string[];
  status: string;
}

interface SubtopicGroup {
  key: string;
  title: string;
  concepts: GraphConcept[];
}
interface ModuleGroup {
  key: string;
  title: string;
  count: number;
  subtopics: SubtopicGroup[];
}

interface ModuleNodeData extends Record<string, unknown> {
  label: string;
  count: number;
  expanded: boolean;
}
interface SubtopicNodeData extends Record<string, unknown> {
  label: string;
  count: number;
  expanded: boolean;
}
interface ConceptNodeData extends Record<string, unknown> {
  concept: GraphConcept;
  selected: boolean;
}

// ── Culori pe kind ───────────────────────────────────────────────────────────
const KIND_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  definitie: { bg: "#dbeafe", text: "#1e40af", label: "definiție" },
  teorema: { bg: "#ede9fe", text: "#6d28d9", label: "teoremă" },
  formula: { bg: "#dcfce7", text: "#166534", label: "formulă" },
  procedeu: { bg: "#ffedd5", text: "#9a3412", label: "procedeu" },
  concept: { bg: "#f1f5f9", text: "#334155", label: "concept" },
  notiune: { bg: "#f1f5f9", text: "#334155", label: "noțiune" },
};
const kindStyle = (k: string) => KIND_STYLE[k] ?? { bg: "#f1f5f9", text: "#334155", label: k };

// ── Grupare (carry-forward pe order_in_grade pentru modulele lipsă) ──────────
function moduleNum(m: string | null): number | null {
  if (!m) return null;
  const match = m.match(/Modulul\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function buildTree(concepts: GraphConcept[]): ModuleGroup[] {
  const bestTitle = new Map<number, string>();
  for (const c of concepts) {
    const n = moduleNum(c.module);
    if (n != null && c.module) {
      const cur = bestTitle.get(n);
      if (!cur || c.module.length > cur.length) bestTitle.set(n, c.module);
    }
  }
  const sorted = [...concepts].sort(
    (a, b) =>
      a.order_in_grade - b.order_in_grade ||
      (moduleNum(a.module) == null ? 1 : 0) - (moduleNum(b.module) == null ? 1 : 0) ||
      a.name.localeCompare(b.name, "ro"),
  );

  const modules = new Map<string, ModuleGroup>();
  let lastNum: number | null = null;
  for (const c of sorted) {
    const n = moduleNum(c.module);
    if (n != null) lastNum = n;
    const num = n ?? lastNum;
    const key = num != null ? `Modulul ${num}` : "(fără modul)";
    const title = num != null ? bestTitle.get(num) ?? key : "(fără modul)";
    let mod = modules.get(key);
    if (!mod) {
      mod = { key, title, count: 0, subtopics: [] };
      modules.set(key, mod);
    }
    const subKey = c.subtopic ?? "(fără subtemă)";
    let sub = mod.subtopics.find((s) => s.key === subKey);
    if (!sub) {
      sub = { key: subKey, title: subKey, concepts: [] };
      mod.subtopics.push(sub);
    }
    sub.concepts.push(c);
    mod.count++;
  }
  return [...modules.values()].sort(
    (a, b) => (moduleNum(a.title) ?? 9999) - (moduleNum(b.title) ?? 9999),
  );
}

// ── Layout stratificat cu dagre (NU force-directed) ──────────────────────────
function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 16, ranksep: 110, marginx: 20, marginy: 20 });
  for (const n of nodes) {
    g.setNode(n.id, { width: (n.width as number) ?? 240, height: (n.height as number) ?? 56 });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    const w = (n.width as number) ?? 240;
    const h = (n.height as number) ?? 56;
    return { ...n, position: { x: p.x - w / 2, y: p.y - h / 2 } };
  });
}

// ── Noduri custom ────────────────────────────────────────────────────────────
const hiddenHandle = { opacity: 0, width: 1, height: 1 } as const;

function ModuleNode({ data }: NodeProps) {
  const d = data as ModuleNodeData;
  return (
    <div
      style={{ width: 248 }}
      className="rounded-lg border-2 border-slate-700 bg-slate-800 text-white px-3 py-2 shadow cursor-pointer"
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} />
      <div className="flex items-center gap-2">
        <span className="text-xs">{d.expanded ? "▼" : "▶"}</span>
        <span className="text-sm font-semibold leading-tight flex-1">{d.label}</span>
        <span className="text-xs bg-white/20 rounded px-1.5 py-0.5">{d.count}</span>
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} />
    </div>
  );
}

function SubtopicNode({ data }: NodeProps) {
  const d = data as SubtopicNodeData;
  return (
    <div
      style={{ width: 248 }}
      className="rounded-md border border-slate-400 bg-slate-100 px-3 py-2 shadow-sm cursor-pointer"
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} />
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">{d.expanded ? "▼" : "▶"}</span>
        <span className="text-xs font-medium text-slate-700 leading-tight flex-1">{d.label}</span>
        <span className="text-[10px] bg-slate-300 text-slate-700 rounded px-1.5 py-0.5">{d.count}</span>
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} />
    </div>
  );
}

function ConceptNode({ data }: NodeProps) {
  const d = data as ConceptNodeData;
  const c = d.concept;
  const ks = kindStyle(c.kind);
  return (
    <div
      style={{ width: 230 }}
      className={`rounded-md border bg-white px-2.5 py-2 shadow-sm cursor-pointer transition ${
        d.selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} />
      <div className="text-xs font-medium text-gray-900 leading-snug mb-1">{c.name}</div>
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-medium rounded px-1.5 py-0.5"
          style={{ backgroundColor: ks.bg, color: ks.text }}
        >
          {ks.label}
        </span>
        {c.sub_points.length > 0 && (
          <span className="text-[10px] text-gray-500" title={`${c.sub_points.length} sub-puncte`}>
            📎 {c.sub_points.length}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  moduleNode: ModuleNode,
  subtopicNode: SubtopicNode,
  conceptNode: ConceptNode,
};

// ── Componenta principală ────────────────────────────────────────────────────
export default function ConceptGraph({ concepts }: { concepts: GraphConcept[]; grade: number }) {
  const tree = useMemo(() => buildTree(concepts), [concepts]);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [selected, setSelected] = useState<GraphConcept | null>(null);

  const visibleTree = useMemo(
    () => (moduleFilter ? tree.filter((m) => m.key === moduleFilter) : tree),
    [tree, moduleFilter],
  );

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    for (const mod of visibleTree) {
      const modId = `m:${mod.key}`;
      const modExpanded = expandedModules.has(mod.key);
      ns.push({
        id: modId,
        type: "moduleNode",
        position: { x: 0, y: 0 },
        width: 248,
        height: 56,
        data: { label: mod.title, count: mod.count, expanded: modExpanded } satisfies ModuleNodeData,
      });
      if (!modExpanded) continue;
      for (const sub of mod.subtopics) {
        const subId = `s:${mod.key}::${sub.key}`;
        const subExpanded = expandedSubtopics.has(subId);
        ns.push({
          id: subId,
          type: "subtopicNode",
          position: { x: 0, y: 0 },
          width: 248,
          height: 50,
          data: { label: sub.title, count: sub.concepts.length, expanded: subExpanded } satisfies SubtopicNodeData,
        });
        es.push({ id: `e:${modId}>${subId}`, source: modId, target: subId, type: "smoothstep" });
        if (!subExpanded) continue;
        for (const c of sub.concepts) {
          const cId = `c:${c.id}`;
          ns.push({
            id: cId,
            type: "conceptNode",
            position: { x: 0, y: 0 },
            width: 230,
            height: 62,
            data: { concept: c, selected: selected?.id === c.id } satisfies ConceptNodeData,
          });
          es.push({ id: `e:${subId}>${cId}`, source: subId, target: cId, type: "smoothstep" });
        }
      }
    }
    return { nodes: layout(ns, es), edges: es };
  }, [visibleTree, expandedModules, expandedSubtopics, selected]);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "moduleNode") toggle(setExpandedModules, node.id.slice(2));
      else if (node.type === "subtopicNode") toggle(setExpandedSubtopics, node.id);
      else if (node.type === "conceptNode") setSelected((node.data as ConceptNodeData).concept);
    },
    [],
  );

  const expandAll = () => {
    setExpandedModules(new Set(visibleTree.map((m) => m.key)));
    const subs = new Set<string>();
    for (const m of visibleTree) for (const s of m.subtopics) subs.add(`s:${m.key}::${s.key}`);
    setExpandedSubtopics(subs);
  };
  const collapseAll = () => {
    setExpandedModules(new Set());
    setExpandedSubtopics(new Set());
  };

  return (
    <div>
      {/* Bara de control: filtru + dezvăluire progresivă */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Modul</label>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 max-w-xs"
          >
            <option value="">Toate ({tree.length})</option>
            {tree.map((m) => (
              <option key={m.key} value={m.key}>
                {m.title} ({m.count})
              </option>
            ))}
          </select>
        </div>
        <button onClick={expandAll} className="text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
          Deschide tot
        </button>
        <button onClick={collapseAll} className="text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
          Închide tot
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          Click pe modul/subtemă = expand · click pe concept = detaliu
        </span>
        {/* Legendă kind */}
        <div className="flex items-center gap-2 w-full pt-1 border-t border-gray-100">
          {Object.entries(KIND_STYLE)
            .filter(([k]) => k !== "notiune")
            .map(([k, s]) => (
              <span
                key={k}
                className="text-[10px] font-medium rounded px-1.5 py-0.5"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                {s.label}
              </span>
            ))}
        </div>
      </div>

      <div className="flex gap-3">
        {/* Canvas graf */}
        <div className="flex-1 h-[74vh] border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: false }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} />
          </ReactFlow>
        </div>

        {/* Panou lateral detaliu */}
        {selected && (
          <aside className="w-80 shrink-0 h-[74vh] overflow-y-auto bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{selected.name}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                aria-label="Închide"
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-medium rounded px-2 py-0.5"
                  style={{ backgroundColor: kindStyle(selected.kind).bg, color: kindStyle(selected.kind).text }}
                >
                  {kindStyle(selected.kind).label}
                </span>
                <span className="text-xs text-gray-400">status: {selected.status}</span>
              </div>

              <Detail label="Modul" value={selected.module} />
              <Detail label="Subtemă" value={selected.subtopic} />
              <Detail label="Ordine în clasă" value={String(selected.order_in_grade)} />

              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">
                  Sub-puncte {selected.sub_points.length > 0 ? `(${selected.sub_points.length})` : ""}
                </div>
                {selected.sub_points.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">fără sub-puncte</div>
                ) : (
                  <ul className="space-y-1">
                    {selected.sub_points.map((sp, i) => (
                      <li key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded px-2 py-1">
                        {sp}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{value ?? <span className="text-gray-400 italic">—</span>}</div>
    </div>
  );
}
