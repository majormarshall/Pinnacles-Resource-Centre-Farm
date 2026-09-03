// ── Global Design Tokens ──────────────────────────────────────────────────
export const COLORS = {
  primary: '#1b4332',
  primaryLight: '#2d6a4f',
  primaryDark: '#0d2b1f',
  accent: '#52b788',
  accentLight: '#95d5b2',
  gold: '#f4a261',
  white: '#ffffff',
  offWhite: '#f0faf4',
  surface: '#ffffff',
  border: '#d8f3dc',
  textDark: '#0d2b1f',
  textMid: '#374151',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  info: '#3b82f6',
  overlay: 'rgba(0,0,0,0.45)',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#1b4332',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
};
