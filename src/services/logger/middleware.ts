/**
 * Request/Response Logging Middleware
 * Patches globalThis.fetch to log all outbound requests with correlation IDs,
 * response status, and timing.
 */

import { logger } from './index';

let patched = false;

export function installFetchLogger(): void {
  if (patched || typeof globalThis.fetch === 'undefined') return;
  patched = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const correlationId = logger.generateCorrelationId();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const start = performance.now();

    logger.setCorrelationId(correlationId);
    logger.info('request', { method, url, correlationId });

    try {
      const response = await originalFetch(input, init);
      const duration = Math.round(performance.now() - start);

      logger.info('response', {
        method,
        url,
        status: response.status,
        ok: response.ok,
        durationMs: duration,
        correlationId,
      });

      logger.perf(`fetch:${method}:${new URL(url, location.href).pathname}`, duration, {
        status: response.status,
        correlationId,
      });

      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      logger.error('request:failed', {
        method,
        url,
        durationMs: duration,
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      logger.clearCorrelationId();
    }
  };
}

export function uninstallFetchLogger(): void {
  patched = false;
}
