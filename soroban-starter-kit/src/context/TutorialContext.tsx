import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ALL_TUTORIALS, Tutorial, TutorialStep } from '../tutorial/steps';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepAnalytics {
  stepId: string;
  timeSpentMs: number;
  skipped: boolean;
}

export interface TutorialAnalytics {
  tutorialId: string;
  startedAt: number;
  completedAt?: number;
  completed: boolean;
  steps: StepAnalytics[];
  feedback?: { rating: number; comment: string };
}

interface Progress {
  /** tutorialId → completed */
  completed: Record<string, boolean>;
  /** tutorialId → last stepId */
  lastStep: Record<string, string>;
  analytics: TutorialAnalytics[];
  /** How many times the user has visited — drives adaptive behaviour */
  visitCount: number;
}

interface TutorialContextValue {
  activeTutorial: Tutorial | null;
  currentStep: TutorialStep | null;
  stepIndex: number;
  progress: Progress;
  start: (tutorialId: string) => void;
  next: (nextId?: string) => void;
  skip: () => void;
  end: () => void;
  submitFeedback: (rating: number, comment: string) => void;
  isCompleted: (tutorialId: string) => boolean;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'fidelis-tutorial-progress';

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch { /* ignore */ }
  return { completed: {}, lastStep: {}, analytics: [], visitCount: 0 };
}

function saveProgress(p: Progress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [progress, setProgress] = useState<Progress>(() => {
    const p = loadProgress();
    return { ...p, visitCount: p.visitCount + 1 };
  });
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const stepStartRef = useRef<number>(Date.now());
  const analyticsRef = useRef<TutorialAnalytics | null>(null);

  // Persist on every progress change
  useEffect(() => { saveProgress(progress); }, [progress]);

  // Auto-start tutorial for first-time users
  useEffect(() => {
    if (progress.visitCount === 1) {
      const auto = ALL_TUTORIALS.find(t => t.autoStart && !progress.completed[t.id]);
      if (auto) start(auto.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStep = activeTutorial?.steps[stepIndex] ?? null;

  const start = useCallback((tutorialId: string) => {
    const tutorial = ALL_TUTORIALS.find(t => t.id === tutorialId);
    if (!tutorial) return;

    // Adaptive: resume from last step if partially done
    const lastStepId = progress.lastStep[tutorialId];
    const resumeIndex = lastStepId
      ? tutorial.steps.findIndex(s => s.id === lastStepId)
      : -1;
    const startIndex = resumeIndex > 0 ? resumeIndex : 0;

    analyticsRef.current = {
      tutorialId,
      startedAt: Date.now(),
      completed: false,
      steps: [],
    };
    stepStartRef.current = Date.now();
    setActiveTutorial(tutorial);
    setStepIndex(startIndex);
  }, [progress.lastStep]);

  const recordStepAnalytics = useCallback((stepId: string, skipped: boolean) => {
    if (!analyticsRef.current) return;
    analyticsRef.current.steps.push({
      stepId,
      timeSpentMs: Date.now() - stepStartRef.current,
      skipped,
    });
    stepStartRef.current = Date.now();
  }, []);

  const goToStep = useCallback((tutorial: Tutorial, nextId: string | undefined, skipped = false) => {
    if (currentStep) recordStepAnalytics(currentStep.id, skipped);

    if (!nextId || nextId === '__end__') {
      // End tutorial
      if (analyticsRef.current) {
        analyticsRef.current.completed = !skipped;
        analyticsRef.current.completedAt = Date.now();
      }
      setProgress(p => {
        const updated: Progress = {
          ...p,
          completed: { ...p.completed, [tutorial.id]: !skipped },
          lastStep: { ...p.lastStep, [tutorial.id]: currentStep?.id ?? '' },
          analytics: analyticsRef.current
            ? [...p.analytics, analyticsRef.current]
            : p.analytics,
        };
        return updated;
      });
      setActiveTutorial(null);
      return;
    }

    const idx = tutorial.steps.findIndex(s => s.id === nextId);
    if (idx === -1) return;

    setProgress(p => ({
      ...p,
      lastStep: { ...p.lastStep, [tutorial.id]: nextId },
    }));
    setStepIndex(idx);
  }, [currentStep, recordStepAnalytics]);

  const next = useCallback((nextId?: string) => {
    if (!activeTutorial || !currentStep) return;
    const resolvedNext = nextId ?? currentStep.nextId
      ?? activeTutorial.steps[stepIndex + 1]?.id;
    goToStep(activeTutorial, resolvedNext, false);
  }, [activeTutorial, currentStep, stepIndex, goToStep]);

  const skip = useCallback(() => {
    if (!activeTutorial || !currentStep) return;
    goToStep(activeTutorial, '__end__', true);
  }, [activeTutorial, currentStep, goToStep]);

  const end = useCallback(() => skip(), [skip]);

  const submitFeedback = useCallback((rating: number, comment: string) => {
    setProgress(p => {
      const analytics = [...p.analytics];
      const last = analytics[analytics.length - 1];
      if (last) analytics[analytics.length - 1] = { ...last, feedback: { rating, comment } };
      return { ...p, analytics };
    });
  }, []);

  const isCompleted = useCallback(
    (tutorialId: string) => !!progress.completed[tutorialId],
    [progress.completed]
  );

  return (
    <TutorialContext.Provider value={{
      activeTutorial, currentStep, stepIndex, progress,
      start, next, skip, end, submitFeedback, isCompleted,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
