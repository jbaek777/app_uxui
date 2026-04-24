/**
 * PaywallScreen — 구독 관리 + 요금제 선택
 * - 미구독: 요금제 카탈로그 → 14일 무료 체험 / 바로 구독
 * - 구독 중: 현재 플랜 상태 + 요금제 변경 카탈로그 + 취소
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, SH } from '../lib/v5';
import { useSubscription, PLANS } from '../lib/SubscriptionContext';
import { openPrivacyPolicy, openTermsOfService } from '../constants/legalUrls';

const PLAN_ICONS = {
  free: 'gift-outline',
  basic: 'cube-outline',
  pro: 'diamond-outline',
};

export default function PaywallScreen({ navigation, route }) {
  const {
    sub, isPremium, isTrial, daysLeft,
    promoActive, promoDaysLeft,
    startTrial, upgradePlan, restorePurchase, cancelSubscription,
  } = useSubscription();

  // 기본 선택 — 현재 플랜 또는 'basic'
  const [selectedPlan, setSelectedPlan] = useState(isPremium ? sub.planId : 'basic');
  const [billingCycle, setBillingCycle] = useState(sub.billingCycle || 'monthly');
  const [loading, setLoading] = useState(false);

  const fromFeature = route?.params?.featureKey;
  const currentPlanId = sub.planId;

  // ── 핸들러 ───────────────────────────────────────────────

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      await startTrial(selectedPlan);
      Alert.alert(
        '무료 체험 시작!',
        `${PLANS[selectedPlan].name} 14일 무료 체험이 시작되었습니다.\n모든 프리미엄 기능을 자유롭게 사용해보세요!`,
        [{ text: '시작하기', onPress: () => navigation?.goBack() }]
      );
    } catch {
      Alert.alert('오류', '체험 시작에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId, cycle) => {
    const plan = PLANS[planId];
    const price = cycle === 'annual' ? plan.annualPriceLabel : plan.priceLabel;
    const isChange = isPremium && planId !== currentPlanId;
    const isUpgrade = isPremium && planId === 'pro' && currentPlanId === 'basic';
    const isDowngrade = isPremium && planId === 'basic' && currentPlanId === 'pro';

    const actionLabel = isUpgrade ? '업그레이드' : isDowngrade ? '다운그레이드' : isChange ? '요금제 변경' : '구독';

    Alert.alert(
      `${actionLabel} 확인`,
      `${plan.name} (${price}) 으로 ${actionLabel}하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            setLoading(true);
            try {
              await upgradePlan(planId, cycle);
              Alert.alert(
                '완료!',
                `${plan.name} 구독이 완료되었습니다.`,
                [{ text: '확인', onPress: () => navigation?.goBack() }]
              );
            } catch {
              Alert.alert('오류', '처리 중 문제가 발생했습니다.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    setLoading(true);
    const restored = await restorePurchase();
    setLoading(false);
    if (restored) {
      Alert.alert('복원 완료', '구독 정보가 복원되었습니다.',
        [{ text: '확인', onPress: () => navigation?.goBack() }]
      );
    } else {
      Alert.alert('복원 실패', '복원할 구독 내역이 없습니다.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      '구독 취소',
      '구독을 취소하면 즉시 무료 플랜으로 전환됩니다.\n남은 기간의 환불은 앱스토어/구글플레이 정책을 따릅니다.',
      [
        { text: '유지', style: 'cancel' },
        {
          text: '취소하기',
          style: 'destructive',
          onPress: async () => {
            await cancelSubscription();
            Alert.alert('취소 완료', '구독이 취소되었습니다.',
              [{ text: '확인', onPress: () => navigation?.goBack() }]
            );
          },
        },
      ]
    );
  };

  // ── 플랜 카드 공통 컴포넌트 ──────────────────────────────
  const PlanCard = ({ planId }) => {
    const plan = PLANS[planId];
    const isCurrent = currentPlanId === planId && isPremium;
    const isSelected = selectedPlan === planId;
    const accentColor = planId === 'pro' ? C.red2 : C.red;

    return (
      <TouchableOpacity
        style={[s.planCard, {
          borderColor: isCurrent ? C.ok : isSelected ? accentColor : C.border,
          borderWidth: isCurrent || isSelected ? 2 : 1,
        }]}
        onPress={() => setSelectedPlan(planId)}
        activeOpacity={0.8}
      >
        {/* 헤더 행 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Ionicons name={PLAN_ICONS[planId] || 'cube'} size={20} color={accentColor} style={{ marginRight: 8 }} />
          <Text style={s.planName}>{plan.name}</Text>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6 }}>
            {isCurrent && (
              <View style={[s.badge, { backgroundColor: C.okS }]}>
                <Text style={[s.badgeText, { color: C.ok }]}>이용 중</Text>
              </View>
            )}
            {!isCurrent && isSelected && (
              <View style={[s.badge, { backgroundColor: accentColor + '15' }]}>
                <Text style={[s.badgeText, { color: accentColor }]}>선택</Text>
              </View>
            )}
            {planId === 'pro' && !isCurrent && (
              <View style={[s.badge, { backgroundColor: C.redS }]}>
                <Text style={[s.badgeText, { color: C.red2 }]}>추천</Text>
              </View>
            )}
          </View>
        </View>

        {/* 가격 */}
        <Text style={s.planPrice}>
          {billingCycle === 'annual' ? plan.annualPriceLabel : plan.priceLabel}
        </Text>
        {billingCycle === 'annual' && (
          <Text style={{ fontSize: F.xxs, color: C.ok, marginBottom: 10, fontWeight: '700' }}>
            월간 대비 20% 절약
          </Text>
        )}

        {/* 기능 목록 */}
        {plan.features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 }}>
            <Ionicons name="checkmark" size={15} color={planId === 'pro' ? C.red2 : C.ok} style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={{ color: C.t2, fontSize: F.sm, flex: 1, lineHeight: 18 }}>{f}</Text>
          </View>
        ))}

        {/* 변경 버튼 (구독 중이고 현재 플랜 아닌 경우) */}
        {isPremium && !isCurrent && isSelected && (
          <TouchableOpacity
            style={[s.changeBtn, { backgroundColor: accentColor, marginTop: 16 }]}
            onPress={() => handleSubscribe(planId, billingCycle)}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={planId === 'pro' && currentPlanId === 'basic' ? 'arrow-up-circle' : 'arrow-down-circle'} size={16} color="#fff" />
                  <Text style={s.changeBtnText}>
                    {planId === 'pro' && currentPlanId === 'basic' ? '프로로 업그레이드' : '베이직으로 변경'}
                  </Text>
                </View>
            }
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
    >

      {/* ── 🎉 출시 기념 프로모션 배너 (180일간 전 플랜 무료) ── */}
      {promoActive && (
        <View style={s.promoBanner}>
          <View style={s.promoIc}>
            <Ionicons name="gift" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.promoTtl}>🎉 출시 기념 · 전 플랜 무료</Text>
            <Text style={s.promoSub}>
              {promoDaysLeft != null
                ? `${promoDaysLeft}일 남음 · 결제 없이 모든 프리미엄 기능 이용`
                : '결제 없이 모든 프리미엄 기능을 사용할 수 있습니다'}
            </Text>
          </View>
        </View>
      )}

      {/* ── 현재 구독 상태 배너 (구독 중인 경우) ── */}
      {isPremium && (
        <View style={[s.statusBanner, {
          backgroundColor: isTrial ? C.redS : C.okS,
          borderColor: isTrial ? C.red2 + '50' : C.ok + '50',
        }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Ionicons name={isTrial ? 'time' : 'checkmark-circle'} size={16} color={isTrial ? C.red2 : C.ok} />
              <Text style={[s.statusTitle, { color: isTrial ? C.red2 : C.ok }]}>
                {isTrial ? `무료 체험 중 (${daysLeft}일 남음)` : `${PLANS[currentPlanId]?.name} 구독 중`}
              </Text>
            </View>
            {!isTrial && sub.periodEndsAt && (
              <Text style={s.statusSub}>
                다음 결제일: {new Date(sub.periodEndsAt).toLocaleDateString('ko-KR')} ·{' '}
                {sub.billingCycle === 'annual' ? '연간' : '월간'} 구독
              </Text>
            )}
            {isTrial && (
              <Text style={s.statusSub}>
                체험 종료 후 자동 결제되지 않습니다
              </Text>
            )}
          </View>
        </View>
      )}

      {/* ── 헤더 (미구독 시) ── */}
      {!isPremium && (
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{ width: 72, height: 72, borderRadius: R.xl, backgroundColor: C.redS, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="diamond" size={36} color={C.red} />
          </View>
          <Text style={s.heroTitle}>MeatBig 프리미엄</Text>
          <Text style={s.heroSub}>
            {fromFeature ? '이 기능은 구독 후 이용 가능합니다' : '모든 기능을 14일 무료로 체험하세요'}
          </Text>
        </View>
      )}

      {/* ── 섹션 타이틀 (구독 중) ── */}
      {isPremium && (
        <Text style={[s.sectionLabel, { marginBottom: 16 }]}>
          요금제 선택 · 변경
        </Text>
      )}

      {/* ── 결제 주기 토글 ── */}
      <View style={s.cycleToggle}>
        <TouchableOpacity
          style={[s.cycleBtn, billingCycle === 'monthly' && { backgroundColor: C.red }]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text style={[s.cycleBtnText, { color: billingCycle === 'monthly' ? '#fff' : C.t2 }]}>월간</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.cycleBtn, billingCycle === 'annual' && { backgroundColor: C.red }]}
          onPress={() => setBillingCycle('annual')}
        >
          <Text style={[s.cycleBtnText, { color: billingCycle === 'annual' ? '#fff' : C.t2 }]}>연간</Text>
          <View style={[s.discountBadge, { backgroundColor: C.okS }]}>
            <Text style={[s.discountText, { color: C.ok }]}>20%</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 플랜 카드 (무료 플랜 포함 전체 비교) ── */}
      {/* 무료 플랜 */}
      <TouchableOpacity
        style={[s.planCard, {
          borderColor: selectedPlan === 'free' ? C.t2 : C.border,
          borderWidth: selectedPlan === 'free' ? 2 : 1,
          opacity: isPremium ? 0.6 : 1,
        }]}
        onPress={() => !isPremium && setSelectedPlan('free')}
        activeOpacity={isPremium ? 1 : 0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Ionicons name="gift-outline" size={20} color={C.t3} style={{ marginRight: 8 }} />
          <Text style={s.planName}>{PLANS.free.name}</Text>
          {!isPremium && currentPlanId === 'free' && (
            <View style={[s.badge, { backgroundColor: C.bg3, marginLeft: 'auto' }]}>
              <Text style={[s.badgeText, { color: C.t3 }]}>현재 플랜</Text>
            </View>
          )}
        </View>
        <Text style={s.planPrice}>{PLANS.free.priceLabel}</Text>
        {PLANS.free.features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 }}>
            <Ionicons name="checkmark" size={15} color={C.t3} style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={{ color: C.t3, fontSize: F.sm, flex: 1 }}>{f}</Text>
          </View>
        ))}
      </TouchableOpacity>

      {/* 베이직 플랜 */}
      <View style={{ marginTop: 16 }}>
        <PlanCard planId="basic" />
      </View>

      {/* 프로 플랜 */}
      <View style={{ marginTop: 16 }}>
        <PlanCard planId="pro" />
      </View>

      {/* ── 미구독 CTA ── */}
      {!isPremium && (
        <>
          <TouchableOpacity
            style={[s.primaryBtn, {
              backgroundColor: selectedPlan === 'pro' ? C.red2 : selectedPlan === 'free' ? C.t3 : C.red,
              marginTop: 36,
              opacity: selectedPlan === 'free' ? 0.5 : 1,
            }]}
            onPress={selectedPlan !== 'free' ? handleStartTrial : undefined}
            disabled={loading || selectedPlan === 'free'}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={s.primaryBtnText}>14일 무료 체험 시작</Text>
                  <Text style={s.primaryBtnSub}>신용카드 없이 시작 가능</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.outlineBtn, { marginTop: 10 }]}
            onPress={() => selectedPlan !== 'free' && handleSubscribe(selectedPlan, billingCycle)}
            disabled={loading || selectedPlan === 'free'}
          >
            <Text style={[s.outlineBtnText, { color: selectedPlan === 'free' ? C.t4 : C.t2 }]}>
              바로 구독하기 ({billingCycle === 'annual' ? '연간' : '월간'})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 24 }} onPress={handleRestore}>
            <Text style={{ fontSize: F.sm, textDecorationLine: 'underline', color: C.t3 }}>구매 복원</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── 구독 중 CTA ── */}
      {isPremium && (
        <>
          {/* 체험 → 정식 전환 */}
          {isTrial && selectedPlan !== 'free' && (
            <TouchableOpacity
              style={[s.primaryBtn, {
                backgroundColor: selectedPlan === 'pro' ? C.red2 : C.red,
                marginTop: 36,
              }]}
              onPress={() => handleSubscribe(selectedPlan, billingCycle)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={s.primaryBtnText}>정식 구독 시작</Text>
                    <Text style={s.primaryBtnSub}>{billingCycle === 'annual' ? '연간' : '월간'} · 체험 기간 종료 후 결제</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {/* 구독 취소 */}
          <TouchableOpacity
            style={[s.cancelBtn, { marginTop: 36 }]}
            onPress={handleCancel}
          >
            <Text style={s.cancelBtnText}>구독 취소</Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={handleRestore}>
            <Text style={{ fontSize: F.sm, textDecorationLine: 'underline', color: C.t3 }}>구매 복원</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 약관 */}
      <Text style={s.termsText}>
        구독은 언제든지 취소 가능합니다. 무료 체험 후 자동 결제되지 않습니다.{'\n'}
        구독 시{' '}
        <Text style={s.termsLink} onPress={openTermsOfService}>이용약관</Text>
        {' 및 '}
        <Text style={s.termsLink} onPress={openPrivacyPolicy}>개인정보처리방침</Text>
        에 동의하는 것으로 간주됩니다.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  heroTitle: { fontSize: F.h2, fontWeight: '900', marginBottom: 6, textAlign: 'center', color: C.t1 },
  heroSub: { fontSize: F.sm, textAlign: 'center', lineHeight: 20, color: C.t2 },
  sectionLabel: { fontSize: F.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: C.t3 },

  statusBanner: {
    borderRadius: R.md, borderWidth: 1,
    padding: 16, marginBottom: 24,
    flexDirection: 'row', alignItems: 'center',
  },
  statusTitle: { fontSize: F.sm, fontWeight: '800' },
  statusSub: { fontSize: F.xs, color: C.t3 },

  // 출시 기념 프로모 배너
  promoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#B91C1C',
    borderRadius: R.lg,
    padding: 16, marginBottom: 20,
    ...SH.sm,
  },
  promoIc: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  promoTtl: {
    fontSize: F.body, fontWeight: '900', color: '#fff',
    marginBottom: 2,
  },
  promoSub: {
    fontSize: F.xs, color: 'rgba(255,255,255,0.9)',
    lineHeight: 17,
  },

  cycleToggle: {
    flexDirection: 'row', borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 24, backgroundColor: C.white,
  },
  cycleBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  cycleBtnText: { fontSize: F.sm, fontWeight: '700' },
  discountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  discountText: { fontSize: F.xxs, fontWeight: '800' },

  planCard: { borderRadius: R.lg, padding: 24, backgroundColor: C.white, ...SH.sm },
  planName: { fontSize: F.body, fontWeight: '800', color: C.t1 },
  planPrice: { fontSize: F.h3, fontWeight: '900', marginBottom: 4, color: C.t1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: F.xxs, fontWeight: '800' },
  changeBtn: {
    paddingVertical: 12, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
  },
  changeBtnText: { color: '#fff', fontSize: F.sm, fontWeight: '800' },

  primaryBtn: { paddingVertical: 18, borderRadius: R.md, alignItems: 'center', ...SH.md },
  primaryBtnText: { color: '#fff', fontSize: F.body, fontWeight: '900' },
  primaryBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: F.xs, marginTop: 3 },
  outlineBtn: { paddingVertical: 14, borderRadius: R.md, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  outlineBtnText: { fontSize: F.sm, fontWeight: '700' },
  cancelBtn: { paddingVertical: 14, borderRadius: R.md, alignItems: 'center', borderWidth: 1, borderColor: C.red3 + '50' },
  cancelBtnText: { fontSize: F.sm, fontWeight: '700', color: C.red3 },
  termsText: { fontSize: F.xxs, textAlign: 'center', lineHeight: 16, marginTop: 24, color: C.t3 },
  termsLink: { color: C.t2, fontWeight: '700', textDecorationLine: 'underline' },
});
