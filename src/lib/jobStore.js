/**
 * jobStore.js — 구직 프로필 / 자가역량평가 / 헤드헌팅 로컬 + Supabase 동기화
 *
 * 설계 원칙:
 *   1) AsyncStorage에 먼저 저장 (오프라인 안전)
 *   2) 가능하면 Supabase에 동기화 (실패해도 로컬 유지)
 *   3) 앱 시작 시 로컬 → UI 즉시 표시, 동시에 Supabase pull 시도
 *   4) RLS는 Supabase 측 정책에 맡김 (auth_uid = auth.uid())
 *
 * 스토리지 키:
 *   @meatbig_job_assessment        — 평가 응답 (진행 중) — JobAssessmentScreen에서 직접 사용
 *   @meatbig_job_assessment_result — 최종 등급 결과
 *   @meatbig_job_profile           — 공개 프로필 (로컬 캐시)
 *   @meatbig_job_headhunt_inbox    — 받은 헤드헌팅 요청 캐시
 *
 * 테이블 매핑 (20260422_job_matching.sql):
 *   UI field            → job_profiles column
 *   -----------------------------------------------------
 *   real_name           → full_name
 *   phone               → phone
 *   intro_public        → intro_text
 *   region              → region_si     (region_gu는 선택)
 *   preferred_work      → preferred_role
 *   desired_salary      → desired_pay
 *   grade               → assessment_grade
 *   percent             → assessment_score
 *   section_scores      → assessment_data.sectionAvgs
 *   experience          → career_years (문자열 → 숫자 변환)
 *   license             → certs[] (문자열 → 배열 변환)
 *   is_public           → is_public
 *   email               → (DB 미지원, 로컬 전용)
 *   detailed_experience → (DB 미지원, intro_text로 fallback)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, ensureAuth } from './supabase';

// ── 스토리지 키 ───────────────────────────────────────────
export const JOB_KEYS = {
  ASSESS_PROGRESS: '@meatbig_job_assessment',
  ASSESS_RESULT:   '@meatbig_job_assessment_result',
  PROFILE:         '@meatbig_job_profile',
  HEADHUNT_INBOX:  '@meatbig_job_headhunt_inbox',
};

// ── 공통 로컬 I/O ─────────────────────────────────────────
async function readLocal(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

async function writeLocal(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) { return false; }
}

async function removeLocal(key) {
  try { await AsyncStorage.removeItem(key); return true; }
  catch (_) { return false; }
}

// ═══════════════════════════════════════════════════════════
// 1) 자가역량평가 (진행 상태)
// ═══════════════════════════════════════════════════════════
export const assessmentStore = {
  /** 진행 중 응답 불러오기 */
  getProgress: () => readLocal(JOB_KEYS.ASSESS_PROGRESS, null),

  /** 진행 중 응답 저장 (sectionIdx, answers, experience, license, step) */
  saveProgress: (payload) => writeLocal(JOB_KEYS.ASSESS_PROGRESS, payload),

  /** 진행 상태 초기화 */
  resetProgress: () => removeLocal(JOB_KEYS.ASSESS_PROGRESS),

  /** 최종 결과 (등급) 저장 */
  saveResult: (result) => writeLocal(JOB_KEYS.ASSESS_RESULT, {
    ...result, savedAt: new Date().toISOString(),
  }),

  /** 최종 결과 불러오기 */
  getResult: () => readLocal(JOB_KEYS.ASSESS_RESULT, null),

  /** 결과 초기화 */
  clearResult: () => removeLocal(JOB_KEYS.ASSESS_RESULT),
};

// ═══════════════════════════════════════════════════════════
// 2) 구직 프로필 (job_profiles) — UI ↔ DB 매핑
// ═══════════════════════════════════════════════════════════

/** 프로필 UI 기본값 */
export const EMPTY_PROFILE = {
  // 공개 (익명)
  grade: null,
  percent: 0,
  section_scores: null,
  experience: null,        // '1년 미만' | '1~3년' | '3~5년' | '5~10년' | '10년 이상'
  license: null,           // '없음' | '취득 준비' | '취득 완료'
  region: null,            // '서울','경기 북부' 등
  preferred_work: null,    // '정직원 (주6일)' 등
  desired_salary: null,    // '300~360만원' 등
  intro_public: '',        // 150자 자기소개 (공개)
  is_public: false,

  // 비공개 (수락 시에만 공개)
  real_name: '',
  phone: '',
  email: '',               // 로컬 전용 (DB 미지원)
  detailed_experience: '', // intro_text로 병합 저장
};

// ── 경력 문자열 → 숫자 변환 ───────────────────────────────
function experienceToYears(exp) {
  switch (exp) {
    case '1년 미만':   return 0;
    case '1~3년':      return 2;
    case '3~5년':      return 4;
    case '5~10년':     return 7;
    case '10년 이상':  return 10;
    default:           return 0;
  }
}

function yearsToExperience(years) {
  if (!years && years !== 0) return null;
  if (years < 1) return '1년 미만';
  if (years < 3) return '1~3년';
  if (years < 5) return '3~5년';
  if (years < 10) return '5~10년';
  return '10년 이상';
}

// ── UI → DB 변환 ─────────────────────────────────────────
function localToRemote(local) {
  const certs = [];
  if (local.license === '취득 완료') certs.push('식육처리기능사');
  else if (local.license === '취득 준비') certs.push('식육처리기능사(준비중)');

  // intro_public 뒤에 detailed_experience를 합쳐서 저장 (DB에 별도 컬럼 없음)
  const intro = [
    local.intro_public || '',
    local.detailed_experience
      ? `\n\n[상세 경력]\n${local.detailed_experience}`
      : '',
  ].join('').trim();

  return {
    // 필수
    full_name:         local.real_name || '(미입력)',
    phone:             local.phone || null,

    // 공개 프로필
    region_si:         local.region || null,
    career_years:      experienceToYears(local.experience),
    preferred_role:    local.preferred_work || null,
    desired_pay:       local.desired_salary || null,
    intro_text:        intro || null,
    certs:             certs.length > 0 ? certs : null,

    // 평가
    assessment_grade:  local.grade || null,
    assessment_score:  local.percent ?? null,
    assessment_data:   local.section_scores ? { sectionAvgs: local.section_scores } : null,
    assessed_at:       local.grade ? new Date().toISOString() : null,

    // 공개 상태
    is_public:         !!local.is_public,
  };
}

// ── DB → UI 변환 ─────────────────────────────────────────
function remoteToLocal(row) {
  if (!row) return null;

  // intro_text에서 [상세 경력] 블록 분리
  let intro = row.intro_text || '';
  let detailed = '';
  const marker = '\n\n[상세 경력]\n';
  const mIdx = intro.indexOf(marker);
  if (mIdx !== -1) {
    detailed = intro.slice(mIdx + marker.length).trim();
    intro    = intro.slice(0, mIdx).trim();
  }

  // certs[]에서 license 역변환
  const certs = row.certs || [];
  const license =
    certs.includes('식육처리기능사')         ? '취득 완료' :
    certs.includes('식육처리기능사(준비중)') ? '취득 준비' :
    '없음';

  return {
    grade:               row.assessment_grade || null,
    percent:             row.assessment_score ?? 0,
    section_scores:      row.assessment_data?.sectionAvgs || null,
    experience:          yearsToExperience(row.career_years),
    license,
    region:              row.region_si || null,
    preferred_work:      row.preferred_role || null,
    desired_salary:      row.desired_pay || null,
    intro_public:        intro,
    is_public:           !!row.is_public,

    real_name:           row.full_name || '',
    phone:               row.phone || '',
    email:               '', // DB 미지원 — 로컬에서 별도 병합
    detailed_experience: detailed,
  };
}

export const profileStore = {
  /** 로컬 프로필 불러오기 */
  getLocal: () => readLocal(JOB_KEYS.PROFILE, { ...EMPTY_PROFILE }),

  /** 로컬 프로필 저장 */
  saveLocal: (profile) => writeLocal(JOB_KEYS.PROFILE, profile),

  /** 로컬 초기화 */
  clearLocal: () => removeLocal(JOB_KEYS.PROFILE),

  /** Supabase에서 내 프로필 가져오기 (auth_uid = auth.uid() 기준) */
  async fetchRemote() {
    const user = await ensureAuth();
    if (!user) return { data: null, error: 'no-session' };

    try {
      // auth_uid 컬럼으로 조회 (RLS 자동 필터링)
      const { data, error } = await supabase
        .from('job_profiles')
        .select('*')
        .eq('auth_uid', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return { data: null, error: error.message };
      const local = remoteToLocal(data);

      // 로컬의 email만 유지 (DB에 없으므로)
      if (local) {
        const existing = await readLocal(JOB_KEYS.PROFILE, null);
        local.email = existing?.email || '';
        await writeLocal(JOB_KEYS.PROFILE, local);
      }
      return { data: local, error: null };
    } catch (e) { return { data: null, error: e.message }; }
  },

  /** Supabase로 프로필 upsert (로컬도 같이 저장) */
  async saveRemote(profile) {
    const user = await ensureAuth();
    if (!user) {
      // 로그인 없으면 로컬에만 저장
      await writeLocal(JOB_KEYS.PROFILE, profile);
      return { data: profile, error: 'no-session' };
    }

    const remotePayload = localToRemote(profile);

    try {
      // 기존 프로필 조회 → 있으면 update, 없으면 insert
      const { data: existing } = await supabase
        .from('job_profiles')
        .select('id')
        .eq('auth_uid', user.id)
        .limit(1)
        .maybeSingle();

      let saved;
      if (existing?.id) {
        const { data, error } = await supabase
          .from('job_profiles')
          .update({ ...remotePayload, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('job_profiles')
          .insert(remotePayload)   // auth_uid DEFAULT로 자동 채움
          .select()
          .single();
        if (error) throw new Error(error.message);
        saved = data;
      }

      const localShape = remoteToLocal(saved);
      if (localShape) {
        // email은 로컬만 유지
        localShape.email = profile.email || '';
        await writeLocal(JOB_KEYS.PROFILE, localShape);
      }
      return { data: localShape, error: null };
    } catch (e) {
      // 원격 실패 시 로컬만 저장
      await writeLocal(JOB_KEYS.PROFILE, profile);
      return { data: profile, error: e.message };
    }
  },

  /** 공개/비공개 토글 */
  async setPublic(isPublic) {
    const local = await readLocal(JOB_KEYS.PROFILE, { ...EMPTY_PROFILE });
    const next = { ...local, is_public: !!isPublic };
    return profileStore.saveRemote(next);
  },

  /**
   * 평가 결과를 프로필에 반영 (grade, percent, sectionAvgs만 업데이트)
   */
  async applyAssessment(result) {
    const local = await readLocal(JOB_KEYS.PROFILE, { ...EMPTY_PROFILE });
    const next = {
      ...local,
      grade:          result?.finalGrade?.letter || null,
      percent:        result?.percent ?? 0,
      section_scores: result?.sectionAvgs || null,
    };
    return profileStore.saveRemote(next);
  },
};

// ═══════════════════════════════════════════════════════════
// 3) 헤드헌팅 (headhunt_requests)
// ═══════════════════════════════════════════════════════════
export const headhuntStore = {
  /** 내가 받은 요청 (직원 기준) — to_profile_id의 주인이 나인 것 */
  async fetchInbox() {
    const user = await ensureAuth();
    if (!user) return { data: [], error: 'no-session' };

    try {
      // RLS의 hh_receiver 정책이 자동으로 나에게 온 것만 걸러줌
      const { data, error } = await supabase
        .from('headhunt_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: error.message };

      // 추가 필터: to_profile_id가 내 프로필이 아니면 제외 (방어)
      // → 이미 RLS에서 필터링됨, 여기선 pass
      await writeLocal(JOB_KEYS.HEADHUNT_INBOX, data || []);
      return { data: data || [], error: null };
    } catch (e) { return { data: [], error: e.message }; }
  },

  /** 내가 보낸 요청 (사장 기준) */
  async fetchSent() {
    const user = await ensureAuth();
    if (!user) return { data: [], error: 'no-session' };

    try {
      const { data, error } = await supabase
        .from('headhunt_requests')
        .select('*')
        .eq('auth_uid', user.id)
        .order('created_at', { ascending: false });
      return { data: data || [], error: error?.message || null };
    } catch (e) { return { data: [], error: e.message }; }
  },

  /** 로컬 인박스 캐시 */
  getLocalInbox: () => readLocal(JOB_KEYS.HEADHUNT_INBOX, []),

  /** 요청 수락/거절 (receiver용) */
  async respond(requestId, status /* 'accepted'|'declined' */) {
    const user = await ensureAuth();
    if (!user) return { data: null, error: 'no-session' };
    try {
      const { data, error } = await supabase
        .from('headhunt_requests')
        .update({ status, decided_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
      return { data, error: error?.message || null };
    } catch (e) { return { data: null, error: e.message }; }
  },

  /** 요청 생성 (sender = 사장) */
  async create({ to_profile_id, message, offered_pay, offered_role, offered_start_date }) {
    const user = await ensureAuth();
    if (!user) return { data: null, error: 'no-session' };
    try {
      const { data, error } = await supabase
        .from('headhunt_requests')
        .insert({
          to_profile_id,
          message: message || '',
          offered_pay: offered_pay || null,
          offered_role: offered_role || null,
          offered_start_date: offered_start_date || null,
          status: 'pending',
        })
        .select()
        .single();
      return { data, error: error?.message || null };
    } catch (e) { return { data: null, error: e.message }; }
  },
};

// ═══════════════════════════════════════════════════════════
// 4) 공개 프로필 목록 조회 (사장용)
// ═══════════════════════════════════════════════════════════
export const publicListStore = {
  /** 익명 프로필 목록 (job_profiles_public 뷰) */
  async list({ grade = null, region_si = null, limit = 30 } = {}) {
    try {
      let q = supabase.from('job_profiles_public').select('*').limit(limit);
      if (grade)     q = q.eq('assessment_grade', grade);
      if (region_si) q = q.eq('region_si', region_si);
      const { data, error } = await q;
      return { data: data || [], error: error?.message || null };
    } catch (e) { return { data: [], error: e.message }; }
  },

  /** 수락된 요청의 실명·연락처 조회 (SECURITY DEFINER 함수) */
  async getRevealed(requestId) {
    try {
      const { data, error } = await supabase.rpc('get_revealed_profile', {
        request_id: requestId,
      });
      return { data, error: error?.message || null };
    } catch (e) { return { data: null, error: e.message }; }
  },
};

// ═══════════════════════════════════════════════════════════
// 5) 쿼터 사용량
// ═══════════════════════════════════════════════════════════
export const quotaStore = {
  /** 이번 달 사용량 조회 */
  async getCurrentMonth() {
    const user = await ensureAuth();
    if (!user) return { used: 0, limit: 20, error: 'no-session' };
    try {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('contact_quota_usage')
        .select('*')
        .eq('auth_uid', user.id)
        .eq('year_month', ym)
        .maybeSingle();

      const base   = data?.plan_base_quota ?? 20; // 프로모 기본
      const bought = data?.purchased_quota ?? 0;
      return {
        used:  data?.used_count ?? 0,
        limit: base + bought,
        error: error?.message || null,
      };
    } catch (e) { return { used: 0, limit: 20, error: e.message }; }
  },
};

// ═══════════════════════════════════════════════════════════
// 6) 전체 로그아웃 시 정리
// ═══════════════════════════════════════════════════════════
export async function clearAllJobData() {
  await Promise.all([
    removeLocal(JOB_KEYS.ASSESS_PROGRESS),
    removeLocal(JOB_KEYS.ASSESS_RESULT),
    removeLocal(JOB_KEYS.PROFILE),
    removeLocal(JOB_KEYS.HEADHUNT_INBOX),
  ]);
}
