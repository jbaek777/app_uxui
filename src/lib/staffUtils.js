/**
 * staffUtils.js — 직원 위생증 · 위생교육 만료일 공통 계산 로직.
 *
 * SettingsScreen (수동 추가/수정) 과 UploadScreen (OCR 자동 업데이트) 에서
 * status 값을 동일하게 산출하도록 공용 헬퍼로 분리.
 */

// "YYYY.MM.DD" 또는 "YYYY-MM-DD" → 오늘 기준 남은 일수 (음수 = 만료 지남)
export function calcDaysUntil(dateStr) {
  if (!dateStr || dateStr === '미등록') return null;
  try {
    const d = new Date(String(dateStr).replace(/\./g, '-'));
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / 86400000);
  } catch { return null; }
}

// 보건증·위생교육 둘 중 더 급한 쪽 기준 상태
//   expired: 하나라도 만료 지남
//   warn:    D-30 이내 임박
//   ok:      여유 있음 (또는 둘 다 미등록)
export function computeStaffStatus(healthStr, eduStr) {
  const days = [calcDaysUntil(healthStr), calcDaysUntil(eduStr)].filter(v => v !== null);
  if (days.length === 0) return 'ok';
  const min = Math.min(...days);
  if (min < 0)   return 'expired';
  if (min <= 30) return 'warn';
  return 'ok';
}
