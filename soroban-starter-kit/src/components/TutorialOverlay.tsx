import React, { useEffect, useRef, useState } from 'react';
import { useTutorial } from '../context/TutorialContext';

/** Calculates bounding rect of a CSS selector, or null if not found */
function getTargetRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

const OVERLAY_Z = 1000;
const PAD = 8;

export function TutorialOverlay(): JSX.Element | null {
  const { activeTutorial, currentStep, stepIndex, next, skip, submitFeedback } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Recalculate target position on step change / resize
  useEffect(() => {
    if (!currentStep) { setTargetRect(null); return; }
    if (currentStep.target.type === 'element') {
      const update = (): void => setTargetRect(getTargetRect(currentStep.target.type === 'element' ? currentStep.target.selector : ''));
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    setTargetRect(null);
  }, [currentStep]);

  // Focus trap: focus tooltip when it appears
  useEffect(() => {
    tooltipRef.current?.focus();
  }, [currentStep]);

  // Show feedback after last step
  const isLastStep = activeTutorial
    ? stepIndex === activeTutorial.steps.length - 1
    : false;

  if (!activeTutorial || !currentStep) return null;

  const isModal = currentStep.target.type === 'modal' || !targetRect;

  const handleNext = (nextId?: string): void => {
    if (isLastStep && !showFeedback) {
      setShowFeedback(true);
      return;
    }
    next(nextId);
  };

  const handleFeedbackSubmit = (): void => {
    submitFeedback(rating, comment);
    next();
  };

  // ── Spotlight cutout via clip-path ──────────────────────────────────────────
  const spotlight = targetRect ? (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: OVERLAY_Z,
        background: 'rgba(0,0,0,0.6)',
        clipPath: `polygon(
          0% 0%, 100% 0%, 100% 100%, 0% 100%,
          0% ${targetRect.top - PAD}px,
          ${targetRect.left - PAD}px ${targetRect.top - PAD}px,
          ${targetRect.left - PAD}px ${targetRect.bottom + PAD}px,
          ${targetRect.right + PAD}px ${targetRect.bottom + PAD}px,
          ${targetRect.right + PAD}px ${targetRect.top - PAD}px,
          0% ${targetRect.top - PAD}px
        )`,
        pointerEvents: 'none',
      }}
    />
  ) : (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
  );

  // ── Tooltip / modal position ─────────────────────────────────────────────────
  const tooltipStyle: React.CSSProperties = isModal
    ? {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: OVERLAY_Z + 1,
        width: 'min(480px, 90vw)',
      }
    : {
        position: 'fixed',
        top: Math.min(targetRect!.bottom + PAD + 8, window.innerHeight - 260),
        left: Math.max(PAD, Math.min(targetRect!.left, window.innerWidth - 360)),
        zIndex: OVERLAY_Z + 1,
        width: 'min(340px, 90vw)',
      };

  const stepCount = activeTutorial.steps.length;

  return (
    <>
      {spotlight}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={currentStep.title}
        aria-live={currentStep.ariaLive ?? 'polite'}
        tabIndex={-1}
        className="card"
        style={{ ...tooltipStyle, outline: 'none', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 2, marginBottom: 'var(--spacing-md)' }}>
          <div style={{
            height: '100%',
            width: `${((stepIndex + 1) / stepCount) * 100}%`,
            background: 'var(--color-highlight)',
            borderRadius: 2,
            transition: 'width var(--transition-normal)',
          }} />
        </div>

        <div className="card-header" style={{ marginBottom: 'var(--spacing-sm)' }}>
          <span className="card-title">{currentStep.title}</span>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>{stepIndex + 1} / {stepCount}</span>
        </div>

        {/* Media */}
        {currentStep.media && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            {currentStep.media.type === 'image'
              ? <img src={currentStep.media.src} alt={currentStep.media.alt ?? ''} style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
              : <video src={currentStep.media.src} controls style={{ width: '100%', borderRadius: 'var(--radius-md)' }} aria-label={currentStep.media.alt} />
            }
          </div>
        )}

        {/* Feedback form (shown after last step) */}
        {showFeedback ? (
          <div className="flex flex-col gap-sm">
            <p style={{ fontSize: '0.9rem' }}>How helpful was this tutorial?</p>
            <div className="flex gap-sm">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  style={{
                    fontSize: '1.25rem', background: 'none', border: 'none', cursor: 'pointer',
                    opacity: rating >= n ? 1 : 0.3,
                  }}
                  aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                >⭐</button>
              ))}
            </div>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Any comments? (optional)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              aria-label="Feedback comment"
            />
            <div className="flex gap-sm">
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFeedbackSubmit}>Submit & Finish</button>
              <button className="btn btn-secondary" onClick={() => next()}>Skip</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
              {currentStep.content}
            </p>

            {/* Branching or default next */}
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {currentStep.branches ? (
                currentStep.branches.map(b => (
                  <button
                    key={b.nextId}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleNext(b.nextId)}
                  >
                    {b.label}
                  </button>
                ))
              ) : (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleNext()}>
                  {isLastStep ? '🎉 Finish' : 'Next →'}
                </button>
              )}

              {!currentStep.branches?.some(b => b.nextId === '__end__') && (
                <button className="btn btn-secondary" onClick={skip} aria-label="Skip tutorial">
                  Skip
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Small button to re-launch the tutorial */
export function TutorialLauncher(): JSX.Element {
  const { start, isCompleted } = useTutorial();
  return (
    <button
      className="btn btn-secondary"
      onClick={() => start('main')}
      title="Start tutorial"
      aria-label="Start tutorial"
    >
      {isCompleted('main') ? '📖 Replay Tour' : '❓ Help'}
    </button>
  );
}
