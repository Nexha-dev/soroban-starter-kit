export type ThemeMode = 'dark' | 'light';

export type ColorScheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'high-contrast';

export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';

export interface LayoutTokens {
  density: LayoutDensity;
  fontScale: number; // 0.8 – 1.4
  borderRadius: 'sharp' | 'rounded' | 'pill';
}

export interface ThemeTokens {
  // Core palette
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorHighlight: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  // Text
  colorTextPrimary: string;
  colorTextSecondary: string;
  colorTextMuted: string;
  // Backgrounds
  colorBgPrimary: string;
  colorBgSecondary: string;
  colorBgTertiary: string;
  // Borders
  colorBorder: string;
  colorBorderLight: string;
}

const schemeAccents: Record<ColorScheme, { highlight: string; accent: string }> = {
  default:       { highlight: '#e94560', accent: '#0f3460' },
  ocean:         { highlight: '#00b4d8', accent: '#0077b6' },
  forest:        { highlight: '#52b788', accent: '#1b4332' },
  sunset:        { highlight: '#f4845f', accent: '#c1440e' },
  'high-contrast': { highlight: '#ffff00', accent: '#0000ff' },
};

export function buildTokens(mode: ThemeMode, scheme: ColorScheme): ThemeTokens {
  const { highlight, accent } = schemeAccents[scheme];

  if (mode === 'dark') {
    return {
      colorPrimary: '#1a1a2e',
      colorSecondary: '#16213e',
      colorAccent: accent,
      colorHighlight: highlight,
      colorSuccess: '#00d26a',
      colorWarning: '#ffc107',
      colorError: '#dc3545',
      colorTextPrimary: '#ffffff',
      colorTextSecondary: '#a0a0a0',
      colorTextMuted: '#6c757d',
      colorBgPrimary: '#0f0f1a',
      colorBgSecondary: '#1a1a2e',
      colorBgTertiary: '#252542',
      colorBorder: '#2a2a4a',
      colorBorderLight: '#3a3a5a',
    };
  }

  // Light mode
  return {
    colorPrimary: '#f0f4ff',
    colorSecondary: '#e2e8f8',
    colorAccent: accent,
    colorHighlight: highlight,
    colorSuccess: '#15803d',
    colorWarning: '#b45309',
    colorError: '#b91c1c',
    colorTextPrimary: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextMuted: '#94a3b8',
    colorBgPrimary: '#f8fafc',
    colorBgSecondary: '#f0f4ff',
    colorBgTertiary: '#e2e8f8',
    colorBorder: '#cbd5e1',
    colorBorderLight: '#e2e8f0',
  };
}

export function applyTokens(tokens: ThemeTokens): void {
  const root = document.documentElement;
  root.style.setProperty('--color-primary',        tokens.colorPrimary);
  root.style.setProperty('--color-secondary',      tokens.colorSecondary);
  root.style.setProperty('--color-accent',         tokens.colorAccent);
  root.style.setProperty('--color-highlight',      tokens.colorHighlight);
  root.style.setProperty('--color-success',        tokens.colorSuccess);
  root.style.setProperty('--color-warning',        tokens.colorWarning);
  root.style.setProperty('--color-error',          tokens.colorError);
  root.style.setProperty('--color-text-primary',   tokens.colorTextPrimary);
  root.style.setProperty('--color-text-secondary', tokens.colorTextSecondary);
  root.style.setProperty('--color-text-muted',     tokens.colorTextMuted);
  root.style.setProperty('--color-bg-primary',     tokens.colorBgPrimary);
  root.style.setProperty('--color-bg-secondary',   tokens.colorBgSecondary);
  root.style.setProperty('--color-bg-tertiary',    tokens.colorBgTertiary);
  root.style.setProperty('--color-border',         tokens.colorBorder);
  root.style.setProperty('--color-border-light',   tokens.colorBorderLight);
}

const densitySpacing: Record<LayoutDensity, { xs: string; sm: string; md: string; lg: string; xl: string }> = {
  compact:     { xs: '2px',  sm: '4px',  md: '8px',  lg: '12px', xl: '16px' },
  comfortable: { xs: '4px',  sm: '8px',  md: '16px', lg: '24px', xl: '32px' },
  spacious:    { xs: '6px',  sm: '12px', md: '24px', lg: '36px', xl: '48px' },
};

const radiusMap: Record<LayoutTokens['borderRadius'], { sm: string; md: string; lg: string }> = {
  sharp:   { sm: '2px',    md: '4px',    lg: '6px' },
  rounded: { sm: '4px',    md: '8px',    lg: '12px' },
  pill:    { sm: '9999px', md: '9999px', lg: '9999px' },
};

export function applyLayout(layout: LayoutTokens): void {
  const root = document.documentElement;
  const sp = densitySpacing[layout.density];
  root.style.setProperty('--spacing-xs', sp.xs);
  root.style.setProperty('--spacing-sm', sp.sm);
  root.style.setProperty('--spacing-md', sp.md);
  root.style.setProperty('--spacing-lg', sp.lg);
  root.style.setProperty('--spacing-xl', sp.xl);
  const r = radiusMap[layout.borderRadius];
  root.style.setProperty('--radius-sm', r.sm);
  root.style.setProperty('--radius-md', r.md);
  root.style.setProperty('--radius-lg', r.lg);
  root.style.setProperty('--font-scale', String(layout.fontScale));
  root.style.fontSize = `${layout.fontScale}rem`;
  root.setAttribute('data-density', layout.density);
}
