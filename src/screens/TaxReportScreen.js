/**
 * TaxReportScreen — 세무 리포트
 * - 월별 매출 요약 (부가세 신고 참고용)
 * - 부가세 과세/면세 분리
 * - CSV 다운로드 (세무사 제출용)
 * - 분기별 부가세 예상액 계산
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Share, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../lib/ThemeContext';
import { darkColors, lightColors, fontSize, spacing, radius, shadow } from '../theme';
import { meatStore } from '../lib/dataStore';
import { meats as mockMeats } from '../data/mockData';

// ── 상수 ────────────────────────────────────────────────────
// 식육은 기본 면세(영세율). 가공품(소시지 등)은 과세.
// 여기선 단순화: 전체 면세로 처리하고 비고에 안내 표시
const VAT_RATE = 0.1;

function fmt(n) {
  if (!n && n !== 0) return '-';
  return Math.round(n).toLocaleString('ko-KR');
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(/\./g, '-'));
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(key) {
  const [y, m] = key.split('-');
  return `${y}년 ${parseInt(m)}월`;
}

function quarter(monthKey) {
  const m = parseInt(monthKey.split('-')[1]);
  return Math.ceil(m / 3);
}

// ── 데이터 집계 ─────────────────────────────────────────────
function buildMonthlyReport(items) {
  const byMonth = {};

  items.forEach(item => {
    // 판매 완료(sold)인 항목만
    if (!item.sold) return;
    const key = monthKey(item.soldDate) || monthKey(item.expire);
    if (!key) return;

    if (!byMonth[key]) {
      byMonth[key] = {
        month: key,
        salesCount: 0,
        totalQty: 0,
        totalSales: 0,       // 총 매출
        totalCost: 0,        // 총 매입
        totalMargin: 0,      // 마진
        exemptSales: 0,      // 면세 매출 (식육)
        taxableSales: 0,     // 과세 매출
        estimatedVat: 0,     // 부가세 예상
        items: [],
      };
    }
    const row = byMonth[key];
    const sales = (item.sellPrice || 0) * (item.qty || 0);
    const cost = (item.buyPrice || 0) * (item.qty || 0);
    row.salesCount += 1;
    row.totalQty += item.qty || 0;
    row.totalSales += sales;
    row.totalCost += cost;
    row.totalMargin += (sales - cost);
    row.exemptSales += sales; // 식육 전체 면세
    row.items.push(item);
  });

  // 미판매 재고 — 매입 비용에 포함 (당월 입고일 기준)
  items.forEach(item => {
    if (item.sold) return;
    const key = monthKey(item.inboundDate) || monthKey(item.expire);
    if (!key) return;
    if (!byMonth[key]) {
      byMonth[key] = {
        month: key,
        salesCount: 0, totalQty: 0,
        totalSales: 0, totalCost: 0, totalMargin: 0,
        exemptSales: 0, taxableSales: 0, estimatedVat: 0, items: [],
      };
    }
    byMonth[key].totalCost += (item.buyPrice || 0) * (item.qty || 0);
  });

  return Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
}

// ── CSV 생성 ────────────────────────────────────────────────
function buildCSV(months, bizName) {
  const bom = '\uFEFF'; // Excel UTF-8 BOM
  const header = [
    '년월', '매출건수', '총판매중량(kg)', '총매출(원)', '총매입(원)', '마진(원)', '마진율(%)',
    '면세매출(원)', '과세매출(원)', '비고',
  ].join(',');

  const rows = months.map(m => {
    const marginPct = m.totalSales > 0 ? ((m.totalMargin / m.totalSales) * 100).toFixed(1) : '0.0';
    return [
      formatMonth(m.month),
      m.salesCount,
      m.totalQty.toFixed(2),
      Math.round(m.totalSales),
      Math.round(m.totalCost),
      Math.round(m.totalMargin),
      marginPct,
      Math.round(m.exemptSales),
      Math.round(m.taxableSales),
      '식육 면세',
    ].join(',');
  });

  // 합계 행
  const total = months.reduce((acc, m) => ({
    sales: acc.sales + m.totalSales,
    cost: acc.cost + m.totalCost,
    margin: acc.margin + m.totalMargin,
    cnt: acc.cnt + m.salesCount,
  }), { sales: 0, cost: 0, margin: 0, cnt: 0 });
  const totalPct = total.sales > 0 ? ((total.margin / total.sales) * 100).toFixed(1) : '0.0';
  const totalRow = ['합계', total.cnt, '', Math.round(total.sales), Math.round(total.cost), Math.round(total.margin), totalPct, '', '', ''].join(',');

  const notice = [
    '',
    '※ 본 자료는 MeatBig 앱 데이터 기준 참고용입니다.',
    `※ 매장명: ${bizName || ''}`,
    `※ 출력일: ${new Date().toLocaleDateString('ko-KR')}`,
    '※ 식육(생육)은 부가가치세 면세 품목입니다. (부가가치세법 제26조)',
    '※ 가공육(소시지·햄 등)은 과세 품목이므로 별도 신고 필요.',
    '※ 세무 신고는 반드시 세무사와 상담하시기 바랍니다.',
  ].join('\n');

  return bom + [header, ...rows, totalRow, notice].join('\n');
}

// ── 컴포넌트 ────────────────────────────────────────────────
export default function TaxReportScreen() {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [bizName, setBizName] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('@meatbig_biz').catch(() => null);
      if (raw) {
        const biz = JSON.parse(raw);
        setBizName(biz.bizName || '');
        setBizNo(biz.bizNo || '');
      }
      const items = await meatStore.load(mockMeats);
      const report = buildMonthlyReport(items);
      setMonths(report);
      setLoading(false);
    })();
  }, []);

  // 선택 연도 필터
  const filteredMonths = months.filter(m => m.month.startsWith(String(selectedYear)));

  // 연도 목록 (데이터 기반)
  const years = [...new Set(months.map(m => parseInt(m.month.split('-')[0])))].sort((a, b) => b - a);
  if (years.length === 0) years.push(new Date().getFullYear());

  // 분기별 집계
  const quarterSummary = [1, 2, 3, 4].map(q => {
    const qMonths = filteredMonths.filter(m => quarter(m.month) === q);
    return {
      q,
      totalSales: qMonths.reduce((s, m) => s + m.totalSales, 0),
      totalCost: qMonths.reduce((s, m) => s + m.totalCost, 0),
      totalMargin: qMonths.reduce((s, m) => s + m.totalMargin, 0),
      months: qMonths.length,
    };
  }).filter(q => q.months > 0);

  // 연간 합계
  const annualTotal = filteredMonths.reduce((acc, m) => ({
    sales: acc.sales + m.totalSales,
    cost: acc.cost + m.totalCost,
    margin: acc.margin + m.totalMargin,
    cnt: acc.cnt + m.salesCount,
  }), { sales: 0, cost: 0, margin: 0, cnt: 0 });

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const csv = buildCSV(filteredMonths, bizName);
      const d = new Date();
      const datePrefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const filename = `${datePrefix}_세무리포트_${selectedYear}.csv`;

      if (Platform.OS === 'web') {
        Alert.alert('CSV', 'PC에서만 다운로드 가능합니다.');
        setExporting(false);
        return;
      }

      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: `${selectedYear}년 세무 리포트 CSV`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('공유 불가', '이 기기에서는 파일 공유를 지원하지 않습니다.');
      }
    } catch (e) {
      Alert.alert('오류', 'CSV 생성 중 문제가 발생했습니다: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={pal.ac} />
      </View>
    );
  }

  const marginPct = annualTotal.sales > 0
    ? ((annualTotal.margin / annualTotal.sales) * 100).toFixed(1)
    : '0.0';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: pal.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>

      {/* 헤더 + 연도 선택 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.pageTitle, { color: pal.tx }]}>세무 리포트</Text>
          {bizName ? <Text style={[s.pageSub, { color: pal.t3 }]}>{bizName} · {bizNo}</Text> : null}
        </View>
        <TouchableOpacity
          style={[s.exportBtn, { backgroundColor: pal.gn + '20', borderColor: pal.gn + '60' }]}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color={pal.gn} />
            : <Text style={[s.exportBtnText, { color: pal.gn }]}>📥 CSV</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 연도 탭 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
        {years.map(y => (
          <TouchableOpacity
            key={y}
            style={[s.yearTab, {
              backgroundColor: selectedYear === y ? pal.ac : pal.s1,
              borderColor: selectedYear === y ? pal.ac : pal.bd,
            }]}
            onPress={() => setSelectedYear(y)}
          >
            <Text style={[s.yearTabText, { color: selectedYear === y ? '#fff' : pal.t2 }]}>{y}년</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredMonths.length === 0 ? (
        <View style={[s.emptyBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>📊</Text>
          <Text style={[s.emptyTitle, { color: pal.tx }]}>{selectedYear}년 데이터 없음</Text>
          <Text style={[s.emptyDesc, { color: pal.t3 }]}>
            재고를 판매 완료 처리하면{'\n'}자동으로 매출이 집계됩니다
          </Text>
        </View>
      ) : (
        <>
          {/* 연간 요약 카드 */}
          <View style={[s.annualCard, { backgroundColor: pal.s2, borderColor: pal.ac + '40' }]}>
            <Text style={[s.annualYear, { color: pal.t2 }]}>{selectedYear}년 연간 요약</Text>
            <View style={s.annualRow}>
              <StatBox label="총 매출" value={`${fmt(annualTotal.sales)}원`} color={pal.gn} pal={pal} />
              <StatBox label="총 매입" value={`${fmt(annualTotal.cost)}원`} color={pal.a2} pal={pal} />
              <StatBox label="마진율" value={`${marginPct}%`} color={pal.cyan} pal={pal} />
            </View>
            <View style={[s.taxNotice, { backgroundColor: pal.s1 + '80', borderColor: pal.bd }]}>
              <Text style={[s.taxNoticeText, { color: pal.t2 }]}>
                🧾 식육(생육) 면세 · 부가세 신고 시 참고용 자료
              </Text>
            </View>
          </View>

          {/* 분기별 요약 */}
          {quarterSummary.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: pal.t3 }]}>분기별 현황</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
                {quarterSummary.map(q => (
                  <View key={q.q} style={[s.quarterCard, { backgroundColor: pal.s1, borderColor: pal.bd, flex: 1, minWidth: '45%' }]}>
                    <Text style={[s.quarterLabel, { color: pal.t3 }]}>{q.q}분기</Text>
                    <Text style={[s.quarterSales, { color: pal.tx }]}>{fmt(q.totalSales)}원</Text>
                    <Text style={[s.quarterMargin, { color: q.totalMargin >= 0 ? pal.gn : pal.rd }]}>
                      마진 {fmt(q.totalMargin)}원
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* 월별 상세 */}
          <Text style={[s.sectionTitle, { color: pal.t3 }]}>월별 매출 상세</Text>
          {filteredMonths.map(m => {
            const mPct = m.totalSales > 0 ? ((m.totalMargin / m.totalSales) * 100).toFixed(1) : '0.0';
            const isExpanded = expandedMonth === m.month;
            return (
              <TouchableOpacity
                key={m.month}
                style={[s.monthCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}
                onPress={() => setExpandedMonth(isExpanded ? null : m.month)}
                activeOpacity={0.8}
              >
                {/* 월 요약 행 */}
                <View style={s.monthHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.monthTitle, { color: pal.tx }]}>{formatMonth(m.month)}</Text>
                    <Text style={[s.monthSub, { color: pal.t3 }]}>판매 {m.salesCount}건 · {m.totalQty.toFixed(1)}kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.monthSales, { color: pal.tx }]}>{fmt(m.totalSales)}원</Text>
                    <Text style={[s.monthMargin, { color: m.totalMargin >= 0 ? pal.gn : pal.rd }]}>
                      마진 {mPct}%
                    </Text>
                  </View>
                  <Text style={[s.chevron, { color: pal.t3 }]}>{isExpanded ? '▲' : '▼'}</Text>
                </View>

                {/* 확장: 세부 항목 */}
                {isExpanded && (
                  <View style={[s.expandBox, { borderTopColor: pal.bd }]}>
                    {/* 세무 요약 테이블 */}
                    <TaxRow label="총 매출액" value={`${fmt(m.totalSales)}원`} pal={pal} />
                    <TaxRow label="총 매입액" value={`${fmt(m.totalCost)}원`} pal={pal} />
                    <TaxRow label="매출이익" value={`${fmt(m.totalMargin)}원`} pal={pal} highlight={m.totalMargin >= 0 ? pal.gn : pal.rd} />
                    <TaxRow label="면세 매출" value={`${fmt(m.exemptSales)}원`} pal={pal} />
                    <TaxRow label="과세 매출" value={`${fmt(m.taxableSales)}원`} pal={pal} />
                    <View style={{ marginTop: spacing.sm }}>
                      <Text style={[s.taxNote, { color: pal.t3 }]}>
                        ※ 식육(생육)은 부가세 면세 품목 (부가가치세법 제26조)
                      </Text>
                    </View>

                    {/* 판매 항목 목록 */}
                    {m.items.length > 0 && (
                      <>
                        <Text style={[s.itemListTitle, { color: pal.t2, marginTop: spacing.sm }]}>판매 내역</Text>
                        {m.items.map((item, idx) => (
                          <View key={idx} style={[s.itemRow, { borderBottomColor: pal.bd + '40' }]}>
                            <Text style={[s.itemCut, { color: pal.tx }]}>{item.cut}</Text>
                            <Text style={[s.itemOrigin, { color: pal.t3 }]}>{item.origin}</Text>
                            <Text style={[s.itemQty, { color: pal.t2 }]}>{item.qty}kg</Text>
                            <Text style={[s.itemPrice, { color: pal.tx }]}>{fmt(item.sellPrice * item.qty)}원</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* 부가세 안내 */}
          <View style={[s.vatGuide, { backgroundColor: pal.s1, borderColor: pal.cyan + '40' }]}>
            <Text style={[s.vatGuideTitle, { color: pal.cyan }]}>💡 부가세 신고 안내</Text>
            <Text style={[s.vatGuideText, { color: pal.t2 }]}>
              • 식육(생육·냉장·냉동) → <Text style={{ color: pal.gn, fontWeight: '700' }}>면세</Text>{'\n'}
              • 가공품(소시지·햄·베이컨 등) → <Text style={{ color: pal.rd, fontWeight: '700' }}>과세 (10%)</Text>{'\n'}
              • 부가세 신고 기간: 1기(1~6월) 7월 25일 / 2기(7~12월) 1월 25일{'\n'}
              • 본 리포트는 참고용이며 세무사 확인을 권장합니다
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────────
function StatBox({ label, value, color, pal }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: pal.t3, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: fontSize.sm, fontWeight: '900', color }}>{value}</Text>
    </View>
  );
}

function TaxRow({ label, value, pal, highlight }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontSize: fontSize.xs, color: pal.t3 }}>{label}</Text>
      <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: highlight || pal.tx }}>{value}</Text>
    </View>
  );
}

// ── 스타일 ───────────────────────────────────────────────────
const s = StyleSheet.create({
  pageTitle: { fontSize: fontSize.xl, fontWeight: '900' },
  pageSub: { fontSize: fontSize.xs, marginTop: 2 },
  exportBtn: {
    borderWidth: 1, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  exportBtnText: { fontSize: fontSize.sm, fontWeight: '800' },
  yearTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.sm, borderWidth: 1, marginRight: 8,
  },
  yearTabText: { fontSize: fontSize.sm, fontWeight: '700' },
  annualCard: {
    borderRadius: radius.lg, borderWidth: 1.5,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  annualYear: { fontSize: fontSize.xs, fontWeight: '700', marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  annualRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  taxNotice: { borderRadius: radius.sm, borderWidth: 1, padding: 8 },
  taxNoticeText: { fontSize: 11, textAlign: 'center' },
  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  quarterCard: {
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md,
  },
  quarterLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  quarterSales: { fontSize: fontSize.sm, fontWeight: '900', marginBottom: 2 },
  quarterMargin: { fontSize: 11, fontWeight: '700' },
  monthCard: {
    borderRadius: radius.md, borderWidth: 1,
    marginBottom: spacing.sm, overflow: 'hidden',
  },
  monthHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
  },
  monthTitle: { fontSize: fontSize.sm, fontWeight: '800' },
  monthSub: { fontSize: fontSize.xxs, marginTop: 2 },
  monthSales: { fontSize: fontSize.sm, fontWeight: '900' },
  monthMargin: { fontSize: fontSize.xxs, fontWeight: '700', marginTop: 2 },
  chevron: { fontSize: 12, marginLeft: 4 },
  expandBox: { borderTopWidth: 1, padding: spacing.md },
  taxNote: { fontSize: 11, lineHeight: 16 },
  itemListTitle: { fontSize: fontSize.xs, fontWeight: '700', marginBottom: 6 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, gap: 6,
  },
  itemCut: { fontSize: fontSize.xs, fontWeight: '700', flex: 2 },
  itemOrigin: { fontSize: 10, flex: 1 },
  itemQty: { fontSize: fontSize.xs, flex: 1, textAlign: 'right' },
  itemPrice: { fontSize: fontSize.xs, fontWeight: '700', flex: 2, textAlign: 'right' },
  vatGuide: {
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.lg, marginTop: spacing.lg,
  },
  vatGuideTitle: { fontSize: fontSize.sm, fontWeight: '900', marginBottom: spacing.sm },
  vatGuideText: { fontSize: fontSize.xs, lineHeight: 22 },
  emptyBox: {
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.xl, alignItems: 'center',
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 6 },
  emptyDesc: { fontSize: fontSize.xs, textAlign: 'center', lineHeight: 20 },
});
