import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { colors, radius, shadow, fontSize, spacing } from '../theme';

// ─── BADGE ───────────────────────────────────────────────
export const Badge = ({ label, color, bg }) => (
  <View style={[styles.badge, { backgroundColor: bg || color + '25', borderColor: color + '50' }]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

const STATUS_MAP = {
  pass:     { label: '✓ 적합',   color: colors.gn,  bg: colors.gn + '20' },
  warning:  { label: '⚠ 주의',   color: colors.yw,  bg: colors.yw + '20' },
  fail:     { label: '✗ 부적합', color: colors.rd,  bg: colors.rd + '20' },
  aging:    { label: '숙성 중',  color: '#60A5FA',  bg: '#1E3A5F' },
  done:     { label: '완성',     color: colors.gn,  bg: colors.gn + '20' },
  early:    { label: '초기',     color: colors.yw,  bg: colors.yw + '20' },
  ok:       { label: '정상',     color: colors.gn,  bg: colors.gn + '20' },
  expired:  { label: '만료',     color: colors.rd,  bg: colors.rd + '20' },
  soon:     { label: '임박',     color: colors.yw,  bg: colors.yw + '20' },
  low:      { label: '부족',     color: colors.yw,  bg: colors.yw + '20' },
  critical: { label: '긴급',     color: colors.rd,  bg: colors.rd + '20' },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.ok;
  return <Badge label={s.label} color={s.color} bg={s.bg} />;
};

// ─── CARD ─────────────────────────────────────────────────
export const Card = ({ children, style, onPress }) => {
  const Inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.82}>{Inner}</TouchableOpacity>;
  return Inner;
};

// ─── STAT CARD ────────────────────────────────────────────
export const StatCard = ({ label, value, valueColor, sub, icon }) => (
  <View style={styles.statCard}>
    {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
    <Text style={[styles.statValue, { color: valueColor || colors.a2 }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

// ─── PROGRESS BAR ─────────────────────────────────────────
export const ProgressBar = ({ pct, color, height = 10 }) => (
  <View style={[styles.progTrack, { height }]}>
    <View style={[styles.progFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color, height }]} />
  </View>
);

// ─── ALERT BOX ────────────────────────────────────────────
export const AlertBox = ({ type = 'warn', icon, title, message }) => {
  const t = {
    warn:  { bg: colors.yw + '15', border: colors.yw, text: colors.yw },
    error: { bg: colors.rd + '15', border: colors.rd, text: colors.rd },
    info:  { bg: colors.a2 + '15', border: colors.a2, text: colors.a2 },
    ok:    { bg: colors.gn + '15', border: colors.gn, text: colors.gn },
  }[type];
  return (
    <View style={[styles.alertBox, { backgroundColor: t.bg, borderLeftColor: t.border }]}>
      {icon ? <Text style={styles.alertIcon}>{icon}</Text> : null}
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.alertTitle, { color: t.text }]}>{title}</Text> : null}
        {message ? <Text style={[styles.alertMsg, { color: t.text }]}>{message}</Text> : null}
      </View>
    </View>
  );
};

// ─── PRIMARY BUTTON (큰 버튼 — 최소 56px) ────────────────
export const PrimaryBtn = ({ label, onPress, color, style, icon }) => (
  <TouchableOpacity
    style={[styles.primBtn, { backgroundColor: color || colors.ac }, style]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    {icon ? <Text style={{ fontSize: 22, marginRight: 8 }}>{icon}</Text> : null}
    <Text style={styles.primBtnText}>{label}</Text>
  </TouchableOpacity>
);

export const OutlineBtn = ({ label, onPress, color, style }) => (
  <TouchableOpacity
    style={[styles.outlineBtn, { borderColor: color || colors.bd2 }, style]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    <Text style={[styles.outlineBtnText, { color: color || colors.t2 }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── ADD BUTTON ───────────────────────────────────────────
export const AddBtn = ({ label, onPress, color }) => (
  <TouchableOpacity
    style={[styles.addBtn, { backgroundColor: color || colors.ac }]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    <Text style={styles.addBtnText}>{label || '+ 추가'}</Text>
  </TouchableOpacity>
);

// ─── FORM INPUT ───────────────────────────────────────────
export const FormInput = ({ label, ...props }) => (
  <View style={styles.formGroup}>
    {label ? <Text style={styles.formLabel}>{label}</Text> : null}
    <TextInput style={styles.formInput} placeholderTextColor={colors.t3} {...props} />
  </View>
);

// ─── SCREEN HEADER ────────────────────────────────────────
export const ScreenHeader = ({ title, sub, action }) => (
  <View style={styles.screenHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.screenTitle}>{title}</Text>
      {sub ? <Text style={styles.screenSub}>{sub}</Text> : null}
    </View>
    {action}
  </View>
);

// ─── EMPTY STATE ──────────────────────────────────────────
export const EmptyState = ({ icon, message }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>{icon || '📭'}</Text>
    <Text style={styles.emptyMsg}>{message || '데이터가 없습니다'}</Text>
  </View>
);

// ─── LOADING ──────────────────────────────────────────────
export const Loading = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={colors.ac} />
  </View>
);

// ─── DIVIDER ──────────────────────────────────────────────
export const Divider = () => <View style={styles.divider} />;

// ─── SECTION HEADER ───────────────────────────────────────
export const SectionHeader = ({ title, sub, right }) => (
  <View style={styles.secHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.secTitle}>{title}</Text>
      {sub ? <Text style={styles.secSub}>{sub}</Text> : null}
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: fontSize.xxs, fontWeight: '800' },

  card: {
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bd,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },

  statCard: {
    flex: 1,
    backgroundColor: colors.s1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bd,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  statIcon: { fontSize: 24, marginBottom: 7 },
  statValue: { fontSize: fontSize.xl, fontWeight: '900', marginBottom: 4 },
  statLabel: { fontSize: fontSize.xs, color: colors.t2, fontWeight: '600', textAlign: 'center' },
  statSub: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 3, textAlign: 'center' },

  progTrack: { backgroundColor: colors.bd, borderRadius: 100, overflow: 'hidden' },
  progFill: { borderRadius: 100 },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
    gap: 8,
  },
  alertIcon: { fontSize: 18, marginTop: 1 },
  alertTitle: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: 3 },
  alertMsg: { fontSize: fontSize.sm, lineHeight: 22 },

  primBtn: {
    paddingVertical: 17,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 56,
  },
  primBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },

  outlineBtn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 52,
  },
  outlineBtnText: { fontSize: fontSize.sm, fontWeight: '700' },

  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    minHeight: 46,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },

  formGroup: { marginBottom: spacing.md },
  formLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700', marginBottom: 7 },
  formInput: {
    backgroundColor: colors.s2,
    borderWidth: 1.5,
    borderColor: colors.bd,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.sm,
    color: colors.tx,
    minHeight: 52,
  },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.s1,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd,
  },
  screenTitle: { fontSize: fontSize.xl, fontWeight: '900', color: colors.tx },
  screenSub: { fontSize: fontSize.xs, color: colors.t3, marginTop: 3 },

  empty: { alignItems: 'center', padding: 52 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyMsg: { fontSize: fontSize.md, color: colors.t3 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  divider: { height: 1, backgroundColor: colors.bd, marginVertical: spacing.sm },

  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd,
    backgroundColor: colors.s1,
  },
  secTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  secSub: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 2 },
});
