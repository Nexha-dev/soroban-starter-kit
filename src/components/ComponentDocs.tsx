import React, { useState, useMemo, useCallback } from 'react';
import { componentRegistry } from '../services/docs/componentRegistry';
import { docsAnalytics } from '../services/docs/docsAnalytics';
import type { ComponentDoc, PropDef } from '../services/docs/componentRegistry';

type Tab = 'props' | 'examples' | 'changelog' | 'analytics';

const s = {
  card: { backgroundColor: 'white', padding: '16px', borderRadius: '6px', marginBottom: '12px' } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
    backgroundColor: color, color: 'white', fontSize: '11px', marginLeft: '4px',
  }),
  code: { backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '4px', fontSize: '12px', overflowX: 'auto', whiteSpace: 'pre' } as React.CSSProperties,
  input: { padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' } as React.CSSProperties,
};

const STATUS_COLOR: Record<ComponentDoc['status'], string> = {
  stable: '#28a745', beta: '#ffc107', deprecated: '#dc3545',
};
const CATEGORY_COLOR: Record<ComponentDoc['category'], string> = {
  layout: '#6f42c1', data: '#007bff', feedback: '#fd7e14',
  navigation: '#20c997', form: '#e83e8c', utility: '#6c757d',
};

function PropTable({ props }: { props: PropDef[] }) {
  if (props.length === 0) return <p style={{ color: '#666', fontSize: '13px' }}>No props — this component takes no external props.</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ backgroundColor: '#f8f9fa' }}>
          {['Name', 'Type', 'Required', 'Default', 'Description'].map(h => (
            <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.map(p => (
          <tr key={p.name} style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: '8px' }}><code style={{ color: '#e83e8c' }}>{p.name}</code></td>
            <td style={{ padding: '8px' }}><code style={{ color: '#007bff' }}>{p.type}{p.enumValues ? ` (${p.enumValues.join(' | ')})` : ''}</code></td>
            <td style={{ padding: '8px' }}>{p.required ? <span style={s.badge('#dc3545')}>required</span> : <span style={s.badge('#6c757d')}>optional</span>}</td>
            <td style={{ padding: '8px', color: '#666' }}>{p.defaultValue ?? '—'}</td>
            <td style={{ padding: '8px', color: '#444' }}>{p.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy();
  };
  return (
    <div style={{ position: 'relative' }}>
      <pre style={s.code}>{code}</pre>
      <button onClick={handleCopy} style={{
        position: 'absolute', top: '8px', right: '8px', padding: '3px 8px',
        fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px',
        backgroundColor: copied ? '#28a745' : 'white', color: copied ? 'white' : '#333', cursor: 'pointer',
      }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Playground({ doc, onInteract }: { doc: ComponentDoc; onInteract: () => void }) {
  const [propValues, setPropValues] = useState<Record<string, any>>(
    () => Object.fromEntries(doc.props.filter(p => p.defaultValue).map(p => [p.name, p.defaultValue]))
  );

  const generatedCode = useMemo(() => {
    const propsStr = Object.entries(propValues)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([k, v]) => `  ${k}=${typeof v === 'string' ? `"${v}"` : `{${v}}`}`)
      .join('\n');
    return `<${doc.name}\n${propsStr}\n/>`;
  }, [doc.name, propValues]);

  const editablePropTypes: PropDef['type'][] = ['string', 'number', 'boolean', 'enum'];
  const editableProps = doc.props.filter(p => editablePropTypes.includes(p.type));

  return (
    <div>
      {editableProps.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Props</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {editableProps.map(p => (
              <label key={p.name} style={{ fontSize: '12px' }}>
                <div style={{ marginBottom: '3px', color: '#444' }}>
                  <code style={{ color: '#e83e8c' }}>{p.name}</code>
                  <span style={{ color: '#999', marginLeft: '4px' }}>{p.type}</span>
                </div>
                {p.type === 'boolean' ? (
                  <input type="checkbox" checked={!!propValues[p.name]}
                    onChange={e => { setPropValues(v => ({ ...v, [p.name]: e.target.checked })); onInteract(); }} />
                ) : p.type === 'enum' && p.enumValues ? (
                  <select value={propValues[p.name] ?? ''} onChange={e => { setPropValues(v => ({ ...v, [p.name]: e.target.value })); onInteract(); }}
                    style={{ ...s.input, width: 'auto' }}>
                    {p.enumValues.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                ) : (
                  <input type={p.type === 'number' ? 'number' : 'text'} value={propValues[p.name] ?? ''}
                    onChange={e => { setPropValues(v => ({ ...v, [p.name]: e.target.value })); onInteract(); }}
                    style={s.input} />
                )}
              </label>
            ))}
          </div>
        </div>
      )}
      <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Generated Code</h4>
      <CodeBlock code={generatedCode} onCopy={() => docsAnalytics.track(doc.id, 'copy-code')} />
    </div>
  );
}

function ComponentDetail({ doc, onBack }: { doc: ComponentDoc; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('props');
  const analytics = docsAnalytics.getSummary(doc.id);

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} style={{
      padding: '7px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
      backgroundColor: tab === t ? '#007bff' : '#e9ecef', color: tab === t ? 'white' : '#333',
    }}>{label}</button>
  );

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: '16px', padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' }}>
        ← Back
      </button>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>{doc.name}</h2>
            <p style={{ margin: '0 0 8px 0', color: '#555', fontSize: '14px' }}>{doc.description}</p>
            <div>
              <span style={s.badge(STATUS_COLOR[doc.status])}>{doc.status}</span>
              <span style={s.badge(CATEGORY_COLOR[doc.category])}>{doc.category}</span>
              <span style={s.badge('#6c757d')}>v{doc.version}</span>
              {doc.tags.map(t => <span key={t} style={s.badge('#adb5bd')}>{t}</span>)}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>
            <div>👁 {analytics.views} views</div>
            <div>🎮 {analytics.playgroundUses} playground uses</div>
            <div>📋 {analytics.codeCopies} copies</div>
            <div>🤝 {doc.contributions} contributions</div>
          </div>
        </div>

        {doc.a11yNotes && (
          <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#e8f4fd', borderRadius: '4px', fontSize: '13px' }}>
            ♿ <strong>Accessibility:</strong> {doc.a11yNotes}
          </div>
        )}
        {doc.designTokens && doc.designTokens.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            🎨 Design tokens: {doc.designTokens.map(t => <code key={t} style={{ marginLeft: '4px', backgroundColor: '#f8f9fa', padding: '1px 4px', borderRadius: '2px' }}>{t}</code>)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {tabBtn('props', 'Props')}
        {tabBtn('examples', `Examples (${doc.examples.length})`)}
        {tabBtn('changelog', 'Changelog')}
        {tabBtn('analytics', 'Analytics')}
      </div>

      {tab === 'props' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Props</h3>
          <PropTable props={doc.props} />
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Playground</h3>
            <Playground doc={doc} onInteract={() => docsAnalytics.track(doc.id, 'playground')} />
          </div>
        </div>
      )}

      {tab === 'examples' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Examples</h3>
          {doc.examples.map((ex, i) => (
            <div key={i} style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>{ex.title}</h4>
              {ex.description && <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>{ex.description}</p>}
              <CodeBlock code={ex.code} onCopy={() => docsAnalytics.track(doc.id, 'copy-code')} />
            </div>
          ))}
        </div>
      )}

      {tab === 'changelog' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Changelog</h3>
          {doc.changelog.map((v, i) => (
            <div key={i} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '3px solid #007bff' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>v{v.version} <span style={{ fontWeight: 'normal', color: '#666', fontSize: '12px' }}>{v.date}</span></div>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', fontSize: '13px' }}>
                {v.changes.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'analytics' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px 0' }}>Usage Analytics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Views', value: analytics.views, icon: '👁' },
              { label: 'Playground Uses', value: analytics.playgroundUses, icon: '🎮' },
              { label: 'Code Copies', value: analytics.codeCopies, icon: '📋' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px' }}>{icon}</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{value}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component Documentation System
 * Interactive playground, prop docs, versioning, analytics, search, and community contributions
 */
export function ComponentDocs(): JSX.Element {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = ['all', ...componentRegistry.getCategories()];

  const filtered = useMemo(() => {
    const results = search.trim() ? componentRegistry.search(search) : componentRegistry.getAll();
    const byCat = selectedCategory === 'all' ? results : results.filter(c => c.category === selectedCategory);
    if (search.trim()) docsAnalytics.trackSearch(search, byCat.length);
    return byCat;
  }, [search, selectedCategory]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    docsAnalytics.track(id, 'view');
  }, []);

  const topComponents = docsAnalytics.getTopComponents(3);
  const popularSearches = docsAnalytics.getPopularSearches(5);

  if (selectedId) {
    const doc = componentRegistry.get(selectedId);
    if (doc) return (
      <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
        <ComponentDetail doc={doc} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 4px 0' }}>📚 Component Documentation</h2>
      <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px' }}>
        {componentRegistry.getAll().length} components · Interactive playground · Live examples
      </p>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search components, tags, descriptions…"
          style={{ ...s.input, flex: 1, minWidth: '200px' }}
          aria-label="Search components"
        />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
              padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
              backgroundColor: selectedCategory === cat ? '#007bff' : '#e9ecef',
              color: selectedCategory === cat ? 'white' : '#333',
            }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px' }}>
        {/* Component Grid */}
        <div>
          {filtered.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', color: '#666' }}>
              No components match "{search}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {filtered.map(doc => (
                <div key={doc.id} onClick={() => handleSelect(doc.id)} style={{
                  ...s.card, cursor: 'pointer', transition: 'box-shadow 0.15s',
                  borderLeft: `4px solid ${CATEGORY_COLOR[doc.category]}`,
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{doc.name}</h3>
                    <span style={s.badge(STATUS_COLOR[doc.status])}>{doc.status}</span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666', lineHeight: 1.4 }}>{doc.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
                    <span>
                      <span style={s.badge(CATEGORY_COLOR[doc.category])}>{doc.category}</span>
                      <span style={{ marginLeft: '6px' }}>v{doc.version}</span>
                    </span>
                    <span>{doc.props.length} props · {doc.examples.length} examples</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {topComponents.length > 0 && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>🔥 Most Viewed</h4>
              {topComponents.map(t => {
                const doc = componentRegistry.get(t.componentId);
                return doc ? (
                  <div key={t.componentId} onClick={() => handleSelect(t.componentId)}
                    style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '13px' }}>
                    <span style={{ color: '#007bff' }}>{doc.name}</span>
                    <span style={{ float: 'right', color: '#999' }}>{t.views} views</span>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {popularSearches.length > 0 && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>🔍 Popular Searches</h4>
              {popularSearches.map(({ query, count }) => (
                <div key={query} onClick={() => setSearch(query)}
                  style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '13px' }}>
                  <span style={{ color: '#007bff' }}>{query}</span>
                  <span style={{ float: 'right', color: '#999' }}>{count}×</span>
                </div>
              ))}
            </div>
          )}

          <div style={s.card}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>📊 Registry Stats</h4>
            {[
              { label: 'Total Components', value: componentRegistry.getAll().length },
              { label: 'Stable', value: componentRegistry.getAll().filter(c => c.status === 'stable').length },
              { label: 'Beta', value: componentRegistry.getAll().filter(c => c.status === 'beta').length },
              { label: 'Categories', value: componentRegistry.getCategories().length },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                <span style={{ color: '#666' }}>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComponentDocs;
