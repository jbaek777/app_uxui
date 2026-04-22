/**
 * JobStaffHubScreen — 직원용 내 구직 허브
 *
 * Option D 직원 하단 탭 "📤내구직" → 이 화면
 *
 * MVP 범위(스텁):
 *  - 내 구직 프로필 상태 카드 (공개/비공개)
 *  - 자가역량평가 진입 카드
 *  - 받은 헤드헌팅 요청함 카드
 *  - 실제 기능은 Phase 2~4에서 구현
 *
 * 직원 전용 — 유료화 없음
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';

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

// 임시 상태 (실제는 Supabase job_profiles에서 가져옴)
const PROFILE_STATE = 'none'; // 'none' | 'private' | 'public'
const ASSESSMENT_GRADE = null; // 'D'|'C'|'B'|'A'|'S'
const INBOX_COUNT = 0;

function NotifyStub(feature) {
  Alert.alert(
    '준비 중',
    `${feature} 기능은 다음 업데이트(Phase 2)에서 제공됩니다.\n\n현재는 허브 화면만 배포된 상태입니다.`,
  );
}

export default function JobStaffHubScreen({ navigation }) {
  const statusLabel =
    PROFILE_STATE === 'public' ? '공개 중 — 사장들이 검색 가능'
    : PROFILE_STATE === 'private' ? '비공개 — 프로필 저장만 됨'
    : '프로필 미등록 — 자가역량평가부터 시작';

  const statusColor =
    PROFILE_STATE === 'public' ? C.ok2
    : PROFILE_STATE === 'private' ? C.warn2
    : C.t3;

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
          </View>
          <Text style={S.statusTtl}>{statusLabel}</Text>
          {ASSESSMENT_GRADE ? (
            <View style={S.gradeBadge}>
              <Ionicons name="trophy-outline" size={12} color="#fff" />
              <Text style={S.gradeTxt}>{ASSESSMENT_GRADE} 등급</Text>
            </View>
          ) : (
            <Text style={S.statusHint}>자가역량평가를 완료하면 D/C/B/A/S 등급이 부여됩니다.</Text>
          )}
        </View>

        {/* 주요 액션 */}
        <Text style={S.sectionLabel}>프로필 관리</Text>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('자가역량평가')}>
          <View style={[S.bigIc, { backgroundColor: C.pur }]}>
            <Ionicons name="clipboard-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>자가역량평가</Text>
            <Text style={S.bigSb}>51문항 · 7개 영역 · 예상 소요 10분 — 내 등급 산출</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('프로필 편집')}>
          <View style={[S.bigIc, { backgroundColor: C.blue2 }]}>
            <Ionicons name="create-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>프로필 편집</Text>
            <Text style={S.bigSb}>경력·자격증·희망 근무조건 입력 (실명은 수락 시에만 공개)</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('공개 설정')}>
          <View style={[S.bigIc, { backgroundColor: PROFILE_STATE === 'public' ? C.ok2 : C.t3 }]}>
            <Ionicons
              name={PROFILE_STATE === 'public' ? 'eye-outline' : 'eye-off-outline'}
              size={22} color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>공개 여부 설정</Text>
            <Text style={S.bigSb}>
              {PROFILE_STATE === 'public'
                ? '현재 공개 중 · 사장들이 익명으로 프로필 검색 가능'
                : '비공개 상태 · 공개하면 사장들이 검색할 수 있습니다'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        {/* 헤드헌팅 인박스 */}
        <Text style={[S.sectionLabel, { marginTop: 18 }]}>받은 요청</Text>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('받은 헤드헌팅 요청함')}>
          <View style={[S.bigIc, { backgroundColor: C.red }]}>
            <Ionicons name="mail-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>헤드헌팅 요청함</Text>
            <Text style={S.bigSb}>
              {INBOX_COUNT > 0
                ? `사장이 실명·연락처를 요청한 제안 ${INBOX_COUNT}건 대기 중`
                : '아직 받은 제안이 없습니다. 프로필을 공개하면 제안이 옵니다.'}
            </Text>
          </View>
          {INBOX_COUNT > 0 && (
            <View style={S.badge}>
              <Text style={S.badgeTxt}>{INBOX_COUNT}</Text>
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
    backgroundColor: C.warn2, paddingHorizontal: 10, paddingVertical: 5,
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
