"use client";

// Pure SVG 2D cabinet projection renderer for geometric solids.
// Cabinet formula: x_2d = x + cos(30°)·z·0.5, y_2d = y + sin(30°)·z·0.5

import React, { useMemo } from "react";

const CA = Math.cos((30 * Math.PI) / 180); // ≈ 0.866
const SA = Math.sin((30 * Math.PI) / 180); // ≈ 0.500
const K = 0.5;
const CAM: V3 = [0.5774, 0.5774, 0.5774];
const INK = "#1e1b4b";
const GRAY = "#888";
const FONT = "Georgia, 'Times New Roman', serif";

type V3 = [number, number, number];
type V2 = [number, number];
interface Topology {
  vertices: V3[];
  edges: [number, number][];
  faces: { verts: number[]; normal: V3 }[];
}
interface Layout { sc: number; ox: number; oy: number; w: number; h: number }

// ── Math ─────────────────────────────────────────────────────────────────────

function proj(v: V3): V2 { return [v[0] + CA * v[2] * K, v[1] + SA * v[2] * K]; }
function dot3(a: V3, b: V3) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross3(a: V3, b: V3): V3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function sub3(a: V3, b: V3): V3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function ekey(a: number, b: number) { return `${Math.min(a,b)}-${Math.max(a,b)}`; }

// ── Layout ────────────────────────────────────────────────────────────────────

function layout(pts: V2[], pad = 52): Layout {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const dw = x1-x0||1, dh = y1-y0||1;
  const W = 400;
  const H = Math.max(260, Math.round(W*(dh/dw)*0.85) + 2*pad);
  const sc = Math.min((W-2*pad)/dw, (H-2*pad)/dh);
  const ox = pad + ((W-2*pad)-dw*sc)/2 - x0*sc;
  const oy = H - pad - ((H-2*pad)-dh*sc)/2 + y0*sc;
  return { sc, ox, oy, w: W, h: H };
}

function toS(p: V2, l: Layout): V2 { return [l.ox+p[0]*l.sc, l.oy-p[1]*l.sc]; }

// ── Topology builders ─────────────────────────────────────────────────────────

function cubeTopo(L: number): Topology {
  const h = L/2;
  return {
    vertices: [[-h,0,-h],[h,0,-h],[h,0,h],[-h,0,h],[-h,L,-h],[h,L,-h],[h,L,h],[-h,L,h]],
    edges: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],
    faces: [
      {verts:[0,1,2,3],normal:[0,-1,0]},{verts:[4,5,6,7],normal:[0,1,0]},
      {verts:[2,3,7,6],normal:[0,0,1]},{verts:[0,1,5,4],normal:[0,0,-1]},
      {verts:[1,2,6,5],normal:[1,0,0]},{verts:[0,3,7,4],normal:[-1,0,0]},
    ],
  };
}

function prismTopo(base: number, height: number, depth: number): Topology {
  const hx=base/2, hz=depth/2;
  return {
    vertices: [[-hx,0,-hz],[hx,0,-hz],[hx,0,hz],[-hx,0,hz],[-hx,height,-hz],[hx,height,-hz],[hx,height,hz],[-hx,height,hz]],
    edges: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],
    faces: [
      {verts:[0,1,2,3],normal:[0,-1,0]},{verts:[4,5,6,7],normal:[0,1,0]},
      {verts:[2,3,7,6],normal:[0,0,1]},{verts:[0,1,5,4],normal:[0,0,-1]},
      {verts:[1,2,6,5],normal:[1,0,0]},{verts:[0,3,7,4],normal:[-1,0,0]},
    ],
  };
}

function pyramidTopo(base: number, height: number): Topology {
  const b=base/2;
  const v: V3[] = [[-b,0,-b],[b,0,-b],[b,0,b],[-b,0,b],[0,height,0]];
  const n = (i:number,j:number,k:number):V3 => cross3(sub3(v[j],v[i]),sub3(v[k],v[i]));
  return {
    vertices: v,
    edges: [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]],
    faces: [
      {verts:[0,1,2,3],normal:[0,-1,0]},
      {verts:[3,2,4],normal:n(3,2,4)},{verts:[2,1,4],normal:n(2,1,4)},
      {verts:[1,0,4],normal:n(1,0,4)},{verts:[0,3,4],normal:n(0,3,4)},
    ],
  };
}

// ── Topology renderer ─────────────────────────────────────────────────────────

function renderTopo(topo: Topology, names: string[], id: string) {
  const projs = topo.vertices.map(proj);
  const L = layout(projs);
  const spts = projs.map(p => toS(p, L));

  // Which edges are visible (adjacent to at least one forward-facing face)
  const vis = new Set<string>();
  for (const f of topo.faces) {
    if (dot3(f.normal, CAM) > 1e-6) {
      for (let i=0; i<f.verts.length; i++)
        vis.add(ekey(f.verts[i], f.verts[(i+1)%f.verts.length]));
    }
  }

  const cx = spts.reduce((s,p)=>s+p[0],0)/spts.length;
  const cy = spts.reduce((s,p)=>s+p[1],0)/spts.length;

  return (
    <svg width={L.w} height={L.h} style={{display:"block",maxWidth:"100%"}}>
      {topo.edges.map(([a,b]) => {
        const [x1,y1]=spts[a],[x2,y2]=spts[b];
        const k=ekey(a,b), visible=vis.has(k);
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={visible?INK:GRAY} strokeWidth={visible?2.2:1.4}
          strokeDasharray={visible?undefined:"5,4"} strokeLinecap="round" />;
      })}
      {names.map((name,i) => {
        if (i>=spts.length) return null;
        const [vx,vy]=spts[i];
        const dx=vx-cx, dy=vy-cy, mag=Math.sqrt(dx*dx+dy*dy)||1;
        const lx=vx+(dx/mag)*20, ly=vy+(dy/mag)*20;
        return <text key={`${id}-l${i}`} x={lx} y={ly}
          fontFamily={FONT} fontStyle="italic" fontSize={14} fill={INK}
          textAnchor={lx>vx+2?"start":lx<vx-2?"end":"middle"}
          dominantBaseline={ly>vy+2?"hanging":"auto"}>{name}</text>;
      })}
    </svg>
  );
}

// ── Arc helpers for cylinder / cone ──────────────────────────────────────────

// Silhouette angles for camera (0.577,0.577,0.577): cos(θ)+sin(θ)=0 → θ=-45° and 135°
const TH1 = -Math.PI/4;  // -45° = start of visible arc from this side
const TH2 =  3*Math.PI/4; // 135° = end of visible arc

function arcPts(r: number, y: number, fromRad: number, toRad: number, n=60): V2[] {
  // Sample arc from fromRad to toRad (going forward/counterclockwise)
  return Array.from({length:n+1}, (_,i) => {
    const θ = fromRad + (i/n)*(toRad-fromRad);
    return proj([r*Math.cos(θ), y, r*Math.sin(θ)]);
  });
}

function ptsToPath(pts: V2[], L: Layout): string {
  return pts.map((p,i) => {
    const [x,y]=toS(p,L);
    return `${i===0?"M":"L"} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

// ── Cylinder ─────────────────────────────────────────────────────────────────

function renderCylinder(r: number, h: number, names: string[], id: string) {
  // Sample points for layout bounds: top + bottom full circles
  const boundPts: V2[] = [];
  for (let i=0; i<=72; i++) {
    const θ=(2*Math.PI*i)/72;
    boundPts.push(proj([r*Math.cos(θ),0,r*Math.sin(θ)]));
    boundPts.push(proj([r*Math.cos(θ),h,r*Math.sin(θ)]));
  }
  const L = layout(boundPts);

  // Bottom circle: solid arc TH1→TH2 (going through θ=0), dashed arc TH2→TH1+2π
  const solidBot = arcPts(r, 0, TH1, TH2, 60);
  const dashBot  = arcPts(r, 0, TH2, TH1+2*Math.PI, 40);
  // Top circle: fully solid
  const topCircle = arcPts(r, h, 0, 2*Math.PI, 72);
  // Silhouette lines
  const sb1=toS(proj([r*Math.cos(TH1),0,r*Math.sin(TH1)]),L);
  const st1=toS(proj([r*Math.cos(TH1),h,r*Math.sin(TH1)]),L);
  const sb2=toS(proj([r*Math.cos(TH2),0,r*Math.sin(TH2)]),L);
  const st2=toS(proj([r*Math.cos(TH2),h,r*Math.sin(TH2)]),L);

  // Label positions: canonical [top-center, bot-center, top-rim-front, bot-rim-front, ...]
  const lblPos: V2[] = [
    toS(proj([0,h,0]),L), toS(proj([0,0,0]),L),
    toS(proj([r,h,0]),L), toS(proj([r,0,0]),L),
    toS(proj([-r,h,0]),L), toS(proj([-r,0,0]),L),
  ];
  const [scx] = toS(proj([0,h/2,0]),L);

  return (
    <svg width={L.w} height={L.h} style={{display:"block",maxWidth:"100%"}}>
      <path d={ptsToPath(dashBot,L)} fill="none" stroke={GRAY} strokeWidth={1.4} strokeDasharray="5,4" strokeLinecap="round"/>
      <path d={ptsToPath(solidBot,L)} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      <path d={ptsToPath(topCircle,L)} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      <line x1={sb1[0]} y1={sb1[1]} x2={st1[0]} y2={st1[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      <line x1={sb2[0]} y1={sb2[1]} x2={st2[0]} y2={st2[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      {names.map((nm,i) => {
        if (i>=lblPos.length) return null;
        const [lx,ly]=lblPos[i];
        return <text key={`${id}-l${i}`} x={lx+(lx>scx?7:-7)} y={ly}
          fontFamily={FONT} fontStyle="italic" fontSize={14} fill={INK}
          textAnchor={lx>scx?"start":"end"} dominantBaseline="middle">{nm}</text>;
      })}
    </svg>
  );
}

// ── Cone ──────────────────────────────────────────────────────────────────────

function renderCone(r: number, h: number, names: string[], id: string) {
  const apex = proj([0,h,0]);
  const boundPts: V2[] = [apex];
  for (let i=0; i<=72; i++) {
    const θ=(2*Math.PI*i)/72;
    boundPts.push(proj([r*Math.cos(θ),0,r*Math.sin(θ)]));
  }
  const L = layout(boundPts);

  const solidBase = arcPts(r, 0, TH1, TH2, 60);
  const dashBase  = arcPts(r, 0, TH2, TH1+2*Math.PI, 40);
  const apexS = toS(apex, L);
  const sil1 = toS(proj([r*Math.cos(TH1),0,r*Math.sin(TH1)]),L);
  const sil2 = toS(proj([r*Math.cos(TH2),0,r*Math.sin(TH2)]),L);

  const lblPos: V2[] = [
    toS(apex,L), toS(proj([0,0,0]),L),
    toS(proj([r,0,0]),L), toS(proj([-r,0,0]),L),
  ];
  const [scx] = toS(proj([0,h/2,0]),L);

  return (
    <svg width={L.w} height={L.h} style={{display:"block",maxWidth:"100%"}}>
      <path d={ptsToPath(dashBase,L)} fill="none" stroke={GRAY} strokeWidth={1.4} strokeDasharray="5,4" strokeLinecap="round"/>
      <path d={ptsToPath(solidBase,L)} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      <line x1={apexS[0]} y1={apexS[1]} x2={sil1[0]} y2={sil1[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      <line x1={apexS[0]} y1={apexS[1]} x2={sil2[0]} y2={sil2[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round"/>
      {names.map((nm,i) => {
        if (i>=lblPos.length) return null;
        const [lx,ly]=lblPos[i];
        return <text key={`${id}-l${i}`} x={lx+(lx>scx?7:-7)} y={ly}
          fontFamily={FONT} fontStyle="italic" fontSize={14} fill={INK}
          textAnchor={lx>scx?"start":"end"} dominantBaseline="middle">{nm}</text>;
      })}
    </svg>
  );
}

// ── Sphere ────────────────────────────────────────────────────────────────────

function renderSphere(r: number, names: string[], id: string) {
  // Sphere → circle in frontal projection
  const pad = 60;
  const W = 300, H = 300;
  const cx = W/2, cy = H/2, rs = (W/2)-pad;
  return (
    <svg width={W} height={H} style={{display:"block",maxWidth:"100%"}}>
      <circle cx={cx} cy={cy} r={rs} fill="none" stroke={INK} strokeWidth={2.2}/>
      {names[0] && <text x={cx+rs+8} y={cy} fontFamily={FONT} fontStyle="italic" fontSize={14} fill={INK} dominantBaseline="middle">{names[0]}</text>}
      {id && null}
    </svg>
  );
}

// ── ShapeSpec (self-contained, no ThreeScene import) ─────────────────────────

type ShapeSpec =
  | { type:"cube";     params:{side:number};                              vertexNames?:string[]; labels?:{vertex:string}[] }
  | { type:"sphere";   params:{radius:number};                            vertexNames?:string[]; labels?:{vertex:string}[] }
  | { type:"cylinder"; params:{radius:number;height:number};              vertexNames?:string[]; labels?:{vertex:string}[] }
  | { type:"cone";     params:{radius:number;height:number};              vertexNames?:string[]; labels?:{vertex:string}[] }
  | { type:"prism";    params:{base:number;height:number;depth:number};   vertexNames?:string[]; labels?:{vertex:string}[] }
  | { type:"pyramid";  params:{base:number;height:number};                vertexNames?:string[]; labels?:{vertex:string}[] };

interface Props { spec: ShapeSpec; id?: string }

export function CabinetSVG({ spec, id="cab" }: Props) {
  const names = useMemo((): string[] => {
    if (spec.vertexNames?.length) return spec.vertexNames;
    if (spec.labels?.length) return spec.labels.map(l => l.vertex);
    return [];
  }, [spec]);

  return useMemo(() => {
    switch (spec.type) {
      case "cube":     return renderTopo(cubeTopo(spec.params.side), names, id);
      case "prism":    return renderTopo(prismTopo(spec.params.base, spec.params.height, spec.params.depth), names, id);
      case "pyramid":  return renderTopo(pyramidTopo(spec.params.base, spec.params.height), names, id);
      case "cylinder": return renderCylinder(spec.params.radius, spec.params.height, names, id);
      case "cone":     return renderCone(spec.params.radius, spec.params.height, names, id);
      case "sphere":   return renderSphere(spec.params.radius, names, id);
    }
  }, [spec, names, id]);
}
