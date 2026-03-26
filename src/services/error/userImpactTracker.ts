/**
 * User Impact Tracker
 * Tracks how many users/sessions are affected by errors and resolution status
 */

import type { ErrorInfo } from './errorHandler';

export interface ImpactRecord {
  errorKey: string; // category:message fingerprint
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
  affectedSessions: number;
  resolved: boolean;
  resolvedAt?: number;
  resolution?: string;
}

export interface UserFeedback {
  id: string;
  errorId: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  sessionId: string;
}

export class UserImpactTracker {
  private records: Map<string, ImpactRecord> = new Map();
  private feedback: UserFeedback[] = [];
  private sessionId: string;
  private affectedSessions: Set<string> = new Set();

  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  record(error: ErrorInfo): void {
    const key = `${error.category}:${error.message.slice(0, 80)}`;
    const existing = this.records.get(key);

    if (existing) {
      existing.lastSeen = error.timestamp;
      existing.occurrences++;
      if (!this.affectedSessions.has(this.sessionId)) {
        existing.affectedSessions++;
        this.affectedSessions.add(this.sessionId);
      }
    } else {
      this.affectedSessions.add(this.sessionId);
      this.records.set(key, {
        errorKey: key,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        occurrences: 1,
        affectedSessions: 1,
        resolved: false,
      });
    }
  }

  submitFeedback(errorId: string, description: string, severity: UserFeedback['severity']): UserFeedback {
    const fb: UserFeedback = {
      id: `fb-${Date.now()}`,
      errorId,
      description,
      severity,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };
    this.feedback.push(fb);
    return fb;
  }

  resolve(errorKey: string, resolution: string): void {
    const record = this.records.get(errorKey);
    if (record) {
      record.resolved = true;
      record.resolvedAt = Date.now();
      record.resolution = resolution;
    }
  }

  getTopImpact(limit = 5): ImpactRecord[] {
    return [...this.records.values()]
      .filter(r => !r.resolved)
      .sort((a, b) => (b.affectedSessions * b.occurrences) - (a.affectedSessions * a.occurrences))
      .slice(0, limit);
  }

  getAll(includeResolved = false): ImpactRecord[] {
    const all = [...this.records.values()];
    return includeResolved ? all : all.filter(r => !r.resolved);
  }

  getFeedback(): UserFeedback[] {
    return [...this.feedback];
  }

  getTotalAffectedSessions(): number {
    return this.affectedSessions.size;
  }

  clear(): void {
    this.records.clear();
    this.feedback = [];
    this.affectedSessions.clear();
  }
}

export const userImpactTracker = new UserImpactTracker();
export default userImpactTracker;
