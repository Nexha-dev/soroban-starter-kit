import React, { useEffect, useRef, useState } from 'react';
import { getThemeAnalytics, useTheme } from '../context/ThemeContext';
import { ColorScheme, LayoutDensity, LayoutTokens } from '../theme/tokens';

const SCHEMES: { value: ColorScheme; label: string; a11y?: boolean }[] = [
  { value: 'default',        label: '🎨 Default' },
  { value: 'ocean',          label: '🌊 Ocean' },
  { value: 'forest',         label: '🌿 Forest' },
  { value: 'sunset',         label: '🌅 Sunset' },
  { value: 'high-contrast',  label: '⚡ High Contrast', a11y: true },
];

const DENSITIES: { value: LayoutDensity; label: string }[] = [
  { value: 'compact',     label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious',    label: 'Spacious' },
];

const RADII: { value: LayoutTokens['borderRadius']; label: string }[] = [
  { value: 'sharp',   label: 'Sharp' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill',    label: 'Pill' },
];

type Tab = 'colors' | 'layout' | 'share' | 'analytics';

export function ThemeCustomizer(): JSX.Element {
  const { mode, scheme, layout, toggleMode, setScheme, setLayout, exportTheme, importTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('colors');
  const [copyMsg, setCopyMsg] = useState('');
  const [analytics, setAnalytics] = useState<Array<{ event: string; value: string; ts: number }>>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCopy = async (): Promise<void> => {
    const json = exportTheme();
    await navigator.clipboard?.writeText(json);
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  };

  const handleImport = (): void => {
    const json = prompt('Paste theme JSON:');
    if (json) importTheme(json);
  };

  const handleDownload = (): void => {
    const blob = new Blob([exportTheme()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) importTheme(ev.target.result as string); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openAnalytics = (): void => {
    setAnalytics(getThemeAnalytics());
    setTab('analytics');
  };

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    width: '280px',
    zIndex: 200,
    boxShadow: 'var(--shadow-lg)',
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 4px',
    fontSize: '0.75rem',
    background: active ? 'var(--color-highlight)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-highlight)' : '2px solid transparent',
    cursor: 'pointer',
  });

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Trigger buttons */}
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
          onClick={() => setOpen(p => !p)}
          aria-label="Theme customizer"
          aria-expanded={open}
          title="Theme customizer"
        >
          🎨
        </button>
      </div>

      {open && (
        <div className="card" style={panelStyle} role="dialog" aria-label="Theme customizer">
          {/* Tab bar */}
          <div className="flex" style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--spacing-sm)' }}>
            {(['colors', 'layout', 'share', 'analytics'] as Tab[]).map(t => (
              <button key={t} style={tabBtnStyle(tab === t)} onClick={() => t === 'analytics' ? openAnalytics() : setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Colors tab */}
          {tab === 'colors' && (
            <div className="flex flex-col gap-sm">
              <p className="form-label">Color Scheme</p>
              {SCHEMES.map(s => (
                <button
                  key={s.value}
                  className={`btn ${scheme === s.value ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => setScheme(s.value)}
                  aria-pressed={scheme === s.value}
                >
                  {s.label}{s.a11y && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7 }}>A11Y</span>}
                </button>
              ))}
            </div>
          )}

          {/* Layout tab */}
          {tab === 'layout' && (
            <div className="flex flex-col gap-md">
              <div>
                <p className="form-label" style={{ marginBottom: 'var(--spacing-xs)' }}>Density</p>
                <div className="flex gap-sm">
                  {DENSITIES.map(d => (
                    <button
                      key={d.value}
                      className={`btn ${layout.density === d.value ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: '0.75rem' }}
                      onClick={() => setLayout({ density: d.value })}
                      aria-pressed={layout.density === d.value}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="form-label" style={{ marginBottom: 'var(--spacing-xs)' }}>
                  Font Scale: {layout.fontScale.toFixed(1)}×
                </p>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.1"
                  value={layout.fontScale}
                  onChange={e => setLayout({ fontScale: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                  aria-label="Font scale"
                />
              </div>

              <div>
                <p className="form-label" style={{ marginBottom: 'var(--spacing-xs)' }}>Border Radius</p>
                <div className="flex gap-sm">
                  {RADII.map(r => (
                    <button
                      key={r.value}
                      className={`btn ${layout.borderRadius === r.value ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: '0.75rem' }}
                      onClick={() => setLayout({ borderRadius: r.value })}
                      aria-pressed={layout.borderRadius === r.value}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Share tab */}
          {tab === 'share' && (
            <div className="flex flex-col gap-sm">
              <p className="form-label">Export / Import Theme</p>
              <button className="btn btn-secondary" onClick={handleCopy}>
                📋 {copyMsg || 'Copy to Clipboard'}
              </button>
              <button className="btn btn-secondary" onClick={handleDownload}>
                ⬇️ Download JSON
              </button>
              <button className="btn btn-secondary" onClick={handleImport}>
                📥 Paste JSON
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', textAlign: 'center' }}>
                📂 Upload File
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleUpload} />
              </label>
            </div>
          )}

          {/* Analytics tab */}
          {tab === 'analytics' && (
            <div>
              <p className="form-label" style={{ marginBottom: 'var(--spacing-sm)' }}>
                Recent Changes ({analytics.length})
              </p>
              {analytics.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No changes recorded yet.</p>
              )}
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {[...analytics].reverse().map((a, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ color: 'var(--color-highlight)' }}>{a.event}</span>
                    {' → '}
                    <span style={{ color: 'var(--color-text-secondary)' }}>{a.value}</span>
                    <span style={{ float: 'right', color: 'var(--color-text-muted)' }}>
                      {new Date(a.ts).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
