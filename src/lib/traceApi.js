/**
 * traceApi.js — 축산물이력 공공데이터 API 공용 라이브러리
 *
 * 공공데이터포털 "축산물이력제 개체 조회" 서비스 래퍼.
 * EKAPE(축산물품질평가원) 엔드포인트:
 *   http://data.ekape.or.kr/openapi-data/service/user/animalTrace/traceNoSearch
 *
 * 응답: response.body.items.item[]
 *   infoType 1 = 개체정보 (출생, 성별, 품종)
 *   infoType 2 = 사육정보 (농장주, 농장주소) — 반복
 *   infoType 3 = 도축정보 (도축일, 도축장, 등급, 중량)
 *   infoType 4 = 포장정보
 *   infoType 5 = 백신
 *
 * API 키는 AsyncStorage `@meatbig_mtrace_api_key`에 저장 (ScanScreen에서 입력).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MTRACE_KEY_STORAGE = '@meatbig_mtrace_api_key';
export const MTRACE_BASE =
  'http://data.ekape.or.kr/openapi-data/service/user/animalTrace';

// ─── 날짜 포맷 (20221015 → 2022.10.15) ─────────────────
export function fmtDate(val) {
  const s = String(val || '');
  if (s.length === 8) return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
  return s || 'N/A';
}

// ISO(YYYY-MM-DD) 포맷 변환 — Step 1의 purchaseDate용
export function toIsoDate(val) {
  const s = String(val || '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}

// 저장된 API 키 불러오기
//   1순위) AsyncStorage @meatbig_mtrace_api_key — ScanScreen에서 사용자가 직접 입력한 값
//   2순위) .env.local 의 EXPO_PUBLIC_MTRACE_API_KEY — 개발·빌드 단계에서 기본 주입
//   → 사용자 입력이 있으면 우선, 없으면 env 폴백 (env도 없으면 Mock)
export async function getMtraceKey() {
  try {
    const stored = await AsyncStorage.getItem(MTRACE_KEY_STORAGE);
    if (stored && stored.trim()) return stored.trim();
  } catch {}
  const envKey = process.env.EXPO_PUBLIC_MTRACE_API_KEY;
  return envKey && envKey.trim() ? envKey.trim() : '';
}

// 키 존재 여부 (UI에서 "API 키 미설정" 경고를 띄울지 판단)
export async function hasMtraceKey() {
  const k = await getMtraceKey();
  return !!k;
}

// ─── 실제 API 호출 ──────────────────────────────────────
export async function fetchMtrace(traceNo, apiKey) {
  const url =
    `${MTRACE_BASE}/traceNoSearch?traceNo=${encodeURIComponent(traceNo)}` +
    `&serviceKey=${encodeURIComponent(apiKey)}&_type=json`;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    const json = await res.json();
    const header = json?.response?.header;
    const body = json?.response?.body;
    if (header?.resultCode && header.resultCode !== '00') return null;
    const raw = body?.items?.item;
    if (!raw) return null;
    const items = Array.isArray(raw) ? raw : [raw];
    if (items.length === 0) return null;

    // infoType별 분리
    const individual = items.find(i => i.infoType === 1 || i.infoType === '1');
    const farms      = items.filter(i => i.infoType === 2 || i.infoType === '2');
    const butchery   = items.find(i => i.infoType === 3 || i.infoType === '3');

    const lastFarm = farms.length > 0 ? farms[farms.length - 1] : null;
    const farmAddr = lastFarm?.farmAddr || '';
    const farmerNm = lastFarm?.farmerNm ? String(lastFarm.farmerNm).trim() : '';

    // 품종 매핑 (lsTypeNm 예: "한우", "육우", "젖소")
    let speciesGuess = null;
    const lsType = individual?.lsTypeNm || '';
    if (lsType.includes('한우')) speciesGuess = '한우';
    else if (lsType.includes('육우')) speciesGuess = '육우';
    else if (lsType.includes('젖소')) speciesGuess = '육우';
    else if (lsType.includes('돼지') || lsType.includes('돈')) {
      speciesGuess = lsType.includes('흑') ? '흑돼지' : '한돈';
    }

    return {
      traceNo,
      animalType: individual?.lsTypeNm
        ? `${individual.lsTypeNm}${individual.sexNm ? ' ' + individual.sexNm : ''}`
        : '소',
      species: speciesGuess,                                // 자동 매핑 (매핑 실패 시 null)
      grade: butchery?.gradeNm != null ? String(butchery.gradeNm) : 'N/A',
      birthDate:     fmtDate(individual?.birthYmd),
      birthDateIso:  toIsoDate(individual?.birthYmd),
      farmName: farmerNm && farmAddr
        ? `${farmerNm} (${farmAddr})`
        : (farmAddr || farmerNm || 'N/A'),
      farmerName: farmerNm || null,
      slaughterDate:    fmtDate(butchery?.butcheryYmd),
      slaughterDateIso: toIsoDate(butchery?.butcheryYmd),
      slaughterPlace: butchery?.butcheryPlaceNm
        ? `${butchery.butcheryPlaceNm}${butchery.butcheryPlaceAddr ? ' (' + butchery.butcheryPlaceAddr + ')' : ''}`
        : 'N/A',
      slaughterPlaceName: butchery?.butcheryPlaceNm || null,
      weight:     butchery?.weight ? `${butchery.weight}kg` : 'N/A',
      weightKg:   butchery?.weight ? Number(butchery.weight) : null,
      inspection: butchery?.inspectPassYn || 'N/A',
    };
  } catch {
    clearTimeout(tid);
    return null;
  }
}

// ─── 데모용 Mock (API 키 없을 때 폴백) ────────────────
const MOCK_TRACE_DB = {
  '002091700003743': {
    traceNo: '002091700003743', animalType: '한우 암', species: '한우', grade: '1++',
    birthDate: '2022.03.15', birthDateIso: '2022-03-15',
    farmName: '○○한우농장 (경북 안동)', farmerName: '○○한우농장',
    slaughterDate: '2024.10.20', slaughterDateIso: '2024-10-20',
    slaughterPlace: '○○도축장 (HACCP 인증)', slaughterPlaceName: '○○도축장',
    weight: '462kg', weightKg: 462, inspection: '적합',
  },
  '002091800012456': {
    traceNo: '002091800012456', animalType: '한우 거', species: '한우', grade: '1+',
    birthDate: '2021.11.08', birthDateIso: '2021-11-08',
    farmName: '△△한우목장 (강원 횡성)', farmerName: '△△한우목장',
    slaughterDate: '2024.09.05', slaughterDateIso: '2024-09-05',
    slaughterPlace: '△△도축장 (HACCP 인증)', slaughterPlaceName: '△△도축장',
    weight: '498kg', weightKg: 498, inspection: '적합',
  },
};

// ─── 공용 조회 (키 없으면 Mock 폴백) ───────────────────
export async function lookupTrace(traceNo, apiKey = '') {
  const clean = String(traceNo || '').replace(/\D/g, '');
  if (!clean) return null;

  const key = apiKey || (await getMtraceKey());

  // API 키 없음 → Mock 폴백
  if (!key) {
    await new Promise(r => setTimeout(r, 300));
    return MOCK_TRACE_DB[clean] || {
      traceNo: clean, animalType: '조회 불가', species: null, grade: 'N/A',
      birthDate: 'N/A', birthDateIso: null,
      farmName: 'API 키를 설정해야 실제 데이터를 조회할 수 있습니다', farmerName: null,
      slaughterDate: 'N/A', slaughterDateIso: null,
      slaughterPlace: 'N/A', slaughterPlaceName: null,
      weight: 'N/A', weightKg: null, inspection: 'N/A',
    };
  }

  const result = await fetchMtrace(clean, key);
  if (result) return result;

  return {
    traceNo: clean, animalType: '이력 없음', species: null, grade: 'N/A',
    birthDate: 'N/A', birthDateIso: null,
    farmName: '등록되지 않은 이력번호입니다', farmerName: null,
    slaughterDate: 'N/A', slaughterDateIso: null,
    slaughterPlace: 'N/A', slaughterPlaceName: null,
    weight: 'N/A', weightKg: null, inspection: 'N/A',
  };
}
