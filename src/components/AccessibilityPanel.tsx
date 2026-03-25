import React, { useState } from 'react';
import { useAccessibilityAudit, useAccessibilitySettings } from '../hooks/useAccessibility';

/**
 * Accessibility Control Panel Component
 */
export function AccessibilityPanel(): JSX.Element {
  const { settings, updateSettings } = useAccessibilitySettings();
  const { report, isAuditing, runAudit } = useAccessibilityAudit();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Accessibility settings"
        style={{
          padding: '10px 15px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          fontSize: '20px',
        }}
      >
        ♿
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '70px',
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '20px',
            width: '300px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Accessibility Settings</h3>

          <label style={{ display: 'block', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => updateSettings({ highContrast: e.target.checked })}
            />
            High Contrast
          </label>

          <label style={{ display: 'block', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => updateSettings({ reduceMotion: e.target.checked })}
            />
            Reduce Motion
          </label>

          <label style={{ display: 'block', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={settings.screenReaderMode}
              onChange={(e) => updateSettings({ screenReaderMode: e.target.checked })}
            />
            Screen Reader Mode
          </label>

          <label style={{ display: 'block', marginBottom: '15px' }}>
            Font Size:
            <select
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
              style={{ marginLeft: '10px' }}
            >
              <option value="normal">Normal</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra Large</option>
            </select>
          </label>

          <button
            onClick={runAudit}
            disabled={isAuditing}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {isAuditing ? 'Auditing...' : 'Run Audit'}
          </button>

          {report && (
            <div style={{ marginTop: '15px', fontSize: '12px' }}>
              <p>
                <strong>Score:</strong> {report.score}%
              </p>
              <p>
                <strong>Issues:</strong> {report.totalIssues}
              </p>
              <p>
                <strong>WCAG Level:</strong> {report.wcagLevel}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AccessibilityPanel;
