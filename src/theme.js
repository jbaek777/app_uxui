// ── 라이트 테마 (유일 테마) ──────────────────────────────
// 다크 테마 완전히 제거 — 기존 import 호환을 위해 darkColors 는
// lightColors 와 동일 값으로 alias 하여 남겨둠.
export const lightColors = {
  bg:   '#F5F6FA',   // 전체 배경 (아주 연한 회색톤)
  s1:   '#FFFFFF',   // 카드·입력창·서페이스 1 (완전 흰색)
  s2:   '#EEF0F7',   // 서페이스 2 (눌림/보조 배경)
  bd:   '#DDE1EF',   // 경계선
  bd2:  '#C5CAE0',   // 강조 경계선
  ac:   '#C0392B',   // 포인트 레드 (MeatBig 브랜드)
  a2:   '#E8950A',   // 포인트 오렌지
  gn:   '#27AE60',
  rd:   '#E74C3C',
  yw:   '#F39C12',
  pu:   '#8E44AD',
  cyan: '#00ACC1',
  tx:   '#1A1F36',   // 본문 텍스트 (거의 검정)
  t2:   '#4A5568',   // 보조 텍스트
  t3:   '#94A3B8',   // 힌트 / 비활성
  t4:   '#CBD5E1',   // 아주 옅은 텍스트 / 아이콘
};

// ── 다크 테마 제거 — 기존 import 호환 alias ─────────────
export const darkColors = { ...lightColors };

// 기본 colors (라이트)
export const colors = { ...lightColors };

// 다크/라이트 토글 — 화이트 전용으로 항상 light 적용 (no-op)
export function setTheme(_isDark) {
  Object.assign(colors, lightColors);
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

// 라이트 배경에 어울리는 부드러운 그림자
export const lightShadow = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
};

// 기존 호환 — darkShadow 는 lightShadow alias
export const darkShadow = { ...lightShadow };
export const shadow = { ...lightShadow };

export function getShadow(_isDark) {
  return lightShadow;
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
