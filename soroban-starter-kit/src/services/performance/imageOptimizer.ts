/**
 * Image Optimizer
 * Handles image optimization, lazy loading, and format recommendations
 */

export interface ImageEntry {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  transferSize: number;
  isLazy: boolean;
  format: string;
}

export interface ImageOptimizationReport {
  timestamp: number;
  images: ImageEntry[];
  totalSize: number;
  potentialSavings: number;
  recommendations: ImageRecommendation[];
}

export interface ImageRecommendation {
  src: string;
  issue: string;
  suggestion: string;
  estimatedSavings: number;
}

class ImageOptimizer {
  private reports: ImageOptimizationReport[] = [];

  /**
   * Audit all images on the page
   */
  audit(): ImageOptimizationReport {
    const images = this.collectImageData();
    const recommendations = this.generateRecommendations(images);
    const totalSize = images.reduce((s, i) => s + i.transferSize, 0);
    const potentialSavings = recommendations.reduce((s, r) => s + r.estimatedSavings, 0);

    const report: ImageOptimizationReport = {
      timestamp: Date.now(),
      images,
      totalSize,
      potentialSavings,
      recommendations,
    };

    this.reports.push(report);
    if (this.reports.length > 20) this.reports.shift();

    return report;
  }

  private collectImageData(): ImageEntry[] {
    const imgElements = Array.from(document.querySelectorAll('img'));
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const resourceMap = new Map(resourceEntries.map(e => [e.name, e]));

    return imgElements.map(img => {
      const entry = resourceMap.get(img.src);
      const format = img.src.split('.').pop()?.split('?')[0]?.toLowerCase() || 'unknown';

      return {
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.clientWidth,
        displayHeight: img.clientHeight,
        transferSize: entry?.transferSize || 0,
        isLazy: img.loading === 'lazy',
        format,
      };
    });
  }

  private generateRecommendations(images: ImageEntry[]): ImageRecommendation[] {
    const recs: ImageRecommendation[] = [];

    for (const img of images) {
      // Oversized images
      if (img.naturalWidth > img.displayWidth * 2 && img.displayWidth > 0) {
        recs.push({
          src: img.src,
          issue: `Image is ${img.naturalWidth}px wide but displayed at ${img.displayWidth}px`,
          suggestion: `Serve a ${img.displayWidth * 2}px version (2x for retina) instead`,
          estimatedSavings: Math.floor(img.transferSize * 0.5),
        });
      }

      // Non-lazy images below the fold
      if (!img.isLazy && img.transferSize > 10 * 1024) {
        recs.push({
          src: img.src,
          issue: 'Image is not lazy-loaded',
          suggestion: 'Add loading="lazy" to defer off-screen images',
          estimatedSavings: 0,
        });
      }

      // Non-WebP/AVIF format
      if (['jpg', 'jpeg', 'png'].includes(img.format) && img.transferSize > 20 * 1024) {
        recs.push({
          src: img.src,
          issue: `Image uses ${img.format.toUpperCase()} format`,
          suggestion: 'Convert to WebP or AVIF for 25-50% smaller file sizes',
          estimatedSavings: Math.floor(img.transferSize * 0.35),
        });
      }
    }

    return recs;
  }

  /**
   * Apply lazy loading to all images that don't have it
   */
  applyLazyLoading(): number {
    const images = document.querySelectorAll('img:not([loading])');
    images.forEach(img => img.setAttribute('loading', 'lazy'));
    return images.length;
  }

  getLatestReport(): ImageOptimizationReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }
}

export const imageOptimizer = new ImageOptimizer();
export default imageOptimizer;
