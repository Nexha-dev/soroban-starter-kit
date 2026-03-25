import { errorHandler } from '../errorHandler';
import { errorAnalytics } from '../errorAnalytics';

describe('ErrorHandler', () => {
  beforeEach(() => {
    errorHandler.clearErrors();
  });

  describe('Error Handling', () => {
    it('should handle errors', () => {
      const error = errorHandler.handleError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.id).toBeDefined();
    });

    it('should categorize errors', () => {
      const networkError = errorHandler.handleError('network timeout');
      expect(networkError.category).toBe('network');

      const validationError = errorHandler.handleError('validation failed');
      expect(validationError.category).toBe('validation');
    });

    it('should determine severity', () => {
      const criticalError = errorHandler.handleError('client syntax error');
      expect(criticalError.severity).toBe('critical');

      const lowError = errorHandler.handleError('validation error');
      expect(lowError.severity).toBe('low');
    });

    it('should mark retryable errors', () => {
      const networkError = errorHandler.handleError('network error');
      expect(networkError.retryable).toBe(true);

      const validationError = errorHandler.handleError('validation error');
      expect(validationError.retryable).toBe(false);
    });
  });

  describe('Error Retrieval', () => {
    it('should get all errors', () => {
      errorHandler.handleError('Error 1');
      errorHandler.handleError('Error 2');

      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(2);
    });

    it('should get errors by category', () => {
      errorHandler.handleError('network error');
      errorHandler.handleError('validation error');

      const networkErrors = errorHandler.getErrorsByCategory('network');
      expect(networkErrors.length).toBe(1);
    });
  });

  describe('Error Reporting', () => {
    it('should generate report', () => {
      errorHandler.handleError('Test error');
      const report = errorHandler.generateReport();

      expect(report.errors.length).toBe(1);
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.userAgent).toBeDefined();
    });
  });

  describe('Error Subscriptions', () => {
    it('should notify listeners', (done) => {
      errorHandler.subscribe((error) => {
        expect(error.message).toBe('Test error');
        done();
      });

      errorHandler.handleError('Test error');
    });
  });
});

describe('ErrorAnalytics', () => {
  beforeEach(() => {
    errorAnalytics.clear();
  });

  it('should track errors', () => {
    errorAnalytics.trackError('network', 'timeout');
    errorAnalytics.trackError('network', 'timeout');

    const metrics = errorAnalytics.getMetrics();
    expect(metrics.totalErrors).toBe(2);
  });

  it('should report crashes', () => {
    errorAnalytics.reportCrash(5, new Error('Test'));
    const crashes = errorAnalytics.getCrashReports();

    expect(crashes.length).toBe(1);
    expect(crashes[0].errorCount).toBe(5);
  });

  it('should calculate metrics', () => {
    errorAnalytics.trackError('network', 'error1');
    errorAnalytics.trackError('network', 'error2');
    errorAnalytics.trackError('validation', 'error3');

    const metrics = errorAnalytics.getMetrics();
    expect(metrics.totalErrors).toBe(3);
    expect(metrics.errorsByCategory['network']).toBe(2);
    expect(metrics.errorsByCategory['validation']).toBe(1);
  });
});
