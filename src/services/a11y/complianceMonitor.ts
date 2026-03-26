/**
 * Compliance Monitor
 * Tracks accessibility compliance over time and provides analytics
 */

import type { A11yAuditReport } from './accessibilityAuditor';

export interface ComplianceSnapshot {
  timestamp: number;
  score: number;
  errors: number;
  warnings: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface ComplianceTrend {
  direction: 'improving' | 'degrading' | 'stable';
  delta: number; // score change vs previous snapshot
  snapshots: ComplianceSnapshot[];
}

export interface IssueRecord {
  code: string;
  message: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
  resolved: boolean;
}

class ComplianceMonitor {
  private snapshots: ComplianceSnapshot[] = [];
  private issueRegistry: Map<string, IssueRecord> = new Map();
  private maxSnapshots = 200;

  /**
   * Record an audit report into the compliance history
   */
  record(report: A11yAuditReport): void {
    const snapshot: ComplianceSnapshot = {
      timestamp: report.timestamp,
      score: report.score,
      errors: report.errors,
      warnings: report.warnings,
      wcagLevel: report.wcagLevel,
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();

    // Track individual issues
    for (const issue of report.issues) {
      const existing = this.issueRegistry.get(issue.code);
      if (existing) {
        existing.lastSeen = report.timestamp;
        existing.occurrences++;
        existing.resolved = false;
      } else {
        this.issueRegistry.set(issue.code, {
          code: issue.code,
          message: issue.message,
          wcagLevel: issue.wcagLevel,
          firstSeen: report.timestamp,
          lastSeen: report.timestamp,
          occurrences: 1,
          resolved: false,
        });
      }
    }

    // Mark issues not seen in this audit as resolved
    const activeCodes = new Set(report.issues.map(i => i.code));
    for (const [code, record] of this.issueRegistry) {
      if (!activeCodes.has(code)) record.resolved = true;
    }
  }

  /**
   * Get compliance trend
   */
  getTrend(windowSize = 10): ComplianceTrend {
    const recent = this.snapshots.slice(-windowSize);
    if (recent.length < 2) {
      return { direction: 'stable', delta: 0, snapshots: recent };
    }

    const first = recent[0].score;
    const last = recent[recent.length - 1].score;
    const delta = last - first;

    const direction = Math.abs(delta) < 2 ? 'stable' : delta > 0 ? 'improving' : 'degrading';
    return { direction, delta: Math.round(delta * 10) / 10, snapshots: recent };
  }

  /**
   * Get average compliance score
   */
  getAverageScore(windowSize = 20): number {
    const recent = this.snapshots.slice(-windowSize);
    if (recent.length === 0) return 100;
    return Math.round(recent.reduce((s, r) => s + r.score, 0) / recent.length);
  }

  /**
   * Get all tracked issues
   */
  getIssues(includeResolved = false): IssueRecord[] {
    const all = Array.from(this.issueRegistry.values());
    return includeResolved ? all : all.filter(i => !i.resolved);
  }

  /**
   * Get top recurring issues
   */
  getTopIssues(limit = 5): IssueRecord[] {
    return this.getIssues()
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  getSnapshots(): ComplianceSnapshot[] {
    return [...this.snapshots];
  }

  clear(): void {
    this.snapshots = [];
    this.issueRegistry.clear();
  }
}

export const complianceMonitor = new ComplianceMonitor();
export default complianceMonitor;
