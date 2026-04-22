/**
 * CarcassHistoryScreen.js — 계근 입고 세션 히스토리
 *
 * - 과거 carcass_sessions 리스트 (Supabase + 로컬 폴백)
 * - 기간/품종 필터
 * - 상단 통계 카드: 세션수·총원가·평균마진·평균수율
 * - 세션 카드 탭 → CarcassSessionDetail로 드릴다운
 * - Pull-to-refresh
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { carcassStore } from '../lib/carcassStore';
import { SPECIES_OPTIONS } from '../data/standardParts';

const PERIOD_OPTIONS = [
  { key: 7,   label: '최근 7일' },
  { key: 30,  label: '최근 30일' },
  { key: 90,  label: '최근 90일' },
  { key: 0,   label: '전체' },
];

// 숫자 포맷 헬퍼
const fmt = (n, digits = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const rounded = digits > 0 ? Number(n).toFixed(digits) : Math.round(Number(n));
  return Number(rounded).toLocaleString('ko-KR', { maximumFractionDigits: digits });
};

// "2026-04-18T12:34:56Z" → "4/18 화"
function fmtShort(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} ${days[d.getDay()]}`;
  } catch {
    return '-';
  }
}

// 세션이 기간 내에 들어오는지
function inPeriod(sess, days) {
  if (!days) return true;
  const ts = new Date(sess.created_at || sess.createdAt || 0).getTime();
  return (Date.now() - ts) <= days * 24 * 60 * 60 * 1000;
}

// 세션 객체 정규화 (local vs supabase 스키마 차이 흡수)
function normalize(s) {
  const parts = s.carcass_parts || s.parts || [];
  return {
    id:           s.id,
    species:      s.species || '소',
    trace_no:     s.trace_no || null,
    supplier:     s.supplier_name || s.supplierName || null,
    purchase_date: s.purchase_date || null,
    created_at:   s.created_at || s.createdAt || null,
    live_weight:   Number(s.live_weight_kg)    || 0,
    trimmed_weight:Number(s.trimmed_weight_kg) || 0,
    total_cost:    Number(s.total_cost)        || 0,
    expected_rev:  Number(s.expected_revenue)  || 0,
    expected_margin: Number(s.expected_margin) || 0,
    margin_pct:    Number(s.margin_pct)        || 0,
    trimmed_unit_price: Number(s.trimmed_unit_price) || 0,
    parts,
    parts_count:  parts.length,
    raw: s,
  };
}

export default function CarcassHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [sessions, setSessions]   = useState([]);
  const [period, setPeriod]       = useState(30);
  const [speciesFilter, setSpeciesFilter] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await carcassStore.loadHistory(100);
      const norm = (data || []).map(normalize);
      setSessions(norm);
    } catch (e) {
      console.warn('[CarcassHistory] load', e);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 필터 적용
  const filtered = useMemo(() => {
    return sessions
      .filter(s => inPeriod(s, period))
      .filter(s => !speciesFilter || s.species === speciesFilter);
  }, [sessions, period, speciesFilter]);

  // 통계 계산
  const stats = useMemo(() => {
    const count = filtered.length;
    const totalCost = filtered.reduce((a, s) => a + s.total_cost, 0);
    const totalMargin = filtered.reduce((a, s) => a + s.expected_margin, 0);
    const avgMarginPct = totalCost > 0 ? totalMargin / totalCost : 0;
    const totalLive    = filtered.reduce((a, s) => a + s.live_weight, 0);
    const totalTrimmed = filtered.reduce((a, s) => a + s.trimmed_weight, 0);
    const avgYield     = totalLive > 0 ? totalTrimmed / totalLive : 0;
    return { count, totalCost, totalMargin, avgMarginPct, avgYield };
  }, [filtered]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* 상태바 영역 흰 배경 */}
      <View style={{ height: insets.top, backgroundColor: C.white }} />
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={C.t1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>계근 히스토리</Text>
        <TouchableOpacity
          onPress={() => navigation?.navigate('CarcassWeighing')}
          style={styles.newBtn}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnTxt}>신규</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefresh(true); load(); }}
            tintColor={C.red}
          />
        }
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      >
        {/* 기간 필터 */}
        <View style={styles.chipRow}>
          {PERIOD_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, period === opt.key && styles.chipActive]}
              onPress={() => setPeriod(opt.key)}
            >
              <Text style={[styles.chipTxt, period === opt.key && styles.chipTxtActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 품종 필터 */}
        <View style={[styles.chipRow, { marginTop: 8 }]}>
          <TouchableOpacity
            style={[styles.chipSm, !speciesFilter && styles.chipActive]}
            onPress={() => setSpeciesFilter(null)}
          >
            <Text style={[styles.chipSmTxt, !speciesFilter && styles.chipTxtActive]}>전체 품종</Text>
          </TouchableOpacity>
          {SPECIES_OPTIONS.filter(s => s !== '기타').map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chipSm, speciesFilter === s && styles.chipActive]}
              onPress={() => setSpeciesFilter(s)}
            >
              <Text style={[styles.chipSmTxt, speciesFilter === s && styles.chipTxtActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 통계 카드 */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <Stat label="세션"       value={`${stats.count} 건`} color={C.red} />
            <Stat label="총 원가"    value={`${fmt(stats.totalCost / 10000, 1)}만`} color={C.t1} />
            <Stat label="평균 마진"  value={`${fmt(stats.avgMarginPct * 100, 1)}%`}
                  color={stats.avgMarginPct >= 0.25 ? C.ok2 : (stats.avgMarginPct >= 0 ? C.warn2 : C.red)} />
            <Stat label="평균 수율"  value={`${fmt(stats.avgYield * 100, 1)}%`} color={C.blue} />
          </View>
        </View>

        {/* 세션 리스트 */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.red} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="albums-outline" size={48} color={C.t4} />
            <Text style={styles.emptyTitle}>기록된 계근 세션이 없습니다</Text>
            <Text style={styles.emptyDesc}>
              재고 화면에서 "계근 입고" 모드로 한 마리를 저장하면 여기에 쌓입니다.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation?.navigate('CarcassWeighing')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.emptyBtnTxt}>첫 계근 시작</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((s, idx) => (
            <SessionCard
              key={s.id || idx}
              session={s}
              onPress={() => navigation?.navigate('CarcassSessionDetail', { sessionId: s.id, session: s.raw })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: color || C.t1 }]}>{value}</Text>
    </View>
  );
}

function SessionCard({ session, onPress }) {
  const marginColor = session.margin_pct >= 0.25 ? C.ok2
                   : session.margin_pct >= 0    ? C.warn2 : C.red;
  const traceShort = session.trace_no ? `·${String(session.trace_no).slice(-6)}` : '';

  return (
    <TouchableOpacity style={styles.sessionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.sessionTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={styles.speciesBadge}>
            <Text style={styles.speciesBadgeTxt}>{session.species}</Text>
          </View>
          <Text style={styles.sessionDate}>{fmtShort(session.created_at)}</Text>
          {session.trace_no && (
            <Text style={styles.sessionTrace}>{traceShort}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.t3} />
      </View>

      <View style={styles.sessionBody}>
        <View style={{ flex: 1.2 }}>
          <Text style={styles.sessionSubtitle}>
            {session.supplier || '-'}
          </Text>
          <Text style={styles.sessionMeta}>
            산피 {fmt(session.live_weight, 1)}kg · 발골 {fmt(session.trimmed_weight, 1)}kg · {session.parts_count}부위
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.sessionCost}>원가 {fmt(session.total_cost / 10000, 1)}만</Text>
          <Text style={[styles.sessionMargin, { color: marginColor }]}>
            {session.expected_margin >= 0 ? '+' : ''}{fmt(session.expected_margin / 10000, 1)}만
            <Text style={{ fontSize: F.xxs }}> ({fmt(session.margin_pct * 100, 1)}%)</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: F.h3, fontWeight: '900', color: C.t1 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.red, borderRadius: R.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  newBtnTxt: { color: '#fff', fontSize: F.xs, fontWeight: '900' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.full, backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
  },
  chipSm: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.full, backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.red, borderColor: C.red },
  chipTxt:    { fontSize: F.sm, fontWeight: '700', color: C.t1 },
  chipSmTxt:  { fontSize: F.xs, fontWeight: '700', color: C.t1 },
  chipTxtActive: { color: '#fff' },

  statsCard: {
    backgroundColor: C.white, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginTop: 12, marginBottom: 14, ...SH.sm,
  },
  statsRow: { flexDirection: 'row' },
  statLabel: { fontSize: F.xxs, color: C.t3, fontWeight: '700' },
  statValue: { fontSize: F.body, fontWeight: '900', marginTop: 3 },

  sessionCard: {
    backgroundColor: C.white, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8, ...SH.sm,
  },
  sessionTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  speciesBadge: {
    backgroundColor: C.red + '18', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  speciesBadgeTxt: { color: C.red, fontSize: F.xxs, fontWeight: '900' },
  sessionDate:  { fontSize: F.sm, fontWeight: '800', color: C.t1 },
  sessionTrace: { fontSize: F.xxs, color: C.t3, fontFamily: 'Courier' },

  sessionBody: { flexDirection: 'row', alignItems: 'center' },
  sessionSubtitle: { fontSize: F.sm, fontWeight: '700', color: C.t1 },
  sessionMeta:     { fontSize: F.xxs, color: C.t3, marginTop: 2 },
  sessionCost:     { fontSize: F.xs, color: C.t2, fontWeight: '700' },
  sessionMargin:   { fontSize: F.body, fontWeight: '900', marginTop: 2 },

  emptyBox: {
    alignItems: 'center', padding: 40, marginTop: 20,
    backgroundColor: C.white, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border, ...SH.sm,
  },
  emptyTitle: { fontSize: F.body, fontWeight: '900', color: C.t1, marginTop: 12 },
  emptyDesc:  { fontSize: F.sm,  color: C.t3,  marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.red, borderRadius: R.full,
    paddingHorizontal: 18, paddingVertical: 10, marginTop: 16,
  },
  emptyBtnTxt: { color: '#fff', fontSize: F.sm, fontWeight: '900' },
});
