import type {
  LearningPath,
  LearningStep,
  DeveloperProfile,
  SkillLevel,
  StepEvent,
  OnboardingAnalyticsSummary,
  FeedbackEntry,
} from './types';

// ─── Built-in learning paths ──────────────────────────────────────────────────

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'soroban-basics',
    title: 'Soroban Basics',
    description: 'Get started with Soroban smart contracts on Stellar.',
    level: 'beginner',
    tags: ['soroban', 'stellar', 'smart-contracts'],
    steps: [
      {
        id: 'what-is-soroban',
        title: 'What is Soroban?',
        description: 'Overview of Soroban and the Stellar ecosystem.',
        kind: 'reading',
        estimatedMinutes: 5,
        communityLink: 'https://discord.gg/stellardev',
      },
      {
        id: 'setup-env',
        title: 'Set Up Your Environment',
        description: 'Install Rust, Soroban CLI, and configure your workspace.',
        kind: 'interactive',
        estimatedMinutes: 15,
        codeExample: 'cargo install --locked soroban-cli',
      },
      {
        id: 'first-contract',
        title: 'Write Your First Contract',
        description: 'Build and deploy a simple Hello World contract.',
        kind: 'code',
        estimatedMinutes: 20,
        codeExample: `#[contract]\npub struct HelloContract;\n\n#[contractimpl]\nimpl HelloContract {\n  pub fn hello(env: Env, name: String) -> String {\n    format!("Hello, {}!", name)\n  }\n}`,
      },
      {
        id: 'basics-quiz',
        title: 'Knowledge Check',
        description: 'Test your understanding of Soroban basics.',
        kind: 'quiz',
        estimatedMinutes: 5,
        quiz: [
          {
            question: 'Which language is used to write Soroban contracts?',
            options: ['JavaScript', 'Rust', 'Python', 'Go'],
            correctIndex: 1,
          },
          {
            question: 'What CLI tool is used to deploy Soroban contracts?',
            options: ['stellar-cli', 'soroban-cli', 'cargo-deploy', 'anchor'],
            correctIndex: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'token-contract',
    title: 'Build a Token Contract',
    description: 'Implement a fungible token with mint, burn, and transfer.',
    level: 'intermediate',
    tags: ['token', 'defi', 'soroban'],
    steps: [
      {
        id: 'token-interface',
        title: 'Token Interface',
        description: 'Understand the Soroban token standard.',
        kind: 'reading',
        estimatedMinutes: 10,
      },
      {
        id: 'implement-transfer',
        title: 'Implement Transfer',
        description: 'Write the transfer function with authorization.',
        kind: 'code',
        estimatedMinutes: 25,
        codeExample: `pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {\n  from.require_auth();\n  // debit from, credit to\n}`,
      },
      {
        id: 'token-quiz',
        title: 'Token Knowledge Check',
        description: 'Verify your token contract knowledge.',
        kind: 'quiz',
        estimatedMinutes: 5,
        quiz: [
          {
            question: 'What does require_auth() do?',
            options: ['Mints tokens', 'Verifies the caller signed the transaction', 'Checks balance', 'Emits an event'],
            correctIndex: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'frontend-integration',
    title: 'Frontend Integration',
    description: 'Connect your React app to Soroban contracts.',
    level: 'intermediate',
    tags: ['frontend', 'react', 'stellar-sdk'],
    steps: [
      {
        id: 'stellar-sdk-setup',
        title: 'Install Stellar SDK',
        description: 'Add @stellar/stellar-sdk to your project.',
        kind: 'interactive',
        estimatedMinutes: 5,
        codeExample: 'npm install @stellar/stellar-sdk',
      },
      {
        id: 'invoke-contract',
        title: 'Invoke a Contract',
        description: 'Call a contract function from the browser.',
        kind: 'code',
        estimatedMinutes: 20,
        codeExample: `const result = await contractService.invoke(contractId, 'transfer', [from, to, amount]);`,
      },
    ],
  },
];

// ─── Profile Manager ──────────────────────────────────────────────────────────

export class OnboardingProfileManager {
  private profiles = new Map<string, DeveloperProfile>();

  create(id: string, name: string, level: SkillLevel, interests: string[] = []): DeveloperProfile {
    if (this.profiles.has(id)) throw new Error(`Profile "${id}" already exists`);
    const profile: DeveloperProfile = {
      id, name, level, interests,
      completedSteps: {},
      assessmentScores: {},
      joinedAt: Date.now(),
    };
    this.profiles.set(id, profile);
    return profile;
  }

  get(id: string): DeveloperProfile | undefined {
    return this.profiles.get(id);
  }

  update(id: string, updates: Partial<Pick<DeveloperProfile, 'level' | 'interests'>>): void {
    const p = this.getOrThrow(id);
    Object.assign(p, updates);
  }

  /** Mark a step complete for a profile */
  completeStep(profileId: string, pathId: string, stepId: string): void {
    const p = this.getOrThrow(profileId);
    if (!p.completedSteps[pathId]) p.completedSteps[pathId] = [];
    if (!p.completedSteps[pathId].includes(stepId)) {
      p.completedSteps[pathId].push(stepId);
    }
  }

  /** Record a quiz/assessment score */
  recordScore(profileId: string, pathId: string, score: number): void {
    this.getOrThrow(profileId).assessmentScores[pathId] = Math.max(0, Math.min(100, score));
  }

  /** 0-100 completion percentage for a path */
  getProgress(profileId: string, pathId: string): number {
    const p = this.getOrThrow(profileId);
    const path = LEARNING_PATHS.find(lp => lp.id === pathId);
    if (!path || path.steps.length === 0) return 0;
    const done = (p.completedSteps[pathId] ?? []).length;
    return Math.round((done / path.steps.length) * 100);
  }

  /** Recommend paths based on level and interests */
  recommend(profileId: string): LearningPath[] {
    const p = this.getOrThrow(profileId);
    const levelOrder: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
    const profileLevelIdx = levelOrder.indexOf(p.level);

    return LEARNING_PATHS.filter(path => {
      const pathLevelIdx = levelOrder.indexOf(path.level);
      const notCompleted = this.getProgress(profileId, path.id) < 100;
      const levelMatch = pathLevelIdx <= profileLevelIdx + 1;
      const interestMatch =
        p.interests.length === 0 ||
        path.tags.some(t => p.interests.includes(t));
      return notCompleted && levelMatch && interestMatch;
    });
  }

  private getOrThrow(id: string): DeveloperProfile {
    const p = this.profiles.get(id);
    if (!p) throw new Error(`Profile "${id}" not found`);
    return p;
  }
}

// ─── Quiz Engine ──────────────────────────────────────────────────────────────

export function gradeQuiz(step: LearningStep, answers: number[]): number {
  if (!step.quiz || step.quiz.length === 0) return 100;
  const correct = step.quiz.filter((q, i) => q.correctIndex === answers[i]).length;
  return Math.round((correct / step.quiz.length) * 100);
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export class OnboardingAnalytics {
  private events: StepEvent[] = [];
  private feedback: FeedbackEntry[] = [];

  record(event: StepEvent): void {
    this.events.push(event);
  }

  submitFeedback(entry: FeedbackEntry): void {
    if (entry.rating < 1 || entry.rating > 5) throw new Error('Rating must be 1-5');
    this.feedback.push(entry);
  }

  getSummary(pathId: string): OnboardingAnalyticsSummary {
    const pathEvents = this.events.filter(e => e.pathId === pathId);
    const starts = new Set(pathEvents.filter(e => e.action === 'start').map(e => e.profileId)).size;
    const completions = new Set(pathEvents.filter(e => e.action === 'complete').map(e => e.profileId)).size;
    const durations = pathEvents.filter(e => e.action === 'complete').map(e => e.durationMs);
    const avgDurationMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      pathId,
      totalStarts: starts,
      totalCompletions: completions,
      completionRate: starts > 0 ? Math.round((completions / starts) * 100) : 0,
      avgDurationMs,
    };
  }

  getFeedbackForPath(pathId: string): FeedbackEntry[] {
    return this.feedback.filter(f => f.pathId === pathId);
  }

  getAvgRating(pathId: string): number {
    const entries = this.getFeedbackForPath(pathId);
    if (entries.length === 0) return 0;
    return entries.reduce((sum, e) => sum + e.rating, 0) / entries.length;
  }

  getDropOffSteps(pathId: string): { stepId: string; skips: number }[] {
    const skips = new Map<string, number>();
    for (const e of this.events.filter(ev => ev.pathId === pathId && ev.action === 'skip')) {
      skips.set(e.stepId, (skips.get(e.stepId) ?? 0) + 1);
    }
    return [...skips.entries()]
      .map(([stepId, skips]) => ({ stepId, skips }))
      .sort((a, b) => b.skips - a.skips);
  }
}

// ─── Community ───────────────────────────────────────────────────────────────

export const COMMUNITY_RESOURCES = [
  { id: 'discord', label: 'Stellar Developer Discord', url: 'https://discord.gg/stellardev' },
  { id: 'forum', label: 'Stellar Community Forum', url: 'https://community.stellar.org' },
  { id: 'github', label: 'Soroban Examples', url: 'https://github.com/stellar/soroban-examples' },
  { id: 'docs', label: 'Soroban Documentation', url: 'https://soroban.stellar.org/docs' },
];

export function getCommunityLinksForStep(step: LearningStep): typeof COMMUNITY_RESOURCES {
  const links = [...COMMUNITY_RESOURCES];
  if (step.communityLink) {
    links.unshift({ id: 'step-link', label: 'Step Resource', url: step.communityLink });
  }
  return links;
}

// ─── Singletons ───────────────────────────────────────────────────────────────

export const onboardingProfiles = new OnboardingProfileManager();
export const onboardingAnalytics = new OnboardingAnalytics();
