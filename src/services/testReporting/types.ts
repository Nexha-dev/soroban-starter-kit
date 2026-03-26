export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

export interface TestResult {
  id: string;
  name: string;
  suite: string;
  status: TestStatus;
  duration: number; // ms
  timestamp: number;
  error?: string;
  coverageLines?: number;
  coverageBranches?: number;
}

export interface TestRun {
  id: string;
  timestamp: number;
  branch?: string;
  commit?: string;
  author?: string;
  results: TestResult[];
  totalDuration: number;
  coveragePercent: number;
}

export interface QualityGate {
  name: string;
  threshold: number;
  actual: number;
  passed: boolean;
}

export interface TestAnalytics {
  passRate: number;
  avgDuration: number;
  flakyTests: string[];
  slowTests: string[];
  coverageTrend: number[];
  qualityGates: QualityGate[];
  roi: {
    bugsPreventedEstimate: number;
    timeSavedMs: number;
    coverageValue: number;
  };
}
