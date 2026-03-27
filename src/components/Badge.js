import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const presets = {
  success: { bg: colors.status.success + '20', text: colors.status.success },
  warning: { bg: colors.status.warning + '20', text: colors.status.warning },
  danger: { bg: colors.status.danger + '20', text: colors.status.danger },
  info: { bg: colors.status.info + '20', text: colors.status.info },
  primary: { bg: colors.primaryLight, text: colors.primary },
  default: { bg: colors.border, text: colors.text.secondary },
};

export default function Badge({ label, type = 'default', style }) {
  const preset = presets[type] || presets.default;
  return (
    <View style={[styles.badge, { backgroundColor: preset.bg }, style]}>
      <Text style={[styles.text, { color: preset.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
