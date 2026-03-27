export const colors = {
  primary: '#e8950a',
  primaryDark: '#c47c08',
  primaryLight: '#fdf3e0',
  background: '#f5f6fa',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#e8eaf0',
  text: {
    primary: '#1a1a2e',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
  },
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
  aging: {
    fresh: '#22c55e',
    optimal: '#e8950a',
    overdue: '#ef4444',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.text.primary },
  h2: { fontSize: 22, fontWeight: '700', color: colors.text.primary },
  h3: { fontSize: 18, fontWeight: '600', color: colors.text.primary },
  h4: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  body: { fontSize: 14, fontWeight: '400', color: colors.text.primary },
  bodySmall: { fontSize: 12, fontWeight: '400', color: colors.text.secondary },
  caption: { fontSize: 11, fontWeight: '400', color: colors.text.tertiary },
};
