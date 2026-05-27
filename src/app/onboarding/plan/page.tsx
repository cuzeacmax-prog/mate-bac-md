'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';

const TOPIC_LABELS: Record<string, string> = {
  // Clasa 10
  algebra_ecuatii: 'Ecuații algebrice',
  algebra_inecuatii: 'Inecuații',
  siruri: 'Șiruri',
  functii: 'Funcții',
  trigonometrie_baza: 'Trigonometrie',
  logaritmi: 'Logaritmi',
  exponentiale: 'Funcții exponențiale',
  // Clasa 11
  limite: 'Limite de funcții',
  derivate: 'Derivate',
  derivate_aplicatii: 'Aplicații ale derivatelor',
  polinoame: 'Polinoame',
  ecuatii_log_exp: 'Ecuații log/exp',
  inecuatii_log_exp: 'Inecuații log/exp',
  siruri_avansate: 'Șiruri avansate',
  // Clasa 12
  primitive: 'Primitive',
  integrale: 'Integrale definite',
  arii_volume: 'Arii și volume',
  geometrie_3d: 'Geometrie 3D',
  numere_complexe: 'Numere complexe',
  matrici_determinanti: 'Matrici și determinanți',
  combinatorica: 'Combinatorică',
  probabilitati: 'Probabilități',
};

const STRENGTH_COLORS = [
  { bg: 'bg-red-100', fill: 'bg-red-400', text: 'text-red-700', label: 'Prioritate mare' },
  { bg: 'bg-amber-100', fill: 'bg-amber-400', text: 'text-amber-700', label: 'Necesită practică' },
  { bg: 'bg-yellow-100', fill: 'bg-yellow-400', text: 'text-yellow-700', label: 'De consolidat' },
];

export default function PlanPage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const weaknesses = store.weaknesses.slice(0, 3);
  const prediction = store.initialBacPrediction ?? 5.8;
  const target = store.targetBacScore ?? 9;

  // Fill to 3 items if fewer weaknesses
  const filledWeaknesses = [...weaknesses];
  while (filledWeaknesses.length < 3) {
    filledWeaknesses.push('general');
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8 max-w-lg mx-auto w-full gap-6">
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Planul tău personalizat</h2>
          <p className="text-muted-foreground text-sm">
            De la <span className="font-semibold text-foreground">{prediction.toFixed(1)}</span>{' '}
            la{' '}
            <span className="font-semibold text-primary">{target.toFixed(1)}</span>{' '}
            în 3 luni
          </p>
        </div>

        {/* Weaknesses */}
        <div className="space-y-3">
          <p className="font-semibold text-sm">Capitolele prioritare:</p>
          {filledWeaknesses.map((topicId, i) => {
            const color = STRENGTH_COLORS[i] ?? STRENGTH_COLORS[2];
            const label = TOPIC_LABELS[topicId] ?? 'Matematică generală';
            const score = Math.max(10, 40 - i * 10); // 40%, 30%, 20%

            return (
              <div key={topicId + i} className="rounded-xl bg-muted/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{label}</span>
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${color.bg} ${color.text}`}>
                    {color.label}
                  </span>
                </div>
                <div className={`h-2 rounded-full ${color.bg}`}>
                  <div
                    className={`h-full rounded-full ${color.fill} transition-all duration-700`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Mastery: {score}% → obiectiv 85%
                </p>
              </div>
            );
          })}
        </div>

        {/* First lesson teaser */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Astăzi începem cu</p>
          <p className="font-bold text-base">
            {TOPIC_LABELS[filledWeaknesses[0]] ?? 'Matematică'} — Lecția 1
          </p>
          <p className="text-xs text-muted-foreground">8 minute · cu Profesorul Max</p>
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold"
          onClick={() => router.push('/onboarding/first-lesson')}
        >
          Începem azi — 8 minute 🚀
        </Button>
      </motion.div>
    </div>
  );
}
