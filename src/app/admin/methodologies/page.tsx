'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Method {
  id: string;
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  grade_level: number;
  topic: string;
  subtopic: string | null;
  difficulty: number;
  importance_score: number;
  validated: boolean;
  validated_by: string | null;
  usage_count: number;
  created_at: string;
}

const TOPICS = ['', 'algebra', 'analiza', 'geometrie', 'trigonometrie', 'combinatorica', 'probabilitate'];
const GRADES = ['', '10', '11', '12'];

export default function MethodologiesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Method[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [grade, setGrade] = useState('');
  const [topic, setTopic] = useState('');
  const [validated, setValidated] = useState('');

  const LIMIT = 25;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (grade) params.set('grade', grade);
      if (topic) params.set('topic', topic);
      if (validated !== '') params.set('validated', validated);

      const res = await fetch(`/api/admin/methodologies?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setItems(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, grade, topic, validated]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Ștergi metoda "${name}"?`)) return;
    const res = await fetch(`/api/admin/methodologies/${id}`, { method: 'DELETE' });
    if (res.ok) void fetchItems();
    else alert('Eroare la ștergere.');
  }

  async function toggleValidated(item: Method) {
    const res = await fetch(`/api/admin/methodologies/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validated: !item.validated }),
    });
    if (res.ok) void fetchItems();
    else alert('Eroare la actualizare.');
  }

  const totalPages = Math.ceil(count / LIMIT);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metode de rezolvare BAC MD</h1>
          <p className="text-sm text-gray-500 mt-1">{count} metode total</p>
        </div>
        <Link
          href="/admin/methodologies/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + Metodă nouă
        </Link>
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Clasă</label>
          <select
            value={grade}
            onChange={e => { setGrade(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            {GRADES.map(g => <option key={g} value={g}>{g || 'Toate'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Domeniu</label>
          <select
            value={topic}
            onChange={e => { setTopic(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            {TOPICS.map(t => <option key={t} value={t}>{t || 'Toate'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={validated}
            onChange={e => { setValidated(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            <option value="">Toate</option>
            <option value="true">Validate</option>
            <option value="false">Nevalidate</option>
          </select>
        </div>
        <button
          onClick={() => { setGrade(''); setTopic(''); setValidated(''); setPage(1); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Se încarcă…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p className="text-lg mb-2">Nicio metodă găsită.</p>
          <Link href="/admin/methodologies/new" className="text-blue-600 hover:underline">
            Adaugă prima metodă
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Metodă</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tip exercițiu</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Cls.</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Domeniu</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Dificult.</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Import.</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Valid.</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">Folosit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/admin/methodologies/${item.id}`)}
                      className="font-medium text-blue-700 hover:underline text-left"
                    >
                      {item.method_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {item.exercise_type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.grade_level}</td>
                  <td className="px-3 py-3 text-gray-600">{item.topic}</td>
                  <td className="px-3 py-3 text-center">
                    {'⭐'.repeat(item.difficulty)}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.importance_score}/10</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => toggleValidated(item)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.validated
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title={item.validated ? `Validat de ${item.validated_by ?? 'admin'}` : 'Click pt validare'}
                    >
                      {item.validated ? '✓ DA' : '○ NU'}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500">{item.usage_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/methodologies/${item.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id, item.method_name)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Șterge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginare */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
