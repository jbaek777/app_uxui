import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { PrimaryBtn, OutlineBtn } from '../components/UI';
import { todaySales as initSales, meatInventory as initMeat } from '../data/mockData';
import { genClosingHTML, printAndShare } from '../lib/pdfTemplate';
import { closingStore, meatStore } from '../lib/dataStore';

export default function ClosingScreen() {
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
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* V5 Header */}
      <View style={styles.header}>
        <View style={styles.headerAccent} />
        <View style={styles.headerContent}>
          <View style={styles.brandIcon}>
            <Ionicons name="calculator-outline" size={18} color={C.white} />
          </View>
          <Text style={styles.headerTitle}>정산</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>

        {/* 총매출 히어로 */}
        <View style={[styles.heroCard, { backgroundColor: C.red }]}>
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
        <View style={[styles.section, { backgroundColor: C.white, borderColor: C.border }]}>
          <View style={[styles.sectionAccent, { backgroundColor: C.red2 }]} />
          <View style={styles.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="receipt-outline" size={18} color={C.red2} />
              <Text style={[styles.sectionTitle, { color: C.t1 }]}>판매 내역</Text>
            </View>
            <TouchableOpacity style={[styles.addBtn, { borderColor: C.red2 + '50', backgroundColor: C.red2 + '15' }]} onPress={() => setModal(true)}>
              <Ionicons name="add-circle-outline" size={16} color={C.red2} style={{ marginRight: 4 }} />
              <Text style={[styles.addBtnText, { color: C.red2 }]}>추가</Text>
            </TouchableOpacity>
          </View>
          {sales.map(r => (
            <View key={r.id} style={[styles.saleRow, { borderBottomColor: C.border + '50' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.saleCut, { color: C.t1 }]}>{r.cut}</Text>
                <Text style={[styles.saleMeta, { color: C.t3 }]}>{r.time} · {r.qty}kg × {r.price.toLocaleString()}원</Text>
              </View>
              <Text style={[styles.saleTotal, { color: C.red2 }]}>{r.total.toLocaleString()}원</Text>
            </View>
          ))}
        </View>

        {/* 폐기 내역 */}
        <View style={[styles.section, { backgroundColor: C.white, borderColor: C.border }]}>
          <View style={[styles.sectionAccent, { backgroundColor: C.red }]} />
          <View style={styles.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trash-outline" size={18} color={C.red} />
              <Text style={[styles.sectionTitle, { color: C.t1 }]}>폐기 내역</Text>
            </View>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: C.red + '20', borderColor: C.red + '40' }]}
              onPress={() => setWasteModal(true)}>
              <Ionicons name="add-circle-outline" size={16} color={C.red} style={{ marginRight: 4 }} />
              <Text style={[styles.addBtnText, { color: C.red }]}>폐기 등록</Text>
            </TouchableOpacity>
          </View>
          {waste.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="checkmark-circle-outline" size={28} color={C.t4} style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyText, { color: C.t3 }]}>폐기 항목 없음</Text>
            </View>
          ) : (
            waste.map(w => (
              <View key={w.id} style={[styles.wasteRow, { borderBottomColor: C.border + '50' }]}>
                <Text style={[styles.wasteCut, { color: C.t1 }]}>{w.cut}</Text>
                <Text style={[styles.wasteMeta, { color: C.t3 }]}>{w.qty}kg · {w.reason || '사유 미입력'}</Text>
                <Text style={[styles.wasteVal, { color: C.red }]}>
                  <Ionicons name="warning-outline" size={12} color={C.red} /> 손실 추정 {(parseFloat(w.qty) * (parseFloat(w.price) || 5000)).toLocaleString()}원
                </Text>
              </View>
            ))
          )}
          {waste.length > 0 && (
            <View style={styles.wasteSummary}>
              <Text style={[styles.wasteSumLabel, { color: C.t2 }]}>총 손실 추정</Text>
              <Text style={[styles.wasteSumVal, { color: C.red }]}>{wasteTotal.toLocaleString()}원</Text>
            </View>
          )}
        </View>

        {/* 잔여 재고 */}
        <View style={[styles.section, { backgroundColor: C.white, borderColor: C.border }]}>
          <View style={[styles.sectionAccent, { backgroundColor: C.ok2 }]} />
          <View style={styles.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cube-outline" size={18} color={C.ok2} />
              <Text style={[styles.sectionTitle, { color: C.t1 }]}>잔여 재고</Text>
            </View>
          </View>
          {(realMeat.length > 0 ? realMeat : initMeat.filter(m => !m.sold)).map(m => (
            <View key={m.id} style={[styles.stockRow, { borderBottomColor: C.border + '40' }]}>
              <Text style={[styles.stockCut, { color: C.t1 }]}>{m.cut}</Text>
              <Text style={[styles.stockOrigin, { color: C.t3 }]}>{m.origin}</Text>
              <Text style={[styles.stockQty, { color: m.qty < 5 ? C.red : C.ok2 }]}>{m.qty}kg</Text>
            </View>
          ))}
          <View style={{ height: 10 }} />
        </View>

        <PrimaryBtn
          label="정산 PDF 저장"
          icon={<Ionicons name="document-text-outline" size={18} color={C.white} style={{ marginRight: 6 }} />}
          color={C.pur}
          style={{ marginTop: 16 }}
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
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border, backgroundColor: C.white }]}>
            <Text style={[styles.modalTitle, { color: C.t1 }]}>판매 추가</Text>
            <TouchableOpacity onPress={() => setModal(false)} style={styles.closeBtnWrap}>
              <Ionicons name="close" size={24} color={C.t2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {[
              { label: '부위명', key: 'cut', placeholder: '예: 등심', icon: 'pricetag-outline' },
              { label: '판매 중량 (kg)', key: 'qty', placeholder: '0.0', keyboardType: 'numeric', icon: 'scale-outline' },
              { label: '판매 단가 (원/kg)', key: 'price', placeholder: '0', keyboardType: 'numeric', icon: 'cash-outline' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name={f.icon} size={15} color={C.t2} />
                  <Text style={[styles.fieldLabel, { color: C.t2 }]}>{f.label}</Text>
                </View>
                <TextInput style={[styles.input, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]} value={form[f.key]}
                  onChangeText={t => setForm({ ...form, [f.key]: t })}
                  placeholder={f.placeholder} placeholderTextColor={C.t3} keyboardType={f.keyboardType} />
              </View>
            ))}
            <PrimaryBtn label="저장" onPress={addSale} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* 폐기 모달 */}
      <Modal visible={wasteModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border, backgroundColor: C.white }]}>
            <Text style={[styles.modalTitle, { color: C.t1 }]}>폐기 등록</Text>
            <TouchableOpacity onPress={() => setWasteModal(false)} style={styles.closeBtnWrap}>
              <Ionicons name="close" size={24} color={C.t2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {[
              { label: '부위명', key: 'cut', placeholder: '예: 안심', icon: 'pricetag-outline' },
              { label: '폐기량 (kg)', key: 'qty', placeholder: '0.0', keyboardType: 'numeric', icon: 'scale-outline' },
              { label: '폐기 사유', key: 'reason', placeholder: '예: 소비기한 경과', icon: 'alert-circle-outline' },
              { label: '매입가 (원/kg, 선택)', key: 'price', placeholder: '미입력 시 5,000원 기준', keyboardType: 'numeric', icon: 'cash-outline' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name={f.icon} size={15} color={C.t2} />
                  <Text style={[styles.fieldLabel, { color: C.t2 }]}>{f.label}</Text>
                </View>
                <TextInput style={[styles.input, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]} value={wasteForm[f.key]}
                  onChangeText={t => setWasteForm({ ...wasteForm, [f.key]: t })}
                  placeholder={f.placeholder} placeholderTextColor={C.t3} keyboardType={f.keyboardType} />
              </View>
            ))}
            <PrimaryBtn label="저장" onPress={addWaste} color={C.red} />
            <OutlineBtn label="취소" onPress={() => setWasteModal(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // V5 Header
  header: { backgroundColor: C.white, ...SH.sm },
  headerAccent: { height: 3, backgroundColor: C.red },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  brandIcon: { width: 33, height: 33, borderRadius: R.sm, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.t1 },

  // Hero card
  heroCard: { borderRadius: R.xl, padding: 20, marginBottom: 20, overflow: 'hidden', ...SH.md },
  heroLabel: { fontSize: F.xxs, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: 10, letterSpacing: 1 },
  heroValue: { fontSize: F.hero + 2, fontWeight: '900', color: '#fff', marginBottom: 20, letterSpacing: -1, lineHeight: 48 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.md, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroStat: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  heroStatVal: { fontSize: F.body, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroStatLabel: { fontSize: F.xxs, color: 'rgba(255,255,255,0.5)', fontWeight: '600', lineHeight: 14 },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Sections
  section: { borderRadius: R.lg, borderWidth: 1, marginBottom: 16, overflow: 'hidden', ...SH.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 10 },
  sectionTitle: { fontSize: F.h3, fontWeight: '800' },
  sectionAccent: { height: 4, width: '100%' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: 1.5 },
  addBtnText: { fontSize: F.sm, fontWeight: '800' },

  // Sales
  saleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  saleCut: { fontSize: F.body, fontWeight: '700', marginBottom: 3 },
  saleMeta: { fontSize: F.sm },
  saleTotal: { fontSize: F.h3, fontWeight: '900' },

  // Waste
  wasteRow: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  wasteCut: { fontSize: F.body, fontWeight: '700' },
  wasteMeta: { fontSize: F.sm, marginTop: 2 },
  wasteVal: { fontSize: F.sm, fontWeight: '700', marginTop: 3 },
  wasteSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 10, paddingHorizontal: 16, paddingBottom: 16 },
  wasteSumLabel: { fontSize: F.body, fontWeight: '700' },
  wasteSumVal: { fontSize: F.h3, fontWeight: '900' },
  emptyText: { fontSize: F.body, textAlign: 'center' },

  // Stock
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 10, borderBottomWidth: 1 },
  stockCut: { fontSize: F.body, fontWeight: '700', flex: 1 },
  stockOrigin: { fontSize: F.sm },
  stockQty: { fontSize: F.body, fontWeight: '900' },

  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: F.h2, fontWeight: '900' },
  closeBtnWrap: { padding: 4 },
  fieldLabel: { fontSize: F.body, fontWeight: '700' },
  input: { borderWidth: 1.5, borderRadius: R.sm, padding: 16, fontSize: F.body, minHeight: 56 },
});
