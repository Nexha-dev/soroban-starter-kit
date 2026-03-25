import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ColorScheme } from '../theme/tokens';

const SCHEMES: { value: ColorScheme; label: string }[] = [
  { value: 'default',       label: '🎨 Default' },
  { value: 'ocean',         label: '🌊 Ocean' },
  { value: 'forest',        label: '🌿 Forest' },
  { value: 'sunset',        label: '🌅 Sunset' },
  { value: 'high-contrast', label: '⚡ High Contrast' },
];

export function ThemeToggle(): JSX.Element {
  const { mode, scheme, toggleMode, setScheme, exportTheme, importTheme } = useTheme();
  const [showPanel, setShowPanel] = useState(false);

  const handleImport = (): void => {
    const json = prompt('Paste theme JSON:');
    if (json) importTheme(json);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Mode toggle button */}
      <div className="flex gap-sm items-center">
        <button
          className="btn btn-secondary"
          onClick={toggleMode}
          aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => setShowPanel(p => !p)}
          aria-label="Theme settings"
          title="Theme settings"
        >
          🎨
        </button>
      </div>

      {/* Settings panel */}
      {showPanel && (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            minWidth: '200px',
            zIndex: 100,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <p className="form-label" style={{ marginBottom: 'var(--spacing-sm)' }}>Color Scheme</p>
          <div className="flex flex-col gap-sm">
            {SCHEMES.map(s => (
              <button
                key={s.value}
                className={`btn ${scheme === s.value ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start' }}
                onClick={() => setScheme(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-sm mt-md">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { navigator.clipboard?.writeText(exportTheme()); }}>
              📋 Copy
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleImport}>
              📥 Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
