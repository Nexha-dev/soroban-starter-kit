/**
 * Component Registry
 * Central store for component metadata, props, examples, and versioning
 */

export type PropType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function' | 'ReactNode' | 'enum';

export interface PropDef {
  name: string;
  type: PropType;
  required: boolean;
  defaultValue?: string;
  description: string;
  enumValues?: string[];
}

export interface ComponentExample {
  title: string;
  description?: string;
  code: string;
  /** Prop values to pass to the live playground */
  props?: Record<string, any>;
}

export interface ComponentVersion {
  version: string;
  date: string;
  changes: string[];
}

export interface ComponentDoc {
  id: string;
  name: string;
  description: string;
  category: 'layout' | 'data' | 'feedback' | 'navigation' | 'form' | 'utility';
  version: string;
  status: 'stable' | 'beta' | 'deprecated';
  props: PropDef[];
  examples: ComponentExample[];
  changelog: ComponentVersion[];
  tags: string[];
  designTokens?: string[];
  a11yNotes?: string;
  /** Community contributions count */
  contributions: number;
}

export class ComponentRegistry {
  private components: Map<string, ComponentDoc> = new Map();

  register(doc: ComponentDoc): void {
    this.components.set(doc.id, doc);
  }

  get(id: string): ComponentDoc | undefined {
    return this.components.get(id);
  }

  getAll(): ComponentDoc[] {
    return Array.from(this.components.values());
  }

  getByCategory(category: ComponentDoc['category']): ComponentDoc[] {
    return this.getAll().filter(c => c.category === category);
  }

  search(query: string): ComponentDoc[] {
    const q = query.toLowerCase();
    return this.getAll().filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  getCategories(): ComponentDoc['category'][] {
    return [...new Set(this.getAll().map(c => c.category))];
  }

  addContribution(id: string): void {
    const doc = this.components.get(id);
    if (doc) doc.contributions++;
  }
}

export const componentRegistry = new ComponentRegistry();

// ─── Register built-in components ────────────────────────────────────────────

componentRegistry.register({
  id: 'balance-display',
  name: 'BalanceDisplay',
  description: 'Displays a single token balance with formatting and status indicators.',
  category: 'data',
  version: '1.0.0',
  status: 'stable',
  tags: ['balance', 'token', 'stellar'],
  designTokens: ['--color-success', '--color-error', '--color-text-primary'],
  a11yNotes: 'Uses aria-label for screen reader balance announcements.',
  contributions: 0,
  props: [
    { name: 'balance', type: 'object', required: true, description: 'CachedBalance object with asset, amount, and account fields.' },
    { name: 'showAccount', type: 'boolean', required: false, defaultValue: 'true', description: 'Whether to display the account address.' },
  ],
  examples: [
    {
      title: 'Basic usage',
      code: `<BalanceDisplay balance={{ asset: 'XLM', amount: '100.00', account: 'GABC...', lastUpdated: Date.now(), isStale: false }} />`,
      props: { balance: { asset: 'XLM', amount: '100.00', account: 'GABC...XYZ', lastUpdated: Date.now(), isStale: false } },
    },
  ],
  changelog: [{ version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] }],
});

componentRegistry.register({
  id: 'search-bar',
  name: 'SearchBar',
  description: 'Debounced search input with clear button and loading state.',
  category: 'form',
  version: '1.1.0',
  status: 'stable',
  tags: ['search', 'input', 'filter'],
  a11yNotes: 'Includes role="search" and aria-label on the input.',
  contributions: 2,
  props: [
    { name: 'value', type: 'string', required: true, description: 'Current search query.' },
    { name: 'onChange', type: 'function', required: true, description: 'Callback fired on input change.' },
    { name: 'placeholder', type: 'string', required: false, defaultValue: '"Search…"', description: 'Input placeholder text.' },
    { name: 'debounceMs', type: 'number', required: false, defaultValue: '300', description: 'Debounce delay in milliseconds.' },
    { name: 'isLoading', type: 'boolean', required: false, defaultValue: 'false', description: 'Shows a loading spinner.' },
  ],
  examples: [
    { title: 'Basic', code: `<SearchBar value={query} onChange={setQuery} placeholder="Search transactions…" />` },
    { title: 'With loading', code: `<SearchBar value={query} onChange={setQuery} isLoading={true} />` },
  ],
  changelog: [
    { version: '1.1.0', date: '2025-03-01', changes: ['Added debounceMs prop', 'Added isLoading state'] },
    { version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] },
  ],
});

componentRegistry.register({
  id: 'connectivity-status',
  name: 'ConnectivityStatus',
  description: 'Shows online/offline status with animated indicator.',
  category: 'feedback',
  version: '1.0.0',
  status: 'stable',
  tags: ['connectivity', 'status', 'offline', 'pwa'],
  a11yNotes: 'Uses aria-live="polite" to announce status changes.',
  contributions: 0,
  props: [],
  examples: [{ title: 'Basic', code: `<ConnectivityStatus />` }],
  changelog: [{ version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] }],
});

componentRegistry.register({
  id: 'theme-toggle',
  name: 'ThemeToggle',
  description: 'Toggles between light/dark mode and color schemes.',
  category: 'utility',
  version: '1.0.0',
  status: 'stable',
  tags: ['theme', 'dark-mode', 'design-system'],
  designTokens: ['--color-primary', '--color-highlight', '--color-accent'],
  contributions: 1,
  props: [],
  examples: [{ title: 'Basic', code: `<ThemeToggle />` }],
  changelog: [{ version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] }],
});

componentRegistry.register({
  id: 'data-table',
  name: 'DataTable',
  description: 'Feature-rich table with sorting, filtering, pagination, virtual scroll, bulk actions, and CSV/JSON export.',
  category: 'data',
  version: '2.0.0',
  status: 'stable',
  tags: ['table', 'data', 'sort', 'filter', 'export', 'virtual-scroll'],
  a11yNotes: 'Uses role="grid", aria-sort, and keyboard navigation for full a11y compliance.',
  contributions: 3,
  props: [
    { name: 'data', type: 'array', required: true, description: 'Array of row data objects.' },
    { name: 'columns', type: 'array', required: true, description: 'Column definitions (key, header, accessor, sortable).' },
    { name: 'getRowId', type: 'function', required: true, description: 'Returns a unique key for each row.' },
    { name: 'caption', type: 'string', required: false, description: 'Accessible table caption.' },
    { name: 'exportFormats', type: 'array', required: false, defaultValue: '[]', description: 'Enabled export formats: "csv" | "json".' },
    { name: 'bulkActions', type: 'array', required: false, description: 'Actions available on selected rows.' },
    { name: 'renderExpanded', type: 'function', required: false, description: 'Renders expanded row detail.' },
  ],
  examples: [
    {
      title: 'Basic table',
      code: `<DataTable\n  data={rows}\n  columns={[{ key: 'id', header: 'ID', accessor: r => r.id, sortable: true }]}\n  getRowId={r => r.id}\n/>`,
    },
    {
      title: 'With export',
      code: `<DataTable data={rows} columns={cols} getRowId={r => r.id} exportFormats={['csv', 'json']} />`,
    },
  ],
  changelog: [
    { version: '2.0.0', date: '2025-03-01', changes: ['Added virtual scroll', 'Added bulk actions', 'Added CSV/JSON export'] },
    { version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] },
  ],
});

componentRegistry.register({
  id: 'responsive-nav',
  name: 'ResponsiveNav',
  description: 'Collapsible sidebar navigation with nested items, badges, and keyboard support.',
  category: 'navigation',
  version: '1.0.0',
  status: 'stable',
  tags: ['navigation', 'sidebar', 'menu', 'responsive'],
  a11yNotes: 'Uses nav landmark, aria-expanded for collapsible items, and full keyboard navigation.',
  contributions: 0,
  props: [
    { name: 'items', type: 'array', required: true, description: 'NavItem[] — each item has id, label, icon, onClick, badge, children.' },
    { name: 'onItemClick', type: 'function', required: false, description: 'Callback when any nav item is clicked.' },
  ],
  examples: [
    { title: 'Basic', code: `<ResponsiveNav items={[{ id: 'home', label: 'Home', icon: '🏠', onClick: () => {} }]} />` },
  ],
  changelog: [{ version: '1.0.0', date: '2025-01-01', changes: ['Initial release'] }],
});

export default componentRegistry;
