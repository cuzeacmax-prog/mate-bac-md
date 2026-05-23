'use client';

import { useState } from 'react';
import { ConstructionTriggerButton } from '@/components/construction/ConstructionTriggerButton';
import type { ConstructionStep } from '@/components/construction/ConstructionViewer';

type Vertex = 'A' | 'B' | 'C' | '';

export default function TestConstructionPage() {
  const [a, setA] = useState(5);
  const [b, setB] = useState(4);
  const [c, setC] = useState(3);
  const [showSides, setShowSides] = useState(true);
  const [autoRightAngle, setAutoRightAngle] = useState(true);
  const [autoEqualAngles, setAutoEqualAngles] = useState(false);
  const [autoEqualSides, setAutoEqualSides] = useState(false);
  const [showIncircle, setShowIncircle] = useState(true);
  const [showCircumcircle, setShowCircumcircle] = useState(false);
  const [bisectorFrom, setBisectorFrom] = useState<Vertex>('');
  const [medianFrom, setMedianFrom] = useState<Vertex>('');
  const [altitudeFrom, setAltitudeFrom] = useState<Vertex>('');

  const [steps, setSteps] = useState<ConstructionStep[]>([]);
  const [mainSvg, setMainSvg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setSteps([]);
    setMainSvg('');

    const constructions: Array<{ type: string; from: string }> = [];
    if (bisectorFrom) constructions.push({ type: 'bisector', from: bisectorFrom });
    if (medianFrom) constructions.push({ type: 'median', from: medianFrom });
    if (altitudeFrom) constructions.push({ type: 'altitude', from: altitudeFrom });

    try {
      const response = await fetch('/api/admin/generate-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape: 'triangle',
          input: {
            a,
            b,
            c,
            show_sides: showSides,
            auto_detect_right_angles: autoRightAngle,
            auto_detect_equal_angles: autoEqualAngles,
            auto_detect_equal_sides: autoEqualSides,
            show_incircle: showIncircle,
            show_circumcircle: showCircumcircle,
            constructions: constructions.length > 0 ? constructions : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Eroare necunoscută');
        return;
      }

      setMainSvg(data.svg || '');
      const validSteps: ConstructionStep[] = (data.construction_steps || [])
        .filter((s: { svg: string | null }) => !!s.svg)
        .map((s: { step: number; title: string; explanation: string; svg: string }) => ({
          step: s.step,
          title: s.title,
          explanation: s.explanation,
          svg: s.svg,
        }));
      setSteps(validSteps);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la generare');
    } finally {
      setLoading(false);
    }
  }

  const vertexOptions: Array<{ value: Vertex; label: string }> = [
    { value: '', label: '— Niciuna —' },
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Test Construction Viewer</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configurează un triunghi și testează slideshow-ul de construcție pas-cu-pas.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          <h2 className="font-semibold text-gray-800">Parametri triunghi</h2>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Latura a (BC)', val: a, set: setA },
              { label: 'Latura b (CA)', val: b, set: setB },
              { label: 'Latura c (AB)', val: c, set: setC },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={val}
                  onChange={(e) => set(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Afișare</h3>
            {[
              { label: 'Măsuri laturi (a, b, c)', checked: showSides, set: setShowSides },
              { label: 'Cerc înscris (centru I)', checked: showIncircle, set: setShowIncircle },
              { label: 'Cerc circumscris (centru O)', checked: showCircumcircle, set: setShowCircumcircle },
            ].map(({ label, checked, set }) => (
              <label key={label} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => set(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Detectare automată</h3>
            {[
              { label: 'Unghi drept (pătrățel)', checked: autoRightAngle, set: setAutoRightAngle },
              { label: 'Unghiuri egale (arce)', checked: autoEqualAngles, set: setAutoEqualAngles },
              { label: 'Laturi egale (hash marks)', checked: autoEqualSides, set: setAutoEqualSides },
            ].map(({ label, checked, set }) => (
              <label key={label} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => set(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Construcții (opțional)</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Bisectoare din', val: bisectorFrom, set: setBisectorFrom },
                { label: 'Mediana din', val: medianFrom, set: setMedianFrom },
                { label: 'Înălțimea din', val: altitudeFrom, set: setAltitudeFrom },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <select
                    value={val}
                    onChange={(e) => set(e.target.value as Vertex)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {vertexOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md font-semibold transition-colors"
          >
            {loading ? 'Se generează...' : 'Generează desen'}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
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
                  title={`Triunghi cu laturile a=${a}, b=${b}, c=${c}`}
                />
              ) : (
                <p className="text-sm text-gray-400">
                  Niciun pas de construcție generat (niciun SVG disponibil).
                </p>
              )}

              <p className="text-xs text-gray-400">{steps.length} pași disponibili</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-12 text-center text-gray-400 min-h-[300px] flex items-center justify-center">
              Apasă &ldquo;Generează desen&rdquo; pentru a vedea preview-ul
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
