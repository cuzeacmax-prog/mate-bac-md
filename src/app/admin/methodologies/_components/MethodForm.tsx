'use client';

import { useState } from 'react';

export interface MethodFormData {
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  grade_level: number;
  topic: string;
  subtopic: string;
  description: string;
  steps: string;           // JSON string
  notation_rules: string;  // JSON string
  required_elements: string;
  forbidden_shortcuts: string;
  examples: string;        // JSON string
  common_mistakes: string; // JSON string
  required_tools: string;
  difficulty: number;
  importance_score: number;
  validated: boolean;
}

const TOPICS = ['algebra', 'analiza', 'geometrie', 'trigonometrie', 'combinatorica', 'probabilitate'];
const GRADES = [10, 11, 12];

interface Props {
  initial?: Partial<MethodFormData>;
  onSubmit: (data: MethodFormData) => Promise<void>;
  saving: boolean;
  submitLabel?: string;
}

const EMPTY: MethodFormData = {
  exercise_type: '',
  exercise_type_label: '',
  method_name: '',
  grade_level: 12,
  topic: 'algebra',
  subtopic: '',
  description: '',
  steps: '[]',
  notation_rules: '{}',
  required_elements: '',
  forbidden_shortcuts: '',
  examples: '[]',
  common_mistakes: '[]',
  required_tools: '',
  difficulty: 3,
  importance_score: 5,
  validated: false,
};

function isValidJson(s: string): boolean {
  try { JSON.parse(s); return true; } catch { return false; }
}

export function MethodForm({ initial, onSubmit, saving, submitLabel = 'Salvează' }: Props) {
  const merged: MethodFormData = { ...EMPTY, ...initial };
  const [form, setForm] = useState<MethodFormData>(merged);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  function set<K extends keyof MethodFormData>(key: K, value: MethodFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setJson(key: 'steps' | 'notation_rules' | 'examples' | 'common_mistakes', value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (!isValidJson(value)) {
      setJsonErrors(prev => ({ ...prev, [key]: 'JSON invalid' }));
    } else {
      setJsonErrors(prev => { const c = { ...prev }; delete c[key]; return c; });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.keys(jsonErrors).length > 0) {
      alert('Corectează erorile JSON înainte de salvare.');
      return;
    }
    await onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identificare */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Identificare</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tip exercițiu <code>(exercise_type)</code> *
            </label>
            <input
              required
              value={form.exercise_type}
              onChange={e => set('exercise_type', e.target.value)}
              placeholder="ecuatie_gradul_2"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Etichetă afișată *
            </label>
            <input
              required
              value={form.exercise_type_label}
              onChange={e => set('exercise_type_label', e.target.value)}
              placeholder="Ecuație de gradul II"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Numele metodei *
            </label>
            <input
              required
              value={form.method_name}
              onChange={e => set('method_name', e.target.value)}
              placeholder="Metoda discriminantului cu verificare Viète"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Clasă *</label>
            <select
              value={form.grade_level}
              onChange={e => set('grade_level', parseInt(e.target.value, 10))}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            >
              {GRADES.map(g => <option key={g} value={g}>Clasa {g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Domeniu *</label>
            <select
              value={form.topic}
              onChange={e => set('topic', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            >
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subdomeniu</label>
            <input
              value={form.subtopic}
              onChange={e => set('subtopic', e.target.value)}
              placeholder="ecuatii, inecuatii, sisteme…"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input
              type="checkbox"
              id="validated"
              checked={form.validated}
              onChange={e => set('validated', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="validated" className="text-sm font-medium text-gray-700">
              Metodă validată
            </label>
          </div>
        </div>
      </section>

      {/* Descriere */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Descriere pedagogică</h2>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Descriere a metodei — când se aplică, ce avantaje are, specificul BAC MD…"
          rows={3}
          className="w-full text-sm border border-gray-300 rounded px-3 py-2"
        />
      </section>

      {/* Pași */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Etapele rezolvării (JSON)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Format: <code>[{`{"step":1,"title":"Calculează Δ","content":"Δ = b² - 4ac","formula":"\\\\Delta = b^2 - 4ac"}`}]</code>
        </p>
        <textarea
          value={form.steps}
          onChange={e => setJson('steps', e.target.value)}
          rows={8}
          spellCheck={false}
          className={`w-full text-sm font-mono border rounded px-3 py-2 ${
            jsonErrors.steps ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        />
        {jsonErrors.steps && <p className="text-xs text-red-600 mt-1">{jsonErrors.steps}</p>}
      </section>

      {/* Notații */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Reguli notație BAC MD (JSON)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Format: <code>{`{"delta":"Δ","solution_set":"S = {…}","final":"R: …"}`}</code>
        </p>
        <textarea
          value={form.notation_rules}
          onChange={e => setJson('notation_rules', e.target.value)}
          rows={4}
          spellCheck={false}
          className={`w-full text-sm font-mono border rounded px-3 py-2 ${
            jsonErrors.notation_rules ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        />
        {jsonErrors.notation_rules && <p className="text-xs text-red-600 mt-1">{jsonErrors.notation_rules}</p>}
      </section>

      {/* Elemente obligatorii + scurtături interzise */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Elemente obligatorii + scurtături interzise</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Elemente obligatorii (virgulă)
            </label>
            <textarea
              value={form.required_elements}
              onChange={e => set('required_elements', e.target.value)}
              placeholder="calculul Δ, verificarea Viète, setul soluție S = {…}"
              rows={3}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Scurtături interzise (virgulă)
            </label>
            <textarea
              value={form.forbidden_shortcuts}
              onChange={e => set('forbidden_shortcuts', e.target.value)}
              placeholder="formulele Viète fără a scrie Δ, scrierea x=… fără S={…}"
              rows={3}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* Exemple */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Exemple complete (JSON)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Format: <code>[{`{"problem":"x²-5x+6=0","solution":[...],"answer":"S = {2, 3}"}`}]</code>
        </p>
        <textarea
          value={form.examples}
          onChange={e => setJson('examples', e.target.value)}
          rows={8}
          spellCheck={false}
          className={`w-full text-sm font-mono border rounded px-3 py-2 ${
            jsonErrors.examples ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        />
        {jsonErrors.examples && <p className="text-xs text-red-600 mt-1">{jsonErrors.examples}</p>}
      </section>

      {/* Greșeli comune */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Greșeli comune (JSON)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Format: <code>[{`{"mistake":"uită Δ < 0","correction":"Dacă Δ < 0, S = ∅"}`}]</code>
        </p>
        <textarea
          value={form.common_mistakes}
          onChange={e => setJson('common_mistakes', e.target.value)}
          rows={5}
          spellCheck={false}
          className={`w-full text-sm font-mono border rounded px-3 py-2 ${
            jsonErrors.common_mistakes ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        />
        {jsonErrors.common_mistakes && <p className="text-xs text-red-600 mt-1">{jsonErrors.common_mistakes}</p>}
      </section>

      {/* Metrici */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Metrici</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Dificultate (1–5)
            </label>
            <input
              type="number" min="1" max="5"
              value={form.difficulty}
              onChange={e => set('difficulty', parseInt(e.target.value, 10))}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Scor importanță (1–10)
            </label>
            <input
              type="number" min="1" max="10"
              value={form.importance_score}
              onChange={e => set('importance_score', parseInt(e.target.value, 10))}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tool-uri necesare (virgulă)
            </label>
            <input
              value={form.required_tools}
              onChange={e => set('required_tools', e.target.value)}
              placeholder="ecuatie_gradul_2, discriminant"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || Object.keys(jsonErrors).length > 0}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Se salvează…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => history.back()}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          Anulează
        </button>
      </div>
    </form>
  );
}
