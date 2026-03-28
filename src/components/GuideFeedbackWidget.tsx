import React, { useState } from 'react';
import { guideFeedbackService } from '../services/docs/guideFeedback';
import type { GuideFeedback } from '../services/docs/guideFeedback';

interface GuideFeedbackWidgetProps {
  guideId: string;
  section?: string;
}

/**
 * Inline feedback widget for integration/deployment guide pages.
 * Collects a 1–5 star rating and optional comment, then submits
 * to guideFeedbackService (which forwards to docsAnalytics).
 */
export const GuideFeedbackWidget: React.FC<GuideFeedbackWidgetProps> = ({ guideId, section }) => {
  const [rating, setRating] = useState<GuideFeedback['rating'] | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!rating) return;
    guideFeedbackService.submit(guideId, rating, comment.trim() || undefined, section);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={containerStyle}>
        <span style={{ color: '#22c55e', fontSize: 13 }}>✔ Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <span style={{ fontSize: 13, color: '#94a3b8', marginRight: 10 }}>Was this guide helpful?</span>
      <div style={{ display: 'flex', gap: 4, marginRight: 12 }}>
        {([1, 2, 3, 4, 5] as GuideFeedback['rating'][]).map(n => (
          <button
            key={n}
            onClick={() => setRating(n)}
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
              color: rating !== null && n <= rating ? '#f59e0b' : '#334155',
              padding: '0 2px',
            }}
          >
            ★
          </button>
        ))}
      </div>
      {rating !== null && (
        <>
          <input
            placeholder="Optional comment…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 4,
              color: '#e2e8f0', padding: '4px 8px', fontSize: 12, outline: 'none',
              marginRight: 8, width: 200,
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              background: '#1d4ed8', border: 'none', borderRadius: 4,
              color: '#fff', padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            }}
          >
            Submit
          </button>
        </>
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
  padding: '10px 14px', background: '#1e293b', borderRadius: 6,
  marginTop: 24, fontFamily: 'system-ui, sans-serif',
};

export default GuideFeedbackWidget;
