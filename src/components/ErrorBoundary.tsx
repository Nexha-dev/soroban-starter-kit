import React, { ReactNode, useState, useEffect } from 'react';
import { errorHandler, type ErrorInfo } from '../services/error/errorHandler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: ErrorInfo, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: ErrorInfo | null;
}

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorInfo = errorHandler.handleError(error);
    return { hasError: true, error: errorInfo };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  retry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }
      return <DefaultErrorFallback error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
function DefaultErrorFallback({ error, retry }: { error: ErrorInfo; retry: () => void }): JSX.Element {
  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '4px',
        color: '#721c24',
      }}
    >
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button
        onClick={retry}
        style={{
          padding: '8px 16px',
          backgroundColor: '#721c24',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Error Display Component
 */
export function ErrorDisplay(): JSX.Element {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  useEffect(() => {
    const unsubscribe = errorHandler.subscribe((error) => {
      setErrors((prev) => [...prev, error].slice(-5));
    });

    return unsubscribe;
  }, []);

  if (errors.length === 0) return <></>;

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, maxWidth: '400px' }}>
      {errors.map((error) => (
        <div
          key={error.id}
          style={{
            padding: '12px',
            marginBottom: '10px',
            backgroundColor: error.severity === 'critical' ? '#f8d7da' : '#fff3cd',
            border: `1px solid ${error.severity === 'critical' ? '#f5c6cb' : '#ffeaa7'}`,
            borderRadius: '4px',
            color: error.severity === 'critical' ? '#721c24' : '#856404',
          }}
        >
          <strong>{error.category}:</strong> {error.message}
        </div>
      ))}
    </div>
  );
}

export default ErrorBoundary;
