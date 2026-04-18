/**
 * V5 디자인 시스템 — HTML 프로토타입 기반 공유 상수
 * 모든 화면에서 import { C, F, R, SH } from '../lib/v5' 사용
 */

// ── 색상 ────────────────────────────────────────────────────
export const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  red2:   '#DC2626',
  red3:   '#EF4444',
  redS:   'rgba(185,28,28,0.08)',
  redS2:  'rgba(185,28,28,0.14)',
  ok:     '#15803D',
  ok2:    '#16A34A',
  okS:    'rgba(21,128,61,0.09)',
  warn:   '#B45309',
  warn2:  '#D97706',
  warnS:  'rgba(180,83,9,0.09)',
  blue:   '#1D4ED8',
  blue2:  '#2563EB',
  blueS:  'rgba(29,78,216,0.09)',
  pur:    '#6D28D9',
  purS:   'rgba(109,40,217,0.09)',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
  bg3:    '#E8ECF2',
};

// ── 폰트 크기 (가독성 우선, 프로토타입 대비 +15%) ──────────
export const F = {
  hero:   40,   // 정산 금액 등 대형 숫자
  h1:     32,   // stat 카드 큰 숫자
  h2:     24,   // 페이지 타이틀, 중형 숫자
  h3:     18,   // 섹션 타이틀
  body:   15,   // 카드 제목, 본문
  sm:     13,   // 부제목, 설명
  xs:     12,   // 필/뱃지, 작은 라벨
  xxs:    11,   // 타임스탬프, stat 라벨
};

// ── 라운딩 ──────────────────────────────────────────────────
export const R = {
  sm:   10,
  md:   16,
  lg:   20,
  xl:   28,
  full: 9999,
};

// ── 그림자 (iOS + Android) ──────────────────────────────────
export const SH = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
};
