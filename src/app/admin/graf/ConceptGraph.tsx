"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
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
export interface GraphNodeLite {
  id: string;
  name: string;
  grade: number;
  kind: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  confidence?: string | null;
}

interface SubtopicGroup { key: string; title: string; concepts: GraphConcept[] }
interface ModuleGroup { key: string; title: string; count: number; subtopics: SubtopicGroup[] }

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

const EDGE_INCLASS = "#2563eb"; // albastru — prerechizit în-clasă
const EDGE_CROSS = "#ea580c";   // portocaliu — cross-clasă (spirala)

// ── Grupare module→subteme (carry-forward, ca în 3.3b) ───────────────────────
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
    if (!mod) { mod = { key, title, count: 0, subtopics: [] }; modules.set(key, mod); }
    const subKey = c.subtopic ?? "(fără subtemă)";
    let sub = mod.subtopics.find((s) => s.key === subKey);
    if (!sub) { sub = { key: subKey, title: subKey, concepts: [] }; mod.subtopics.push(sub); }
    sub.concepts.push(c);
    mod.count++;
  }
  return [...modules.values()].sort((a, b) => (moduleNum(a.title) ?? 9999) - (moduleNum(b.title) ?? 9999));
}

// ── Layout dagre (doar muchiile de structură + cioturi) ──────────────────────
function layout(nodes: Node[], layoutEdges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 110, marginx: 20, marginy: 20 });
  for (const n of nodes) g.setNode(n.id, { width: (n.width as number) ?? 240, height: (n.height as number) ?? 56 });
  for (const e of layoutEdges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    const w = (n.width as number) ?? 240, h = (n.height as number) ?? 56;
    return { ...n, position: { x: p.x - w / 2, y: p.y - h / 2 } };
  });
}

// ── Noduri custom ────────────────────────────────────────────────────────────
const hiddenHandle = { opacity: 0, width: 1, height: 1 } as const;

function ModuleNode({ data }: NodeProps) {
  const d = data as { label: string; count: number; expanded: boolean };
  return (
    <div style={{ width: 248 }} className="rounded-lg border-2 border-slate-700 bg-slate-800 text-white px-3 py-2 shadow cursor-pointer">
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
  const d = data as { label: string; count: number; expanded: boolean };
  return (
    <div style={{ width: 248 }} className="rounded-md border border-slate-400 bg-slate-100 px-3 py-2 shadow-sm cursor-pointer">
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
  const d = data as { concept: GraphConcept; selected: boolean; dim: boolean; inChain: boolean; prereqCount: number };
  const c = d.concept;
  const ks = kindStyle(c.kind);
  return (
    <div
      style={{ width: 230, opacity: d.dim ? 0.3 : 1 }}
      className={`rounded-md border bg-white px-2.5 py-2 shadow-sm cursor-pointer transition ${
        d.selected ? "border-blue-600 ring-2 ring-blue-400" : d.inChain ? "border-amber-500 ring-1 ring-amber-300" : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} />
      <div className="text-xs font-medium text-gray-900 leading-snug mb-1">{c.name}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium rounded px-1.5 py-0.5" style={{ backgroundColor: ks.bg, color: ks.text }}>{ks.label}</span>
        {c.sub_points.length > 0 && <span className="text-[10px] text-gray-500" title={`${c.sub_points.length} sub-puncte`}>📎 {c.sub_points.length}</span>}
        {d.prereqCount > 0 && <span className="text-[10px] text-blue-600" title={`${d.prereqCount} prerechizite directe`}>⇠ {d.prereqCount}</span>}
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} />
    </div>
  );
}
function StubNode({ data }: NodeProps) {
  const d = data as { name: string; grade: number; dim: boolean };
  return (
    <div
      style={{ width: 190, opacity: d.dim ? 0.3 : 1 }}
      className="rounded-md border border-dashed border-orange-400 bg-orange-50 px-2 py-1.5 shadow-sm cursor-pointer"
      title="Prerechizit din altă clasă — click pentru a deschide clasa lui"
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} />
      <div className="text-[11px] font-medium text-orange-900 leading-snug">{d.name}</div>
      <div className="text-[10px] text-orange-600">cl. {d.grade} ↗</div>
    </div>
  );
}
const nodeTypes: NodeTypes = { moduleNode: ModuleNode, subtopicNode: SubtopicNode, conceptNode: ConceptNode, stubNode: StubNode };

// ── Componenta principală ────────────────────────────────────────────────────
export default function ConceptGraph({
  concepts, grade, allNodes, edges,
}: { concepts: GraphConcept[]; grade: number; allNodes: GraphNodeLite[]; edges: GraphEdge[] }) {
  const router = useRouter();
  const tree = useMemo(() => buildTree(concepts), [concepts]);
  const selectedIds = useMemo(() => new Set(concepts.map((c) => c.id)), [concepts]);
  const nodeById = useMemo(() => new Map(allNodes.map((n) => [n.id, n])), [allNodes]);
  const prereqAdj = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of edges) { if (!m.has(e.from)) m.set(e.from, []); m.get(e.from)!.push(e.to); }
    return m;
  }, [edges]);

  // Lanțul complet de prerechizite (toți strămoșii, peste clase). Tolerant la cicluri.
  const ancestorsOf = useCallback((startId: string): string[] => {
    const visited = new Set<string>();
    const stack = [...(prereqAdj.get(startId) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const p of prereqAdj.get(id) ?? []) if (!visited.has(p)) stack.push(p);
    }
    return [...visited];
  }, [prereqAdj]);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [showEdges, setShowEdges] = useState(true);
  const [selected, setSelected] = useState<GraphConcept | null>(null);

  const visibleTree = useMemo(
    () => (moduleFilter ? tree.filter((m) => m.key === moduleFilter) : tree),
    [tree, moduleFilter],
  );

  // Setul de evidențiere (lanț) când un nod e selectat.
  const chainSet = useMemo(() => {
    if (!selected) return null;
    const s = new Set<string>(ancestorsOf(selected.id));
    s.add(selected.id);
    return s;
  }, [selected, ancestorsOf]);

  const { nodes, edges: rfEdges } = useMemo(() => {
    const ns: Node[] = [];
    const layoutEdges: Edge[] = []; // doar pentru dagre (structură + cioturi)
    const overlayEdges: Edge[] = []; // prerechizite în-clasă (peste layout)
    const renderedConcepts = new Set<string>();
    const dimOf = (id: string) => (chainSet ? !chainSet.has(id) : false);

    for (const mod of visibleTree) {
      const modId = `m:${mod.key}`;
      const modExp = expandedModules.has(mod.key);
      ns.push({ id: modId, type: "moduleNode", position: { x: 0, y: 0 }, width: 248, height: 56, data: { label: mod.title, count: mod.count, expanded: modExp } });
      if (!modExp) continue;
      for (const sub of mod.subtopics) {
        const subId = `s:${mod.key}::${sub.key}`;
        const subExp = expandedSubtopics.has(subId);
        ns.push({ id: subId, type: "subtopicNode", position: { x: 0, y: 0 }, width: 248, height: 50, data: { label: sub.title, count: sub.concepts.length, expanded: subExp } });
        layoutEdges.push({ id: `e:${modId}>${subId}`, source: modId, target: subId, type: "smoothstep", style: { stroke: "#cbd5e1" } });
        if (!subExp) continue;
        for (const c of sub.concepts) {
          const cId = `c:${c.id}`;
          renderedConcepts.add(c.id);
          const direct = prereqAdj.get(c.id) ?? [];
          ns.push({
            id: cId, type: "conceptNode", position: { x: 0, y: 0 }, width: 230, height: 64,
            data: { concept: c, selected: selected?.id === c.id, dim: dimOf(c.id), inChain: chainSet ? chainSet.has(c.id) && selected?.id !== c.id : false, prereqCount: direct.length },
          });
          layoutEdges.push({ id: `t:${subId}>${cId}`, source: subId, target: cId, type: "smoothstep", style: { stroke: "#e2e8f0" } });
        }
      }
    }

    if (showEdges) {
      const stubSeen = new Set<string>();
      for (const cid of renderedConcepts) {
        for (const pid of prereqAdj.get(cid) ?? []) {
          const inClass = selectedIds.has(pid);
          if (inClass) {
            if (renderedConcepts.has(pid)) {
              const active = chainSet ? chainSet.has(cid) && chainSet.has(pid) : true;
              overlayEdges.push({
                id: `p:${cid}>${pid}`, source: `c:${cid}`, target: `c:${pid}`, type: "smoothstep",
                animated: !!chainSet && active,
                style: { stroke: EDGE_INCLASS, strokeWidth: chainSet ? (active ? 2.5 : 1) : 1.5, opacity: chainSet && !active ? 0.15 : 0.9 },
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_INCLASS },
              });
            }
          } else {
            // cross-clasă → ciot
            const p = nodeById.get(pid);
            if (!p) continue;
            const stubId = `stub:${cid}:${pid}`;
            if (!stubSeen.has(stubId)) {
              stubSeen.add(stubId);
              ns.push({ id: stubId, type: "stubNode", position: { x: 0, y: 0 }, width: 190, height: 44, data: { name: p.name, grade: p.grade, prereqId: pid, dim: chainSet ? !chainSet.has(pid) : false } });
              layoutEdges.push({
                id: `x:${cid}>${stubId}`, source: `c:${cid}`, target: stubId, type: "smoothstep",
                style: { stroke: EDGE_CROSS, strokeWidth: 1.5, strokeDasharray: "5 4", opacity: chainSet && !chainSet.has(pid) ? 0.2 : 0.9 },
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_CROSS },
              });
            }
          }
        }
      }
    }

    return { nodes: layout(ns, layoutEdges), edges: [...layoutEdges, ...overlayEdges] };
  }, [visibleTree, expandedModules, expandedSubtopics, showEdges, selected, chainSet, prereqAdj, selectedIds, nodeById]);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "moduleNode") toggle(setExpandedModules, node.id.slice(2));
    else if (node.type === "subtopicNode") toggle(setExpandedSubtopics, node.id);
    else if (node.type === "conceptNode") setSelected((node.data as { concept: GraphConcept }).concept);
    else if (node.type === "stubNode") {
      const g = (node.data as { grade: number }).grade;
      router.push(`/admin/graf?grade=${g}`);
    }
  }, [router]);

  const expandAll = () => {
    setExpandedModules(new Set(visibleTree.map((m) => m.key)));
    const subs = new Set<string>();
    for (const m of visibleTree) for (const s of m.subtopics) subs.add(`s:${m.key}::${s.key}`);
    setExpandedSubtopics(subs);
  };
  const collapseAll = () => { setExpandedModules(new Set()); setExpandedSubtopics(new Set()); };

  // Date pentru panoul lateral.
  const directPrereqs = selected ? (prereqAdj.get(selected.id) ?? []).map((id) => nodeById.get(id)).filter((x): x is GraphNodeLite => !!x) : [];
  const chain = selected
    ? ancestorsOf(selected.id).map((id) => nodeById.get(id)).filter((x): x is GraphNodeLite => !!x).sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name, "ro"))
    : [];

  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Modul</label>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1.5 max-w-xs">
            <option value="">Toate ({tree.length})</option>
            {tree.map((m) => <option key={m.key} value={m.key}>{m.title} ({m.count})</option>)}
          </select>
        </div>
        <button onClick={expandAll} className="text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50">Deschide tot</button>
        <button onClick={collapseAll} className="text-xs px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50">Închide tot</button>
        <label className="text-xs flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} /> Muchii prerechizit
        </label>
        <div className="flex items-center gap-3 ml-auto text-[10px]">
          <span className="flex items-center gap-1"><span style={{ width: 16, height: 0, borderTop: `2px solid ${EDGE_INCLASS}`, display: "inline-block" }} /> în-clasă</span>
          <span className="flex items-center gap-1"><span style={{ width: 16, height: 0, borderTop: `2px dashed ${EDGE_CROSS}`, display: "inline-block" }} /> cross-clasă (spirala)</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 h-[74vh] border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
          <ReactFlow
            nodes={nodes} edges={rfEdges} nodeTypes={nodeTypes} onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)} nodesDraggable={false} nodesConnectable={false}
            fitView minZoom={0.15} proOptions={{ hideAttribution: false }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} />
          </ReactFlow>
        </div>

        {selected && (
          <aside className="w-80 shrink-0 h-[74vh] overflow-y-auto bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none" aria-label="Închide">×</button>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium rounded px-2 py-0.5" style={{ backgroundColor: kindStyle(selected.kind).bg, color: kindStyle(selected.kind).text }}>{kindStyle(selected.kind).label}</span>
                <span className="text-xs text-gray-400">clasa {grade} · {selected.status}</span>
              </div>
              <Detail label="Modul" value={selected.module} />
              <Detail label="Subtemă" value={selected.subtopic} />

              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Sub-puncte {selected.sub_points.length > 0 ? `(${selected.sub_points.length})` : ""}</div>
                {selected.sub_points.length === 0 ? <div className="text-xs text-gray-400 italic">—</div> : (
                  <ul className="space-y-1">{selected.sub_points.map((sp, i) => <li key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded px-2 py-1">{sp}</li>)}</ul>
                )}
              </div>

              <div className="pt-1 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-1">Prerechizite directe ({directPrereqs.length})</div>
                {directPrereqs.length === 0 ? <div className="text-xs text-gray-400 italic">rădăcină (niciun prerechizit)</div> : (
                  <ul className="space-y-1">
                    {directPrereqs.map((p) => <ChainItem key={p.id} p={p} curGrade={grade} onJump={(g) => router.push(`/admin/graf?grade=${g}`)} />)}
                  </ul>
                )}
              </div>

              <div className="pt-1 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-1">Lanț complet de prerechizite ({chain.length}) — peste clase</div>
                {chain.length === 0 ? <div className="text-xs text-gray-400 italic">niciun strămoș</div> : (
                  <ol className="space-y-1">
                    {chain.map((p) => <ChainItem key={p.id} p={p} curGrade={grade} onJump={(g) => router.push(`/admin/graf?grade=${g}`)} />)}
                  </ol>
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
function ChainItem({ p, curGrade, onJump }: { p: GraphNodeLite; curGrade: number; onJump: (g: number) => void }) {
  const cross = p.grade !== curGrade;
  return (
    <li className="text-xs flex items-center gap-1.5">
      <button
        onClick={() => cross && onJump(p.grade)}
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cross ? "bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer" : "bg-slate-100 text-slate-600"}`}
        title={cross ? `Deschide clasa ${p.grade}` : undefined}
      >
        cl.{p.grade}{cross ? " ↗" : ""}
      </button>
      <span className="text-gray-700">{p.name}</span>
    </li>
  );
}
