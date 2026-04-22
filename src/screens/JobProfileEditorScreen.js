/**
 * JobProfileEditorScreen — 구직 프로필 편집
 *
 * 주요 섹션:
 *  1) 평가 등급 요약 (읽기 전용, 편집 불가 — 재평가로만 갱신)
 *  2) 공개 정보
 *     - 지역 (근무 희망지)
 *     - 근무 형태 (정직원 / 파트타임 / 프리랜서 / 주말만)
 *     - 희망 월급
 *     - 자기소개 (150자, 실명·연락처 금지)
 *     - 공개 여부 토글
 *  3) 비공개 정보 (수락 시에만 사장에게 공개)
 *     - 실명
 *     - 연락처 (휴대폰)
 *     - 이메일
 *     - 상세 경력 (이전 사업장)
 *
 * 저장 시:
 *  - jobStore.profileStore.saveRemote() 호출 (로컬 + Supabase)
 *  - 성공 토스트/알림 표시
 *  - 뒤로가기로 복귀
 *
 * 최초 진입 시:
 *  - route.params.assessmentResult가 있으면 applyAssessment 자동 호출
 *  - 아니면 fetchRemote → 없으면 getLocal
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

export default function JobProfileEditorScreen({ navigation, route }) {
  const assessmentResult = route?.params?.assessmentResult || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });

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
      setLoading(false);
    })();
  }, [assessmentResult]);

  const set = (key, val) => setProfile(prev => ({ ...prev, [key]: val }));

  const gradeInfo = useMemo(() => {
    if (!profile.grade) return null;
    return GRADES.find(g => g.letter === profile.grade) || null;
  }, [profile.grade]);

  // ── 저장 ───────────────────────────────────────────────
  const handleSave = async () => {
    // 공개 시 필수 필드 체크
    if (profile.is_public) {
      if (!profile.region) {
        Alert.alert('필수 입력', '지역을 선택해 주세요.');
        return;
      }
      if (!profile.preferred_work) {
        Alert.alert('필수 입력', '근무 형태를 선택해 주세요.');
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

  return (
    <View style={S.container}>
      <ScreenHeader
        title="프로필 편집"
        iconName="person-outline"
        iconBg={C.blue2}
        rightAction={
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
        }
      />

      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

        {/* 1) 평가 등급 요약 */}
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

        {/* 2) 공개 정보 */}
        <Text style={[S.sectionLabel, { marginTop: 20 }]}>
          <Ionicons name="eye-outline" size={13} color={C.t2} />  공개 정보 (익명 노출)
        </Text>

        {/* 지역 */}
        <Text style={S.label}>근무 희망 지역 *</Text>
        <View style={S.chipWrap}>
          {REGION_OPTIONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[S.chip, profile.region === r && S.chipActive]}
              onPress={() => set('region', r)}
              activeOpacity={0.8}
            >
              <Text style={[S.chipTxt, profile.region === r && S.chipTxtActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 근무 형태 */}
        <Text style={[S.label, { marginTop: 16 }]}>근무 형태 *</Text>
        <View style={S.chipWrap}>
          {WORK_TYPE_OPTIONS.map(w => (
            <TouchableOpacity
              key={w}
              style={[S.chip, profile.preferred_work === w && S.chipActive]}
              onPress={() => set('preferred_work', w)}
              activeOpacity={0.8}
            >
              <Text style={[S.chipTxt, profile.preferred_work === w && S.chipTxtActive]}>{w}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 희망 월급 */}
        <Text style={[S.label, { marginTop: 16 }]}>희망 월급</Text>
        <View style={S.chipWrap}>
          {SALARY_OPTIONS.map(s => (
            <TouchableOpacity
              key={s}
              style={[S.chip, profile.desired_salary === s && S.chipActive]}
              onPress={() => set('desired_salary', s)}
              activeOpacity={0.8}
            >
              <Text style={[S.chipTxt, profile.desired_salary === s && S.chipTxtActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 자기소개 */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <Text style={S.label}>자기소개 (공개)</Text>
          <Text style={S.counter}>
            {(profile.intro_public || '').length}/{INTRO_MAX}
          </Text>
        </View>
        <TextInput
          style={S.textarea}
          value={profile.intro_public || ''}
          onChangeText={t => set('intro_public', t.slice(0, INTRO_MAX))}
          placeholder="예: 서울·경기 지역에서 돼지 발골·정형 위주로 5년 경력. 새벽 근무 가능. (실명·연락처는 여기에 적지 마세요)"
          placeholderTextColor={C.t4}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={INTRO_MAX}
        />
        <Text style={S.hint}>
          ⚠ 실명·연락처·SNS·카톡 ID 등은 사장이 "요청 → 내가 수락"한 경우에만 공개됩니다.
        </Text>

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

        {/* 3) 비공개 정보 */}
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

      </ScrollView>
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

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipActive: { backgroundColor: C.blue2, borderColor: C.blue2 },
  chipTxt: { fontSize: 12, fontWeight: '700', color: C.t2 },
  chipTxtActive: { color: '#fff' },

  hint: { fontSize: 11, color: C.t4, marginTop: 6 },

  switchRow: {
    marginTop: 16,
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
