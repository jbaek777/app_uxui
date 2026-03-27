import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { colors, radius, shadow, fontSize, spacing } from '../theme';

// ─── BADGE ───────────────────────────────────────────────
export const Badge = ({ label, color, bg }) => (
  <View style={[styles.badge, { backgroundColor: bg || color + '18', borderColor: color + '33' }]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

const STATUS_MAP = {
  pass:     { label: '✓ 적합',    color: colors.gn,  bg: '#dcfce7' },
  warning:  { label: '⚠ 주의',    color: colors.yw,  bg: '#fef9c3' },
  fail:     { label: '✗ 부적합',  color: colors.rd,  bg: '#fee2e2' },
  aging:    { label: '숙성 중',   color: '#1d4ed8',  bg: '#dbeafe' },
  done:     { label: '완성',      color: colors.gn,  bg: '#dcfce7' },
  early:    { label: '초기',      color: colors.yw,  bg: '#fef9c3' },
  ok:       { label: '정상',      color: colors.gn,  bg: '#dcfce7' },
  expired:  { label: '만료',      color: colors.rd,  bg: '#fee2e2' },
  soon:     { label: '만료 임박', color: colors.yw,  bg: '#fef9c3' },
  low:      { label: '부족',      color: colors.yw,  bg: '#fef9c3' },
  critical: { label: '긴급',      color: colors.rd,  bg: '#fee2e2' },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.ok;
  return <Badge label={s.label} color={s.color} bg={s.bg} />;
};

// ─── CARD ─────────────────────────────────────────────────
export const Card = ({ children, style, onPress }) => {
  const Inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{Inner}</TouchableOpacity>;
  return Inner;
};

// ─── STAT CARD ────────────────────────────────────────────
export const StatCard = ({ label, value, valueColor, sub, icon }) => (
  <View style={styles.statCard}>
    {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
    <Text style={[styles.statValue, { color: valueColor || colors.ac }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

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

// ─── PROGRESS BAR ─────────────────────────────────────────
export const ProgressBar = ({ pct, color, height = 8 }) => (
  <View style={[styles.progTrack, { height }]}>
    <View style={[styles.progFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color, height }]} />
  </View>
);

// ─── ALERT BOX ────────────────────────────────────────────
export const AlertBox = ({ type = 'warn', icon, title, message }) => {
  const t = {
    warn:  { bg: '#fffbeb', border: colors.yw, text: '#92400e' },
    error: { bg: '#fef2f2', border: colors.rd, text: '#991b1b' },
    info:  { bg: '#eff6ff', border: colors.a2, text: '#1e40af' },
    ok:    { bg: '#f0fdf4', border: colors.gn, text: '#166534' },
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

// ─── PRIMARY BUTTON ───────────────────────────────────────
export const PrimaryBtn = ({ label, onPress, color, style }) => (
  <TouchableOpacity
    style={[styles.primBtn, { backgroundColor: color || colors.ac }, style]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    <Text style={styles.primBtnText}>{label}</Text>
  </TouchableOpacity>
);

export const OutlineBtn = ({ label, onPress, color, style }) => (
  <TouchableOpacity
    style={[styles.outlineBtn, { borderColor: color || colors.bd }, style]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    <Text style={[styles.outlineBtnText, { color: color || colors.t2 }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── FORM INPUT ───────────────────────────────────────────
export const FormInput = ({ label, ...props }) => (
  <View style={styles.formGroup}>
    {label ? <Text style={styles.formLabel}>{label}</Text> : null}
    <TextInput style={styles.formInput} placeholderTextColor={colors.t3} {...props} />
  </View>
);

// ─── DIVIDER ──────────────────────────────────────────────
export const Divider = () => <View style={styles.divider} />;

// ─── LOADING ──────────────────────────────────────────────
export const Loading = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={colors.ac} />
  </View>
);

// ─── EMPTY STATE ──────────────────────────────────────────
export const EmptyState = ({ icon, message }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>{icon || '📭'}</Text>
    <Text style={styles.emptyMsg}>{message || '데이터가 없습니다'}</Text>
  </View>
);

// ─── SCREEN TITLE HEADER ──────────────────────────────────
export const ScreenHeader = ({ title, sub, action }) => (
  <View style={styles.screenHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.screenTitle}>{title}</Text>
      {sub ? <Text style={styles.screenSub}>{sub}</Text> : null}
    </View>
    {action}
  </View>
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

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: fontSize.xxs, fontWeight: '700' },

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
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: fontSize.xl, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: fontSize.xs, color: colors.t2, fontWeight: '600', textAlign: 'center' },
  statSub: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 3, textAlign: 'center' },

  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bd,
    backgroundColor: colors.bg,
  },
  secTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.tx },
  secSub: { fontSize: fontSize.xxs, color: colors.t3, marginTop: 2 },

  progTrack: { backgroundColor: colors.s3, borderRadius: 100, overflow: 'hidden' },
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
  alertIcon: { fontSize: 16, marginTop: 1 },
  alertTitle: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: 3 },
  alertMsg: { fontSize: fontSize.sm, lineHeight: 20 },

  primBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '800' },

  outlineBtn: {
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  outlineBtnText: { fontSize: fontSize.sm, fontWeight: '600' },

  formGroup: { marginBottom: spacing.md },
  formLabel: { fontSize: fontSize.sm, color: colors.t2, fontWeight: '700', marginBottom: 6 },
  formInput: {
    backgroundColor: colors.s1,
    borderWidth: 1.5,
    borderColor: colors.bd,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: fontSize.sm,
    color: colors.tx,
  },

  divider: { height: 1, backgroundColor: colors.bd, marginVertical: spacing.sm },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  empty: { alignItems: 'center', padding: 48 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyMsg: { fontSize: fontSize.md, color: colors.t3 },

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
  screenTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  screenSub: { fontSize: fontSize.xs, color: colors.t3, marginTop: 3 },

  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  addBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },
});
