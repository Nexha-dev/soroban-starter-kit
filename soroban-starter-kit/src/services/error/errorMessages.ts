/**
 * Error Messages
 * User-friendly error messages and fallback UI
 */

export interface ErrorMessage {
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
}

const errorMessages: Record<string, ErrorMessage> = {
  network: {
    title: 'Connection Error',
    description: 'Unable to connect to the server. Please check your internet connection.',
    action: 'retry',
    actionLabel: 'Retry',
  },
  validation: {
    title: 'Invalid Input',
    description: 'Please check your input and try again.',
    action: 'dismiss',
    actionLabel: 'Dismiss',
  },
  auth: {
    title: 'Authentication Failed',
    description: 'Your session has expired. Please log in again.',
    action: 'login',
    actionLabel: 'Log In',
  },
  permission: {
    title: 'Access Denied',
    description: 'You do not have permission to perform this action.',
    action: 'dismiss',
    actionLabel: 'Dismiss',
  },
  server: {
    title: 'Server Error',
    description: 'The server encountered an error. Please try again later.',
    action: 'retry',
    actionLabel: 'Retry',
  },
  client: {
    title: 'Application Error',
    description: 'An unexpected error occurred. Please refresh the page.',
    action: 'refresh',
    actionLabel: 'Refresh',
  },
  unknown: {
    title: 'Error',
    description: 'An error occurred. Please try again.',
    action: 'retry',
    actionLabel: 'Retry',
  },
};

export function getErrorMessage(category: string): ErrorMessage {
  return errorMessages[category] || errorMessages.unknown;
}

export function getUserFriendlyMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
