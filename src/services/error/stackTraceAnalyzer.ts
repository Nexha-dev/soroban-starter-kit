/**
 * Stack Trace Analyzer
 * Parses stack traces, extracts reproduction context, and provides debugging hints
 */

export interface StackFrame {
  fn: string;
  file: string;
  line: number;
  col: number;
}

export interface TraceAnalysis {
  frames: StackFrame[];
  origin: string; // first non-library frame
  isLibraryError: boolean;
  reproductionSteps: string[];
  debugHints: string[];
}

const LIBRARY_PATTERNS = [/node_modules/, /webpack/, /vite/, /react-dom/];

function parseFrame(line: string): StackFrame | null {
  // "  at FunctionName (file.ts:10:5)" or "  at file.ts:10:5"
  const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
  if (!match) return null;
  return {
    fn: match[1]?.trim() || '(anonymous)',
    file: match[2],
    line: parseInt(match[3]),
    col: parseInt(match[4]),
  };
}

class StackTraceAnalyzer {
  analyze(stack: string | undefined, context?: Record<string, any>): TraceAnalysis {
    const lines = (stack ?? '').split('\n').filter(l => l.includes(' at '));
    const frames = lines.map(parseFrame).filter((f): f is StackFrame => f !== null);

    const appFrames = frames.filter(f => !LIBRARY_PATTERNS.some(p => p.test(f.file)));
    const origin = appFrames[0]
      ? `${appFrames[0].fn} (${appFrames[0].file}:${appFrames[0].line})`
      : frames[0]
        ? `${frames[0].fn} (${frames[0].file}:${frames[0].line})`
        : 'Unknown origin';

    const isLibraryError = appFrames.length === 0 && frames.length > 0;

    const reproductionSteps = this.buildReproSteps(appFrames, context);
    const debugHints = this.buildDebugHints(frames, isLibraryError, context);

    return { frames, origin, isLibraryError, reproductionSteps, debugHints };
  }

  private buildReproSteps(frames: StackFrame[], context?: Record<string, any>): string[] {
    const steps: string[] = ['Open the application in a browser'];

    if (context?.url) steps.push(`Navigate to: ${context.url}`);
    if (context?.action) steps.push(`Perform action: ${context.action}`);

    if (frames.length > 0) {
      steps.push(`Error originates in: ${frames[0].file} at line ${frames[0].line}`);
    }

    if (context) {
      const relevant = Object.entries(context)
        .filter(([k]) => !['url', 'action'].includes(k))
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
      if (relevant.length > 0) steps.push(`Context: ${relevant.join(', ')}`);
    }

    steps.push('Check browser console for additional details');
    return steps;
  }

  private buildDebugHints(frames: StackFrame[], isLibraryError: boolean, context?: Record<string, any>): string[] {
    const hints: string[] = [];

    if (isLibraryError) hints.push('Error originates in a third-party library — check for version incompatibilities');
    if (frames.length > 10) hints.push('Deep call stack detected — check for infinite recursion');

    const asyncFrames = frames.filter(f => f.fn.includes('async') || f.fn.includes('Promise'));
    if (asyncFrames.length > 0) hints.push('Async error — ensure all promises have proper error handling');

    if (context?.retryAttempt && context.retryAttempt > 2) {
      hints.push('Multiple retry attempts failed — check network connectivity or server status');
    }

    if (hints.length === 0) hints.push('Add breakpoints at the origin frame to inspect local state');

    return hints;
  }

  formatStack(frames: StackFrame[], limit = 5): string {
    return frames
      .slice(0, limit)
      .map(f => `  at ${f.fn} (${f.file}:${f.line}:${f.col})`)
      .join('\n');
  }
}

export const stackTraceAnalyzer = new StackTraceAnalyzer();
export default stackTraceAnalyzer;
