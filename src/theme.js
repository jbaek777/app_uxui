// ── 다크 테마 ─────────────────────────────────────────────
export const darkColors = {
  bg:   '#1A1A2E',
  s1:   '#16213E',
  s2:   '#0F3460',
  bd:   '#253A5E',
  bd2:  '#344F7A',
  ac:   '#C0392B',
  a2:   '#E8950A',
  gn:   '#27AE60',
  rd:   '#E74C3C',
  yw:   '#F39C12',
  pu:   '#8E44AD',
  cyan: '#00ACC1',
  tx:   '#F0F4F8',
  t2:   '#94A3B8',
  t3:   '#64748B',
};

// ── 라이트 테마 ───────────────────────────────────────────
export const lightColors = {
  bg:   '#F5F6FA',
  s1:   '#FFFFFF',
  s2:   '#EEF0F7',
  bd:   '#DDE1EF',
  bd2:  '#C5CAE0',
  ac:   '#C0392B',
  a2:   '#E8950A',
  gn:   '#27AE60',
  rd:   '#E74C3C',
  yw:   '#F39C12',
  pu:   '#8E44AD',
  cyan: '#00ACC1',
  tx:   '#1A1F36',
  t2:   '#4A5568',
  t3:   '#94A3B8',
};

// 기존 호환성 유지 (다크 기본)
export const colors = { ...darkColors };

// 테마 변경 시 호출 — colors 객체를 직접 업데이트
export function setTheme(isDark) {
  const src = isDark ? darkColors : lightColors;
  Object.assign(colors, src);
}

export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
};

export const darkShadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },
};

export const lightShadow = {
  sm: { shadowColor: '#1A1F36', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  md: { shadowColor: '#1A1F36', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6 },
};

// 기존 호환성
export const shadow = darkShadow;

export function getShadow(isDark) {
  return isDark ? darkShadow : lightShadow;
}

export const fontSize = {
  xxl: 36,
  xl:  28,
  lg:  22,
  md:  18,
  sm:  16,
  xs:  14,
  xxs: 12,
};

export const spacing = {
  xs:  6,
  sm:  12,
  md:  18,
  lg:  24,
  xl:  36,
  xxl: 52,
};
