// Troubleshooting & Debugging Guide Service

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory = 'wallet' | 'contract' | 'network' | 'transaction' | 'build' | 'deployment' | 'other';

export interface TroubleshootingIssue {
  id: string;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
  symptoms: string[];
  causes: string[];
  solutions: Solution[];
  diagnosticSteps: string[];
  relatedIssueIds: string[];
  tags: string[];
  expertTips?: string[];
}

export interface Solution {
  id: string;
  description: string;
  steps: string[];
  codeExample?: string;
  effectivenessScore: number; // 0-100, updated from feedback
  feedbackCount: number;
}

export interface UserFeedback {
  issueId: string;
  solutionId: string;
  helpful: boolean;
  comment?: string;
  timestamp: number;
}

export interface DiagnosticResult {
  issueId: string;
  confidence: number; // 0-100
  matchedSymptoms: string[];
}

const FEEDBACK_KEY = 'troubleshooting_feedback';

// Built-in Soroban-specific issues
export const SOROBAN_ISSUES: TroubleshootingIssue[] = [
  {
    id: 'wallet-not-connected',
    title: 'Wallet Not Connecting',
    category: 'wallet',
    severity: 'high',
    symptoms: ['wallet button shows disconnected', 'no public key available', 'Freighter not responding'],
    causes: ['Freighter extension not installed', 'Wrong network selected', 'Browser permissions denied'],
    solutions: [
      {
        id: 'install-freighter',
        description: 'Install or update Freighter wallet extension',
        steps: ['Visit https://freighter.app', 'Install the browser extension', 'Create or import a wallet', 'Ensure Testnet is selected in Freighter settings'],
        effectivenessScore: 90,
        feedbackCount: 0,
      },
      {
        id: 'check-network',
        description: 'Switch Freighter to the correct network',
        steps: ['Open Freighter extension', 'Click the network selector', 'Choose Testnet for development or Mainnet for production'],
        effectivenessScore: 85,
        feedbackCount: 0,
      },
    ],
    diagnosticSteps: ['Check if Freighter is installed', 'Verify network matches app config', 'Check browser console for errors'],
    relatedIssueIds: ['wrong-network'],
    tags: ['wallet', 'freighter', 'connection'],
    expertTips: ['Always test on Testnet before Mainnet', 'Use window.freighter?.isConnected() to check state programmatically'],
  },
  {
    id: 'contract-invoke-failed',
    title: 'Contract Invocation Failed',
    category: 'contract',
    severity: 'high',
    symptoms: ['transaction rejected', 'contract error returned', 'simulation failed'],
    causes: ['Insufficient XLM balance', 'Wrong contract ID', 'Invalid function arguments', 'Contract not deployed'],
    solutions: [
      {
        id: 'check-balance',
        description: 'Ensure account has sufficient XLM for fees',
        steps: ['Check account balance on Stellar Laboratory', 'Fund testnet account via Friendbot: https://friendbot.stellar.org', 'Ensure minimum 1 XLM reserve'],
        effectivenessScore: 80,
        feedbackCount: 0,
      },
      {
        id: 'verify-contract-id',
        description: 'Verify the contract ID is correct',
        steps: ['Check .env file for CONTRACT_ID', 'Confirm contract is deployed on the correct network', 'Re-deploy if necessary using: soroban contract deploy'],
        codeExample: 'soroban contract deploy --wasm target/wasm32-unknown-unknown/release/contract.wasm --network testnet',
        effectivenessScore: 88,
        feedbackCount: 0,
      },
    ],
    diagnosticSteps: ['Run soroban contract invoke with --dry-run flag', 'Check simulation response for error codes', 'Verify contract ABI matches invocation'],
    relatedIssueIds: ['build-failed'],
    tags: ['contract', 'invoke', 'transaction'],
    expertTips: ['Use soroban contract invoke --dry-run to simulate before submitting', 'Check Stellar Expert for contract state'],
  },
  {
    id: 'build-failed',
    title: 'Contract Build Failed',
    category: 'build',
    severity: 'medium',
    symptoms: ['cargo build error', 'wasm compilation failed', 'missing dependencies'],
    causes: ['Outdated Rust toolchain', 'Missing wasm32 target', 'Dependency version conflicts'],
    solutions: [
      {
        id: 'update-rust',
        description: 'Update Rust and add wasm32 target',
        steps: ['Run: rustup update', 'Run: rustup target add wasm32-unknown-unknown', 'Run: cargo update'],
        codeExample: 'rustup update && rustup target add wasm32-unknown-unknown',
        effectivenessScore: 92,
        feedbackCount: 0,
      },
    ],
    diagnosticSteps: ['Run cargo check first', 'Check rustc --version matches Cargo.toml requirements', 'Run cargo tree to inspect dependency conflicts'],
    relatedIssueIds: ['contract-invoke-failed'],
    tags: ['build', 'rust', 'wasm'],
    expertTips: ['Pin soroban-sdk version in Cargo.toml to avoid breaking changes'],
  },
  {
    id: 'transaction-timeout',
    title: 'Transaction Timeout',
    category: 'transaction',
    severity: 'medium',
    symptoms: ['transaction pending too long', 'no confirmation received', 'timeout error'],
    causes: ['Network congestion', 'Low fee', 'Horizon node issues'],
    solutions: [
      {
        id: 'retry-transaction',
        description: 'Retry with higher fee or wait for network',
        steps: ['Check Stellar network status at https://status.stellar.org', 'Increase base fee in transaction builder', 'Resubmit transaction'],
        effectivenessScore: 75,
        feedbackCount: 0,
      },
    ],
    diagnosticSteps: ['Check transaction hash on Stellar Expert', 'Verify Horizon endpoint is reachable', 'Check network status page'],
    relatedIssueIds: [],
    tags: ['transaction', 'network', 'timeout'],
  },
];

function loadFeedback(): UserFeedback[] {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFeedback(data: UserFeedback[]): void {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(data));
}

export function submitFeedback(feedback: Omit<UserFeedback, 'timestamp'>): void {
  const all = loadFeedback();
  all.push({ ...feedback, timestamp: Date.now() });
  saveFeedback(all);

  // Update solution effectiveness score in memory (runtime only)
  const issue = SOROBAN_ISSUES.find(i => i.id === feedback.issueId);
  if (issue) {
    const solution = issue.solutions.find(s => s.id === feedback.solutionId);
    if (solution) {
      const total = solution.feedbackCount + 1;
      const helpful = feedback.helpful ? 1 : 0;
      solution.effectivenessScore = Math.round(
        (solution.effectivenessScore * solution.feedbackCount + helpful * 100) / total
      );
      solution.feedbackCount = total;
    }
  }
}

export function diagnoseFromSymptoms(symptoms: string[]): DiagnosticResult[] {
  const lower = symptoms.map(s => s.toLowerCase());
  return SOROBAN_ISSUES
    .map(issue => {
      const matched = issue.symptoms.filter(s => lower.some(l => s.toLowerCase().includes(l) || l.includes(s.toLowerCase())));
      return { issueId: issue.id, confidence: Math.round((matched.length / issue.symptoms.length) * 100), matchedSymptoms: matched };
    })
    .filter(r => r.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

export function searchIssues(query: string, category?: IssueCategory): TroubleshootingIssue[] {
  const q = query.toLowerCase();
  return SOROBAN_ISSUES.filter(issue => {
    if (category && issue.category !== category) return false;
    return (
      issue.title.toLowerCase().includes(q) ||
      issue.symptoms.some(s => s.toLowerCase().includes(q)) ||
      issue.tags.some(t => t.toLowerCase().includes(q))
    );
  });
}

export function getIssueById(id: string): TroubleshootingIssue | undefined {
  return SOROBAN_ISSUES.find(i => i.id === id);
}

export function getIssuesByCategory(category: IssueCategory): TroubleshootingIssue[] {
  return SOROBAN_ISSUES.filter(i => i.category === category);
}

export function getSolutionEffectiveness(issueId: string): Record<string, number> {
  const issue = SOROBAN_ISSUES.find(i => i.id === issueId);
  if (!issue) return {};
  return Object.fromEntries(issue.solutions.map(s => [s.id, s.effectivenessScore]));
}
