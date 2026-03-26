import type {
  ApiEndpoint,
  ApiCategory,
  OutputFormat,
  FeedbackEntry,
  DocAnalyticsSummary,
} from './types';

// ─── Registry ────────────────────────────────────────────────────────────────

export class ApiDocRegistry {
  private endpoints = new Map<string, ApiEndpoint>();

  register(endpoint: ApiEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
  }

  get(id: string): ApiEndpoint | undefined {
    return this.endpoints.get(id);
  }

  getAll(): ApiEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getByCategory(category: ApiCategory): ApiEndpoint[] {
    return this.getAll().filter(e => e.category === category);
  }

  getByVersion(version: string): ApiEndpoint[] {
    return this.getAll().filter(e => e.version === version);
  }

  /** Full-text search across name, description, and tags */
  search(query: string): ApiEndpoint[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  getVersions(): string[] {
    return [...new Set(this.getAll().map(e => e.version))].sort();
  }

  getCategories(): ApiCategory[] {
    return [...new Set(this.getAll().map(e => e.category))];
  }
}

// ─── Generator ───────────────────────────────────────────────────────────────

export class ApiDocGenerator {
  constructor(private registry: ApiDocRegistry) {}

  /** Auto-generate a stub endpoint doc from a plain function signature */
  generate(
    id: string,
    name: string,
    category: ApiEndpoint['category'],
    paramNames: string[],
    returnType: string,
    tags: string[] = []
  ): ApiEndpoint {
    const endpoint: ApiEndpoint = {
      id,
      name,
      description: `Auto-generated documentation for ${name}.`,
      category,
      version: '1.0.0',
      params: paramNames.map(p => ({
        name: p,
        type: 'unknown',
        required: true,
        description: `Parameter: ${p}`,
      })),
      returns: { type: returnType, description: `Return value of ${name}.` },
      examples: [{ title: 'Basic usage', code: `${name}(${paramNames.join(', ')})` }],
      changelog: [{ version: '1.0.0', date: new Date().toISOString().slice(0, 10), breaking: false, changes: ['Auto-generated'] }],
      tags,
    };
    this.registry.register(endpoint);
    return endpoint;
  }
}

// ─── Exporter ────────────────────────────────────────────────────────────────

export class ApiDocExporter {
  constructor(private registry: ApiDocRegistry) {}

  export(format: OutputFormat, ids?: string[]): string {
    const docs = ids
      ? ids.map(id => this.registry.get(id)).filter(Boolean) as ApiEndpoint[]
      : this.registry.getAll();

    switch (format) {
      case 'json':
        return JSON.stringify(docs, null, 2);
      case 'markdown':
        return this.toMarkdown(docs);
      case 'html':
        return this.toHtml(docs);
    }
  }

  private toMarkdown(docs: ApiEndpoint[]): string {
    return docs.map(d => {
      const params = d.params.map(p =>
        `| \`${p.name}\` | \`${p.type}\` | ${p.required ? 'Yes' : 'No'} | ${p.description} |`
      ).join('\n');

      const examples = d.examples.map(ex =>
        `**${ex.title}**\n\`\`\`ts\n${ex.code}\n\`\`\``
      ).join('\n\n');

      return [
        `## ${d.name}`,
        `> ${d.description}`,
        `**Category:** ${d.category} | **Version:** ${d.version}${d.deprecated ? ' *(deprecated)*' : ''}`,
        d.params.length
          ? `### Parameters\n| Name | Type | Required | Description |\n|------|------|----------|-------------|\n${params}`
          : '',
        `### Returns\n\`${d.returns.type}\` — ${d.returns.description}`,
        examples ? `### Examples\n${examples}` : '',
      ].filter(Boolean).join('\n\n');
    }).join('\n\n---\n\n');
  }

  private toHtml(docs: ApiEndpoint[]): string {
    const sections = docs.map(d => {
      const params = d.params.map(p =>
        `<tr><td><code>${p.name}</code></td><td><code>${p.type}</code></td><td>${p.required}</td><td>${p.description}</td></tr>`
      ).join('');

      const examples = d.examples.map(ex =>
        `<h4>${ex.title}</h4><pre><code>${ex.code}</code></pre>`
      ).join('');

      return `<section id="${d.id}">
  <h2>${d.name}${d.deprecated ? ' <span class="deprecated">deprecated</span>' : ''}</h2>
  <p>${d.description}</p>
  <p><strong>Category:</strong> ${d.category} | <strong>Version:</strong> ${d.version}</p>
  ${d.params.length ? `<table><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${params}</tbody></table>` : ''}
  <p><strong>Returns:</strong> <code>${d.returns.type}</code> — ${d.returns.description}</p>
  ${examples}
</section>`;
    }).join('\n');

    return `<!DOCTYPE html><html><body>${sections}</body></html>`;
  }
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export class ApiDocFeedback {
  private entries: FeedbackEntry[] = [];

  submit(endpointId: string, helpful: boolean, comment?: string): void {
    this.entries.push({ endpointId, helpful, comment, timestamp: Date.now() });
  }

  getForEndpoint(endpointId: string): FeedbackEntry[] {
    return this.entries.filter(e => e.endpointId === endpointId);
  }

  getSentiment(endpointId: string): { helpful: number; notHelpful: number } {
    const entries = this.getForEndpoint(endpointId);
    return {
      helpful: entries.filter(e => e.helpful).length,
      notHelpful: entries.filter(e => !e.helpful).length,
    };
  }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export class ApiDocAnalytics {
  private views = new Map<string, number>();
  private copies = new Map<string, number>();
  private searches: { query: string; resultCount: number; timestamp: number }[] = [];

  trackView(endpointId: string): void {
    this.views.set(endpointId, (this.views.get(endpointId) ?? 0) + 1);
  }

  trackCopy(endpointId: string): void {
    this.copies.set(endpointId, (this.copies.get(endpointId) ?? 0) + 1);
  }

  trackSearch(query: string, resultCount: number): void {
    this.searches.push({ query, resultCount, timestamp: Date.now() });
  }

  getSummary(endpointId: string, feedback: ApiDocFeedback): DocAnalyticsSummary {
    const sentiment = feedback.getSentiment(endpointId);
    return {
      endpointId,
      views: this.views.get(endpointId) ?? 0,
      copies: this.copies.get(endpointId) ?? 0,
      ...sentiment,
    };
  }

  getTopEndpoints(limit = 5): { endpointId: string; views: number }[] {
    return [...this.views.entries()]
      .map(([endpointId, views]) => ({ endpointId, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  getPopularSearches(limit = 5): { query: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const s of this.searches) {
      counts.set(s.query, (counts.get(s.query) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────

export const apiDocRegistry = new ApiDocRegistry();
export const apiDocGenerator = new ApiDocGenerator(apiDocRegistry);
export const apiDocExporter = new ApiDocExporter(apiDocRegistry);
export const apiDocFeedback = new ApiDocFeedback();
export const apiDocAnalytics = new ApiDocAnalytics();

// ─── Built-in API entries ─────────────────────────────────────────────────────

apiDocRegistry.register({
  id: 'token-transfer',
  name: 'token::transfer',
  description: 'Transfers tokens from one account to another. Requires sender authorization.',
  category: 'contract',
  version: '1.0.0',
  tags: ['token', 'transfer', 'soroban'],
  params: [
    { name: 'from', type: 'Address', required: true, description: 'Sender address.', example: 'GABC...' },
    { name: 'to', type: 'Address', required: true, description: 'Recipient address.', example: 'GXYZ...' },
    { name: 'amount', type: 'i128', required: true, description: 'Amount in stroops.', example: 1000000 },
  ],
  returns: { type: 'void', description: 'Emits a Transfer event on success.' },
  examples: [
    { title: 'Transfer 1 XLM', code: `client.transfer({ from: senderAddr, to: recipientAddr, amount: 10_000_000n })` },
  ],
  errors: [
    { code: 'InsufficientBalance', description: 'Sender balance is too low.' },
    { code: 'Unauthorized', description: 'Sender has not authorized the transfer.' },
  ],
  changelog: [{ version: '1.0.0', date: '2025-01-01', breaking: false, changes: ['Initial release'] }],
});

apiDocRegistry.register({
  id: 'escrow-deposit',
  name: 'escrow::deposit',
  description: 'Deposits tokens into escrow. Locks funds until release or refund.',
  category: 'contract',
  version: '1.0.0',
  tags: ['escrow', 'deposit', 'soroban'],
  params: [
    { name: 'buyer', type: 'Address', required: true, description: 'Buyer address.' },
    { name: 'amount', type: 'i128', required: true, description: 'Amount to lock in escrow.' },
  ],
  returns: { type: 'void', description: 'Emits a Deposit event.' },
  examples: [
    { title: 'Deposit to escrow', code: `client.deposit({ buyer: buyerAddr, amount: 50_000_000n })` },
  ],
  errors: [{ code: 'AlreadyDeposited', description: 'Escrow already has a deposit.' }],
  changelog: [{ version: '1.0.0', date: '2025-01-01', breaking: false, changes: ['Initial release'] }],
});

apiDocRegistry.register({
  id: 'contract-service-invoke',
  name: 'contractService.invoke',
  description: 'Invokes a Soroban contract function from the frontend with automatic retry and error handling.',
  category: 'service',
  version: '1.0.0',
  tags: ['contract', 'invoke', 'frontend', 'service'],
  params: [
    { name: 'contractId', type: 'string', required: true, description: 'Deployed contract ID.' },
    { name: 'method', type: 'string', required: true, description: 'Contract method name.' },
    { name: 'args', type: 'unknown[]', required: false, description: 'Method arguments.' },
  ],
  returns: { type: 'Promise<unknown>', description: 'Decoded contract return value.' },
  examples: [
    { title: 'Invoke transfer', code: `await contractService.invoke(contractId, 'transfer', [from, to, amount])` },
  ],
  changelog: [{ version: '1.0.0', date: '2025-01-01', breaking: false, changes: ['Initial release'] }],
});
