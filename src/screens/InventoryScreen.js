import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert,
} from 'react-native';
import { colors, darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { PrimaryBtn, OutlineBtn, AlertBox } from '../components/UI';
import { GaugeBar } from '../components/GaugeBar';
import { meatInventory as initMeat } from '../data/mockData';
import { meatStore, salesStore, expiryLogStore, yieldStore } from '../lib/dataStore';

const TABS = ['재고 현황', '판매내역', '수율 계산기', '소비기한'];

export default function InventoryScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [tab, setTab] = useState(0);
  const [meat, setMeat] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const isFirst = useRef(true);

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
  }, []);

  // 데이터 변경 시 자동 저장 (첫 로드 제외)
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (loaded && meat.length >= 0) {
      meatStore.save(meat);
    }
  }, [meat]);

  const getDdaySafe = m => m.dday != null ? m.dday : (m.d_day != null ? m.d_day : 99);
  const critical = meat.filter(m => getDdaySafe(m) <= 1 && !m.sold);

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      {/* 탭 바 */}
      <View style={[styles.tabBar, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === i && { borderBottomColor: pal.ac }]}
            onPress={() => setTab(i)}
          >
            <Text style={[styles.tabText, { color: tab === i ? pal.ac : pal.t3 }, tab === i && styles.tabTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 0 && <StockTab meat={meat} setMeat={setMeat} critical={critical} />}
      {tab === 1 && <SoldHistoryTab meat={meat} />}
      {tab === 2 && <YieldTab />}
      {tab === 3 && <ExpiryTab meat={meat} setMeat={setMeat} />}
    </View>
  );
}

// ── 재고 현황 탭 ──────────────────────────────────────────
function StockTab({ meat, setMeat, critical }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cut: '', origin: '', qty: '', buyPrice: '', sellPrice: '', expire: '' });

  const activeItems = meat.filter(m => !m.sold);
  const soldItems   = meat.filter(m => m.sold);
  const totalValue  = activeItems.reduce((s, m) => s + m.qty * m.buyPrice, 0);
  const lossRisk    = activeItems.filter(m => m.dday <= 3).reduce((s, m) => s + m.qty * m.buyPrice, 0);

  const handleAdd = () => {
    if (!form.cut || !form.qty) { Alert.alert('입력 오류', '부위명과 중량을 입력해주세요.'); return; }
    const qty  = parseFloat(form.qty) || 0;
    const buy  = parseInt(form.buyPrice) || 0;
    const sell = parseInt(form.sellPrice) || (buy > 0 ? Math.round(buy * 1.55) : 0);
    const dday = form.expire ? Math.ceil((new Date(form.expire) - new Date()) / 86400000) : 99;
    setMeat([...meat, {
      id: Date.now().toString(), cut: form.cut, origin: form.origin || '미입력',
      qty, unit: 'kg', buyPrice: buy, sellPrice: sell,
      expire: form.expire, dday,
      status: dday <= 0 ? 'critical' : dday <= 2 ? 'low' : 'ok',
      sold: false, soldDate: null, editCount: 0, editLog: [],
    }]);
    setModal(false);
    setForm({ cut: '', origin: '', qty: '', buyPrice: '', sellPrice: '', expire: '' });
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
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 2×2 요약 그리드 */}
        <View style={styles.summaryGrid}>
          <SummaryBox icon="📦" label="재고 부위"  value={`${activeItems.length}종`}                                       color={pal.a2}   pal={pal} />
          <SummaryBox icon="✅" label="판매완료"   value={`${soldItems.length}건`}                                          color={pal.gn}   pal={pal} />
          <SummaryBox icon="💰" label="재고 가치"  value={`${(totalValue / 10000).toFixed(0)}만원`}                         color={pal.cyan} pal={pal} />
          <SummaryBox
            icon={lossRisk > 0 ? '⚠️' : '🛡️'}
            label="손실위험"
            value={lossRisk > 0 ? `-${(lossRisk / 10000).toFixed(0)}만원` : '없음'}
            color={lossRisk > 0 ? pal.rd : pal.gn}
            pal={pal}
          />
        </View>

        {critical.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <AlertBox type="error" icon="🚨" title="소비기한 임박" message={critical.map(m => m.cut).join(', ')} />
          </View>
        )}

        <View style={{ padding: spacing.md }}>
        {activeItems.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: pal.t3 }]}>재고 항목이 없습니다</Text>
          </View>
        )}

        {activeItems.map(item => (
          <View key={item.id} style={[styles.meatCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
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
              <Text style={[styles.priceLabel, { color: pal.t3 }]}>매입가</Text>
              <Text style={[styles.priceVal,   { color: pal.t2 }]}>{item.buyPrice.toLocaleString()}원</Text>
              <Text style={[styles.priceLabel, { color: pal.t3 }]}>권장 판매가</Text>
              <Text style={[styles.priceVal,   { color: pal.a2 }]}>{item.sellPrice.toLocaleString()}원</Text>
              {item.dday <= 3 && (
                <>
                  <Text style={[styles.priceLabel, { color: pal.rd }]}>손실위험</Text>
                  <Text style={[styles.priceVal, { color: pal.rd }]}>
                    -{((item.qty * item.buyPrice) / 10000).toFixed(1)}만원
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity
              style={[styles.soldBtn, { borderTopColor: pal.bd }]}
              onPress={() => handleSold(item.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.soldBtnText, { color: pal.gn }]}>판매 완료 처리 →</Text>
            </TouchableOpacity>
          </View>
        ))}

        <PrimaryBtn label="+ 재고 추가" onPress={() => setModal(true)} color={pal.a2} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { borderBottomColor: pal.bd, backgroundColor: pal.s1 }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>재고 추가</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {[
              { label: '부위명 *',              key: 'cut',       placeholder: '예: 등심' },
              { label: '원산지·등급',           key: 'origin',    placeholder: '예: 한우 1+' },
              { label: '중량 (kg) *',           key: 'qty',       placeholder: '0.0',          keyboardType: 'numeric' },
              { label: '매입가 (원/kg)',         key: 'buyPrice',  placeholder: '0',            keyboardType: 'numeric' },
              { label: '판매가 (원/kg)',         key: 'sellPrice', placeholder: '비워두면 ×1.55 자동 적용', keyboardType: 'numeric' },
              { label: '소비기한 (YYYY-MM-DD)', key: 'expire',    placeholder: '2026-04-01' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: spacing.md }}>
                <Text style={[styles.fieldLabel, { color: pal.t2 }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: pal.s2, borderColor: pal.bd, color: pal.tx }]}
                  value={form[f.key]}
                  onChangeText={t => setForm({ ...form, [f.key]: t })}
                  placeholder={f.placeholder}
                  placeholderTextColor={pal.t3}
                  keyboardType={f.keyboardType}
                />
                {f.key === 'sellPrice' && form.buyPrice ? (
                  <Text style={{ fontSize: fontSize.xxs, color: pal.a2, marginTop: 4 }}>
                    💡 권장: {Math.round((parseInt(form.buyPrice) || 0) * 1.55).toLocaleString()}원 (마진 35%)
                  </Text>
                ) : null}
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
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {soldItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📋</Text>
          <Text style={[styles.emptyText, { color: pal.t3 }]}>판매완료 내역이 없습니다</Text>
        </View>
      ) : (
        <>
          {/* 합계 요약 */}
          <View style={styles.summaryGrid}>
            <SummaryBox icon="📦" label="판매 건수"  value={`${soldItems.length}건`}                              color={pal.a2}   pal={pal} />
            <SummaryBox icon="💰" label="총 매출액"  value={`${(totalRevenue / 10000).toFixed(0)}만원`}           color={pal.gn}   pal={pal} />
            <SummaryBox icon="📉" label="총 매입액"  value={`${(totalCost / 10000).toFixed(0)}만원`}              color={pal.cyan} pal={pal} />
            <SummaryBox icon="📈" label="총 마진"    value={`${(totalProfit / 10000).toFixed(0)}만원`}            color={totalProfit >= 0 ? pal.gn : pal.rd} pal={pal} />
          </View>

          {dates.map(date => {
            const items    = grouped[date];
            const dayRev   = items.reduce((s, m) => s + m.qty * m.sellPrice, 0);
            const dayCost  = items.reduce((s, m) => s + m.qty * m.buyPrice, 0);
            return (
              <View key={date} style={styles.soldGroup}>
                <View style={styles.soldGroupHeader}>
                  <Text style={[styles.soldGroupDate, { color: pal.t2 }]}>📅 {date}</Text>
                  <Text style={[styles.soldGroupTotal, { color: pal.gn }]}>
                    매출 {(dayRev / 10000).toFixed(0)}만원 · 마진 {((dayRev - dayCost) / 10000).toFixed(0)}만원
                  </Text>
                </View>
                {items.map(item => (
                  <View key={item.id} style={[styles.soldCard, { backgroundColor: pal.s1, borderColor: pal.gn + '40' }]}>
                    <View style={styles.soldCardTop}>
                      <View style={[styles.soldBadge, { backgroundColor: pal.gn + '20' }]}>
                        <Text style={{ fontSize: fontSize.xs, fontWeight: '800', color: pal.gn }}>✓ 판매완료</Text>
                      </View>
                      <Text style={[styles.soldCardCut, { color: pal.tx }]}>{item.cut}</Text>
                      <Text style={[styles.soldCardOrigin, { color: pal.t3 }]}>{item.origin}</Text>
                    </View>
                    <View style={styles.soldCardRow}>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: pal.t3 }]}>중량</Text>
                        <Text style={[styles.soldStatVal, { color: pal.tx }]}>{item.qty}kg</Text>
                      </View>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: pal.t3 }]}>매입가</Text>
                        <Text style={[styles.soldStatVal, { color: pal.t2 }]}>{item.buyPrice.toLocaleString()}원</Text>
                      </View>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: pal.t3 }]}>판매가</Text>
                        <Text style={[styles.soldStatVal, { color: pal.a2 }]}>{item.sellPrice.toLocaleString()}원</Text>
                      </View>
                      <View style={styles.soldCardStat}>
                        <Text style={[styles.soldStatLabel, { color: pal.t3 }]}>마진</Text>
                        <Text style={[styles.soldStatVal, { color: pal.gn }]}>
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
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      <AlertBox type="info" icon="ℹ️" message="원육 중량과 정육 후 중량을 입력하면 수율과 실제 원가를 계산합니다." />

      <View style={{ marginBottom: spacing.md }}>
        <Text style={[styles.fieldLabel, { color: pal.t2 }]}>부위명 (선택, 히스토리 식별용)</Text>
        <TextInput style={[styles.inputLg, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
          value={label} onChangeText={setLabel}
          placeholder="예: 등심 3월 28일 작업" placeholderTextColor={pal.t3} />
      </View>
      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: pal.t2 }]}>원육 중량 (kg)</Text>
          <TextInput style={[styles.inputLg, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
            value={initWeight} onChangeText={setInitWeight}
            placeholder="예: 15.0" placeholderTextColor={pal.t3} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: pal.t2 }]}>정육 후 중량 (kg)</Text>
          <TextInput style={[styles.inputLg, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
            value={finalWeight} onChangeText={setFinalWeight}
            placeholder="예: 12.5" placeholderTextColor={pal.t3} keyboardType="numeric" />
        </View>
      </View>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[styles.fieldLabel, { color: pal.t2 }]}>매입가 (원/kg, 선택)</Text>
        <TextInput style={[styles.inputLg, { backgroundColor: pal.s1, borderColor: pal.bd, color: pal.tx }]}
          value={buyPrice} onChangeText={setBuyPrice}
          placeholder="예: 98000" placeholderTextColor={pal.t3} keyboardType="numeric" />
      </View>

      <PrimaryBtn label="수율 계산하기" onPress={calculate} />
      {result && <OutlineBtn label="입력 초기화" onPress={clearInputs} style={{ marginTop: spacing.sm }} />}

      {result && (
        <View style={[styles.resultCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <ResultRow label="수율" value={`${result.yieldPct}%`}
            color={parseFloat(result.yieldPct) >= 80 ? pal.gn : pal.yw} big pal={pal} />
          <ResultRow label="손실 중량" value={`${result.lossKg}kg`} color={pal.rd} pal={pal} />
          {result.realCost > 0 && <>
            <ResultRow label="실제 원가 (손실 반영)" value={`${result.realCost.toLocaleString()}원/kg`} color={pal.a2} pal={pal} />
            <ResultRow label="권장 판매가 (마진 55%)" value={`${result.recommend.toLocaleString()}원/kg`} color={pal.gn} big pal={pal} />
          </>}
        </View>
      )}

      {/* 히스토리 */}
      {history.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <TouchableOpacity
            style={[styles.historyToggle, { backgroundColor: pal.s1, borderColor: pal.bd }]}
            onPress={() => setShowHistory(v => !v)}
          >
            <Text style={[styles.historyToggleText, { color: pal.a2 }]}>
              📊 계산 히스토리 ({history.length}건)  {showHistory ? '▲ 접기' : '▼ 펼치기'}
            </Text>
          </TouchableOpacity>
          {showHistory && history.map(h => (
            <View key={h.id} style={[styles.historyCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
              <View style={styles.historyTop}>
                <Text style={[styles.historyLabel, { color: pal.tx }]}>{h.label}</Text>
                <Text style={[styles.historyDate, { color: pal.t3 }]}>{h.date}</Text>
              </View>
              <View style={styles.historyRow}>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatLabel, { color: pal.t3 }]}>원육</Text>
                  <Text style={[styles.historyStatVal, { color: pal.t2 }]}>{h.initWeight}kg</Text>
                </View>
                <Text style={{ color: pal.t3, fontSize: fontSize.lg }}>→</Text>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatLabel, { color: pal.t3 }]}>정육</Text>
                  <Text style={[styles.historyStatVal, { color: pal.t2 }]}>{h.finalWeight}kg</Text>
                </View>
                <View style={[styles.historyYieldBadge, { backgroundColor: parseFloat(h.yieldPct) >= 80 ? pal.gn + '20' : pal.yw + '20' }]}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '900', color: parseFloat(h.yieldPct) >= 80 ? pal.gn : pal.yw }}>
                    {h.yieldPct}%
                  </Text>
                </View>
                {h.realCost > 0 && (
                  <View style={styles.historyStat}>
                    <Text style={[styles.historyStatLabel, { color: pal.t3 }]}>실제원가</Text>
                    <Text style={[styles.historyStatVal, { color: pal.a2 }]}>{h.realCost.toLocaleString()}원</Text>
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
      '⚠️ 소비기한 수정',
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
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {today.length    > 0 && <ExpiryGroup label="🔴 오늘 만료"  items={today}    color={pal.rd} onEdit={openEdit} onLog={openLog} pal={pal} />}
      {tomorrow.length > 0 && <ExpiryGroup label="🟡 내일 만료"  items={tomorrow} color={pal.yw} onEdit={openEdit} onLog={openLog} pal={pal} />}
      {week.length     > 0 && <ExpiryGroup label="🟠 이번 주"    items={week}     color={pal.a2} onEdit={openEdit} onLog={openLog} pal={pal} />}
      {later.length    > 0 && <ExpiryGroup label="🟢 이후"       items={later}    color={pal.gn} onEdit={openEdit} onLog={openLog} pal={pal} />}

      {/* 소비기한 수정 모달 */}
      <Modal visible={editModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.editModalBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            <Text style={[styles.editModalTitle, { color: pal.tx }]}>✏️ 소비기한 수정</Text>
            <Text style={[styles.editModalSub, { color: pal.t3 }]}>
              {target?.cut}  현재: {target?.expire}
            </Text>
            {(target?.editCount > 0) && (
              <View style={[styles.editWarningBox, { backgroundColor: pal.yw + '20', borderColor: pal.yw + '50' }]}>
                <Text style={[styles.editWarningText, { color: pal.yw }]}>
                  ⚠️ 이미 {target.editCount}회 수정된 항목입니다
                </Text>
              </View>
            )}
            <Text style={[styles.fieldLabel, { color: pal.t2, marginTop: spacing.md }]}>새 소비기한 (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: pal.bg, borderColor: pal.bd, color: pal.tx }]}
              value={newExpire}
              onChangeText={setNewExpire}
              placeholder="예: 2026-04-10"
              placeholderTextColor={pal.t3}
            />
            <Text style={[styles.editNotice, { color: pal.rd }]}>
              🔴 수정 시 로그에 기록되며 취소할 수 없습니다
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <OutlineBtn label="취소" onPress={() => setEditModal(false)} style={{ flex: 1 }} />
              <PrimaryBtn label="수정 확인" onPress={handleEditSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* 수정 로그 모달 */}
      <Modal visible={logModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pal.bg }}>
          <View style={[styles.modalHeader, { backgroundColor: pal.s1, borderBottomColor: pal.bd }]}>
            <Text style={[styles.modalTitle, { color: pal.tx }]}>📋 수정 이력 — {target?.cut}</Text>
            <TouchableOpacity onPress={() => setLogModal(false)}>
              <Text style={[styles.closeBtn, { color: pal.t2 }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            {(!target?.editLog || target.editLog.length === 0) ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, { color: pal.t3 }]}>수정 이력이 없습니다</Text>
              </View>
            ) : (
              target.editLog.map((log, idx) => (
                <View key={idx} style={[styles.logCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                  <View style={[styles.logCountBadge, { backgroundColor: pal.yw + '20' }]}>
                    <Text style={[styles.logCountText, { color: pal.yw }]}>수정 {log.count}회</Text>
                  </View>
                  <Text style={[styles.logDateTime, { color: pal.t3 }]}>{log.date} {log.time}</Text>
                  <View style={styles.logChangeRow}>
                    <View style={[styles.logChangeBox, { backgroundColor: pal.rd + '15', borderColor: pal.rd + '40' }]}>
                      <Text style={[styles.logChangeLabel, { color: pal.rd }]}>변경 전</Text>
                      <Text style={[styles.logChangeVal, { color: pal.tx }]}>{log.oldExpire}</Text>
                    </View>
                    <Text style={{ color: pal.t3, fontSize: 20 }}>→</Text>
                    <View style={[styles.logChangeBox, { backgroundColor: pal.gn + '15', borderColor: pal.gn + '40' }]}>
                      <Text style={[styles.logChangeLabel, { color: pal.gn }]}>변경 후</Text>
                      <Text style={[styles.logChangeVal, { color: pal.tx }]}>{log.newExpire}</Text>
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

const ExpiryGroup = ({ label, items, color, onEdit, onLog, pal }) => (
  <View style={styles.expiryGroup}>
    <Text style={[styles.expiryGroupLabel, { color }]}>{label}</Text>
    {items.map(item => (
      <View key={item.id} style={[styles.expiryRow, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <View style={[styles.expiryDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.expiryName, { color: pal.tx }]}>{item.cut}</Text>
            {item.editCount > 0 && (
              <View style={[styles.editBadge, { backgroundColor: pal.yw + '25' }]}>
                <Text style={[styles.editBadgeText, { color: pal.yw }]}>수정 {item.editCount}회</Text>
              </View>
            )}
          </View>
          <Text style={[styles.expiryOrigin, { color: pal.t3 }]}>{item.origin}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.expiryQty, { color }]}>{item.qty}kg</Text>
          <Text style={[styles.expiryDate, { color: pal.t3 }]}>{item.expire}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {item.editCount > 0 && (
              <TouchableOpacity
                style={[styles.expiryActionBtn, { borderColor: pal.t3 + '50' }]}
                onPress={() => onLog(item)}
              >
                <Text style={[styles.expiryActionText, { color: pal.t3 }]}>로그</Text>
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

const SummaryBox = ({ icon, label, value, color, pal }) => (
  <View style={[styles.summaryBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
    <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
    <Text style={[styles.summaryVal, { color }]}>{value}</Text>
    <Text style={[styles.summaryLabel, { color: pal.t3 }]}>{label}</Text>
  </View>
);

const ResultRow = ({ label, value, color, big, pal }) => (
  <View style={[styles.resultRow, { borderBottomColor: pal.bd }]}>
    <Text style={[styles.resultLabel, { color: pal.t2 }]}>{label}</Text>
    <Text style={[styles.resultVal, { color, fontSize: big ? fontSize.xl : fontSize.lg }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabTextActive: { fontWeight: '900' },

  // 2×2 그리드
  summaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing.sm, padding: spacing.md,
  },
  summaryBox: {
    width: '48%', borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, alignItems: 'center', ...shadow.sm,
  },
  summaryVal:   { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 2 },
  summaryLabel: { fontSize: fontSize.xxs, fontWeight: '600', textAlign: 'center' },

  meatCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  priceLabel: { fontSize: fontSize.xxs },
  priceVal:   { fontSize: fontSize.sm, fontWeight: '800' },

  soldBtn:     { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, alignItems: 'center' },
  soldBtnText: { fontSize: fontSize.sm, fontWeight: '800' },

  emptyBox:  { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: fontSize.md, fontWeight: '600' },

  // 판매내역
  soldGroup:       { marginBottom: spacing.lg },
  soldGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  soldGroupDate:   { fontSize: fontSize.sm, fontWeight: '800' },
  soldGroupTotal:  { fontSize: fontSize.xs, fontWeight: '700' },
  soldCard: {
    borderRadius: radius.md, borderWidth: 1.5,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  soldCardTop:   { marginBottom: spacing.sm },
  soldBadge:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  soldCardCut:   { fontSize: fontSize.md, fontWeight: '800' },
  soldCardOrigin:{ fontSize: fontSize.xs, marginTop: 2 },
  soldCardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soldCardStat:  { alignItems: 'center' },
  soldStatLabel: { fontSize: fontSize.xxs, fontWeight: '600', marginBottom: 2 },
  soldStatVal:   { fontSize: fontSize.sm, fontWeight: '800' },

  // 수율 계산기
  rowInputs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 7 },
  inputLg: {
    borderWidth: 1.5, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 16,
    fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center', minHeight: 58,
  },

  resultCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg, ...shadow.md },
  resultRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1 },
  resultLabel:{ fontSize: fontSize.sm, fontWeight: '600' },
  resultVal:  { fontWeight: '900' },

  historyToggle: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  historyToggleText: { fontSize: fontSize.sm, fontWeight: '800' },
  historyCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  historyTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  historyLabel:{ fontSize: fontSize.sm, fontWeight: '700' },
  historyDate: { fontSize: fontSize.xs },
  historyRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  historyStat: { alignItems: 'center' },
  historyStatLabel: { fontSize: fontSize.xxs, fontWeight: '600', marginBottom: 2 },
  historyStatVal:   { fontSize: fontSize.sm, fontWeight: '800' },
  historyYieldBadge:{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },

  // 소비기한
  expiryGroup:      { marginBottom: spacing.lg },
  expiryGroupLabel: { fontSize: fontSize.sm, fontWeight: '900', marginBottom: spacing.sm, letterSpacing: 0.5 },
  expiryRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  expiryDot:    { width: 10, height: 10, borderRadius: 5 },
  expiryName:   { fontSize: fontSize.md, fontWeight: '800' },
  expiryOrigin: { fontSize: fontSize.xs, marginTop: 2 },
  expiryQty:    { fontSize: fontSize.md, fontWeight: '900' },
  expiryDate:   { fontSize: fontSize.xs, marginTop: 2 },
  editBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  editBadgeText:{ fontSize: fontSize.xxs, fontWeight: '800' },
  expiryActionBtn:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  expiryActionText: { fontSize: fontSize.xxs, fontWeight: '800' },

  // 수정 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  editModalBox: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  editModalTitle: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 6 },
  editModalSub:   { fontSize: fontSize.sm, marginBottom: spacing.sm },
  editWarningBox: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, marginBottom: spacing.sm },
  editWarningText:{ fontSize: fontSize.sm, fontWeight: '700' },
  editNotice:     { fontSize: fontSize.xs, fontWeight: '700', marginTop: spacing.sm },

  // 로그 모달
  logCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  logCountBadge:  { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  logCountText:   { fontSize: fontSize.xs, fontWeight: '800' },
  logDateTime:    { fontSize: fontSize.xs, marginBottom: spacing.sm },
  logChangeRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logChangeBox:   { flex: 1, borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, alignItems: 'center' },
  logChangeLabel: { fontSize: fontSize.xxs, fontWeight: '700', marginBottom: 4 },
  logChangeVal:   { fontSize: fontSize.sm, fontWeight: '800' },

  modalHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '900' },
  closeBtn:   { fontSize: 22, padding: 4 },
  input: { borderWidth: 1.5, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.sm, minHeight: 52 },
});
