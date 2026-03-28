/**
 * Guide feedback service — collects user ratings and comments on
 * integration/deployment guides and feeds them into docsAnalytics.
 */

import { docsAnalytics } from '../docs/docsAnalytics';

export interface GuideFeedback {
  guideId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  section?: string; // e.g. "Troubleshooting", "Security Considerations"
  timestamp: number;
}

class GuideFeedbackService {
  private feedback: GuideFeedback[] = [];

  submit(guideId: string, rating: GuideFeedback['rating'], comment?: string, section?: string): void {
    const entry: GuideFeedback = { guideId, rating, comment, section, timestamp: Date.now() };
    this.feedback.push(entry);
    // Forward to central analytics so ROI / recommendations pick it up
    docsAnalytics.trackSatisfaction(guideId, rating, comment);
    docsAnalytics.track(guideId, 'feedback', { helpful: rating >= 4, section });
  }

  getForGuide(guideId: string): GuideFeedback[] {
    return this.feedback.filter(f => f.guideId === guideId);
  }

  getSummary(guideId: string): { avgRating: number; count: number; recentComments: string[] } {
    const entries = this.getForGuide(guideId);
    if (!entries.length) return { avgRating: 0, count: 0, recentComments: [] };
    const avgRating = entries.reduce((sum, f) => sum + f.rating, 0) / entries.length;
    const recentComments = entries
      .filter(f => f.comment)
      .slice(-5)
      .map(f => f.comment as string);
    return { avgRating: Math.round(avgRating * 10) / 10, count: entries.length, recentComments };
  }
}

export const guideFeedbackService = new GuideFeedbackService();
export default guideFeedbackService;
