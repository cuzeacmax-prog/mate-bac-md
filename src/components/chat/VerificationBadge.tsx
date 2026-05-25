'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import type { VerificationMeta } from '@/app/app/chat/_components/ChatMessages';

interface Props {
  verification: VerificationMeta;
}

export function VerificationBadge({ verification }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const isGood = verification.isCorrect;
  const hasLowConfidence = verification.confidence > 0 && verification.confidence < 0.7;

  // Nu afișa badge dacă confidence = 0 (verificarea a eșuat silențios)
  if (verification.confidence === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowDetails(true)}
        className={[
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors focus-visible:ring-2',
          isGood
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 focus-visible:ring-green-400'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 focus-visible:ring-amber-400',
        ].join(' ')}
        title={isGood ? 'Răspuns verificat matematic' : 'Posibilă problemă — click pentru detalii'}
        aria-label={isGood ? 'Verificat' : 'Atenție la calcule'}
      >
        {isGood ? (
          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
        ) : (
          <AlertCircle className="w-3 h-3" aria-hidden="true" />
        )}
        {isGood ? 'Verificat' : 'Atenție'}
        {hasLowConfidence && <span className="opacity-60">?</span>}
      </button>

      {/* Modal detalii verificare */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDetails(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-5 h-5 ${isGood ? 'text-green-500' : 'text-amber-500'}`} />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Verificare matematică
                  </h3>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                  aria-label="Închide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status */}
              <div className={[
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                isGood
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200',
              ].join(' ')}>
                {isGood ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {isGood
                  ? 'Calculele matematice sunt corecte'
                  : 'Au fost detectate potențiale probleme'}
              </div>

              {/* Confidence */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Încredere verificator</span>
                  <span>{Math.round(verification.confidence * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isGood ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.round(verification.confidence * 100)}%` }}
                  />
                </div>
              </div>

              {/* Footer info */}
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Verificare automată de acuratețe matematică.
                {verification.confidence < 0.8 && ' Verifică manual pentru siguranță.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
