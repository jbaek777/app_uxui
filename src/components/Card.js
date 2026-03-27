import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export default function Card({ children, style, variant = 'default' }) {
  return (
    <View style={[styles.card, variant === 'elevated' && styles.elevated, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    ...shadow.md,
    borderWidth: 0,
  },
});
