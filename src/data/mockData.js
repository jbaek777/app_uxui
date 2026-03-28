export const agingData = [
  { id: '1', cut: '등심 (Striploin)', grade: '1+', trace: 'HN-2602-1198', origin: '국내산(한우)', startDate: '2026.03.08', day: 18, targetDay: 28, temp: 1.2, humidity: 82, weight: 9.0, initWeight: 9.3, status: 'aging', notes: '표면 건조 양호' },
  { id: '2', cut: '채끝 (Ribeye)', grade: '1++', trace: 'HN-2602-1142', origin: '국내산(한우)', startDate: '2026.03.03', day: 23, targetDay: 28, temp: 0.8, humidity: 80, weight: 9.8, initWeight: 10.5, status: 'aging', notes: '곰팡이 없음' },
  { id: '3', cut: '안심 (Tenderloin)', grade: '1+', trace: 'HN-2602-0341', origin: '국내산(한우)', startDate: '2026.02.25', day: 29, targetDay: 28, temp: 1.0, humidity: 81, weight: 13.8, initWeight: 15.0, status: 'done', notes: '완성 — 출하 준비' },
  { id: '4', cut: '목심 (Chuck Roll)', grade: '1', trace: 'HN-2603-0201', origin: '국내산(한우)', startDate: '2026.03.20', day: 6, targetDay: 21, temp: 1.5, humidity: 83, weight: 8.0, initWeight: 8.0, status: 'early', notes: '초기 수분 제거 중' },
];

export const hygieneData = [
  { id: '1', date: '2026.03.26', time: '08:00', session: '오전', items: ['개인위생 O', '도마·칼소독 O', '냉장고온도 2.4°C', '작업대청결 O', '방충방서 O', '원산지표시판 O'], status: 'pass', inspector: '홍길동', signature: true },
  { id: '2', date: '2026.03.25', time: '14:00', session: '오후', items: ['개인위생 O', '도마·칼소독 O', '냉장고온도 2.1°C', '작업대청결 O', '방충방서 X', '원산지표시판 O'], status: 'warning', inspector: '이○○', signature: true },
  { id: '3', date: '2026.03.25', time: '08:00', session: '오전', items: ['개인위생 O', '도마·칼소독 O', '냉장고온도 2.0°C', '작업대청결 O', '방충방서 O', '원산지표시판 O'], status: 'pass', inspector: '홍길동', signature: true },
];

export const staffData = [
  { id: '1', name: '홍길동', role: '사장', pin: '1234', hire: '2022.03.01', health: '2027.01.15', edu: '2027.02.20', status: 'ok', color: '#E8950A' },
  { id: '2', name: '김○○', role: '직원', pin: '5678', hire: '2023.06.15', health: '2026.02.10', edu: '2027.01.08', status: 'expired', color: '#E74C3C' },
  { id: '3', name: '이○○', role: '직원', pin: '9012', hire: '2025.01.10', health: '2027.03.05', edu: '2027.01.10', status: 'ok', color: '#3d7ef5' },
];

// 부위별 재고 (실제 고기 재고)
export const meatInventory = [
  { id: 'm1', cut: '등심', origin: '한우 1+',  qty: 8.5,  unit: 'kg', buyPrice: 98000,  sellPrice: 158000, expire: '2026.03.28', dday: 2,  status: 'low',      sold: false, soldDate: null },
  { id: 'm2', cut: '채끝', origin: '한우 1++', qty: 12.0, unit: 'kg', buyPrice: 112000, sellPrice: 185000, expire: '2026.03.30', dday: 4,  status: 'ok',       sold: false, soldDate: null },
  { id: 'm3', cut: '안심', origin: '한우 1+',  qty: 4.2,  unit: 'kg', buyPrice: 125000, sellPrice: 198000, expire: '2026.03.27', dday: 1,  status: 'critical',  sold: false, soldDate: null },
  { id: 'm4', cut: '갈비', origin: '한우 1',   qty: 18.0, unit: 'kg', buyPrice: 72000,  sellPrice: 128000, expire: '2026.04.02', dday: 7,  status: 'ok',       sold: false, soldDate: null },
  { id: 'm5', cut: '목심', origin: '한우 1',   qty: 6.8,  unit: 'kg', buyPrice: 58000,  sellPrice: 98000,  expire: '2026.03.31', dday: 5,  status: 'ok',       sold: false, soldDate: null },
  { id: 'm6', cut: '삼겹살', origin: '한돈',   qty: 22.5, unit: 'kg', buyPrice: 18000,  sellPrice: 32000,  expire: '2026.04.05', dday: 10, status: 'ok',       sold: false, soldDate: null },
];

// 소모품 재고
export const inventoryData = [
  { id: '1', name: '진공포장지 (대)', unit: 'roll', qty: 3, minQty: 5, price: 42000, cat: '소모품', lastOrder: '2026.03.10', status: 'low' },
  { id: '2', name: '소금 (정제염)', unit: 'kg', qty: 18, minQty: 10, price: 3200, cat: '원재료', lastOrder: '2026.03.01', status: 'ok' },
  { id: '3', name: '소독제 (200ppm)', unit: 'L', qty: 1.5, minQty: 5, price: 8500, cat: '소모품', lastOrder: '2026.03.05', status: 'critical' },
  { id: '4', name: '고무장갑 (M)', unit: 'pair', qty: 22, minQty: 10, price: 1200, cat: '소모품', lastOrder: '2026.03.18', status: 'ok' },
  { id: '5', name: '도마 (PE)', unit: 'ea', qty: 4, minQty: 3, price: 35000, cat: '장비', lastOrder: '2026.01.15', status: 'ok' },
  { id: '6', name: '온도계 (디지털)', unit: 'ea', qty: 2, minQty: 2, price: 85000, cat: '장비', lastOrder: '2025.11.20', status: 'ok' },
];

export const tempData = [
  { id: '1', date: '2026.03.26', time: '09:00', temp: 2.4, humidity: 82, person: '홍길동', status: 'ok', note: '—' },
  { id: '2', date: '2026.03.25', time: '09:00', temp: 2.1, humidity: 81, person: '홍길동', status: 'ok', note: '—' },
  { id: '3', date: '2026.03.24', time: '09:00', temp: 1.9, humidity: 83, person: '홍길동', status: 'ok', note: '—' },
  { id: '4', date: '2026.03.12', time: '09:00', temp: 5.8, humidity: 79, person: '홍길동', status: 'warn', note: '냉장고 점검 후 정상화' },
];

// 오늘 판매 (마감 정산용)
export const todaySales = [
  { id: 's1', cut: '등심', origin: '한우 1+', qty: 2.3, unit: 'kg', price: 158000, total: 363400, time: '11:20' },
  { id: 's2', cut: '갈비', origin: '한우 1', qty: 4.5, unit: 'kg', price: 128000, total: 576000, time: '13:45' },
  { id: 's3', cut: '삼겹살', origin: '한돈', qty: 6.0, unit: 'kg', price: 32000, total: 192000, time: '15:10' },
  { id: 's4', cut: '채끝', origin: '한우 1++', qty: 1.8, unit: 'kg', price: 185000, total: 333000, time: '17:30' },
];

// 사업자 정보 (온보딩 기본값)
export const businessInfo = {
  bizNo: '123-45-67890',
  bizName: '○○한우 직판점',
  owner: '홍길동',
  species: ['한우', '한돈'],
};
