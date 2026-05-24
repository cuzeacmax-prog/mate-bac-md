'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MethodForm, type MethodFormData } from '../_components/MethodForm';

export default function NewMethodPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(data: MethodFormData) {
    setSaving(true);
    setError('');
    try {
      // Normalize array fields from comma-separated strings
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

      const res = await fetch('/api/admin/methodologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Eroare necunoscută');
      }

      router.push('/admin/methodologies');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/methodologies" className="text-sm text-gray-500 hover:text-gray-700">
          ← Înapoi la Metodologii
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Metodă nouă</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded mb-6">
          {error}
        </div>
      )}

      <MethodForm onSubmit={handleSubmit} saving={saving} submitLabel="Creează metodă" />
    </div>
  );
}
