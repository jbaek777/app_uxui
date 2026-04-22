/**
 * JobProfileDetailScreen — 익명 프로필 상세 (사장 뷰)
 *
 * 경로: JobOwnerBrowseScreen → 카드 탭 → 이 화면 (profileId 전달)
 *
 * 동작:
 *  - profile_id로 job_profiles_public에서 상세 조회 (RLS로 필터링됨)
 *  - 상단: 등급·닉네임·지역·경력
 *  - 중단: 자기소개 전문, 자격증 뱃지, 희망 페이·근무형태
 *  - 하단: [헤드헌팅 요청 보내기] CTA — 바텀시트로 메시지·제안 페이 입력
 *  - 쿼터 소진 시 Paywall 안내
 *
 * 주의: 실명·연락처·사진 원본은 이 화면에서 노출 금지 (public view에서 제외됨)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { headhuntStore, quotaStore } from '../lib/jobStore';
import { GRADES } from '../data/jobAssessment';

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
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
};

const MESSAGE_MAX = 500;

export default function JobProfileDetailScreen({ navigation, route }) {
  const profileId = route?.params?.profileId;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);

  const [quota, setQuota] = useState({ used: 0, limit: 20 });

  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg]         = useState('');
  const [offerPay, setOfferPay]   = useState('');
  const [offerRole, setOfferRole] = useState('');
  const [sending, setSending] = useState(false);

  // ── 프로필 로드 ────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profileId) { setErrMsg('잘못된 접근입니다.'); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_profiles_public')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      if (error) setErrMsg(error.message);
      else if (!data) setErrMsg('프로필이 더 이상 공개되지 않았습니다.');
      else setProfile(data);
    } catch (e) { setErrMsg(e.message); }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    load();
    quotaStore.getCurrentMonth().then(setQuota);
  }, [load]);

  // ── 헤드헌팅 요청 보내기 ──────────────────────────────────
  const openModal = () => {
    if (quota.used >= quota.limit) {
      Alert.alert(
        '이번 달 쿼터 소진',
        `이번 달 헤드헌팅 요청 ${quota.limit}건을 모두 사용했습니다.\n다음 달에 다시 시도하거나 쿼터를 추가 구매해 주세요.`,
        [
          { text: '확인', style: 'cancel' },
          { text: '구독 관리', onPress: () => {
            try { navigation.getParent?.()?.navigate?.('SettingsTab', { screen: 'Paywall' }); } catch (_) {}
          }},
        ],
      );
      return;
    }
    setModalOpen(true);
  };

  const sendRequest = async () => {
    if (!msg.trim()) {
      Alert.alert('메시지 필요', '구직자에게 보낼 제안 메시지를 작성해 주세요.');
      return;
    }
    setSending(true);
    const { data, error } = await headhuntStore.create({
      to_profile_id: profileId,
      message: msg.trim(),
      offered_pay: offerPay.trim() || null,
      offered_role: offerRole.trim() || null,
    });
    setSending(false);

    if (error) {
      Alert.alert('요청 실패', error);
      return;
    }
    setModalOpen(false);
    setMsg(''); setOfferPay(''); setOfferRole('');
    Alert.alert(
      '요청 전송 완료',
      '구직자에게 제안이 전달되었습니다.\n수락 시 실명과 연락처가 공개됩니다.',
      [
        { text: '계속 탐색', onPress: () => navigation.goBack?.() },
        { text: '보낸 요청함', onPress: () => navigation.navigate('JobHeadhuntSent') },
      ],
    );
    // 쿼터 재조회
    quotaStore.getCurrentMonth().then(setQuota);
  };

  // ── 로딩 ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.container}>
        <ScreenHeader title="구직자 상세" iconName="person-outline" iconBg={C.blue2} />
        <View style={S.center}>
          <ActivityIndicator size="large" color={C.blue2} />
          <Text style={S.dim}>프로필 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (errMsg || !profile) {
    return (
      <View style={S.container}>
        <ScreenHeader title="구직자 상세" iconName="person-outline" iconBg={C.blue2} />
        <View style={S.center}>
          <Ionicons name="alert-circle-outline" size={40} color={C.warn2} />
          <Text style={S.errTtl}>프로필을 불러오지 못했습니다</Text>
          <Text style={S.dim}>{errMsg || '데이터가 없습니다.'}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={load}>
            <Ionicons name="refresh-outline" size={14} color={C.t2} />
            <Text style={S.retryTxt}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const grade = GRADES.find(g => g.letter === profile.assessment_grade);
  const years = profile.career_years ?? 0;

  return (
    <View style={S.container}>
      <ScreenHeader
        title="구직자 상세"
        iconName="person-outline"
        iconBg={grade?.color || C.blue2}
      />

      <ScrollView contentContainerStyle={S.scroll}>

        {/* 상단 요약 */}
        <View style={S.heroCard}>
          {grade ? (
            <View style={[S.heroBadge, { backgroundColor: grade.color }]}>
              <Text style={S.heroLetter}>{grade.letter}</Text>
            </View>
          ) : (
            <View style={[S.heroBadge, { backgroundColor: C.t4 }]}>
              <Ionicons name="person-outline" size={26} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={S.heroNick}>
                {profile.nickname || '익명 구직자'}
              </Text>
              {profile.phone_verified && (
                <View style={S.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={10} color="#fff" />
                  <Text style={S.verifiedTxt}>본인인증</Text>
                </View>
              )}
            </View>
            <Text style={S.heroMeta}>
              {profile.region_si || '지역 미지정'}
              {profile.region_gu ? ` · ${profile.region_gu}` : ''}
              {years ? ` · 경력 ${years}년` : ''}
            </Text>
            {grade && (
              <Text style={[S.heroGradeTxt, { color: grade.color }]}>
                {grade.label} · {grade.sub} · {grade.salary}
              </Text>
            )}
          </View>
        </View>

        {/* 점수 요약 */}
        {grade && (
          <View style={S.scoreStrip}>
            <View style={S.scoreCell}>
              <Text style={S.scoreLbl}>원 점수</Text>
              <Text style={S.scoreVal}>{Math.round(profile.assessment_score || 0)}점</Text>
            </View>
            <View style={S.scoreSep} />
            <View style={S.scoreCell}>
              <Text style={S.scoreLbl}>등급</Text>
              <Text style={[S.scoreVal, { color: grade.color }]}>{grade.letter}급</Text>
            </View>
            {profile.review_count > 0 && (
              <>
                <View style={S.scoreSep} />
                <View style={S.scoreCell}>
                  <Text style={S.scoreLbl}>평판</Text>
                  <Text style={S.scoreVal}>
                    ★ {(profile.review_avg || 0).toFixed(1)} ({profile.review_count})
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* 자기소개 */}
        {profile.intro_text ? (
          <>
            <Text style={S.sectionLabel}>자기소개</Text>
            <View style={S.introCard}>
              <Text style={S.introTxt}>{profile.intro_text}</Text>
            </View>
          </>
        ) : null}

        {/* 근무 조건 */}
        <Text style={S.sectionLabel}>희망 근무 조건</Text>
        <View style={S.condGrid}>
          <CondCell
            icon="briefcase-outline"
            lbl="근무 형태"
            val={profile.preferred_role || '협의'}
          />
          <CondCell
            icon="cash-outline"
            lbl="희망 급여"
            val={profile.desired_pay || '협의'}
          />
          <CondCell
            icon="time-outline"
            lbl="근무 시간"
            val={profile.work_hours_pref || '협의'}
          />
          <CondCell
            icon="calendar-outline"
            lbl="근무 가능"
            val={profile.available_from ? profile.available_from : '즉시'}
          />
        </View>

        {/* 자격증 */}
        {profile.certs && profile.certs.length > 0 && (
          <>
            <Text style={S.sectionLabel}>자격·보유 스킬</Text>
            <View style={S.chipWrap}>
              {profile.certs.map((c, i) => (
                <View key={i} style={S.certChip}>
                  <Ionicons name="ribbon-outline" size={11} color={C.pur} />
                  <Text style={S.certTxt}>{c}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 선호 축종 */}
        {profile.preferred_species && profile.preferred_species.length > 0 && (
          <>
            <Text style={S.sectionLabel}>선호 축종</Text>
            <View style={S.chipWrap}>
              {profile.preferred_species.map((sp, i) => (
                <View key={i} style={[S.certChip, { backgroundColor: C.redS }]}>
                  <Text style={[S.certTxt, { color: C.red }]}>{sp}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 안내 */}
        <View style={S.privacy}>
          <Ionicons name="lock-closed-outline" size={16} color={C.ok} />
          <Text style={S.privacyTxt}>
            실명·연락처·사진 원본은 이 구직자가 귀하의 헤드헌팅 요청을 <Text style={{ fontWeight: '900' }}>수락</Text>한 경우에만 공개됩니다.
          </Text>
        </View>

      </ScrollView>

      {/* 하단 CTA */}
      <View style={S.ctaBar}>
        <View style={S.quotaStrip}>
          <Ionicons name="flash-outline" size={13} color={C.t3} />
          <Text style={S.quotaTxt}>
            이번 달 쿼터 <Text style={{ fontWeight: '900', color: C.t1 }}>{quota.used}</Text>/{quota.limit}건
          </Text>
        </View>
        <TouchableOpacity style={S.ctaBtn} onPress={openModal} activeOpacity={0.9}>
          <Ionicons name="paper-plane-outline" size={16} color="#fff" />
          <Text style={S.ctaBtnTxt}>헤드헌팅 요청 보내기</Text>
        </TouchableOpacity>
      </View>

      {/* 바텀시트 모달 */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={S.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={S.modalSheet}>
              <View style={S.modalHandle} />
              <Text style={S.modalTtl}>헤드헌팅 요청</Text>
              <Text style={S.modalSb}>
                구직자에게 전달할 제안을 작성해 주세요. 실명·연락처는 구직자가 수락 시에만 공개됩니다.
              </Text>

              <Text style={S.modalLbl}>제안 메시지 *</Text>
              <TextInput
                style={S.textarea}
                value={msg}
                onChangeText={t => setMsg(t.slice(0, MESSAGE_MAX))}
                placeholder="예: 서울 강남 정육점입니다. 돼지 발골 가능하신 분 찾고 있어요. 월급 350 + 4대보험 지원."
                placeholderTextColor={C.t4}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={MESSAGE_MAX}
              />
              <Text style={S.counter}>
                {msg.length}/{MESSAGE_MAX}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={S.modalLbl}>제안 직무</Text>
                  <TextInput
                    style={S.input}
                    value={offerRole}
                    onChangeText={setOfferRole}
                    placeholder="발골·판매 등"
                    placeholderTextColor={C.t4}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.modalLbl}>제안 급여</Text>
                  <TextInput
                    style={S.input}
                    value={offerPay}
                    onChangeText={setOfferPay}
                    placeholder="월 350만원"
                    placeholderTextColor={C.t4}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[S.modalBtn, S.modalBtnGhost]}
                  onPress={() => setModalOpen(false)}
                  disabled={sending}
                >
                  <Text style={S.modalBtnGhostTxt}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalBtn, S.modalBtnPrimary, sending && { opacity: 0.6 }]}
                  onPress={sendRequest}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={14} color="#fff" />
                      <Text style={S.modalBtnPrimaryTxt}>요청 전송</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ── 근무 조건 셀 ─────────────────────────────────────────
function CondCell({ icon, lbl, val }) {
  return (
    <View style={S.condCell}>
      <View style={S.condIc}>
        <Ionicons name={icon} size={14} color={C.blue2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.condLbl}>{lbl}</Text>
        <Text style={S.condVal} numberOfLines={2}>{val}</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 140 },

  center: {
    paddingVertical: 80, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dim: { fontSize: 12, color: C.t3 },
  errTtl: { fontSize: 14, fontWeight: '800', color: C.t1, marginTop: 4 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.bg2, borderRadius: 10,
  },
  retryTxt: { fontSize: 12, fontWeight: '800', color: C.t2 },

  // 상단 히어로
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 10,
  },
  heroBadge: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  heroLetter: { color: '#fff', fontSize: 26, fontWeight: '900' },
  heroNick: { fontSize: 17, fontWeight: '900', color: C.t1 },
  heroMeta: { fontSize: 12, color: C.t3, marginTop: 3 },
  heroGradeTxt: { fontSize: 12, fontWeight: '900', marginTop: 4 },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.ok2, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  verifiedTxt: { color: '#fff', fontSize: 9, fontWeight: '900' },

  // 점수 스트립
  scoreStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 10, marginBottom: 16,
  },
  scoreCell: { flex: 1, alignItems: 'center' },
  scoreLbl: { fontSize: 10, fontWeight: '800', color: C.t3, letterSpacing: 0.3 },
  scoreVal: { fontSize: 14, fontWeight: '900', color: C.t1, marginTop: 2 },
  scoreSep: { width: 1, height: 24, backgroundColor: C.border },

  // 섹션
  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: C.t2,
    letterSpacing: 0.3, marginBottom: 8,
  },
  introCard: {
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 16,
  },
  introTxt: { fontSize: 13, color: C.t1, lineHeight: 20 },

  condGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 16,
  },
  condCell: {
    width: '48%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 10, minHeight: 56,
  },
  condIc: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.blueS,
    alignItems: 'center', justifyContent: 'center',
  },
  condLbl: { fontSize: 10, fontWeight: '800', color: C.t3, letterSpacing: 0.2 },
  condVal: { fontSize: 12, fontWeight: '800', color: C.t1, marginTop: 1 },

  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginBottom: 16,
  },
  certChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(109,40,217,0.09)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  certTxt: { fontSize: 11, fontWeight: '700', color: C.pur },

  privacy: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    padding: 12, borderRadius: 10,
    backgroundColor: C.okS,
    borderWidth: 1, borderColor: 'rgba(21,128,61,0.2)',
    marginTop: 4,
  },
  privacyTxt: { flex: 1, fontSize: 11, color: C.ok, lineHeight: 16 },

  // 하단 CTA 바
  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20,
    gap: 6,
  },
  quotaStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  quotaTxt: { fontSize: 11, color: C.t3, fontWeight: '700' },
  ctaBtn: {
    backgroundColor: C.red,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12,
  },
  ctaBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },

  // 모달
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border, marginBottom: 14,
  },
  modalTtl: { fontSize: 16, fontWeight: '900', color: C.t1, marginBottom: 4 },
  modalSb:  { fontSize: 12, color: C.t3, lineHeight: 17, marginBottom: 14 },
  modalLbl: { fontSize: 12, fontWeight: '800', color: C.t2, marginBottom: 6, marginTop: 10 },
  textarea: {
    backgroundColor: C.bg, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: C.t1, minHeight: 88,
  },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 13, color: C.t1,
  },
  counter: { fontSize: 10, color: C.t4, textAlign: 'right', marginTop: 3, fontWeight: '700' },

  modalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
  },
  modalBtnGhost: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  modalBtnGhostTxt: { fontSize: 14, fontWeight: '800', color: C.t2 },
  modalBtnPrimary: { backgroundColor: C.red },
  modalBtnPrimaryTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
