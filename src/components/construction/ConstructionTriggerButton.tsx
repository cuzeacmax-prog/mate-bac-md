'use client';

import { useState } from 'react';
import { ConstructionViewer, type ConstructionStep } from './ConstructionViewer';

interface ConstructionTriggerButtonProps {
  steps: ConstructionStep[];
  title?: string;
  buttonLabel?: string;
  className?: string;
}

export function ConstructionTriggerButton({
  steps,
  title,
  buttonLabel = '📐 Vezi construcția pas-cu-pas',
  className = '',
}: ConstructionTriggerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (steps.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-medium transition-colors text-sm ${className}`}
      >
        {buttonLabel}
      </button>

      <ConstructionViewer
        steps={steps}
        title={title}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
