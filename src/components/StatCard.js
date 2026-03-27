import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme';

export default function StatCard({ title, value, unit, icon, color, trend }) {
  const accentColor = color || colors.primary;
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
        <Ionicons name={icon} size={22} color={accentColor} />
      </View>
      <Text style={styles.value}>
        {value}
        {unit && <Text style={styles.unit}> {unit}</Text>}
      </Text>
      <Text style={styles.title}>{title}</Text>
      {trend !== undefined && (
        <View style={styles.trendRow}>
          <Ionicons
            name={trend >= 0 ? 'trending-up' : 'trending-down'}
            size={12}
            color={trend >= 0 ? colors.status.success : colors.status.danger}
          />
          <Text
            style={[
              styles.trendText,
              { color: trend >= 0 ? colors.status.success : colors.status.danger },
            ]}
          >
            {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 140,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  unit: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
  },
  title: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
