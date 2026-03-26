// Design tokens — mobile-first, touch-optimized
export const theme = {
  colors: {
    primary: '#6C63FF',
    secondary: '#3ECFCF',
    background: '#0F0F1A',
    surface: '#1A1A2E',
    surfaceAlt: '#16213E',
    text: '#FFFFFF',
    textMuted: '#8888AA',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    border: '#2A2A4A',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  // Minimum 44pt touch targets (Apple HIG / Material guidelines)
  touchTarget: 44,
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 20,
    full: 9999,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
};
