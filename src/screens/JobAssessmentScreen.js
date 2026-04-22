/**
 * JobAssessmentScreen — 정육기술자 자가역량평가 (51문항)
 *
 * 플로우:
 *  1) intro    — 경력·자격증 선택
 *  2) section  — 7개 영역 × 문항 (1~5 척도)
 *  3) 완료      — 결과 화면으로 이동
 *
 * 특징:
 *  - 상단 ScreenHeader (뒤로가기 + 진행률 서브타이틀)
 *  - 진행률 바 (응답/전체)
 *  - 섹션 탐색 도트 (현재/완료/미완료)
 *  - AsyncStorage 자동 저장 (@meatbig_job_assessment) → 앱 재실행 후 이어하기
 *  - 계산은 data/jobAssessment.js calculateGrade()에 위임
 *  - 완료 시 JobAssessmentResult로 replace 이동 (뒤로가기 시 평가 다시 시작 안 함)
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ScreenHeader from '../components/ScreenHeader';
import {
  SECTIONS,
  RATING_LABELS,
  TOTAL_QUESTIONS,
  EXPERIENCE_OPTIONS,
  LICENSE_OPTIONS,
  isSectionDone,
  isAllDone,
  answeredCount,
  calculateGrade,
} from '../data/jobAssessment';

const STORAGE_KEY = '@meatbig_job_assessment';

// ── 팔레트 (타 화면과 통일) ─────────────────────────────
const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  red2:   '#DC2626',
  redS:   'rgba(185,28,28,0.08)',
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

export default function JobAssessmentScreen({ navigation }) {
  const [step, setStep] = useState('intro'); // 'intro' | 'section'
  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [sectionId]: { [qIdx]: 1~5 } }
  const [experience, setExperience] = useState(null);
  const [license, setLicense] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef(null);

  // ── 저장된 진행 상태 복구 ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.answers)    setAnswers(saved.answers);
          if (saved.experience) setExperience(saved.experience);
          if (saved.license)    setLicense(saved.license);
          if (saved.step)       setStep(saved.step);
          if (typeof saved.sectionIdx === 'number') setSectionIdx(saved.sectionIdx);
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  // ── 진행 상태 자동 저장 ───────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers, experience, license, step, sectionIdx }),
    ).catch(() => {});
  }, [answers, experience, license, step, sectionIdx, loaded]);

  // ── 응답 수정 ─────────────────────────────────────────
  const setAnswer = (sectionId, qIdx, value) => {
    setAnswers(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), [qIdx]: value },
    }));
  };

  const progressCount = useMemo(() => answeredCount(answers), [answers]);
  const progressPct   = Math.round((progressCount / TOTAL_QUESTIONS) * 100);

  // ── 뒤로가기 (탭 루트로) ──────────────────────────────
  const handleHeaderBack = () => {
    if (navigation.canGoBack?.()) { navigation.goBack(); return; }
    try { navigation.getParent?.()?.navigate?.('HomeTab'); } catch (_) {}
  };

  // ── 초기화 (다시 시작) ────────────────────────────────
  const handleReset = () => {
    Alert.alert(
      '평가 다시 시작',
      '입력한 응답이 모두 삭제됩니다. 계속하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화', style: 'destructive',
          onPress: async () => {
            setAnswers({});
            setExperience(null);
            setLicense(null);
            setStep('intro');
            setSectionIdx(0);
            await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
          },
        },
      ],
    );
  };

  // ── 다음 섹션 or 제출 ─────────────────────────────────
  const goNextSection = () => {
    if (sectionIdx < SECTIONS.length - 1) {
      setSectionIdx(sectionIdx + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleSubmit();
    }
  };

  // ── 이전 섹션 or 인트로 ───────────────────────────────
  const goPrevSection = () => {
    if (sectionIdx === 0) {
      setStep('intro');
    } else {
      setSectionIdx(sectionIdx - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // ── 제출 → 결과 화면 ──────────────────────────────────
  const handleSubmit = () => {
    if (!isAllDone(answers)) {
      Alert.alert(
        '미응답 문항 있음',
        `${progressCount}/${TOTAL_QUESTIONS}문항 응답. 모든 문항에 답해야 정확한 등급이 나옵니다. 그래도 결과를 볼까요?`,
        [
          { text: '계속 응답', style: 'cancel' },
          { text: '결과 보기', onPress: () => navigateToResult() },
        ],
      );
      return;
    }
    navigateToResult();
  };

  const navigateToResult = () => {
    const result = calculateGrade(answers, { experience, license });
    // replace가 있으면 replace, 없으면 navigate
    const nav = navigation;
    if (nav.replace) {
      nav.replace('JobAssessmentResult', {
        result, answers, experience, license,
      });
    } else {
      nav.navigate('JobAssessmentResult', {
        result, answers, experience, license,
      });
    }
  };

  // ── 인트로 ────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <View style={S.container}>
        <ScreenHeader
          title="자가역량평가"
          iconName="clipboard-outline"
          iconBg={'#6D28D9'}
          subtitle={progressCount > 0 ? `이어하기 · ${progressCount}/${TOTAL_QUESTIONS}문항 응답 중` : '51문항 · 약 10분'}
          onBackPressOverride={handleHeaderBack}
          rightAction={
            progressCount > 0 ? (
              <TouchableOpacity style={S.iconBtn} onPress={handleReset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="refresh-outline" size={20} color={C.t2} />
              </TouchableOpacity>
            ) : null
          }
        />

        <ScrollView contentContainerStyle={S.scroll}>

          {/* 안내 카드 */}
          <View style={S.heroCard}>
            <View style={[S.heroIc, { backgroundColor: '#6D28D9' }]}>
              <Ionicons name="clipboard-outline" size={26} color="#fff" />
            </View>
            <Text style={S.heroTtl}>정육기술자 자가역량평가</Text>
            <Text style={S.heroSub}>
              7개 영역 · 51문항을 통해 본인의 기술 수준을 D/C/B/A/S 5단계로 진단합니다.{'\n'}
              결과는 구직 프로필에 자동 반영됩니다.
            </Text>

            <View style={S.metaRow}>
              <View style={S.metaCell}>
                <Ionicons name="time-outline" size={16} color={C.t3} />
                <Text style={S.metaTxt}>약 10분</Text>
              </View>
              <View style={S.metaSep} />
              <View style={S.metaCell}>
                <Ionicons name="list-outline" size={16} color={C.t3} />
                <Text style={S.metaTxt}>{TOTAL_QUESTIONS}문항</Text>
              </View>
              <View style={S.metaSep} />
              <View style={S.metaCell}>
                <Ionicons name="trophy-outline" size={16} color={C.t3} />
                <Text style={S.metaTxt}>5단계 등급</Text>
              </View>
            </View>
          </View>

          {/* 경력 선택 */}
          <Text style={S.label}>
            <Ionicons name="briefcase-outline" size={14} color={C.t2} />  경력 (필수)
          </Text>
          <View style={S.chipWrap}>
            {EXPERIENCE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.8}
                style={[S.chip, experience === opt && S.chipActive]}
                onPress={() => setExperience(opt)}
              >
                <Text style={[S.chipTxt, experience === opt && S.chipTxtActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={S.hint}>5~10년 +1점, 10년 이상 +2점 보너스 적용</Text>

          {/* 자격증 선택 */}
          <Text style={[S.label, { marginTop: 18 }]}>
            <Ionicons name="ribbon-outline" size={14} color={C.t2} />  식육처리기능사 자격증 (필수)
          </Text>
          <View style={S.chipWrap}>
            {LICENSE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.8}
                style={[S.chip, license === opt && S.chipActive]}
                onPress={() => setLicense(opt)}
              >
                <Text style={[S.chipTxt, license === opt && S.chipTxtActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={S.hint}>자격증 "취득 완료" 시 +1점 보너스</Text>

          {/* 섹션 미리보기 */}
          <Text style={[S.label, { marginTop: 22 }]}>
            <Ionicons name="layers-outline" size={14} color={C.t2} />  평가 영역
          </Text>
          {SECTIONS.map((s, i) => (
            <View key={s.id} style={S.previewRow}>
              <View style={[S.previewIc, { backgroundColor: C.bg2 }]}>
                <Ionicons name={s.icon} size={16} color={C.t2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.previewTtl}>{s.title}</Text>
                <Text style={S.previewSb}>{s.qs.length}문항 · 가중치 {s.weight.toFixed(1)}</Text>
              </View>
              <Text style={S.previewIdx}>{String(i + 1).padStart(2, '0')}</Text>
            </View>
          ))}

          {/* 시작 버튼 */}
          <TouchableOpacity
            style={[
              S.primaryBtn,
              (!experience || !license) && S.primaryBtnDisabled,
            ]}
            onPress={() => setStep('section')}
            disabled={!experience || !license}
            activeOpacity={0.85}
          >
            <Ionicons name="play-outline" size={18} color="#fff" />
            <Text style={S.primaryBtnTxt}>
              {progressCount > 0 ? '이어서 진행' : '평가 시작'}
            </Text>
          </TouchableOpacity>
          {(!experience || !license) && (
            <Text style={[S.hint, { textAlign: 'center', marginTop: 6 }]}>
              경력과 자격증 선택이 필요합니다
            </Text>
          )}

        </ScrollView>
      </View>
    );
  }

  // ── 섹션 진행 ─────────────────────────────────────────
  const section = SECTIONS[sectionIdx];
  const secAnswers = answers[section.id] || {};
  const secFilled = Object.keys(secAnswers).length;
  const secDone = secFilled === section.qs.length;

  return (
    <View style={S.container}>
      <ScreenHeader
        title={`${section.short}`}
        iconName={section.icon}
        iconBg={'#6D28D9'}
        subtitle={`${sectionIdx + 1}/${SECTIONS.length} · ${progressCount}/${TOTAL_QUESTIONS}문항`}
        onBackPressOverride={goPrevSection}
      />

      {/* 진행률 바 */}
      <View style={S.progWrap}>
        <View style={S.progBar}>
          <View style={[S.progFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={S.progTxt}>{progressPct}%</Text>
      </View>

      {/* 섹션 도트 */}
      <View style={S.dotRow}>
        {SECTIONS.map((s, i) => {
          const done = isSectionDone(answers, s.id);
          const isCurrent = i === sectionIdx;
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                S.dot,
                done && S.dotDone,
                isCurrent && S.dotCurrent,
              ]}
              onPress={() => setSectionIdx(i)}
              activeOpacity={0.7}
            >
              <Text style={[
                S.dotTxt,
                (done || isCurrent) && { color: '#fff' },
              ]}>{i + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={S.scroll}>

        {/* 섹션 헤더 */}
        <View style={S.secHead}>
          <Text style={S.secTtl}>{section.title}</Text>
          <Text style={S.secSb}>
            총 {section.qs.length}문항 · 응답 {secFilled}/{section.qs.length}
            {section.weight !== 1.0 ? `  ·  가중치 ${section.weight.toFixed(1)}` : ''}
          </Text>
        </View>

        {/* 척도 안내 */}
        <View style={S.scaleBox}>
          <Text style={S.scaleLbl}>응답 척도</Text>
          <View style={S.scaleRow}>
            {RATING_LABELS.map(r => (
              <View key={r.v} style={S.scaleCell}>
                <Text style={S.scaleNum}>{r.v}</Text>
                <Text style={S.scaleTxt}>{r.label.replace('\n', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 문항 목록 */}
        {section.qs.map((q, qIdx) => {
          const picked = secAnswers[qIdx];
          return (
            <View key={qIdx} style={S.qCard}>
              <View style={S.qHead}>
                <View style={[S.qNum, picked != null && S.qNumDone]}>
                  <Text style={[S.qNumTxt, picked != null && { color: '#fff' }]}>
                    {String(qIdx + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text style={S.qText}>{q}</Text>
              </View>

              <View style={S.rateRow}>
                {RATING_LABELS.map(r => {
                  const active = picked === r.v;
                  return (
                    <TouchableOpacity
                      key={r.v}
                      style={[S.rateBtn, active && S.rateBtnActive]}
                      onPress={() => setAnswer(section.id, qIdx, r.v)}
                      activeOpacity={0.75}
                    >
                      <Text style={[S.rateNum, active && { color: '#fff' }]}>{r.v}</Text>
                      <Text style={[S.rateLbl, active && { color: '#fff' }]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* 네비 버튼 */}
        <View style={S.navRow}>
          <TouchableOpacity
            style={[S.navBtn, S.navBtnGhost]}
            onPress={goPrevSection}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back-outline" size={16} color={C.t2} />
            <Text style={S.navBtnGhostTxt}>
              {sectionIdx === 0 ? '인트로' : '이전'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              S.navBtn, S.navBtnPrimary,
              !secDone && S.navBtnDim,
            ]}
            onPress={goNextSection}
            activeOpacity={0.85}
          >
            <Text style={S.navBtnPrimaryTxt}>
              {sectionIdx === SECTIONS.length - 1 ? '결과 보기' : '다음'}
            </Text>
            <Ionicons
              name={sectionIdx === SECTIONS.length - 1 ? 'checkmark-outline' : 'chevron-forward-outline'}
              size={16} color="#fff"
            />
          </TouchableOpacity>
        </View>

        {!secDone && (
          <Text style={[S.hint, { textAlign: 'center', marginTop: 6 }]}>
            이 섹션의 나머지 {section.qs.length - secFilled}문항에 답하면 진행이 편리합니다
          </Text>
        )}

        {sectionIdx === SECTIONS.length - 1 && (
          <TouchableOpacity
            style={[S.submitBtn, !isAllDone(answers) && S.submitBtnDim]}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy-outline" size={18} color="#fff" />
            <Text style={S.submitBtnTxt}>
              전체 제출 · 등급 산출 ({progressCount}/{TOTAL_QUESTIONS})
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 120 },
  iconBtn:   {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // 진행률 바
  progWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
    backgroundColor: C.white,
  },
  progBar: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: C.bg2, overflow: 'hidden',
  },
  progFill: {
    height: '100%',
    backgroundColor: '#6D28D9',
    borderRadius: 4,
  },
  progTxt: {
    fontSize: 11, fontWeight: '800', color: C.t2,
    minWidth: 32, textAlign: 'right',
  },

  // 섹션 도트
  dotRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: C.ok2 },
  dotCurrent: { backgroundColor: '#6D28D9' },
  dotTxt: { fontSize: 11, fontWeight: '800', color: C.t3 },

  // 인트로 히어로
  heroCard: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 18, marginBottom: 14,
    alignItems: 'center',
  },
  heroIc: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  heroTtl: {
    fontSize: 18, fontWeight: '900', color: C.t1,
    marginBottom: 6, letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13, color: C.t3, lineHeight: 19,
    textAlign: 'center', marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: C.bg2, borderRadius: 10,
    paddingVertical: 10,
  },
  metaCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 4,
  },
  metaTxt: { fontSize: 12, fontWeight: '700', color: C.t2 },
  metaSep: { width: 1, height: 14, backgroundColor: C.border },

  // 라벨/칩
  label: {
    fontSize: 13, fontWeight: '800', color: C.t2,
    marginBottom: 8, letterSpacing: 0.2,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#6D28D9', borderColor: '#6D28D9',
  },
  chipTxt: { fontSize: 13, fontWeight: '700', color: C.t2 },
  chipTxtActive: { color: '#fff' },
  hint: { fontSize: 11, color: C.t4, marginTop: 6 },

  // 섹션 미리보기
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 6,
  },
  previewIc: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  previewTtl: { fontSize: 14, fontWeight: '800', color: C.t1 },
  previewSb:  { fontSize: 11, color: C.t3, marginTop: 2 },
  previewIdx: { fontSize: 12, fontWeight: '800', color: C.t4 },

  // 시작 버튼
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#6D28D9',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  primaryBtnDisabled: { backgroundColor: '#C4B5FD' },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },

  // 섹션 진행
  secHead: { marginBottom: 12 },
  secTtl:  { fontSize: 17, fontWeight: '900', color: C.t1, letterSpacing: -0.3 },
  secSb:   { fontSize: 12, color: C.t3, marginTop: 3 },

  scaleBox: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 10, marginBottom: 14,
  },
  scaleLbl: {
    fontSize: 10, fontWeight: '800', color: C.t3,
    letterSpacing: 0.5, marginBottom: 6,
  },
  scaleRow: { flexDirection: 'row', gap: 4 },
  scaleCell: {
    flex: 1, alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 2,
  },
  scaleNum: { fontSize: 13, fontWeight: '900', color: '#6D28D9' },
  scaleTxt: { fontSize: 10, color: C.t3, textAlign: 'center', marginTop: 2 },

  // 문항 카드
  qCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  qHead: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  qNum: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg2,
  },
  qNumDone: { backgroundColor: C.ok2 },
  qNumTxt: { fontSize: 11, fontWeight: '900', color: C.t3 },
  qText: {
    flex: 1, fontSize: 14, fontWeight: '700', color: C.t1,
    lineHeight: 20,
  },

  rateRow: {
    flexDirection: 'row', gap: 6,
  },
  rateBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.white,
    alignItems: 'center', minHeight: 54,
  },
  rateBtnActive: {
    backgroundColor: '#6D28D9', borderColor: '#6D28D9',
  },
  rateNum: { fontSize: 14, fontWeight: '900', color: '#6D28D9', marginBottom: 2 },
  rateLbl: { fontSize: 10, color: C.t3, textAlign: 'center', lineHeight: 12 },

  // 네비
  navRow: {
    flexDirection: 'row', gap: 10, marginTop: 8,
  },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  navBtnGhost: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
  },
  navBtnGhostTxt: { fontSize: 14, fontWeight: '800', color: C.t2 },
  navBtnPrimary: { backgroundColor: '#6D28D9' },
  navBtnDim: { opacity: 0.6 },
  navBtnPrimaryTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },

  submitBtn: {
    marginTop: 14,
    backgroundColor: C.red,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  submitBtnDim: { backgroundColor: '#FCA5A5' },
  submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
