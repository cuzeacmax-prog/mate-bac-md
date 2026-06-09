'use client';

import { useState } from 'react';
import { ConstructionTriggerButton } from '@/components/construction/ConstructionTriggerButton';
import type { ConstructionStep } from '@/components/construction/ConstructionViewer';

type ShapeType =
  | 'triangle'
  | 'circle'
  | 'parallelogram'
  | 'trapezoid'
  | 'polygon'
  | 'cube'
  | 'prism'
  | 'pyramid'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  // Trunchiuri
  | 'frustum_pyramid'
  | 'frustum_cone'
  // Plane secante
  | 'section_cube'
  | 'section_pyramid'
  | 'section_cone'
  | 'section_sphere'
  | 'section_cylinder'
  // Speciale
  | 'tetrahedron'
  | 'oblique_prism'
  | 'cube_all_diagonals'
  | 'sphere_with_circles'
  // ── ETAPA 5 ──────────────────────────────────
  // Funcții elementare
  | 'fn_linear'
  | 'fn_quadratic'
  | 'fn_power'
  | 'fn_radical'
  | 'fn_exponential'
  | 'fn_logarithmic'
  | 'fn_modulus'
  | 'fn_generic'
  // Funcții trigonometrice
  | 'trig_sin'
  | 'trig_cos'
  | 'trig_tan'
  | 'trig_cot'
  // Analiză matematică
  | 'analysis_asymptotes'
  | 'analysis_limit'
  | 'analysis_tangent'
  | 'analysis_monotonicity'
  | 'analysis_integral'
  | 'analysis_rotation_volume'
  // Combinatorică / probabilitate
  | 'prob_venn2'
  | 'prob_venn3'
  | 'prob_tree'
  // Statistică
  | 'stat_histogram'
  | 'stat_bar'
  | 'stat_pie'
  | 'stat_polygon'
  // Plan complex
  | 'complex_plane'
  // Trigonometrie geometrică
  | 'trig_circle'
  | 'trig_right_triangle'
  | 'trig_reduction'
  // Geometrie spațială
  | 'spatial_projection'
  | 'spatial_dihedral'
  | 'spatial_three_perp'
  // Transformări
  | 'transform_symmetry'
  | 'transform_translation'
  | 'transform_rotation'
  | 'transform_homothety';

const SHAPE_OPTIONS: Array<{ value: ShapeType; label: string }> = [
  { value: 'triangle', label: 'Triunghi' },
  { value: 'circle', label: 'Cerc' },
  { value: 'parallelogram', label: 'Paralelogram / Dreptunghi / Romb / Pătrat' },
  { value: 'trapezoid', label: 'Trapez' },
  { value: 'polygon', label: 'Poligon regulat' },
  { value: 'cube', label: 'Cub' },
  { value: 'prism', label: 'Paralelipiped dreptunghic' },
  { value: 'pyramid', label: 'Piramidă regulată' },
  { value: 'cylinder', label: 'Cilindru' },
  { value: 'cone', label: 'Con' },
  { value: 'sphere', label: 'Sferă' },
  // Trunchiuri
  { value: 'frustum_pyramid', label: 'Trunchi de piramidă' },
  { value: 'frustum_cone', label: 'Trunchi de con' },
  // Plane secante
  { value: 'section_cube', label: 'Cub cu plan secant' },
  { value: 'section_pyramid', label: 'Piramidă cu plan secant' },
  { value: 'section_cone', label: 'Con cu plan secant' },
  { value: 'section_sphere', label: 'Sferă cu plan secant' },
  { value: 'section_cylinder', label: 'Cilindru cu plan secant' },
  // Speciale
  { value: 'tetrahedron', label: 'Tetraedru regulat' },
  { value: 'oblique_prism', label: 'Prismă oblică' },
  { value: 'cube_all_diagonals', label: 'Cub cu toate diagonalele' },
  { value: 'sphere_with_circles', label: 'Sferă cu cerc mare + mic' },
  // ── ETAPA 5 ──────────────────────────────────
  // Funcții elementare
  { value: 'fn_linear', label: '📈 Funcție liniară y=ax+b' },
  { value: 'fn_quadratic', label: '📈 Funcție pătratică y=ax²+bx+c' },
  { value: 'fn_power', label: '📈 Funcție putere y=xⁿ' },
  { value: 'fn_radical', label: '📈 Funcție radical y=√x' },
  { value: 'fn_exponential', label: '📈 Funcție exponențială y=aˣ' },
  { value: 'fn_logarithmic', label: '📈 Funcție logaritmică y=log(x)' },
  { value: 'fn_modulus', label: '📈 Funcție modul y=|ax+b|' },
  { value: 'fn_generic', label: '📈 Funcție generică (expresie)' },
  // Funcții trigonometrice
  { value: 'trig_sin', label: '〜 sin — A·sin(Bx+C)+D' },
  { value: 'trig_cos', label: '〜 cos — A·cos(Bx+C)+D' },
  { value: 'trig_tan', label: '〜 tan cu asimptote' },
  { value: 'trig_cot', label: '〜 cot cu asimptote' },
  // Analiză matematică
  { value: 'analysis_asymptotes', label: '∞ Asimptote (verticale/orizontale/oblice)' },
  { value: 'analysis_limit', label: '→ Limita unei funcții' },
  { value: 'analysis_tangent', label: '/ Tangentă la curbă' },
  { value: 'analysis_monotonicity', label: '↑↓ Monotonie + extreme' },
  { value: 'analysis_integral', label: '∫ Integrală definită (arie)' },
  { value: 'analysis_rotation_volume', label: '○ Volum corp de rotație' },
  // Combinatorică / probabilitate
  { value: 'prob_venn2', label: '○ Diagrama Venn — 2 mulțimi' },
  { value: 'prob_venn3', label: '○ Diagrama Venn — 3 mulțimi' },
  { value: 'prob_tree', label: '🌿 Arbore de probabilitate' },
  // Statistică
  { value: 'stat_histogram', label: '▌ Histogramă frecvențe' },
  { value: 'stat_bar', label: '▌ Diagramă cu bare' },
  { value: 'stat_pie', label: '● Diagramă circulară (pie)' },
  { value: 'stat_polygon', label: '〜 Poligon frecvențe (ogivă)' },
  // Plan complex
  { value: 'complex_plane', label: 'ℂ Plan complex — Re/Im' },
  // Trigonometrie geometrică
  { value: 'trig_circle', label: '○ Cerc trigonometric' },
  { value: 'trig_right_triangle', label: '△ Triunghi dreptunghic + rapoarte' },
  { value: 'trig_reduction', label: '↻ Reducere la unghi ascuțit' },
  // Geometrie spațială
  { value: 'spatial_projection', label: '⬛ Proiecție ortogonală 3D' },
  { value: 'spatial_dihedral', label: '⟁ Unghi diedru' },
  { value: 'spatial_three_perp', label: '⊥ Teorema celor 3 perpendiculare' },
  // Transformări
  { value: 'transform_symmetry', label: '↔ Simetrie axială / centrală' },
  { value: 'transform_translation', label: '→ Translație' },
  { value: 'transform_rotation', label: '↻ Rotație' },
  { value: 'transform_homothety', label: '⤡ Omotetie' },
];

type Vertex = 'A' | 'B' | 'C' | '';
type SideLabelFormat = 'value_only' | 'name_value' | 'name_only';

// ─── Triangle form state ──────────────────────────────────────────────────────

type TrianglePreset = 'custom' | 'right_3_4_5' | 'right_5_12_13' | 'equilateral' | 'isosceles' | 'obtuse';

const TRIANGLE_PRESETS: Array<{ value: TrianglePreset; label: string; a: string; b: string; c: string }> = [
  { value: 'custom',        label: '✏️ Personalizat',        a: '5',  b: '4',  c: '3'  },
  { value: 'right_3_4_5',   label: '📐 Dreptunghic 3-4-5',  a: '5',  b: '4',  c: '3'  },
  { value: 'right_5_12_13', label: '📐 Dreptunghic 5-12-13',a: '13', b: '12', c: '5'  },
  { value: 'equilateral',   label: '△ Echilateral (5-5-5)',  a: '5',  b: '5',  c: '5'  },
  { value: 'isosceles',     label: '△ Isoscel (4-4-6)',      a: '6',  b: '4',  c: '4'  },
  { value: 'obtuse',        label: '△ Obtuzunghic (7-5-3)',  a: '7',  b: '5',  c: '3'  },
];

function TriangleForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [preset, setPreset] = useState<TrianglePreset>('right_3_4_5');
  const [a, setA] = useState('5');
  const [b, setB] = useState('4');
  const [c, setC] = useState('3');
  const [angleA, setAngleA] = useState('');
  const [angleB, setAngleB] = useState('');
  const [angleC, setAngleC] = useState('');
  const [showAnglesSection, setShowAnglesSection] = useState(false);
  const [showSides, setShowSides] = useState(true);
  const [sideLabelFormat, setSideLabelFormat] = useState<SideLabelFormat>('value_only');
  const [autoRightAngle, setAutoRightAngle] = useState(true);
  const [autoEqualAngles, setAutoEqualAngles] = useState(false);
  const [autoEqualSides, setAutoEqualSides] = useState(false);
  const [showIncircle, setShowIncircle] = useState(true);
  const [showCircumcircle, setShowCircumcircle] = useState(false);
  const [showAngleValues, setShowAngleValues] = useState(false);
  const [bisectorFrom, setBisectorFrom] = useState<Vertex>('');
  const [medianFrom, setMedianFrom] = useState<Vertex>('');
  const [altitudeFrom, setAltitudeFrom] = useState<Vertex>('');
  // ─── Elemente avansate unificate ────────────────────────────────────────────
  const [showMidsegments, setShowMidsegments] = useState(false);
  const [showPerpBisectors, setShowPerpBisectors] = useState(false);
  const [showCentroid, setShowCentroid] = useState(false);
  // ────────────────────────────────────────────────────────────────────────────
  const [customLabelsJson, setCustomLabelsJson] = useState('');
  const [angleLabelsJson, setAngleLabelsJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function applyPreset(p: TrianglePreset) {
    setPreset(p);
    const found = TRIANGLE_PRESETS.find((x) => x.value === p);
    if (found && p !== 'custom') { setA(found.a); setB(found.b); setC(found.c); }
  }

  const vertexOptions: Array<{ value: Vertex; label: string }> = [
    { value: '', label: '— Niciuna —' },
    { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
  ];

  const knownCount = [a, b, c, angleA, angleB, angleC].filter((v) => v.trim()).length;

  async function handle() {
    setLoading(true); setError('');
    const constructions: Array<{ type: string; from: string }> = [];
    if (bisectorFrom) constructions.push({ type: 'bisector', from: bisectorFrom });
    if (medianFrom) constructions.push({ type: 'median', from: medianFrom });
    if (altitudeFrom) constructions.push({ type: 'altitude', from: altitudeFrom });

    let customLabels: unknown[] | undefined;
    if (customLabelsJson.trim()) { try { customLabels = JSON.parse(customLabelsJson); } catch { setError('custom labels JSON invalid'); setLoading(false); return; } }
    let angleLabels: unknown[] | undefined;
    if (angleLabelsJson.trim()) { try { angleLabels = JSON.parse(angleLabelsJson); } catch { setError('angle labels JSON invalid'); setLoading(false); return; } }

    try {
      const res = await fetch('/api/admin/generate-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape: 'triangle',
          input: {
            a: a.trim() ? parseFloat(a) : undefined,
            b: b.trim() ? parseFloat(b) : undefined,
            c: c.trim() ? parseFloat(c) : undefined,
            angle_A: angleA.trim() ? parseFloat(angleA) : undefined,
            angle_B: angleB.trim() ? parseFloat(angleB) : undefined,
            angle_C: angleC.trim() ? parseFloat(angleC) : undefined,
            show_sides: showSides, side_label_format: sideLabelFormat,
            auto_detect_right_angles: autoRightAngle,
            auto_detect_equal_angles: autoEqualAngles,
            auto_detect_equal_sides: autoEqualSides,
            show_incircle: showIncircle, show_circumcircle: showCircumcircle,
            show_angle_values: showAngleValues,
            constructions: constructions.length > 0 ? constructions : undefined,
            show_midsegments: showMidsegments || undefined,
            show_perpendicular_bisectors: showPerpBisectors || undefined,
            show_centroid: showCentroid || undefined,
            custom_labels: customLabels, angle_labels: angleLabels,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? [])
        .filter((s: { svg: string | null }) => !!s.svg)
        .map((s: { step: number; title: string; explanation: string; svg: string }) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* ── TASK 5: Preset triunghi ──────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tip triunghi (preset)</label>
        <select value={preset} onChange={(e) => applyPreset(e.target.value as TrianglePreset)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
          {TRIANGLE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Laturi (opțional)</h3>
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'a (BC)', v: a, s: setA }, { l: 'b (CA)', v: b, s: setB }, { l: 'c (AB)', v: c, s: setC }].map(({ l, v, s }) => (
            <div key={l}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type="number" step="0.1" min="0.1" value={v} onChange={(e) => s(e.target.value)} placeholder="—"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setShowAnglesSection((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900">
          <span>{showAnglesSection ? '▾' : '▸'}</span>Unghiuri (opțional)
        </button>
        {showAnglesSection && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-3 gap-3">
              {[{ l: 'A (°)', v: angleA, s: setAngleA }, { l: 'B (°)', v: angleB, s: setAngleB }, { l: 'C (°)', v: angleC, s: setAngleC }].map(({ l, v, s }) => (
                <div key={l}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                  <input type="number" step="1" min="1" max="178" value={v} onChange={(e) => s(e.target.value)} placeholder="—"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <p className={`text-xs ${knownCount >= 3 ? 'text-green-600' : 'text-amber-600'}`}>
              {knownCount} valori — minim 3 necesare
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Opțiuni</h3>
        <div className="space-y-1.5">
          {[
            { l: 'Afișează laturi', c: showSides, s: setShowSides },
            { l: 'Unghi drept (pătrățel)', c: autoRightAngle, s: setAutoRightAngle },
            { l: 'Unghiuri egale (arce)', c: autoEqualAngles, s: setAutoEqualAngles },
            { l: 'Laturi egale (hash marks)', c: autoEqualSides, s: setAutoEqualSides },
            { l: 'Cerc înscris', c: showIncircle, s: setShowIncircle },
            { l: 'Cerc circumscris', c: showCircumcircle, s: setShowCircumcircle },
            { l: 'Valori unghiuri', c: showAngleValues, s: setShowAngleValues },
          ].map(({ l, c, s }) => (
            <label key={l} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">{l}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── TASK 2: Elemente avansate unificate ─────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">🔺 Elemente avansate</h3>
        <div className="space-y-1.5">
          {[
            { l: 'Linii mijlocii (triunghi median)', c: showMidsegments, s: setShowMidsegments },
            { l: 'Mediatoare (circumcentru O)', c: showPerpBisectors, s: setShowPerpBisectors },
            { l: 'Centru de greutate G', c: showCentroid, s: setShowCentroid },
          ].map(({ l, c, s }) => (
            <label key={l} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">{l}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Bisectoare/mediane/înălțimi pe vertex — în secțiunea &quot;Construcții&quot; de mai jos</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Construcții (per vertex)</h3>
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'Bisectoare', v: bisectorFrom, s: setBisectorFrom }, { l: 'Mediana', v: medianFrom, s: setMedianFrom }, { l: 'Înălțimea', v: altitudeFrom, s: setAltitudeFrom }].map(({ l, v, s }) => (
            <div key={l}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <select value={v} onChange={(e) => s(e.target.value as Vertex)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                {vertexOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Custom labels (JSON opțional)</label>
        <textarea value={customLabelsJson} onChange={(e) => setCustomLabelsJson(e.target.value)} rows={2}
          placeholder={`[{"segment":"BC","text":"a"}]`}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono resize-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Etichete unghiuri (JSON opțional)</label>
        <textarea value={angleLabelsJson} onChange={(e) => setAngleLabelsJson(e.target.value)} rows={2}
          placeholder={`[{"vertex":"A","text":"\\\\alpha"}]`}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono resize-none" />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează triunghi'}
      </button>
    </div>
  );
}

// ─── Circle form ──────────────────────────────────────────────────────────────

function CircleForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [radius, setRadius] = useState('4');
  const [showCenter, setShowCenter] = useState(true);
  const [showRadius, setShowRadius] = useState(false);
  const [chordsJson, setChordsJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    let chords: unknown[] | undefined;
    if (chordsJson.trim()) { try { chords = JSON.parse(chordsJson); } catch { setError('JSON invalid'); setLoading(false); return; } }
    try {
      const res = await fetch('/api/admin/generate-circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { radius: parseFloat(radius), show_center: showCenter, show_radius: showRadius, chords } }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Raza</label>
        <input type="number" step="0.5" min="0.5" value={radius} onChange={(e) => setRadius(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>
      <div className="space-y-1.5">
        {[{ l: 'Afișează centrul O', c: showCenter, s: setShowCenter }, { l: 'Afișează raza', c: showRadius, s: setShowRadius }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} />
            <span className="text-sm text-gray-700">{l}</span>
          </label>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Coarde (JSON opțional)</label>
        <textarea value={chordsJson} onChange={(e) => setChordsJson(e.target.value)} rows={3}
          placeholder={`[{"angle1":30,"angle2":150,"label_endpoints":["A","B"]}]`}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono resize-none" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează cerc'}
      </button>
    </div>
  );
}

// ─── Parallelogram / Trapezoid form ──────────────────────────────────────────

function QuadrilateralForm({ type, onResult }: { type: 'parallelogram' | 'trapezoid'; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [base, setBase] = useState('8');
  const [side, setSide] = useState('5');
  const [angle, setAngle] = useState('60');
  const [baseLong, setBaseLong] = useState('10');
  const [baseShort, setBaseShort] = useState('6');
  const [height, setHeight] = useState('4');
  const [showDiag, setShowDiag] = useState(false);
  const [showHeight, setShowHeight] = useState(false);
  const [showMidline, setShowMidline] = useState(false);
  const [autoSpecial, setAutoSpecial] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    const input = type === 'trapezoid'
      ? { base_long: parseFloat(baseLong), base_short: parseFloat(baseShort), height: parseFloat(height), show_vertices: true, show_sides: true, show_diagonals: showDiag, show_height: showHeight, show_midline: showMidline, auto_detect_isosceles: autoSpecial }
      : { base: parseFloat(base), side: parseFloat(side), angle: parseFloat(angle), show_vertices: true, show_sides: true, show_diagonals: showDiag, show_height: showHeight, auto_detect_special: autoSpecial };
    try {
      const res = await fetch('/api/admin/generate-quadrilateral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {type === 'parallelogram' ? (
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'Baza', v: base, s: setBase }, { l: 'Latura', v: side, s: setSide }, { l: 'Unghi (°)', v: angle, s: setAngle }].map(({ l, v, s }) => (
            <div key={l}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type="number" step="0.5" value={v} onChange={(e) => s(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'Baza mare', v: baseLong, s: setBaseLong }, { l: 'Baza mică', v: baseShort, s: setBaseShort }, { l: 'Înălțimea', v: height, s: setHeight }].map(({ l, v, s }) => (
            <div key={l}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type="number" step="0.5" value={v} onChange={(e) => s(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showDiag} onChange={(e) => setShowDiag(e.target.checked)} />
          <span className="text-sm text-gray-700">Diagonale</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showHeight} onChange={(e) => setShowHeight(e.target.checked)} />
          <span className="text-sm text-gray-700">Înălțimea</span>
        </label>
        {type === 'trapezoid' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showMidline} onChange={(e) => setShowMidline(e.target.checked)} />
            <span className="text-sm text-gray-700">Linia mijlocie</span>
          </label>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoSpecial} onChange={(e) => setAutoSpecial(e.target.checked)} />
          <span className="text-sm text-gray-700">Detectare tip special</span>
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : `Generează ${type === 'trapezoid' ? 'trapez' : 'paralelogram'}`}
      </button>
    </div>
  );
}

// ─── Polygon form ─────────────────────────────────────────────────────────────

function PolygonForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [sides, setSides] = useState('6');
  const [radius, setRadius] = useState('4');
  const [showCircum, setShowCircum] = useState(true);
  const [showIncircle, setShowIncircle] = useState(false);
  const [showRadii, setShowRadii] = useState(false);
  const [showApothem, setShowApothem] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-polygon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { sides: parseInt(sides), radius: parseFloat(radius), show_circumcircle: showCircum, show_incircle: showIncircle, show_radii: showRadii, show_apothem: showApothem, label_vertices: true } }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nr. laturi</label>
          <select value={sides} onChange={(e) => setSides(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            {['3','4','5','6','7','8','10','12'].map((n) => <option key={n} value={n}>{n} laturi</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Raza (R)</label>
          <input type="number" step="0.5" min="1" value={radius} onChange={(e) => setRadius(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        {[{ l: 'Cerc circumscris', c: showCircum, s: setShowCircum }, { l: 'Cerc înscris', c: showIncircle, s: setShowIncircle }, { l: 'Raze (centru → vârf)', c: showRadii, s: setShowRadii }, { l: 'Apotema', c: showApothem, s: setShowApothem }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} />
            <span className="text-sm text-gray-700">{l}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează poligon'}
      </button>
    </div>
  );
}

// ─── 3D Solid form ────────────────────────────────────────────────────────────

function SolidForm({ solidType, onResult }: { solidType: ShapeType; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [side, setSide] = useState('4');
  const [length, setLength] = useState('6');
  const [width, setWidth] = useState('4');
  const [height, setHeight] = useState('5');
  const [baseRadius, setBaseRadius] = useState('4');
  const [baseSides, setBaseSides] = useState('4');
  const [showDiag3d, setShowDiag3d] = useState(false);
  const [showHidden, setShowHidden] = useState(true);
  const [showAxis, setShowAxis] = useState(true);
  const [showSlant, setShowSlant] = useState(false);
  const [showEquator, setShowEquator] = useState(true);
  const [showMeridian, setShowMeridian] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    let input: Record<string, unknown>;
    let type = solidType as string;

    if (solidType === 'cube') {
      input = { side: parseFloat(side), show_diagonal_3d: showDiag3d, show_hidden_lines: showHidden, label_vertices: true };
    } else if (solidType === 'prism') {
      input = { length: parseFloat(length), width: parseFloat(width), height: parseFloat(height), show_diagonal_3d: showDiag3d, show_hidden_lines: showHidden, label_vertices: true };
    } else if (solidType === 'pyramid') {
      input = { base_sides: parseInt(baseSides), base_radius: parseFloat(baseRadius), height: parseFloat(height), show_height: showAxis, show_apothem: showSlant, label_vertices: true };
    } else if (solidType === 'cylinder') {
      input = { radius: parseFloat(baseRadius), height: parseFloat(height), show_axis: showAxis, show_diagonal: showDiag3d, label_bottom_center: 'O' };
      type = 'cylinder';
    } else if (solidType === 'cone') {
      input = { base_radius: parseFloat(baseRadius), height: parseFloat(height), show_axis: showAxis, show_slant_height: showSlant, label_apex: 'V', label_base_center: 'O' };
      type = 'cone';
    } else {
      input = { radius: parseFloat(baseRadius), show_equator: showEquator, show_meridian: showMeridian, show_radius: showDiag3d, label_center: 'O' };
      type = 'sphere';
    }

    try {
      const res = await fetch('/api/admin/generate-solid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {solidType === 'cube' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Latura</label>
          <input type="number" step="0.5" min="1" value={side} onChange={(e) => setSide(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
      )}
      {solidType === 'prism' && (
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'Lungime', v: length, s: setLength }, { l: 'Lățime', v: width, s: setWidth }, { l: 'Înălțime', v: height, s: setHeight }].map(({ l, v, s }) => (
            <div key={l}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type="number" step="0.5" value={v} onChange={(e) => s(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          ))}
        </div>
      )}
      {solidType === 'pyramid' && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nr. laturi bază</label>
            <select value={baseSides} onChange={(e) => setBaseSides(e.target.value)}
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm">
              {['3','4','5','6'].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Raza bazei</label>
            <input type="number" step="0.5" value={baseRadius} onChange={(e) => setBaseRadius(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Înălțimea</label>
            <input type="number" step="0.5" value={height} onChange={(e) => setHeight(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
        </div>
      )}
      {(solidType === 'cylinder' || solidType === 'cone') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Raza</label>
            <input type="number" step="0.5" value={baseRadius} onChange={(e) => setBaseRadius(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Înălțimea</label>
            <input type="number" step="0.5" value={height} onChange={(e) => setHeight(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
        </div>
      )}
      {solidType === 'sphere' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Raza</label>
          <input type="number" step="0.5" min="1" value={baseRadius} onChange={(e) => setBaseRadius(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
      )}

      <div className="space-y-1.5">
        {(solidType === 'cube' || solidType === 'prism') && (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showDiag3d} onChange={(e) => setShowDiag3d(e.target.checked)} />
              <span className="text-sm text-gray-700">Diagonala spațială</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              <span className="text-sm text-gray-700">Muchii ascunse (dashed)</span>
            </label>
          </>
        )}
        {(solidType === 'pyramid' || solidType === 'cylinder' || solidType === 'cone') && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAxis} onChange={(e) => setShowAxis(e.target.checked)} />
            <span className="text-sm text-gray-700">Înălțimea / axa</span>
          </label>
        )}
        {(solidType === 'pyramid' || solidType === 'cone') && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showSlant} onChange={(e) => setShowSlant(e.target.checked)} />
            <span className="text-sm text-gray-700">Apotema / generatoarea</span>
          </label>
        )}
        {solidType === 'sphere' && (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showEquator} onChange={(e) => setShowEquator(e.target.checked)} />
              <span className="text-sm text-gray-700">Ecuatorul</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showMeridian} onChange={(e) => setShowMeridian(e.target.checked)} />
              <span className="text-sm text-gray-700">Meridianul</span>
            </label>
          </>
        )}
        {solidType === 'cylinder' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showDiag3d} onChange={(e) => setShowDiag3d(e.target.checked)} />
            <span className="text-sm text-gray-700">Diagonala axială</span>
          </label>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează corp geometric'}
      </button>
    </div>
  );
}

// ─── Frustum form ─────────────────────────────────────────────────────────────

function FrustumForm({ frustumType, onResult }: { frustumType: 'frustum_pyramid' | 'frustum_cone'; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [baseSides, setBaseSides] = useState('4');
  const [baseRadius, setBaseRadius] = useState('5');
  const [topRadius, setTopRadius] = useState('3');
  const [height, setHeight] = useState('6');
  const [showHeight, setShowHeight] = useState(true);
  const [showSlant, setShowSlant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    const type = frustumType === 'frustum_pyramid' ? 'pyramid' : 'cone';
    const input = frustumType === 'frustum_pyramid'
      ? { base_sides: parseInt(baseSides), base_radius: parseFloat(baseRadius), top_radius: parseFloat(topRadius), height: parseFloat(height), show_height: showHeight, show_apothem_lateral: showSlant, label_vertices: true, show_hidden_lines: true }
      : { bottom_radius: parseFloat(baseRadius), top_radius: parseFloat(topRadius), height: parseFloat(height), show_axis: showHeight, show_slant: showSlant, show_radii: true, label_bottom_center: 'O', label_top_center: "O'" };
    try {
      const res = await fetch('/api/admin/generate-frustum', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, input }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {frustumType === 'frustum_pyramid' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nr. laturi bază</label>
          <select value={baseSides} onChange={(e) => setBaseSides(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            {['3','4','6'].map((n) => <option key={n} value={n}>{n} laturi</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Raza mare (R)', v: baseRadius, s: setBaseRadius }, { l: 'Raza mică (r)', v: topRadius, s: setTopRadius }, { l: 'Înălțimea (h)', v: height, s: setHeight }].map(({ l, v, s }) => (
          <div key={l}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
            <input type="number" step="0.5" min="0.5" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showHeight} onChange={(e) => setShowHeight(e.target.checked)} /><span className="text-sm">Înălțimea</span></label>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showSlant} onChange={(e) => setShowSlant(e.target.checked)} /><span className="text-sm">Generatoarea laterală</span></label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : frustumType === 'frustum_pyramid' ? 'Generează trunchi piramidă' : 'Generează trunchi con'}
      </button>
    </div>
  );
}

// ─── Section form ─────────────────────────────────────────────────────────────

function SectionForm({ sectionType, onResult }: { sectionType: ShapeType; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [side, setSide] = useState('5');
  const [baseSides, setBaseSides] = useState('4');
  const [baseRadius, setBaseRadius] = useState('4');
  const [height, setHeight] = useState('6');
  const [ratio, setRatio] = useState('0.5');
  const [radius, setRadius] = useState('5');
  const [distFromCenter, setDistFromCenter] = useState('2');
  const [planeType, setPlaneType] = useState<'horizontal' | 'vertical' | 'diagonal_face' | 'diagonal_space'>('horizontal');
  const [cylSection, setCylSection] = useState<'horizontal' | 'axial' | 'oblique'>('horizontal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    const shape = sectionType.replace('section_', '');
    let input: Record<string, unknown>;
    if (sectionType === 'section_cube') {
      input = { side: parseFloat(side), plane_type: planeType, plane_position: 0.5, show_full_cube: true, highlight_section: true, label_section_vertices: true };
    } else if (sectionType === 'section_pyramid') {
      input = { base_sides: parseInt(baseSides), base_radius: parseFloat(baseRadius), height: parseFloat(height), section_height_ratio: parseFloat(ratio), highlight_section: true, label_vertices: true };
    } else if (sectionType === 'section_cone') {
      input = { base_radius: parseFloat(baseRadius), height: parseFloat(height), section_height_ratio: parseFloat(ratio), highlight_section: true };
    } else if (sectionType === 'section_sphere') {
      input = { radius: parseFloat(radius), section_distance_from_center: parseFloat(distFromCenter), highlight_section: true };
    } else {
      input = { radius: parseFloat(baseRadius), height: parseFloat(height), section_type: cylSection, highlight_section: true };
    }
    try {
      const res = await fetch('/api/admin/generate-section', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shape, input }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {sectionType === 'section_cube' && (
        <>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Latura cubului</label>
            <input type="number" step="0.5" min="1" value={side} onChange={(e) => setSide(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipul planului secant</label>
            <select value={planeType} onChange={(e) => setPlaneType(e.target.value as typeof planeType)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="horizontal">Orizontal</option>
              <option value="vertical">Vertical</option>
              <option value="diagonal_face">Diagonal față</option>
              <option value="diagonal_space">Diagonal spațial</option>
            </select></div>
        </>
      )}
      {(sectionType === 'section_pyramid') && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Nr. laturi</label>
            <select value={baseSides} onChange={(e) => setBaseSides(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              {['3','4','6'].map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Raza bazei</label>
            <input type="number" step="0.5" value={baseRadius} onChange={(e) => setBaseRadius(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Înălțimea</label>
            <input type="number" step="0.5" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Fracție înălțime (0-1)</label>
            <input type="number" step="0.05" min="0.1" max="0.9" value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        </div>
      )}
      {sectionType === 'section_cone' && (
        <div className="grid grid-cols-3 gap-3">
          {[{ l: 'Raza', v: baseRadius, s: setBaseRadius }, { l: 'Înălțimea', v: height, s: setHeight }, { l: 'Fracție (0-1)', v: ratio, s: setRatio }].map(({ l, v, s }) => (
            <div key={l}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type="number" step="0.05" min="0.1" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          ))}
        </div>
      )}
      {sectionType === 'section_sphere' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Raza sferei</label>
            <input type="number" step="0.5" min="1" value={radius} onChange={(e) => setRadius(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Distanța de la centru (0=cerc mare)</label>
            <input type="number" step="0.1" min="0" value={distFromCenter} onChange={(e) => setDistFromCenter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        </div>
      )}
      {sectionType === 'section_cylinder' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[{ l: 'Raza', v: baseRadius, s: setBaseRadius }, { l: 'Înălțimea', v: height, s: setHeight }].map(({ l, v, s }) => (
              <div key={l}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                <input type="number" step="0.5" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
            ))}
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipul secțiunii</label>
            <select value={cylSection} onChange={(e) => setCylSection(e.target.value as typeof cylSection)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="horizontal">Orizontal (elipsă)</option>
              <option value="axial">Axial (dreptunghi)</option>
              <option value="oblique">Oblic</option>
            </select></div>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează secțiune'}
      </button>
    </div>
  );
}

// ─── Special shapes form ──────────────────────────────────────────────────────

function SpecialShapeForm({ shapeType, onResult }: { shapeType: ShapeType; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [side, setSide] = useState('5');
  const [radius, setRadius] = useState('5');
  const [smallCircleDist, setSmallCircleDist] = useState('2');
  const [baseWidth, setBaseWidth] = useState('4');
  const [baseLength, setBaseLength] = useState('4');
  const [height, setHeight] = useState('6');
  const [oblOffset, setOblOffset] = useState('1.5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    let shape = '';
    let input: Record<string, unknown>;

    if (shapeType === 'tetrahedron') {
      shape = 'tetrahedron';
      input = { side: parseFloat(side), show_height: true, label_vertices: true };
    } else if (shapeType === 'oblique_prism') {
      shape = 'oblique_prism';
      input = { base_width: parseFloat(baseWidth), base_length: parseFloat(baseLength), height: parseFloat(height), oblique_offset_x: parseFloat(oblOffset), label_vertices: true };
    } else if (shapeType === 'cube_all_diagonals') {
      // Re-uses solid endpoint via /generate-solid with show_all_diagonals
      const res = await fetch('/api/admin/generate-solid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'cube', input: { side: parseFloat(side), show_all_diagonals: true, show_hidden_lines: true, label_vertices: true } }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps2: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps2);
      setLoading(false);
      return;
    } else {
      // sphere_with_circles — re-uses /generate-solid with sphere
      const res = await fetch('/api/admin/generate-solid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'sphere', input: { radius: parseFloat(radius), show_equator: true, show_great_circle: true, show_small_circle: { distance_from_center: parseFloat(smallCircleDist) }, label_center: 'O' } }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps2: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps2);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/generate-section', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shape, input }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {shapeType === 'tetrahedron' && (
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Latura (toate egale)</label>
          <input type="number" step="0.5" min="1" value={side} onChange={(e) => setSide(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      )}
      {shapeType === 'oblique_prism' && (
        <div className="grid grid-cols-2 gap-3">
          {[{ l: 'Lățimea bazei', v: baseWidth, s: setBaseWidth }, { l: 'Lungimea bazei', v: baseLength, s: setBaseLength }, { l: 'Înălțimea', v: height, s: setHeight }, { l: 'Deplasare laterală', v: oblOffset, s: setOblOffset }].map(({ l, v, s }) => (
            <div key={l}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type="number" step="0.5" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          ))}
        </div>
      )}
      {shapeType === 'cube_all_diagonals' && (
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Latura cubului</label>
          <input type="number" step="0.5" min="1" value={side} onChange={(e) => setSide(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      )}
      {shapeType === 'sphere_with_circles' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Raza sferei</label>
            <input type="number" step="0.5" min="1" value={radius} onChange={(e) => setRadius(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Distanța cerc mic (0=cerc mare)</label>
            <input type="number" step="0.5" min="0" value={smallCircleDist} onChange={(e) => setSmallCircleDist(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează'}
      </button>
    </div>
  );
}

// ─── ETAPA 5 Visual forms (P1 priority) ─────────────────────────────────────

function FnLinearForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [slope, setSlope] = useState('2');
  const [intercept, setIntercept] = useState('-1');
  const [xMin, setXMin] = useState('-4');
  const [xMax, setXMax] = useState('4');
  const [showGrid, setShowGrid] = useState(true);
  const [showSlope, setShowSlope] = useState(true);
  const [showIntercepts, setShowIntercepts] = useState(true);
  const [showEq, setShowEq] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-function', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'linear', params: { a: parseFloat(slope), b: parseFloat(intercept), domain: [parseFloat(xMin), parseFloat(xMax)], show_grid: showGrid, show_slope_triangle: showSlope, show_intercepts: showIntercepts, show_equation: showEq } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Panta a</label>
          <input type="number" step="0.5" value={slope} onChange={(e) => setSlope(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Termenul liber b</label>
          <input type="number" step="0.5" value={intercept} onChange={(e) => setIntercept(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">x min</label>
          <input type="number" step="1" value={xMin} onChange={(e) => setXMin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">x max</label>
          <input type="number" step="1" value={xMax} onChange={(e) => setXMax(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      </div>
      <div className="space-y-1.5">
        {[{ l: 'Grilă', c: showGrid, s: setShowGrid }, { l: 'Triunghi pantă', c: showSlope, s: setShowSlope }, { l: 'Intercepții', c: showIntercepts, s: setShowIntercepts }, { l: 'Ecuația pe grafic', c: showEq, s: setShowEq }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează funcție liniară'}</button>
    </div>
  );
}

function FnQuadraticForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [a, setA] = useState('1');
  const [b, setB] = useState('-2');
  const [c, setC] = useState('-3');
  const [xMin, setXMin] = useState('-5');
  const [xMax, setXMax] = useState('5');
  const [showGrid, setShowGrid] = useState(true);
  const [showVertex, setShowVertex] = useState(true);
  const [showAxis, setShowAxis] = useState(true);
  const [showDisc, setShowDisc] = useState(true);
  const [showXInt, setShowXInt] = useState(true);
  const [showYInt, setShowYInt] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-function', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quadratic', params: { a: parseFloat(a), b: parseFloat(b), c: parseFloat(c), domain: [parseFloat(xMin), parseFloat(xMax)], show_grid: showGrid, show_vertex: showVertex, show_axis_of_symmetry: showAxis, show_discriminant: showDisc, show_x_intercepts: showXInt, show_y_intercept: showYInt } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'a (≠0)', v: a, s: setA }, { l: 'b', v: b, s: setB }, { l: 'c', v: c, s: setC }].map(({ l, v, s }) => (
          <div key={l}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
            <input type="number" step="0.5" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        ))}
        {[{ l: 'x min', v: xMin, s: setXMin }, { l: 'x max', v: xMax, s: setXMax }].map(({ l, v, s }) => (
          <div key={l}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
            <input type="number" step="1" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[{ l: 'Grilă', c: showGrid, s: setShowGrid }, { l: 'Vârful V', c: showVertex, s: setShowVertex }, { l: 'Ax simetrie', c: showAxis, s: setShowAxis }, { l: 'Discriminant Δ', c: showDisc, s: setShowDisc }, { l: 'Rădăcini x', c: showXInt, s: setShowXInt }, { l: 'Intercepție y', c: showYInt, s: setShowYInt }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează funcție pătratică'}</button>
    </div>
  );
}

function FnExponentialForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [base, setBase] = useState('2');
  const [coef, setCoef] = useState('1');
  const [showAsym, setShowAsym] = useState(true);
  const [showYInt, setShowYInt] = useState(true);
  const [showEq, setShowEq] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-function', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'exponential', params: { base: base === 'e' ? Math.E : parseFloat(base), coefficient: parseFloat(coef), show_grid: true, show_asymptote: showAsym, show_y_intercept: showYInt, show_equation: showEq } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Baza a (a&gt;0, a≠1)</label>
          <select value={base} onChange={(e) => setBase(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            {['0.5', '0.25', '2', '3', 'e', '10'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Coeficient k</label>
          <input type="number" step="0.5" value={coef} onChange={(e) => setCoef(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      </div>
      <div className="space-y-1.5">
        {[{ l: 'Asimptota y=0', c: showAsym, s: setShowAsym }, { l: 'Punct (0,k)', c: showYInt, s: setShowYInt }, { l: 'Ecuația', c: showEq, s: setShowEq }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează exponențială'}</button>
    </div>
  );
}

function FnLogarithmicForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [base, setBase] = useState('2');
  const [coef, setCoef] = useState('1');
  const [showAsym, setShowAsym] = useState(true);
  const [showXInt, setShowXInt] = useState(true);
  const [showEq, setShowEq] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-function', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'logarithmic', params: { base: base === 'e' ? Math.E : parseFloat(base), coefficient: parseFloat(coef), show_grid: true, show_asymptote: showAsym, show_x_intercept: showXInt, show_equation: showEq } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Baza a</label>
          <select value={base} onChange={(e) => setBase(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            {['0.5', '2', '3', 'e', '10'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Coeficient k</label>
          <input type="number" step="0.5" value={coef} onChange={(e) => setCoef(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      </div>
      <div className="space-y-1.5">
        {[{ l: 'Asimptota x=0', c: showAsym, s: setShowAsym }, { l: 'Punct (1,0)', c: showXInt, s: setShowXInt }, { l: 'Ecuația', c: showEq, s: setShowEq }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează logaritmică'}</button>
    </div>
  );
}

function FnModulusForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [a, setA] = useState('1');
  const [b, setB] = useState('-2');
  const [showBreak, setShowBreak] = useState(true);
  const [showPiecewise, setShowPiecewise] = useState(false);
  const [showEq, setShowEq] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-function', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'modulus', params: { a: parseFloat(a), b: parseFloat(b), show_grid: true, show_breakpoint: showBreak, show_piecewise_labels: showPiecewise, show_equation: showEq } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">a</label>
          <input type="number" step="0.5" value={a} onChange={(e) => setA(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">b</label>
          <input type="number" step="0.5" value={b} onChange={(e) => setB(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      </div>
      <p className="text-xs text-gray-500">y = |{a}x {parseInt(b) >= 0 ? '+' : ''}{b}|</p>
      <div className="space-y-1.5">
        {[{ l: 'Punctul de înfrângere', c: showBreak, s: setShowBreak }, { l: 'Etichete ramuri', c: showPiecewise, s: setShowPiecewise }, { l: 'Ecuația', c: showEq, s: setShowEq }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează modul'}</button>
    </div>
  );
}

function TrigCircleForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [angleDeg, setAngleDeg] = useState('60');
  const [showSpecial, setShowSpecial] = useState(true);
  const [showSin, setShowSin] = useState(true);
  const [showCos, setShowCos] = useState(true);
  const [showTan, setShowTan] = useState(false);
  const [showArc, setShowArc] = useState(true);
  const [showCoords, setShowCoords] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-trig', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'trig_circle', params: { angle_deg: parseFloat(angleDeg), show_special_angles: showSpecial, show_sin_projection: showSin, show_cos_projection: showCos, show_tan_line: showTan, show_angle_arc: showArc, show_coordinates: showCoords } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Unghiul α (°)</label>
        <div className="flex gap-2">
          <input type="number" step="1" min="-360" max="360" value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
          <select onChange={(e) => setAngleDeg(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-md text-sm">
            <option value="">Preset</option>
            {[0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330].map((d) => <option key={d} value={d}>{d}°</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[{ l: 'Unghiuri speciale', c: showSpecial, s: setShowSpecial }, { l: 'Proiecție sin', c: showSin, s: setShowSin }, { l: 'Proiecție cos', c: showCos, s: setShowCos }, { l: 'Tangenta', c: showTan, s: setShowTan }, { l: 'Arc unghi', c: showArc, s: setShowArc }, { l: 'Coordonate', c: showCoords, s: setShowCoords }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează cerc trigonometric'}</button>
    </div>
  );
}

function TrigRightTriangleForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [angleDeg, setAngleDeg] = useState('30');
  const [hyp, setHyp] = useState('10');
  const [showRatios, setShowRatios] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [showSides, setShowSides] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handle() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/generate-trig', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'right_triangle', params: { angle_deg: parseFloat(angleDeg), hypotenuse: parseFloat(hyp), show_trig_ratios: showRatios, show_angle_labels: showAngles, show_side_labels: showSides } }) });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Unghiul α (°)</label>
          <select value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
            {[15, 30, 45, 60, 75].map((d) => <option key={d} value={d}>{d}°</option>)}
          </select></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Ipotenuza</label>
          <input type="number" step="1" min="1" value={hyp} onChange={(e) => setHyp(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
      </div>
      <div className="space-y-1.5">
        {[{ l: 'Rapoarte trigonometrice', c: showRatios, s: setShowRatios }, { l: 'Etichete unghiuri', c: showAngles, s: setShowAngles }, { l: 'Etichete laturi', c: showSides, s: setShowSides }].map(({ l, c, s }) => (
          <label key={l} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c} onChange={(e) => s(e.target.checked)} /><span className="text-sm text-gray-700">{l}</span></label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">{loading ? 'Se generează...' : 'Generează triunghi dreptunghic'}</button>
    </div>
  );
}

// ─── Generic API form (ETAPA 5 calculatoare) ──────────────────────────────────

type GenericApiConfig = {
  endpoint: string;
  typeParam?: string; // if endpoint takes a `type` field
  defaultParams: string; // JSON string
  buttonLabel: string;
};

// P1 shapes (fn_linear, fn_quadratic, fn_exponential, fn_logarithmic, fn_modulus,
//            trig_circle, trig_right_triangle) au formulare vizuale dedicate — NU sunt în această mapă.
const ETAPA5_CONFIGS: Record<string, GenericApiConfig> = {
  // Funcții P2/P3 (JSON fallback)
  fn_power: { endpoint: '/api/admin/generate-function', typeParam: 'power', defaultParams: JSON.stringify({ exponent: 3, coefficient: 1, show_grid: true, show_equation: true }, null, 2), buttonLabel: 'Generează funcție putere' },
  fn_radical: { endpoint: '/api/admin/generate-function', typeParam: 'radical', defaultParams: JSON.stringify({ index: 2, coefficient: 1, show_grid: true }, null, 2), buttonLabel: 'Generează radical' },
  fn_generic: { endpoint: '/api/admin/generate-function', typeParam: 'generic', defaultParams: JSON.stringify({ expression: 'x^3 - 3*x', domain: [-3, 3], show_grid: true }, null, 2), buttonLabel: 'Generează funcție' },
  // Funcții trigonometrice
  trig_sin: { endpoint: '/api/admin/generate-trig', typeParam: 'sin', defaultParams: JSON.stringify({ amplitude: 2, frequency: 1, phase: 0, vertical_shift: 0, show_period_marker: true, show_amplitude_lines: true, show_max_min_points: true, show_zeros: true }, null, 2), buttonLabel: 'Generează sin' },
  trig_cos: { endpoint: '/api/admin/generate-trig', typeParam: 'cos', defaultParams: JSON.stringify({ amplitude: 1, frequency: 1, phase: 0, show_period_marker: true, show_amplitude_lines: true }, null, 2), buttonLabel: 'Generează cos' },
  trig_tan: { endpoint: '/api/admin/generate-trig', typeParam: 'tan', defaultParams: JSON.stringify({ amplitude: 1, frequency: 1, show_asymptotes: true }, null, 2), buttonLabel: 'Generează tan' },
  trig_cot: { endpoint: '/api/admin/generate-trig', typeParam: 'cot', defaultParams: JSON.stringify({ amplitude: 1, frequency: 1, show_asymptotes: true }, null, 2), buttonLabel: 'Generează cot' },
  trig_reduction: { endpoint: '/api/admin/generate-trig', typeParam: 'reduction', defaultParams: JSON.stringify({ angle_deg: 150, show_reference_angle: true, show_reduction_formula: true, show_quadrant_label: true }, null, 2), buttonLabel: 'Generează reducere unghi' },
  // Analiză
  analysis_asymptotes: { endpoint: '/api/admin/generate-analysis', typeParam: 'asymptotes', defaultParams: JSON.stringify({ expression: '1/(x-2)', domain: [-2, 6], range: [-8, 8], asymptotes: [{ type: 'vertical', x: 2 }, { type: 'horizontal', y: 0 }] }, null, 2), buttonLabel: 'Generează asimptote' },
  analysis_limit: { endpoint: '/api/admin/generate-analysis', typeParam: 'limit', defaultParams: JSON.stringify({ expression: 'sin(x)/x', approach_point: 0, domain: [-5, 5], show_approach_arrows: true }, null, 2), buttonLabel: 'Generează limită' },
  analysis_tangent: { endpoint: '/api/admin/generate-analysis', typeParam: 'tangent', defaultParams: JSON.stringify({ expression: 'x^2', tangent_point: 1, domain: [-3, 4], show_slope_triangle: true, show_derivative_value: true }, null, 2), buttonLabel: 'Generează tangentă' },
  analysis_monotonicity: { endpoint: '/api/admin/generate-analysis', typeParam: 'monotonicity', defaultParams: JSON.stringify({ expression: 'x^3 - 3*x', domain: [-3, 3], show_extrema: true, show_derivative: true }, null, 2), buttonLabel: 'Generează monotonie' },
  analysis_integral: { endpoint: '/api/admin/generate-analysis', typeParam: 'integral', defaultParams: JSON.stringify({ expression: 'x^2', a: 0, b: 2, show_bounds: true, show_riemann: true, riemann_n: 8 }, null, 2), buttonLabel: 'Generează integrală' },
  analysis_rotation_volume: { endpoint: '/api/admin/generate-analysis', typeParam: 'rotation_volume', defaultParams: JSON.stringify({ expression: 'sqrt(x)', a: 0, b: 4, show_washer: true, num_washers: 5 }, null, 2), buttonLabel: 'Generează volum rotație' },
  // Combinatorică / probabilitate
  prob_venn2: { endpoint: '/api/admin/generate-probability', typeParam: 'venn2', defaultParams: JSON.stringify({ sets: [{ label: 'A', count: 30 }, { label: 'B', count: 25 }], intersection: 10, universe: 60, show_counts: true, title: 'Diagrama Venn' }, null, 2), buttonLabel: 'Generează Venn 2' },
  prob_venn3: { endpoint: '/api/admin/generate-probability', typeParam: 'venn3', defaultParams: JSON.stringify({ sets: [{ label: 'A', count: 20 }, { label: 'B', count: 22 }, { label: 'C', count: 18 }], intersections: { ab: 8, ac: 6, bc: 7, abc: 3 }, universe: 60, show_counts: true }, null, 2), buttonLabel: 'Generează Venn 3' },
  prob_tree: { endpoint: '/api/admin/generate-probability', typeParam: 'tree', defaultParams: JSON.stringify({ root_label: 'S', branches: [{ label: 'A', probability: 0.6, children: [{ label: 'B', probability: 0.7 }, { label: '\\overline{B}', probability: 0.3 }] }, { label: '\\overline{A}', probability: 0.4, children: [{ label: 'B', probability: 0.2 }, { label: '\\overline{B}', probability: 0.8 }] }], show_final_probabilities: true }, null, 2), buttonLabel: 'Generează arbore' },
  // Statistică
  stat_histogram: { endpoint: '/api/admin/generate-statistics', typeParam: 'histogram', defaultParams: JSON.stringify({ intervals: [{ start: 0, end: 5, frequency: 4 }, { start: 5, end: 10, frequency: 12 }, { start: 10, end: 15, frequency: 18 }, { start: 15, end: 20, frequency: 9 }, { start: 20, end: 25, frequency: 3 }], title: 'Histogramă', show_frequency_labels: true }, null, 2), buttonLabel: 'Generează histogramă' },
  stat_bar: { endpoint: '/api/admin/generate-statistics', typeParam: 'bar', defaultParams: JSON.stringify({ categories: ['Lun', 'Mar', 'Mie', 'Joi', 'Vin'], values: [5, 8, 12, 7, 10], title: 'Diagrama cu bare', show_value_labels: true }, null, 2), buttonLabel: 'Generează bare' },
  stat_pie: { endpoint: '/api/admin/generate-statistics', typeParam: 'pie', defaultParams: JSON.stringify({ slices: [{ label: 'A', value: 40 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }, { label: 'D', value: 10 }], title: 'Diagram circular', show_percentages: true }, null, 2), buttonLabel: 'Generează pie' },
  stat_polygon: { endpoint: '/api/admin/generate-statistics', typeParam: 'frequency_polygon', defaultParams: JSON.stringify({ intervals: [{ start: 0, end: 10, frequency: 5 }, { start: 10, end: 20, frequency: 12 }, { start: 20, end: 30, frequency: 8 }, { start: 30, end: 40, frequency: 3 }], show_histogram: true, show_cumulative: true }, null, 2), buttonLabel: 'Generează poligon' },
  // Plan complex
  complex_plane: { endpoint: '/api/admin/generate-complex', defaultParams: JSON.stringify({ numbers: [{ re: 3, im: 2, label: 'z_1' }, { re: -1, im: 3, label: 'z_2' }], show_modulus: true, show_argument: true, show_conjugate: true, show_sum: true }, null, 2), buttonLabel: 'Generează plan complex' },
  // Geometrie spațială
  spatial_projection: { endpoint: '/api/admin/generate-spatial', typeParam: 'projection', defaultParams: JSON.stringify({ width: 4, depth: 3, height: 3, point: { x: 2, y: 2, z: 2, label: 'P' }, project_onto: 'base', show_projection_lines: true }, null, 2), buttonLabel: 'Generează proiecție 3D' },
  spatial_dihedral: { endpoint: '/api/admin/generate-spatial', typeParam: 'dihedral', defaultParams: JSON.stringify({ angle_deg: 60, edge_length: 3, show_perpendicular: true }, null, 2), buttonLabel: 'Generează unghi diedru' },
  spatial_three_perp: { endpoint: '/api/admin/generate-spatial', typeParam: 'three_perp', defaultParams: JSON.stringify({ base_width: 5, base_depth: 4, height: 3, show_labels: true, show_right_angle_markers: true }, null, 2), buttonLabel: 'Generează 3 perpendiculare' },
  // Transformări
  transform_symmetry: { endpoint: '/api/admin/generate-transformation', typeParam: 'symmetry', defaultParams: JSON.stringify({ points: [{ x: 2, y: 3 }, { x: -1, y: 2 }, { x: 3, y: -1 }], axis: 'y', type: 'axial', show_grid: true }, null, 2), buttonLabel: 'Generează simetrie' },
  transform_translation: { endpoint: '/api/admin/generate-transformation', typeParam: 'translation', defaultParams: JSON.stringify({ points: [{ x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 4 }], vector: { dx: 2, dy: -3 }, show_grid: true }, null, 2), buttonLabel: 'Generează translație' },
  transform_rotation: { endpoint: '/api/admin/generate-transformation', typeParam: 'rotation', defaultParams: JSON.stringify({ points: [{ x: 3, y: 0 }, { x: 0, y: 2 }], center: { x: 0, y: 0 }, angle_deg: 90, show_arcs: true, show_grid: true }, null, 2), buttonLabel: 'Generează rotație' },
  transform_homothety: { endpoint: '/api/admin/generate-transformation', typeParam: 'homothety', defaultParams: JSON.stringify({ points: [{ x: 2, y: 1 }, { x: 4, y: 2 }, { x: 3, y: 4 }], center: { x: 0, y: 0 }, ratio: 2, show_lines: true, show_grid: true }, null, 2), buttonLabel: 'Generează omotetie' },
};

function GenericApiForm({ shapeKey, onResult }: { shapeKey: keyof typeof ETAPA5_CONFIGS; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const config = ETAPA5_CONFIGS[shapeKey];
  const [paramsJson, setParamsJson] = useState(config.defaultParams);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    let params: Record<string, unknown>;
    try { params = JSON.parse(paramsJson) as Record<string, unknown>; }
    catch { setError('JSON invalid — verifică sintaxa'); setLoading(false); return; }

    try {
      const body = config.typeParam
        ? { type: config.typeParam, params }
        : params;

      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string; svg?: string };
      if (!res.ok) { setError(data.error ?? 'Eroare server'); setLoading(false); return; }
      onResult(data.svg ?? '', []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare rețea'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Parametri (JSON)</label>
        <textarea
          value={paramsJson}
          onChange={(e) => setParamsJson(e.target.value)}
          rows={14}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono resize-y"
          spellCheck={false}
        />
      </div>
      <div className="text-xs text-gray-400">
        Endpoint: <code className="bg-gray-100 px-1 rounded">{config.endpoint}</code>
        {config.typeParam && <> · type: <code className="bg-gray-100 px-1 rounded">{config.typeParam}</code></>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading}
        className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : config.buttonLabel}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestConstructionPage() {
  const [shape, setShape] = useState<ShapeType>('triangle');
  const [mainSvg, setMainSvg] = useState('');
  const [steps, setSteps] = useState<ConstructionStep[]>([]);

  function handleResult(svg: string, s: ConstructionStep[]) {
    setMainSvg(svg);
    setSteps(s);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Test Construction Viewer</h1>
      <p className="text-sm text-gray-500 mb-6">Testează calculatoare geometrice și slideshow pas-cu-pas.</p>

      {/* Shape selector */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Tipul desenului</label>
        <select
          value={shape}
          onChange={(e) => { setShape(e.target.value as ShapeType); setMainSvg(''); setSteps([]); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[260px]"
        >
          {SHAPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-800 mb-5">
            {SHAPE_OPTIONS.find((o) => o.value === shape)?.label ?? 'Parametri'}
          </h2>

          {/* key={shape} forțează remount la schimbare categorie → TASK 4 fix */}
          {shape === 'triangle' && <TriangleForm key={shape} onResult={handleResult} />}
          {shape === 'circle' && <CircleForm key={shape} onResult={handleResult} />}
          {shape === 'parallelogram' && <QuadrilateralForm key={shape} type="parallelogram" onResult={handleResult} />}
          {shape === 'trapezoid' && <QuadrilateralForm key={shape} type="trapezoid" onResult={handleResult} />}
          {shape === 'polygon' && <PolygonForm key={shape} onResult={handleResult} />}
          {(shape === 'cube' || shape === 'prism' || shape === 'pyramid' || shape === 'cylinder' || shape === 'cone' || shape === 'sphere') && (
            <SolidForm key={shape} solidType={shape} onResult={handleResult} />
          )}
          {(shape === 'frustum_pyramid' || shape === 'frustum_cone') && (
            <FrustumForm key={shape} frustumType={shape} onResult={handleResult} />
          )}
          {(shape === 'section_cube' || shape === 'section_pyramid' || shape === 'section_cone' || shape === 'section_sphere' || shape === 'section_cylinder') && (
            <SectionForm key={shape} sectionType={shape} onResult={handleResult} />
          )}
          {(shape === 'tetrahedron' || shape === 'oblique_prism' || shape === 'cube_all_diagonals' || shape === 'sphere_with_circles') && (
            <SpecialShapeForm key={shape} shapeType={shape} onResult={handleResult} />
          )}
          {/* ETAPA 5 — P1: formulare vizuale dedicate */}
          {shape === 'fn_linear' && <FnLinearForm key={shape} onResult={handleResult} />}
          {shape === 'fn_quadratic' && <FnQuadraticForm key={shape} onResult={handleResult} />}
          {shape === 'fn_exponential' && <FnExponentialForm key={shape} onResult={handleResult} />}
          {shape === 'fn_logarithmic' && <FnLogarithmicForm key={shape} onResult={handleResult} />}
          {shape === 'fn_modulus' && <FnModulusForm key={shape} onResult={handleResult} />}
          {shape === 'trig_circle' && <TrigCircleForm key={shape} onResult={handleResult} />}
          {shape === 'trig_right_triangle' && <TrigRightTriangleForm key={shape} onResult={handleResult} />}
          {/* ETAPA 5 — P2/P3: JSON fallback pentru restul */}
          {(shape in ETAPA5_CONFIGS) && (
            <GenericApiForm key={shape} shapeKey={shape as keyof typeof ETAPA5_CONFIGS} onResult={handleResult} />
          )}
        </div>

        {/* Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Preview</h2>

          {mainSvg ? (
            <div className="space-y-4">
              <div
                className="bg-gray-50 border border-gray-100 rounded-lg p-6 flex items-center justify-center min-h-[300px]"
                dangerouslySetInnerHTML={{ __html: mainSvg }}
              />
              {steps.length > 0 ? (
                <ConstructionTriggerButton
                  steps={steps}
                  title={SHAPE_OPTIONS.find((o) => o.value === shape)?.label ?? shape}
                />
              ) : (
                <p className="text-sm text-gray-400">Niciun pas de construcție generat.</p>
              )}
              <p className="text-xs text-gray-400">{steps.length} pași disponibili</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-12 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
              Apasă &ldquo;Generează&rdquo; pentru a vedea preview-ul
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
