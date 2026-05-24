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
  // Nou: trunchiuri
  | 'frustum_pyramid'
  | 'frustum_cone'
  // Nou: plane secante
  | 'section_cube'
  | 'section_pyramid'
  | 'section_cone'
  | 'section_sphere'
  | 'section_cylinder'
  // Nou: speciale
  | 'tetrahedron'
  | 'oblique_prism'
  | 'cube_all_diagonals'
  | 'sphere_with_circles'
  // Nou: triunghi extins
  | 'triangle_midsegments'
  | 'triangle_perp_bisectors'
  | 'triangle_centroid';

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
  // Triunghi extins
  { value: 'triangle_midsegments', label: 'Triunghi — linii mijlocii' },
  { value: 'triangle_perp_bisectors', label: 'Triunghi — mediatoare' },
  { value: 'triangle_centroid', label: 'Triunghi — centru de greutate G' },
];

type Vertex = 'A' | 'B' | 'C' | '';
type SideLabelFormat = 'value_only' | 'name_value' | 'name_only';

// ─── Triangle form state ──────────────────────────────────────────────────────

function TriangleForm({ onResult }: { onResult: (svg: string, steps: ConstructionStep[]) => void }) {
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
  const [customLabelsJson, setCustomLabelsJson] = useState('');
  const [angleLabelsJson, setAngleLabelsJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Construcții</h3>
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
    let shape = sectionType.replace('section_', '');
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

// ─── Triangle extension form ───────────────────────────────────────────────────

function TriangleExtForm({ extType, onResult }: { extType: ShapeType; onResult: (svg: string, steps: ConstructionStep[]) => void }) {
  const [a, setA] = useState('5');
  const [b, setB] = useState('7');
  const [c, setC] = useState('8');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handle() {
    setLoading(true); setError('');
    const base = { a: parseFloat(a), b: parseFloat(b), c: parseFloat(c), show_sides: true, show_vertices: true };
    let input: Record<string, unknown> = { ...base };
    if (extType === 'triangle_midsegments') input = { ...base, show_midsegments: true };
    else if (extType === 'triangle_perp_bisectors') input = { ...base, show_perpendicular_bisectors: true };
    else input = { ...base, show_centroid: true, constructions: [{ type: 'median', from: 'A' }, { type: 'median', from: 'B' }, { type: 'median', from: 'C' }] };

    try {
      const res = await fetch('/api/admin/generate-advanced', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shape: 'triangle', input }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return; }
      const steps: ConstructionStep[] = (data.construction_steps ?? []).filter((s: { svg: string | null }) => !!s.svg).map((s: ConstructionStep) => s);
      onResult(data.svg || '', steps);
    } catch (e) { setError(e instanceof Error ? e.message : 'Eroare'); }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'a (BC)', v: a, s: setA }, { l: 'b (CA)', v: b, s: setB }, { l: 'c (AB)', v: c, s: setC }].map(({ l, v, s }) => (
          <div key={l}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
            <input type="number" step="0.5" min="0.5" value={v} onChange={(e) => s(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /></div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handle} disabled={loading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md font-semibold text-sm">
        {loading ? 'Se generează...' : 'Generează'}
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

          {shape === 'triangle' && <TriangleForm onResult={handleResult} />}
          {shape === 'circle' && <CircleForm onResult={handleResult} />}
          {shape === 'parallelogram' && <QuadrilateralForm type="parallelogram" onResult={handleResult} />}
          {shape === 'trapezoid' && <QuadrilateralForm type="trapezoid" onResult={handleResult} />}
          {shape === 'polygon' && <PolygonForm onResult={handleResult} />}
          {(shape === 'cube' || shape === 'prism' || shape === 'pyramid' || shape === 'cylinder' || shape === 'cone' || shape === 'sphere') && (
            <SolidForm solidType={shape} onResult={handleResult} />
          )}
          {(shape === 'frustum_pyramid' || shape === 'frustum_cone') && (
            <FrustumForm frustumType={shape} onResult={handleResult} />
          )}
          {(shape === 'section_cube' || shape === 'section_pyramid' || shape === 'section_cone' || shape === 'section_sphere' || shape === 'section_cylinder') && (
            <SectionForm sectionType={shape} onResult={handleResult} />
          )}
          {(shape === 'tetrahedron' || shape === 'oblique_prism' || shape === 'cube_all_diagonals' || shape === 'sphere_with_circles') && (
            <SpecialShapeForm shapeType={shape} onResult={handleResult} />
          )}
          {(shape === 'triangle_midsegments' || shape === 'triangle_perp_bisectors' || shape === 'triangle_centroid') && (
            <TriangleExtForm extType={shape} onResult={handleResult} />
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
