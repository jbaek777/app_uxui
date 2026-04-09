import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, darkColors, lightColors, radius, shadow, fontSize, spacing } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { GaugeBar } from '../components/GaugeBar';
import { meatInventory, hygieneData } from '../data/mockData';
import { meatStore, hygieneStore } from '../lib/dataStore';

// camelCase / snake_case 둘 다 지원
const getBuyPrice  = m => m.buyPrice  || m.buy_price  || 0;
const getSellPrice = m => m.sellPrice || m.sell_price || 0;
const getDday = m => m.dday != null ? m.dday : 99;

// 마진율 계산 (%)
const getMarginPct = m => {
  const buy = getBuyPrice(m);
  const sell = getSellPrice(m);
  if (!buy || !sell) return null;
  return Math.round((sell - buy) / buy * 100);
};

export default function DashboardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const [bizName, setBizName] = useState('');
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR');
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const [meat, setMeat] = useState([]);
  const [hygieneLogs, setHygieneLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('@meatbig_biz').then(raw => {
      if (raw) {
        try { setBizName(JSON.parse(raw).bizName || ''); } catch (_) {}
      }
    });
  }, []);

  useEffect(() => {
    Promise.all([
      meatStore.load(meatInventory),
      hygieneStore.load(hygieneData),
    ]).then(([meatData, hygieneData]) => {
      setMeat(meatData);
      setHygieneLogs(hygieneData);
      setLoading(false);
    });
  }, []);

  const activeMeat = meat.filter(m => !m.sold);
  const urgent = activeMeat.filter(m => getDday(m) <= 1);
  const nearExpiry3 = activeMeat.filter(m => getDday(m) <= 3);
  const potentialLoss = nearExpiry3.reduce((s, m) => s + (m.qty || 0) * getBuyPrice(m), 0);
  const criticalLoss = urgent.reduce((s, m) => s + (m.qty || 0) * getBuyPrice(m), 0);

  // ── 마진 분석 데이터 ──────────────────────────────────────
  const marginItems = activeMeat
    .filter(m => getBuyPrice(m) > 0 && getSellPrice(m) > 0)
    .map(m => ({
      ...m,
      marginPct:   getMarginPct(m),
      marginPerKg: getSellPrice(m) - getBuyPrice(m),
    }))
    .filter(m => m.marginPct !== null)
    .sort((a, b) => b.marginPct - a.marginPct);

  const topMargin  = marginItems.slice(0, 3);
  const lowMargin  = [...marginItems].sort((a, b) => a.marginPct - b.marginPct).slice(0, 3);
  const maxMarginPct = marginItems.length > 0 ? marginItems[0].marginPct : 100;

  // 이번 달 실현 마진 (판매완료 기준)
  const soldMeat = meat.filter(m => m.sold);
  const thisMonthStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const soldThisMonth = soldMeat.filter(m => {
    const d = m.soldDate || '';
    // 한국식 "2026. 4. 5." 또는 ISO "2026-04-05" 모두 지원
    const yr = String(today.getFullYear());
    const mo = String(today.getMonth() + 1);
    return d.includes(yr) && (d.includes(mo + '월') || d.startsWith(`${yr}-${mo.padStart(2,'0')}`));
  });
  const monthRevenue = soldThisMonth.reduce((s, m) => s + (m.qty || 0) * getSellPrice(m), 0);
  const monthCost    = soldThisMonth.reduce((s, m) => s + (m.qty || 0) * getBuyPrice(m), 0);
  const monthProfit  = monthRevenue - monthCost;
  const monthMarginPct = monthRevenue > 0 ? Math.round(monthProfit / monthRevenue * 100) : null;

  // 오늘 위생점검 완료 여부
  const todayISO = today.toISOString().slice(0, 10); // "2026-03-29"
  const todayHygiene = hygieneLogs.filter(h => {
    const d = h.log_date || h.date || '';
    return d === todayStr || d === todayISO || (d ? d.startsWith(todayISO) : false);
  });
  const hygieneNeeded = todayHygiene.length === 0;
  const tempNeeded = true; // 온도 기록 화면 연동 시 교체

  const QUICK_ACTIONS = [
    { icon: '🏷️', label: '이력\n스캔',  tab: 'TraceTab',    screen: 'Scan',     color: pal.ac,   initial: true  },
    { icon: '📋', label: '위생\n일지',  tab: 'DocsTab',     screen: 'Hygiene',  color: pal.gn,   initial: true  },
    { icon: '🥩', label: '숙성\n관리',  tab: 'DocsTab',     screen: 'Aging',    color: pal.a2,   initial: false },
    { icon: '🖨️', label: '서류\n출력',  tab: 'DocsTab',     screen: 'Documents',color: pal.pu,   initial: true  },
    { icon: '💰', label: '마감\n정산',  tab: 'DocsTab',     screen: 'Closing',  color: pal.cyan, initial: true  },
    { icon: '📦', label: '재고\n확인',  tab: 'InventoryTab',screen: null,       color: pal.a2,   initial: true  },
  ];

  // 이번 달 위생 점수 계산 (pass 비율 기반)
  const thisMonth = hygieneLogs.filter(h => {
    const d = h.log_date || h.date || '';
    return d.includes(today.getMonth() + 1 + '월') || d.startsWith(today.toISOString().slice(0, 7));
  });
  const hygieneScore = thisMonth.length === 0 ? '--' :
    Math.round((thisMonth.filter(h => h.status === 'pass').length / thisMonth.length) * 100);

  const cardBg = isDark
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(0,0,0,0.03)';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={pal.ac} />
        <Text style={{ color: pal.t3, marginTop: 12, fontSize: fontSize.sm }}>데이터 불러오는 중...</Text>
      </View>
    );
  }

  // 오늘 점검 완료 수 계산
  const checkDoneCount = [!hygieneNeeded, !tempNeeded, true].filter(Boolean).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: pal.bg }]}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + spacing.md }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── 1. 헤더 ── */}
      <View style={styles.header}>
        <Text style={{ fontSize: fontSize.xs, color: pal.t3, marginBottom: 6, fontWeight: '600' }}>{dateStr}</Text>
        <Text style={{ fontSize: fontSize.lg, color: pal.tx, fontWeight: '700', marginBottom: 2 }}>안녕하세요,</Text>
        <Text style={{ fontSize: fontSize.xxl, color: pal.tx, fontWeight: '900' }}>
          <Text style={{ color: pal.ac }}>{bizName || '사장님'}</Text>
          {bizName ? ' 사장님 👋' : ' 👋'}
        </Text>
      </View>

      {/* ── 2. 오늘의 필수 점검 요약 (3-stat 박스) ── */}
      <View style={styles.statRow}>
        <View style={[styles.statBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={{ fontSize: fontSize.xxl, fontWeight: '900', color: pal.a2 }}>{activeMeat.length}</Text>
          <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 4, fontWeight: '700' }}>📦 재고종류</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={{ fontSize: fontSize.xxl, fontWeight: '900', color: nearExpiry3.length > 0 ? pal.rd : pal.gn }}>
            {nearExpiry3.length}
          </Text>
          <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 4, fontWeight: '700' }}>⚠️ 소비기한임박</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={{ fontSize: fontSize.xxl, fontWeight: '900', color: pal.gn }}>{checkDoneCount}/3</Text>
          <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 4, fontWeight: '700' }}>✅ 오늘 점검</Text>
        </View>
      </View>

      {/* ── 3. 오늘의 점검 섹션 ── */}
      <SectionHeader
        label="오늘의 점검"
        linkLabel="전체 보기"
        pal={pal}
        onLink={() => navigation.navigate('DocsTab')}
      />
      <View style={[styles.checkCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        {/* 이력번호 조회 */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => navigation.navigate('TraceTab', { screen: 'Scan' })}
          activeOpacity={0.75}
        >
          <View style={[styles.dot, { backgroundColor: pal.rd }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.tx }}>이력번호 조회</Text>
            <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 2 }}>바코드 스캔으로 확인</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: pal.rd + '20' }]}>
            <Text style={{ fontSize: fontSize.xxs, fontWeight: '800', color: pal.rd }}>2건</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.checkDivider, { borderTopColor: pal.bd }]} />

        {/* 위생점검 */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => navigation.navigate('DocsTab', { screen: 'Hygiene' })}
          activeOpacity={0.75}
        >
          <View style={[styles.dot, { backgroundColor: hygieneNeeded ? pal.yw : pal.gn }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.tx }}>위생점검</Text>
            <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 2 }}>오전 위생일지 작성</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: (hygieneNeeded ? pal.yw : pal.gn) + '20' }]}>
            <Text style={{ fontSize: fontSize.xxs, fontWeight: '800', color: hygieneNeeded ? pal.yw : pal.gn }}>
              {hygieneNeeded ? '미완료' : '완료'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.checkDivider, { borderTopColor: pal.bd }]} />

        {/* 냉장고 온도 */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => navigation.navigate('DocsTab', { screen: 'Temp' })}
          activeOpacity={0.75}
        >
          <View style={[styles.dot, { backgroundColor: tempNeeded ? pal.cyan : pal.gn }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.tx }}>냉장고 온도</Text>
            <Text style={{ fontSize: fontSize.xxs, color: pal.t3, marginTop: 2 }}>온도 기록 및 확인</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: (tempNeeded ? pal.cyan : pal.gn) + '20' }]}>
            <Text style={{ fontSize: fontSize.xxs, fontWeight: '800', color: tempNeeded ? pal.cyan : pal.gn }}>
              {tempNeeded ? '기록 필요' : '완료'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 4. 재고 현황 ── */}
      <SectionHeader
        label="재고 현황"
        linkLabel="재고 보기"
        pal={pal}
        onLink={() => navigation.navigate('InventoryTab')}
      />
      {activeMeat.length === 0 ? (
        <StartGuide pal={pal} navigation={navigation} />
      ) : (
        <View style={[styles.sectionCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <View style={styles.gaugeList}>
            {activeMeat.slice(0, 4).map(item => (
              <GaugeBar
                key={item.id}
                label={item.cut}
                sub={item.origin}
                value={item.qty}
                max={20}
                unit="kg"
                dday={getDday(item)}
                height={12}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── 5. 손실 방어 카드 ── */}
      <SectionHeader label="손실 방어 현황" pal={pal} />
      <TouchableOpacity
        style={[styles.lossCard, {
          backgroundColor: criticalLoss > 0 ? pal.rd + '10' : pal.s1,
          borderColor: criticalLoss > 0 ? pal.rd + '40' : pal.bd,
        }]}
        onPress={() => navigation.navigate('InventoryTab')}
        activeOpacity={0.85}
      >
        <View style={styles.lossHeader}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.md, fontWeight: '800', color: pal.tx, marginBottom: 3 }}>
              ⚠️ 3일 내 소비기한 손실 예상
            </Text>
            <Text style={{ fontSize: fontSize.xxs, color: pal.t3 }}>
              {nearExpiry3.length > 0
                ? `${nearExpiry3.slice(0, 3).map(m => m.cut).join('·')}${nearExpiry3.length > 3 ? ` 외 ${nearExpiry3.length - 3}건` : ` ${nearExpiry3.length}건`}`
                : '소비기한 임박 재고 없음'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: fontSize.xl, fontWeight: '900', color: potentialLoss > 0 ? pal.rd : pal.gn }}>
              {potentialLoss > 0 ? `₩${potentialLoss.toLocaleString()}` : '이상 없음'}
            </Text>
            {potentialLoss > 0 && (
              <Text style={{ fontSize: 20 }}>🚨</Text>
            )}
          </View>
        </View>

        {nearExpiry3.length > 0 && (
          <View style={[styles.lossDivider, { borderTopColor: pal.bd + '60' }]}>
            {nearExpiry3.slice(0, 3).map(item => (
              <View key={item.id} style={styles.lossRow}>
                <View style={[styles.lossDot, {
                  backgroundColor: getDday(item) === 0 ? pal.rd : getDday(item) === 1 ? pal.yw : pal.a2,
                }]} />
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.tx }}>{item.cut}</Text>
                <Text style={{ fontSize: fontSize.xs, color: pal.t2 }}>{item.qty}kg</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: fontSize.xs, fontWeight: '800', color: getDday(item) <= 1 ? pal.rd : pal.yw }}>
                  {getDday(item) === 0 ? '오늘 만료' : `D-${getDday(item)}`}
                </Text>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: pal.t3, marginLeft: spacing.sm }}>
                  {(((item.qty || 0) * getBuyPrice(item)) / 10000).toFixed(1)}만원
                </Text>
              </View>
            ))}
            {nearExpiry3.length > 3 && (
              <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: pal.a2, textAlign: 'right', marginTop: 4 }}>
                + {nearExpiry3.length - 3}개 더 보기 →
              </Text>
            )}
          </View>
        )}

        {potentialLoss === 0 && (
          <View style={[styles.lossDivider, { borderTopColor: pal.bd + '60' }]}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: pal.gn, textAlign: 'center', paddingVertical: 4 }}>
              ✓ 3일 이내 만료 재고 없음 — 현황 양호
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── 6. 마진 분석 ── */}
      {marginItems.length > 0 && (
        <>
          <SectionHeader label="마진 분석" pal={pal} />

          {/* 이번 달 실현 마진 요약 */}
          {soldThisMonth.length > 0 && (
            <View style={[styles.marginSummaryRow, { marginHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
              <View style={[styles.marginSummaryBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                <Text style={[styles.marginSummaryLabel, { color: pal.t3 }]}>이달 매출</Text>
                <Text style={[styles.marginSummaryVal, { color: pal.a2 }]}>{(monthRevenue / 10000).toFixed(0)}만원</Text>
              </View>
              <View style={[styles.marginSummaryBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                <Text style={[styles.marginSummaryLabel, { color: pal.t3 }]}>이달 마진</Text>
                <Text style={[styles.marginSummaryVal, { color: monthProfit >= 0 ? pal.gn : pal.rd }]}>
                  {monthProfit >= 0 ? '+' : ''}{(monthProfit / 10000).toFixed(0)}만원
                </Text>
              </View>
              <View style={[styles.marginSummaryBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
                <Text style={[styles.marginSummaryLabel, { color: pal.t3 }]}>마진율</Text>
                <Text style={[styles.marginSummaryVal, { color: monthMarginPct >= 25 ? pal.gn : pal.yw }]}>
                  {monthMarginPct !== null ? `${monthMarginPct}%` : '--'}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.sectionCard, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
            {/* TOP 3 고마진 */}
            <View style={styles.marginGroupHeader}>
              <View style={[styles.marginGroupBadge, { backgroundColor: pal.gn + '20' }]}>
                <Text style={[styles.marginGroupBadgeText, { color: pal.gn }]}>🏆 고마진 TOP 3</Text>
              </View>
            </View>
            {topMargin.map((item, idx) => (
              <MarginBar key={item.id} item={item} rank={idx + 1} maxPct={maxMarginPct} color={pal.gn} pal={pal} />
            ))}
            {topMargin.length === 0 && (
              <Text style={{ color: pal.t3, fontSize: fontSize.xs, paddingVertical: 8, textAlign: 'center' }}>마진 데이터 없음</Text>
            )}

            {/* 구분선 */}
            <View style={[styles.marginDivider, { borderTopColor: pal.bd }]} />

            {/* LOW 3 저마진 — topMargin과 겹치지 않는 경우만 */}
            {lowMargin.some(l => !topMargin.find(t => t.id === l.id)) && (
              <>
                <View style={[styles.marginGroupHeader, { marginTop: 4 }]}>
                  <View style={[styles.marginGroupBadge, { backgroundColor: pal.rd + '18' }]}>
                    <Text style={[styles.marginGroupBadgeText, { color: pal.rd }]}>⚠️ 저마진 하위 3</Text>
                  </View>
                </View>
                {lowMargin.filter(l => !topMargin.find(t => t.id === l.id)).map((item, idx) => (
                  <MarginBar key={item.id} item={item} rank={idx + 1} maxPct={maxMarginPct} color={pal.rd} pal={pal} lowMode />
                ))}
              </>
            )}

            {/* 전체 바 차트 (3개 초과 시) */}
            {marginItems.length > 3 && (
              <>
                <View style={[styles.marginDivider, { borderTopColor: pal.bd }]} />
                <Text style={[styles.marginChartTitle, { color: pal.t2 }]}>📊 전체 부위별 마진율</Text>
                {marginItems.map(item => (
                  <View key={item.id} style={styles.marginChartRow}>
                    <Text style={[styles.marginChartCut, { color: pal.t2 }]} numberOfLines={1}>{item.cut}</Text>
                    <View style={styles.marginChartBarWrap}>
                      <View
                        style={[
                          styles.marginChartBar,
                          {
                            width: `${Math.max(4, Math.round((item.marginPct / (maxMarginPct || 1)) * 100))}%`,
                            backgroundColor: item.marginPct >= 30 ? pal.gn : item.marginPct >= 15 ? pal.yw : pal.rd,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.marginChartPct, {
                      color: item.marginPct >= 30 ? pal.gn : item.marginPct >= 15 ? pal.yw : pal.rd,
                    }]}>{item.marginPct}%</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </>
      )}

      {/* ── 7. 빠른 실행 6개 그리드 ── */}
      <SectionHeader label="빠른 실행" pal={pal} />
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((q, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.quickBtn, { backgroundColor: pal.s1, borderColor: pal.bd }]}
            onPress={() => {
              if (q.screen) navigation.navigate(q.tab, { screen: q.screen, initial: q.initial });
              else navigation.navigate(q.tab);
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: q.color + '22' }]}>
              <Text style={{ fontSize: 26 }}>{q.icon}</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '800', color: pal.tx, textAlign: 'center', marginTop: 6 }}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function SectionHeader({ label, linkLabel, pal, onLink }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={{ fontSize: fontSize.md, fontWeight: '800', color: pal.tx }}>{label}</Text>
      {linkLabel && onLink && (
        <TouchableOpacity onPress={onLink}>
          <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: pal.a2 }}>{linkLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const GUIDE_STEPS = [
  {
    step: '1',
    icon: '📦',
    title: '첫 재고 등록',
    desc: '재고 탭 → "+ 재고 추가"\n부위·매입가·소비기한을 입력하면\n마진 분석이 자동으로 시작됩니다',
    tip: '💡 거래명세서 사진을 찍으면 AI가 자동으로 채워줍니다',
    tab: 'InventoryTab',
    screen: null,
    color: '#3b82f6',
  },
  {
    step: '2',
    icon: '🧼',
    title: '위생 점검 시작',
    desc: '서류 탭 → "위생 일지"\nHACCP 기준 6개 항목을\n매일 기록해 위생점수를 관리합니다',
    tip: '💡 매일 오전 9시 푸시 알림으로 알려드립니다',
    tab: 'DocsTab',
    screen: 'Hygiene',
    color: '#22c55e',
  },
  {
    step: '3',
    icon: '🔍',
    title: '스캔 탭 활용',
    desc: '스캔 탭 → 이력 조회 또는 서류 OCR\n바코드로 원산지·등급 확인,\n서류 촬영으로 재고 자동 등록',
    tip: '💡 거래명세서 OCR → 재고 자동 등록, 보건증 OCR → 직원 서류 업데이트',
    tab: 'TraceTab',
    screen: 'Scan',
    color: '#f59e0b',
  },
];

function StartGuide({ pal, navigation }) {
  return (
    <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm }}>
      {/* 헤더 배너 */}
      <View style={[styles.guideHeader, { backgroundColor: pal.ac + '15', borderColor: pal.ac + '40' }]}>
        <Text style={{ fontSize: 32 }}>🚀</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.guideHeaderTitle, { color: pal.tx }]}>시작 가이드</Text>
          <Text style={[styles.guideHeaderSub, { color: pal.t3 }]}>
            아래 3단계로 MeatBig을 시작해보세요
          </Text>
        </View>
      </View>

      {/* 3단계 카드 */}
      {GUIDE_STEPS.map(g => (
        <TouchableOpacity
          key={g.step}
          style={[styles.guideCard, { backgroundColor: pal.s1, borderColor: pal.bd, borderLeftColor: g.color, borderLeftWidth: 4 }]}
          onPress={() => {
            if (g.screen) navigation.navigate(g.tab, { screen: g.screen, initial: true });
            else navigation.navigate(g.tab);
          }}
          activeOpacity={0.82}
        >
          <View style={[styles.guideStepBadge, { backgroundColor: g.color }]}>
            <Text style={styles.guideStepText}>{g.step}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.guideCardTop}>
              <Text style={{ fontSize: 24 }}>{g.icon}</Text>
              <Text style={[styles.guideCardTitle, { color: pal.tx }]}>{g.title}</Text>
              <Text style={[styles.guideCardArrow, { color: g.color }]}>→</Text>
            </View>
            <Text style={[styles.guideCardDesc, { color: pal.t3 }]}>{g.desc}</Text>
            <View style={[styles.guideTipBox, { backgroundColor: g.color + '12' }]}>
              <Text style={[styles.guideTipText, { color: g.color }]}>{g.tip}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MarginBar({ item, rank, maxPct, color, pal, lowMode }) {
  const buy  = getBuyPrice(item);
  const sell = getSellPrice(item);
  const pct  = item.marginPct;
  const barWidth = Math.max(4, Math.round((pct / (maxPct || 1)) * 100));
  return (
    <View style={styles.marginBarRow}>
      <View style={[styles.marginRankBadge, { backgroundColor: color + '18' }]}>
        <Text style={[styles.marginRankText, { color }]}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <Text style={[styles.marginBarCut, { color: pal.tx }]}>{item.cut}</Text>
          <Text style={[styles.marginBarPct, { color }]}>{pct}%</Text>
        </View>
        <View style={[styles.marginBarTrack, { backgroundColor: pal.bg }]}>
          <View style={[styles.marginBarFill, { width: `${barWidth}%`, backgroundColor: color }]} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4 }}>
          <Text style={[styles.marginBarSub, { color: pal.t3 }]}>매입 {buy.toLocaleString()}원</Text>
          <Text style={[styles.marginBarSub, { color: pal.t3 }]}>판매 {sell.toLocaleString()}원</Text>
          <Text style={[styles.marginBarSub, { color }]}>
            +{item.marginPerKg.toLocaleString()}원/kg
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 헤더
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // 3-stat 박스 행
  statRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    ...shadow.sm,
  },

  // 섹션 헤더
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // 오늘의 점검 카드
  checkCard: {
    marginHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    ...shadow.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  checkDivider: { borderTopWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  // 섹션 카드 (재고, 마진)
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  gaugeList: { gap: 4 },

  // 손실 방어
  lossCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    marginHorizontal: spacing.lg,
    ...shadow.sm,
  },
  lossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  lossDivider: { borderTopWidth: 1, padding: spacing.md, paddingTop: spacing.sm, gap: 8 },
  lossRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lossDot: { width: 9, height: 9, borderRadius: 5 },

  // 시작 가이드
  guideHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.lg, borderWidth: 1.5,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.sm,
  },
  guideHeaderTitle: { fontSize: fontSize.md, fontWeight: '900', marginBottom: 3 },
  guideHeaderSub:   { fontSize: fontSize.xs, fontWeight: '600' },
  guideCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  guideStepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  guideStepText:  { color: '#fff', fontSize: fontSize.sm, fontWeight: '900' },
  guideCardTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  guideCardTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: '900' },
  guideCardArrow: { fontSize: fontSize.md, fontWeight: '900' },
  guideCardDesc:  { fontSize: fontSize.xs, lineHeight: 20, marginBottom: 8 },
  guideTipBox:    { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  guideTipText:   { fontSize: 11, fontWeight: '700' },

  // 마진 분석
  marginSummaryRow: { flexDirection: 'row', gap: spacing.sm },
  marginSummaryBox: {
    flex: 1, borderRadius: radius.md, borderWidth: 1,
    padding: spacing.sm, alignItems: 'center', ...shadow.sm,
  },
  marginSummaryLabel: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  marginSummaryVal:   { fontSize: fontSize.md, fontWeight: '900' },

  marginGroupHeader: { marginBottom: spacing.sm },
  marginGroupBadge:  { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  marginGroupBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },

  marginBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  marginRankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  marginRankText:  { fontSize: fontSize.sm, fontWeight: '900' },
  marginBarCut:    { fontSize: fontSize.sm, fontWeight: '800' },
  marginBarPct:    { fontSize: fontSize.md, fontWeight: '900' },
  marginBarTrack:  { height: 8, borderRadius: 4, overflow: 'hidden' },
  marginBarFill:   { height: 8, borderRadius: 4 },
  marginBarSub:    { fontSize: 11, fontWeight: '600' },

  marginDivider: { borderTopWidth: 1, marginVertical: spacing.md },
  marginChartTitle: { fontSize: fontSize.xs, fontWeight: '800', marginBottom: spacing.sm },
  marginChartRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
  marginChartCut:  { width: 56, fontSize: 11, fontWeight: '700' },
  marginChartBarWrap: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(128,128,128,0.12)', overflow: 'hidden' },
  marginChartBar:  { height: 10, borderRadius: 5 },
  marginChartPct:  { width: 36, fontSize: 11, fontWeight: '800', textAlign: 'right' },

  // 빠른 실행
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickBtn: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    ...shadow.sm,
  },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
