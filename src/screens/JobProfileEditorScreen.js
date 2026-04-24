/**
 * JobProfileEditorScreen — 구직 프로필 편집 (위저드 방식)
 *
 * 흐름:
 *  Step 1/4) 근무 희망 지역 선택 → 다음
 *  Step 2/4) 근무 형태 선택       → 다음
 *  Step 3/4) 희망 월급 선택       → 다음
 *  Step 4/4) 자기소개 입력        → 다음
 *  Final)    등급 카드 + 프로필 공개 토글 + 비공개 정보 + 저장
 *
 * 위저드 탐색:
 *  - 상단 진행바 (1/4 ~ 4/4)
 *  - 헤더 왼쪽 "이전" 버튼으로 뒤로 이동 가능
 *  - 최종 화면에서도 "이전" 으로 돌아가 수정 가능
 *
 * 저장 시:
 *  - jobStore.profileStore.saveRemote() 호출 (로컬 + Supabase)
 *
 * 최초 진입 시:
 *  - route.params.assessmentResult가 있으면 applyAssessment 자동 반영
 *  - 아니면 fetchRemote → 없으면 getLocal
 *  - 기존에 저장된 값이 있으면 위저드를 건너뛰고 최종 화면으로 진입
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { profileStore, EMPTY_PROFILE } from '../lib/jobStore';
import { GRADES } from '../data/jobAssessment';

const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  red2:   '#DC2626',
  ok:     '#15803D',
  ok2:    '#16A34A',
  okS:    'rgba(21,128,61,0.09)',
  warn:   '#B45309',
  warn2:  '#D97706',
  warnS:  'rgba(180,83,9,0.09)',
  blue:   '#1D4ED8',
  blue2:  '#2563EB',
  blueS:  'rgba(29,78,216,0.09)',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
};

// ── 옵션 ─────────────────────────────────────────────────
const REGION_OPTIONS = [
  '서울', '경기 북부', '경기 남부', '인천',
  '강원', '충북', '충남/세종/대전', '전북',
  '전남/광주', '경북/대구', '경남/부산/울산', '제주',
];
const WORK_TYPE_OPTIONS = [
  '정직원 (주6일)',
  '정직원 (주5일)',
  '파트타임',
  '주말만',
  '프리랜서 (출장 발골)',
];
const SALARY_OPTIONS = [
  '220~260만원',
  '260~300만원',
  '300~360만원',
  '360~420만원',
  '420만원 이상',
  '협의',
];

const INTRO_MAX = 150;

// 위저드 스텝 정의
const STEP_REGION   = 0;
const STEP_WORKTYPE = 1;
const STEP_SALARY   = 2;
const STEP_INTRO    = 3;
const STEP_FINAL    = 4;
const TOTAL_STEPS   = 4;

export default function JobProfileEditorScreen({ navigation, route }) {
  const assessmentResult = route?.params?.assessmentResult || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [step, setStep]       = useState(STEP_REGION);

  // ── 초기 로드 ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 원격 우선 → 실패/없음이면 로컬
      const remote = await profileStore.fetchRemote();
      let base;
      if (remote.data) base = { ...EMPTY_PROFILE, ...remote.data };
      else             base = await profileStore.getLocal();

      // 평가 결과가 들어왔다면 자동 반영
      if (assessmentResult) {
        base = {
          ...base,
          grade: assessmentResult.finalGrade?.letter || null,
          percent: assessmentResult.percent ?? 0,
          section_scores: assessmentResult.sectionAvgs || null,
        };
      }

      setProfile(base);

      // 이미 핵심 필드가 채워져 있으면 위저드 건너뛰고 최종 화면으로
      const hasCore = !!(base.region && base.preferred_work && base.desired_salary);
      setStep(hasCore ? STEP_FINAL : STEP_REGION);

      setLoading(false);
    })();
  }, [assessmentResult]);

  const set = (key, val) => setProfile(prev => ({ ...prev, [key]: val }));

  const gradeInfo = useMemo(() => {
    if (!profile.grade) return null;
    return GRADES.find(g => g.letter === profile.grade) || null;
  }, [profile.grade]);

  // ── 위저드 내비게이션 ─────────────────────────────────────
  const goPrev = () => {
    if (step > STEP_REGION) setStep(step - 1);
    else navigation.goBack?.();
  };
  const goNext = () => setStep(s => Math.min(s + 1, STEP_FINAL));

  // 각 스텝의 "다음" 버튼 활성화 조건
  const canProceed = useMemo(() => {
    switch (step) {
      case STEP_REGION:   return !!profile.region;
      case STEP_WORKTYPE: return !!profile.preferred_work;
      case STEP_SALARY:   return !!profile.desired_salary;
      case STEP_INTRO:    return true; // 자기소개는 선택 — 비워두어도 진행 가능
      default:            return true;
    }
  }, [step, profile.region, profile.preferred_work, profile.desired_salary]);

  // ── 저장 ───────────────────────────────────────────────
  const handleSave = async () => {
    // 공개 시 필수 필드 체크
    if (profile.is_public) {
      if (!profile.region) {
        Alert.alert('필수 입력', '지역을 선택해 주세요.');
        setStep(STEP_REGION);
        return;
      }
      if (!profile.preferred_work) {
        Alert.alert('필수 입력', '근무 형태를 선택해 주세요.');
        setStep(STEP_WORKTYPE);
        return;
      }
      if (!profile.grade) {
        Alert.alert(
          '평가 먼저',
          '공개 프로필에는 등급이 필요합니다. 자가역량평가를 먼저 진행해 주세요.',
        );
        return;
      }
    }

    setSaving(true);
    const { data, error } = await profileStore.saveRemote(profile);
    setSaving(false);

    if (error && error !== 'no-session') {
      Alert.alert('저장 실패', error);
      return;
    }

    Alert.alert(
      '저장 완료',
      error === 'no-session'
        ? '로그인 없이 단말에만 저장되었습니다. 로그인 후 자동 동기화됩니다.'
        : (profile.is_public
            ? '프로필이 저장되었습니다. 사장들이 검색할 수 있습니다.'
            : '프로필이 저장되었습니다. (비공개 상태)'),
      [{ text: '확인', onPress: () => navigation.goBack?.() }],
    );
  };

  // ── 로딩 ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.container}>
        <ScreenHeader title="프로필 편집" iconName="person-outline" iconBg={C.blue2} />
        <View style={S.loadingBox}>
          <ActivityIndicator size="large" color={C.blue2} />
          <Text style={S.loadingTxt}>프로필 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  const isWizard = step < STEP_FINAL;

  return (
    <View style={S.container}>
      <ScreenHeader
        title="프로필 편집"
        iconName="person-outline"
        iconBg={C.blue2}
        rightAction={
          !isWizard ? (
            <TouchableOpacity
              style={S.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={C.blue2} />
              ) : (
                <Text style={S.saveBtnTxt}>저장</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      {/* 위저드 진행바 */}
      {isWizard && (
        <View style={S.progressWrap}>
          <View style={S.progressHead}>
            <TouchableOpacity onPress={goPrev} style={S.prevBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={C.t2} />
              <Text style={S.prevBtnTxt}>이전</Text>
            </TouchableOpacity>
            <Text style={S.progressNum}>
              <Text style={{ color: C.blue2, fontWeight: '900' }}>{step + 1}</Text>
              <Text style={{ color: C.t4 }}> / {TOTAL_STEPS}</Text>
            </Text>
          </View>
          <View style={S.progressTrack}>
            <View
              style={[
                S.progressFill,
                { width: `${((step + 1) / TOTAL_STEPS) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

        {/* ─────────── 위저드 스텝 ─────────── */}
        {step === STEP_REGION && (
          <View>
            <Text style={S.stepTtl}>근무 희망 지역</Text>
            <Text style={S.stepSb}>일하고 싶은 지역을 선택해 주세요.</Text>

            <View style={[S.chipWrap, { marginTop: 18 }]}>
              {REGION_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[S.chipLg, profile.region === r && S.chipActive]}
                  onPress={() => set('region', r)}
                  activeOpacity={0.8}
                >
                  <Text style={[S.chipLgTxt, profile.region === r && S.chipTxtActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === STEP_WORKTYPE && (
          <View>
            <Text style={S.stepTtl}>근무 형태</Text>
            <Text style={S.stepSb}>선호하는 근무 형태를 선택해 주세요.</Text>

            <View style={{ marginTop: 18, gap: 8 }}>
              {WORK_TYPE_OPTIONS.map(w => {
                const active = profile.preferred_work === w;
                return (
                  <TouchableOpacity
                    key={w}
                    style={[S.rowOpt, active && S.rowOptActive]}
                    onPress={() => set('preferred_work', w)}
                    activeOpacity={0.85}
                  >
                    <Text style={[S.rowOptTxt, active && { color: '#fff' }]}>{w}</Text>
                    {active && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === STEP_SALARY && (
          <View>
            <Text style={S.stepTtl}>희망 월급</Text>
            <Text style={S.stepSb}>원하는 월급 구간을 선택해 주세요.</Text>

            <View style={{ marginTop: 18, gap: 8 }}>
              {SALARY_OPTIONS.map(s => {
                const active = profile.desired_salary === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[S.rowOpt, active && S.rowOptActive]}
                    onPress={() => set('desired_salary', s)}
                    activeOpacity={0.85}
                  >
                    <Text style={[S.rowOptTxt, active && { color: '#fff' }]}>{s}</Text>
                    {active && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === STEP_INTRO && (
          <View>
            <Text style={S.stepTtl}>자기소개</Text>
            <Text style={S.stepSb}>사장에게 보여질 간단한 소개글을 적어주세요. (최대 {INTRO_MAX}자)</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, marginBottom: 6 }}>
              <Text style={S.counter}>
                {(profile.intro_public || '').length}/{INTRO_MAX}
              </Text>
            </View>
            <TextInput
              style={[S.textarea, { minHeight: 140 }]}
              value={profile.intro_public || ''}
              onChangeText={t => set('intro_public', t.slice(0, INTRO_MAX))}
              placeholder="예: 서울·경기 지역에서 돼지 발골·정형 위주로 5년 경력. 새벽 근무 가능."
              placeholderTextColor={C.t4}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={INTRO_MAX}
            />
            <Text style={S.hint}>
              ⚠ 실명·연락처·SNS·카톡 ID 등은 여기 적지 마세요. 사장이 "요청 → 내가 수락"한 경우에만 공개됩니다.
            </Text>
          </View>
        )}

        {/* 위저드 다음 버튼 */}
        {isWizard && (
          <TouchableOpacity
            style={[
              S.primaryBtn,
              { marginTop: 28 },
              !canProceed && { backgroundColor: C.t4 },
            ]}
            onPress={goNext}
            disabled={!canProceed}
            activeOpacity={0.85}
          >
            <Text style={S.primaryBtnTxt}>
              {step === STEP_INTRO ? '완료' : '다음'}
            </Text>
            <Ionicons
              name={step === STEP_INTRO ? 'checkmark-outline' : 'chevron-forward'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* ─────────── 최종 화면 (요약 + 공개 토글 + 비공개 정보 + 저장) ─────────── */}
        {step === STEP_FINAL && (
          <>
            {/* 평가 등급 요약 */}
            <Text style={S.sectionLabel}>
              <Ionicons name="trophy-outline" size={13} color={C.t2} />  평가 등급
            </Text>

            {gradeInfo ? (
              <View style={[S.gradeCard, { borderColor: gradeInfo.color }]}>
                <View style={[S.gradeBadge, { backgroundColor: gradeInfo.color }]}>
                  <Text style={S.gradeLetter}>{gradeInfo.letter}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.gradeTtl}>{gradeInfo.label} · {gradeInfo.sub}</Text>
                  <Text style={S.gradeSb}>
                    원 점수 {profile.percent}점 · {gradeInfo.salary}
                  </Text>
                </View>
                <TouchableOpacity
                  style={S.gradeReBtn}
                  onPress={() => {
                    if (navigation.replace) navigation.replace('JobAssessment');
                    else navigation.navigate('JobAssessment');
                  }}
                >
                  <Ionicons name="refresh-outline" size={14} color={C.t2} />
                  <Text style={S.gradeReTxt}>재평가</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={S.noGradeCard}
                onPress={() => navigation.navigate('JobAssessment')}
                activeOpacity={0.85}
              >
                <Ionicons name="clipboard-outline" size={22} color={C.red} />
                <View style={{ flex: 1 }}>
                  <Text style={S.noGradeTtl}>평가 미완료</Text>
                  <Text style={S.noGradeSb}>
                    자가역량평가를 완료하면 D/C/B/A/S 등급이 부여됩니다
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.t3} />
              </TouchableOpacity>
            )}

            {/* 입력한 공개 정보 요약 (편집하려면 "수정" 탭) */}
            <View style={S.summaryCard}>
              <View style={S.summaryHead}>
                <Text style={S.summaryTtl}>내가 입력한 공개 정보</Text>
                <TouchableOpacity
                  onPress={() => setStep(STEP_REGION)}
                  style={S.editChip}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={14} color={C.blue2} />
                  <Text style={S.editChipTxt}>수정</Text>
                </TouchableOpacity>
              </View>
              <SummaryRow icon="location-outline"  label="지역"     value={profile.region} />
              <SummaryRow icon="briefcase-outline" label="근무형태" value={profile.preferred_work} />
              <SummaryRow icon="cash-outline"      label="희망월급" value={profile.desired_salary} />
              <SummaryRow
                icon="chatbubble-ellipses-outline"
                label="자기소개"
                value={profile.intro_public || '(없음)'}
                multiline
              />
            </View>

            {/* 공개 토글 */}
            <View style={S.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={S.switchTtl}>프로필 공개</Text>
                <Text style={S.switchSb}>
                  {profile.is_public
                    ? '공개 중 · 사장들이 익명 프로필로 검색·조회 가능'
                    : '비공개 · 저장만 되고 목록에는 노출되지 않음'}
                </Text>
              </View>
              <Switch
                value={!!profile.is_public}
                onValueChange={v => set('is_public', v)}
                trackColor={{ false: C.bg2, true: C.ok2 }}
                thumbColor={Platform.OS === 'android' ? C.white : undefined}
              />
            </View>

            {/* 비공개 정보 */}
            <Text style={[S.sectionLabel, { marginTop: 24 }]}>
              <Ionicons name="lock-closed-outline" size={13} color={C.t2} />  비공개 정보
            </Text>
            <View style={S.privNotice}>
              <Ionicons name="shield-checkmark-outline" size={16} color={C.ok} />
              <Text style={S.privNoticeTxt}>
                아래 정보는 사장이 보낸 헤드헌팅 요청을 <Text style={{ fontWeight: '900' }}>내가 "수락"</Text>한 경우에만 공개됩니다.
                사장은 수락 전까지 실명·연락처를 절대 볼 수 없습니다.
              </Text>
            </View>

            <Text style={S.label}>실명</Text>
            <TextInput
              style={S.input}
              value={profile.real_name || ''}
              onChangeText={t => set('real_name', t)}
              placeholder="홍길동"
              placeholderTextColor={C.t4}
            />

            <Text style={[S.label, { marginTop: 12 }]}>연락처 (휴대폰)</Text>
            <TextInput
              style={S.input}
              value={profile.phone || ''}
              onChangeText={t => set('phone', t)}
              placeholder="010-0000-0000"
              placeholderTextColor={C.t4}
              keyboardType="phone-pad"
            />

            <Text style={[S.label, { marginTop: 12 }]}>이메일 (선택)</Text>
            <TextInput
              style={S.input}
              value={profile.email || ''}
              onChangeText={t => set('email', t)}
              placeholder="example@email.com"
              placeholderTextColor={C.t4}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[S.label, { marginTop: 12 }]}>상세 경력 (이전 사업장 등)</Text>
            <TextInput
              style={S.textarea}
              value={profile.detailed_experience || ''}
              onChangeText={t => set('detailed_experience', t)}
              placeholder="예: 2020~2023 ○○정육점 (돼지 발골 담당), 2023~현재 △△마트 정육부서 주임"
              placeholderTextColor={C.t4}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* 하단 저장 버튼 */}
            <TouchableOpacity
              style={[S.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={18} color="#fff" />
                  <Text style={S.primaryBtnTxt}>저장하기</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ── 요약 줄 컴포넌트 ─────────────────────────────────────
function SummaryRow({ icon, label, value, multiline }) {
  return (
    <View style={[S.sumRow, multiline && { alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={15} color={C.t3} style={{ marginTop: multiline ? 2 : 0 }} />
      <Text style={S.sumLbl}>{label}</Text>
      <Text
        style={[S.sumVal, !value && { color: C.t4, fontStyle: 'italic' }]}
        numberOfLines={multiline ? 3 : 1}
      >
        {value || '(미입력)'}
      </Text>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 120 },
  loadingBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  loadingTxt: { fontSize: 13, color: C.t3 },

  saveBtn: {
    height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: C.blueS,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnTxt: { fontSize: 13, fontWeight: '900', color: C.blue2 },

  // 위저드 진행바
  progressWrap: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  progressHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  prevBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingRight: 6,
  },
  prevBtnTxt: { fontSize: 13, fontWeight: '700', color: C.t2 },
  progressNum: { fontSize: 13 },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: C.bg2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: C.blue2, borderRadius: 3,
  },

  // 스텝 헤더
  stepTtl: {
    fontSize: 22, fontWeight: '900', color: C.t1,
    marginTop: 8, letterSpacing: -0.3,
  },
  stepSb: {
    fontSize: 13, color: C.t3, marginTop: 6, lineHeight: 18,
  },

  // 옵션 리스트 (세로형)
  rowOpt: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowOptActive: { backgroundColor: C.blue2, borderColor: C.blue2 },
  rowOptTxt:    { fontSize: 14, fontWeight: '700', color: C.t1 },

  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: C.t2,
    letterSpacing: 0.3, marginBottom: 10,
  },

  // 등급 카드
  gradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 2, padding: 14, marginBottom: 4,
  },
  gradeBadge: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeLetter: { color: '#fff', fontSize: 22, fontWeight: '900' },
  gradeTtl: { fontSize: 14, fontWeight: '900', color: C.t1 },
  gradeSb:  { fontSize: 12, color: C.t3, marginTop: 2 },
  gradeReBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.bg2, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  gradeReTxt: { fontSize: 11, fontWeight: '800', color: C.t2 },

  noGradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEE2E2', borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA',
    padding: 12,
  },
  noGradeTtl: { fontSize: 13, fontWeight: '900', color: C.red },
  noGradeSb:  { fontSize: 11, color: C.red2, marginTop: 2 },

  // 요약 카드
  summaryCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginTop: 20,
  },
  summaryHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryTtl: { fontSize: 13, fontWeight: '900', color: C.t2 },
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.blueS, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  editChipTxt: { fontSize: 11, fontWeight: '800', color: C.blue2 },
  sumRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
  },
  sumLbl: { fontSize: 12, fontWeight: '800', color: C.t3, width: 56 },
  sumVal: { flex: 1, fontSize: 13, color: C.t1, fontWeight: '600' },

  // 입력
  label: {
    fontSize: 12, fontWeight: '800', color: C.t2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14, color: C.t1,
  },
  textarea: {
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.t1,
    minHeight: 88,
  },
  counter: { fontSize: 11, color: C.t4, fontWeight: '700' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  // 위저드용 큰 칩
  chipLg: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11,
    minWidth: 92, alignItems: 'center',
  },
  chipLgTxt: { fontSize: 13, fontWeight: '700', color: C.t1 },
  chipActive: { backgroundColor: C.blue2, borderColor: C.blue2 },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.t2 },
  chipTxtActive: { color: '#fff' },

  hint: { fontSize: 11, color: C.t4, marginTop: 8, lineHeight: 16 },

  switchRow: {
    marginTop: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14,
  },
  switchTtl: { fontSize: 14, fontWeight: '900', color: C.t1, marginBottom: 2 },
  switchSb:  { fontSize: 11, color: C.t3, lineHeight: 15 },

  privNotice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    padding: 12, borderRadius: 10,
    backgroundColor: C.okS,
    borderWidth: 1, borderColor: 'rgba(21,128,61,0.2)',
    marginBottom: 12,
  },
  privNoticeTxt: { flex: 1, fontSize: 11, color: C.ok, lineHeight: 16 },

  primaryBtn: {
    marginTop: 20,
    backgroundColor: C.blue2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
