'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { MethodForm, type MethodFormData } from '../_components/MethodForm';

interface RawMethod {
  id: string;
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  grade_level: number;
  topic: string;
  subtopic: string | null;
  description: string | null;
  steps: unknown[];
  notation_rules: Record<string, unknown>;
  required_elements: string[];
  forbidden_shortcuts: string[];
  examples: unknown[];
  common_mistakes: unknown[];
  required_tools: string[];
  difficulty: number;
  importance_score: number;
  validated: boolean;
  validated_by: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export default function EditMethodPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [method, setMethod] = useState<RawMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/methodologies/${id}`)
      .then(res => res.json())
      .then(json => setMethod(json.data ?? null))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(data: MethodFormData) {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        ...data,
        steps:               JSON.parse(data.steps),
        notation_rules:      JSON.parse(data.notation_rules),
        examples:            JSON.parse(data.examples),
        common_mistakes:     JSON.parse(data.common_mistakes),
        required_elements:   data.required_elements.split(',').map(s => s.trim()).filter(Boolean),
        forbidden_shortcuts: data.forbidden_shortcuts.split(',').map(s => s.trim()).filter(Boolean),
        required_tools:      data.required_tools.split(',').map(s => s.trim()).filter(Boolean),
      };

      const res = await fetch(`/api/admin/methodologies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Eroare necunoscută');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!method) return;
    if (!confirm(`Ștergi metoda "${method.method_name}"? Acțiunea este ireversibilă.`)) return;
    const res = await fetch(`/api/admin/methodologies/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/methodologies');
    else alert('Eroare la ștergere.');
  }

  if (loading) return <div className="text-center text-gray-500 py-16">Se încarcă…</div>;
  if (!method) return (
    <div className="text-center text-gray-500 py-16">
      <p>Metoda nu a fost găsită.</p>
      <Link href="/admin/methodologies" className="text-blue-600 hover:underline">← Înapoi</Link>
    </div>
  );

  // Convert DB arrays → form strings for the MethodForm component
  const initial: Partial<MethodFormData> = {
    exercise_type:       method.exercise_type,
    exercise_type_label: method.exercise_type_label,
    method_name:         method.method_name,
    grade_level:         method.grade_level,
    topic:               method.topic,
    subtopic:            method.subtopic ?? '',
    description:         method.description ?? '',
    steps:               JSON.stringify(method.steps, null, 2),
    notation_rules:      JSON.stringify(method.notation_rules, null, 2),
    required_elements:   (method.required_elements ?? []).join(', '),
    forbidden_shortcuts: (method.forbidden_shortcuts ?? []).join(', '),
    examples:            JSON.stringify(method.examples, null, 2),
    common_mistakes:     JSON.stringify(method.common_mistakes, null, 2),
    required_tools:      (method.required_tools ?? []).join(', '),
    difficulty:          method.difficulty,
    importance_score:    method.importance_score,
    validated:           method.validated,
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/methodologies" className="text-sm text-gray-500 hover:text-gray-700">
            ← Înapoi la Metodologii
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{method.method_name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            ID: <code className="font-mono text-xs">{method.id}</code>
            {' · '}Creat: {new Date(method.created_at).toLocaleDateString('ro-MD')}
            {' · '}Folosit: {method.usage_count}×
            {method.validated_by && ` · Validat de: ${method.validated_by}`}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-800 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50"
        >
          Șterge
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded mb-6">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded mb-6">
          ✓ Salvat cu succes!
        </div>
      )}

      <MethodForm initial={initial} onSubmit={handleSubmit} saving={saving} submitLabel="Actualizează" />
    </div>
  );
}
