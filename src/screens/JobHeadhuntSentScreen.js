/**
 * JobHeadhuntSentScreen — 사장이 보낸 헤드헌팅 요청함
 *
 * 경로: JobOwnerHub → "내가 보낸 헤드헌팅 요청" → 이 화면
 *
 * 기능:
 *  - 내가 auth_uid로 보낸 headhunt_requests 목록 (최신순)
 *  - 상태별 필터 (전체 / 대기 / 수락 / 거절 / 만료)
 *  - 수락된 요청은 [실명·연락처 보기] 버튼 → get_revealed_profile RPC
 *  - 대기 중 요청은 메시지·제안 정보만 표시
 *  - Pull-to-refresh
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator, Linking, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import ScreenHeader from '../components/ScreenHeader';
import { headhuntStore, publicListStore } from '../lib/jobStore';
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
  t1:     '#0F172A',
  t2:     '#334155',
  t3:     '#64748B',
  t4:     '#94A3B8',
  border: '#E2E8F0',
  bg2:    '#F1F5F9',
};

const STATUS_FILTERS = [
  { k: null,        lbl: '전체' },
  { k: 'pending',   lbl: '대기',  color: C.warn2 },
  { k: 'accepted',  lbl: '수락',  color: C.ok2 },
  { k: 'declined',  lbl: '거절',  color: C.t3 },
  { k: 'expired',   lbl: '만료',  color: C.t4 },
];

const STATUS_META = {
  pending:  { lbl: '대기 중',   color: C.warn2,  icon: 'hourglass-outline' },
  accepted: { lbl: '수락됨',    color: C.ok2,    icon: 'checkmark-circle-outline' },
  declined: { lbl: '거절됨',    color: C.t3,     icon: 'close-circle-outline' },
  expired:  { lbl: '만료',      color: C.t4,     icon: 'time-outline' },
};

export default function JobHeadhuntSentScreen({ navigation }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [filter, setFilter] = useState(null);

  // 모달: 수락된 요청의 revealed 정보
  const [revealOpen, setRevealOpen]  = useState(false);
  const [revealData, setRevealData]  = useState(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await headhuntStore.fetchSent();
    if (error) setErrMsg(error);
    else       setErrMsg(null);
    setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = filter ? items.filter(x => x.status === filter) : items;

  // 수락된 요청 → 실명/연락처 공개
  const handleReveal = async (item) => {
    setRevealOpen(true);
    setRevealLoading(true);
    setRevealData(null);

    const { data, error } = await publicListStore.getRevealed(item.id);
    setRevealLoading(false);

    if (error) {
      setRevealOpen(false);
      Alert.alert('조회 실패', error);
      return;
    }
    // RPC는 array 또는 row를 반환 — 둘 다 방어
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setRevealOpen(false);
      Alert.alert(
        '공개 불가',
        '수락된 요청만 실명·연락처가 공개됩니다. 상대가 수락했는지 다시 확인해 주세요.',
      );
      return;
    }
    setRevealData(row);
  };

  const handleCall = (phone) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/[^0-9+]/g, '')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('전화 실행 실패', '기기에서 전화를 걸 수 없습니다.');
    });
  };

  return (
    <View style={S.container}>
      <ScreenHeader
        title="보낸 요청"
        iconName="paper-plane-outline"
        iconBg={C.red}
      />

      {/* 필터 바 */}
      <View style={S.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterRow}>
          {STATUS_FILTERS.map(f => {
            const active = filter === f.k;
            return (
              <TouchableOpacity
                key={f.k || 'all'}
                style={[
                  S.filterChip,
                  active && { backgroundColor: f.color || C.t1, borderColor: f.color || C.t1 },
                ]}
                onPress={() => setFilter(f.k)}
              >
                <Text style={[S.filterChipTxt, active && { color: '#fff' }]}>{f.lbl}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.red} />}
      >
        <Text style={S.summary}>
          총 <Text style={{ color: C.red, fontWeight: '900' }}>{filtered.length}</Text>건
        </Text>

        {loading && (
          <View style={S.center}>
            <ActivityIndicator size="large" color={C.red} />
            <Text style={S.dim}>불러오는 중...</Text>
          </View>
        )}

        {!loading && errMsg && (
          <View style={S.errBox}>
            <Ionicons name="cloud-offline-outline" size={28} color={C.warn2} />
            <Text style={S.errTtl}>불러오지 못했습니다</Text>
            <Text style={S.dim}>{errMsg}</Text>
            <TouchableOpacity style={S.retryBtn} onPress={load}>
              <Ionicons name="refresh-outline" size={14} color={C.t2} />
              <Text style={S.retryTxt}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !errMsg && filtered.length === 0 && (
          <View style={S.center}>
            <Ionicons name="paper-plane-outline" size={40} color={C.t4} />
            <Text style={S.emptyTtl}>아직 보낸 요청이 없습니다</Text>
            <Text style={S.dim}>
              인재 풀 탐색에서 마음에 드는 구직자에게 요청을 보내 보세요.
            </Text>
            <TouchableOpacity
              style={S.primaryBtn}
              onPress={() => navigation.navigate('JobOwnerBrowse')}
            >
              <Ionicons name="search-outline" size={14} color="#fff" />
              <Text style={S.primaryBtnTxt}>인재 탐색</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && filtered.map(item => (
          <SentCard
            key={item.id}
            item={item}
            onReveal={() => handleReveal(item)}
          />
        ))}
      </ScrollView>

      {/* 실명·연락처 공개 모달 */}
      <Modal visible={revealOpen} animationType="fade" transparent onRequestClose={() => setRevealOpen(false)}>
        <View style={S.modalBackdrop}>
          <View style={S.revealSheet}>
            <View style={S.revealHead}>
              <Ionicons name="person-circle-outline" size={28} color={C.ok} />
              <Text style={S.revealTtl}>실명·연락처 공개</Text>
              <TouchableOpacity onPress={() => setRevealOpen(false)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="close" size={22} color={C.t2} />
              </TouchableOpacity>
            </View>

            {revealLoading && (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator color={C.ok} />
              </View>
            )}

            {!revealLoading && revealData && (
              <>
                <View style={S.revealRow}>
                  <Text style={S.revealLbl}>실명</Text>
                  <Text style={S.revealVal}>{revealData.full_name || '—'}</Text>
                </View>
                <View style={S.revealRow}>
                  <Text style={S.revealLbl}>연락처</Text>
                  <Text style={S.revealVal}>{revealData.phone || '—'}</Text>
                </View>
                <View style={S.revealRow}>
                  <Text style={S.revealLbl}>지역</Text>
                  <Text style={S.revealVal}>
                    {[revealData.region_si, revealData.region_gu].filter(Boolean).join(' ') || '—'}
                  </Text>
                </View>
                <View style={S.revealRow}>
                  <Text style={S.revealLbl}>등급</Text>
                  <Text style={S.revealVal}>
                    {revealData.assessment_grade ? `${revealData.assessment_grade}급` : '—'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[S.revealCallBtn, !revealData.phone && { opacity: 0.4 }]}
                  onPress={() => handleCall(revealData.phone)}
                  disabled={!revealData.phone}
                >
                  <Ionicons name="call-outline" size={16} color="#fff" />
                  <Text style={S.revealCallTxt}>전화 걸기</Text>
                </TouchableOpacity>

                <Text style={S.revealNote}>
                  ※ 취득한 실명·연락처는 본 구직에만 사용하시고, 제3자 제공·판매는 금지됩니다.
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── 보낸 요청 카드 ─────────────────────────────────────────
function SentCard({ item, onReveal }) {
  const meta = STATUS_META[item.status] || STATUS_META.pending;
  const createdAt = item.created_at ? new Date(item.created_at) : null;
  const dateLabel = createdAt
    ? `${createdAt.getMonth() + 1}/${createdAt.getDate()} ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`
    : '';

  return (
    <View style={S.card}>
      <View style={S.cardHead}>
        <View style={[S.statusPill, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={11} color="#fff" />
          <Text style={S.statusTxt}>{meta.lbl}</Text>
        </View>
        <Text style={S.cardDate}>{dateLabel}</Text>
      </View>

      <Text style={S.cardTarget}>→ 프로필 {item.to_profile_id?.slice(0, 8)}...</Text>

      {item.message ? (
        <Text style={S.cardMsg} numberOfLines={3}>{item.message}</Text>
      ) : null}

      <View style={S.offerRow}>
        {item.offered_role ? (
          <View style={S.offerChip}>
            <Ionicons name="briefcase-outline" size={11} color={C.t3} />
            <Text style={S.offerTxt}>{item.offered_role}</Text>
          </View>
        ) : null}
        {item.offered_pay ? (
          <View style={S.offerChip}>
            <Ionicons name="cash-outline" size={11} color={C.t3} />
            <Text style={S.offerTxt}>{item.offered_pay}</Text>
          </View>
        ) : null}
        {item.offered_start_date ? (
          <View style={S.offerChip}>
            <Ionicons name="calendar-outline" size={11} color={C.t3} />
            <Text style={S.offerTxt}>{item.offered_start_date}</Text>
          </View>
        ) : null}
      </View>

      {item.status === 'accepted' && (
        <TouchableOpacity style={S.revealBtn} onPress={onReveal} activeOpacity={0.85}>
          <Ionicons name="eye-outline" size={14} color="#fff" />
          <Text style={S.revealBtnTxt}>실명·연락처 보기</Text>
        </TouchableOpacity>
      )}
      {item.status === 'pending' && (
        <Text style={S.pendingHint}>
          <Ionicons name="hourglass-outline" size={11} color={C.warn2} />  구직자의 응답을 기다리는 중입니다.
        </Text>
      )}
      {item.status === 'declined' && (
        <Text style={S.declinedHint}>
          <Ionicons name="close-circle-outline" size={11} color={C.t3} />  구직자가 거절했습니다. 다른 인재를 찾아 보세요.
        </Text>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 120 },

  filterBar: {
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingVertical: 8,
  },
  filterRow: { paddingHorizontal: 12, gap: 6, alignItems: 'center', flexDirection: 'row' },
  filterChip: {
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  filterChipTxt: { fontSize: 12, fontWeight: '700', color: C.t2 },

  summary: { fontSize: 13, color: C.t2, fontWeight: '700', marginBottom: 10 },

  center: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  dim: { fontSize: 12, color: C.t3, textAlign: 'center' },
  emptyTtl: { fontSize: 14, fontWeight: '800', color: C.t2, marginTop: 4 },

  errBox: {
    padding: 20, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', gap: 8,
  },
  errTtl: { fontSize: 14, fontWeight: '800', color: C.t1 },

  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.bg2, borderRadius: 8,
  },
  retryTxt: { fontSize: 12, fontWeight: '800', color: C.t2 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: C.red, borderRadius: 10,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // 카드
  card: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  statusTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  cardDate: { fontSize: 11, color: C.t4, fontWeight: '700' },
  cardTarget: { fontSize: 11, color: C.t3, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), marginBottom: 6 },
  cardMsg: { fontSize: 13, color: C.t1, lineHeight: 19, marginBottom: 8 },

  offerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  offerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.bg2, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  offerTxt: { fontSize: 11, fontWeight: '700', color: C.t3 },

  revealBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.ok2, borderRadius: 10,
    paddingVertical: 10, marginTop: 4,
  },
  revealBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
  pendingHint:  { fontSize: 11, color: C.warn, marginTop: 4 },
  declinedHint: { fontSize: 11, color: C.t3, marginTop: 4 },

  // 모달
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  revealSheet: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 20, width: '100%', maxWidth: 380,
  },
  revealHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12,
  },
  revealTtl: { fontSize: 15, fontWeight: '900', color: C.t1 },
  revealRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.bg2,
  },
  revealLbl: { fontSize: 12, fontWeight: '800', color: C.t3 },
  revealVal: { fontSize: 14, fontWeight: '900', color: C.t1 },
  revealCallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.ok2, borderRadius: 10,
    paddingVertical: 12, marginTop: 16,
  },
  revealCallTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  revealNote: { fontSize: 10, color: C.t4, marginTop: 10, lineHeight: 14 },
});
