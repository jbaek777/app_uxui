/**
 * SegmentTabs — 상단 세그먼트 탭 (iOS 스타일 슬라이더 탭)
 *
 * 사용처: DocumentScreen 내부 (서류관리/이력조회/서류OCR 전환)
 *
 * @param {Array<{key, label, icon?}>} tabs  탭 목록 — icon은 Ionicons 이름(outline 권장)
 * @param {string} activeKey              현재 활성 탭 키
 * @param {function} onChange             탭 변경 콜백 (key)
 * @param {object} style                  외부 컨테이너 스타일
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bgTrack: '#E8ECF2',
  bgPill:  '#FFFFFF',
  active:  '#0F172A',
  inactive:'#64748B',
};

export default function SegmentTabs({ tabs = [], activeKey, onChange, style }) {
  return (
    <View style={[S.root, style]}>
      {tabs.map(t => {
        const on = t.key === activeKey;
        return (
          <TouchableOpacity
            key={t.key}
            style={[S.seg, on && S.segOn]}
            activeOpacity={0.8}
            onPress={() => onChange && onChange(t.key)}
          >
            {t.icon && (
              <Ionicons
                name={t.icon}
                size={13}
                color={on ? C.active : C.inactive}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={[S.lbl, on && S.lblOn]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: C.bgTrack,
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  segOn: {
    backgroundColor: C.bgPill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  lbl: {
    fontSize: 12,
    fontWeight: '700',
    color: C.inactive,
    letterSpacing: -0.2,
  },
  lblOn: {
    color: C.active,
    fontWeight: '800',
  },
});
