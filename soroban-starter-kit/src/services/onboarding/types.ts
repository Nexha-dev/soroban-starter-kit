export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type StepKind = 'reading' | 'interactive' | 'quiz' | 'code';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LearningStep {
  id: string;
  title: string;
  description: string;
  kind: StepKind;
  estimatedMinutes: number;
  codeExample?: string;
  quiz?: QuizQuestion[];
  communityLink?: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  level: SkillLevel;
  tags: string[];
  steps: LearningStep[];
}

export interface DeveloperProfile {
  id: string;
  name: string;
  level: SkillLevel;
  interests: string[];
  /** pathId → set of completed stepIds */
  completedSteps: Record<string, string[]>;
  /** pathId → score 0-100 */
  assessmentScores: Record<string, number>;
  joinedAt: number;
}

export interface StepEvent {
  profileId: string;
  pathId: string;
  stepId: string;
  action: 'start' | 'complete' | 'skip';
  durationMs: number;
  timestamp: number;
}

export interface OnboardingAnalyticsSummary {
  pathId: string;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
  avgDurationMs: number;
}

export interface FeedbackEntry {
  profileId: string;
  pathId: string;
  rating: number; // 1-5
  comment?: string;
  timestamp: number;
}
