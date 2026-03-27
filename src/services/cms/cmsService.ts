/**
 * Content Management System Service
 *
 * Handles content editing, versioning, publishing workflows, scheduling,
 * multimedia, moderation, SEO, personalization, multi-language support,
 * and content performance tracking.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType =
  | 'announcement'
  | 'article'
  | 'tutorial'
  | 'faq'
  | 'changelog'
  | 'page';

export type ContentStatus =
  | 'draft'
  | 'in-review'
  | 'approved'
  | 'published'
  | 'scheduled'
  | 'archived';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'pt';

export type UserSegment = 'all' | 'new' | 'casual' | 'regular' | 'power';

export interface ContentVersion {
  versionId: string;
  versionNumber: number;
  title: string;
  body: string;
  editedBy: string;
  editedAt: number;
  changeNote: string;
}

export interface MediaAttachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  size: number; // bytes
  uploadedAt: number;
  altText?: string;
}

export interface SEOMetadata {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl?: string;
  ogImage?: string;
  keywords: string[];
  structuredData?: string; // JSON-LD
  readabilityScore: number; // 0-100
  seoScore: number; // 0-100
}

export interface ContentAnalytics {
  views: number;
  uniqueViews: number;
  avgReadTimeMs: number;
  bounceRate: number; // 0-1
  shares: number;
  comments: number;
  reactions: number;
  ctr: number; // click-through rate 0-1
  conversionRate: number; // 0-1
  trendData: Array<{ date: string; views: number }>;
}

export interface ContentTranslation {
  locale: SupportedLocale;
  title: string;
  body: string;
  status: ContentStatus;
  translatedAt: number;
  translatedBy: string;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  status: ContentStatus;
  moderationStatus: ModerationStatus;
  title: string;
  body: string;
  excerpt: string;
  author: string;
  tags: string[];
  category: string;
  locale: SupportedLocale;
  targetSegment: UserSegment;
  attachments: MediaAttachment[];
  seo: SEOMetadata;
  analytics: ContentAnalytics;
  translations: ContentTranslation[];
  versions: ContentVersion[];
  currentVersion: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  scheduledAt?: number;
  expiresAt?: number;
  moderationNote?: string;
  featured: boolean;
}

export interface PublishingWorkflow {
  contentId: string;
  steps: WorkflowStep[];
  currentStep: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'rejected';
  assignee: string;
  completedAt?: number;
  note?: string;
}

export interface CMSStats {
  total: number;
  byStatus: Record<ContentStatus, number>;
  byType: Record<ContentType, number>;
  published: number;
  scheduled: number;
  pendingModeration: number;
  avgSEOScore: number;
  totalViews: number;
  topContent: Array<{ id: string; title: string; views: number }>;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English', es: 'Spanish', fr: 'French',
  de: 'German', zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese',
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

function trendData(days: number, base: number): Array<{ date: string; views: number }> {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(daysAgo(days - i)).toISOString().slice(0, 10),
    views: Math.max(0, Math.round(base + (Math.random() - 0.4) * base * 0.6)),
  }));
}

function makeSEO(title: string, score: number): SEOMetadata {
  const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return {
    metaTitle: title,
    metaDescription: `Learn about ${title.toLowerCase()} on Fidelis. Comprehensive guide for Soroban DApp users.`,
    slug,
    keywords: title.toLowerCase().split(' ').slice(0, 4),
    readabilityScore: Math.round(60 + Math.random() * 35),
    seoScore: score,
  };
}

function makeAnalytics(views: number): ContentAnalytics {
  return {
    views,
    uniqueViews: Math.round(views * 0.75),
    avgReadTimeMs: Math.round(90_000 + Math.random() * 300_000),
    bounceRate: parseFloat((0.2 + Math.random() * 0.5).toFixed(2)),
    shares: Math.round(views * 0.03),
    comments: Math.round(views * 0.015),
    reactions: Math.round(views * 0.08),
    ctr: parseFloat((0.02 + Math.random() * 0.12).toFixed(3)),
    conversionRate: parseFloat((0.005 + Math.random() * 0.04).toFixed(3)),
    trendData: trendData(14, views / 14),
  };
}

function makeVersion(
  n: number,
  title: string,
  body: string,
  author: string
): ContentVersion {
  return {
    versionId: uid(),
    versionNumber: n,
    title,
    body,
    editedBy: author,
    editedAt: daysAgo(10 - n),
    changeNote: n === 1 ? 'Initial draft' : `Revision ${n}: updated content`,
  };
}

const SEED_ITEMS: Omit<ContentItem, 'id'>[] = [
  {
    type: 'announcement',
    status: 'published',
    moderationStatus: 'approved',
    title: 'Soroban Mainnet Launch',
    body: '## Soroban Mainnet is Live\n\nWe are thrilled to announce that Soroban smart contracts are now live on Stellar Mainnet. Start building today with the Fidelis starter kit.',
    excerpt: 'Soroban smart contracts are now live on Stellar Mainnet.',
    author: 'Darkdante9',
    tags: ['soroban', 'mainnet', 'stellar'],
    category: 'News',
    locale: 'en',
    targetSegment: 'all',
    featured: true,
    attachments: [],
    seo: makeSEO('Soroban Mainnet Launch', 88),
    analytics: makeAnalytics(4200),
    versions: [makeVersion(1, 'Soroban Mainnet Launch', '...', 'Darkdante9'), makeVersion(2, 'Soroban Mainnet Launch', '...', 'Darkdante9')],
    currentVersion: 2,
    translations: [
      { locale: 'es', title: 'Lanzamiento de Soroban Mainnet', body: '...', status: 'published', translatedAt: daysAgo(2), translatedBy: 'auto' },
      { locale: 'fr', title: 'Lancement de Soroban Mainnet', body: '...', status: 'published', translatedAt: daysAgo(2), translatedBy: 'auto' },
    ],
    createdAt: daysAgo(15),
    updatedAt: daysAgo(3),
    publishedAt: daysAgo(10),
  },
  {
    type: 'tutorial',
    status: 'published',
    moderationStatus: 'approved',
    title: 'Getting Started with Token Transfers',
    body: '## Your First Token Transfer\n\nThis tutorial walks you through executing your first token transfer using the Fidelis DApp interface. Follow these steps carefully.',
    excerpt: 'Step-by-step guide to executing your first Soroban token transfer.',
    author: 'Darkdante9',
    tags: ['tutorial', 'transfer', 'beginner'],
    category: 'Tutorials',
    locale: 'en',
    targetSegment: 'new',
    featured: false,
    attachments: [
      { id: uid(), name: 'transfer-screenshot.png', type: 'image', url: '/media/transfer-screenshot.png', size: 142000, uploadedAt: daysAgo(12), altText: 'Transfer UI screenshot' },
    ],
    seo: makeSEO('Getting Started with Token Transfers', 91),
    analytics: makeAnalytics(2800),
    versions: [makeVersion(1, 'Getting Started with Token Transfers', '...', 'Darkdante9')],
    currentVersion: 1,
    translations: [
      { locale: 'zh', title: '代币转账入门', body: '...', status: 'draft', translatedAt: daysAgo(1), translatedBy: 'auto' },
    ],
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
    publishedAt: daysAgo(18),
  },
  {
    type: 'article',
    status: 'in-review',
    moderationStatus: 'pending',
    title: 'Understanding Soroban Contract Fees',
    body: '## Fee Structure\n\nSoroban introduces a new resource-based fee model. This article explains how fees are calculated and how to optimise your contracts for cost efficiency.',
    excerpt: 'Deep dive into Soroban resource-based fee model and cost optimisation.',
    author: 'contributor1',
    tags: ['fees', 'contracts', 'advanced'],
    category: 'Deep Dives',
    locale: 'en',
    targetSegment: 'power',
    featured: false,
    attachments: [],
    seo: makeSEO('Understanding Soroban Contract Fees', 74),
    analytics: makeAnalytics(0),
    versions: [makeVersion(1, 'Understanding Soroban Contract Fees', '...', 'contributor1'), makeVersion(2, 'Understanding Soroban Contract Fees', '...', 'contributor1')],
    currentVersion: 2,
    translations: [],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
  },
  {
    type: 'faq',
    status: 'published',
    moderationStatus: 'approved',
    title: 'Frequently Asked Questions — Wallet Setup',
    body: '## Wallet Setup FAQ\n\n**Q: Which wallets are supported?**\nA: Fidelis supports Freighter and any WalletConnect-compatible wallet.\n\n**Q: How do I import an existing account?**\nA: Use the import feature in Freighter using your secret key or mnemonic phrase.',
    excerpt: 'Answers to the most common questions about wallet setup and connection.',
    author: 'Darkdante9',
    tags: ['faq', 'wallet', 'setup'],
    category: 'Support',
    locale: 'en',
    targetSegment: 'new',
    featured: false,
    attachments: [],
    seo: makeSEO('FAQ Wallet Setup', 82),
    analytics: makeAnalytics(1950),
    versions: [makeVersion(1, 'Frequently Asked Questions — Wallet Setup', '...', 'Darkdante9')],
    currentVersion: 1,
    translations: [
      { locale: 'de', title: 'FAQ — Wallet-Einrichtung', body: '...', status: 'published', translatedAt: daysAgo(7), translatedBy: 'auto' },
    ],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(8),
    publishedAt: daysAgo(28),
  },
  {
    type: 'changelog',
    status: 'scheduled',
    moderationStatus: 'approved',
    title: 'Changelog v1.4.0 — Offline Support & PWA',
    body: '## v1.4.0\n\n- Added full offline mode with IndexedDB caching\n- Progressive Web App support with install prompt\n- Background sync for pending transactions\n- Performance improvements across all dashboards',
    excerpt: 'Release notes for v1.4.0 featuring offline support and PWA capabilities.',
    author: 'Darkdante9',
    tags: ['changelog', 'release', 'pwa', 'offline'],
    category: 'Releases',
    locale: 'en',
    targetSegment: 'all',
    featured: false,
    attachments: [],
    seo: makeSEO('Changelog v1.4.0', 78),
    analytics: makeAnalytics(0),
    versions: [makeVersion(1, 'Changelog v1.4.0', '...', 'Darkdante9')],
    currentVersion: 1,
    translations: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(0),
    scheduledAt: Date.now() + 2 * 86_400_000, // in 2 days
  },
  {
    type: 'article',
    status: 'draft',
    moderationStatus: 'pending',
    title: 'Building Custom Workflows with Fidelis',
    body: '## Custom Workflows\n\nThe workflow engine lets you chain multiple contract interactions into automated sequences...',
    excerpt: 'Learn how to chain contract interactions using the Fidelis workflow engine.',
    author: 'contributor2',
    tags: ['workflows', 'automation', 'advanced'],
    category: 'Tutorials',
    locale: 'en',
    targetSegment: 'regular',
    featured: false,
    attachments: [],
    seo: makeSEO('Building Custom Workflows', 55),
    analytics: makeAnalytics(0),
    versions: [makeVersion(1, 'Building Custom Workflows with Fidelis', '...', 'contributor2')],
    currentVersion: 1,
    translations: [],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0),
  },
  {
    type: 'announcement',
    status: 'archived',
    moderationStatus: 'approved',
    title: 'Testnet Migration Complete',
    body: '## Testnet Migration\n\nThe Futurenet → Testnet migration has been completed successfully. All developer tooling has been updated.',
    excerpt: 'Futurenet to Testnet migration completed.',
    author: 'Darkdante9',
    tags: ['testnet', 'migration'],
    category: 'News',
    locale: 'en',
    targetSegment: 'all',
    featured: false,
    attachments: [],
    seo: makeSEO('Testnet Migration Complete', 70),
    analytics: makeAnalytics(890),
    versions: [makeVersion(1, 'Testnet Migration Complete', '...', 'Darkdante9')],
    currentVersion: 1,
    translations: [],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(55),
    publishedAt: daysAgo(58),
  },
  {
    type: 'article',
    status: 'published',
    moderationStatus: 'flagged',
    title: 'Third-Party Integrations Guide',
    body: '## Integrating External Services\n\nThis guide covers how to connect third-party APIs to your Soroban contracts...',
    excerpt: 'How to integrate external APIs with Soroban contracts.',
    author: 'contributor3',
    tags: ['integrations', 'api', 'advanced'],
    category: 'Deep Dives',
    locale: 'en',
    targetSegment: 'power',
    featured: false,
    attachments: [],
    seo: makeSEO('Third-Party Integrations Guide', 68),
    analytics: makeAnalytics(640),
    versions: [makeVersion(1, 'Third-Party Integrations Guide', '...', 'contributor3')],
    currentVersion: 1,
    translations: [],
    moderationNote: 'Contains unverified external links. Requires review before remaining published.',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(3),
    publishedAt: daysAgo(9),
  },
];

// ─── Workflows ────────────────────────────────────────────────────────────────

function makeWorkflow(contentId: string, currentStep: number): PublishingWorkflow {
  const steps: WorkflowStep[] = [
    { id: uid(), name: 'Author Submission', assignee: 'contributor', status: 'completed', completedAt: daysAgo(3) },
    { id: uid(), name: 'Editorial Review', assignee: 'editor', status: currentStep >= 1 ? (currentStep > 1 ? 'completed' : 'in-progress') : 'pending', completedAt: currentStep > 1 ? daysAgo(1) : undefined },
    { id: uid(), name: 'SEO Check', assignee: 'seo-team', status: currentStep >= 2 ? (currentStep > 2 ? 'completed' : 'in-progress') : 'pending' },
    { id: uid(), name: 'Final Approval', assignee: 'Darkdante9', status: currentStep >= 3 ? 'in-progress' : 'pending' },
    { id: uid(), name: 'Publish', assignee: 'system', status: 'pending' },
  ];
  return { contentId, steps, currentStep };
}

// ─── CMS Service ──────────────────────────────────────────────────────────────

class CMSService {
  private items: ContentItem[];
  private workflows: Map<string, PublishingWorkflow> = new Map();

  constructor() {
    this.items = SEED_ITEMS.map((item) => ({ ...item, id: uid() }));

    // Create workflows for in-review items
    this.items
      .filter((i) => i.status === 'in-review')
      .forEach((i) => this.workflows.set(i.id, makeWorkflow(i.id, 1)));
  }

  // ── Content CRUD ──────────────────────────────────────────────────────────

  getAll(filters?: { status?: ContentStatus; type?: ContentType; locale?: SupportedLocale }): ContentItem[] {
    let items = [...this.items];
    if (filters?.status) items = items.filter((i) => i.status === filters.status);
    if (filters?.type) items = items.filter((i) => i.type === filters.type);
    if (filters?.locale) items = items.filter((i) => i.locale === filters.locale);
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getById(id: string): ContentItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  create(partial: Pick<ContentItem, 'type' | 'title' | 'body' | 'author' | 'locale' | 'category' | 'targetSegment'>): ContentItem {
    const now = Date.now();
    const slug = partial.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const item: ContentItem = {
      id: uid(),
      status: 'draft',
      moderationStatus: 'pending',
      excerpt: partial.body.replace(/#+\s/g, '').slice(0, 120) + '…',
      tags: [],
      featured: false,
      attachments: [],
      versions: [{ versionId: uid(), versionNumber: 1, title: partial.title, body: partial.body, editedBy: partial.author, editedAt: now, changeNote: 'Initial draft' }],
      currentVersion: 1,
      translations: [],
      analytics: makeAnalytics(0),
      seo: {
        metaTitle: partial.title,
        metaDescription: '',
        slug,
        keywords: [],
        readabilityScore: 0,
        seoScore: 0,
      },
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    this.items.unshift(item);
    return item;
  }

  update(id: string, changes: Partial<Pick<ContentItem, 'title' | 'body' | 'excerpt' | 'tags' | 'seo' | 'targetSegment'>>, editor: string, changeNote = 'Updated'): ContentItem | null {
    const item = this.items.find((i) => i.id === id);
    if (!item) return null;

    const newVersion: ContentVersion = {
      versionId: uid(),
      versionNumber: item.currentVersion + 1,
      title: changes.title ?? item.title,
      body: changes.body ?? item.body,
      editedBy: editor,
      editedAt: Date.now(),
      changeNote,
    };

    Object.assign(item, changes, {
      updatedAt: Date.now(),
      currentVersion: newVersion.versionNumber,
    });
    item.versions.push(newVersion);
    return item;
  }

  restoreVersion(id: string, versionNumber: number, restoredBy: string): ContentItem | null {
    const item = this.items.find((i) => i.id === id);
    if (!item) return null;
    const version = item.versions.find((v) => v.versionNumber === versionNumber);
    if (!version) return null;
    return this.update(id, { title: version.title, body: version.body }, restoredBy, `Restored from v${versionNumber}`);
  }

  delete(id: string): boolean {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.workflows.delete(id);
    return true;
  }

  // ── Publishing Workflow ───────────────────────────────────────────────────

  submitForReview(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.status !== 'draft') return false;
    item.status = 'in-review';
    item.updatedAt = Date.now();
    this.workflows.set(id, makeWorkflow(id, 1));
    return true;
  }

  approve(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    item.status = 'approved';
    item.moderationStatus = 'approved';
    item.updatedAt = Date.now();
    const wf = this.workflows.get(id);
    if (wf) { wf.currentStep = 3; wf.steps[1].status = 'completed'; wf.steps[1].completedAt = Date.now(); }
    return true;
  }

  publish(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item || (item.status !== 'approved' && item.status !== 'draft')) return false;
    item.status = 'published';
    item.moderationStatus = 'approved';
    item.publishedAt = Date.now();
    item.updatedAt = Date.now();
    return true;
  }

  schedule(id: string, publishAt: number): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    item.status = 'scheduled';
    item.scheduledAt = publishAt;
    item.updatedAt = Date.now();
    return true;
  }

  archive(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    item.status = 'archived';
    item.updatedAt = Date.now();
    return true;
  }

  getWorkflow(id: string): PublishingWorkflow | undefined {
    return this.workflows.get(id);
  }

  // ── Moderation ────────────────────────────────────────────────────────────

  moderate(id: string, decision: 'approved' | 'rejected', note?: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    item.moderationStatus = decision;
    item.moderationNote = note;
    item.updatedAt = Date.now();
    if (decision === 'rejected' && item.status === 'published') {
      item.status = 'archived';
    }
    return true;
  }

  flag(id: string, reason: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    item.moderationStatus = 'flagged';
    item.moderationNote = reason;
    item.updatedAt = Date.now();
    return true;
  }

  getPendingModeration(): ContentItem[] {
    return this.items.filter(
      (i) => i.moderationStatus === 'pending' || i.moderationStatus === 'flagged'
    );
  }

  // ── SEO ───────────────────────────────────────────────────────────────────

  updateSEO(id: string, seo: Partial<SEOMetadata>): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    Object.assign(item.seo, seo);
    // Recalculate SEO score
    let score = 0;
    if (item.seo.metaTitle.length >= 30 && item.seo.metaTitle.length <= 60) score += 25;
    if (item.seo.metaDescription.length >= 120 && item.seo.metaDescription.length <= 160) score += 25;
    if (item.seo.keywords.length >= 3) score += 20;
    if (item.seo.slug.length > 0) score += 15;
    if (item.seo.ogImage) score += 15;
    item.seo.seoScore = score;
    item.updatedAt = Date.now();
    return true;
  }

  // ── Translations ──────────────────────────────────────────────────────────

  addTranslation(id: string, locale: SupportedLocale, title: string, body: string, translatedBy: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    const existing = item.translations.findIndex((t) => t.locale === locale);
    const translation: ContentTranslation = {
      locale, title, body, status: 'draft', translatedAt: Date.now(), translatedBy,
    };
    if (existing >= 0) {
      item.translations[existing] = translation;
    } else {
      item.translations.push(translation);
    }
    item.updatedAt = Date.now();
    return true;
  }

  publishTranslation(id: string, locale: SupportedLocale): boolean {
    const item = this.items.find((i) => i.id === id);
    const t = item?.translations.find((t) => t.locale === locale);
    if (!t) return false;
    t.status = 'published';
    return true;
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  recordView(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.analytics.views++;
      item.analytics.uniqueViews = Math.round(item.analytics.views * 0.75);
      const today = new Date().toISOString().slice(0, 10);
      const td = item.analytics.trendData.find((d) => d.date === today);
      if (td) td.views++; else item.analytics.trendData.push({ date: today, views: 1 });
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats(): CMSStats {
    const byStatus = {} as Record<ContentStatus, number>;
    const byType = {} as Record<ContentType, number>;

    this.items.forEach((i) => {
      byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
      byType[i.type] = (byType[i.type] ?? 0) + 1;
    });

    const published = this.items.filter((i) => i.status === 'published');
    const avgSEO = published.length
      ? published.reduce((s, i) => s + i.seo.seoScore, 0) / published.length
      : 0;

    const topContent = [...this.items]
      .sort((a, b) => b.analytics.views - a.analytics.views)
      .slice(0, 5)
      .map((i) => ({ id: i.id, title: i.title, views: i.analytics.views }));

    return {
      total: this.items.length,
      byStatus,
      byType,
      published: byStatus['published'] ?? 0,
      scheduled: byStatus['scheduled'] ?? 0,
      pendingModeration: this.getPendingModeration().length,
      avgSEOScore: Math.round(avgSEO),
      totalViews: this.items.reduce((s, i) => s + i.analytics.views, 0),
      topContent,
    };
  }

  getSupportedLocales(): Array<{ code: SupportedLocale; name: string }> {
    return (Object.entries(LOCALE_NAMES) as [SupportedLocale, string][]).map(([code, name]) => ({ code, name }));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const cmsService = new CMSService();
