import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, shadow, fontSize, spacing } from '../theme';
import { AlertBox, ProgressBar, StatusBadge, StatCard } from '../components/UI';

export default function DashboardScreen({ navigation }) {
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  const docItems = [
    { label: '공통 필수 서류', pct: 100, val: '6/6', color: colors.gn },
    { label: '숙성육 특화 서류', pct: 60,  val: '3/5', color: colors.yw },
    { label: '직원 서류',      pct: 83,  val: '5/6', color: colors.yw },
    { label: '온도 기록',      pct: 100, val: '완료', color: colors.gn },
  ];

  const agingQuick = [
    { trace: 'HN-2602-1142', cut: '채끝 (Ribeye)',    day: 23, targetDay: 28, status: 'aging' },
    { trace: 'HN-2602-1198', cut: '등심 (Striploin)', day: 18, targetDay: 28, status: 'aging' },
    { trace: 'HN-2603-0087', cut: '갈비 (Short Rib)', day: 11, targetDay: 21, status: 'aging' },
    { trace: 'HN-2603-0201', cut: '목심 (Chuck)',     day: 6,  targetDay: 21, status: 'early' },
  ];

  const staffQuick = [
    { name: '홍길동', role: '정육사', status: 'ok' },
    { name: '김○○',  role: '정육사', status: 'expired' },
    { name: '이○○',  role: '보조',  status: 'ok' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      {/* 날짜 */}
      <Text style={styles.dateText}>{today}</Text>

      {/* 알림 */}
      <AlertBox
        type="warn"
        icon="⚠️"
        title="오늘 확인 필요한 항목 3건"
        message="소비기한 근거 문서 미등록 · 김○○ 보건증 만료 · 소독제 긴급 발주 필요"
      />

      {/* 핵심 지표 */}
      <Text style={styles.sectionTitle}>📊 핵심 지표</Text>
      <View style={styles.statRow}>
        <StatCard icon="🥩" label="숙성 중" value="4건" valueColor={colors.a2} />
        <StatCard icon="📦" label="재고 가치" value="87만원" valueColor={colors.gn} />
        <StatCard icon="🌡️" label="현재 온도" value="2.4°C" valueColor={colors.gn} />
      </View>

      {/* 숙성 현황 */}
      <SectionBox
        title="🥩 숙성 현황"
        sub="터치하면 상세 보기"
        onMore={() => navigation.navigate('AgingTab', { screen: 'AgingMain' })}
      >
        {agingQuick.map(item => {
          const pct = Math.round((item.day / item.targetDay) * 100);
          return (
            <View key={item.trace} style={styles.agingRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.agingTitleRow}>
                  <Text style={styles.agingCut}>{item.cut}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.agingTrace}>{item.trace}</Text>
                <View style={{ marginTop: 6 }}>
                  <ProgressBar pct={pct} color={pct >= 100 ? colors.gn : colors.a2} height={6} />
                </View>
              </View>
              <View style={styles.agingDayBox}>
                <Text style={styles.agingDay}>{item.day}일</Text>
                <Text style={styles.agingTarget}>/{item.targetDay}일</Text>
              </View>
            </View>
          );
        })}
      </SectionBox>

      {/* 서류 준비율 */}
      <SectionBox
        title="📁 서류 준비 현황"
        sub="위생점검 대비 준비율"
        onMore={() => navigation.navigate('DocsTab', { screen: 'DocsHub' })}
      >
        {docItems.map(item => (
          <View key={item.label} style={styles.docItem}>
            <View style={styles.docItemRow}>
              <Text style={styles.docLabel}>{item.label}</Text>
              <Text style={[styles.docVal, { color: item.color }]}>{item.val}</Text>
            </View>
            <ProgressBar pct={item.pct} color={item.color} height={7} />
          </View>
        ))}
      </SectionBox>

      {/* 직원 서류 */}
      <SectionBox
        title="👥 직원 서류 현황"
        sub="보건증 · 위생교육 이수증"
        onMore={() => navigation.navigate('DocsTab', { screen: 'DocsHub' })}
      >
        {staffQuick.map(s => (
          <View key={s.name} style={styles.staffRow}>
            <View style={styles.staffAvatar}>
              <Text style={styles.staffAvatarText}>{s.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffName}>{s.name}</Text>
              <Text style={styles.staffRole}>{s.role}</Text>
            </View>
            <StatusBadge status={s.status === 'ok' ? 'ok' : 'expired'} />
          </View>
        ))}
      </SectionBox>
    </ScrollView>
  );
}

// ─── 섹션 박스 ────────────────────────────────────────────
function SectionBox({ title, sub, onMore, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionHeadTitle}>{title}</Text>
          {sub ? <Text style={styles.sectionHeadSub}>{sub}</Text> : null}
        </View>
        {onMore && (
          <TouchableOpacity onPress={onMore}>
            <Text style={styles.moreBtn}>전체보기 →</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  dateText: { fontSize: fontSize.xs, color: colors.t3, marginBottom: spacing.sm, fontWeight: '600' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, marginBottom: spacing.sm, marginTop: spacing.xs },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

  section: {
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bd,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd,
    backgroundColor: colors.bg,
  },
  sectionHeadTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  sectionHeadSub: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 3 },
  moreBtn: { fontSize: fontSize.xs, color: colors.a2, fontWeight: '700' },

  // 숙성
  agingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd + '50',
  },
  agingTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  agingCut: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx },
  agingTrace: { fontSize: fontSize.xxs, color: colors.t3, fontFamily: 'Courier' },
  agingDayBox: { alignItems: 'center', minWidth: 52 },
  agingDay: { fontSize: fontSize.lg, fontWeight: '900', color: colors.ac },
  agingTarget: { fontSize: fontSize.xxs, color: colors.t3 },

  // 서류
  docItem: { paddingVertical: spacing.xs },
  docItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  docLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '500' },
  docVal: { fontSize: fontSize.sm, fontWeight: '800' },

  // 직원
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd + '50',
  },
  staffAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.ac + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  staffAvatarText: { fontSize: fontSize.md, fontWeight: '800', color: colors.ac },
  staffName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx },
  staffRole: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 2 },
});
