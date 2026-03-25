import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkflowAnalytics, WorkflowState, WorkflowStep, WorkflowValues } from './types';

const STORAGE_KEY = (id: string) => `workflow_state_${id}`;

function buildInitialState(steps: WorkflowStep[]): WorkflowState {
  return {
    currentStep: 0,
    stepStatuses: Object.fromEntries(steps.map((s, i) => [s.id, i === 0 ? 'active' : 'pending'])),
    values: {},
    updatedAt: new Date().toISOString(),
  };
}

export function useWorkflow(
  workflowId: string,
  steps: WorkflowStep[],
  onComplete?: (values: WorkflowValues) => void
) {
  const [state, setState] = useState<WorkflowState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(workflowId));
      if (saved) return JSON.parse(saved) as WorkflowState;
    } catch { /* ignore */ }
    return buildInitialState(steps);
  });

  const analytics = useRef<WorkflowAnalytics>({
    startedAt: new Date().toISOString(),
    stepVisits: {},
    skips: 0,
    backNavigations: 0,
  });

  // Persist state on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY(workflowId), JSON.stringify(state)); }
    catch { /* ignore */ }
  }, [workflowId, state]);

  /** Resolve which steps are visible given current values */
  const visibleSteps = steps.filter(
    (s) => !s.condition || s.condition(state.values)
  );

  const currentStepDef = visibleSteps[state.currentStep] ?? null;

  const patch = useCallback((next: Partial<WorkflowState>) =>
    setState((prev) => ({ ...prev, ...next, updatedAt: new Date().toISOString() })), []);

  const setStepStatus = useCallback((id: string, status: import('./types').StepStatus) =>
    setState((prev) => ({
      ...prev,
      stepStatuses: { ...prev.stepStatuses, [id]: status },
      updatedAt: new Date().toISOString(),
    })), []);

  const goToStep = useCallback((index: number) => {
    const step = visibleSteps[index];
    if (!step) return;
    analytics.current.stepVisits[step.id] = (analytics.current.stepVisits[step.id] ?? 0) + 1;
    setStepStatus(step.id, 'active');
    patch({ currentStep: index });
  }, [visibleSteps, patch, setStepStatus]);

  const saveStepValues = useCallback((stepId: string, values: Record<string, string>) => {
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [stepId]: values },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const next = useCallback((stepValues?: Record<string, string>) => {
    if (!currentStepDef) return;
    if (stepValues) saveStepValues(currentStepDef.id, stepValues);
    setStepStatus(currentStepDef.id, 'completed');

    const nextIndex = state.currentStep + 1;
    if (nextIndex >= visibleSteps.length) {
      analytics.current.completedAt = new Date().toISOString();
      onComplete?.(state.values);
      return;
    }
    goToStep(nextIndex);
  }, [currentStepDef, state, visibleSteps, saveStepValues, setStepStatus, goToStep, onComplete]);

  const back = useCallback(() => {
    if (state.currentStep === 0) return;
    analytics.current.backNavigations += 1;
    goToStep(state.currentStep - 1);
  }, [state.currentStep, goToStep]);

  const skip = useCallback(() => {
    if (!currentStepDef?.optional) return;
    analytics.current.skips += 1;
    setStepStatus(currentStepDef.id, 'skipped');
    const nextIndex = state.currentStep + 1;
    if (nextIndex < visibleSteps.length) goToStep(nextIndex);
  }, [currentStepDef, state.currentStep, visibleSteps, setStepStatus, goToStep]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY(workflowId));
    setState(buildInitialState(steps));
    analytics.current = { startedAt: new Date().toISOString(), stepVisits: {}, skips: 0, backNavigations: 0 };
  }, [workflowId, steps]);

  return {
    state,
    visibleSteps,
    currentStepDef,
    next,
    back,
    skip,
    reset,
    goToStep,
    saveStepValues,
    analytics: analytics.current,
    isFirst: state.currentStep === 0,
    isLast: state.currentStep === visibleSteps.length - 1,
  };
}
