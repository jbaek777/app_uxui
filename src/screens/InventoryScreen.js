import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert,
} from 'react-native';
import { colors, fontSize, spacing, radius, shadow } from '../theme';
import { PrimaryBtn, OutlineBtn, AlertBox } from '../components/UI';
import { GaugeBar } from '../components/GaugeBar';
import { meatInventory as initMeat, inventoryData } from '../data/mockData';

const TABS = ['재고 현황', '수율 계산기', '소비기한'];

export default function InventoryScreen() {
  const [tab, setTab] = useState(0);
  const [meat, setMeat] = useState(initMeat);

  const critical = meat.filter(m => m.dday <= 1);

  return (
    <View style={styles.container}>
      {/* 탭 */}
      <View style={styles.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === i && styles.tabActive]} onPress={() => setTab(i)}>
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 0 && <StockTab meat={meat} setMeat={setMeat} critical={critical} />}
      {tab === 1 && <YieldTab />}
      {tab === 2 && <ExpiryTab meat={meat} />}
    </View>
  );
}

// ── 재고 현황 탭 ──────────────────────────────────────────
function StockTab({ meat, setMeat, critical }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cut: '', origin: '', qty: '', buyPrice: '', expire: '' });

  const totalValue = meat.reduce((s, m) => s + m.qty * m.buyPrice, 0);

  const handleAdd = () => {
    if (!form.cut || !form.qty) { Alert.alert('입력 오류', '부위명과 중량을 입력해주세요.'); return; }
    const qty = parseFloat(form.qty) || 0;
    const dday = form.expire ? Math.ceil((new Date(form.expire) - new Date()) / 86400000) : 99;
    setMeat([...meat, {
      id: Date.now().toString(), cut: form.cut, origin: form.origin || '미입력',
      qty, unit: 'kg', buyPrice: parseInt(form.buyPrice) || 0,
      sellPrice: Math.round((parseInt(form.buyPrice) || 0) * 1.6),
      expire: form.expire, dday, status: dday <= 0 ? 'critical' : dday <= 2 ? 'low' : 'ok',
    }]);
    setModal(false);
    setForm({ cut: '', origin: '', qty: '', buyPrice: '', expire: '' });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 요약 */}
      <View style={styles.summaryRow}>
        <SummaryBox icon="📦" label="총 부위" value={`${meat.length}종`} color={colors.a2} />
        <SummaryBox icon="⚠️" label="임박 항목" value={`${critical.length}건`} color={critical.length ? colors.rd : colors.gn} />
        <SummaryBox icon="💰" label="재고 가치" value={`${(totalValue / 10000).toFixed(0)}만원`} color={colors.gn} />
      </View>

      {critical.length > 0 && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <AlertBox type="error" icon="🚨" title="소비기한 임박" message={critical.map(m => m.cut).join(', ')} />
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {meat.map(item => (
          <View key={item.id} style={styles.meatCard}>
            <GaugeBar
              label={item.cut}
              sub={`${item.origin} · 매입가 ${item.buyPrice.toLocaleString()}원/kg`}
              value={item.qty}
              max={20}
              unit="kg"
              dday={item.dday}
              height={14}
            />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>매입가</Text>
              <Text style={[styles.priceVal, { color: colors.t2 }]}>{item.buyPrice.toLocaleString()}원</Text>
              <Text style={styles.priceLabel}>권장 판매가</Text>
              <Text style={[styles.priceVal, { color: colors.a2 }]}>{item.sellPrice.toLocaleString()}원</Text>
            </View>
          </View>
        ))}

        <PrimaryBtn label="+ 재고 추가" onPress={() => setModal(true)} color={colors.a2} style={{ marginTop: spacing.sm }} />
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>재고 추가</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {[
              { label: '부위명 *', key: 'cut', placeholder: '예: 등심' },
              { label: '원산지·등급', key: 'origin', placeholder: '예: 한우 1+' },
              { label: '중량 (kg) *', key: 'qty', placeholder: '0.0', keyboardType: 'numeric' },
              { label: '매입가 (원/kg)', key: 'buyPrice', placeholder: '0', keyboardType: 'numeric' },
              { label: '소비기한 (YYYY-MM-DD)', key: 'expire', placeholder: '2026-04-01' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: spacing.md }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput style={styles.input} value={form[f.key]}
                  onChangeText={t => setForm({ ...form, [f.key]: t })}
                  placeholder={f.placeholder} placeholderTextColor={colors.t3}
                  keyboardType={f.keyboardType} />
              </View>
            ))}
            <PrimaryBtn label="등록 완료" onPress={handleAdd} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── 수율 계산기 탭 ────────────────────────────────────────
function YieldTab() {
  const [initWeight, setInitWeight] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const init = parseFloat(initWeight) || 0;
    const final = parseFloat(finalWeight) || 0;
    const price = parseFloat(buyPrice) || 0;
    if (!init || !final) { Alert.alert('입력 오류', '원육 중량과 정육 중량을 입력해주세요.'); return; }
    const yieldPct = (final / init * 100).toFixed(1);
    const realCost = price > 0 ? Math.round(price / (final / init)) : 0;
    const recommend = Math.round(realCost * 1.55);
    setResult({ yieldPct, realCost, recommend, loss: (init - final).toFixed(2) });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      <AlertBox type="info" icon="ℹ️" message="원육 중량과 정육 후 중량을 입력하면 수율과 실제 원가를 계산합니다." />

      <View style={{ marginBottom: spacing.md }}>
        <Text style={styles.fieldLabel}>원육 중량 (kg)</Text>
        <TextInput style={styles.inputLg} value={initWeight} onChangeText={setInitWeight}
          placeholder="예: 15.0" placeholderTextColor={colors.t3} keyboardType="numeric" />
      </View>
      <View style={{ marginBottom: spacing.md }}>
        <Text style={styles.fieldLabel}>정육 후 중량 (kg)</Text>
        <TextInput style={styles.inputLg} value={finalWeight} onChangeText={setFinalWeight}
          placeholder="예: 12.5" placeholderTextColor={colors.t3} keyboardType="numeric" />
      </View>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={styles.fieldLabel}>매입가 (원/kg, 선택)</Text>
        <TextInput style={styles.inputLg} value={buyPrice} onChangeText={setBuyPrice}
          placeholder="예: 98000" placeholderTextColor={colors.t3} keyboardType="numeric" />
      </View>

      <PrimaryBtn label="수율 계산하기" onPress={calculate} />

      {result && (
        <View style={styles.resultCard}>
          <ResultRow label="수율" value={`${result.yieldPct}%`} color={parseFloat(result.yieldPct) >= 80 ? colors.gn : colors.yw} big />
          <ResultRow label="손실 중량" value={`${result.loss}kg`} color={colors.rd} />
          {result.realCost > 0 && <>
            <ResultRow label="실제 원가" value={`${result.realCost.toLocaleString()}원/kg`} color={colors.a2} />
            <ResultRow label="권장 판매가 (마진 55%)" value={`${result.recommend.toLocaleString()}원/kg`} color={colors.gn} big />
          </>}
        </View>
      )}
    </ScrollView>
  );
}

// ── 소비기한 탭 ───────────────────────────────────────────
function ExpiryTab({ meat }) {
  const sorted = [...meat].sort((a, b) => a.dday - b.dday);
  const today = sorted.filter(m => m.dday === 0);
  const tomorrow = sorted.filter(m => m.dday === 1);
  const week = sorted.filter(m => m.dday > 1 && m.dday <= 7);
  const later = sorted.filter(m => m.dday > 7);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {today.length > 0 && <ExpiryGroup label="🔴 오늘 만료" items={today} color={colors.rd} />}
      {tomorrow.length > 0 && <ExpiryGroup label="🟡 내일 만료" items={tomorrow} color={colors.yw} />}
      {week.length > 0 && <ExpiryGroup label="🟠 이번 주" items={week} color={colors.a2} />}
      {later.length > 0 && <ExpiryGroup label="🟢 이후" items={later} color={colors.gn} />}
    </ScrollView>
  );
}

const ExpiryGroup = ({ label, items, color }) => (
  <View style={styles.expiryGroup}>
    <Text style={[styles.expiryGroupLabel, { color }]}>{label}</Text>
    {items.map(item => (
      <View key={item.id} style={styles.expiryRow}>
        <View style={[styles.expiryDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.expiryName}>{item.cut}</Text>
          <Text style={styles.expiryOrigin}>{item.origin}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.expiryQty, { color }]}>{item.qty}kg</Text>
          <Text style={styles.expiryDate}>{item.expire}</Text>
        </View>
      </View>
    ))}
  </View>
);

const SummaryBox = ({ icon, label, value, color }) => (
  <View style={styles.summaryBox}>
    <Text style={{ fontSize: 22, marginBottom: 5 }}>{icon}</Text>
    <Text style={[styles.summaryVal, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const ResultRow = ({ label, value, color, big }) => (
  <View style={styles.resultRow}>
    <Text style={styles.resultLabel}>{label}</Text>
    <Text style={[styles.resultVal, { color, fontSize: big ? fontSize.xl : fontSize.lg }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabBar: { flexDirection: 'row', backgroundColor: colors.s1, borderBottomWidth: 1, borderBottomColor: colors.bd },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.ac },
  tabText: { fontSize: fontSize.sm, color: colors.t3, fontWeight: '600' },
  tabTextActive: { color: colors.ac, fontWeight: '900' },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  summaryBox: { flex: 1, backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.sm, alignItems: 'center', ...shadow.sm },
  summaryVal: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 2 },
  summaryLabel: { fontSize: fontSize.xxs, color: colors.t3, fontWeight: '600', textAlign: 'center' },

  meatCard: { backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  priceLabel: { fontSize: fontSize.xxs, color: colors.t3 },
  priceVal: { fontSize: fontSize.sm, fontWeight: '800' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.bd, backgroundColor: colors.s1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900', color: colors.tx },
  closeBtn: { fontSize: 22, color: colors.t2, padding: 4 },
  fieldLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: colors.s2, borderWidth: 1.5, borderColor: colors.bd, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.sm, color: colors.tx, minHeight: 52 },

  inputLg: { backgroundColor: colors.s1, borderWidth: 1.5, borderColor: colors.bd, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 18, fontSize: fontSize.xl, color: colors.tx, fontWeight: '700', textAlign: 'center', minHeight: 64 },

  resultCard: { backgroundColor: colors.s1, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bd, padding: spacing.lg, marginTop: spacing.lg, ...shadow.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.bd },
  resultLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '600' },
  resultVal: { fontWeight: '900' },

  expiryGroup: { marginBottom: spacing.lg },
  expiryGroupLabel: { fontSize: fontSize.sm, fontWeight: '900', marginBottom: spacing.sm, letterSpacing: 0.5 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.s1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.bd, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  expiryDot: { width: 10, height: 10, borderRadius: 5 },
  expiryName: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  expiryOrigin: { fontSize: fontSize.xs, color: colors.t3, marginTop: 2 },
  expiryQty: { fontSize: fontSize.md, fontWeight: '900' },
  expiryDate: { fontSize: fontSize.xs, color: colors.t3, marginTop: 2 },
});
