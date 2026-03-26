/**
 * Bundle Analyzer
 * Analyzes bundle composition and provides code splitting recommendations
 */

export interface ChunkInfo {
  name: string;
  size: number; // bytes
  type: 'initial' | 'async' | 'vendor';
  modules: string[];
}

export interface BundleReport {
  timestamp: number;
  totalSize: number;
  chunks: ChunkInfo[];
  recommendations: string[];
  splitOpportunities: SplitOpportunity[];
}

export interface SplitOpportunity {
  route: string;
  estimatedSavings: number; // bytes saved on initial load
  priority: 'high' | 'medium' | 'low';
}

class BundleAnalyzer {
  private reports: BundleReport[] = [];

  /**
   * Analyze resource timing entries to approximate bundle sizes
   */
  analyze(): BundleReport {
    const chunks = this.collectChunks();
    const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
    const recommendations = this.generateRecommendations(chunks, totalSize);
    const splitOpportunities = this.detectSplitOpportunities(chunks);

    const report: BundleReport = {
      timestamp: Date.now(),
      totalSize,
      chunks,
      recommendations,
      splitOpportunities,
    };

    this.reports.push(report);
    if (this.reports.length > 20) this.reports.shift();

    return report;
  }

  private collectChunks(): ChunkInfo[] {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const chunks: ChunkInfo[] = [];

    for (const entry of entries) {
      if (!entry.name.match(/\.(js|css)(\?.*)?$/)) continue;

      const size = entry.transferSize || entry.encodedBodySize || 0;
      const name = entry.name.split('/').pop() || entry.name;
      const isVendor = name.includes('vendor') || name.includes('node_modules');
      const isAsync = entry.initiatorType === 'script' && !document.querySelector(`script[src="${entry.name}"]`);

      chunks.push({
        name,
        size,
        type: isVendor ? 'vendor' : isAsync ? 'async' : 'initial',
        modules: [],
      });
    }

    return chunks;
  }

  private generateRecommendations(chunks: ChunkInfo[], totalSize: number): string[] {
    const recs: string[] = [];

    const initialSize = chunks.filter(c => c.type === 'initial').reduce((s, c) => s + c.size, 0);
    if (initialSize > 200 * 1024) {
      recs.push(`Initial bundle is ${(initialSize / 1024).toFixed(0)}KB — consider lazy loading non-critical routes`);
    }

    const vendorSize = chunks.filter(c => c.type === 'vendor').reduce((s, c) => s + c.size, 0);
    if (vendorSize > 500 * 1024) {
      recs.push(`Vendor bundle is ${(vendorSize / 1024).toFixed(0)}KB — audit dependencies for lighter alternatives`);
    }

    if (totalSize > 1024 * 1024) {
      recs.push(`Total transfer size ${(totalSize / 1024).toFixed(0)}KB exceeds 1MB — enable compression and tree-shaking`);
    }

    const largeChunks = chunks.filter(c => c.size > 100 * 1024);
    for (const chunk of largeChunks) {
      recs.push(`Chunk "${chunk.name}" is ${(chunk.size / 1024).toFixed(0)}KB — consider splitting`);
    }

    if (recs.length === 0) recs.push('Bundle sizes look healthy');

    return recs;
  }

  private detectSplitOpportunities(chunks: ChunkInfo[]): SplitOpportunity[] {
    const opportunities: SplitOpportunity[] = [];
    const routes = ['/portfolio', '/transactions', '/contracts', '/settings'];

    for (const route of routes) {
      const relatedChunks = chunks.filter(c => c.name.toLowerCase().includes(route.replace('/', '')));
      const savings = relatedChunks.reduce((s, c) => s + c.size, 0);
      if (savings > 0) {
        opportunities.push({
          route,
          estimatedSavings: savings,
          priority: savings > 100 * 1024 ? 'high' : savings > 50 * 1024 ? 'medium' : 'low',
        });
      }
    }

    // Suggest splitting large initial chunks
    const largeInitial = chunks.filter(c => c.type === 'initial' && c.size > 80 * 1024);
    for (const chunk of largeInitial) {
      opportunities.push({
        route: `/${chunk.name.replace(/\.[^.]+$/, '')}`,
        estimatedSavings: Math.floor(chunk.size * 0.4),
        priority: 'medium',
      });
    }

    return opportunities;
  }

  getLatestReport(): BundleReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  getReports(): BundleReport[] {
    return [...this.reports];
  }
}

export const bundleAnalyzer = new BundleAnalyzer();
export default bundleAnalyzer;
