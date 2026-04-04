/**
 * FeatureGate — 구독 필요 기능 래퍼
 * 미구독 사용자가 프리미엄 기능 진입 시 페이월로 안내
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFeatureFlags } from '../lib/FeatureFlagsContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { useTheme } from '../lib/ThemeContext';
import { darkColors, lightColors, fontSize, spacing, radius } from '../theme';

export default function FeatureGate({ featureKey, children }) {
  const { isFeatureFree } = useFeatureFlags();
  const { isPremium } = useSubscription();
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const navigation = useNavigation();

  // 관리자 feature_flags에서 무료 허용하거나 구독 중이면 통과
  if (isFeatureFree(featureKey) || isPremium) return children;

  return (
    <View style={[styles.lockWrap, { backgroundColor: pal.bg }]}>
      <Text style={{ fontSize: 56, marginBottom: spacing.lg }}>🔒</Text>
      <Text style={[styles.lockTitle, { color: pal.tx }]}>구독 전용 기능입니다</Text>
      <Text style={[styles.lockDesc, { color: pal.t3 }]}>
        이 기능은 구독 회원만 사용할 수 있습니다.{'\n'}
        14일 무료 체험으로 모든 기능을 써보세요!
      </Text>
      <View style={[styles.planCard, { backgroundColor: pal.s1, borderColor: pal.ac + '60' }]}>
        <Text style={[styles.planTitle, { color: pal.ac }]}>베이직 플랜</Text>
        <Text style={[styles.planPrice, { color: pal.tx }]}>월 30,000원</Text>
        <Text style={[styles.planFeature, { color: pal.t2 }]}>✓ 모든 기능 무제한</Text>
        <Text style={[styles.planFeature, { color: pal.t2 }]}>✓ AI OCR 서류 스캔</Text>
        <Text style={[styles.planFeature, { color: pal.t2 }]}>✓ 클라우드 백업</Text>
        <Text style={[styles.planFeature, { color: pal.t2 }]}>✓ 14일 무료 체험</Text>
      </View>
      <TouchableOpacity
        style={[styles.subscribeBtn, { backgroundColor: pal.ac }]}
        onPress={() => navigation.navigate('SettingsTab', { screen: 'Paywall', params: { featureKey } })}
      >
        <Text style={styles.subscribeBtnText}>14일 무료 체험 시작</Text>
      </TouchableOpacity>
      <Text style={[styles.lockNote, { color: pal.t3 }]}>신용카드 없이 시작 가능</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  lockTitle: { fontSize: fontSize.xl, fontWeight: '900', marginBottom: spacing.sm, textAlign: 'center' },
  lockDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  planCard: {
    width: '100%', borderRadius: radius.lg, borderWidth: 1.5,
    padding: spacing.lg, marginBottom: spacing.lg, gap: 8,
  },
  planTitle: { fontSize: fontSize.sm, fontWeight: '800', marginBottom: 4 },
  planPrice: { fontSize: fontSize.xxl, fontWeight: '900', marginBottom: 8 },
  planFeature: { fontSize: fontSize.sm },
  subscribeBtn: {
    width: '100%', paddingVertical: 16,
    borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.sm,
  },
  subscribeBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },
  lockNote: { fontSize: fontSize.xs },
});
