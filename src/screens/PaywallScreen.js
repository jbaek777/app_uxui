/**
 * PaywallScreen — 구독 요금제 선택 + 결제 UI
 * - 무료 체험 시작
 * - 베이직 / 프로 플랜 선택
 * - 월간 / 연간 토글
 * - RevenueCat SDK 연동 준비 (현재 Alert 처리)
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { darkColors, lightColors, fontSize, spacing, radius } from '../theme';
import { useSubscription, PLANS } from '../lib/SubscriptionContext';

export default function PaywallScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const pal = isDark ? darkColors : lightColors;
  const { sub, isPremium, isTrial, daysLeft, startTrial, upgradePlan, restorePurchase } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(false);

  const fromFeature = route?.params?.featureKey;

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      await startTrial(selectedPlan);
      Alert.alert(
        '🎉 무료 체험 시작!',
        `${PLANS[selectedPlan].name} 14일 무료 체험이 시작되었습니다.\n모든 프리미엄 기능을 자유롭게 사용해보세요!`,
        [{ text: '시작하기', onPress: () => navigation?.goBack() }]
      );
    } catch (e) {
      Alert.alert('오류', '체험 시작에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    // TODO: RevenueCat SDK 연동 시 실제 결제 처리
    // Purchases.purchasePackage(package)
    setLoading(true);
    try {
      // 현재는 즉시 구독 활성화 (테스트용)
      await upgradePlan(selectedPlan, billingCycle);
      const plan = PLANS[selectedPlan];
      const price = billingCycle === 'annual' ? plan.annualPriceLabel : plan.priceLabel;
      Alert.alert(
        '✅ 구독 완료!',
        `${plan.name} (${price}) 구독이 완료되었습니다.\n모든 프리미엄 기능을 이용하실 수 있습니다!`,
        [{ text: '확인', onPress: () => navigation?.goBack() }]
      );
    } catch (e) {
      Alert.alert('결제 오류', '결제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const restored = await restorePurchase();
    setLoading(false);
    if (restored) {
      Alert.alert('✅ 복원 완료', '구독 정보가 복원되었습니다.', [
        { text: '확인', onPress: () => navigation?.goBack() }
      ]);
    } else {
      Alert.alert('복원 실패', '복원할 구독 내역이 없습니다.');
    }
  };

  // 이미 구독 중인 경우 — 관리 화면 표시
  if (isPremium) {
    const plan = PLANS[sub.planId];
    return (
      <ScrollView style={{ flex: 1, backgroundColor: pal.bg }} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[s.activeCard, { backgroundColor: pal.s1, borderColor: pal.gn + '60' }]}>
          <Text style={[s.activeEmoji]}>{plan.emoji}</Text>
          <Text style={[s.activeTitle, { color: pal.tx }]}>{plan.name} 이용 중</Text>
          {isTrial && daysLeft !== null && (
            <View style={[s.trialBadge, { backgroundColor: pal.a2 + '25' }]}>
              <Text style={[s.trialBadgeText, { color: pal.a2 }]}>
                무료 체험 {daysLeft}일 남음
              </Text>
            </View>
          )}
          {!isTrial && sub.periodEndsAt && (
            <Text style={[s.activeMeta, { color: pal.t3 }]}>
              다음 결제일: {new Date(sub.periodEndsAt).toLocaleDateString('ko-KR')}
            </Text>
          )}
        </View>

        <Text style={[s.sectionTitle, { color: pal.t2, marginTop: spacing.xl }]}>이용 중인 기능</Text>
        {plan.features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: pal.gn, marginRight: 8, fontSize: fontSize.md }}>✓</Text>
            <Text style={{ color: pal.tx, fontSize: fontSize.sm }}>{f}</Text>
          </View>
        ))}

        {isTrial && (
          <TouchableOpacity
            style={[s.subscribeBtn, { backgroundColor: pal.ac, marginTop: spacing.xl }]}
            onPress={() => {
              setLoading(false);
              // 체험 중 결제로 전환
              handleSubscribe();
            }}
          >
            <Text style={s.subscribeBtnText}>지금 구독하기 (체험 → 정식)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // 미구독 — 요금제 선택 화면
  const basicPlan = PLANS.basic;
  const proPlan = PLANS.pro;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: pal.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>

      {/* 헤더 */}
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={{ fontSize: 48, marginBottom: 8 }}>🥩</Text>
        <Text style={[s.heroTitle, { color: pal.tx }]}>MeatBig 프리미엄</Text>
        <Text style={[s.heroSub, { color: pal.t2 }]}>
          {fromFeature ? '이 기능은 구독 후 이용 가능합니다' : '모든 기능을 14일 무료로 체험하세요'}
        </Text>
      </View>

      {/* 결제 주기 토글 */}
      <View style={[s.cycleToggle, { backgroundColor: pal.s1, borderColor: pal.bd }]}>
        <TouchableOpacity
          style={[s.cycleBtn, billingCycle === 'monthly' && { backgroundColor: pal.ac }]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text style={[s.cycleBtnText, { color: billingCycle === 'monthly' ? '#fff' : pal.t2 }]}>월간</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.cycleBtn, billingCycle === 'annual' && { backgroundColor: pal.ac }]}
          onPress={() => setBillingCycle('annual')}
        >
          <Text style={[s.cycleBtnText, { color: billingCycle === 'annual' ? '#fff' : pal.t2 }]}>연간</Text>
          <View style={[s.discountBadge, { backgroundColor: pal.gn + '30' }]}>
            <Text style={[s.discountText, { color: pal.gn }]}>20%↓</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 베이직 플랜 카드 */}
      <TouchableOpacity
        style={[s.planCard, {
          backgroundColor: pal.s1,
          borderColor: selectedPlan === 'basic' ? pal.ac : pal.bd,
          borderWidth: selectedPlan === 'basic' ? 2 : 1,
        }]}
        onPress={() => setSelectedPlan('basic')}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 22, marginRight: 8 }}>{basicPlan.emoji}</Text>
          <Text style={[s.planName, { color: pal.tx }]}>{basicPlan.name}</Text>
          {selectedPlan === 'basic' && (
            <View style={[s.selectedBadge, { backgroundColor: pal.ac + '25', marginLeft: 'auto' }]}>
              <Text style={[s.selectedBadgeText, { color: pal.ac }]}>선택됨</Text>
            </View>
          )}
        </View>
        <Text style={[s.planPrice, { color: pal.tx }]}>
          {billingCycle === 'annual' ? basicPlan.annualPriceLabel : basicPlan.priceLabel}
        </Text>
        {basicPlan.features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
            <Text style={{ color: pal.gn, marginRight: 6, fontSize: fontSize.sm }}>✓</Text>
            <Text style={{ color: pal.t2, fontSize: fontSize.sm, flex: 1 }}>{f}</Text>
          </View>
        ))}
      </TouchableOpacity>

      {/* 프로 플랜 카드 */}
      <TouchableOpacity
        style={[s.planCard, {
          backgroundColor: pal.s1,
          borderColor: selectedPlan === 'pro' ? pal.a2 : pal.bd,
          borderWidth: selectedPlan === 'pro' ? 2 : 1,
          marginTop: spacing.md,
        }]}
        onPress={() => setSelectedPlan('pro')}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 22, marginRight: 8 }}>{proPlan.emoji}</Text>
          <Text style={[s.planName, { color: pal.tx }]}>{proPlan.name}</Text>
          {selectedPlan === 'pro' && (
            <View style={[s.selectedBadge, { backgroundColor: pal.a2 + '25', marginLeft: 'auto' }]}>
              <Text style={[s.selectedBadgeText, { color: pal.a2 }]}>선택됨</Text>
            </View>
          )}
        </View>
        <Text style={[s.planPrice, { color: pal.tx }]}>
          {billingCycle === 'annual' ? proPlan.annualPriceLabel : proPlan.priceLabel}
        </Text>
        {proPlan.features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
            <Text style={{ color: pal.a2, marginRight: 6, fontSize: fontSize.sm }}>✓</Text>
            <Text style={{ color: pal.t2, fontSize: fontSize.sm, flex: 1 }}>{f}</Text>
          </View>
        ))}
      </TouchableOpacity>

      {/* 14일 무료 체험 버튼 */}
      <TouchableOpacity
        style={[s.subscribeBtn, { backgroundColor: selectedPlan === 'pro' ? pal.a2 : pal.ac, marginTop: spacing.xl }]}
        onPress={handleStartTrial}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={s.subscribeBtnText}>14일 무료 체험 시작</Text>
            <Text style={s.subscribeBtnSub}>신용카드 없이 시작 가능</Text>
          </>
        )}
      </TouchableOpacity>

      {/* 바로 구독 */}
      <TouchableOpacity
        style={[s.outlineBtn, { borderColor: pal.bd, marginTop: spacing.sm }]}
        onPress={handleSubscribe}
        disabled={loading}
      >
        <Text style={[s.outlineBtnText, { color: pal.t2 }]}>
          바로 구독하기 ({billingCycle === 'annual' ? '연간' : '월간'})
        </Text>
      </TouchableOpacity>

      {/* 구매 복원 */}
      <TouchableOpacity style={{ alignItems: 'center', marginTop: spacing.lg }} onPress={handleRestore}>
        <Text style={[s.restoreText, { color: pal.t3 }]}>구매 복원</Text>
      </TouchableOpacity>

      {/* 약관 */}
      <Text style={[s.termsText, { color: pal.t3 }]}>
        구독은 언제든지 취소 가능합니다. 무료 체험 후 자동 결제되지 않습니다.
        {'\n'}구독 시 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  heroTitle: { fontSize: fontSize.xxl, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  heroSub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  cycleToggle: {
    flexDirection: 'row', borderRadius: radius.md, borderWidth: 1,
    overflow: 'hidden', marginBottom: spacing.lg,
  },
  cycleBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  cycleBtnText: { fontSize: fontSize.sm, fontWeight: '700' },
  discountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  discountText: { fontSize: 11, fontWeight: '800' },
  planCard: { borderRadius: radius.lg, padding: spacing.lg },
  planName: { fontSize: fontSize.md, fontWeight: '800' },
  planPrice: { fontSize: fontSize.lg, fontWeight: '900', marginBottom: spacing.sm },
  selectedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  selectedBadgeText: { fontSize: 11, fontWeight: '800' },
  subscribeBtn: {
    paddingVertical: 18, borderRadius: radius.md, alignItems: 'center',
  },
  subscribeBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '900' },
  subscribeBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.xs, marginTop: 3 },
  outlineBtn: {
    paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', borderWidth: 1,
  },
  outlineBtnText: { fontSize: fontSize.sm, fontWeight: '700' },
  restoreText: { fontSize: fontSize.sm, textDecorationLine: 'underline' },
  termsText: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: spacing.lg },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  activeCard: {
    borderRadius: radius.lg, borderWidth: 2, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  activeEmoji: { fontSize: 48, marginBottom: 8 },
  activeTitle: { fontSize: fontSize.xl, fontWeight: '900', marginBottom: spacing.sm },
  trialBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  trialBadgeText: { fontSize: fontSize.xs, fontWeight: '800' },
  activeMeta: { fontSize: fontSize.xs },
});
