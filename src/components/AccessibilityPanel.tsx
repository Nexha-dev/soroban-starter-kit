import React, { useState, useEffect, useCallback } from 'react';
import { useAccessibilityAudit, useAccessibilitySettings } from '../hooks/useAccessibility';
import { voiceCommandManager } from '../services/a11y/voiceCommandManager';
import { keyboardNavigationManager } from '../services/a11y/keyboardNavigationManager';

/**
 * Accessibility Control Panel — Issue #55
 *
 * Covers:
 * - Screen reader mode toggle
 * - Keyboard navigation controls
 * - High contrast + accessibility modes
 * - Voice command integration
 * - Customizable UI elements (font size, focus indicator, spacing)
 * - Accessibility compliance validation (quick audit)
 */

type PanelTab = 'display' | 'keyboard' | 'voice' | 'audit';

const FOCUS_OPTIONS = ['default', 'enhanced', 'high-contrast'] as const;
const FONT_OPTIONS = ['normal', 'large', 'xlarge'] as const;

export function AccessibilityPanel(): JSX.Element {
  const { settings, updateSettings } = useAccessibilitySettings();
  const { report, isAuditing, runAudit } = useAccessibilityAudit();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('display');

  // Voice command state
  const [voiceAvailable] = useState(() => voiceCommandManager.isAvailable());
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceCommands] = useState(() => voiceCommandManager.getCommands());

  // Keyboard shortcut hint
  const [shortcutHint, setShortcutHint] = useState('');

  // Register built-in voice commands on mount
  useEffect(() => {
    voiceCommandManager.registerCommand('high contrast', () => updateSettings({ highContrast: true }), 'Enable high contrast mode');
    voiceCommandManager.registerCommand('normal contrast', () => updateSettings({ highContrast: false }), 'Disable high contrast mode');
    voiceCommandManager.registerCommand('large text', () => updateSettings({ fontSize: 'large' }), 'Set font size to large');
    voiceCommandManager.registerCommand('extra large text', () => updateSettings({ fontSize: 'xlarge' }), 'Set font size to extra large');
    voiceCommandManager.registerCommand('normal text', () => updateSettings({ fontSize: 'normal' }), 'Set font size to normal');
    voiceCommandManager.registerCommand('reduce motion', () => updateSettings({ reduceMotion: true }), 'Enable reduce motion');

    const unsub = voiceCommandManager.subscribe((transcript) => {
      setVoiceTranscript(transcript);
      setTimeout(() => setVoiceTranscript(''), 3000);
    });
    return unsub;
  }, [updateSettings]);

  // Register keyboard shortcut: Alt+A to open panel
  useEffect(() => {
    const unregister = keyboardNavigationManager.registerKeyHandler('a', (e) => {
      if (e.altKey) {
        setIsOpen((v) => !v);
        setShortcutHint('Panel toggled via Alt+A');
        setTimeout(() => setShortcutHint(''), 2000);
      }
    });
    return unregister;
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceActive) {
      voiceCommandManager.stopListening();
      setVoiceActive(false);
    } else {
      voiceCommandManager.startListening();
      setVoiceActive(true);
    }
  }, [voiceActive]);

  const panelTabs: { id: PanelTab; label: string }[] = [
    { id: 'display', label: '🎨 Display' },
    { id: 'keyboard', label: '⌨️ Keyboard' },
    { id: 'voice', label: '🎤 Voice' },
    { id: 'audit', label: '✅ Audit' },
  ];

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close accessibility settings' : 'Open accessibility settings'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Accessibility settings (Alt+A)"
        style={{
          padding: 0, backgroundColor: '#007bff', color: 'white',
          border: '2px solid transparent', borderRadius: '50%',
          width: 50, height: 50, cursor: 'pointer', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        ♿
      </button>

      {/* Keyboard shortcut hint */}
      {shortcutHint && (
        <div role="status" aria-live="polite" style={{ position: 'absolute', bottom: 60, right: 0, background: '#333', color: '#fff', padding: '4px 10px', borderRadius: 4, fontSize: 11, whiteSpace: 'nowrap' }}>
          {shortcutHint}
        </div>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Accessibility settings panel"
          aria-modal="true"
          style={{
            position: 'absolute', bottom: 60, right: 0,
            backgroundColor: 'white', border: '1px solid #ccc',
            borderRadius: 10, padding: 16, width: 320,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Accessibility Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close accessibility panel"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}
            >
              ×
            </button>
          </div>

          {/* Tab bar */}
          <div role="tablist" aria-label="Accessibility setting categories" style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
            {panelTabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: tab === t.id ? '#007bff' : '#e9ecef',
                  color: tab === t.id ? '#fff' : '#333',
                  fontWeight: tab === t.id ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Display tab ── */}
          {tab === 'display' && (
            <div role="tabpanel" aria-label="Display settings">
              <ToggleRow
                label="High Contrast"
                checked={settings.highContrast}
                onChange={(v) => updateSettings({ highContrast: v })}
                hint="Increases color contrast for better visibility"
              />
              <ToggleRow
                label="Reduce Motion"
                checked={settings.reduceMotion}
                onChange={(v) => updateSettings({ reduceMotion: v })}
                hint="Disables animations and transitions"
              />
              <ToggleRow
                label="Screen Reader Mode"
                checked={settings.screenReaderMode}
                onChange={(v) => updateSettings({ screenReaderMode: v })}
                hint="Optimizes layout for screen readers"
              />

              <label style={labelStyle}>
                Font Size
                <select
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: e.target.value as typeof FONT_OPTIONS[number] })}
                  aria-label="Font size preference"
                  style={selectStyle}
                >
                  <option value="normal">Normal (16px)</option>
                  <option value="large">Large (20px)</option>
                  <option value="xlarge">Extra Large (24px)</option>
                </select>
              </label>

              <label style={labelStyle}>
                Focus Indicator Style
                <select
                  value={settings.focusIndicator}
                  onChange={(e) => updateSettings({ focusIndicator: e.target.value as typeof FOCUS_OPTIONS[number] })}
                  aria-label="Focus indicator style"
                  style={selectStyle}
                >
                  <option value="default">Default</option>
                  <option value="enhanced">Enhanced (thick ring)</option>
                  <option value="high-contrast">High Contrast</option>
                </select>
              </label>
            </div>
          )}

          {/* ── Keyboard tab ── */}
          {tab === 'keyboard' && (
            <div role="tabpanel" aria-label="Keyboard navigation settings">
              <ToggleRow
                label="Keyboard Navigation"
                checked={settings.keyboardNavigation}
                onChange={(v) => updateSettings({ keyboardNavigation: v })}
                hint="Enable full keyboard navigation support"
              />

              <div style={{ background: '#f8f9fa', borderRadius: 6, padding: 10, marginTop: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#374151' }}>Keyboard Shortcuts</p>
                {[
                  { keys: 'Alt + A', action: 'Toggle this panel' },
                  { keys: 'Tab', action: 'Navigate forward' },
                  { keys: 'Shift + Tab', action: 'Navigate backward' },
                  { keys: 'Enter / Space', action: 'Activate element' },
                  { keys: 'Escape', action: 'Close modal / return focus' },
                  { keys: 'Arrow keys', action: 'Navigate within components' },
                ].map(({ keys, action }) => (
                  <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <kbd style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>{keys}</kbd>
                    <span style={{ color: '#6b7280' }}>{action}</span>
                  </div>
                ))}
              </div>

              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>
                Skip-to-content link is always available at the top of the page.
              </p>
            </div>
          )}

          {/* ── Voice tab ── */}
          {tab === 'voice' && (
            <div role="tabpanel" aria-label="Voice command settings">
              {!voiceAvailable ? (
                <p style={{ fontSize: 13, color: '#6b7280' }}>
                  Voice recognition is not supported in this browser. Try Chrome or Edge.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13 }}>Voice Commands</span>
                    <button
                      onClick={toggleVoice}
                      aria-label={voiceActive ? 'Stop voice recognition' : 'Start voice recognition'}
                      aria-pressed={voiceActive}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                        background: voiceActive ? '#fee2e2' : '#dcfce7',
                        color: voiceActive ? '#b91c1c' : '#16a34a',
                        fontWeight: 600,
                      }}
                    >
                      {voiceActive ? '⏹ Stop' : '▶ Start'}
                    </button>
                  </div>

                  {voiceActive && (
                    <div role="status" aria-live="polite" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 12 }}>
                      🎤 Listening… {voiceTranscript && <em>"{voiceTranscript}"</em>}
                    </div>
                  )}

                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#374151' }}>Available commands:</p>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: '#6b7280' }}>
                    {[
                      '"high contrast" — enable high contrast',
                      '"normal contrast" — disable high contrast',
                      '"large text" — increase font size',
                      '"extra large text" — maximum font size',
                      '"normal text" — reset font size',
                      '"reduce motion" — enable reduce motion',
                    ].map((cmd) => <li key={cmd} style={{ marginBottom: 3 }}>{cmd}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* ── Audit tab ── */}
          {tab === 'audit' && (
            <div role="tabpanel" aria-label="Accessibility audit">
              <button
                onClick={runAudit}
                disabled={isAuditing}
                aria-label="Run accessibility compliance audit"
                style={{
                  width: '100%', padding: 10, backgroundColor: '#28a745', color: 'white',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 12,
                }}
              >
                {isAuditing ? 'Auditing…' : '▶ Run Compliance Audit'}
              </button>

              {report && (
                <div role="region" aria-label="Audit results">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: 'Score', value: `${report.score}/100`, color: report.score >= 80 ? '#22c55e' : report.score >= 60 ? '#f59e0b' : '#ef4444' },
                      { label: 'WCAG Level', value: report.wcagLevel, color: '#007bff' },
                      { label: 'Errors', value: report.errors, color: report.errors > 0 ? '#ef4444' : '#22c55e' },
                      { label: 'Warnings', value: report.warnings, color: report.warnings > 0 ? '#f59e0b' : '#22c55e' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: '#f8f9fa', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                    {report.totalIssues === 0
                      ? '✅ No issues found'
                      : `${report.totalIssues} issue${report.totalIssues > 1 ? 's' : ''} found — open the Accessibility Dashboard for details`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
      <span>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        style={{ marginLeft: 8, marginTop: 2 }}
      />
    </label>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 10, color: '#374151' };
const selectStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '5px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 };

export default AccessibilityPanel;
