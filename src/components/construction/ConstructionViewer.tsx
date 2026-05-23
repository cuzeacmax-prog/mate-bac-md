'use client';

import { useState, useEffect } from 'react';

export interface ConstructionStep {
  step: number;
  title: string;
  explanation: string;
  svg: string;
}

interface ConstructionViewerProps {
  steps: ConstructionStep[];
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ConstructionViewer({ steps, title, isOpen, onClose }: ConstructionViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && currentIndex < steps.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, currentIndex, steps.length, onClose]);

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/92 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors"
        aria-label="Închide"
      >
        ✕ Închide
      </button>

      {title && (
        <h1 className="text-white text-2xl font-bold mb-2 text-center max-w-3xl">{title}</h1>
      )}

      <div className="flex gap-2 mb-4">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex
                ? 'w-8 bg-blue-400'
                : i < currentIndex
                  ? 'w-2 bg-blue-600'
                  : 'w-2 bg-gray-600'
            }`}
            aria-label={`Pasul ${i + 1}`}
          />
        ))}
      </div>

      <h2 className="text-blue-300 text-xl font-semibold mb-2 text-center">
        Pasul {currentStep.step} din {steps.length}: {currentStep.title}
      </h2>

      <p className="text-gray-200 text-base text-center max-w-2xl mb-6 leading-relaxed">
        {currentStep.explanation}
      </p>

      <div
        className="bg-white rounded-xl p-8 mb-6 max-w-2xl max-h-[55vh] overflow-auto flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: currentStep.svg }}
      />

      <div className="flex gap-4">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          className={`px-6 py-3 rounded-md font-semibold transition-colors ${
            isFirst
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          ← Pasul anterior
        </button>
        <button
          onClick={() => setCurrentIndex((i) => Math.min(steps.length - 1, i + 1))}
          disabled={isLast}
          className={`px-6 py-3 rounded-md font-semibold transition-colors ${
            isLast
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          Pasul următor →
        </button>
      </div>

      <p className="text-gray-500 text-xs mt-4">
        Folosește ← → pentru navigare, Esc pentru închidere
      </p>
    </div>
  );
}
