'use client';

import { useState, useEffect, useCallback } from 'react';

interface Exercise {
  id: string;
  statement: string;
  solution: string;
  topic: string;
  subtopic: string | null;
  difficulty: number;
  grade_level: number;
  tags: string[];
  svg_static: string | null;
  needs_review: boolean;
  reviewed_by_admin: boolean;
  source: string | null;
  created_at: string;
}

interface ApiResponse {
  data: Exercise[];
  count: number;
  page: number;
  limit: number;
}

type EditState = { id: string; statement: string; solution: string } | null;

const TOPICS = ['', 'geometrie_plana', 'geometrie_spatiala', 'algebrica', 'analiza'];
const DIFFICULTIES = ['', '1', '2', '3', '4', '5'];
const GRADES = ['', '9', '10', '11', '12'];

export default function LibraryReviewPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [grade, setGrade] = useState('');
  const [needsReview, setNeedsReview] = useState('true');

  const [editState, setEditState] = useState<EditState>(null);
  const [editSaving, setEditSaving] = useState(false);

  const LIMIT = 20;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (topic) params.set('topic', topic);
      if (difficulty) params.set('difficulty', difficulty);
      if (grade) params.set('grade', grade);
      if (needsReview) params.set('needs_review', needsReview);

      const res = await fetch(`/api/admin/library/list?${params.toString()}`);
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error((json as unknown as { error: string }).error);
      setItems(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, [page, topic, difficulty, grade, needsReview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve(); // ieșim din faza sincronă a effect-ului
      if (!cancelled) void fetchItems();
    })();
    return () => { cancelled = true; };
  }, [fetchItems]);

  async function approve(id: string) {
    await fetch('/api/admin/library/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reviewed_by_admin: true, needs_review: false }),
    });
    void fetchItems();
  }

  async function reject(id: string) {
    if (!confirm('Ești sigur că vrei să ștergi acest exercițiu?')) return;
    await fetch(`/api/admin/library/list?id=${id}`, { method: 'DELETE' });
    void fetchItems();
  }

  async function saveEdit() {
    if (!editState) return;
    setEditSaving(true);
    await fetch('/api/admin/library/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editState.id, statement: editState.statement, solution: editState.solution }),
    });
    setEditSaving(false);
    setEditState(null);
    void fetchItems();
  }

  const totalPages = Math.ceil(count / LIMIT);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Library Review</h1>
          <p className="text-sm text-gray-500">{count} exerciții totale</p>
        </div>
        <button
          onClick={fetchItems}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Reîncarcă
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <select
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Toate topicele</option>
          {TOPICS.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={difficulty}
          onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Orice dificultate</option>
          {DIFFICULTIES.filter(Boolean).map((d) => <option key={d} value={d}>Dif. {d}</option>)}
        </select>
        <select
          value={grade}
          onChange={(e) => { setGrade(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Orice clasă</option>
          {GRADES.filter(Boolean).map((g) => <option key={g} value={g}>Clasa {g}</option>)}
        </select>
        <select
          value={needsReview}
          onChange={(e) => { setNeedsReview(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="true">Necesită review</option>
          <option value="false">Aprobate</option>
          <option value="">Toate</option>
        </select>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-gray-400">Se încarcă...</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <p className="text-lg font-medium mb-2">Niciun exercițiu găsit</p>
          <p className="text-sm">Rulează batch generator pentru a popula biblioteca.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
                {/* SVG preview */}
                {item.svg_static ? (
                  <div
                    className="bg-gray-50 border border-gray-100 rounded p-2 flex items-center justify-center min-h-[120px] overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: item.svg_static }}
                  />
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded p-4 text-center text-xs text-gray-400 min-h-[120px] flex items-center justify-center">
                    Fără SVG
                  </div>
                )}

                {/* Meta */}
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{item.topic}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Dif. {item.difficulty}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Cl. {item.grade_level}</span>
                  {item.needs_review && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">Review necesar</span>
                  )}
                  {item.reviewed_by_admin && (
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">✓ Aprobat</span>
                  )}
                </div>

                {/* Statement */}
                <p className="text-sm text-gray-700 line-clamp-3">{item.statement}</p>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => approve(item.id)}
                    className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md"
                  >
                    Aprobă
                  </button>
                  <button
                    onClick={() => setEditState({ id: item.id, statement: item.statement, solution: item.solution })}
                    className="flex-1 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-md"
                  >
                    Editează
                  </button>
                  <button
                    onClick={() => reject(item.id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-md"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-40"
              >
                Următor →
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-gray-900 mb-4">Editare exercițiu</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enunț</label>
                <textarea
                  value={editState.statement}
                  onChange={(e) => setEditState((s) => s ? { ...s, statement: e.target.value } : s)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Soluție</label>
                <textarea
                  value={editState.solution}
                  onChange={(e) => setEditState((s) => s ? { ...s, solution: e.target.value } : s)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-md"
              >
                {editSaving ? 'Se salvează...' : 'Salvează'}
              </button>
              <button
                onClick={() => setEditState(null)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-md"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
