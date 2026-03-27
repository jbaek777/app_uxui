export const agingData = [
  {
    id: '1', cut: '등심 (Striploin)', grade: '1+', trace: 'HN-2602-1198',
    origin: '국내산(한우)', startDate: '2026.03.08', day: 18, targetDay: 28,
    temp: 1.2, humidity: 82, weight: 9.0, initWeight: 9.3,
    status: 'aging', notes: '표면 건조 양호',
  },
  {
    id: '2', cut: '채끝 (Ribeye)', grade: '1++', trace: 'HN-2602-1142',
    origin: '국내산(한우)', startDate: '2026.03.03', day: 23, targetDay: 28,
    temp: 0.8, humidity: 80, weight: 9.8, initWeight: 10.5,
    status: 'aging', notes: '곰팡이 없음',
  },
  {
    id: '3', cut: '안심 (Tenderloin)', grade: '1+', trace: 'HN-2602-0341',
    origin: '국내산(한우)', startDate: '2026.02.25', day: 29, targetDay: 28,
    temp: 1.0, humidity: 81, weight: 13.8, initWeight: 15.0,
    status: 'done', notes: '완성 — 출하 준비',
  },
  {
    id: '4', cut: '목심 (Chuck Roll)', grade: '1', trace: 'HN-2603-0201',
    origin: '국내산(한우)', startDate: '2026.03.20', day: 6, targetDay: 21,
    temp: 1.5, humidity: 83, weight: 8.0, initWeight: 8.0,
    status: 'early', notes: '초기 수분 제거 중',
  },
];

export const hygieneData = [
  {
    id: '1', date: '2026.03.26', time: '08:00',
    items: ['작업장 온도: 4°C', '냉장고 온도: -2°C', '도마 소독', '칼 소독', '손 세척 확인'],
    status: 'pass', inspector: '홍길동',
  },
  {
    id: '2', date: '2026.03.25', time: '08:00',
    items: ['작업장 온도: 5°C', '냉장고 온도: -1°C', '도마 소독', '칼 소독'],
    status: 'pass', inspector: '이○○',
  },
  {
    id: '3', date: '2026.03.24', time: '08:00',
    items: ['작업장 온도: 4°C', '냉장고 온도: -3°C', '도마 소독'],
    status: 'warning', inspector: '홍길동',
  },
];

export const staffData = [
  {
    id: '1', name: '홍길동', role: '정육사', hire: '2022.03.01',
    health: '2027.01.15', healthIssue: '2026.01.15', healthOrg: '김해시보건소',
    edu: '2027.02.20', eduDate: '2026.02.20', eduOrg: '한국식품안전관리인증원',
    status: 'ok', color: '#e8950a',
  },
  {
    id: '2', name: '김○○', role: '정육사', hire: '2023.06.15',
    health: '2026.02.10', healthIssue: '2025.02.10', healthOrg: '김해시보건소',
    edu: '2027.01.08', eduDate: '2026.01.08', eduOrg: '한국식품안전관리인증원',
    status: 'expired', color: '#e63946',
  },
  {
    id: '3', name: '이○○', role: '보조', hire: '2025.01.10',
    health: '2027.03.05', healthIssue: '2026.03.05', healthOrg: '김해시보건소',
    edu: '2027.01.10', eduDate: '2026.01.10', eduOrg: '한국식품안전관리인증원',
    status: 'ok', color: '#3d7ef5',
  },
];

export const inventoryData = [
  { id: '1', name: '진공포장지 (대)', unit: 'roll', qty: 3, minQty: 5, price: 42000, cat: '소모품', lastOrder: '2026.03.10', status: 'low' },
  { id: '2', name: '소금 (정제염)', unit: 'kg', qty: 18, minQty: 10, price: 3200, cat: '원재료', lastOrder: '2026.03.01', status: 'ok' },
  { id: '3', name: '온도계 (디지털)', unit: 'ea', qty: 2, minQty: 2, price: 85000, cat: '장비', lastOrder: '2025.11.20', status: 'ok' },
  { id: '4', name: '도마 (PE)', unit: 'ea', qty: 4, minQty: 3, price: 35000, cat: '장비', lastOrder: '2026.01.15', status: 'ok' },
  { id: '5', name: '소독제 (200ppm)', unit: 'L', qty: 1.5, minQty: 5, price: 8500, cat: '소모품', lastOrder: '2026.03.05', status: 'critical' },
  { id: '6', name: '고무장갑 (M)', unit: 'pair', qty: 22, minQty: 10, price: 1200, cat: '소모품', lastOrder: '2026.03.18', status: 'ok' },
];

export const tempData = [
  { id: '1', date: '2026.03.26', time: '09:00', temp: 2.4, humidity: 82, person: '홍길동', status: 'ok', note: '—' },
  { id: '2', date: '2026.03.25', time: '09:00', temp: 2.1, humidity: 81, person: '홍길동', status: 'ok', note: '—' },
  { id: '3', date: '2026.03.24', time: '09:00', temp: 1.9, humidity: 83, person: '홍길동', status: 'ok', note: '—' },
  { id: '4', date: '2026.03.12', time: '09:00', temp: 5.8, humidity: 79, person: '홍길동', status: 'warn', note: '냉장고 점검 후 정상화' },
  { id: '5', date: '2026.03.11', time: '09:00', temp: 2.2, humidity: 82, person: '홍길동', status: 'ok', note: '—' },
];
