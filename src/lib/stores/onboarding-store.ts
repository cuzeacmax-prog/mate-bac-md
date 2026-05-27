import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiagnosticAttempt } from '@/lib/diagnostic/adaptive';

interface OnboardingState {
  // Pre-auth data
  targetBacScore: number | null;
  gradeLevel: 10 | 11 | 12 | null;

  // Post-auth diagnostic
  currentStep: string | null;
  diagnosticSessionId: string | null;
  diagnosticHistory: DiagnosticAttempt[];
  diagnosticStartedAt: number | null;

  // Results
  initialBacPrediction: number | null;
  weaknesses: string[];

  // Actions
  setTargetScore: (score: number) => void;
  setGradeLevel: (grade: 10 | 11 | 12) => void;
  setCurrentStep: (step: string) => void;
  setDiagnosticSessionId: (id: string) => void;
  startDiagnosticTimer: () => void;
  addDiagnosticAttempt: (attempt: DiagnosticAttempt) => void;
  setInitialBacPrediction: (score: number) => void;
  setWeaknesses: (topics: string[]) => void;
  reset: () => void;
}

const initialState = {
  targetBacScore: null,
  gradeLevel: null,
  currentStep: null,
  diagnosticSessionId: null,
  diagnosticHistory: [],
  diagnosticStartedAt: null,
  initialBacPrediction: null,
  weaknesses: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setTargetScore: (score) => set({ targetBacScore: score }),
      setGradeLevel: (grade) => set({ gradeLevel: grade }),
      setCurrentStep: (step) => set({ currentStep: step }),
      setDiagnosticSessionId: (id) => set({ diagnosticSessionId: id }),
      startDiagnosticTimer: () => set({ diagnosticStartedAt: Date.now() }),
      addDiagnosticAttempt: (attempt) =>
        set((s) => ({ diagnosticHistory: [...s.diagnosticHistory, attempt] })),
      setInitialBacPrediction: (score) => set({ initialBacPrediction: score }),
      setWeaknesses: (topics) => set({ weaknesses: topics }),
      reset: () => set(initialState),
    }),
    { name: 'matebacmd-onboarding' }
  )
);
