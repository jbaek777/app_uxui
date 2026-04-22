/**
 * JobAssessmentResultScreen — 자가역량평가 결과
 *
 * 표시 항목:
 *  - 최종 등급 (D/C/B/A/S) + 예상 연봉/월급대 + 설명
 *  - 원 점수(%)와 보정 내역 (상한 / 경력·자격 보너스)
 *  - 영역별 평균 차트 (수평 바)
 *  - 다음 목표 (상위 등급으로 가기 위한 가이드)
 *  - [프로필에 반영] 버튼 → JobProfileEditor로 이동
 *
 * 입력: route.params.result (calculateGrade 반환값)
 *       route.params.answers, experience, license (편집 이동 시 유지)
 */
import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { SECTIONS, GRADES } from '../data/jobAssessment';

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

export default function JobAssessmentResultScreen({ navigation, route }) {
  const { result, answers, experience, license } = route?.params || {};

  // 방어적 처리 (핫리로드·잘못된 진입 대비)
  if (!result) {
    return (
      <View style={S.container}>
        <ScreenHeader
          title="평가 결과"
          iconName="trophy-outline"
          iconBg={'#6D28D9'}
        />
        <View style={S.emptyBox}>
          <Ionicons name="alert-circle-outline" size={40} color={C.t3} />
          <Text style={S.emptyTxt}>결과 데이터가 없습니다</Text>
          <TouchableOpacity
            style={S.primaryBtn}
            onPress={() => navigation.replace?.('JobAssessment') || navigation.navigate?.('JobAssessment')}
          >
            <Ionicons name="clipboard-outline" size={16} color="#fff" />
            <Text style={S.primaryBtnTxt}>평가 시작하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const {
    percent, sectionAvgs, porkPct, beefPct,
    finalGrade, baseGrade, isCapped, caps,
    bonusItems, bonusRaised, bonusScore,
  } = result;

  const nextGrade = useMemo(() => {
    const idx = GRADES.findIndex(g => g.letter === finalGrade.letter);
    return idx < GRADES.length - 1 ? GRADES[idx + 1] : null;
  }, [finalGrade]);

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `[MeatBig 자가역량평가]\n` +
          `등급: ${finalGrade.letter}급 (${finalGrade.sub})\n` +
          `원 점수: ${percent}점\n` +
          `예상 급여대: ${finalGrade.salary}\n` +
          `\n#정육기술자 #자가역량평가`,
      });
    } catch (_) {}
  };

  const handleApplyToProfile = () => {
    // 편집 화면으로 이동 (등급·응답 데이터 전달)
    const params = { assessmentResult: result, answers, experience, license };
    if (navigation.replace) {
      navigation.replace('JobProfileEditor', params);
    } else {
      navigation.navigate('JobProfileEditor', params);
    }
  };

  const handleRetake = () => {
    Alert.alert(
      '평가 다시 하기',
      '이전 응답을 유지한 채 편집만 할까요, 아니면 처음부터 다시 할까요?',
      [
        {
          text: '이전 응답 유지',
          onPress: () => {
            if (navigation.replace) navigation.replace('JobAssessment');
            else navigation.navigate('JobAssessment');
          },
        },
        {
          text: '처음부터',
          style: 'destructive',
          onPress: () => {
            // AsyncStorage 초기화는 JobAssessmentScreen에서 "초기화" 버튼으로
            if (navigation.replace) navigation.replace('JobAssessment', { reset: true });
            else navigation.navigate('JobAssessment', { reset: true });
          },
        },
        { text: '취소', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={S.container}>
      <ScreenHeader
        title="평가 결과"
        iconName="trophy-outline"
        iconBg={finalGrade.color}
        onBackPressOverride={() => {
          try { navigation.getParent?.()?.navigate?.('HomeTab'); } catch (_) {}
        }}
        rightAction={
          <TouchableOpacity
            style={S.iconBtn}
            onPress={handleShare}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="share-outline" size={20} color={C.t2} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={S.scroll}>

        {/* 최종 등급 카드 */}
        <View style={[S.gradeCard, { borderColor: finalGrade.color, backgroundColor: finalGrade.bg }]}>
          <View style={[S.gradeCircle, { backgroundColor: finalGrade.color }]}>
            <Text style={S.gradeLetter}>{finalGrade.letter}</Text>
          </View>
          <Text style={[S.gradeSub, { color: finalGrade.color }]}>
            {finalGrade.sub} · {finalGrade.label}
          </Text>
          <Text style={S.gradeDesc}>{finalGrade.desc}</Text>

          <View style={S.salaryRow}>
            <Ionicons name="cash-outline" size={16} color={finalGrade.color} />
            <Text style={[S.salaryTxt, { color: finalGrade.color }]}>
              예상 급여대 · {finalGrade.salary}
            </Text>
          </View>

          <View style={S.scoreRow}>
            <View style={S.scoreCell}>
              <Text style={S.scoreLbl}>원 점수</Text>
              <Text style={S.scoreVal}>{percent}점</Text>
            </View>
            <View style={S.scoreSep} />
            <View style={S.scoreCell}>
              <Text style={S.scoreLbl}>돼지 정형·발골</Text>
              <Text style={S.scoreVal}>{porkPct}%</Text>
            </View>
            <View style={S.scoreSep} />
            <View style={S.scoreCell}>
              <Text style={S.scoreLbl}>소 정형·발골</Text>
              <Text style={S.scoreVal}>{beefPct}%</Text>
            </View>
          </View>
        </View>

        {/* 보정 내역 */}
        {(isCapped || bonusRaised || bonusScore > 0 || caps.length > 0) && (
          <View style={S.adjCard}>
            <View style={S.adjHead}>
              <Ionicons name="information-circle-outline" size={18} color={C.t2} />
              <Text style={S.adjTtl}>점수 보정 내역</Text>
            </View>

            {isCapped && baseGrade && (
              <View style={[S.adjRow, { backgroundColor: C.warnS, borderColor: 'rgba(180,83,9,0.2)' }]}>
                <Ionicons name="trending-down-outline" size={16} color={C.warn2} />
                <View style={{ flex: 1 }}>
                  <Text style={[S.adjRowTtl, { color: C.warn }]}>
                    {baseGrade.letter}급 → {finalGrade.letter}급 (상한 적용)
                  </Text>
                  {caps.map((cap, i) => (
                    <Text key={i} style={[S.adjRowSb, { color: C.warn }]}>• {cap}</Text>
                  ))}
                </View>
              </View>
            )}

            {bonusItems.length > 0 && (
              <View style={[S.adjRow, { backgroundColor: C.okS, borderColor: 'rgba(21,128,61,0.2)' }]}>
                <Ionicons name="trending-up-outline" size={16} color={C.ok2} />
                <View style={{ flex: 1 }}>
                  <Text style={[S.adjRowTtl, { color: C.ok }]}>
                    보너스 점수 +{bonusScore}점
                    {bonusRaised ? ' → 1등급 상승' : ' (누적 2점 미달로 등급 상승 없음)'}
                  </Text>
                  {bonusItems.map((b, i) => (
                    <Text key={i} style={[S.adjRowSb, { color: C.ok }]}>• {b}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 영역별 평균 차트 */}
        <Text style={S.sectionLabel}>영역별 평균</Text>
        <View style={S.chartCard}>
          {SECTIONS.map(sec => {
            const avg = sectionAvgs[sec.id] || 0;
            const pctOf5 = Math.round((avg / 5) * 100);
            const color = pctOf5 >= 80 ? C.ok2
                         : pctOf5 >= 60 ? C.blue2
                         : pctOf5 >= 40 ? C.warn2
                         : C.red2;
            return (
              <View key={sec.id} style={S.chartRow}>
                <View style={S.chartLabelBox}>
                  <Ionicons name={sec.icon} size={13} color={C.t3} />
                  <Text style={S.chartLabel}>{sec.short}</Text>
                  {sec.weight !== 1.0 && (
                    <View style={S.wBadge}>
                      <Text style={S.wBadgeTxt}>×{sec.weight.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <View style={S.chartBarBg}>
                  <View style={[S.chartBarFill, { width: `${pctOf5}%`, backgroundColor: color }]} />
                </View>
                <Text style={[S.chartPct, { color }]}>{pctOf5}%</Text>
              </View>
            );
          })}
        </View>

        {/* 다음 목표 */}
        {nextGrade && (
          <>
            <Text style={S.sectionLabel}>다음 목표</Text>
            <View style={S.nextCard}>
              <View style={[S.nextBadge, { backgroundColor: nextGrade.color }]}>
                <Text style={S.nextLetter}>{nextGrade.letter}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.nextTtl}>
                  {nextGrade.letter}급 도전 · {nextGrade.salary}
                </Text>
                <Text style={S.nextSb}>
                  {finalGrade.next}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* 액션 버튼 */}
        <TouchableOpacity style={S.primaryBtn} onPress={handleApplyToProfile} activeOpacity={0.85}>
          <Ionicons name="person-outline" size={16} color="#fff" />
          <Text style={S.primaryBtnTxt}>구직 프로필에 반영</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.secondaryBtn} onPress={handleRetake} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={16} color={C.t2} />
          <Text style={S.secondaryBtnTxt}>평가 다시 하기</Text>
        </TouchableOpacity>

        {/* 안내 */}
        <View style={S.notice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.t3} />
          <Text style={S.noticeTxt}>
            본 평가는 자가 진단용입니다. 실제 채용·급여 산정 시 사업장 내규와 업무 협의에 따라 조정될 수 있습니다.
          </Text>
        </View>

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

  emptyBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32,
  },
  emptyTxt: { fontSize: 14, color: C.t3 },

  // 최종 등급 카드
  gradeCard: {
    borderRadius: 18, borderWidth: 2,
    padding: 20, marginBottom: 14,
    alignItems: 'center',
  },
  gradeCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  gradeLetter: { color: '#fff', fontSize: 36, fontWeight: '900' },
  gradeSub: {
    fontSize: 14, fontWeight: '900',
    letterSpacing: 0.3, marginBottom: 6,
  },
  gradeDesc: {
    fontSize: 13, color: C.t2, textAlign: 'center',
    lineHeight: 19, marginBottom: 10,
  },
  salaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14,
  },
  salaryTxt: { fontSize: 13, fontWeight: '800' },

  scoreRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10, paddingVertical: 10,
  },
  scoreCell: { flex: 1, alignItems: 'center' },
  scoreLbl: { fontSize: 10, color: C.t3, fontWeight: '700', letterSpacing: 0.2 },
  scoreVal: { fontSize: 15, fontWeight: '900', color: C.t1, marginTop: 2 },
  scoreSep: { width: 1, height: 24, backgroundColor: C.border },

  // 보정 카드
  adjCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 14,
  },
  adjHead: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  adjTtl: { fontSize: 13, fontWeight: '800', color: C.t2 },
  adjRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    padding: 10, borderRadius: 8, borderWidth: 1,
    marginBottom: 6,
  },
  adjRowTtl: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  adjRowSb:  { fontSize: 11, lineHeight: 16 },

  // 차트
  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: C.t2,
    letterSpacing: 0.3, marginBottom: 8, marginTop: 4,
  },
  chartCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 14,
  },
  chartRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8,
  },
  chartLabelBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    width: 78,
  },
  chartLabel: { fontSize: 12, fontWeight: '700', color: C.t2 },
  wBadge: {
    backgroundColor: C.bg2, borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  wBadgeTxt: { fontSize: 9, color: C.t3, fontWeight: '800' },
  chartBarBg: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: C.bg2, overflow: 'hidden',
  },
  chartBarFill: { height: '100%', borderRadius: 5 },
  chartPct: {
    fontSize: 12, fontWeight: '900',
    minWidth: 36, textAlign: 'right',
  },

  // 다음 목표
  nextCard: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 16,
  },
  nextBadge: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  nextLetter: { color: '#fff', fontSize: 20, fontWeight: '900' },
  nextTtl: { fontSize: 14, fontWeight: '900', color: C.t1, marginBottom: 3 },
  nextSb:  { fontSize: 12, color: C.t3, lineHeight: 17 },

  // 버튼
  primaryBtn: {
    backgroundColor: C.red,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    marginBottom: 8,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  secondaryBtnTxt: { color: C.t2, fontSize: 14, fontWeight: '800' },

  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 16, padding: 12,
    backgroundColor: C.bg2, borderRadius: 10,
  },
  noticeTxt: { flex: 1, fontSize: 11, color: C.t3, lineHeight: 16 },
});
