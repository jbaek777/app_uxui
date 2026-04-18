/**
 * 표준 부위 프리셋 — 식약처 고시 기준 소 소분할 39부위
 *
 * 근거: 식품의약품안전처 고시 "식육의 부위별·등급별 및 종류별 구분방법"
 *       별표 1의2 (소 소분할 부위)
 *       대분할 10개 / 소분할 39개
 *
 * avgRatio     : 발골무게 대비 비율 (가이드용 — 매장 실측으로 누적되며 덮어씀)
 * defaultPrice : 기본 Kg 판매단가 (정육점 보편 단가 — 매장에서 수정)
 * group        : 대분할 분류 (UI 섹션 구분용)
 *
 * 사용자가 취급하지 않는 부위는 Step 4에서 "삭제" → parts_disabled에 저장되어
 *  다음 세션부터 목록에서 숨겨짐. "기본 부위 복원"으로 언제든 원복 가능.
 */

// ── 한우 / 육우 소분할 39부위 (식약처 고시 기준) ──
export const STANDARD_PARTS_BEEF = [
  // ─── 1. 안심 (1) ───
  { name: '안심살',      order:  1, group: '안심',   avgRatio: 0.0200, defaultPrice: 28000 },

  // ─── 2. 등심 (4) ───
  { name: '윗등심살',    order:  2, group: '등심',   avgRatio: 0.0250, defaultPrice: 15000 },
  { name: '꽃등심살',    order:  3, group: '등심',   avgRatio: 0.0400, defaultPrice: 18000 },
  { name: '아랫등심살',  order:  4, group: '등심',   avgRatio: 0.0230, defaultPrice: 14000 },
  { name: '살치살',      order:  5, group: '등심',   avgRatio: 0.0120, defaultPrice: 22000 },

  // ─── 3. 채끝 (1) ───
  { name: '채끝살',      order:  6, group: '채끝',   avgRatio: 0.0250, defaultPrice: 16000 },

  // ─── 4. 목심 (1) ───
  { name: '목심살',      order:  7, group: '목심',   avgRatio: 0.0350, defaultPrice:  9500 },

  // ─── 5. 앞다리 (5) ───
  { name: '꾸리살',      order:  8, group: '앞다리', avgRatio: 0.0120, defaultPrice: 12000 },
  { name: '부채살',      order:  9, group: '앞다리', avgRatio: 0.0250, defaultPrice: 13000 },
  { name: '앞다리살',    order: 10, group: '앞다리', avgRatio: 0.0650, defaultPrice: 10000 },
  { name: '갈비덧살',    order: 11, group: '앞다리', avgRatio: 0.0080, defaultPrice: 14000 },
  { name: '부채덮개살',  order: 12, group: '앞다리', avgRatio: 0.0100, defaultPrice: 11000 },

  // ─── 6. 우둔 (2) ───
  { name: '우둔살',      order: 13, group: '우둔',   avgRatio: 0.0450, defaultPrice:  9000 },
  { name: '홍두깨살',    order: 14, group: '우둔',   avgRatio: 0.0150, defaultPrice: 10000 },

  // ─── 7. 설도 (5) ───
  { name: '보섭살',      order: 15, group: '설도',   avgRatio: 0.0150, defaultPrice: 11000 },
  { name: '설깃살',      order: 16, group: '설도',   avgRatio: 0.0200, defaultPrice: 10000 },
  { name: '설깃머리살',  order: 17, group: '설도',   avgRatio: 0.0050, defaultPrice: 12000 },
  { name: '도가니살',    order: 18, group: '설도',   avgRatio: 0.0220, defaultPrice: 11000 },
  { name: '삼각살',      order: 19, group: '설도',   avgRatio: 0.0080, defaultPrice: 13000 },

  // ─── 8. 양지 (7) ───
  { name: '양지머리',    order: 20, group: '양지',   avgRatio: 0.0150, defaultPrice: 12000 },
  { name: '차돌박이',    order: 21, group: '양지',   avgRatio: 0.0150, defaultPrice: 17000 },
  { name: '업진살',      order: 22, group: '양지',   avgRatio: 0.0150, defaultPrice: 13000 },
  { name: '업진안살',    order: 23, group: '양지',   avgRatio: 0.0080, defaultPrice: 14000 },
  { name: '치마양지',    order: 24, group: '양지',   avgRatio: 0.0100, defaultPrice: 13000 },
  { name: '치마살',      order: 25, group: '양지',   avgRatio: 0.0200, defaultPrice: 14000 },
  { name: '앞치마살',    order: 26, group: '양지',   avgRatio: 0.0070, defaultPrice: 12000 },

  // ─── 9. 사태 (5) ───
  { name: '앞사태',      order: 27, group: '사태',   avgRatio: 0.0150, defaultPrice: 10500 },
  { name: '뒷사태',      order: 28, group: '사태',   avgRatio: 0.0200, defaultPrice: 10500 },
  { name: '뭉치사태',    order: 29, group: '사태',   avgRatio: 0.0120, defaultPrice: 11000 },
  { name: '아롱사태',    order: 30, group: '사태',   avgRatio: 0.0080, defaultPrice: 12000 },
  { name: '상박살',      order: 31, group: '사태',   avgRatio: 0.0050, defaultPrice: 12000 },

  // ─── 10. 갈비 (8) ───
  { name: '본갈비',      order: 32, group: '갈비',   avgRatio: 0.0350, defaultPrice: 14000 },
  { name: '꽃갈비',      order: 33, group: '갈비',   avgRatio: 0.0250, defaultPrice: 16000 },
  { name: '참갈비',      order: 34, group: '갈비',   avgRatio: 0.0250, defaultPrice: 12000 },
  { name: '갈비살',      order: 35, group: '갈비',   avgRatio: 0.0150, defaultPrice: 15000 },
  { name: '마구리',      order: 36, group: '갈비',   avgRatio: 0.0080, defaultPrice:  9000 },
  { name: '토시살',      order: 37, group: '갈비',   avgRatio: 0.0040, defaultPrice: 25000 },
  { name: '안창살',      order: 38, group: '갈비',   avgRatio: 0.0050, defaultPrice: 25000 },
  { name: '제비추리',    order: 39, group: '갈비',   avgRatio: 0.0030, defaultPrice: 22000 },
];

// ── 자주 쓰는 부산물 빠른 추가 (뼈·내장·족 — 39부위 정육 외) ──
// Step 4 "부위 추가" 모달에서 칩으로 노출, 탭 한 번으로 커스텀 추가됨.
export const COMMON_BEEF_EXTRAS = [
  { name: '사골(앞)',   defaultPrice: 28000 },
  { name: '사골(중)',   defaultPrice: 18000 },
  { name: '사골(뒤)',   defaultPrice: 34000 },
  { name: '사골(소)',   defaultPrice: 16000 },
  { name: '잡뼈',       defaultPrice:  3000 },
  { name: '우족(앞)',   defaultPrice: 30000 },
  { name: '우족(뒤)',   defaultPrice: 35000 },
  { name: '꼬리',       defaultPrice: 110000 },
  { name: '도가니(뼈)', defaultPrice:  8500 },
  { name: '스지',       defaultPrice:  8500 },
  { name: '우설',       defaultPrice: 25000 },
  { name: '양',         defaultPrice: 15000 },
  { name: '천엽',       defaultPrice: 15000 },
  { name: '간',         defaultPrice:  8000 },
  { name: '곱창',       defaultPrice: 22000 },
  { name: '대창',       defaultPrice: 25000 },
  { name: '막창',       defaultPrice: 20000 },
];

// ── 한돈 / 흑돼지 (기본 템플릿 — 사업장에서 커스텀 권장) ──
export const STANDARD_PARTS_PORK = [
  { name: '삼겹살',     order:  1, group: '삼겹살', avgRatio: 0.15, defaultPrice: 16000 },
  { name: '목살',       order:  2, group: '목심',   avgRatio: 0.06, defaultPrice: 15000 },
  { name: '앞다리',     order:  3, group: '앞다리', avgRatio: 0.10, defaultPrice:  9000 },
  { name: '뒷다리',     order:  4, group: '뒷다리', avgRatio: 0.20, defaultPrice:  8000 },
  { name: '등심',       order:  5, group: '등심',   avgRatio: 0.08, defaultPrice:  9000 },
  { name: '안심',       order:  6, group: '안심',   avgRatio: 0.03, defaultPrice: 12000 },
  { name: '갈비',       order:  7, group: '갈비',   avgRatio: 0.12, defaultPrice: 14000 },
  { name: '항정살',     order:  8, group: '목심',   avgRatio: 0.02, defaultPrice: 22000 },
  { name: '갈매기살',   order:  9, group: '특수',   avgRatio: 0.01, defaultPrice: 20000 },
  { name: '가브리살',   order: 10, group: '특수',   avgRatio: 0.01, defaultPrice: 22000 },
  { name: '등심덧살',   order: 11, group: '등심',   avgRatio: 0.01, defaultPrice: 18000 },
  { name: '꼬리살',     order: 12, group: '특수',   avgRatio: 0.01, defaultPrice: 18000 },
  { name: '돼지머리',   order: 13, group: '부산물', avgRatio: 0.05, defaultPrice:  5000 },
  { name: '족발',       order: 14, group: '부산물', avgRatio: 0.04, defaultPrice:  8000 },
  { name: '내장',       order: 15, group: '부산물', avgRatio: 0.03, defaultPrice:  6000 },
];

export const COMMON_PORK_EXTRAS = [
  { name: '돈사골',   defaultPrice:  8000 },
  { name: '돈갈비뼈', defaultPrice:  6000 },
  { name: '돈발',     defaultPrice:  7000 },
  { name: '돈곱창',   defaultPrice: 18000 },
  { name: '돈막창',   defaultPrice: 17000 },
];

export function getStandardParts(species) {
  if (!species) return STANDARD_PARTS_BEEF;
  if (species === '한돈' || species === '흑돼지' || species.includes('돈') || species.includes('돼지')) {
    return STANDARD_PARTS_PORK;
  }
  return STANDARD_PARTS_BEEF;
}

export function getCommonExtras(species) {
  if (!species) return COMMON_BEEF_EXTRAS;
  if (species === '한돈' || species === '흑돼지' || species.includes('돈') || species.includes('돼지')) {
    return COMMON_PORK_EXTRAS;
  }
  return COMMON_BEEF_EXTRAS;
}

export const SPECIES_OPTIONS = ['한우', '육우', '한돈', '흑돼지', '기타'];

// 기본 부대비용 (매장에서 프리셋으로 저장 가능)
export const DEFAULT_EXTRAS = {
  transport: 0,
  unload:    0,
  broker:    0,
  hoof:      0,
};
