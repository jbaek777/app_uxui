import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, darkColors, lightColors, fontSize, spacing, radius } from '../theme';
import { useTheme } from '../lib/ThemeContext';

export function GaugeBar({ label, sub, value, max, unit, color, dday, height = 10 }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = color || (pct < 20 ? pal.rd : pct < 50 ? pal.yw : pal.gn);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: pal.tx }]}>{label}</Text>
          {sub ? <Text style={[styles.sub, { color: pal.t3 }]}>{sub}</Text> : null}
        </View>
        <View style={styles.right}>
          {dday !== undefined && (
            <View style={[styles.ddayBadge, {
              backgroundColor: dday <= 0 ? pal.rd + '30' : dday <= 2 ? pal.yw + '25' : pal.gn + '20',
            }]}>
              <Text style={[styles.ddayText, {
                color: dday <= 0 ? pal.rd : dday <= 2 ? pal.yw : pal.gn,
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
      <View style={[styles.track, { height, backgroundColor: pal.bd }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor, height }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
  label: { fontSize: fontSize.sm, fontWeight: '700' },
  sub: { fontSize: fontSize.xxs, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  ddayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  ddayText: { fontSize: fontSize.xxs, fontWeight: '800' },
  valueText: { fontSize: fontSize.md, fontWeight: '900' },
  track: { borderRadius: 6, overflow: 'hidden' },
  fill: { borderRadius: 6 },
});
