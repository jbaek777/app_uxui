import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, darkColors, lightColors, radius, shadow, fontSize, spacing } from '../theme';
import { useTheme } from '../lib/ThemeContext';
import { GaugeBar } from '../components/GaugeBar';
import { meatInventory } from '../data/mockData';

export default function DashboardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const owner = route?.params?.ownerName || '사장님';
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const activeMeat = meatInventory.filter(m => !m.sold);
  const urgent = activeMeat.filter(m => m.dday <= 1);
  const nearExpiry3 = activeMeat.filter(m => m.dday <= 3);
  const potentialLoss = nearExpiry3.reduce((s, m) => s + m.qty * m.buyPrice, 0);
  const criticalLoss = urgent.reduce((s, m) => s + m.qty * m.buyPrice, 0);
  const lossRiskPct = activeMeat.length > 0 ? Math.round((nearExpiry3.length / activeMeat.length) * 100) : 0;
  const hygieneNeeded = true;
  const tempNeeded = true;

  const QUICK_ACTIONS = [
    { icon: '🏷️', label: '이력\n스캔',  tab: 'TraceTab',    screen: 'Scan',     color: pal.ac,   initial: true  },
    { icon: '📋', label: '위생\n일지',  tab: 'DocsTab',     screen: 'Hygiene',  color: pal.gn,   initial: true  },
    { icon: '🥩', label: '숙성\n관리',  tab: 'TraceTab',    screen: 'Aging',    color: pal.a2,   initial: false },
    { icon: '🖨️', label: '서류\n출력',  tab: 'DocsTab',     screen: 'Documents',color: pal.pu,   initial: true  },
    { icon: '💰', label: '마감\n정산',  tab: 'DocsTab',     screen: 'Closing',  color: pal.cyan, initial: true  },
    { icon: '📦', label: '재고\n확인',  tab: 'InventoryTab',screen: null,       color: pal.a2,   initial: true  },
  ];

  const cardBg = isDark
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(0,0,0,0.03)';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: pal.bg }]}
      contentContainerStyle={{ paddingBottom: 80, paddingTop: insets.top + spacing.md }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: pal.tx }]}>{owner} 사장님 👋</Text>
          <Text style={[styles.date, { color: pal.t3 }]}>{dateStr}</Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
          <Text style={[styles.scoreNum, { color: pal.gn }]}>94</Text>
          <Text style={[styles.scoreLabel, { color: pal.t3 }]}>위생점수</Text>
        </View>
      </View>

      {/* ── 오늘의 필수 점검 ── */}
      <SectionTitle label="🔔 오늘의 필수 점검" pal={pal} />
      <View style={styles.actionCards}>

        <CheckCard
          icon="📦"
          label="이력번호 미등록"
          badge="2건 미처리"
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

      {/* ── 재고 현황 ── */}
      <View style={[styles.section, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle2, { color: pal.tx }]}>📊 재고 현황</Text>
          <TouchableOpacity onPress={() => navigation.navigate('InventoryTab')}>
            <Text style={[styles.moreBtn, { color: pal.a2 }]}>전체보기 →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gaugeList}>
          {meatInventory.slice(0, 4).map(item => (
            <GaugeBar
              key={item.id}
              label={item.cut}
              sub={item.origin}
              value={item.qty}
              max={20}
              unit="kg"
              dday={item.dday}
              height={12}
            />
          ))}
        </View>
      </View>

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
                  backgroundColor: item.dday === 0 ? pal.rd : item.dday === 1 ? pal.yw : pal.a2,
                }]} />
                <Text style={[styles.lossItemName, { color: pal.tx }]}>{item.cut}</Text>
                <Text style={[styles.lossItemQty, { color: pal.t2 }]}>{item.qty}kg</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.lossItemVal, { color: item.dday <= 1 ? pal.rd : pal.yw }]}>
                  {item.dday === 0 ? '오늘 만료' : `D-${item.dday}`}
                </Text>
                <Text style={[styles.lossItemAmt, { color: pal.t3 }]}>
                  {((item.qty * item.buyPrice) / 10000).toFixed(1)}만원
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
              <View style={[styles.urgentDot, { backgroundColor: item.dday === 0 ? pal.rd : pal.yw }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgentName, { color: pal.tx }]}>{item.cut} ({item.origin})</Text>
                <Text style={[styles.urgentQty, { color: pal.t3 }]}>{item.qty}kg 남음</Text>
              </View>
              <View style={[styles.urgentBadge, { backgroundColor: item.dday === 0 ? pal.rd + '25' : pal.yw + '20' }]}>
                <Text style={[styles.urgentBadgeText, { color: item.dday === 0 ? pal.rd : pal.yw }]}>
                  {item.dday === 0 ? '오늘 만료' : '내일 만료'}
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

function SectionTitle({ label, pal }) {
  return (
    <Text style={[styles.sectionTitle, { color: pal.t2 }]}>
      {label}
    </Text>
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
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
});
