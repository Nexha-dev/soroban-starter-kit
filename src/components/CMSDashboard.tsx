import React, { useState, useEffect, useCallback } from 'react';
import {
  cmsService,
  type ContentItem,
  type ContentStatus,
  type ContentType,
  type SupportedLocale,
  type CMSStats,
  type SEOMetadata,
} from '../services/cms/cmsService';

type Tab = 'content' | 'editor' | 'publishing' | 'schedule' | 'analytics' | 'moderation' | 'seo' | 'localization';

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 13px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: active ? '#0f766e' : '#e9ecef',
    color: active ? 'white' : '#374151',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
  };
}

function statusBadge(status: ContentStatus): React.ReactElement {
  const colors: Record<ContentStatus, string> = {
    draft: '#6b7280',
    'in-review': '#d97706',
    approved: '#2563eb',
    published: '#16a34a',
    scheduled: '#7c3aed',
    archived: '#9ca3af',
  };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
      backgroundColor: colors[status], color: 'white', fontSize: '11px',
    }}>
      {status}
    </span>
  );
}

function moderationBadge(status: string): React.ReactElement {
  const colors: Record<string, string> = {
    pending: '#d97706', approved: '#16a34a', rejected: '#dc2626', flagged: '#ef4444',
  };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
      backgroundColor: colors[status] ?? '#6b7280', color: 'white', fontSize: '11px', marginLeft: '6px',
    }}>
      {status}
    </span>
  );
}

function seoScoreColor(score: number): string {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

function fmtDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString();
}

function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function progressBar(value: number, color: string): React.ReactElement {
  return (
    <div style={{ backgroundColor: '#e9ecef', borderRadius: '3px', height: '6px' }}>
      <div style={{ width: `${Math.min(100, value)}%`, backgroundColor: color, borderRadius: '3px', height: '100%' }} />
    </div>
  );
}

// ─── Content List Tab ─────────────────────────────────────────────────────────

function ContentListTab({
  onEdit,
  onRefresh,
}: {
  onEdit: (item: ContentItem) => void;
  onRefresh: () => void;
}): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ContentType>('article');

  const items = cmsService
    .getAll(statusFilter !== 'all' ? { status: statusFilter } : undefined)
    .filter((i) => typeFilter === 'all' || i.type === typeFilter)
    .filter((i) => !search || i.title.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    cmsService.create({ type: newType, title: newTitle, body: '', author: 'Darkdante9', locale: 'en', category: 'General', targetSegment: 'all' });
    setNewTitle('');
    setShowCreate(false);
    onRefresh();
  };

  const STATUS_OPTIONS: Array<ContentStatus | 'all'> = ['all', 'draft', 'in-review', 'approved', 'published', 'scheduled', 'archived'];
  const TYPE_OPTIONS: Array<ContentType | 'all'> = ['all', 'announcement', 'article', 'tutorial', 'faq', 'changelog', 'page'];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search content…"
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', flex: '1 1 160px' }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')}
          style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ContentType | 'all')}
          style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '6px 14px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          + New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...card, backgroundColor: '#f0fdfa', border: '1px solid #99f6e4' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>New Content Item</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title…"
              style={{ flex: '1 1 200px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
            <select value={newType} onChange={(e) => setNewType(e.target.value as ContentType)}
              style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
              {(['announcement', 'article', 'tutorial', 'faq', 'changelog', 'page'] as ContentType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button onClick={handleCreate}
              style={{ padding: '6px 14px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Create
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '6px 14px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Title</th>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Author</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>Views</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>SEO</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>Updated</th>
              <th style={{ textAlign: 'center', padding: '8px 6px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '9px 6px', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.featured && <span style={{ marginRight: '4px' }}>⭐</span>}
                  {item.title}
                </td>
                <td style={{ padding: '9px 6px', color: '#6b7280' }}>{item.type}</td>
                <td style={{ padding: '9px 6px' }}>{statusBadge(item.status)}{item.moderationStatus !== 'approved' && moderationBadge(item.moderationStatus)}</td>
                <td style={{ padding: '9px 6px', color: '#6b7280' }}>{item.author}</td>
                <td style={{ padding: '9px 6px', textAlign: 'right' }}>{item.analytics.views.toLocaleString()}</td>
                <td style={{ padding: '9px 6px', textAlign: 'right', color: seoScoreColor(item.seo.seoScore), fontWeight: 600 }}>
                  {item.seo.seoScore || '—'}
                </td>
                <td style={{ padding: '9px 6px', textAlign: 'right', color: '#6b7280' }}>{fmtDate(item.updatedAt)}</td>
                <td style={{ padding: '9px 6px', textAlign: 'center' }}>
                  <button onClick={() => onEdit(item)}
                    style={{ padding: '3px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'white' }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No content items found.</p>
        )}
      </div>
    </div>
  );
}

// ─── Editor Tab ───────────────────────────────────────────────────────────────

function EditorTab({ editingItem, onRefresh }: { editingItem: ContentItem | null; onRefresh: () => void }): React.ReactElement {
  const [item, setItem] = useState<ContentItem | null>(editingItem);
  const [title, setTitle] = useState(editingItem?.title ?? '');
  const [body, setBody] = useState(editingItem?.body ?? '');
  const [saved, setSaved] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setItem(editingItem);
      setTitle(editingItem.title);
      setBody(editingItem.body);
    }
  }, [editingItem]);

  const handleSave = () => {
    if (!item) return;
    cmsService.update(item.id, { title, body }, 'Darkdante9', 'Manual save');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh();
  };

  const handleSubmitReview = () => {
    if (!item) return;
    handleSave();
    cmsService.submitForReview(item.id);
    onRefresh();
  };

  const handlePublish = () => {
    if (!item) return;
    handleSave();
    cmsService.publish(item.id);
    onRefresh();
  };

  const handleRestore = (versionNumber: number) => {
    if (!item) return;
    const updated = cmsService.restoreVersion(item.id, versionNumber, 'Darkdante9');
    if (updated) {
      setTitle(updated.title);
      setBody(updated.body);
      setItem(updated);
      onRefresh();
    }
  };

  if (!item) {
    return (
      <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '40px' }}>
        Select a content item from the Content tab to edit it.
      </div>
    );
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Editing: {item.type}</h3>
            {statusBadge(item.status)}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {saved && <span style={{ fontSize: '12px', color: '#16a34a', alignSelf: 'center' }}>Saved!</span>}
            <button onClick={() => setShowVersions(!showVersions)}
              style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'white' }}>
              History ({item.versions.length})
            </button>
            <button onClick={handleSave}
              style={{ padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#0f766e', color: 'white' }}>
              Save Draft
            </button>
            {item.status === 'draft' && (
              <button onClick={handleSubmitReview}
                style={{ padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#d97706', color: 'white' }}>
                Submit for Review
              </button>
            )}
            {(item.status === 'approved' || item.status === 'draft') && (
              <button onClick={handlePublish}
                style={{ padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white' }}>
                Publish
              </button>
            )}
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title…"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '15px', fontWeight: 600, marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your content here (Markdown supported)…"
          rows={16}
          style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', lineHeight: '1.6', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }}
        />
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
          {body.length} characters · ~{Math.ceil(body.split(/\s+/).length / 200)} min read · Version {item.currentVersion}
        </div>
      </div>

      {/* Version history */}
      {showVersions && (
        <div style={card}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Version History</h4>
          {[...item.versions].reverse().map((v) => (
            <div key={v.versionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
              <div>
                <strong>v{v.versionNumber}</strong>
                <span style={{ color: '#6b7280', marginLeft: '8px' }}>{v.changeNote}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>{fmtDate(v.editedAt)} by {v.editedBy}</span>
                {v.versionNumber !== item.currentVersion && (
                  <button onClick={() => handleRestore(v.versionNumber)}
                    style={{ padding: '2px 8px', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'white' }}>
                    Restore
                  </button>
                )}
                {v.versionNumber === item.currentVersion && (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Current</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachments */}
      <div style={card}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Media Attachments</h4>
        {item.attachments.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>No attachments. Drop files here to upload (demo only).</p>
        ) : (
          item.attachments.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
              <span>📎 {a.name}</span>
              <span style={{ color: '#6b7280' }}>{a.type} · {(a.size / 1024).toFixed(0)} KB</span>
            </div>
          ))
        )}
        <div style={{ marginTop: '10px' }}>
          <button disabled style={{ padding: '5px 12px', fontSize: '12px', border: '1px dashed #d1d5db', borderRadius: '4px', cursor: 'not-allowed', backgroundColor: '#f9fafb', color: '#6b7280' }}>
            + Upload Media (demo)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Publishing Workflow Tab ──────────────────────────────────────────────────

function PublishingTab({ onRefresh }: { onRefresh: () => void }): React.ReactElement {
  const inReview = cmsService.getAll({ status: 'in-review' });

  return (
    <div>
      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
        Items currently in the editorial review pipeline.
      </p>
      {inReview.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '30px' }}>
          No items in review. Submit a draft to start the workflow.
        </div>
      )}
      {inReview.map((item) => {
        const workflow = cmsService.getWorkflow(item.id);
        return (
          <div key={item.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 600 }}>{item.title}</h3>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.type} · by {item.author}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { cmsService.approve(item.id); onRefresh(); }}
                  style={{ padding: '4px 10px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white' }}>
                  Approve
                </button>
                <button onClick={() => { cmsService.moderate(item.id, 'rejected', 'Does not meet editorial standards'); onRefresh(); }}
                  style={{ padding: '4px 10px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#dc2626', color: 'white' }}>
                  Reject
                </button>
              </div>
            </div>

            {/* Workflow steps */}
            {workflow && (
              <div style={{ display: 'flex', gap: '0', marginTop: '8px' }}>
                {workflow.steps.map((step, i) => {
                  const colors = { completed: '#16a34a', 'in-progress': '#d97706', pending: '#d1d5db', rejected: '#dc2626' };
                  return (
                    <React.Fragment key={step.id}>
                      <div style={{ textAlign: 'center', minWidth: '90px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 4px',
                          backgroundColor: colors[step.status],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '12px', fontWeight: 700,
                        }}>
                          {step.status === 'completed' ? '✓' : step.status === 'rejected' ? '✕' : i + 1}
                        </div>
                        <div style={{ fontSize: '10px', color: '#374151', lineHeight: 1.3 }}>{step.name}</div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>{step.assignee}</div>
                      </div>
                      {i < workflow.steps.length - 1 && (
                        <div style={{ flex: 1, height: '2px', backgroundColor: step.status === 'completed' ? '#16a34a' : '#e5e7eb', alignSelf: 'center', marginBottom: '20px' }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ onRefresh }: { onRefresh: () => void }): React.ReactElement {
  const scheduled = cmsService.getAll({ status: 'scheduled' });
  const approved = cmsService.getAll({ status: 'approved' });
  const [selectedId, setSelectedId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');

  const handleSchedule = () => {
    if (!selectedId || !scheduleDate) return;
    cmsService.schedule(selectedId, new Date(scheduleDate).getTime());
    setSelectedId('');
    setScheduleDate('');
    onRefresh();
  };

  return (
    <div>
      {/* Schedule new */}
      <div style={{ ...card, backgroundColor: '#fafafa' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Schedule Content for Publishing</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            style={{ flex: '1 1 200px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
            <option value="">Select approved content…</option>
            {approved.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
            style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
          <button onClick={handleSchedule} disabled={!selectedId || !scheduleDate}
            style={{ padding: '6px 14px', backgroundColor: selectedId && scheduleDate ? '#7c3aed' : '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedId && scheduleDate ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
            Schedule
          </button>
        </div>
      </div>

      {/* Scheduled items */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Scheduled Publications</h4>
        {scheduled.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>No scheduled content.</p>
        ) : (
          scheduled.map((item) => {
            const isUpcoming = (item.scheduledAt ?? 0) > Date.now();
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.type} · {item.author}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', color: isUpcoming ? '#7c3aed' : '#6b7280', fontWeight: 600 }}>
                    {isUpcoming ? 'Publishes ' : 'Due '}{fmtDate(item.scheduledAt)}
                  </div>
                  <button onClick={() => { cmsService.publish(item.id); onRefresh(); }}
                    style={{ marginTop: '4px', padding: '3px 8px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white' }}>
                    Publish Now
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ stats }: { stats: CMSStats }): React.ReactElement {
  const published = cmsService.getAll({ status: 'published' });
  const maxViews = Math.max(...published.map((i) => i.analytics.views), 1);

  return (
    <div>
      {/* Overview metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Total Content', value: stats.total },
          { label: 'Published', value: stats.published },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Total Views', value: stats.totalViews.toLocaleString() },
          { label: 'Avg SEO Score', value: `${stats.avgSEOScore}/100` },
          { label: 'Needs Moderation', value: stats.pendingModeration },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: 'white', padding: '14px', borderRadius: '6px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Top content */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Top Performing Content</h4>
        {stats.topContent.map((c, i) => (
          <div key={c.id} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
              <span>{i + 1}. {c.title}</span>
              <strong>{c.views.toLocaleString()} views</strong>
            </div>
            {progressBar((c.views / maxViews) * 100, '#0f766e')}
          </div>
        ))}
      </div>

      {/* Per-article metrics */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Published Content Performance</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '6px' }}>Title</th>
              <th style={{ textAlign: 'right', padding: '6px' }}>Views</th>
              <th style={{ textAlign: 'right', padding: '6px' }}>Avg Read</th>
              <th style={{ textAlign: 'right', padding: '6px' }}>Bounce</th>
              <th style={{ textAlign: 'right', padding: '6px' }}>CTR</th>
              <th style={{ textAlign: 'right', padding: '6px' }}>Shares</th>
            </tr>
          </thead>
          <tbody>
            {published.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 6px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{item.analytics.views.toLocaleString()}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#6b7280' }}>{fmtDuration(item.analytics.avgReadTimeMs)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: item.analytics.bounceRate > 0.5 ? '#dc2626' : '#16a34a' }}>
                  {(item.analytics.bounceRate * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{(item.analytics.ctr * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{item.analytics.shares}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Moderation Tab ───────────────────────────────────────────────────────────

function ModerationTab({ onRefresh }: { onRefresh: () => void }): React.ReactElement {
  const pending = cmsService.getPendingModeration();
  const [note, setNote] = useState<Record<string, string>>({});

  return (
    <div>
      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
        Review and action content requiring moderation. Flagged items remain visible until rejected.
      </p>
      {pending.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#16a34a', padding: '30px', fontWeight: 600 }}>
          ✓ No content requires moderation.
        </div>
      ) : (
        pending.map((item) => (
          <div key={item.id} style={{
            ...card,
            borderLeft: `4px solid ${item.moderationStatus === 'flagged' ? '#ef4444' : '#d97706'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.title}</span>
                {moderationBadge(item.moderationStatus)}
                {statusBadge(item.status)}
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{item.type} · by {item.author} · {fmtDate(item.updatedAt)}</div>
              </div>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#374151' }}>{item.excerpt}</p>
            {item.moderationNote && (
              <div style={{ padding: '6px 10px', backgroundColor: '#fff7ed', borderRadius: '4px', fontSize: '12px', color: '#92400e', marginBottom: '10px' }}>
                Flag reason: {item.moderationNote}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={note[item.id] ?? ''}
                onChange={(e) => setNote({ ...note, [item.id]: e.target.value })}
                placeholder="Moderation note (optional)…"
                style={{ flex: '1 1 200px', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
              />
              <button onClick={() => { cmsService.moderate(item.id, 'approved', note[item.id]); onRefresh(); }}
                style={{ padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white' }}>
                Approve
              </button>
              <button onClick={() => { cmsService.moderate(item.id, 'rejected', note[item.id] || 'Rejected by moderator'); onRefresh(); }}
                style={{ padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#dc2626', color: 'white' }}>
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── SEO Tab ──────────────────────────────────────────────────────────────────

function SEOTab({ onRefresh }: { onRefresh: () => void }): React.ReactElement {
  const items = cmsService.getAll();
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [seo, setSeo] = useState<Partial<SEOMetadata>>(items[0]?.seo ?? {});

  const selectedItem = items.find((i) => i.id === selectedId);

  useEffect(() => {
    if (selectedItem) setSeo({ ...selectedItem.seo });
  }, [selectedId]);

  const handleSave = () => {
    cmsService.updateSEO(selectedId, seo);
    onRefresh();
  };

  const checks = selectedItem ? [
    { label: 'Meta title length (30–60 chars)', pass: (seo.metaTitle?.length ?? 0) >= 30 && (seo.metaTitle?.length ?? 0) <= 60 },
    { label: 'Meta description length (120–160 chars)', pass: (seo.metaDescription?.length ?? 0) >= 120 && (seo.metaDescription?.length ?? 0) <= 160 },
    { label: 'At least 3 keywords defined', pass: (seo.keywords?.length ?? 0) >= 3 },
    { label: 'URL slug set', pass: !!seo.slug },
    { label: 'OG image set', pass: !!seo.ogImage },
  ] : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          style={{ flex: 1, padding: '7px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
          {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>

      {selectedItem && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
          {/* Edit form */}
          <div style={card}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>SEO Metadata</h4>
            {[
              { label: 'Meta Title', key: 'metaTitle', hint: `${seo.metaTitle?.length ?? 0}/60 chars` },
              { label: 'Meta Description', key: 'metaDescription', hint: `${seo.metaDescription?.length ?? 0}/160 chars` },
              { label: 'URL Slug', key: 'slug', hint: 'Lowercase, hyphen-separated' },
              { label: 'Canonical URL', key: 'canonicalUrl', hint: 'Optional' },
              { label: 'OG Image URL', key: 'ogImage', hint: 'Open Graph image' },
            ].map(({ label, key, hint }) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>{label}</label>
                <input
                  value={(seo as Record<string, string>)[key] ?? ''}
                  onChange={(e) => setSeo({ ...seo, [key]: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{hint}</span>
              </div>
            ))}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '3px' }}>Keywords (comma-separated)</label>
              <input
                value={(seo.keywords ?? []).join(', ')}
                onChange={(e) => setSeo({ ...seo, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={handleSave}
              style={{ padding: '7px 16px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              Save SEO
            </button>
          </div>

          {/* Score panel */}
          <div>
            <div style={card}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>SEO Score</h4>
              <div style={{ fontSize: '36px', fontWeight: 700, color: seoScoreColor(selectedItem.seo.seoScore), textAlign: 'center', marginBottom: '8px' }}>
                {selectedItem.seo.seoScore}/100
              </div>
              {progressBar(selectedItem.seo.seoScore, seoScoreColor(selectedItem.seo.seoScore))}
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
                Readability: {selectedItem.seo.readabilityScore}/100
              </div>
            </div>
            <div style={card}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Checklist</h4>
              {checks.map(({ label, pass }) => (
                <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '6px', fontSize: '12px' }}>
                  <span style={{ color: pass ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{pass ? '✓' : '✕'}</span>
                  <span style={{ color: pass ? '#374151' : '#6b7280' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Localization Tab ─────────────────────────────────────────────────────────

function LocalizationTab({ onRefresh }: { onRefresh: () => void }): React.ReactElement {
  const items = cmsService.getAll({ status: 'published' });
  const locales = cmsService.getSupportedLocales();
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>('es');
  const [transTitle, setTransTitle] = useState('');
  const [transBody, setTransBody] = useState('');

  const selectedItem = items.find((i) => i.id === selectedId);

  const handleAdd = () => {
    if (!selectedId || !transTitle) return;
    cmsService.addTranslation(selectedId, selectedLocale, transTitle, transBody, 'Darkdante9');
    setTransTitle('');
    setTransBody('');
    onRefresh();
  };

  // Coverage summary
  const coverage = locales.map(({ code, name }) => {
    const translated = items.filter((i) =>
      i.translations.some((t) => t.locale === code && t.status === 'published')
    ).length;
    return { code, name, translated, total: items.length };
  });

  return (
    <div>
      {/* Coverage overview */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Translation Coverage (Published Content)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
          {coverage.map(({ code, name, translated, total }) => (
            <div key={code} style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{name}</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{translated}/{total}</div>
              {progressBar((translated / Math.max(total, 1)) * 100, '#0f766e')}
            </div>
          ))}
        </div>
      </div>

      {/* Add translation */}
      <div style={card}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Add / Update Translation</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            style={{ flex: '1 1 200px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          <select value={selectedLocale} onChange={(e) => setSelectedLocale(e.target.value as SupportedLocale)}
            style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}>
            {locales.filter((l) => l.code !== 'en').map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>
        <input value={transTitle} onChange={(e) => setTransTitle(e.target.value)}
          placeholder="Translated title…"
          style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
        <textarea value={transBody} onChange={(e) => setTransBody(e.target.value)}
          placeholder="Translated body…" rows={6}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical', marginBottom: '8px' }} />
        <button onClick={handleAdd} disabled={!selectedId || !transTitle}
          style={{ padding: '7px 16px', backgroundColor: selectedId && transTitle ? '#0f766e' : '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedId && transTitle ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
          Save Translation
        </button>
      </div>

      {/* Existing translations for selected item */}
      {selectedItem && selectedItem.translations.length > 0 && (
        <div style={card}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Existing Translations: {selectedItem.title}</h4>
          {selectedItem.translations.map((t) => {
            const localeName = locales.find((l) => l.code === t.locale)?.name ?? t.locale;
            return (
              <div key={t.locale} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                <div>
                  <strong>{localeName}</strong>
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>{t.title}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {statusBadge(t.status)}
                  {t.status !== 'published' && (
                    <button onClick={() => { cmsService.publishTranslation(selectedItem.id, t.locale); onRefresh(); }}
                      style={{ padding: '2px 8px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#16a34a', color: 'white' }}>
                      Publish
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function CMSDashboard(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('content');
  const [stats, setStats] = useState<CMSStats>(cmsService.getStats());
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setStats(cmsService.getStats());
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
    setTab('editor');
  };

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: 'content', label: 'Content', badge: stats.total },
    { id: 'editor', label: 'Editor' },
    { id: 'publishing', label: 'Publishing', badge: stats.byStatus?.['in-review'] ?? 0 },
    { id: 'schedule', label: 'Schedule', badge: stats.scheduled || undefined },
    { id: 'analytics', label: 'Analytics' },
    { id: 'moderation', label: 'Moderation', badge: stats.pendingModeration || undefined },
    { id: 'seo', label: 'SEO' },
    { id: 'localization', label: 'Localization' },
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Content Management System</h2>
        <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
          <span>{stats.published} published</span>
          <span>·</span>
          <span>{stats.scheduled} scheduled</span>
          <span>·</span>
          <span>{stats.totalViews.toLocaleString()} total views</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(({ id, label, badge }) => (
          <button key={id} style={tabBtn(tab === id)} onClick={() => setTab(id)}>
            {label}
            {badge !== undefined && badge > 0 && (
              <span style={{
                marginLeft: '5px', backgroundColor: tab === id ? 'rgba(255,255,255,0.3)' : '#0f766e',
                color: 'white', borderRadius: '10px', padding: '0 5px', fontSize: '11px',
              }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'content' && <ContentListTab key={tick} onEdit={handleEdit} onRefresh={refresh} />}
      {tab === 'editor' && <EditorTab key={editingItem?.id} editingItem={editingItem} onRefresh={refresh} />}
      {tab === 'publishing' && <PublishingTab key={tick} onRefresh={refresh} />}
      {tab === 'schedule' && <ScheduleTab key={tick} onRefresh={refresh} />}
      {tab === 'analytics' && <AnalyticsTab stats={stats} />}
      {tab === 'moderation' && <ModerationTab key={tick} onRefresh={refresh} />}
      {tab === 'seo' && <SEOTab key={tick} onRefresh={refresh} />}
      {tab === 'localization' && <LocalizationTab key={tick} onRefresh={refresh} />}
    </div>
  );
}

export default CMSDashboard;
