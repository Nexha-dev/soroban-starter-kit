import { errorHandler } from '../services/error/errorHandler';
import { errorAnalytics } from '../services/error/errorAnalytics';
import { useState, useEffect } from 'react';

/**
 * Hook for error handling
 */
export function useErrorHandler() {
  const handleError = (error: Error | string, context?: Record<string, any>) => {
    const errorInfo = errorHandler.handleError(error, context);
    errorAnalytics.trackError(errorInfo.category, errorInfo.message);
    return errorInfo;
  };

  const retry = async (errorId: string) => {
    return errorHandler.retry(errorId);
  };

  return { handleError, retry };
}

/**
 * Hook for error monitoring
 */
export function useErrorMonitoring() {
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = errorHandler.subscribe((error) => {
      setErrors((prev) => [...prev, error].slice(-10));
    });

    return unsubscribe;
  }, []);

  return errors;
}

/**
 * Hook for error analytics
 */
export function useErrorAnalytics() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(errorAnalytics.getMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

/**
 * Hook for crash reporting
 */
export function useCrashReporting() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errors = errorHandler.getErrors();
      errorAnalytics.reportCrash(errors.length, event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
}
