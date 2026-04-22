/**
 * JobHeadhuntInboxScreen — 직원용 받은 헤드헌팅 요청함
 *
 * 경로: JobStaffHub → "헤드헌팅 요청함" → 이 화면
 *
 * 기능:
 *  - 내 프로필로 온 headhunt_requests 목록 (RLS: hh_receiver 정책)
 *  - 상태별 필터 (전체 / 대기 / 수락 / 거절)
 *  - 대기 중 카드 하단: [수락] [거절] 버튼
 *    · 수락 시: 사장에게 내 실명·연락처 공개 (확인 다이얼로그)
 *    · 거절 시: status='declined' 업데이트
 *  - 만료된 요청은 자동 회색 처리
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import ScreenHeader from '../components/ScreenHeader';
import { headhuntStore } from '../lib/jobStore';

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
  { k: null,       lbl: '전체' },
  { k: 'pending',  lbl: '대기',  color: C.warn2 },
  { k: 'accepted', lbl: '수락',  color: C.ok2 },
  { k: 'declined', lbl: '거절',  color: C.t3 },
];

const STATUS_META = {
  pending:  { lbl: '대기 중',   color: C.warn2,  icon: 'hourglass-outline' },
  accepted: { lbl: '수락됨',    color: C.ok2,    icon: 'checkmark-circle-outline' },
  declined: { lbl: '거절됨',    color: C.t3,     icon: 'close-circle-outline' },
  expired:  { lbl: '만료',      color: C.t4,     icon: 'time-outline' },
};

export default function JobHeadhuntInboxScreen({ navigation }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg]   = useState(null);
  const [filter, setFilter]   = useState(null);
  const [acting, setActing]   = useState(null); // 현재 처리 중인 요청 id

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await headhuntStore.fetchInbox();
    if (error) setErrMsg(error);
    else       setErrMsg(null);
    setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = filter ? items.filter(x => x.status === filter) : items;
  const pendingCount = items.filter(x => x.status === 'pending').length;

  // ── 수락 ────────────────────────────────────────────────
  const handleAccept = (item) => {
    Alert.alert(
      '요청 수락',
      '수락하면 사장에게 내 실명과 연락처가 공개됩니다.\n계속하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '수락',
          style: 'default',
          onPress: async () => {
            setActing(item.id);
            const { data, error } = await headhuntStore.respond(item.id, 'accepted');
            setActing(null);
            if (error) {
              Alert.alert('수락 실패', error);
              return;
            }
            // 로컬 업데이트
            setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'accepted' } : x));
            Alert.alert('수락 완료', '사장에게 내 실명·연락처가 공개되었습니다. 곧 연락이 올 수 있습니다.');
          },
        },
      ],
    );
  };

  // ── 거절 ────────────────────────────────────────────────
  const handleDecline = (item) => {
    Alert.alert(
      '요청 거절',
      '거절하면 사장에게 "거절됨"으로 표시됩니다. 내 실명은 공개되지 않습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거절',
          style: 'destructive',
          onPress: async () => {
            setActing(item.id);
            const { error } = await headhuntStore.respond(item.id, 'declined');
            setActing(null);
            if (error) {
              Alert.alert('거절 실패', error);
              return;
            }
            setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'declined' } : x));
          },
        },
      ],
    );
  };

  return (
    <View style={S.container}>
      <ScreenHeader
        title="받은 요청"
        iconName="mail-outline"
        iconBg={pendingCount > 0 ? C.red : C.blue2}
        subtitle={pendingCount > 0 ? `대기 중 ${pendingCount}건` : undefined}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue2} />}
      >
        <Text style={S.summary}>
          총 <Text style={{ color: C.blue2, fontWeight: '900' }}>{filtered.length}</Text>건
        </Text>

        {loading && (
          <View style={S.center}>
            <ActivityIndicator size="large" color={C.blue2} />
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
            <Ionicons name="mail-outline" size={40} color={C.t4} />
            <Text style={S.emptyTtl}>받은 요청이 없습니다</Text>
            <Text style={S.dim}>
              프로필을 공개하면 사장들이 검색하고 제안을 보낼 수 있습니다.
            </Text>
            <TouchableOpacity
              style={S.primaryBtn}
              onPress={() => navigation.navigate('JobProfileEditor')}
            >
              <Ionicons name="create-outline" size={14} color="#fff" />
              <Text style={S.primaryBtnTxt}>프로필 편집</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && filtered.map(item => (
          <InboxCard
            key={item.id}
            item={item}
            busy={acting === item.id}
            onAccept={() => handleAccept(item)}
            onDecline={() => handleDecline(item)}
          />
        ))}

        {/* 안내 */}
        {!loading && items.length > 0 && (
          <View style={S.notice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.ok} />
            <Text style={S.noticeTxt}>
              수락하기 전까지 사장은 내 실명·연락처를 볼 수 없습니다. 수상한 제안은 [신고] 기능으로 알려주세요.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── 받은 요청 카드 ─────────────────────────────────────────
function InboxCard({ item, busy, onAccept, onDecline }) {
  const now = Date.now();
  const expiresAt = item.expires_at ? new Date(item.expires_at).getTime() : null;
  const isExpired = item.status === 'expired' || (expiresAt && expiresAt < now && item.status === 'pending');
  const effectiveStatus = isExpired ? 'expired' : item.status;
  const meta = STATUS_META[effectiveStatus] || STATUS_META.pending;

  const createdAt = item.created_at ? new Date(item.created_at) : null;
  const dateLabel = createdAt
    ? `${createdAt.getMonth() + 1}/${createdAt.getDate()} ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`
    : '';

  const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;

  return (
    <View style={[S.card, isExpired && { opacity: 0.6 }]}>
      <View style={S.cardHead}>
        <View style={[S.statusPill, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={11} color="#fff" />
          <Text style={S.statusTxt}>{meta.lbl}</Text>
        </View>
        <Text style={S.cardDate}>{dateLabel}</Text>
      </View>

      {/* 보낸 사장 (이름만, 민감정보 X) */}
      <View style={S.senderRow}>
        <Ionicons name="briefcase-outline" size={13} color={C.t2} />
        <Text style={S.senderTxt}>
          {item.from_store_name || '사업장 미공개'}
          {item.from_owner_name ? ` · ${item.from_owner_name}` : ''}
        </Text>
      </View>

      {item.message ? (
        <View style={S.msgBox}>
          <Text style={S.msgTxt}>{item.message}</Text>
        </View>
      ) : null}

      <View style={S.offerRow}>
        {item.offered_role ? (
          <View style={S.offerChip}>
            <Ionicons name="briefcase-outline" size={11} color={C.t3} />
            <Text style={S.offerTxt}>{item.offered_role}</Text>
          </View>
        ) : null}
        {item.offered_pay ? (
          <View style={[S.offerChip, { backgroundColor: C.okS }]}>
            <Ionicons name="cash-outline" size={11} color={C.ok} />
            <Text style={[S.offerTxt, { color: C.ok }]}>{item.offered_pay}</Text>
          </View>
        ) : null}
        {item.offered_start_date ? (
          <View style={S.offerChip}>
            <Ionicons name="calendar-outline" size={11} color={C.t3} />
            <Text style={S.offerTxt}>{item.offered_start_date}부터</Text>
          </View>
        ) : null}
      </View>

      {/* 수락/거절 버튼 (pending만) */}
      {!isExpired && item.status === 'pending' && (
        <>
          {daysLeft !== null && daysLeft <= 3 && daysLeft > 0 && (
            <Text style={S.expireHint}>
              <Ionicons name="alarm-outline" size={11} color={C.warn2} />  {daysLeft}일 뒤 만료됩니다
            </Text>
          )}
          <View style={S.btnRow}>
            <TouchableOpacity
              style={[S.btn, S.btnDecline, busy && { opacity: 0.5 }]}
              onPress={onDecline}
              disabled={busy}
            >
              <Ionicons name="close-outline" size={14} color={C.t2} />
              <Text style={S.btnDeclineTxt}>거절</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btn, S.btnAccept, busy && { opacity: 0.5 }]}
              onPress={onAccept}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={14} color="#fff" />
                  <Text style={S.btnAcceptTxt}>수락 (실명 공개)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {item.status === 'accepted' && (
        <Text style={S.acceptedHint}>
          <Ionicons name="checkmark-circle-outline" size={11} color={C.ok} />  수락됨 — 사장에게 실명·연락처가 공개되었습니다
        </Text>
      )}
      {isExpired && (
        <Text style={S.expiredHint}>
          <Ionicons name="time-outline" size={11} color={C.t4} />  만료된 요청입니다
        </Text>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 100 },

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
    backgroundColor: C.blue2, borderRadius: 10,
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

  senderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  senderTxt: { fontSize: 13, fontWeight: '800', color: C.t1 },

  msgBox: {
    backgroundColor: C.bg2, borderRadius: 10,
    padding: 10, marginBottom: 8,
  },
  msgTxt: { fontSize: 13, color: C.t1, lineHeight: 19 },

  offerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  offerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.bg2, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  offerTxt: { fontSize: 11, fontWeight: '700', color: C.t3 },

  expireHint: { fontSize: 11, color: C.warn2, fontWeight: '700', marginBottom: 6 },

  btnRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 10,
  },
  btnDecline: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  btnDeclineTxt: { fontSize: 13, fontWeight: '800', color: C.t2 },
  btnAccept: { backgroundColor: C.ok2 },
  btnAcceptTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },

  acceptedHint: { fontSize: 11, color: C.ok, fontWeight: '700', marginTop: 2 },
  expiredHint:  { fontSize: 11, color: C.t4, fontWeight: '700', marginTop: 2 },

  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 10, padding: 12,
    backgroundColor: C.okS, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(21,128,61,0.15)',
  },
  noticeTxt: { flex: 1, fontSize: 11, color: C.ok, lineHeight: 16 },
});
