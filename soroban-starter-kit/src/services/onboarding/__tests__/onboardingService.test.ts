import { describe, it, expect, beforeEach } from 'vitest';
import {
  OnboardingProfileManager,
  OnboardingAnalytics,
  LEARNING_PATHS,
  COMMUNITY_RESOURCES,
  gradeQuiz,
  getCommunityLinksForStep,
} from '../onboardingService';
import type { LearningStep, StepEvent } from '../types';

function makeManagers() {
  return {
    profiles: new OnboardingProfileManager(),
    analytics: new OnboardingAnalytics(),
  };
}

// ─── Learning paths ───────────────────────────────────────────────────────────

describe('LEARNING_PATHS', () => {
  it('includes beginner, intermediate paths', () => {
    const levels = new Set(LEARNING_PATHS.map(p => p.level));
    expect(levels).toContain('beginner');
    expect(levels).toContain('intermediate');
  });

  it('every path has at least one step', () => {
    expect(LEARNING_PATHS.every(p => p.steps.length > 0)).toBe(true);
  });

  it('every step has id, title, kind, and estimatedMinutes', () => {
    for (const path of LEARNING_PATHS) {
      for (const step of path.steps) {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.kind).toBeTruthy();
        expect(step.estimatedMinutes).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Profile manager ──────────────────────────────────────────────────────────

describe('OnboardingProfileManager', () => {
  let profiles: OnboardingProfileManager;

  beforeEach(() => { profiles = makeManagers().profiles; });

  it('creates a profile', () => {
    const p = profiles.create('u1', 'Alice', 'beginner', ['soroban']);
    expect(p.id).toBe('u1');
    expect(p.level).toBe('beginner');
    expect(p.interests).toContain('soroban');
  });

  it('throws on duplicate id', () => {
    profiles.create('u1', 'Alice', 'beginner');
    expect(() => profiles.create('u1', 'Bob', 'beginner')).toThrow('already exists');
  });

  it('retrieves a profile', () => {
    profiles.create('u2', 'Bob', 'intermediate');
    expect(profiles.get('u2')?.name).toBe('Bob');
  });

  it('returns undefined for unknown profile', () => {
    expect(profiles.get('ghost')).toBeUndefined();
  });

  it('updates level and interests', () => {
    profiles.create('u3', 'Carol', 'beginner');
    profiles.update('u3', { level: 'intermediate', interests: ['defi'] });
    expect(profiles.get('u3')?.level).toBe('intermediate');
    expect(profiles.get('u3')?.interests).toContain('defi');
  });

  it('marks a step complete', () => {
    profiles.create('u4', 'Dave', 'beginner');
    profiles.completeStep('u4', 'soroban-basics', 'what-is-soroban');
    expect(profiles.get('u4')?.completedSteps['soroban-basics']).toContain('what-is-soroban');
  });

  it('does not duplicate completed steps', () => {
    profiles.create('u5', 'Eve', 'beginner');
    profiles.completeStep('u5', 'soroban-basics', 'setup-env');
    profiles.completeStep('u5', 'soroban-basics', 'setup-env');
    expect(profiles.get('u5')?.completedSteps['soroban-basics']).toHaveLength(1);
  });

  it('records assessment score clamped to 0-100', () => {
    profiles.create('u6', 'Frank', 'beginner');
    profiles.recordScore('u6', 'soroban-basics', 150);
    expect(profiles.get('u6')?.assessmentScores['soroban-basics']).toBe(100);
    profiles.recordScore('u6', 'soroban-basics', -10);
    expect(profiles.get('u6')?.assessmentScores['soroban-basics']).toBe(0);
  });

  it('calculates progress percentage', () => {
    profiles.create('u7', 'Grace', 'beginner');
    const path = LEARNING_PATHS.find(p => p.id === 'soroban-basics')!;
    profiles.completeStep('u7', 'soroban-basics', path.steps[0].id);
    const progress = profiles.getProgress('u7', 'soroban-basics');
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(100);
  });

  it('returns 0 progress for unknown path', () => {
    profiles.create('u8', 'Hank', 'beginner');
    expect(profiles.getProgress('u8', 'nonexistent')).toBe(0);
  });

  it('recommends paths matching level and interests', () => {
    profiles.create('u9', 'Ivy', 'beginner', ['soroban']);
    const recs = profiles.recommend('u9');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(p => p.id === 'soroban-basics')).toBe(true);
  });

  it('excludes fully completed paths from recommendations', () => {
    profiles.create('u10', 'Jack', 'beginner');
    const path = LEARNING_PATHS.find(p => p.id === 'soroban-basics')!;
    for (const step of path.steps) {
      profiles.completeStep('u10', 'soroban-basics', step.id);
    }
    const recs = profiles.recommend('u10');
    expect(recs.some(p => p.id === 'soroban-basics')).toBe(false);
  });

  it('throws on operations for unknown profile', () => {
    expect(() => profiles.completeStep('ghost', 'path', 'step')).toThrow('not found');
    expect(() => profiles.getProgress('ghost', 'path')).toThrow('not found');
    expect(() => profiles.recommend('ghost')).toThrow('not found');
  });
});

// ─── Quiz engine ──────────────────────────────────────────────────────────────

describe('gradeQuiz', () => {
  const quizStep: LearningStep = {
    id: 'q1',
    title: 'Quiz',
    description: '',
    kind: 'quiz',
    estimatedMinutes: 5,
    quiz: [
      { question: 'Q1', options: ['A', 'B', 'C'], correctIndex: 1 },
      { question: 'Q2', options: ['X', 'Y', 'Z'], correctIndex: 2 },
    ],
  };

  it('returns 100 for all correct answers', () => {
    expect(gradeQuiz(quizStep, [1, 2])).toBe(100);
  });

  it('returns 50 for half correct', () => {
    expect(gradeQuiz(quizStep, [1, 0])).toBe(50);
  });

  it('returns 0 for all wrong', () => {
    expect(gradeQuiz(quizStep, [0, 0])).toBe(0);
  });

  it('returns 100 for step with no quiz', () => {
    const noQuiz: LearningStep = { ...quizStep, quiz: undefined };
    expect(gradeQuiz(noQuiz, [])).toBe(100);
  });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

describe('OnboardingAnalytics', () => {
  let analytics: OnboardingAnalytics;

  beforeEach(() => { analytics = makeManagers().analytics; });

  const makeEvent = (profileId: string, action: StepEvent['action'], durationMs = 1000): StepEvent => ({
    profileId,
    pathId: 'soroban-basics',
    stepId: 'what-is-soroban',
    action,
    durationMs,
    timestamp: Date.now(),
  });

  it('calculates completion rate', () => {
    analytics.record(makeEvent('u1', 'start'));
    analytics.record(makeEvent('u2', 'start'));
    analytics.record(makeEvent('u1', 'complete', 5000));
    const s = analytics.getSummary('soroban-basics');
    expect(s.totalStarts).toBe(2);
    expect(s.totalCompletions).toBe(1);
    expect(s.completionRate).toBe(50);
  });

  it('calculates average duration', () => {
    analytics.record(makeEvent('u1', 'complete', 4000));
    analytics.record(makeEvent('u2', 'complete', 6000));
    expect(analytics.getSummary('soroban-basics').avgDurationMs).toBe(5000);
  });

  it('returns 0 completion rate with no starts', () => {
    expect(analytics.getSummary('empty-path').completionRate).toBe(0);
  });

  it('accepts valid feedback', () => {
    analytics.submitFeedback({ profileId: 'u1', pathId: 'soroban-basics', rating: 5, timestamp: Date.now() });
    expect(analytics.getAvgRating('soroban-basics')).toBe(5);
  });

  it('rejects out-of-range rating', () => {
    expect(() => analytics.submitFeedback({ profileId: 'u1', pathId: 'p', rating: 6, timestamp: Date.now() })).toThrow('Rating');
    expect(() => analytics.submitFeedback({ profileId: 'u1', pathId: 'p', rating: 0, timestamp: Date.now() })).toThrow('Rating');
  });

  it('averages multiple ratings', () => {
    analytics.submitFeedback({ profileId: 'u1', pathId: 'soroban-basics', rating: 4, timestamp: Date.now() });
    analytics.submitFeedback({ profileId: 'u2', pathId: 'soroban-basics', rating: 2, timestamp: Date.now() });
    expect(analytics.getAvgRating('soroban-basics')).toBe(3);
  });

  it('returns 0 avg rating with no feedback', () => {
    expect(analytics.getAvgRating('no-feedback')).toBe(0);
  });

  it('identifies drop-off steps', () => {
    analytics.record({ ...makeEvent('u1', 'skip'), stepId: 'setup-env' });
    analytics.record({ ...makeEvent('u2', 'skip'), stepId: 'setup-env' });
    analytics.record({ ...makeEvent('u3', 'skip'), stepId: 'first-contract' });
    const dropOff = analytics.getDropOffSteps('soroban-basics');
    expect(dropOff[0].stepId).toBe('setup-env');
    expect(dropOff[0].skips).toBe(2);
  });
});

// ─── Community ───────────────────────────────────────────────────────────────

describe('COMMUNITY_RESOURCES', () => {
  it('includes discord, forum, github, and docs', () => {
    const ids = COMMUNITY_RESOURCES.map(r => r.id);
    expect(ids).toContain('discord');
    expect(ids).toContain('github');
    expect(ids).toContain('docs');
  });
});

describe('getCommunityLinksForStep', () => {
  it('prepends step-specific link when present', () => {
    const step: LearningStep = {
      id: 's1', title: 'T', description: '', kind: 'reading',
      estimatedMinutes: 5, communityLink: 'https://example.com',
    };
    const links = getCommunityLinksForStep(step);
    expect(links[0].id).toBe('step-link');
    expect(links[0].url).toBe('https://example.com');
  });

  it('returns base resources when no step link', () => {
    const step: LearningStep = { id: 's2', title: 'T', description: '', kind: 'reading', estimatedMinutes: 5 };
    const links = getCommunityLinksForStep(step);
    expect(links).toHaveLength(COMMUNITY_RESOURCES.length);
  });
});
