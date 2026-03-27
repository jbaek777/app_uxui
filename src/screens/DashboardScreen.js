import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, shadow, fontSize, spacing } from '../theme';
import { AlertBox } from '../components/UI';
import { GaugeBar } from '../components/GaugeBar';
import { meatInventory } from '../data/mockData';

export default function DashboardScreen({ navigation, route }) {
  const owner = route?.params?.ownerName || '사장님';
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const urgent = meatInventory.filter(m => m.dday <= 1);
  const hygieneNeeded = true;
  const tempNeeded = true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>

      {/* ── 인사말 ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{owner}, 안녕하세요 👋</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreNum}>94</Text>
          <Text style={styles.scoreLabel}>위생점수</Text>
        </View>
      </View>

      {/* ── 오늘의 필수 점검 3카드 ── */}
      <Text style={styles.sectionTitle}>🔔 오늘의 필수 점검</Text>
      <View style={styles.actionCards}>

        {/* 이력번호 */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: colors.rd + '60', backgroundColor: colors.rd + '10' }]}
          onPress={() => navigation.navigate('TraceTab', { screen: 'ScanMain' })}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>이력번호 미등록</Text>
            <Text style={[styles.actionBadge, { color: colors.rd }]}>2건 미처리</Text>
          </View>
          <View style={[styles.actionBtn, { backgroundColor: colors.rd }]}>
            <Text style={styles.actionBtnText}>스캔</Text>
          </View>
        </TouchableOpacity>

        {/* 위생점검 */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: hygieneNeeded ? colors.yw + '60' : colors.gn + '60', backgroundColor: hygieneNeeded ? colors.yw + '10' : colors.gn + '10' }]}
          onPress={() => navigation.navigate('DocsTab', { screen: 'Hygiene' })}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>🧼</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>오전 위생점검</Text>
            <Text style={[styles.actionBadge, { color: hygieneNeeded ? colors.yw : colors.gn }]}>
              {hygieneNeeded ? '미완료' : '완료'}
            </Text>
          </View>
          <View style={[styles.actionBtn, { backgroundColor: hygieneNeeded ? colors.yw : colors.gn }]}>
            <Text style={styles.actionBtnText}>점검</Text>
          </View>
        </TouchableOpacity>

        {/* 온도 기록 */}
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: tempNeeded ? colors.cyan + '60' : colors.gn + '60', backgroundColor: tempNeeded ? colors.cyan + '10' : colors.gn + '10' }]}
          onPress={() => navigation.navigate('DocsTab', { screen: 'Temp' })}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>🌡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>냉장고 온도 기록</Text>
            <Text style={[styles.actionBadge, { color: tempNeeded ? colors.cyan : colors.gn }]}>
              {tempNeeded ? '기록 필요' : '완료'}
            </Text>
          </View>
          <View style={[styles.actionBtn, { backgroundColor: colors.cyan }]}>
            <Text style={styles.actionBtnText}>기록</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 재고 요약 ── */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle2}>📊 재고 현황</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StockTab')}>
            <Text style={styles.moreBtn}>전체보기 →</Text>
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

      {/* ── 소비기한 임박 ── */}
      {urgent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle2}>⚠️ 소비기한 임박</Text>
          {urgent.map(item => (
            <View key={item.id} style={styles.urgentRow}>
              <View style={[styles.urgentDot, { backgroundColor: item.dday === 0 ? colors.rd : colors.yw }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.urgentName}>{item.cut} ({item.origin})</Text>
                <Text style={styles.urgentQty}>{item.qty}kg 남음</Text>
              </View>
              <View style={[styles.urgentBadge, { backgroundColor: item.dday === 0 ? colors.rd + '25' : colors.yw + '20' }]}>
                <Text style={[styles.urgentBadgeText, { color: item.dday === 0 ? colors.rd : colors.yw }]}>
                  {item.dday === 0 ? '오늘 만료' : '내일 만료'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 빠른 액션 ── */}
      <Text style={styles.sectionTitle}>⚡ 빠른 실행</Text>
      <View style={styles.quickGrid}>
        {[
          { icon: '🏷️', label: '이력\n스캔', tab: 'TraceTab', screen: 'ScanMain', color: colors.ac },
          { icon: '📋', label: '위생\n일지', tab: 'DocsTab', screen: 'Hygiene', color: colors.gn },
          { icon: '🥩', label: '숙성\n관리', tab: 'TraceTab', screen: 'Aging', color: colors.a2 },
          { icon: '🖨️', label: '서류\n출력', tab: 'DocsTab', screen: 'DocHub', color: colors.pu },
          { icon: '💰', label: '마감\n정산', tab: 'DocsTab', screen: 'Closing', color: colors.cyan },
          { icon: '📦', label: '재고\n확인', tab: 'StockTab', screen: null, color: colors.a2 },
        ].map((q, i) => (
          <TouchableOpacity
            key={i}
            style={styles.quickBtn}
            onPress={() => {
              if (q.screen) navigation.navigate(q.tab, { screen: q.screen });
              else navigation.navigate(q.tab);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIcon, { backgroundColor: q.color + '22' }]}>
              <Text style={{ fontSize: 28 }}>{q.icon}</Text>
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: { fontSize: fontSize.lg, fontWeight: '900', color: colors.tx, marginBottom: 4 },
  date: { fontSize: fontSize.xs, color: colors.t3, fontWeight: '600' },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  scoreNum: { fontSize: fontSize.xl, fontWeight: '900', color: colors.gn },
  scoreLabel: { fontSize: fontSize.xxs, color: colors.t3, fontWeight: '600' },

  sectionTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.t2, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.5 },

  actionCards: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    ...shadow.sm,
  },
  actionIcon: { fontSize: 32 },
  actionLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx, marginBottom: 3 },
  actionBadge: { fontSize: fontSize.xs, fontWeight: '800' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.sm, minWidth: 60, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '900' },

  section: {
    backgroundColor: colors.s1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.bd,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle2: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  moreBtn: { fontSize: fontSize.xs, color: colors.a2, fontWeight: '700' },
  gaugeList: { gap: 4 },

  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd,
  },
  urgentDot: { width: 10, height: 10, borderRadius: 5 },
  urgentName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx },
  urgentQty: { fontSize: fontSize.xs, color: colors.t3, marginTop: 2 },
  urgentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  urgentBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickBtn: { width: '30%', alignItems: 'center', gap: 7 },
  quickIcon: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: fontSize.xxs, color: colors.t2, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
});
