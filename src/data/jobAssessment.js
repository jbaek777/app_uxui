/**
 * 정육기술자 자가역량평가 — 51문항
 *
 * 출처: 한국미트마스터협회 · 미트마스터아카데미
 * 포팅: 정육기술자_자가역량평가_v3.html → RN
 *
 * 구조:
 *   - 7개 영역 (가중치 1.0 ~ 1.5)
 *   - 각 문항 5점 척도 (전혀못함 → 숙련수행)
 *   - 등급 체계: D / C / B / A / S
 *   - 상한 규칙: 돼지(<40%→C, <60%→B), 소(<40%→B, <60%→A)
 *   - 보너스: 경력 5~10년 +1점, 10년+ +2점, 자격증 +1점 → 누적 2점 이상 시 1등급 상승 (상한 내)
 */

// ── 7개 영역 × 51문항 ───────────────────────────────────
export const SECTIONS = [
  {
    id: 'sales',
    title: '판매·서비스 역량',
    short: '판매',
    weight: 1.0,
    icon: 'storefront-outline',
    qs: [
      '진열된 고기상품을 고객에게 판매할 수 있다',
      '소고기 부위별·용도별 특성을 알고 고객에게 설명할 수 있다',
      '돼지고기 부위별·용도별 특성을 알고 고객에게 설명할 수 있다',
      '소고기 부위별 상품화 포장을 능숙하게 할 수 있다',
      '돼지고기 부위별 상품화 포장을 능숙하게 할 수 있다',
      '고객응대 및 판매 멘트를 자연스럽게 할 수 있다',
    ],
  },
  {
    id: 'equip',
    title: '기기·장비 운용',
    short: '장비',
    weight: 1.2,
    icon: 'construct-outline',
    qs: [
      '육절기를 안전하게 사용할 수 있다',
      '부위별·용도별 두께에 맞춰 육절기를 조작할 수 있다',
      '골절기를 안전하게 사용할 수 있다',
      '민서기를 안전하게 사용할 수 있다',
      '연육기를 안전하게 사용할 수 있다',
      '진공기를 사용할 수 있다',
      '랩핑기를 이용해 상품포장을 할 수 있다',
      '연마봉(야스리)으로 칼의 무딤을 조정할 수 있다',
      '대동칼을 이용해 목적에 맞게 고기를 절단할 수 있다',
      '숫돌을 이용해 칼을 연마할 수 있다',
    ],
  },
  {
    id: 'hygiene',
    title: '위생·안전 관리',
    short: '위생',
    weight: 1.2,
    icon: 'shield-checkmark-outline',
    qs: [
      'HACCP 기준에 따라 작업장 위생관리를 할 수 있다',
      '냉장·냉동 적정 온도 기준을 알고 관리할 수 있다',
      '교차오염 방지를 위한 작업 동선을 이해하고 실천한다',
      '식품위생법상 식육의 보관·판매 기준을 알고 있다',
    ],
  },
  {
    id: 'pork',
    title: '돼지고기 정형·발골',
    short: '돼지',
    weight: 1.5,
    icon: 'nutrition-outline',
    qs: [
      '돼지 부위별 상품화 포장(진공·비닐)을 할 수 있다',
      '돼지지육 3단 각치기를 할 수 있다',
      '돼지 뒷다리 정형을 할 수 있다',
      '돼지 몸통 정형을 할 수 있다',
      '돼지 앞다리 정형을 할 수 있다',
      '돼지 갈비 정형 및 소분할 작업을 할 수 있다',
      '삼겹살 껍데기(탈모) 작업을 할 수 있다',
      '돼지 뒷다리 발골을 할 수 있다',
      '돼지 몸통 발골을 할 수 있다',
      '돼지 앞다리 발골을 할 수 있다',
      '돼지 반마리 발골을 할 수 있다',
      '식육처리기능사 실기 기준에 맞게 발골·정형을 할 수 있다',
    ],
  },
  {
    id: 'beef',
    title: '소고기 정형·발골',
    short: '소고기',
    weight: 1.5,
    icon: 'paw-outline',
    qs: [
      '소 부위별 상품화 포장(진공·비닐)을 할 수 있다',
      '소 앞다리 대분할·소분할 정형작업을 할 수 있다',
      '소 뒷다리 대분할·소분할 정형작업을 할 수 있다',
      '소 등심 대분할·소분할 정형을 할 수 있다',
      '짝갈비 대분할·소분할 정형을 할 수 있다',
      '양지 대분할·소분할 정형을 할 수 있다',
      '소 몸통에서 앞다리 분리·발골을 할 수 있다',
      '소 앞다리 발골을 할 수 있다',
      '소 뒷다리 발골을 할 수 있다',
      '소 등심 발골을 할 수 있다',
      '소 등뼈 발골을 할 수 있다',
    ],
  },
  {
    id: 'import',
    title: '수입육 지식',
    short: '수입육',
    weight: 1.0,
    icon: 'airplane-outline',
    qs: [
      '수입 돼지고기 브랜드 및 부위별 특징을 알고 있다',
      '수입 소고기 브랜드 및 부위별 특징을 알고 있다',
      '시기별·상황별 수입육 대처를 할 수 있다',
    ],
  },
  {
    id: 'adv',
    title: '고급 기술',
    short: '고급',
    weight: 1.0,
    icon: 'sparkles-outline',
    qs: [
      '건식숙성(드라이에이징) 또는 습식숙성(웻에이징)에 대한 기본 지식이 있다',
      '숙성육 판매 및 고객 설명을 할 수 있다',
      '부위별 작업 수율(정육량/원료 비율)을 파악하고 있다',
      '재고 회전을 고려한 발주·주문 업무를 할 수 있다',
      '양념육 조리 및 혼합 작업을 할 수 있다',
    ],
  },
];

// ── 등급 체계 ───────────────────────────────────────────
export const GRADES = [
  {
    letter: 'D', label: 'D급', sub: '초급',
    min: 0, salary: '220~260만원',
    color: '#64748B', bg: 'rgba(100,116,139,0.10)',
    desc: '기본 판매·서비스 수행 가능. 장비 보조 단계.',
    next: '기기·장비 전반 안전 운용과 위생관리 기준 숙지가 우선입니다.',
  },
  {
    letter: 'C', label: 'C급', sub: '초중급',
    min: 30, salary: '260~300만원',
    color: '#BA7517', bg: 'rgba(186,117,23,0.10)',
    desc: '기기 운용 가능, 돼지고기 기본 정형 수행. 위생 기준 준수.',
    next: '돼지 발골 전 과정을 독립적으로 수행할 수 있도록 집중하세요.',
  },
  {
    letter: 'B', label: 'B급', sub: '중급',
    min: 50, salary: '300~360만원',
    color: '#0F6E56', bg: 'rgba(15,110,86,0.10)',
    desc: '돼지 발골 가능, 소고기 기본 정형 수행. 핵심 기술 보유.',
    next: '소고기 전 부위 정형·발골과 수입육 지식을 쌓아야 합니다.',
  },
  {
    letter: 'A', label: 'A급', sub: '중고급',
    min: 65, salary: '360~420만원',
    color: '#185FA5', bg: 'rgba(24,95,165,0.10)',
    desc: '소·돼지 전 과정 수행 가능. 수입육 지식 보유.',
    next: '숙성육·수율 관리 등 고급 기술을 더해 전문가로 도약하세요.',
  },
  {
    letter: 'S', label: 'S급', sub: '고급',
    min: 80, salary: '420만원 이상',
    color: '#A32D2D', bg: 'rgba(163,45,45,0.10)',
    desc: '모든 영역 완비. 업계 최상위 전문가.',
    next: '후배 양성 및 기술 전수 역할로 나아갈 수 있습니다.',
  },
];

// ── 평가 척도 (1~5) ─────────────────────────────────────
export const RATING_LABELS = [
  { v: 1, label: '전혀\n못함' },
  { v: 2, label: '보조\n가능' },
  { v: 3, label: '도움받으면\n가능' },
  { v: 4, label: '혼자\n가능' },
  { v: 5, label: '숙련\n수행' },
];

// ── 전체 문항 수 ────────────────────────────────────────
export const TOTAL_QUESTIONS = SECTIONS.reduce((n, s) => n + s.qs.length, 0);

// ── 등급 계산 ───────────────────────────────────────────
/**
 * 응답 데이터를 받아 점수·등급·캡·보너스를 계산
 *
 * @param {object} answers - 영역별 응답 { sales: {0: 4, 1: 3, ...}, equip: {...}, ... }
 * @param {object} profile - 프로필 보정값 { experience, license }
 *   - experience: '1년 미만' | '1~3년' | '3~5년' | '5~10년' | '10년 이상' | null
 *   - license: '없음' | '취득 준비' | '취득 완료' | null
 * @returns {object} - 계산 결과
 */
export function calculateGrade(answers, profile = {}) {
  let totalWeighted = 0;
  let maxWeighted = 0;
  const sectionAvgs = {};

  for (const sec of SECTIONS) {
    const a = answers[sec.id] || {};
    const vals = Object.values(a);
    const filled = vals.length;
    const avg = filled > 0
      ? vals.reduce((x, y) => x + y, 0) / sec.qs.length
      : 0;
    sectionAvgs[sec.id] = avg;
    totalWeighted += avg * sec.weight * sec.qs.length;
    maxWeighted += 5 * sec.weight * sec.qs.length;
  }

  const percent = maxWeighted > 0
    ? Math.round((totalWeighted / maxWeighted) * 100)
    : 0;

  // 원 등급 (점수 기준)
  let baseIdx = 0;
  for (let i = 0; i < GRADES.length; i++) {
    if (percent >= GRADES[i].min) baseIdx = i;
  }

  // 돼지/소 상한 규칙
  const porkPct = Math.round((sectionAvgs.pork || 0) / 5 * 100);
  const beefPct = Math.round((sectionAvgs.beef || 0) / 5 * 100);
  let maxIdx = 4; // S 상한
  const caps = [];

  if (porkPct < 40) {
    maxIdx = Math.min(maxIdx, 1);
    caps.push(`돼지 정형·발골 ${porkPct}% — 40% 미달 → C급 이하 상한`);
  } else if (porkPct < 60) {
    maxIdx = Math.min(maxIdx, 2);
    caps.push(`돼지 정형·발골 ${porkPct}% — 60% 미달 → B급 이하 상한`);
  }

  if (beefPct < 40) {
    maxIdx = Math.min(maxIdx, 2);
    caps.push(`소 정형·발골 ${beefPct}% — 40% 미달 → B급 이하 상한`);
  } else if (beefPct < 60) {
    maxIdx = Math.min(maxIdx, 3);
    caps.push(`소 정형·발골 ${beefPct}% — 60% 미달 → A급 이하 상한`);
  }

  const cappedIdx = Math.min(baseIdx, maxIdx);
  const isCapped = cappedIdx < baseIdx;

  // 경력·자격 보너스
  const { experience, license } = profile;
  let bonusScore = 0;
  const bonusItems = [];
  if (experience === '5~10년')   { bonusScore += 1; bonusItems.push('경력 5~10년 보유'); }
  if (experience === '10년 이상') { bonusScore += 2; bonusItems.push('경력 10년 이상 보유'); }
  if (license === '취득 완료')    { bonusScore += 1; bonusItems.push('식육처리기능사 자격증 취득'); }

  const finalIdx = Math.min(cappedIdx + (bonusScore >= 2 ? 1 : 0), maxIdx);
  const bonusRaised = finalIdx > cappedIdx;

  return {
    percent,
    sectionAvgs,
    porkPct,
    beefPct,
    finalGrade: GRADES[finalIdx],
    baseGrade: GRADES[baseIdx],
    isCapped,
    caps,
    bonusItems,
    bonusRaised,
    bonusScore,
  };
}

// ── 섹션별 완료 여부 ────────────────────────────────────
export function isSectionDone(answers, sectionId) {
  const sec = SECTIONS.find(s => s.id === sectionId);
  if (!sec) return false;
  return Object.keys(answers[sectionId] || {}).length === sec.qs.length;
}

// ── 전체 응답 완료 여부 ─────────────────────────────────
export function isAllDone(answers) {
  return SECTIONS.every(sec => isSectionDone(answers, sec.id));
}

// ── 응답 개수 (진행률 계산용) ───────────────────────────
export function answeredCount(answers) {
  return SECTIONS.reduce((n, sec) => {
    return n + Object.keys(answers[sec.id] || {}).length;
  }, 0);
}

// ── 경력 옵션 ───────────────────────────────────────────
export const EXPERIENCE_OPTIONS = [
  '1년 미만',
  '1~3년',
  '3~5년',
  '5~10년',
  '10년 이상',
];

// ── 자격증 옵션 ─────────────────────────────────────────
export const LICENSE_OPTIONS = [
  '없음',
  '취득 준비',
  '취득 완료',
];
