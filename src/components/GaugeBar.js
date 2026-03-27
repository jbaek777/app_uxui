import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, radius } from '../theme';

export function GaugeBar({ label, sub, value, max, unit, color, dday, height = 10 }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = color || (pct < 20 ? colors.rd : pct < 50 ? colors.yw : colors.gn);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{label}</Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </View>
        <View style={styles.right}>
          {dday !== undefined && (
            <View style={[styles.ddayBadge, {
              backgroundColor: dday <= 0 ? colors.rd + '30' : dday <= 2 ? colors.yw + '25' : colors.gn + '20',
            }]}>
              <Text style={[styles.ddayText, {
                color: dday <= 0 ? colors.rd : dday <= 2 ? colors.yw : colors.gn,
              }]}>
                {dday < 0 ? '만료' : dday === 0 ? 'D-Day' : `D-${dday}`}
              </Text>
            </View>
          )}
          <Text style={[styles.valueText, { color: barColor }]}>
            {value}{unit}
          </Text>
        </View>
      </View>
      <View style={[styles.track, { height }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor, height }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.tx,
  },
  sub: {
    fontSize: fontSize.xxs,
    color: colors.t3,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ddayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  ddayText: {
    fontSize: fontSize.xxs,
    fontWeight: '800',
  },
  valueText: {
    fontSize: fontSize.md,
    fontWeight: '900',
  },
  track: {
    backgroundColor: colors.bd,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 6,
  },
});
