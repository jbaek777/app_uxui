import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { todaySales as initSales, meatInventory as initMeat } from '../data/mockData';
import { genClosingHTML, printAndShare } from '../lib/pdfTemplate';
import { closingStore, meatStore } from '../lib/dataStore';

export default function ClosingScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [sales, setSales] = useState(initSales);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cut: '', qty: '', price: '' });
  const [waste, setWaste] = useState([]);
  const [wasteModal, setWasteModal] = useState(false);
  const [wasteForm, setWasteForm] = useState({ cut: '', qty: '', reason: '', price: '' });
  const [realMeat, setRealMeat] = useState([]);

  useEffect(() => {
    meatStore.load(initMeat).then(data => setRealMeat(data.filter(m => !m.sold)));
  }, []);

  const totalSales = sales.reduce((s, r) => s + r.total, 0);
  const totalCost = sales.reduce((s, r) => {
    const item = (realMeat.length > 0 ? realMeat : initMeat).find(m => m.cut === r.cut);
    return s + (item ? item.buyPrice * r.qty : 0);
  }, 0);
  const margin = totalCost > 0 ? ((totalSales - totalCost) / totalSales * 100).toFixed(1) : 0;
  const wasteTotal = waste.reduce((s, w) => {
    const price = parseFloat(w.price) || 5000;
    return s + (parseFloat(w.qty) || 0) * price;
  }, 0);

  const addSale = () => {
    if (!form.cut || !form.qty || !form.price) { Alert.alert('입력 오류', '부위, 중량, 단가를 모두 입력해주세요.'); return; }
    const qty = parseFloat(form.qty) || 0;
    const price = Math.round(parseFloat(form.price) || 0);
    setSales([...sales, {
      id: Date.now().toString(),
      cut: form.cut,
      origin: '—',
      qty,
      unit: 'kg',
      price,
      total: Math.round(qty * price),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setModal(false);
    setForm({ cut: '', qty: '', price: '' });
  };

  const addWaste = () => {
    if (!wasteForm.cut || !wasteForm.qty) { Alert.alert('입력 오류', '부위와 폐기량을 입력해주세요.'); return; }
    setWaste([...waste, { ...wasteForm, id: Date.now().toString() }]);
    setWasteModal(false);
    setWasteForm({ cut: '', qty: '', reason: '', price: '' });
  };

  return (
    <View style={[styles.container, { backgroundColor: pal.bg }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>

        {/* 총매출 히어로 */}
        <View style={[styles.heroCard, { backgroundColor: pal.ac }]}>
          <Text style={styles.heroLabel}>오늘 총매출</Text>
          <Text style={styles.heroValue}>{totalSales.toLocaleString()}원</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{margin}%</Text>
              <Text style={styles.heroStatLabel}>추정 마진</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{totalCost.toLocaleString()}원</Text>
              <Text style={styles.heroStatLabel}>추정 원가</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{sales.length}건</Text>
              <Text style={styles.heroStatLabel}>판매 건수</Text>
            </View>
          </View>
        </View>

        {/* 판매 내역 */}
        <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <View style={[styles.sectionAccent, { backgroundColor: pal.a2 }]} />
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: pal.tx }]}>판매 내역</Text>
            <TouchableOpacity style={[styles.addBtn, { borderColor: pal.a2 + '50', backgroundColor: pal.a2 + '15' }]} onPress={() => setModal(true)}>
              <Text style={[styles.addBtnText, { color: pal.a2 }]}>+ 추가</Text>
            </TouchableOpacity>
          </View>
          {sales.map(r => (
            <View key={r.id} style={[styles.saleRow, { borderBottomColor: pal.bd + '50' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.saleCut, { color: pal.tx }]}>{r.cut}</Text>
                <Text style={[styles.saleMeta, { color: pal.t3 }]}>{r.time} · {r.qty}kg × {r.price.toLocaleString()}원</Text>
              </View>
              <Text style={[styles.saleTotal, { color: pal.a2 }]}>{r.total.toLocaleString()}원</Text>
            </View>
          ))}
        </View>

        {/* 폐기 내역 */}
        <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <View style={[styles.sectionAccent, { backgroundColor: pal.rd }]} />
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: pal.tx }]}>폐기 내역</Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: pal.rd + '20', borderColor: pal.rd + '40' }]}
              onPress={() => setWasteModal(true)}>
              <Text style={[styles.addBtnText, { color: pal.rd }]}>+ 폐기 등록</Text>
            </TouchableOpacity>
          </View>
          {waste.length === 0 ? (
            <Text style={[styles.emptyText, { color: pal.t3 }]}>폐기 항목 없음</Text>
          ) : (
            waste.map(w => (
              <View key={w.id} style={[styles.wasteRow, { borderBottomColor: pal.bd + '50' }]}>
                <Text style={[styles.wasteCut, { color: pal.tx }]}>{w.cut}</Text>
                <Text style={[styles.wasteMeta, { color: pal.t3 }]}>{w.qty}kg · {w.reason || '사유 미입력'}</Text>
                <Text style={[styles.wasteVal, { color: pal.rd }]}>손실 추정 {(parseFloat(w.qty) * (parseFloat(w.price) || 5000)).toLocaleString()}원</Text>
              </View>
            ))
          )}
          {waste.length > 0 && (
            <View style={styles.wasteSummary}>
              <Text style={[styles.wasteSumLabel, { color: pal.t2 }]}>총 손실 추정</Text>
              <Text style={[styles.wasteSumVal, { color: pal.rd }]}>{wasteTotal.toLocaleString()}원</Text>
            </View>
          )}
        </View>

        {/* 잔여 재고 */}
        <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <View style={[styles.sectionAccent, { backgroundColor: pal.gn }]} />
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: pal.tx }]}>잔여 재고</Text>
          </View>
          {(realMeat.length > 0 ? realMeat : initMeat.filter(m => !m.sold)).map(m => (
            <View key={m.id} style={[styles.stockRow, { borderBottomColor: pal.bd + '40' }]}>
              <Text style={[styles.stockCut, { color: pal.tx }]}>{m.cut}</Text>
              <Text style={[styles.stockOrigin, { color: pal.t3 }]}>{m.origin}</Text>
              <Text style={[styles.stockQty, { color: m.qty < 5 ? pal.rd : pal.gn }]}>{m.qty}kg</Text>
            </View>
          ))}
          <View style={{ height: spacing.sm }} />
        </View>

        <PrimaryBtn
          label="📊 정산 PDF 저장"
          color={pal.pu}
          style={{ marginTop: spacing.md }}
          onPress={async () => {
            await closingStore.save({
              sales: sales,
              waste: waste,
              total_revenue: totalSales,
              total_cost: totalCost,
              total_waste: wasteTotal,
            });
            let biz = null;
            try { const raw = await AsyncStorage.getItem('@meatbig_biz'); if (raw) biz = JSON.parse(raw); } catch (_) {}
            const html = genClosingHTML(sales, waste, realMeat.length > 0 ? realMeat : initMeat.filter(m => !m.sold), biz);
            await printAndShare(html, '일일마감정산서');
          }}
        />

      </ScrollView>

      {/* 판매 추가 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: pal.bd, backgroundColor: pal.s1 }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>판매 추가</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {[
              { label: '부위명', key: 'cut', placeholder: '예: 등심' },
              { label: '판매 중량 (kg)', key: 'qty', placeholder: '0.0', keyboardType: 'numeric' },
              { label: '판매 단가 (원/kg)', key: 'price', placeholder: '0', keyboardType: 'numeric' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: pal.t2 }]}>{f.label}</Text>
                <TextInput style={[styles.input, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]} value={form[f.key]}
                  onChangeText={t => setForm({ ...form, [f.key]: t })}
                  placeholder={f.placeholder} placeholderTextColor={pal.t3} keyboardType={f.keyboardType} />
              </View>
            ))}
            <PrimaryBtn label="저장" onPress={addSale} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>

      {/* 폐기 모달 */}
      <Modal visible={wasteModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: pal.bd, backgroundColor: pal.s1 }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>폐기 등록</Text>
            <TouchableOpacity onPress={() => setWasteModal(false)}><Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {[
              { label: '부위명', key: 'cut', placeholder: '예: 안심' },
              { label: '폐기량 (kg)', key: 'qty', placeholder: '0.0', keyboardType: 'numeric' },
              { label: '폐기 사유', key: 'reason', placeholder: '예: 소비기한 경과' },
              { label: '매입가 (원/kg, 선택)', key: 'price', placeholder: '미입력 시 5,000원 기준', keyboardType: 'numeric' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: pal.t2 }]}>{f.label}</Text>
                <TextInput style={[styles.input, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]} value={wasteForm[f.key]}
                  onChangeText={t => setWasteForm({ ...wasteForm, [f.key]: t })}
                  placeholder={f.placeholder} placeholderTextColor={pal.t3} keyboardType={f.keyboardType} />
              </View>
            ))}
            <PrimaryBtn label="저장" onPress={addWaste} color={pal.rd} />
            <OutlineBtn label="취소" onPress={() => setWasteModal(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  heroCard: { borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, overflow: 'hidden' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: 10, letterSpacing: 1 },
  heroValue: { fontSize: 42, fontWeight: '900', color: '#fff', marginBottom: 20, letterSpacing: -1, lineHeight: 48 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroStat: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  heroStatVal: { fontSize: fontSize.md, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', lineHeight: 14 },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  section: { borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.md, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '800' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1.5 },
  addBtnText: { fontSize: fontSize.xs, fontWeight: '800' },

  saleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  saleCut: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 3 },
  saleMeta: { fontSize: fontSize.xs },
  saleTotal: { fontSize: fontSize.md, fontWeight: '900' },

  wasteRow: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
  wasteCut: { fontSize: fontSize.sm, fontWeight: '700' },
  wasteMeta: { fontSize: fontSize.xs, marginTop: 2 },
  wasteVal: { fontSize: fontSize.xs, fontWeight: '700', marginTop: 3 },
  wasteSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  wasteSumLabel: { fontSize: fontSize.sm, fontWeight: '700' },
  wasteSumVal: { fontSize: fontSize.md, fontWeight: '900' },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },

  sectionAccent: { height: 4, width: '100%' },

  stockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm, borderBottomWidth: 1 },
  stockCut: { fontSize: fontSize.sm, fontWeight: '700', flex: 1 },
  stockOrigin: { fontSize: fontSize.xs },
  stockQty: { fontSize: fontSize.sm, fontWeight: '900' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900' },
  closeBtn: { fontSize: 22, padding: 4 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1.5, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.md, minHeight: 56 },
});
