import React, { useState, useEffect, useRef } from 'react';
import { backupService } from '../services/backup';
import type { BackupMetadata, IntegrityReport } from '../services/backup';

type Tab = 'backups' | 'restore' | 'verify';

export function BackupRecovery(): JSX.Element {
  const [tab, setTab] = useState<Tab>('backups');
  const [points, setPoints] = useState<BackupMetadata[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setPoints(backupService.getRecoveryPoints().map(p => p.metadata));
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate() {
    setBusy(true); setError(''); setStatus('');
    try {
      const meta = await backupService.createBackup(undefined, 'manual');
      setStatus(`Backup created: ${meta.id} (${(meta.sizeBytes / 1024).toFixed(1)} KB, ${meta.recordCount} records)`);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(id: string) {
    if (!confirm('Restore this backup? Current data will be overwritten.')) return;
    setBusy(true); setError(''); setStatus('');
    try {
      await backupService.restoreBackup(id);
      setStatus('Restore complete. Reload the page to see changes.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleExport(id: string) {
    try {
      const json = backupService.exportBackup(id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fidelis-backup-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const text = await file.text();
      const meta = await backupService.importBackup(text);
      setStatus(`Imported backup: ${meta.id}`);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleVerify(id: string) {
    setReport(backupService.verifyBackup(id));
    setTab('verify');
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this backup?')) return;
    backupService.deleteBackup(id);
    refresh();
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
    background: 'none',
    border: 'none',
    fontWeight: tab === t ? 600 : 400,
    color: tab === t ? '#6366f1' : 'inherit',
  });

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ marginBottom: 16 }}>Backup &amp; Disaster Recovery</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        <button style={tabStyle('backups')} onClick={() => setTab('backups')}>Recovery Points</button>
        <button style={tabStyle('restore')} onClick={() => setTab('restore')}>Import / Export</button>
        <button style={tabStyle('verify')} onClick={() => setTab('verify')}>Integrity</button>
      </div>

      {status && <div style={{ padding: 10, background: '#d1fae5', borderRadius: 6, marginBottom: 12, color: '#065f46' }}>{status}</div>}
      {error  && <div style={{ padding: 10, background: '#fee2e2', borderRadius: 6, marginBottom: 12, color: '#991b1b' }}>{error}</div>}

      {/* Recovery Points */}
      {tab === 'backups' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#6b7280' }}>{points.length} recovery point{points.length !== 1 ? 's' : ''} stored locally</span>
            <button
              onClick={handleCreate}
              disabled={busy}
              style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {busy ? 'Creating…' : 'Create Backup'}
            </button>
          </div>

          {points.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No backups yet. Click "Create Backup" to get started.</p>
          )}

          {points.map(meta => (
            <div key={meta.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {meta.label ?? new Date(meta.timestamp).toLocaleString()}
                    <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 6px', background: '#f3f4f6', borderRadius: 4 }}>{meta.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {meta.recordCount} records · {(meta.sizeBytes / 1024).toFixed(1)} KB · stores: {meta.stores.join(', ')}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>ID: {meta.id}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button onClick={() => handleVerify(meta.id)} style={btnStyle('#f3f4f6', '#374151')}>Verify</button>
                  <button onClick={() => handleExport(meta.id)} style={btnStyle('#eff6ff', '#1d4ed8')}>Export</button>
                  <button onClick={() => handleRestore(meta.id)} disabled={busy} style={btnStyle('#f0fdf4', '#15803d')}>Restore</button>
                  <button onClick={() => handleDelete(meta.id)} style={btnStyle('#fef2f2', '#b91c1c')}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import / Export */}
      {tab === 'restore' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>Import Backup File</h3>
          <p style={{ color: '#6b7280', marginBottom: 12, fontSize: 14 }}>
            Import a previously exported <code>.json</code> backup file. The integrity checksum will be verified before import.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            disabled={busy}
            style={{ display: 'block', marginBottom: 24 }}
          />

          <h3 style={{ marginBottom: 12 }}>Export a Backup</h3>
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Go to the <strong>Recovery Points</strong> tab and click <strong>Export</strong> on any backup to download it as a JSON file.
            Store it in a safe location (e.g. cloud storage, external drive) for cross-region / off-device recovery.
          </p>
        </div>
      )}

      {/* Integrity report */}
      {tab === 'verify' && (
        <div>
          {!report && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>
              Select a backup from the <strong>Recovery Points</strong> tab and click <strong>Verify</strong>.
            </p>
          )}
          {report && (
            <div style={{ border: `1px solid ${report.valid ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{report.valid ? '✅' : '❌'}</span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{report.valid ? 'Integrity OK' : 'Integrity Failed'}</span>
              </div>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={tdStyle}>Backup ID</td><td style={tdStyle}><code>{report.backupId}</code></td></tr>
                  <tr><td style={tdStyle}>Checksum</td><td style={tdStyle}>{report.checksumMatch ? '✓ Match' : '✗ Mismatch'}</td></tr>
                  <tr><td style={tdStyle}>Stores verified</td><td style={tdStyle}>{report.storesVerified.join(', ')}</td></tr>
                  <tr><td style={tdStyle}>Verified at</td><td style={tdStyle}>{new Date(report.timestamp).toLocaleString()}</td></tr>
                </tbody>
              </table>
              {report.errors.length > 0 && (
                <ul style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '6px 12px', background: bg, color, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
});

const tdStyle: React.CSSProperties = {
  padding: '6px 12px', borderBottom: '1px solid #f3f4f6',
};

export default BackupRecovery;
