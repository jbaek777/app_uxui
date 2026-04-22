/**
 * JobStaffHubScreen — 직원용 내 구직 허브
 *
 * Option D 직원 하단 탭 "📤내구직" → 이 화면
 *
 * 실시간 상태 표시:
 *  - jobStore에서 프로필 + 등급 로드
 *  - useFocusEffect로 포커스마다 갱신 (다른 화면에서 편집 후 돌아올 때)
 *
 * 주요 액션:
 *  - 자가역량평가 → JobAssessment
 *  - 프로필 편집   → JobProfileEditor
 *  - 공개 토글     → 즉시 저장
 *  - 헤드헌팅 인박스 (Phase 2 스텁)
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import ScreenHeader from '../components/ScreenHeader';
import { profileStore, headhuntStore, EMPTY_PROFILE } from '../lib/jobStore';
import { GRADES } from '../data/jobAssessment';

const C = {
  bg:     '#F2F4F8',
  white:  '#FFFFFF',
  red:    '#B91C1C',
  ok:     '#15803D',
  ok2:    '#16A34A',
  okS:    'rgba(21,128,61,0.09)',
  warn:   '#B45309',
  warn2:  '#D97706',
  warnS:  'rgba(180,83,9,0.09)',
  blue:   '#1D4ED8',
  blue2:  '#2563EB',
  blueS:  'rgba(29,78,216,0.09)',
  pur:    '#6D28D9',
  purS:   'rgba(109,40,217,0.09)',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
};

export default function JobStaffHubScreen({ navigation }) {
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [pendingInbox, setPendingInbox] = useState(0);

  // ── 포커스마다 새로고침 ─────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const [remote, inbox] = await Promise.all([
          profileStore.fetchRemote(),
          headhuntStore.fetchInbox(),
        ]);
        let base;
        if (remote.data) base = { ...EMPTY_PROFILE, ...remote.data };
        else             base = await profileStore.getLocal();
        if (!cancelled) {
          setProfile(base || { ...EMPTY_PROFILE });
          const list = inbox?.data || [];
          setInboxCount(list.length);
          setPendingInbox(list.filter(x => x.status === 'pending').length);
          setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  // ── 상태 라벨 계산 ──────────────────────────────────────
  const hasGrade = !!profile.grade;
  const isPublic = !!profile.is_public;

  const statusLabel = !hasGrade
    ? '프로필 미등록 — 자가역량평가부터 시작'
    : isPublic
      ? '공개 중 — 사장들이 검색 가능'
      : '비공개 — 프로필 저장만 됨';

  const statusColor = !hasGrade ? C.t3 : isPublic ? C.ok2 : C.warn2;
  const gradeInfo = hasGrade ? GRADES.find(g => g.letter === profile.grade) : null;

  // ── 공개 토글 ───────────────────────────────────────────
  const handleTogglePublic = async () => {
    if (!hasGrade) {
      Alert.alert(
        '평가 먼저',
        '공개하려면 자가역량평가를 먼저 완료해 등급이 있어야 합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '평가 시작', onPress: () => navigation.navigate('JobAssessment') },
        ],
      );
      return;
    }
    if (!profile.region || !profile.preferred_work) {
      Alert.alert(
        '프로필 미완성',
        '공개하려면 지역과 근무 형태를 먼저 입력해야 합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '프로필 편집', onPress: () => navigation.navigate('JobProfileEditor') },
        ],
      );
      return;
    }

    setToggling(true);
    const { data, error } = await profileStore.setPublic(!isPublic);
    setToggling(false);
    if (error && error !== 'no-session') {
      Alert.alert('변경 실패', error);
      return;
    }
    if (data) setProfile(data);
  };

  return (
    <View style={S.container}>
      <ScreenHeader
        title="내 구직"
        iconName="person-outline"
        iconBg={C.blue2}
        onBackPressOverride={() => {
          try { navigation.getParent?.()?.navigate?.('HomeTab'); } catch (_) {}
        }}
      />

      <ScrollView contentContainerStyle={S.scroll}>

        {/* 프로필 상태 카드 */}
        <View style={S.statusCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View style={[S.statusDot, { backgroundColor: statusColor }]} />
            <Text style={S.statusLbl}>구직 프로필 상태</Text>
            {loading && <ActivityIndicator size="small" color={C.t4} style={{ marginLeft: 6 }} />}
          </View>
          <Text style={S.statusTtl}>{statusLabel}</Text>

          {gradeInfo ? (
            <View style={[S.gradeBadge, { backgroundColor: gradeInfo.color }]}>
              <Ionicons name="trophy-outline" size={12} color="#fff" />
              <Text style={S.gradeTxt}>
                {gradeInfo.letter}급 · {profile.percent}점
              </Text>
            </View>
          ) : (
            <Text style={S.statusHint}>
              자가역량평가를 완료하면 D/C/B/A/S 등급이 부여됩니다.
            </Text>
          )}
        </View>

        {/* 주요 액션 */}
        <Text style={S.sectionLabel}>프로필 관리</Text>

        <TouchableOpacity
          style={S.bigCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('JobAssessment')}
        >
          <View style={[S.bigIc, { backgroundColor: C.pur }]}>
            <Ionicons name="clipboard-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>
              자가역량평가 {hasGrade ? '· 재평가' : ''}
            </Text>
            <Text style={S.bigSb}>
              51문항 · 7개 영역 · 예상 소요 10분 — 내 등급 산출
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <TouchableOpacity
          style={S.bigCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('JobProfileEditor')}
        >
          <View style={[S.bigIc, { backgroundColor: C.blue2 }]}>
            <Ionicons name="create-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>프로필 편집</Text>
            <Text style={S.bigSb}>
              {profile.region
                ? `지역: ${profile.region}${profile.preferred_work ? ' · ' + profile.preferred_work : ''}`
                : '경력·자격증·희망 근무조건 입력 (실명은 수락 시에만 공개)'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <TouchableOpacity
          style={S.bigCard}
          activeOpacity={0.85}
          onPress={handleTogglePublic}
          disabled={toggling}
        >
          <View style={[S.bigIc, { backgroundColor: isPublic ? C.ok2 : C.t3 }]}>
            <Ionicons
              name={isPublic ? 'eye-outline' : 'eye-off-outline'}
              size={22} color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>
              {isPublic ? '공개 → 비공개로 전환' : '비공개 → 공개로 전환'}
            </Text>
            <Text style={S.bigSb}>
              {isPublic
                ? '현재 공개 중 · 사장들이 익명으로 프로필 검색 가능'
                : '비공개 상태 · 공개하면 사장들이 검색할 수 있습니다'}
            </Text>
          </View>
          {toggling
            ? <ActivityIndicator size="small" color={C.t3} />
            : <Ionicons name="swap-horizontal-outline" size={18} color={C.t3} />}
        </TouchableOpacity>

        {/* 헤드헌팅 인박스 */}
        <Text style={[S.sectionLabel, { marginTop: 18 }]}>받은 요청</Text>

        <TouchableOpacity
          style={S.bigCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('JobHeadhuntInbox')}
        >
          <View style={[S.bigIc, { backgroundColor: C.red }]}>
            <Ionicons name="mail-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>헤드헌팅 요청함</Text>
            <Text style={S.bigSb}>
              {pendingInbox > 0
                ? `사장이 실명·연락처를 요청한 제안 ${pendingInbox}건 대기 중`
                : inboxCount > 0
                  ? `받은 제안 총 ${inboxCount}건 (대기 없음)`
                  : '아직 받은 제안이 없습니다. 프로필을 공개하면 제안이 옵니다.'}
            </Text>
          </View>
          {pendingInbox > 0 && (
            <View style={S.badge}>
              <Text style={S.badgeTxt}>{pendingInbox}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        {/* 안내 */}
        <View style={S.notice}>
          <Ionicons name="shield-checkmark-outline" size={18} color={C.ok} />
          <Text style={S.noticeTxt}>
            내 실명·연락처는 내가 "수락" 버튼을 누른 제안에 대해서만 사장에게 공개됩니다.
            수락 전까지는 사장이 나를 보지 못합니다.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 100 },

  statusCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 16,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLbl: { fontSize: 12, fontWeight: '700', color: C.t3, letterSpacing: 0.3 },
  statusTtl: { fontSize: 15, fontWeight: '800', color: C.t1, marginBottom: 6 },
  statusHint: { fontSize: 12, color: C.t3, marginTop: 2 },
  gradeBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  gradeTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },

  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: C.t2,
    letterSpacing: 0.3, marginBottom: 8,
  },

  bigCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  bigIc: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  bigTtl: { fontSize: 15, fontWeight: '800', color: C.t1, marginBottom: 2 },
  bigSb:  { fontSize: 12, color: C.t3, lineHeight: 17 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: C.red, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },

  notice: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    marginTop: 8, padding: 12,
    backgroundColor: C.okS, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(21,128,61,0.15)',
  },
  noticeTxt: { flex: 1, fontSize: 12, color: C.ok, lineHeight: 18 },
});
