import type { FormConfig } from '../validation/useFormValidation';

export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'error';

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  tooltip?: string;
  /** Field config passed to useFormValidation */
  fields?: FormConfig;
  /** If false, step is hidden/skipped based on prior values */
  condition?: (values: WorkflowValues) => boolean;
  /** If true, user may skip this step */
  optional?: boolean;
}

export type WorkflowValues = Record<string, Record<string, string>>;

export interface WorkflowState {
  currentStep: number;
  stepStatuses: Record<string, StepStatus>;
  values: WorkflowValues;
  /** ISO timestamp of last update — used for persistence */
  updatedAt: string;
}

export interface WorkflowAnalytics {
  startedAt: string;
  completedAt?: string;
  stepVisits: Record<string, number>;
  skips: number;
  backNavigations: number;
}

export interface WorkflowTemplate {
  id: string;
  label: string;
  steps: WorkflowStep[];
  /** Pre-filled default values */
  defaults?: WorkflowValues;
}
