/**
 * CarcassSessionDetailScreen.js — 계근 세션 상세 화면
 *
 * route.params: { sessionId, session? }
 *  - sessionId 우선 (Supabase에서 full fetch)
 *  - session 있으면 즉시 렌더 후 백그라운드 refresh
 *
 * 기능:
 *  - 세션 요약 (원두 정보, 3단 무게, 원가, 예상 손익)
 *  - 부위별 상세 테이블 (정렬 가능: 기본 비율↓)
 *  - 손실 부위 경고
 *  - 세션 삭제 (carcass_sessions + carcass_parts cascade)
 *  - 클립보드 공유 (간단)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Share, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { carcassStore } from '../lib/carcassStore';

const fmt = (n, digits = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const rounded = digits > 0 ? Number(n).toFixed(digits) : Math.round(Number(n));
  return Number(rounded).toLocaleString('ko-KR', { maximumFractionDigits: digits });
};

function fmtFullDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch { return iso; }
}

export default function CarcassSessionDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const paramSession = route?.params?.session || null;
  const sessionId    = route?.params?.sessionId || paramSession?.id;

  const [session, setSession] = useState(paramSession);
  const [loading, setLoading] = useState(!paramSession);
  const [sortBy, setSortBy]   = useState('ratio');   // 'ratio' | 'profit' | 'weight' | 'order'

  const load = useCallback(async () => {
    if (!sessionId) { setLoading(false); return; }
    try {
      // loadHistory는 전체 목록이므로 필요한 세션만 찾아 사용
      const list = await carcassStore.loadHistory(200);
      const found = (list || []).find(s => s.id === sessionId);
      if (found) setSession(found);
    } catch (e) {
      console.warn('[SessionDetail] load', e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.red} />
      </View>
    );
  }
  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', padding: 40 }}>
        <Ionicons name="alert-circle-outline" size={48} color={C.t4} />
        <Text style={{ fontSize: F.body, color: C.t2, marginTop: 12 }}>세션을 찾을 수 없습니다</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: C.red, fontWeight: '800' }}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const parts = session.carcass_parts || session.parts || [];
  const totalCost    = Number(session.total_cost)        || 0;
  const expectedRev  = Number(session.expected_revenue)  || 0;
  const expectedMarg = Number(session.expected_margin)   || 0;
  const marginPct    = Number(session.margin_pct)        || 0;
  const liveWeight   = Number(session.live_weight_kg)    || 0;
  const trimmedWt    = Number(session.trimmed_weight_kg) || 0;
  const carcassWt    = Number(session.carcass_weight_kg) || 0;
  const fatWt        = Number(session.fat_weight_kg)     || 0;

  // 손실 부위
  const losses = parts.filter(p => Number(p.profit) < 0);

  // 부위 정렬
  const sortedParts = [...parts].sort((a, b) => {
    if (sortBy === 'ratio')  return (Number(b.ratio)       || 0) - (Number(a.ratio)       || 0);
    if (sortBy === 'profit') return (Number(b.profit)      || 0) - (Number(a.profit)      || 0);
    if (sortBy === 'weight') return (Number(b.weight_kg)   || 0) - (Number(a.weight_kg)   || 0);
    return (Number(a.part_order) || 0) - (Number(b.part_order) || 0);
  });

  async function handleShare() {
    try {
      const lines = [
        `[계근 세션] ${session.species || '-'}`,
        session.trace_no ? `이력: ${session.trace_no}` : null,
        session.supplier_name ? `공급처: ${session.supplier_name}` : null,
        `일시: ${fmtFullDate(session.created_at)}`,
        ``,
        `발골무게 ${fmt(trimmedWt, 2)}kg`,
        `총원가 ${fmt(totalCost)}원`,
        `예상매출 ${fmt(expectedRev)}원`,
        `예상마진 ${fmt(expectedMarg)}원 (${fmt(marginPct * 100, 1)}%)`,
        ``,
        `— 부위 ${parts.length}개 —`,
        ...sortedParts.map(p =>
          `${p.part_name}: ${fmt(Number(p.weight_kg), 2)}kg · ` +
          `${fmt(Number(p.ratio) * 100, 2)}% · ` +
          `마진 ${fmt(Number(p.profit))}원`
        ),
      ].filter(Boolean).join('\n');
      await Share.share({ message: lines });
    } catch (e) {
      console.warn('[share]', e);
    }
  }

  function handleDelete() {
    Alert.alert(
      '세션 삭제',
      '이 계근 세션을 삭제할까요?\n부위 상세 기록도 함께 삭제됩니다. (이미 재고에 등록된 부위는 유지)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            const r = await carcassStore.deleteSession(session.id);
            if (r?.ok) {
              Alert.alert('삭제 완료', '', [{ text: '확인', onPress: () => navigation?.goBack() }]);
            } else {
              Alert.alert('삭제 실패', r?.error?.message || '네트워크를 확인하세요');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* 상태바 영역 흰 배경 */}
      <View style={{ height: insets.top, backgroundColor: C.white }} />
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={C.t1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>세션 상세</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Ionicons name="share-outline" size={20} color={C.t1} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {/* 헤드라인: 마진 */}
        <View style={styles.headlineCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.speciesBadge, { backgroundColor: C.red }]}>
              <Text style={[styles.speciesBadgeTxt, { color: '#fff' }]}>{session.species || '소'}</Text>
            </View>
            <Text style={styles.headlineDate}>{fmtFullDate(session.created_at)}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.headlineLabel}>예상 마진</Text>
            <Text style={[
              styles.headlineValue,
              { color: expectedMarg >= 0 ? C.ok2 : C.red }
            ]}>
              {expectedMarg >= 0 ? '+' : ''}{fmt(expectedMarg)}원
              <Text style={{ fontSize: F.h3 }}> ({fmt(marginPct * 100, 1)}%)</Text>
            </Text>
          </View>
        </View>

        {/* 원두 정보 */}
        <Section title="📌 원두 정보">
          <Row k="품종"       v={session.species || '-'} />
          {session.trace_no     && <Row k="이력번호"   v={session.trace_no} mono />}
          {session.supplier_name && <Row k="공급처"    v={session.supplier_name} />}
          {session.purchase_date && <Row k="구매일"    v={session.purchase_date} />}
          {session.notes        && <Row k="메모"       v={session.notes} />}
        </Section>

        {/* 무게 */}
        <Section title="⚖️ 3단 무게">
          <Row k="산피 (生皮)"    v={`${fmt(liveWeight, 2)} kg`} />
          {carcassWt > 0 && <Row k="지육 (枝肉)" v={`${fmt(carcassWt, 2)} kg`} />}
          <Row k="발골 (기름뺀지육)" v={`${fmt(trimmedWt, 2)} kg`} strong />
          {fatWt > 0 && <Row k="기름" v={`${fmt(fatWt, 2)} kg`} />}
          {liveWeight > 0 && (
            <Row k="산피→발골 총수율" v={`${fmt((trimmedWt / liveWeight) * 100, 1)}%`} color={C.blue} />
          )}
        </Section>

        {/* 원가 */}
        <Section title="💰 원가">
          <Row k="산피 비용" v={`${fmt(Number(session.live_unit_price) * liveWeight)}원`} />
          <Row k="운반비"    v={`${fmt(Number(session.transport_cost))}원`} />
          <Row k="하차비"    v={`${fmt(Number(session.unload_cost))}원`} />
          <Row k="중개비"    v={`${fmt(Number(session.broker_cost))}원`} />
          <Row k="우족작업비" v={`${fmt(Number(session.hoof_cost))}원`} />
          <Divider />
          <Row k="총 원가"   v={`${fmt(totalCost)}원`} strong color={C.red} />
          {trimmedWt > 0 && (
            <Row k="발골 Kg단가" v={`${fmt(Number(session.trimmed_unit_price) || totalCost / trimmedWt)}원/kg`} color={C.blue} />
          )}
        </Section>

        {/* 예상 손익 */}
        <Section title="📊 예상 손익">
          <Row k="예상 매출"  v={`${fmt(expectedRev)}원`}     color={C.blue} />
          <Row k="예상 마진"  v={`${fmt(expectedMarg)}원`}    strong color={expectedMarg >= 0 ? C.ok2 : C.red} />
          <Row k="마진율"     v={`${fmt(marginPct * 100, 1)}%`} color={marginPct >= 0.25 ? C.ok2 : C.warn2} />
        </Section>

        {/* 손실 부위 경고 */}
        {losses.length > 0 && (
          <View style={styles.warnBox}>
            <Ionicons name="warning-outline" size={20} color={C.warn2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>손실 부위 {losses.length}개</Text>
              <Text style={styles.warnDesc}>
                {losses.map(p => `${p.part_name}(${fmt(Number(p.profit))})`).join(', ')}
              </Text>
            </View>
          </View>
        )}

        {/* 부위 정렬 */}
        <Section title={`🥩 부위 상세 (${parts.length})`}>
          <View style={styles.sortRow}>
            {[
              { key: 'ratio',  label: '비율↓' },
              { key: 'weight', label: '무게↓' },
              { key: 'profit', label: '마진↓' },
              { key: 'order',  label: '원순서' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
                onPress={() => setSortBy(opt.key)}
              >
                <Text style={[styles.sortChipTxt, sortBy === opt.key && { color: '#fff' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 부위 테이블 헤더 */}
          <View style={styles.partHeader}>
            <Text style={[styles.partHeadCell, { flex: 1.4 }]}>부위</Text>
            <Text style={[styles.partHeadCell, { flex: 0.9, textAlign: 'right' }]}>무게</Text>
            <Text style={[styles.partHeadCell, { flex: 0.8, textAlign: 'right' }]}>비율</Text>
            <Text style={[styles.partHeadCell, { flex: 1,   textAlign: 'right' }]}>마진</Text>
          </View>

          {sortedParts.map((p, i) => {
            const w     = Number(p.weight_kg) || 0;
            const ratio = Number(p.ratio)     || 0;
            const prof  = Number(p.profit)    || 0;
            const alloc = Number(p.allocated_cost) || 0;
            const sale  = Number(p.sale_amount)    || 0;
            const price = Number(p.retail_price_kg) || 0;
            return (
              <View key={p.id || `${p.part_name}-${i}`} style={styles.partRow}>
                <View style={[styles.partCell, { flex: 1.4 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.partNameTxt}>{p.part_name}</Text>
                    {p.is_custom && (
                      <View style={styles.customTag}>
                        <Text style={styles.customTagTxt}>커</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.partSub}>
                    {fmt(price)}원/kg · 매출 {fmt(sale / 1000)}k · 원가 {fmt(alloc / 1000)}k
                  </Text>
                </View>
                <Text style={[styles.partCell, { flex: 0.9, textAlign: 'right' }]}>
                  {fmt(w, 2)}
                  <Text style={{ fontSize: F.xxs, color: C.t3 }}> kg</Text>
                </Text>
                <Text style={[styles.partCell, { flex: 0.8, textAlign: 'right' }]}>
                  {fmt(ratio * 100, 2)}
                  <Text style={{ fontSize: F.xxs, color: C.t3 }}>%</Text>
                </Text>
                <Text style={[
                  styles.partCell,
                  { flex: 1, textAlign: 'right', color: prof >= 0 ? C.ok2 : C.red, fontWeight: '900' }
                ]}>
                  {prof >= 0 ? '+' : ''}{fmt(prof / 1000)}
                  <Text style={{ fontSize: F.xxs, color: C.t3, fontWeight: '700' }}>k</Text>
                </Text>
              </View>
            );
          })}
        </Section>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}
function Row({ k, v, strong, color, mono }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={[
        styles.rowVal,
        strong && { fontWeight: '900', fontSize: F.body + 1 },
        color && { color },
        mono && { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
      ]}>{v}</Text>
    </View>
  );
}
function Divider() {
  return <View style={styles.divider} />;
}

// ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: F.h3, fontWeight: '900', color: C.t1 },

  headlineCard: {
    backgroundColor: C.white, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 12, ...SH.sm,
  },
  speciesBadge: {
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
  },
  speciesBadgeTxt: { fontSize: F.xs, fontWeight: '900' },
  headlineDate:    { fontSize: F.sm, fontWeight: '700', color: C.t2 },
  headlineLabel:   { fontSize: F.xs, color: C.t3, fontWeight: '700' },
  headlineValue:   { fontSize: F.h1, fontWeight: '900', marginTop: 2 },

  section: {
    backgroundColor: C.white, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10, ...SH.sm,
  },
  sectionTitle: { fontSize: F.sm, fontWeight: '900', color: C.t2, marginBottom: 6 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowKey: { fontSize: F.sm, color: C.t3, fontWeight: '600' },
  rowVal: { fontSize: F.body, fontWeight: '700', color: C.t1, textAlign: 'right', flexShrink: 1 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 6 },

  warnBox: {
    flexDirection: 'row', gap: 10,
    backgroundColor: C.warnS, borderRadius: R.md,
    borderLeftWidth: 4, borderLeftColor: C.warn2,
    padding: 12, marginBottom: 10,
  },
  warnTitle: { fontSize: F.sm, fontWeight: '900', color: C.warn },
  warnDesc:  { fontSize: F.xs, color: C.t2, marginTop: 3 },

  sortRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  sortChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: R.full, backgroundColor: C.bg3,
  },
  sortChipActive: { backgroundColor: C.red },
  sortChipTxt:    { fontSize: F.xxs, fontWeight: '800', color: C.t2 },

  partHeader: {
    flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  partHeadCell: { fontSize: F.xxs, color: C.t3, fontWeight: '800' },
  partRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  partCell:  { fontSize: F.sm, color: C.t1, fontWeight: '700' },
  partNameTxt: { fontSize: F.sm, fontWeight: '800', color: C.t1 },
  partSub:   { fontSize: 10, color: C.t3, marginTop: 2 },
  customTag: { backgroundColor: C.red + '22', borderRadius: 3, paddingHorizontal: 4 },
  customTagTxt: { color: C.red, fontSize: 9, fontWeight: '900' },
});
