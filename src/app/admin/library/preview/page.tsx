'use client';

import { useState } from 'react';

type ShapeType = 'triangle' | 'circle' | 'parallelogram' | 'trapezoid' | 'polygon' | 'cube' | 'prism' | 'pyramid' | 'cylinder' | 'cone' | 'sphere';

const SHAPES: { id: ShapeType; label: string; endpoint: string; defaultInput: object }[] = [
  { id: 'triangle', label: 'Triunghi', endpoint: '/api/admin/generate-triangle', defaultInput: { a: 5, b: 6, c: 7, show_sides: true, show_angles: true } },
  { id: 'circle', label: 'Cerc', endpoint: '/api/admin/generate-circle', defaultInput: { radius: 4, show_radius: true, show_diameter: true } },
  { id: 'parallelogram', label: 'Paralelogram', endpoint: '/api/admin/generate-quadrilateral', defaultInput: { type: 'parallelogram', base: 6, side: 4, angle: 60, show_sides: true } },
  { id: 'trapezoid', label: 'Trapez', endpoint: '/api/admin/generate-quadrilateral', defaultInput: { type: 'trapezoid', base_long: 8, base_short: 4, height: 3, show_sides: true } },
  { id: 'polygon', label: 'Poligon reg.', endpoint: '/api/admin/generate-polygon', defaultInput: { sides: 6, side_length: 3, show_sides: true } },
  { id: 'cube', label: 'Cub', endpoint: '/api/admin/generate-solid', defaultInput: { type: 'cube', input: { side: 4, label_vertices: true } } },
  { id: 'prism', label: 'Paralelipiped', endpoint: '/api/admin/generate-solid', defaultInput: { type: 'prism', input: { width: 5, height: 4, depth: 3, label_vertices: true } } },
  { id: 'pyramid', label: 'Piramidă', endpoint: '/api/admin/generate-solid', defaultInput: { type: 'pyramid', input: { base_sides: 4, base_length: 4, height: 6, label_vertices: true } } },
  { id: 'cylinder', label: 'Cilindru', endpoint: '/api/admin/generate-solid', defaultInput: { type: 'cylinder', input: { radius: 3, height: 5 } } },
  { id: 'cone', label: 'Con', endpoint: '/api/admin/generate-solid', defaultInput: { type: 'cone', input: { radius: 3, height: 5 } } },
  { id: 'sphere', label: 'Sferă', endpoint: '/api/admin/generate-solid', defaultInput: { type: 'sphere', input: { radius: 4 } } },
];

interface PreviewCard {
  id: ShapeType;
  label: string;
  svg: string | null;
  error: string | null;
  loading: boolean;
}

export default function VariationPreviewPage() {
  const [cards, setCards] = useState<PreviewCard[]>(
    SHAPES.map((s) => ({ id: s.id, label: s.label, svg: null, error: null, loading: false }))
  );
  const [globalLoading, setGlobalLoading] = useState(false);

  async function loadAll() {
    setGlobalLoading(true);
    setCards((prev) => prev.map((c) => ({ ...c, loading: true, error: null, svg: null })));

    await Promise.allSettled(
      SHAPES.map(async (shape) => {
        try {
          const body = shape.endpoint.includes('generate-solid')
            ? shape.defaultInput
            : { input: shape.defaultInput };

          const res = await fetch(shape.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();

          setCards((prev) =>
            prev.map((c) =>
              c.id === shape.id
                ? { ...c, loading: false, svg: data.svg ?? null, error: data.error ?? null }
                : c
            )
          );
        } catch (e) {
          setCards((prev) =>
            prev.map((c) =>
              c.id === shape.id
                ? { ...c, loading: false, error: e instanceof Error ? e.message : 'Eroare necunoscută' }
                : c
            )
          );
        }
      })
    );

    setGlobalLoading(false);
  }

  async function loadOne(shape: typeof SHAPES[number]) {
    setCards((prev) => prev.map((c) => c.id === shape.id ? { ...c, loading: true, error: null, svg: null } : c));

    try {
      const body = shape.endpoint.includes('generate-solid')
        ? shape.defaultInput
        : { input: shape.defaultInput };

      const res = await fetch(shape.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setCards((prev) =>
        prev.map((c) =>
          c.id === shape.id ? { ...c, loading: false, svg: data.svg ?? null, error: data.error ?? null } : c
        )
      );
    } catch (e) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === shape.id ? { ...c, loading: false, error: e instanceof Error ? e.message : 'Eroare' } : c
        )
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Variation Preview</h1>
        <button
          onClick={loadAll}
          disabled={globalLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {globalLoading ? 'Se compilează…' : 'Compilează toate (fără AI)'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Compilare TikZ → SVG via Railway. Fără Anthropic API, fără cost AI.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const shape = SHAPES.find((s) => s.id === card.id)!;
          return (
            <div key={card.id} className="border rounded-lg p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-700">{card.label}</span>
                <button
                  onClick={() => loadOne(shape)}
                  disabled={card.loading}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  {card.loading ? '…' : 'Reload'}
                </button>
              </div>

              <div className="h-40 flex items-center justify-center bg-gray-50 rounded border">
                {card.loading && (
                  <span className="text-gray-400 text-sm animate-pulse">Se compilează…</span>
                )}
                {!card.loading && card.svg && (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: card.svg }}
                  />
                )}
                {!card.loading && card.error && (
                  <span className="text-red-500 text-xs text-center px-2">{card.error}</span>
                )}
                {!card.loading && !card.svg && !card.error && (
                  <span className="text-gray-300 text-xs">Apasă Reload</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
