import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { C, F, R, SH } from '../lib/v5';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn, AlertBox } from '../components/UI';
import { GaugeBar } from '../components/GaugeBar';
import { meatInventory as initMeat } from '../data/mockData';
import { meatStore, salesStore, expiryLogStore, yieldStore, supplierStore } from '../lib/dataStore';

const TABS = ['재고 현황', '판매내역', '수율 계산기', '소비기한', '거래처'];

export default function InventoryScreen({ navigation }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [tab, setTab] = useState(0);
  const [meat, setMeat] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isFirst = useRef(true);
  const isFirstSupplier = useRef(true);

  // 앱 실행 시 데이터 로드 (Supabase → AsyncStorage → mockData)
  useEffect(() => {
    meatStore.load(initMeat.map(m => ({ ...m, editCount: 0, editLog: [] })))
      .then(data => {
        const now = new Date();
        const refreshed = data.map(m => {
          if (!m.expire) return m;
          const dday = Math.ceil((new Date(m.expire) - now) / 86400000);
          return { ...m, dday, status: dday <= 0 ? 'critical' : dday <= 2 ? 'low' : 'ok' };
        });
        setMeat(refreshed);
        setLoaded(true);
      });
    supplierStore.load().then(setSuppliers);
  }, []);

  // 데이터 변경 시 자동 저장 (첫 로드 제외)
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (loaded && meat.length >= 0) {
      meatStore.save(meat);
    }
  }, [meat]);

  useEffect(() => {
    if (isFirstSupplier.current) { isFirstSupplier.current = false; return; }
    supplierStore.save(suppliers);
  }, [suppliers]);

  const getDdaySafe = m => m.dday != null ? m.dday : (m.d_day != null ? m.d_day : 99);
  const critical = meat.filter(m => getDdaySafe(m) <= 1 && !m.sold);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── V5 헤더 ── */}
      <View style={[styles.v5Header]}>
        <View style={styles.v5HeaderAccent} />
        <View style={styles.v5HeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View style={{ width: 33, height: 33, borderRadius: R.sm, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cube" size={17} color="#fff" />
            </View>
            <Text style={styles.v5PageTitle}>재고 관리</Text>
          </View>
        </View>
      </View>
      {/* 탭 바 — 5개이므로 가로 스크롤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBarScroll, { backgroundColor: C.white, borderBottomColor: C.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === i && { borderBottomColor: C.red }]}
            onPress={() => setTab(i)}
          >
            <Text style={[styles.tabText, { color: tab === i ? C.red : C.t3 }, tab === i && styles.tabTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 0 && <StockTab meat={meat} setMeat={setMeat} critical={critical} suppliers={suppliers} navigation={navigation} />}
      {tab === 1 && <SoldHistoryTab meat={meat} />}
      {tab === 2 && <YieldTab />}
      {tab === 3 && <ExpiryTab meat={meat} setMeat={setMeat} />}
      {tab === 4 && <SupplierTab suppliers={suppliers} setSuppliers={setSuppliers} meat={meat} />}
    </View>
  );
}

// ── 재고 현황 탭 ──────────────────────────────────────────
const FILTER_CHIPS = ['전체', '임박', '한우', '수입육'];

function StockTab({ meat, setMeat, critical, suppliers, navigation }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [modal, setModal] = useState(false);
  const [modePicker, setModePicker] = useState(false);
  const [supplierPicker, setSupplierPicker] = useState(false);
  const [form, setForm] = useState({ cut: '', origin: '', qty: '', buyPrice: '', sellPrice: '', expire: '', supplierId: '', supplierName: '' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('전체');

  const activeItems = meat.filter(m => !m.sold);
  const soldItems   = meat.filter(m => m.sold);
  const totalValue  = activeItems.reduce((s, m) => s + (m.qty || 0) * (m.buyPrice || 0), 0);
  const lossRisk    = activeItems.filter(m => (m.dday ?? 99) <= 3).reduce((s, m) => s + (m.qty || 0) * (m.buyPrice || 0), 0);

  // 검색 + 필터 적용
  const filteredItems = activeItems.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.cut?.toLowerCase().includes(q) || item.origin?.toLowerCase().includes(q);
    const dday = item.dday ?? 99;
    const matchFilter =
      filter === '전체' ? true :
      filter === '임박' ? dday <= 7 :
      filter === '한우' ? (item.origin || '').includes('한우') :
      filter === '수입육' ? !(item.origin || '').includes('한우') : true;
    return matchSearch && matchFilter;
  });

  const handleAdd = () => {
    if (!form.cut || !form.qty) { Alert.alert('입력 오류', '부위명과 중량을 입력해주세요.'); return; }
    const qty  = parseFloat(form.qty) || 0;
    const buy  = Math.round(parseFloat(form.buyPrice) || 0);
    const sell = Math.round(parseFloat(form.sellPrice) || (buy > 0 ? buy * 1.55 : 0));
    const dday = form.expire ? Math.ceil((new Date(form.expire) - new Date()) / 86400000) : 99;
    const today = new Date().toLocaleDateString('ko-KR');
    setMeat([...meat, {
      id: Date.now().toString(), cut: form.cut, origin: form.origin || '미입력',
      qty, unit: 'kg', buyPrice: buy, sellPrice: sell,
      expire: form.expire, dday,
      status: dday <= 0 ? 'critical' : dday <= 2 ? 'low' : 'ok',
      sold: false, soldDate: null, editCount: 0, editLog: [],
      supplierId: form.supplierId, supplierName: form.supplierName,
      inboundDate: today,
    }]);
    setModal(false);
    setForm({ cut: '', origin: '', qty: '', buyPrice: '', sellPrice: '', expire: '', supplierId: '', supplierName: '' });
  };

  const handleSold = (id) => {
    Alert.alert('판매 완료 처리', '해당 재고를 판매완료 목록으로 이동할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '판매완료', style: 'default',
        onPress: () => {
          const item = meat.find(m => m.id === id);
          if (item) salesStore.addSale(item);
          setMeat(prev => prev.map(m =>
            m.id === id
              ? { ...m, sold: true, soldDate: new Date().toLocaleDateString('ko-KR') }
              : m
          ));
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 2×2 요약 그리드 */}
        <View style={styles.summaryGrid}>
          <SummaryBox ionicon="cube-outline" label="재고 부위"  value={`${activeItems.length}종`}                                       color={C.red} />
          <SummaryBox ionicon="checkmark-circle-outline" label="판매완료"   value={`${soldItems.length}건`}                                          color={C.ok2} />
          <SummaryBox ionicon="cash-outline" label="재고 가치"  value={`${(totalValue / 10000).toFixed(0)}만원`}                         color={C.blue2} />
          <SummaryBox
            ionicon={lossRisk > 0 ? 'alert-circle-outline' : 'shield-checkmark-outline'}
            label="손실위험"
            value={lossRisk > 0 ? `-${(lossRisk / 10000).toFixed(0)}만원` : '없음'}
            color={lossRisk > 0 ? C.red : C.ok2}
          />
        </View>

        {critical.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <AlertBox type="error" icon="🚨" title="소비기한 임박" message={critical.map(m => m.cut).join(', ')} />
          </View>
        )}

        {/* 검색 + 필터 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={[styles.searchBar, { backgroundColor: C.white, borderColor: C.border }]}>
            <Ionicons name="search-outline" size={16} color={C.t4} style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.searchInput, { color: C.t1 }]}
              placeholder="부위, 원산지 검색..."
              placeholderTextColor={C.t3}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: C.t3, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
            {FILTER_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip}
                style={[styles.filterChip, filter === chip && { backgroundColor: C.red, borderColor: C.red }]}
                onPress={() => setFilter(chip)}
              >
                <Text style={[styles.filterChipText, { color: filter === chip ? '#fff' : C.t2 }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ padding: 16 }}>
        {activeItems.length === 0 && (
          <View style={[styles.stockEmptyBox, { backgroundColor: C.white, borderColor: C.border }]}>
            <Ionicons name="cube-outline" size={52} color={C.t4} style={{ marginBottom: 16 }} />
            <Text style={[styles.stockEmptyTitle, { color: C.t1 }]}>등록된 재고가 없습니다</Text>
            <Text style={[styles.stockEmptyDesc, { color: C.t3 }]}>
              + 재고 추가 버튼으로 첫 재고를 등록하면{'\n'}매입가·소비기한·마진율이 자동으로 관리됩니다
            </Text>
            <View style={[styles.stockEmptyTip, { backgroundColor: C.redS, borderColor: C.redS2 }]}>
              <Text style={[styles.stockEmptyTipText, { color: C.red }]}>
                <Ionicons name="bulb-outline" size={12} color={C.red} /> 거래명세서를 OCR 스캔하면{'\n'}부위·중량·원산지가 자동으로 채워집니다
              </Text>
            </View>
            <View style={[styles.stockEmptyTip, { backgroundColor: C.okS, borderColor: C.ok2 + '30', marginTop: 6 }]}>
              <Text style={[styles.stockEmptyTipText, { color: C.ok2 }]}>
                <Ionicons name="bar-chart-outline" size={12} color={C.ok2} /> 재고 등록 후 대시보드에서 마진 분석을 확인하세요
              </Text>
            </View>
          </View>
        )}

        {filteredItems.length === 0 && activeItems.length > 0 && (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: C.t3 }]}>검색 결과가 없습니다</Text>
          </View>
        )}

        {filteredItems.map(item => {
          const dday  = item.dday ?? 99;
          const ddayColor = dday <= 2 ? C.red : dday <= 7 ? C.warn2 : C.ok2;
          const ddayLabel = dday <= 0 ? '만료' : dday >= 90 ? '여유' : `D-${dday}`;
          const grade = item.grade || (item.origin?.match(/1\+\+|1\+|1|2|3/) || [''])[0] || '—';
          const isKorean = (item.origin || '').includes('한우') || (item.origin || '').includes('국내산');
          const gradeColor = ['1++', 'A++'].includes(grade) ? C.red : grade === '1+' ? C.red2 : isKorean ? C.t1 : C.blue2;
          const marginPct = item.buyPrice > 0 && item.sellPrice > 0
            ? Math.round((item.sellPrice - item.buyPrice) / item.buyPrice * 100) : null;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.meatCard, { backgroundColor: C.white, borderColor: C.border, borderLeftColor: ddayColor, borderLeftWidth: 4 }]}
              activeOpacity={0.85}
            >
              {/* 카드 상단: 등급 박스 | 부위명 + 원산지 | D-day + 중량 */}
              <View style={styles.cardTopRow}>
                {/* 등급 박스 */}
                <View style={[styles.gradeBox, { backgroundColor: gradeColor + '18', borderColor: gradeColor + '40' }]}>
                  <Text style={[styles.gradeText, { color: gradeColor }]} numberOfLines={1}>{grade}</Text>
                  <Text style={[styles.gradeType, { color: C.t3 }]}>{isKorean ? '한우' : '수입'}</Text>
                </View>
                {/* 이름 + 원산지 */}
                <View style={styles.cardMain}>
                  <Text style={[styles.cardName, { color: C.t1 }]} numberOfLines={1}>{item.cut}</Text>
                  <Text style={[styles.cardDetail, { color: C.t2 }]} numberOfLines={1}>
                    {item.origin} · 판매가 {item.sellPrice?.toLocaleString()}원/kg
                  </Text>
                  {item.supplierName ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                      <Ionicons name="storefront-outline" size={11} color={C.t3} />
                      <Text style={[styles.cardSupplier, { color: C.t3 }]}>{item.supplierName}</Text>
                    </View>
                  ) : null}
                </View>
                {/* D-day + 중량 */}
                <View style={styles.cardRight}>
                  <View style={[styles.ddayPill, { backgroundColor: ddayColor + '18', borderColor: ddayColor + '40' }]}>
                    <Text style={[styles.ddayText, { color: ddayColor }]}>{ddayLabel}</Text>
                  </View>
                  <Text style={[styles.cardQty, { color: C.t1 }]}>{item.qty}<Text style={{ color: C.t3, fontSize: F.xxs }}> kg</Text></Text>
                </View>
              </View>

              {/* 가격 + 마진 행 */}
              <View style={[styles.cardPriceRow, { borderTopColor: C.border + '60' }]}>
                <View style={styles.priceStatBox}>
                  <Text style={[styles.priceStatLabel, { color: C.t3 }]}>매입가</Text>
                  <Text style={[styles.priceStatVal, { color: C.t2 }]}>{item.buyPrice?.toLocaleString()}원</Text>
                </View>
                <View style={[styles.priceStatBox, { borderLeftWidth: 1, borderLeftColor: C.border + '50' }]}>
                  <Text style={[styles.priceStatLabel, { color: C.t3 }]}>판매가</Text>
                  <Text style={[styles.priceStatVal, { color: C.red }]}>{item.sellPrice?.toLocaleString()}원</Text>
                </View>
                {marginPct !== null && (
                  <View style={[styles.priceStatBox, { borderLeftWidth: 1, borderLeftColor: C.border + '50' }]}>
                    <Text style={[styles.priceStatLabel, { color: C.t3 }]}>마진</Text>
                    <Text style={[styles.priceStatVal, { color: marginPct >= 30 ? C.ok2 : C.warn2 }]}>+{marginPct}%</Text>
                  </View>
                )}
                {dday <= 3 && (
                  <View style={[styles.priceStatBox, { borderLeftWidth: 1, borderLeftColor: C.red + '40' }]}>
                    <Text style={[styles.priceStatLabel, { color: C.red }]}>손실위험</Text>
                    <Text style={[styles.priceStatVal, { color: C.red }]}>-{((item.qty * item.buyPrice) / 10000).toFixed(1)}만</Text>
                  </View>
                )}
              </View>

              {/* 판매 완료 버튼 */}
              <TouchableOpacity
                style={[styles.soldBtn, { borderTopColor: C.border + '60' }]}
                onPress={() => handleSold(item.id)}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="checkmark-circle" size={16} color={C.ok2} />
                  <Text style={[styles.soldBtnText, { color: C.ok2 }]}>판매 완료 처리</Text>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        </View>
      </ScrollView>

      {/* FAB: 재고 추가 (단일 / 계근 모드 선택) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: C.red }]}
        onPress={() => setModePicker(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabLabel}>재고 추가</Text>
      </TouchableOpacity>

      {/* 모드 선택 모달 (단일 vs 계근) */}
      <Modal visible={modePicker} transparent animationType="fade" onRequestClose={() => setModePicker(false)}>
        <TouchableOpacity
          style={styles.modePickOverlay}
          activeOpacity={1}
          onPress={() => setModePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modePickBox} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            <View style={styles.modePickHeader}>
              <Text style={styles.modePickTitle}>등록 방식 선택</Text>
              <TouchableOpacity onPress={() => setModePicker(false)}>
                <Ionicons name="close" size={22} color={C.t3} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modeBtn}
              onPress={() => { setModePicker(false); setModal(true); }}
              activeOpacity={0.85}
            >
              <View style={[styles.modeIconBox, { backgroundColor: C.blueS }]}>
                <Ionicons name="cube-outline" size={24} color={C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>단일 입고</Text>
                <Text style={styles.modeDesc}>부위 하나씩 — 부위명, 중량, 단가 직접 입력</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.t3} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeBtn}
              onPress={() => {
                setModePicker(false);
                if (navigation) navigation.navigate('CarcassWeighing');
                else Alert.alert('오류', '네비게이션 사용 불가');
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.modeIconBox, { backgroundColor: C.redS }]}>
                <Ionicons name="scale-outline" size={24} color={C.red} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.modeTitle}>계근 입고 (원두 분할)</Text>
                  <View style={styles.newTag}><Text style={styles.newTagTxt}>NEW</Text></View>
                </View>
                <Text style={styles.modeDesc}>소 한 마리 → 산피/지육/발골 3단 계근 → 39부위 자동 분할</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.t3} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeBtn}
              onPress={() => {
                setModePicker(false);
                if (navigation) navigation.navigate('CarcassHistory');
                else Alert.alert('오류', '네비게이션 사용 불가');
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.modeIconBox, { backgroundColor: C.blueS || '#DBEAFE' }]}>
                <Ionicons name="time-outline" size={24} color={C.blue || '#1D4ED8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeTitle}>계근 이력 보기</Text>
                <Text style={styles.modeDesc}>지난 계근 입고 세션 · 수율 · 손익 요약 열람</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.t3} />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border, backgroundColor: C.white }]}>
            <Text style={[styles.modalTitle, { color: C.t1 }]}>재고 추가</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.closeBtn, { color: C.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {[
              { label: '부위명 *',              key: 'cut',       placeholder: '예: 등심' },
              { label: '원산지·등급',           key: 'origin',    placeholder: '예: 한우 1+' },
              { label: '중량 (kg) *',           key: 'qty',       placeholder: '0.0',          keyboardType: 'numeric' },
              { label: '매입가 (원/kg)',         key: 'buyPrice',  placeholder: '0',            keyboardType: 'numeric' },
              { label: '판매가 (원/kg)',         key: 'sellPrice', placeholder: '비워두면 ×1.55 자동 적용', keyboardType: 'numeric' },
              { label: '소비기한 (YYYY-MM-DD)', key: 'expire',    placeholder: '2026-04-01' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: C.t2 }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: C.bg2, borderColor: C.border, color: C.t1 }]}
                  value={form[f.key]}
                  onChangeText={t => setForm({ ...form, [f.key]: t })}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.t3}
                  keyboardType={f.keyboardType}
                />
                {f.key === 'sellPrice' && form.buyPrice ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="bulb-outline" size={11} color={C.red} />
                    <Text style={{ fontSize: F.xxs, color: C.red }}>
                      권장: {Math.round((parseInt(form.buyPrice) || 0) * 1.55).toLocaleString()}원 (마진 35%)
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}

            {/* 거래처 선택 */}
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.fieldLabel, { color: C.t2 }]}>거래처 (선택)</Text>
              <TouchableOpacity
                style={[styles.supplierPickerBtn, { backgroundColor: C.bg2, borderColor: form.supplierName ? C.red : C.border }]}
                onPress={() => setSupplierPicker(true)}
              >
                <Text style={{ color: form.supplierName ? C.t1 : C.t3, fontSize: F.sm, fontWeight: form.supplierName ? '700' : '400' }}>
                  {form.supplierName || (suppliers.length === 0 ? '거래처를 먼저 등록하세요' : '거래처 선택')}
                </Text>
                {form.supplierName ? (
                  <TouchableOpacity onPress={() => setForm({ ...form, supplierId: '', supplierName: '' })}>
                    <Text style={{ color: C.t3, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: C.t3 }}>▼</Text>
                )}
              </TouchableOpacity>
            </View>

            <PrimaryBtn label="등록 완료" onPress={handleAdd} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 12 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* 거래처 선택 피커 모달 */}
      <Modal visible={supplierPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerBox, { backgroundColor: C.white }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.pickerTitle, { color: C.t1 }]}>거래처 선택</Text>
              <TouchableOpacity onPress={() => setSupplierPicker(false)}>
                <Text style={{ color: C.t3, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {suppliers.length === 0 ? (
              <View style={{ padding: 28, alignItems: 'center' }}>
                <Text style={{ color: C.t3, fontSize: F.sm }}>등록된 거래처가 없습니다</Text>
                <Text style={{ color: C.t3, fontSize: F.xs, marginTop: 6 }}>거래처 탭에서 먼저 추가하세요</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {suppliers.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.pickerItem, { borderBottomColor: C.border }]}
                    onPress={() => {
                      setForm({ ...form, supplierId: s.id, supplierName: s.name });
                      setSupplierPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemName, { color: C.t1 }]}>{s.name}</Text>
                    {s.phone ? <Text style={[styles.pickerItemSub, { color: C.t3 }]}>{s.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── 판매내역 탭 ───────────────────────────────────────────
function SoldHistoryTab({ meat }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const soldItems = meat.filter(m => m.sold);

  // 날짜별로 그룹핑
  const grouped = soldItems.reduce((acc, item) => {
    const date = item.soldDate || '날짜 미상';
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalRevenue = soldItems.reduce((s, m) => s + m.qty * m.sellPrice, 0);
  const totalCost    = soldItems.reduce((s, m) => s + m.qty * m.buyPrice, 0);
  const totalProfit  = totalRevenue - totalCost;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {soldItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="document-text-outline" size={48} color={C.t4} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyText, { color: C.t3 }]}>판매완료 내역이 없습니다</Text>
        </View>
      ) : (
        <>
          {/* 합계 요약 */}
          <View style={styles.summaryGrid}>
            <SummaryBox ionicon="cube-outline" label="판매 건수"  value={`${soldItems.length}건`}                              color={C.red} />
            <SummaryBox ionicon="cash-outline" label="총 매출액"  value={`${(totalRevenue / 10000).toFixed(0)}만원`}           color={C.ok2} />
            <SummaryBox ionicon="trending-down-outline" label="총 매입액"  value={`${(totalCost / 10000).toFixed(0)}만원`}              color={C.blue2} />
            <SummaryBox ionicon="trending-up-outline" label="총 마진"    value={`${(totalProfit / 10000).toFixed(0)}만원`}            color={totalProfit >= 0 ? C.ok2 : C.red} />
          </View>

          {dates.map(date => {
            const items    = grouped[date];
            const dayRev   = items.reduce((s, m) => s + m.qty * m.sellPrice, 0);
            const dayCost  = items.reduce((s, m) => s + m.qty * m.buyPrice, 0);
            return (
              <View key={date} style={styles.soldGroup}>
                <View style={styles.soldGroupHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={C.t2} />
                    <Text style={[styles.soldGroupDate, { color: C.t2 }]}>{date}</Text>
                  </View>
                  <Text style={[styles.soldGroupTotal, { color: C.ok2 }]}>
                    매출 {(dayRev / 10000).toFixed(0)}만원 · 마진 {((dayRev - dayCost) / 10000).toFixed(0)}만원
                  </Text>
                </View>
                {items.map(item => (
                  <View key={item.id} style={[styles.soldCard, { backgroundColor: C.white, borderColor: C.ok2 + '40' }]}>
                    <View style={styles.soldCardTop}>
                      <View style={[styles.soldBadge, { backgroundColor: C.ok2 + '20' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="checkmark-circle" size={13} color={C.ok2} />
                          <Text style={{ fontSize: F.xs, fontWeight: '800', color: C.ok2 }}>판매완료</Text>
                        </View>
                      </View>
                      <Text style={[styles.soldCardCut, { color: C.t1 }]}>{item.cut}</Text>
                      <Text style={[styles.soldCardOrigin, { color: C.t3 }]}>{item.origin}</Text>
                    </View>
                    <View style={styles.soldCardRow}>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: C.t3 }]}>중량</Text>
                        <Text style={[styles.soldStatVal, { color: C.t1 }]}>{item.qty}kg</Text>
                      </View>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: C.t3 }]}>매입가</Text>
                        <Text style={[styles.soldStatVal, { color: C.t2 }]}>{item.buyPrice.toLocaleString()}원</Text>
                      </View>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: C.t3 }]}>판매가</Text>
                        <Text style={[styles.soldStatVal, { color: C.red }]}>{item.sellPrice.toLocaleString()}원</Text>
                      </View>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: C.t3 }]}>마진</Text>
                        <Text style={[styles.soldStatVal, { color: C.ok2 }]}>
                          {(((item.sellPrice - item.buyPrice) * item.qty) / 10000).toFixed(1)}만원
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// ── 수율 계산기 탭 ────────────────────────────────────────
function YieldTab() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [initWeight,  setInitWeight]  = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [buyPrice,    setBuyPrice]    = useState('');
  const [label,       setLabel]       = useState('');
  const [result,      setResult]      = useState(null);
  const [history,     setHistory]     = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // 히스토리 로드
  useEffect(() => {
    yieldStore.load().then(h => { if (h.length > 0) setHistory(h); });
  }, []);

  const calculate = () => {
    const init  = parseFloat(initWeight) || 0;
    const final = parseFloat(finalWeight) || 0;
    const price = parseFloat(buyPrice) || 0;
    if (!init || !final) { Alert.alert('입력 오류', '원육 중량과 정육 중량을 입력해주세요.'); return; }
    const yieldPct  = (final / init * 100).toFixed(1);
    const realCost  = price > 0 ? Math.round(price / (final / init)) : 0;
    const recommend = Math.round(realCost * 1.55);
    const lossKg    = (init - final).toFixed(2);
    const entry = {
      id: Date.now().toString(),
      label:     label || '미입력',
      date:      new Date().toLocaleDateString('ko-KR'),
      initWeight: init, finalWeight: final,
      yieldPct, lossKg, realCost, recommend,
    };
    setResult(entry);
    yieldStore.add(entry).then(updated => setHistory(updated));
  };

  const clearInputs = () => {
    setInitWeight(''); setFinalWeight(''); setBuyPrice(''); setLabel(''); setResult(null);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <AlertBox type="info" message="원육 중량과 정육 후 중량을 입력하면 수율과 실제 원가를 계산합니다." />

      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.fieldLabel, { color: C.t2 }]}>부위명 (선택, 히스토리 식별용)</Text>
        <TextInput style={[styles.inputLg, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
          value={label} onChangeText={setLabel}
          placeholder="예: 등심 3월 28일 작업" placeholderTextColor={C.t3} />
      </View>
      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: C.t2 }]}>원육 중량 (kg)</Text>
          <TextInput style={[styles.inputLg, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
            value={initWeight} onChangeText={setInitWeight}
            placeholder="예: 15.0" placeholderTextColor={C.t3} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: C.t2 }]}>정육 후 중량 (kg)</Text>
          <TextInput style={[styles.inputLg, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
            value={finalWeight} onChangeText={setFinalWeight}
            placeholder="예: 12.5" placeholderTextColor={C.t3} keyboardType="numeric" />
        </View>
      </View>
      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.fieldLabel, { color: C.t2 }]}>매입가 (원/kg, 선택)</Text>
        <TextInput style={[styles.inputLg, { backgroundColor: C.white, borderColor: C.border, color: C.t1 }]}
          value={buyPrice} onChangeText={setBuyPrice}
          placeholder="예: 98000" placeholderTextColor={C.t3} keyboardType="numeric" />
      </View>

      <PrimaryBtn label="수율 계산하기" onPress={calculate} />
      {result && <OutlineBtn label="입력 초기화" onPress={clearInputs} style={{ marginTop: 12 }} />}

      {result && (
        <View style={[styles.resultCard, { backgroundColor: C.white, borderColor: C.border }]}>
          <ResultRow label="수율" value={`${result.yieldPct}%`}
            color={parseFloat(result.yieldPct) >= 80 ? C.ok2 : C.warn2} big />
          <ResultRow label="손실 중량" value={`${result.lossKg}kg`} color={C.red} />
          {result.realCost > 0 && <>
            <ResultRow label="실제 원가 (손실 반영)" value={`${result.realCost.toLocaleString()}원/kg`} color={C.red} />
            <ResultRow label="권장 판매가 (마진 55%)" value={`${result.recommend.toLocaleString()}원/kg`} color={C.ok2} big />
          </>}
        </View>
      )}

      {/* 히스토리 */}
      {history.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity
            style={[styles.historyToggle, { backgroundColor: C.white, borderColor: C.border }]}
            onPress={() => setShowHistory(v => !v)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bar-chart-outline" size={15} color={C.red} />
              <Text style={[styles.historyToggleText, { color: C.red }]}>
                계산 히스토리 ({history.length}건)  {showHistory ? '▲ 접기' : '▼ 펼치기'}
              </Text>
            </View>
          </TouchableOpacity>
          {showHistory && history.map(h => (
            <View key={h.id} style={[styles.historyCard, { backgroundColor: C.white, borderColor: C.border }]}>
              <View style={styles.historyTop}>
                <Text style={[styles.historyLabel, { color: C.t1 }]}>{h.label}</Text>
                <Text style={[styles.historyDate, { color: C.t3 }]}>{h.date}</Text>
              </View>
              <View style={styles.historyRow}>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatLabel, { color: C.t3 }]}>원육</Text>
                  <Text style={[styles.historyStatVal, { color: C.t2 }]}>{h.initWeight}kg</Text>
                </View>
                <Text style={{ color: C.t3, fontSize: F.h3 }}>→</Text>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatLabel, { color: C.t3 }]}>정육</Text>
                  <Text style={[styles.historyStatVal, { color: C.t2 }]}>{h.finalWeight}kg</Text>
                </View>
                <View style={[styles.historyYieldBadge, { backgroundColor: parseFloat(h.yieldPct) >= 80 ? C.ok2 + '20' : C.warn2 + '20' }]}>
                  <Text style={{ fontSize: F.body, fontWeight: '900', color: parseFloat(h.yieldPct) >= 80 ? C.ok2 : C.warn2 }}>
                    {h.yieldPct}%
                  </Text>
                </View>
                {h.realCost > 0 && (
                  <View style={styles.historyStat}>
                    <Text style={[styles.historyStatLabel, { color: C.t3 }]}>실제원가</Text>
                    <Text style={[styles.historyStatVal, { color: C.red }]}>{h.realCost.toLocaleString()}원</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── 소비기한 탭 ───────────────────────────────────────────
function ExpiryTab({ meat, setMeat }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const getDdaySafe = m => m.dday != null ? m.dday : (m.d_day != null ? m.d_day : 99);
  const activeMeat = meat.filter(m => !m.sold);
  const sorted     = [...activeMeat].sort((a, b) => getDdaySafe(a) - getDdaySafe(b));

  const today    = sorted.filter(m => getDdaySafe(m) === 0);
  const tomorrow = sorted.filter(m => getDdaySafe(m) === 1);
  const week     = sorted.filter(m => getDdaySafe(m) > 1 && getDdaySafe(m) <= 7);
  const later    = sorted.filter(m => getDdaySafe(m) > 7);

  const [editModal, setEditModal] = useState(false);
  const [logModal,  setLogModal]  = useState(false);
  const [target,    setTarget]    = useState(null);
  const [newExpire, setNewExpire] = useState('');

  const openEdit = (item) => {
    setTarget(item);
    setNewExpire(item.expire || '');
    setEditModal(true);
  };

  const openLog = (item) => {
    setTarget(item);
    setLogModal(true);
  };

  const handleEditSave = () => {
    if (!newExpire.trim()) { Alert.alert('입력 오류', '날짜를 입력해주세요.'); return; }
    Alert.alert(
      '소비기한 수정',
      `"${target.cut}"의 소비기한을 수정합니다.\n기존: ${target.expire}\n변경: ${newExpire}\n\n수정 이력이 로그에 남습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '수정 확인', style: 'destructive',
          onPress: () => {
            const newDday = Math.ceil((new Date(newExpire) - new Date()) / 86400000);
            const logEntry = {
              date:      new Date().toLocaleDateString('ko-KR'),
              time:      new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              oldExpire: target.expire,
              newExpire: newExpire,
              count:     (target.editCount || 0) + 1,
            };
            setMeat(prev => prev.map(m =>
              m.id !== target.id ? m : {
                ...m,
                expire:    newExpire,
                dday:      newDday,
                status:    newDday <= 0 ? 'critical' : newDday <= 2 ? 'low' : 'ok',
                editCount: (m.editCount || 0) + 1,
                editLog:   [...(m.editLog || []), logEntry],
              }
            ));
            setEditModal(false);
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {today.length    > 0 && <ExpiryGroup icon="alert-circle" iconColor={C.red} label="오늘 만료"  items={today}    color={C.red} onEdit={openEdit} onLog={openLog} />}
      {tomorrow.length > 0 && <ExpiryGroup icon="ellipse" iconColor={C.warn2} label="내일 만료"  items={tomorrow} color={C.warn2} onEdit={openEdit} onLog={openLog} />}
      {week.length     > 0 && <ExpiryGroup icon="ellipse" iconColor={C.warn} label="이번 주"    items={week}     color={C.warn} onEdit={openEdit} onLog={openLog} />}
      {later.length    > 0 && <ExpiryGroup icon="ellipse" iconColor={C.ok2} label="이후"       items={later}    color={C.ok2} onEdit={openEdit} onLog={openLog} />}

      {/* 소비기한 수정 모달 */}
      <Modal visible={editModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.editModalBox, { backgroundColor: C.white, borderColor: C.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="create-outline" size={18} color={C.t1} />
              <Text style={[styles.editModalTitle, { color: C.t1 }]}>소비기한 수정</Text>
            </View>
            <Text style={[styles.editModalSub, { color: C.t3 }]}>
              {target?.cut}  현재: {target?.expire}
            </Text>
            {(target?.editCount > 0) && (
              <View style={[styles.editWarningBox, { backgroundColor: C.warnS, borderColor: C.warn2 + '50' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="alert-circle-outline" size={14} color={C.warn2} />
                  <Text style={[styles.editWarningText, { color: C.warn2 }]}>
                    이미 {target.editCount}회 수정된 항목입니다
                  </Text>
                </View>
              </View>
            )}
            <Text style={[styles.fieldLabel, { color: C.t2, marginTop: 16 }]}>새 소비기한 (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.t1 }]}
              value={newExpire}
              onChangeText={setNewExpire}
              placeholder="예: 2026-04-10"
              placeholderTextColor={C.t3}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
              <Ionicons name="alert-circle" size={14} color={C.red} />
              <Text style={[styles.editNotice, { color: C.red }]}>
                수정 시 로그에 기록되며 취소할 수 없습니다
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <OutlineBtn label="취소" onPress={() => setEditModal(false)} style={{ flex: 1 }} />
              <PrimaryBtn label="수정 확인" onPress={handleEditSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* 수정 로그 모달 */}
      <Modal visible={logModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[styles.modalHeader, { backgroundColor: C.white, borderBottomColor: C.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-text-outline" size={18} color={C.t1} />
              <Text style={[styles.modalTitle, { color: C.t1 }]}>수정 이력 — {target?.cut}</Text>
            </View>
            <TouchableOpacity onPress={() => setLogModal(false)}>
              <Text style={[styles.closeBtn, { color: C.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {(!target?.editLog || target.editLog.length === 0) ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, { color: C.t3 }]}>수정 이력이 없습니다</Text>
              </View>
            ) : (
              target.editLog.map((log, idx) => (
                <View key={idx} style={[styles.logCard, { backgroundColor: C.white, borderColor: C.border }]}>
                  <View style={[styles.logCountBadge, { backgroundColor: C.warnS }]}>
                    <Text style={[styles.logCountText, { color: C.warn2 }]}>수정 {log.count}회</Text>
                  </View>
                  <Text style={[styles.logDateTime, { color: C.t3 }]}>{log.date} {log.time}</Text>
                  <View style={styles.logChangeRow}>
                    <View style={[styles.logChangeBox, { backgroundColor: C.red + '15', borderColor: C.red + '40' }]}>
                      <Text style={[styles.logChangeLabel, { color: C.red }]}>변경 전</Text>
                      <Text style={[styles.logChangeVal, { color: C.t1 }]}>{log.oldExpire}</Text>
                    </View>
                    <Text style={{ color: C.t3, fontSize: 20 }}>→</Text>
                    <View style={[styles.logChangeBox, { backgroundColor: C.ok2 + '15', borderColor: C.ok2 + '40' }]}>
                      <Text style={[styles.logChangeLabel, { color: C.ok2 }]}>변경 후</Text>
                      <Text style={[styles.logChangeVal, { color: C.t1 }]}>{log.newExpire}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── 거래처 탭 ─────────────────────────────────────────────
function SupplierTab({ suppliers, setSuppliers, meat }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [modal, setModal]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]         = useState({ name: '', phone: '', memo: '' });

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', phone: '', memo: '' });
    setModal(true);
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({ name: s.name, phone: s.phone || '', memo: s.memo || '' });
    setModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { Alert.alert('입력 오류', '업체명을 입력해주세요.'); return; }
    if (editTarget) {
      setSuppliers(prev => prev.map(s => s.id === editTarget.id ? { ...s, ...form } : s));
    } else {
      setSuppliers(prev => [...prev, { id: Date.now().toString(), ...form, priceHistory: [] }]);
    }
    setModal(false);
  };

  const handleDelete = (id) => {
    Alert.alert('거래처 삭제', '삭제하면 연결된 재고의 거래처 정보도 초기화됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setSuppliers(prev => prev.filter(s => s.id !== id)) },
    ]);
  };

  // 월별 거래처별 매입액 집계
  const thisMonth = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const monthlyBySupplier = {};
  meat.forEach(m => {
    if (!m.supplierName) return;
    const month = m.inboundDate
      ? (() => { const d = new Date(m.inboundDate.replace(/\.\s*/g, '-').replace(/-$/, '')); return isNaN(d) ? '' : d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }); })()
      : '';
    if (!month) return;
    if (!monthlyBySupplier[m.supplierName]) monthlyBySupplier[m.supplierName] = {};
    if (!monthlyBySupplier[m.supplierName][month]) monthlyBySupplier[m.supplierName][month] = 0;
    monthlyBySupplier[m.supplierName][month] += (m.qty || 0) * (m.buyPrice || 0);
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {suppliers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="storefront-outline" size={48} color={C.t4} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: C.t3 }]}>등록된 거래처가 없습니다</Text>
            <Text style={{ color: C.t3, fontSize: F.xs, marginTop: 8, textAlign: 'center' }}>
              + 거래처 추가 버튼으로 업체를 등록하면{'\n'}재고 입고 시 연결할 수 있습니다
            </Text>
          </View>
        ) : (
          suppliers.map(s => {
            const history = monthlyBySupplier[s.name] || {};
            const months  = Object.keys(history).sort((a, b) => b.localeCompare(a));
            const totalBuy = Object.values(history).reduce((acc, v) => acc + v, 0);
            return (
              <View key={s.id} style={[styles.supplierCard, { backgroundColor: C.white, borderColor: C.border }]}>
                <View style={styles.supplierCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.supplierName, { color: C.t1 }]}>{s.name}</Text>
                    {s.phone ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Ionicons name="call-outline" size={13} color={C.t3} />
                        <Text style={[styles.supplierPhone, { color: C.t3 }]}>{s.phone}</Text>
                      </View>
                    ) : null}
                    {s.memo ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="create-outline" size={13} color={C.t3} />
                        <Text style={[styles.supplierMemo, { color: C.t3 }]}>{s.memo}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.supplierEditBtn, { borderColor: C.red + '60' }]}
                      onPress={() => openEdit(s)}
                    >
                      <Text style={{ color: C.red, fontSize: F.xs, fontWeight: '700' }}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.supplierEditBtn, { borderColor: C.red + '50' }]}
                      onPress={() => handleDelete(s.id)}
                    >
                      <Text style={{ color: C.red, fontSize: F.xs, fontWeight: '700' }}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 월별 매입액 */}
                {months.length > 0 && (
                  <View style={[styles.supplierHistSection, { borderTopColor: C.border }]}>
                    <Text style={[styles.supplierHistTitle, { color: C.t2 }]}>월별 매입 현황</Text>
                    {months.map(m => (
                      <View key={m} style={styles.supplierHistRow}>
                        <Text style={[styles.supplierHistMonth, { color: C.t3 }]}>{m}</Text>
                        <Text style={[styles.supplierHistAmt, { color: C.red }]}>
                          {(history[m] / 10000).toFixed(0)}만원
                        </Text>
                      </View>
                    ))}
                    <View style={[styles.supplierHistRow, { marginTop: 4 }]}>
                      <Text style={[styles.supplierHistMonth, { color: C.t2, fontWeight: '800' }]}>누적 합계</Text>
                      <Text style={[styles.supplierHistAmt, { color: C.ok2, fontWeight: '900' }]}>
                        {(totalBuy / 10000).toFixed(0)}만원
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <PrimaryBtn label="+ 거래처 추가" onPress={openAdd} style={{ marginTop: 12 }} />
      </ScrollView>

      {/* 거래처 추가/수정 모달 */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: C.border, backgroundColor: C.white }]}>
            <Text style={[styles.modalTitle, { color: C.t1 }]}>{editTarget ? '거래처 수정' : '거래처 추가'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.closeBtn, { color: C.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {[
              { label: '업체명 *', key: 'name', placeholder: '예: 한국축산' },
              { label: '연락처',   key: 'phone', placeholder: '예: 010-1234-5678', keyboardType: 'phone-pad' },
              { label: '메모',     key: 'memo',  placeholder: '예: 등심·채끝 전문, 매주 화/금 입고' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: C.t2 }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: C.bg2, borderColor: C.border, color: C.t1 }]}
                  value={form[f.key]}
                  onChangeText={t => setForm({ ...form, [f.key]: t })}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.t3}
                  keyboardType={f.keyboardType}
                />
              </View>
            ))}
            <PrimaryBtn label={editTarget ? '수정 완료' : '추가 완료'} onPress={handleSave} />
            <OutlineBtn label="취소" onPress={() => setModal(false)} style={{ marginTop: 12 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const ExpiryGroup = ({ icon, iconColor, label, items, color, onEdit, onLog }) => (
  <View style={styles.expiryGroup}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={[styles.expiryGroupLabel, { color, marginBottom: 0 }]}>{label}</Text>
    </View>
    {items.map(item => (
      <View key={item.id} style={[styles.expiryRow, { backgroundColor: C.white, borderColor: C.border }]}>
        <View style={[styles.expiryDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.expiryName, { color: C.t1 }]}>{item.cut}</Text>
            {item.editCount > 0 && (
              <View style={[styles.editBadge, { backgroundColor: C.warnS }]}>
                <Text style={[styles.editBadgeText, { color: C.warn2 }]}>수정 {item.editCount}회</Text>
              </View>
            )}
          </View>
          <Text style={[styles.expiryOrigin, { color: C.t3 }]}>{item.origin}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.expiryQty, { color }]}>{item.qty}kg</Text>
          <Text style={[styles.expiryDate, { color: C.t3 }]}>{item.expire}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {item.editCount > 0 && (
              <TouchableOpacity
                style={[styles.expiryActionBtn, { borderColor: C.t3 + '50' }]}
                onPress={() => onLog(item)}
              >
                <Text style={[styles.expiryActionText, { color: C.t3 }]}>로그</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.expiryActionBtn, { borderColor: color + '60', backgroundColor: color + '15' }]}
              onPress={() => onEdit(item)}
            >
              <Text style={[styles.expiryActionText, { color }]}>수정</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ))}
  </View>
);

const SummaryBox = ({ ionicon, label, value, color }) => (
  <View style={styles.summaryBox}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      <Ionicons name={ionicon} size={13} color={C.t3} />
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
    <Text style={[styles.summaryVal, { color }]}>{value}</Text>
  </View>
);

const ResultRow = ({ label, value, color, big }) => (
  <View style={[styles.resultRow, { borderBottomColor: C.border }]}>
    <Text style={[styles.resultLabel, { color: C.t2 }]}>{label}</Text>
    <Text style={[styles.resultVal, { color, fontSize: big ? F.h2 : F.h3 }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  // 탭바 — 가로 스크롤
  // V5 헤더
  v5Header:       { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, overflow: 'hidden' },
  v5HeaderAccent: { height: 3, backgroundColor: C.red, position: 'absolute', top: 0, left: 0, right: 0 },
  v5HeaderRow:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  v5PageTitle:    { fontSize: F.h2 - 2, fontWeight: '900', color: C.t1, letterSpacing: -0.6 },

  tabBarScroll: { borderBottomWidth: 1, flexGrow: 0 },
  tabBarContent: { flexDirection: 'row' },
  tab: { paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', minWidth: 80 },
  tabText: { fontSize: F.body, fontWeight: '600' },
  tabTextActive: { fontWeight: '900' },

  // 2×2 그리드
  summaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, padding: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  summaryBox: {
    width: '48%', borderRadius: R.sm + 2,
    padding: 11, paddingLeft: 13, backgroundColor: C.bg2,
  },
  summaryVal:   { fontSize: F.h2 - 2, fontWeight: '900', marginBottom: 2, letterSpacing: -0.8 },
  summaryLabel: { fontSize: F.xs, fontWeight: '600', color: C.t3 },

  // 검색 바 + 필터 칩
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: R.md, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: F.sm, fontWeight: '500', paddingVertical: 0 },
  filterChip: {
    paddingHorizontal: 17, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.07)',
  },
  filterChipText: { fontSize: F.xs, fontWeight: '700' },

  // 새 카드 스타일
  meatCard: { borderRadius: R.md, borderWidth: 1, marginBottom: 12, overflow: 'hidden', ...SH.sm },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  gradeBox: {
    width: 46, minHeight: 46, borderRadius: R.sm, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  gradeText: { fontSize: F.xs, fontWeight: '900', textAlign: 'center' },
  gradeType: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 1 },
  cardMain: { flex: 1, gap: 2 },
  cardName:     { fontSize: F.body, fontWeight: '900' },
  cardDetail:   { fontSize: F.xs, fontWeight: '500' },
  cardSupplier: { fontSize: F.xxs, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  ddayPill: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1.5,
  },
  ddayText: { fontSize: F.xs, fontWeight: '900' },
  cardQty:  { fontSize: F.body, fontWeight: '900' },

  cardPriceRow: {
    flexDirection: 'row', borderTopWidth: 1,
  },
  priceStatBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  priceStatLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  priceStatVal: { fontSize: F.xs, fontWeight: '900' },

  // 기존 호환용
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  priceLabel: { fontSize: F.xxs },
  priceVal:   { fontSize: F.sm, fontWeight: '800' },

  soldBtn:     { paddingVertical: 11, borderTopWidth: 1, alignItems: 'center' },
  soldBtnText: { fontSize: F.sm, fontWeight: '800' },

  emptyBox:  { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: F.body, fontWeight: '600' },

  // 재고 현황 빈 상태
  stockEmptyBox: {
    borderRadius: R.lg, borderWidth: 1,
    padding: 28, marginBottom: 16,
    alignItems: 'center', ...SH.sm,
  },
  stockEmptyTitle: { fontSize: F.body, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  stockEmptyDesc:  { fontSize: F.sm, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 16, color: C.t4 },
  stockEmptyTip:   { borderRadius: R.sm, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, width: '100%' },
  stockEmptyTipText: { fontSize: F.xs, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  // 판매내역
  soldGroup:       { marginBottom: 20 },
  soldGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  soldGroupDate:   { fontSize: F.sm, fontWeight: '800' },
  soldGroupTotal:  { fontSize: F.xs, fontWeight: '700' },
  soldCard: {
    borderRadius: R.md, borderWidth: 1.5,
    padding: 16, marginBottom: 12, ...SH.sm,
  },
  soldCardTop:   { marginBottom: 12 },
  soldBadge:     { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  soldCardCut:   { fontSize: F.body, fontWeight: '800' },
  soldCardOrigin:{ fontSize: F.xs, marginTop: 2 },
  soldCardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soldCardStat:  { alignItems: 'center' },
  soldStatLabel: { fontSize: F.xxs, fontWeight: '600', marginBottom: 2 },
  soldStatVal:   { fontSize: F.sm, fontWeight: '800' },

  // 수율 계산기
  rowInputs: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  fieldLabel: { fontSize: F.sm, fontWeight: '700', marginBottom: 7 },
  inputLg: {
    borderWidth: 1.5, borderRadius: R.md,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: F.h3, fontWeight: '700', textAlign: 'center', minHeight: 58,
  },

  resultCard: { borderRadius: R.lg, borderWidth: 1, padding: 20, marginTop: 20, ...SH.md },
  resultRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  resultLabel:{ fontSize: F.sm, fontWeight: '600' },
  resultVal:  { fontWeight: '900' },

  historyToggle: { borderRadius: R.md, borderWidth: 1, padding: 16, alignItems: 'center', marginBottom: 12 },
  historyToggleText: { fontSize: F.sm, fontWeight: '800' },
  historyCard: { borderRadius: R.md, borderWidth: 1, padding: 16, marginBottom: 12, ...SH.sm },
  historyTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  historyLabel:{ fontSize: F.sm, fontWeight: '700' },
  historyDate: { fontSize: F.xs },
  historyRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  historyStat: { alignItems: 'center' },
  historyStatLabel: { fontSize: F.xxs, fontWeight: '600', marginBottom: 2 },
  historyStatVal:   { fontSize: F.sm, fontWeight: '800' },
  historyYieldBadge:{ paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },

  // 소비기한
  expiryGroup:      { marginBottom: 20 },
  expiryGroupLabel: { fontSize: F.sm, fontWeight: '900', letterSpacing: 0.5 },
  expiryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: R.md, borderWidth: 1, padding: 16, marginBottom: 12, ...SH.sm,
  },
  expiryDot:    { width: 10, height: 10, borderRadius: 5 },
  expiryName:   { fontSize: F.body, fontWeight: '800' },
  expiryOrigin: { fontSize: F.xs, marginTop: 2 },
  expiryQty:    { fontSize: F.body, fontWeight: '900' },
  expiryDate:   { fontSize: F.xs, marginTop: 2 },
  editBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.sm },
  editBadgeText:{ fontSize: F.xxs, fontWeight: '800' },
  expiryActionBtn:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  expiryActionText: { fontSize: F.xxs, fontWeight: '800' },

  // 수정 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  editModalBox: { borderRadius: R.lg, borderWidth: 1, padding: 20 },
  editModalTitle: { fontSize: F.h3, fontWeight: '900' },
  editModalSub:   { fontSize: F.sm, marginBottom: 12 },
  editWarningBox: { borderRadius: R.sm, borderWidth: 1, padding: 12, marginBottom: 12 },
  editWarningText:{ fontSize: F.sm, fontWeight: '700' },
  editNotice:     { fontSize: F.xs, fontWeight: '700' },

  // 로그 모달
  logCard: { borderRadius: R.md, borderWidth: 1, padding: 16, marginBottom: 12, ...SH.sm },
  logCountBadge:  { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  logCountText:   { fontSize: F.xs, fontWeight: '800' },
  logDateTime:    { fontSize: F.xs, marginBottom: 12 },
  logChangeRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logChangeBox:   { flex: 1, borderRadius: R.sm, borderWidth: 1, padding: 12, alignItems: 'center' },
  logChangeLabel: { fontSize: F.xxs, fontWeight: '700', marginBottom: 4 },
  logChangeVal:   { fontSize: F.sm, fontWeight: '800' },

  modalHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: F.h3, fontWeight: '900' },
  closeBtn:   { fontSize: 24, padding: 4 },
  input: { borderWidth: 1.5, borderRadius: R.sm, padding: 16, fontSize: F.sm, minHeight: 52 },

  // 거래처 선택 버튼 (재고 추가 모달 내)
  supplierPickerBtn: {
    borderWidth: 1.5, borderRadius: R.sm, padding: 16, minHeight: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },

  // 거래처 선택 피커 모달
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pickerBox:     { borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: 32 },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  pickerTitle:   { fontSize: F.body, fontWeight: '900' },
  pickerItem:    { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  pickerItemName:{ fontSize: F.body, fontWeight: '700' },
  pickerItemSub: { fontSize: F.xs, marginTop: 2 },

  // 거래처 카드
  supplierCard:     { borderRadius: R.md, borderWidth: 1, padding: 16, marginBottom: 12, ...SH.sm },
  supplierCardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  supplierName:     { fontSize: F.body, fontWeight: '900', marginBottom: 4 },
  supplierPhone:    { fontSize: F.xs, marginBottom: 2 },
  supplierMemo:     { fontSize: F.xs },
  supplierEditBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.sm, borderWidth: 1, alignItems: 'center' },
  supplierHistSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  supplierHistTitle:   { fontSize: F.xs, fontWeight: '700', marginBottom: 6 },
  supplierHistRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  supplierHistMonth:   { fontSize: F.xs, fontWeight: '600' },
  supplierHistAmt:     { fontSize: F.xs, fontWeight: '800' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 30, ...SH.md,
    elevation: 6,
  },
  fabIcon:  { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 26 },
  fabLabel: { color: '#fff', fontSize: F.sm, fontWeight: '900' },

  // 모드 선택 (단일 / 계근)
  modePickOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modePickBox:     { backgroundColor: C.white, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: 20, paddingBottom: 32 },
  modePickHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modePickTitle:   { fontSize: F.h3, fontWeight: '900', color: C.t1 },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.bg2, borderRadius: R.md, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  modeIconBox: { width: 48, height: 48, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  modeTitle:   { fontSize: F.body, fontWeight: '900', color: C.t1 },
  modeDesc:    { fontSize: F.xs, color: C.t3, marginTop: 2 },
  newTag:      { backgroundColor: C.red, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  newTagTxt:   { color: '#fff', fontSize: 9, fontWeight: '900' },
});
