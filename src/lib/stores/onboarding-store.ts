import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiagnosticAttempt } from '@/lib/diagnostic/adaptive';
import type { Goal } from '@/lib/profile/goal';

interface OnboardingState {
  // Pre-auth data
  targetBacScore: number | null;
  gradeLevel: 9 | 10 | 11 | 12 | null;
  // ETAPA 82: obiectivul (clasă vs BAC vs explorare) — ales înainte de diagnostic
  goal: Goal | null;

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
  setGradeLevel: (grade: 9 | 10 | 11 | 12) => void;
  setGoal: (goal: Goal) => void;
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
  goal: null,
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
      setGoal: (goal) => set({ goal }),
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
