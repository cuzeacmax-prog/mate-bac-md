/**
 * ETAPA 13 + 20 + 21 — Specificația de figură 2D (compozabilă, prin CONSTRÂNGERI).
 *
 * Principiu: figura NU se desenează liber. Se DESCRIE prin primitive + RELAȚII + CONSTRÂNGERI, iar
 * motorul rezolvă coordonatele (SSS, paralelogram) și relațiile (intersecții, tangente, paralele la
 * distanță) — corect prin construcție, nu plasat de mână. Acest fișier e contractul de date + solverul pur.
 */

/** Un punct de bază (vârf) cu coordonate EXPLICITE. */
export interface FigurePoint {
  id: string;
  x: number;
  y: number;
  label?: string;
}

/** Triunghiul (3 id-uri de vârf) pe care se sprijină o relație. */
type Tri = [string, string, string];
/** Referință la o dreaptă: id de element SAU pereche de puncte. */
export type LineRef = string | [string, string];

export type FigureElement =
  // ── GENERATORI de coordonate (rezolvați de solver, nu desenați direct) ──
  /** Triunghi din cele 3 LATURI (SSS, legea cosinusului). Eroare dacă inegalitatea triunghiului cade. */
  | { kind: "triangleFromSides"; ids: Tri; sides: { AB: number; BC: number; CA: number }; labels?: Tri }
  /** Paralelogram din unghi + raport laturi, scalat printr-o diagonală/lungime. */
  | {
      kind: "quadFromConstraints";
      ids: [string, string, string, string];
      angleAt: string; angle: number; sideRatio: [number, number];
      scaleBy: { diagonal: "AC" | "BD" | "AB" | "AD"; length: number };
    }
  // ── DESENE ──
  | { kind: "polygon"; points: string[]; label?: string; shade?: boolean; hatch?: boolean; color?: string; fillOpacity?: number }
  | { kind: "circumcircle"; of: Tri; centerLabel?: string; color?: string }
  | { kind: "incircle"; of: Tri; centerLabel?: string; color?: string }
  | { kind: "point"; from: "incenter" | "circumcenter" | "centroid" | "orthocenter"; of?: Tri; label?: string; color?: string; id?: string }
  /** Punct = INTERSECȚIA a două drepte/cercuri (nativ). Expus ca punct referabil prin `id`. */
  | { kind: "point"; from: "intersection"; of: [LineRef, LineRef]; index?: number; label?: string; color?: string; id?: string }
  | { kind: "median"; of: Tri; from: string; label?: string; color?: string; id?: string }
  | { kind: "bisector"; of: Tri; from: string; label?: string; color?: string; id?: string }
  | { kind: "altitude"; of: Tri; from: string; label?: string; color?: string; markRightAngle?: boolean; id?: string }
  | { kind: "perpBisector"; of: Tri; from: string; label?: string; color?: string; id?: string }
  /** Unghi: vârf `at` + 2 raze `from` (puncte), SAU `between` = 2 segmente (vârf = intersecția lor).
   *  `value:true` → eticheta e unghiul MĂSURAT (grade) de motor. `reflex:true` alege unghiul reflex. */
  | { kind: "angle"; at?: string; from?: [string, string]; between?: [[string, string], [string, string]]; label?: string; value?: boolean; reflex?: boolean; color?: string }
  /** Punct PE segment, la `ratio` (∈[0,1]) sau `distanceFromA`. Poziția o calculează motorul. */
  | { kind: "pointOnSegment"; on: [string, string]; ratio?: number; distanceFromA?: number; label?: string; color?: string; id?: string }
  /** Unghi DREPT marcat (pătrățel) la `at`, între razele către from[0], from[1]. Reutilizabil. */
  | { kind: "rightAngle"; at: string; from: [string, string]; color?: string }
  /** Unghiuri EGALE: `count` arce concentrice la `at`. `radius` = scală relativă (ca să nu se contopească arcele adiacente). */
  | { kind: "equalAngle"; at: string; from: [string, string]; count?: number; radius?: number; color?: string }
  | { kind: "circle"; id?: string; center: string; through?: string; radius?: number; centerLabel?: string; color?: string }
  | { kind: "tangentLines"; from: string; to: string; markPoints?: boolean; pointLabels?: [string, string]; color?: string }
  | { kind: "midpoint"; of: [string, string]; label?: string; color?: string; id?: string }
  | { kind: "perpendicular"; through: string; toSegment: [string, string]; label?: string; color?: string; id?: string }
  | { kind: "parallel"; through: string; toSegment: [string, string]; label?: string; color?: string; id?: string }
  /** Dreaptă PARALELĂ la un segment, la `distance` perpendiculară, pe partea lui `offsetFrom`. */
  | { kind: "parallelAtDistance"; id?: string; parallelTo: [string, string]; offsetFrom: string; distance: number; color?: string; visible?: boolean }
  | { kind: "segment"; between: [string, string]; label?: string; color?: string; id?: string; showLength?: boolean }
  /** Semn de EGALITATE (liniuțe perpendiculare) la mijlocul segmentului. */
  | { kind: "equalMark"; on: [string, string]; count?: number; color?: string }
  /** Semn de PARALELISM (chevron) la mijlocul segmentului. */
  | { kind: "parallelMark"; on: [string, string]; count?: number; color?: string };

export interface FigureSpec2D {
  points: FigurePoint[];
  elements: FigureElement[];
  boundingBox?: [number, number, number, number];
  /** Încadrare canonică (override). baseEdge = latura așezată orizontal ca bază. */
  framing?: { baseEdge?: [string, string]; anchor?: "bottom-left" };
  /**
   * Auto-intersecții (după construcție): "detect" = marchează toate intersecțiile interne;
   * "label-all" = marchează + etichetează (X₁, X₂…); array = doar perechile cerute, etichetabile.
   */
  intersections?: "detect" | "label-all" | Array<{ of: [LineRef, LineRef]; label?: string; index?: number }>;
}

/**
 * Încadrare canonică: similaritate (rotație + reflexie) aplicată DUPĂ rezolvare. Geometria
 * (unghiuri, rapoarte, lungimi) rămâne EXACTĂ. Așază baza orizontal, A în stânga-jos, figura deasupra.
 */
export function frameSolved(
  solved: Record<string, SolvedPoint>,
  framing?: FigureSpec2D["framing"],
): Record<string, SolvedPoint> {
  const ids = Object.keys(solved);
  if (ids.length < 2) return solved;
  const aId = framing?.baseEdge?.[0] ?? (solved["A"] ? "A" : ids[0]);
  const A = solved[aId];
  let bId = framing?.baseEdge?.[1];
  if (!bId) { // latura cea mai lungă pornind din A
    let best = -1; bId = ids.find((i) => i !== aId) ?? aId;
    for (const i of ids) {
      if (i === aId) continue;
      const d = Math.hypot(solved[i].x - A.x, solved[i].y - A.y);
      if (d > best) { best = d; bId = i; }
    }
  }
  const B = solved[bId];
  const theta = Math.atan2(B.y - A.y, B.x - A.x);
  const c = Math.cos(-theta), s = Math.sin(-theta);
  const out: Record<string, SolvedPoint> = {};
  for (const i of ids) {
    const dx = solved[i].x - A.x, dy = solved[i].y - A.y;
    out[i] = { x: dx * c - dy * s, y: dx * s + dy * c, label: solved[i].label };
  }
  // figura deasupra bazei: dacă media e sub axă, reflectă pe verticală (reflexie = similaritate)
  const ys = Object.values(out).map((p) => p.y);
  if (ys.reduce((a, b) => a + b, 0) / ys.length < 0) for (const i of ids) out[i].y = -out[i].y;
  return out;
}

export interface SolvedPoint { x: number; y: number; label?: string }

/** Rezolvă coordonatele punctelor de BAZĂ (explicite + generate prin constrângeri). PUR. */
export function solveBasePoints(spec: FigureSpec2D): Record<string, SolvedPoint> {
  const out: Record<string, SolvedPoint> = {};
  // Tolerează puncte ca string-uri (doar nume) sau obiecte fără coordonate — le ignorăm aici.
  for (const p of Array.isArray(spec.points) ? spec.points : []) {
    if (p && typeof p === "object" && typeof (p as FigurePoint).id === "string" && typeof (p as FigurePoint).x === "number") {
      out[(p as FigurePoint).id] = { x: (p as FigurePoint).x, y: (p as FigurePoint).y, label: (p as FigurePoint).label };
    }
  }

  for (const e of spec.elements) {
    if (e.kind === "triangleFromSides") {
      const AB = e.sides.AB, BC = e.sides.BC;
      const CA = e.sides.CA ?? (e.sides as { CA?: number; AC?: number }).AC; // acceptă CA sau AC
      if (!(AB > 0) || !(BC > 0) || !(CA! > 0)) {
        throw new Error(`triangleFromSides: laturile trebuie numere pozitive (AB=${AB}, BC=${BC}, CA=${CA}).`);
      }
      if (AB + BC <= CA! || AB + CA! <= BC || BC + CA! <= AB) {
        throw new Error(`Inegalitatea triunghiului cade pentru laturile (${AB}, ${BC}, ${CA}).`);
      }
      // A=(0,0), B=(AB,0); C din legea cosinusului.
      const ca = CA as number;
      const x = (AB * AB + ca * ca - BC * BC) / (2 * AB);
      const y2 = ca * ca - x * x;
      if (y2 <= 0) throw new Error(`Triunghi degenerat pentru (${AB}, ${BC}, ${ca}).`);
      const y = Math.sqrt(y2);
      const [a, b, c] = e.ids;
      out[a] = { x: 0, y: 0, label: e.labels?.[0] ?? a };
      out[b] = { x: AB, y: 0, label: e.labels?.[1] ?? b };
      out[c] = { x, y, label: e.labels?.[2] ?? c };
    } else if (e.kind === "quadFromConstraints") {
      // Paralelogram ciclic [v0,v1,v2,v3]. Unghiul `angle` la vârful `angleAt` (FIX: nu mai e mereu ids[0]).
      const ids4 = e.ids;
      const k = Math.max(0, ids4.indexOf(e.angleAt)); // dacă angleAt lipsește → 0
      const vk = ids4[k], vNext = ids4[(k + 1) % 4], vPrev = ids4[(k + 3) % 4], vOpp = ids4[(k + 2) % 4];
      const th = (e.angle * Math.PI) / 180;
      const r0 = e.sideRatio[0], r1 = e.sideRatio[1]; // laturile la `angleAt`: vk→vNext, vk→vPrev
      const co: Record<string, { x: number; y: number }> = {};
      co[vk] = { x: 0, y: 0 };
      co[vNext] = { x: r0, y: 0 };
      co[vPrev] = { x: r1 * Math.cos(th), y: r1 * Math.sin(th) };
      co[vOpp] = { x: co[vNext].x + co[vPrev].x, y: co[vNext].y + co[vPrev].y };
      const idx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      const byPos = (letter: string) => co[ids4[idx[letter] ?? 0]];
      const L0 = Math.hypot(byPos(e.scaleBy.diagonal[1]).x - byPos(e.scaleBy.diagonal[0]).x, byPos(e.scaleBy.diagonal[1]).y - byPos(e.scaleBy.diagonal[0]).y);
      if (L0 === 0) throw new Error(`Diagonala ${e.scaleBy.diagonal} e nulă în constrângeri.`);
      const f = e.scaleBy.length / L0;
      for (const id of ids4) out[id] = { x: co[id].x * f, y: co[id].y * f, label: id };
    }
  }
  return out;
}

/**
 * Validează specul ÎNAINTE de randare: id-uri referite existente, poligoane valide, constrângeri
 * rezolvabile, etichete duplicate. Întoarce erori (blochează randarea) + avertismente (informativ).
 */
export function validateSpec(spec: FigureSpec2D): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const points = new Set<string>();
  const elementIds = new Set<string>();

  // 0. Structură de bază.
  if (!spec || typeof spec !== "object") return { errors: ["spec lipsește sau nu e obiect."], warnings };
  if (!Array.isArray(spec.points)) return { errors: ["spec.points trebuie să fie un array."], warnings };
  if (!Array.isArray(spec.elements)) return { errors: ["spec.elements trebuie să fie un array."], warnings };

  // 1. Colectează id-urile PRODUSE (puncte + elemente referabile).
  for (const p of spec.points) if (p && p.id) points.add(p.id);
  for (const e of spec.elements) {
    if (!e || typeof e !== "object" || !("kind" in e)) { errors.push("element fără `kind`."); continue; }
    switch (e.kind) {
      case "triangleFromSides": if (Array.isArray(e.ids)) e.ids.forEach((i) => points.add(i)); break;
      case "quadFromConstraints": if (Array.isArray(e.ids)) e.ids.forEach((i) => points.add(i)); break;
      case "point": if (e.id) points.add(e.id); else if (e.from === "intersection" && e.label) points.add(e.label); break;
      case "midpoint": if (e.id) points.add(e.id); break;
      case "pointOnSegment": if (e.id) points.add(e.id); break;
    }
    const anyEl = e as { id?: string };
    if ("id" in e && anyEl.id && ["segment", "circle", "median", "bisector", "altitude", "perpBisector", "perpendicular", "parallel", "parallelAtDistance"].includes(e.kind)) {
      elementIds.add(anyEl.id);
    }
  }

  const needPoint = (id: string, where: string) => { if (!points.has(id)) errors.push(`${where}: punctul „${id}” nu există.`); };
  const needRef = (ref: LineRef, where: string) => {
    if (typeof ref === "string") { if (!elementIds.has(ref)) errors.push(`${where}: elementul „${ref}” nu există (sau n-are id).`); }
    else { needPoint(ref[0], where); needPoint(ref[1], where); }
  };

  // 2. Verifică referințele fiecărui element. Orice câmp lipsă → eroare clară, nu crash.
  for (const e of spec.elements) {
    if (!e || typeof e !== "object" || !("kind" in e)) continue;
    try {
    switch (e.kind) {
      case "polygon":
        if (!Array.isArray(e.points) || e.points.length < 3) errors.push(`polygon: are nevoie de ≥3 puncte.`);
        else e.points.forEach((id) => needPoint(id, "polygon"));
        break;
      case "circumcircle": case "incircle": e.of.forEach((id) => needPoint(id, e.kind)); break;
      case "point":
        if (e.from === "intersection") { needRef(e.of[0], "point:intersection"); needRef(e.of[1], "point:intersection"); }
        else if (e.of) { e.of.forEach((id) => needPoint(id, `point:${e.from}`)); }
        break;
      case "median": case "bisector": case "altitude": case "perpBisector":
        e.of.forEach((id) => needPoint(id, e.kind));
        if (!e.of.includes(e.from)) errors.push(`${e.kind}: vârful „${e.from}” nu e în triunghiul {${e.of.join(",")}}.`);
        break;
      case "angle":
        if (e.at) needPoint(e.at, "angle.at");
        if (e.from) e.from.forEach((id) => needPoint(id, "angle.from"));
        if (e.between) e.between.forEach((s) => s.forEach((id) => needPoint(id, "angle.between")));
        if (!e.at && !e.between) errors.push("angle: lipsește `at`+`from` sau `between`.");
        break;
      case "rightAngle": case "equalAngle": needPoint(e.at, e.kind); e.from.forEach((id) => needPoint(id, e.kind)); break;
      case "circle": needPoint(e.center, "circle"); if (e.through) needPoint(e.through, "circle.through"); break;
      case "tangentLines": needPoint(e.from, "tangentLines"); if (!elementIds.has(e.to)) errors.push(`tangentLines: cercul „${e.to}” nu există.`); break;
      case "midpoint": e.of.forEach((id) => needPoint(id, "midpoint")); break;
      case "perpendicular": case "parallel": needPoint(e.through, e.kind); e.toSegment.forEach((id) => needPoint(id, e.kind)); break;
      case "parallelAtDistance": e.parallelTo.forEach((id) => needPoint(id, "parallelAtDistance")); needPoint(e.offsetFrom, "parallelAtDistance.offsetFrom"); break;
      case "segment": e.between.forEach((id) => needPoint(id, "segment")); break;
      case "equalMark": case "parallelMark": e.on.forEach((id) => needPoint(id, e.kind)); break;
      case "pointOnSegment":
        e.on.forEach((id) => needPoint(id, "pointOnSegment"));
        if (e.ratio == null && e.distanceFromA == null) warnings.push("pointOnSegment: fără `ratio`/`distanceFromA` → se folosește mijlocul (0.5).");
        break;
      case "quadFromConstraints":
        if (!e.ids.includes(e.angleAt)) errors.push(`quadFromConstraints: angleAt „${e.angleAt}” nu e în ids {${e.ids.join(",")}}.`);
        if (e.sideRatio[0] <= 0 || e.sideRatio[1] <= 0) errors.push("quadFromConstraints: sideRatio trebuie pozitiv.");
        if (e.scaleBy.length <= 0) errors.push("quadFromConstraints: scaleBy.length trebuie pozitiv.");
        break;
      case "triangleFromSides": {
        const AB = e.sides?.AB, BC = e.sides?.BC, CA = e.sides?.CA ?? (e.sides as { CA?: number; AC?: number })?.AC;
        if (![AB, BC, CA].every((x) => typeof x === "number" && x > 0)) errors.push("triangleFromSides: lipsește o latură sau nu e număr pozitiv (cheile trebuie AB, BC, CA).");
        else if (AB! + BC! <= CA! || AB! + CA! <= BC! || BC! + CA! <= AB!) errors.push(`triangleFromSides: inegalitatea triunghiului cade (${AB}, ${BC}, ${CA}).`);
        break;
      }
    }
    } catch {
      errors.push(`${(e as { kind?: string }).kind ?? "element"}: structură invalidă (câmpuri obligatorii lipsă).`);
    }
  }
  if (Array.isArray(spec.intersections)) {
    for (const it of spec.intersections) { needRef(it.of[0], "intersections"); needRef(it.of[1], "intersections"); }
  }

  // 3. Avertismente: etichete duplicate.
  const labels = new Map<string, number>();
  for (const p of spec.points) if (p.label) labels.set(p.label, (labels.get(p.label) ?? 0) + 1);
  for (const e of spec.elements) {
    const lbl = (e as { label?: string }).label;
    if (lbl && (e.kind === "point" || e.kind === "midpoint" || e.kind === "pointOnSegment")) labels.set(lbl, (labels.get(lbl) ?? 0) + 1);
  }
  for (const [lbl, n] of labels) if (n > 1) warnings.push(`Etichetă duplicată „${lbl}” (×${n}).`);

  return { errors, warnings };
}

/** Cadru auto din punctele rezolvate, cu loc pentru cercuri + etichete. */
export function autoBoundingBox(spec: FigureSpec2D): [number, number, number, number] {
  if (spec.boundingBox) return spec.boundingBox;
  const pts = Object.values(solveBasePoints(spec));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY, 1) / 2;
  const pad = half * 0.9 + Math.max(2, half * 0.5);
  return [cx - pad, cy + pad, cx + pad, cy - pad];
}
