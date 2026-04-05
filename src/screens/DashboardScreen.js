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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: pal.bg }]}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + spacing.md }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: pal.tx }]}>{bizName || '우리 매장'} 사장님 👋</Text>
          <Text style={[styles.date, { color: pal.t3 }]}>{dateStr}</Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={[styles.scoreNum, { color: pal.gn }]}>{hygieneScore}</Text>
          <Text style={[styles.scoreLabel, { color: pal.t3 }]}>위생점수</Text>
        </View>
      </View>

      {/* ── 오늘의 필수 점검 ── */}
      <SectionTitle label="🔔 오늘의 필수 점검" pal={pal} />
      <View style={styles.actionCards}>

        <CheckCard
          icon="📦"
          label="이력번호 미등록"
          badge="관리 필요"
          badgeColor={pal.rd}
          btnLabel="스캔"
          borderColor={pal.rd}
          pal={pal}
          onPress={() => navigation.navigate('TraceTab', { screen: 'Scan' })}
        />

        <CheckCard
          icon="🧼"
          label="오전 위생점검"
          badge={hygieneNeeded ? '미완료' : '완료'}
          badgeColor={hygieneNeeded ? pal.yw : pal.gn}
          btnLabel="점검"
          borderColor={hygieneNeeded ? pal.yw : pal.gn}
          pal={pal}
          onPress={() => navigation.navigate('DocsTab', { screen: 'Hygiene' })}
        />

        <CheckCard
          icon="🌡️"
          label="냉장고 온도 기록"
          badge={tempNeeded ? '기록 필요' : '완료'}
          badgeColor={tempNeeded ? pal.cyan : pal.gn}
          btnLabel="기록"
          borderColor={tempNeeded ? pal.cyan : pal.gn}
          pal={pal}
          onPress={() => navigation.navigate('DocsTab', { screen: 'Temp' })}
        />
      </View>

      {/* ── 재고 현황 OR 시작 가이드 ── */}
      {activeMeat.length === 0 ? (
        <StartGuide pal={pal} navigation={navigation} />
      ) : (
        <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle2, { color: pal.tx }]}>📊 재고 현황</Text>
            <TouchableOpacity onPress={() => navigation.navigate('InventoryTab')}>
              <Text style={[styles.moreBtn, { color: pal.a2 }]}>전체보기 →</Text>
            </TouchableOpacity>
          </View>
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

      {/* ── 마진 분석 ── */}
      {marginItems.length > 0 && (
        <>
          <SectionTitle label="📈 마진 분석" pal={pal} />

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

          <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
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

      {/* ── 손실 방어 현황 ── */}
      <SectionTitle label="🛡️ 손실 방어 현황" pal={pal} />
      <TouchableOpacity
        style={[styles.lossCard, { backgroundColor: criticalLoss > 0 ? pal.rd + '12' : pal.s1, borderColor: criticalLoss > 0 ? pal.rd + '50' : pal.bd }]}
        onPress={() => navigation.navigate('InventoryTab')}
        activeOpacity={0.85}
      >
        <View style={styles.lossHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.lossTitle, { color: pal.tx }]}>예상 손실 위험액</Text>
            <Text style={[styles.lossSub, { color: pal.t3 }]}>소비기한 3일 이내 재고 기준</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.lossAmount, { color: potentialLoss > 0 ? pal.rd : pal.gn }]}>
              {potentialLoss > 0 ? `-${(potentialLoss / 10000).toFixed(0)}만원` : '손실 위험 없음'}
            </Text>
            {potentialLoss > 0 && (
              <Text style={[styles.lossAmountSub, { color: pal.t3 }]}>재고가치 기준</Text>
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
                <Text style={[styles.lossItemName, { color: pal.tx }]}>{item.cut}</Text>
                <Text style={[styles.lossItemQty, { color: pal.t2 }]}>{item.qty}kg</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.lossItemVal, { color: getDday(item) <= 1 ? pal.rd : pal.yw }]}>
                  {getDday(item) === 0 ? '오늘 만료' : `D-${getDday(item)}`}
                </Text>
                <Text style={[styles.lossItemAmt, { color: pal.t3 }]}>
                  {(((item.qty || 0) * getBuyPrice(item)) / 10000).toFixed(1)}만원
                </Text>
              </View>
            ))}
            {nearExpiry3.length > 3 && (
              <Text style={[styles.lossMore, { color: pal.a2 }]}>+ {nearExpiry3.length - 3}개 더 보기 →</Text>
            )}
          </View>
        )}

        {potentialLoss === 0 && (
          <View style={[styles.lossDivider, { borderTopColor: pal.bd + '60' }]}>
            <Text style={[styles.lossOkText, { color: pal.gn }]}>✓ 3일 이내 만료 재고 없음 — 현황 양호</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── 소비기한 임박 ── */}
      {urgent.length > 0 && (
        <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={[styles.sectionTitle2, { color: pal.tx, marginBottom: spacing.sm }]}>⚠️ 소비기한 임박</Text>
          {urgent.map(item => (
            <View key={item.id} style={[styles.urgentRow, { borderBottomColor: pal.bd }]}>
              <View style={[styles.urgentDot, { backgroundColor: getDday(item) === 0 ? pal.rd : pal.yw }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgentName, { color: pal.tx }]}>{item.cut} ({item.origin})</Text>
                <Text style={[styles.urgentQty, { color: pal.t3 }]}>{item.qty}kg 남음</Text>
              </View>
              <View style={[styles.urgentBadge, { backgroundColor: getDday(item) === 0 ? pal.rd + '25' : pal.yw + '20' }]}>
                <Text style={[styles.urgentBadgeText, { color: getDday(item) === 0 ? pal.rd : pal.yw }]}>
                  {getDday(item) === 0 ? '오늘 만료' : '내일 만료'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 빠른 실행 ── */}
      <SectionTitle label="⚡ 빠른 실행" pal={pal} />
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((q, i) => (
          <TouchableOpacity
            key={i}
            style={styles.quickBtn}
            onPress={() => {
              if (q.screen) navigation.navigate(q.tab, { screen: q.screen, initial: q.initial });
              else navigation.navigate(q.tab);
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: q.color + '22', borderColor: q.color + '40' }]}>
              <Text style={{ fontSize: 30 }}>{q.icon}</Text>
            </View>
            <Text style={[styles.quickLabel, { color: pal.tx }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

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

function SectionTitle({ label, pal }) {
  return (
    <Text style={[styles.sectionTitle, { color: pal.t2 }]}>
      {label}
    </Text>
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

function CheckCard({ icon, label, badge, badgeColor, btnLabel, borderColor, pal, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.actionCard,
        {
          backgroundColor: pal.s1,
          borderColor: borderColor + '50',
          borderLeftColor: borderColor,
          borderLeftWidth: 4,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: pal.tx }]}>{label}</Text>
        <Text style={[styles.actionBadge, { color: badgeColor }]}>{badge}</Text>
      </View>
      <View style={[styles.actionBtn, { backgroundColor: badgeColor }]}>
        <Text style={styles.actionBtnText}>{btnLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  greeting: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: 4 },
  date: { fontSize: fontSize.xs, fontWeight: '600' },
  scoreBox: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 72,
    ...shadow.sm,
  },
  scoreNum: { fontSize: fontSize.xl, fontWeight: '900' },
  scoreLabel: { fontSize: 11, fontWeight: '700', marginTop: 1 },

  // 섹션 타이틀
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },

  // 점검 카드
  actionCards: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    ...shadow.sm,
  },
  actionIcon: { fontSize: 32 },
  actionLabel: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 3 },
  actionBadge: { fontSize: fontSize.xs, fontWeight: '800' },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '900' },

  // 섹션 카드
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle2: { fontSize: fontSize.md, fontWeight: '800' },
  moreBtn: { fontSize: fontSize.xs, fontWeight: '700' },
  gaugeList: { gap: 4 },

  // 손실 방어
  lossCard: {
    borderRadius: radius.lg, borderWidth: 1.5,
    marginHorizontal: spacing.lg, marginTop: spacing.sm, ...shadow.sm,
  },
  lossHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingBottom: spacing.sm },
  lossTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: 3 },
  lossSub: { fontSize: fontSize.xxs },
  lossAmount: { fontSize: fontSize.xl, fontWeight: '900' },
  lossAmountSub: { fontSize: fontSize.xxs, marginTop: 2 },
  lossDivider: { borderTopWidth: 1, padding: spacing.md, paddingTop: spacing.sm, gap: 8 },
  lossRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lossDot: { width: 9, height: 9, borderRadius: 5 },
  lossItemName: { fontSize: fontSize.sm, fontWeight: '700' },
  lossItemQty: { fontSize: fontSize.xs },
  lossItemVal: { fontSize: fontSize.xs, fontWeight: '800' },
  lossItemAmt: { fontSize: fontSize.xs, fontWeight: '600', marginLeft: spacing.sm },
  lossMore: { fontSize: fontSize.xs, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  lossOkText: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },

  // 소비기한 임박
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  urgentDot: { width: 10, height: 10, borderRadius: 5 },
  urgentName: { fontSize: fontSize.sm, fontWeight: '700' },
  urgentQty: { fontSize: fontSize.xs, marginTop: 2 },
  urgentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  urgentBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },

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
    gap: 8,
    paddingVertical: spacing.sm,
  },
  quickIconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  quickLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
});
