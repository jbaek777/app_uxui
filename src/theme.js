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

export const darkShadow = { sm: {}, md: {} };
export const lightShadow = { sm: {}, md: {} };

// 기존 호환성
export const shadow = { sm: {}, md: {} };

export function getShadow(isDark) {
  return { sm: {}, md: {} };
}

// ─── 화면 크기 비례 스케일 ────────────────────────────────
// 기준: 390dp (갤럭시 S23 / 아이폰 14)
// 범위: 0.88(소형폰) ~ 1.15(대형폰) 로 제한
import { Dimensions } from 'react-native';
const BASE_WIDTH = 390;
const { width: SCREEN_W } = Dimensions.get('window');
const _scale = Math.min(Math.max(SCREEN_W / BASE_WIDTH, 0.88), 1.15);
const sc = (n) => Math.round(n * _scale);

export const fontSize = {
  xxl: sc(38),
  xl:  sc(30),
  lg:  sc(24),
  md:  sc(20),
  sm:  sc(17),
  xs:  sc(15),
  xxs: sc(13),
};

export const spacing = {
  xs:  sc(6),
  sm:  sc(12),
  md:  sc(18),
  lg:  sc(24),
  xl:  sc(36),
  xxl: sc(52),
};
