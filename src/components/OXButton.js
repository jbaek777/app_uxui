import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, fontSize } from '../theme';

// OX 버튼 쌍
export function OXPair({ value, onChange }) {
  return (
    <View style={styles.pair}>
      <OXBtn type="O" selected={value === 'O'} onPress={() => onChange('O')} />
      <OXBtn type="X" selected={value === 'X'} onPress={() => onChange('X')} />
    </View>
  );
}

// 단일 O or X 버튼
function OXBtn({ type, selected, onPress }) {
  const isO = type === 'O';
  const color = isO ? colors.gn : colors.rd;

  return (
    <TouchableOpacity
      style={[styles.btn, { borderColor: color, backgroundColor: selected ? color : 'transparent' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.text, { color: selected ? '#fff' : color }]}>{type}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
  },
});
