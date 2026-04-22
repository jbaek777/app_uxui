/**
 * JobOwnerHubScreen — 사장용 채용 허브
 *
 * Option D 하단 탭 "💼채용" → 이 화면
 *
 * MVP 범위(스텁):
 *  - 인재 풀 탐색 진입 카드
 *  - 헤드헌팅 요청함 진입 카드
 *  - 쿼터 사용 현황 배지 (프로모 기간 20건/월)
 *  - 사업장 코드 + 본인인증 배지
 *  - 실제 기능은 Phase 2~4에서 구현
 *
 * 디자인: ScreenHeader + 공통 팔레트 → 다른 랜딩 화면과 일체감
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';

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
  pur:    '#6D28D9',
  purS:   'rgba(109,40,217,0.09)',
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
};

// 임시 데이터 (실제는 Supabase job_profiles 테이블에서 가져옴)
const PROMO_QUOTA_TOTAL = 20;
const PROMO_QUOTA_USED  = 0;

function NotifyStub(feature) {
  Alert.alert(
    '준비 중',
    `${feature} 기능은 다음 업데이트(Phase 2)에서 제공됩니다.\n\n현재는 허브 화면만 배포된 상태입니다.`,
  );
}

export default function JobOwnerHubScreen({ navigation }) {
  const quotaLeft = Math.max(0, PROMO_QUOTA_TOTAL - PROMO_QUOTA_USED);

  return (
    <View style={S.container}>
      <ScreenHeader
        title="채용·인재"
        iconName="briefcase-outline"
        iconBg={C.red}
        onBackPressOverride={() => {
          try { navigation.getParent?.()?.navigate?.('HomeTab'); } catch (_) {}
        }}
      />

      <ScrollView contentContainerStyle={S.scroll}>

        {/* 프로모 배너 */}
        <View style={S.promoBanner}>
          <View style={S.promoIc}>
            <Ionicons name="gift-outline" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.promoTtl}>프로모 기간 — 전 유저 무료</Text>
            <Text style={S.promoSb}>이번 달 헤드헌팅 쿼터 {quotaLeft}/{PROMO_QUOTA_TOTAL}건 남음</Text>
          </View>
        </View>

        {/* 쿼터 사용 카드 */}
        <View style={S.quotaCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[S.quotaIc, { backgroundColor: C.okS }]}>
              <Ionicons name="flash-outline" size={18} color={C.ok2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.quotaTtl}>이번 달 헤드헌팅</Text>
              <Text style={S.quotaSb}>실명 공개 요청 {PROMO_QUOTA_USED}건 / {PROMO_QUOTA_TOTAL}건</Text>
            </View>
          </View>
          <View style={S.quotaBar}>
            <View style={[S.quotaBarFill, { width: `${(PROMO_QUOTA_USED / PROMO_QUOTA_TOTAL) * 100}%` }]} />
          </View>
        </View>

        {/* 메인 액션 카드 */}
        <Text style={S.sectionLabel}>인재 찾기</Text>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('인재 풀 탐색')}>
          <View style={[S.bigIc, { backgroundColor: C.blue2 }]}>
            <Ionicons name="search-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>인재 풀 탐색</Text>
            <Text style={S.bigSb}>자가역량평가 기반 D/C/B/A/S 등급 필터 · 익명 프로필 미리보기</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('헤드헌팅 요청함')}>
          <View style={[S.bigIc, { backgroundColor: C.red }]}>
            <Ionicons name="paper-plane-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>내가 보낸 헤드헌팅 요청</Text>
            <Text style={S.bigSb}>실명·연락처 공개 요청 상태 확인 (수락·거절·대기)</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <TouchableOpacity style={S.bigCard} activeOpacity={0.85} onPress={() => NotifyStub('채용 공고 작성')}>
          <View style={[S.bigIc, { backgroundColor: C.warn2 }]}>
            <Ionicons name="megaphone-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.bigTtl}>채용 공고 작성</Text>
            <Text style={S.bigSb}>직무·근무시간·시급 등록 (구직자에게 노출)</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        {/* 사업장 정보 섹션 */}
        <Text style={[S.sectionLabel, { marginTop: 18 }]}>사업장 정보</Text>

        <View style={S.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Ionicons name="key-outline" size={16} color={C.t2} />
            <Text style={S.infoLbl}>사업장 코드</Text>
          </View>
          <Text style={S.infoVal}>XXXXXXXX <Text style={S.infoHint}>(8자리)</Text></Text>
          <Text style={S.infoHint2}>직원이 이 코드로 앱에 참여합니다. 설정 → 사업장 관리에서 조회</Text>
        </View>

        <View style={S.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.t2} />
            <Text style={S.infoLbl}>본인인증</Text>
          </View>
          <Text style={S.infoVal}>미인증 <Text style={S.infoHint}>(헤드헌팅 전 필요)</Text></Text>
          <TouchableOpacity style={S.inlineBtn} onPress={() => NotifyStub('본인인증')}>
            <Ionicons name="call-outline" size={14} color={C.red} />
            <Text style={S.inlineBtnTxt}>휴대폰 본인인증 진행</Text>
          </TouchableOpacity>
        </View>

        {/* 안내 */}
        <View style={S.notice}>
          <Ionicons name="information-circle-outline" size={18} color={C.blue2} />
          <Text style={S.noticeTxt}>
            이 앱은 직업정보제공사업(신고)으로 운영됩니다. 구직자 알선·중개는 하지 않으며,
            실명·연락처는 구직자가 수락한 경우에만 공개됩니다.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 100 },

  promoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.red, borderRadius: 14,
    padding: 14, marginBottom: 14,
  },
  promoIc: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  promoTtl: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 2 },
  promoSb:  { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },

  quotaCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 20, gap: 10,
  },
  quotaIc: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  quotaTtl: { fontSize: 14, fontWeight: '800', color: C.t1 },
  quotaSb:  { fontSize: 12, color: C.t3, marginTop: 2 },
  quotaBar: {
    height: 6, borderRadius: 3, backgroundColor: '#E8ECF2',
    overflow: 'hidden',
  },
  quotaBarFill: { height: '100%', backgroundColor: C.ok2 },

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

  infoCard: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  infoLbl: { fontSize: 12, fontWeight: '700', color: C.t2 },
  infoVal: { fontSize: 16, fontWeight: '900', color: C.t1, marginTop: 2, letterSpacing: 0.5 },
  infoHint:  { fontSize: 12, fontWeight: '600', color: C.t4 },
  infoHint2: { fontSize: 11, color: C.t3, marginTop: 4 },
  inlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.redS, borderRadius: 8, alignSelf: 'flex-start',
  },
  inlineBtnTxt: { fontSize: 12, fontWeight: '800', color: C.red },

  notice: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    marginTop: 8, padding: 12,
    backgroundColor: C.blueS, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(29,78,216,0.15)',
  },
  noticeTxt: { flex: 1, fontSize: 12, color: C.blue, lineHeight: 18 },
});
