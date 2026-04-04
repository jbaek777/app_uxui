/**
 * SubscriptionContext
 * - 구독 상태 전역 관리
 * - AsyncStorage 영구 저장
 * - Supabase subscriptions 테이블 동기화
 * - RevenueCat SDK 연동 준비 (현재는 stub)
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SUB_KEY = '@meatbig_subscription';

// 요금제 정의
export const PLANS = {
  free: {
    id: 'free',
    name: '무료 플랜',
    emoji: '🆓',
    price: 0,
    priceLabel: '무료',
    features: [
      '이력번호 조회 (월 50건)',
      '위생 일지 기록',
      '기본 재고 관리',
    ],
    limits: { tracePerMonth: 50, inventoryItems: 20 },
  },
  basic: {
    id: 'basic',
    name: '베이직 플랜',
    emoji: '⭐',
    price: 30000,
    priceLabel: '월 30,000원',
    annualPrice: 288000,
    annualPriceLabel: '연 288,000원 (20% 할인)',
    features: [
      '이력번호 조회 무제한',
      'AI OCR 서류 스캔',
      '숙성 관리',
      '마감 정산 + PDF 출력',
      '마진 대시보드',
      '거래처 관리',
      '클라우드 백업',
      '14일 무료 체험',
    ],
    limits: { tracePerMonth: -1, inventoryItems: -1 },
  },
  pro: {
    id: 'pro',
    name: '프로 플랜',
    emoji: '🚀',
    price: 60000,
    priceLabel: '월 60,000원',
    annualPrice: 576000,
    annualPriceLabel: '연 576,000원 (20% 할인)',
    features: [
      '베이직 플랜 전체 포함',
      '세무 리포트 (엑셀/CSV)',
      'IoT 온도 센서 연동',
      '직원/사장 권한 분리',
      '전문가 컨설팅 1회/월',
      '전용 고객 지원',
    ],
    limits: { tracePerMonth: -1, inventoryItems: -1 },
  },
};

const DEFAULT_STATE = {
  planId: 'free',        // 'free' | 'basic' | 'pro'
  isActive: false,       // 구독 활성 여부
  isTrial: false,        // 무료 체험 중
  trialEndsAt: null,     // ISO 날짜
  periodEndsAt: null,    // 구독 만료일
  billingCycle: null,    // 'monthly' | 'annual'
  purchasedAt: null,
};

const SubscriptionContext = createContext({
  sub: DEFAULT_STATE,
  plan: PLANS.free,
  isPremium: false,
  isTrial: false,
  startTrial: async () => {},
  upgradePlan: async () => {},
  restorePurchase: async () => {},
  cancelSubscription: async () => {},
  checkFeature: () => true,
});

export function SubscriptionProvider({ children }) {
  const [sub, setSub] = useState(DEFAULT_STATE);

  // 로드
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SUB_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          // 만료 체크
          const normalized = checkExpiry(saved);
          setSub(normalized);
        }
      } catch {}
    })();
  }, []);

  // 만료 자동 체크 (앱 포그라운드 복귀 등)
  const checkExpiry = (state) => {
    if (!state.isActive && !state.isTrial) return state;
    const now = new Date();
    if (state.isTrial && state.trialEndsAt && new Date(state.trialEndsAt) < now) {
      return { ...state, isTrial: false, planId: 'free', isActive: false };
    }
    if (state.isActive && state.periodEndsAt && new Date(state.periodEndsAt) < now) {
      return { ...state, isActive: false, planId: 'free' };
    }
    return state;
  };

  const save = async (newState) => {
    setSub(newState);
    await AsyncStorage.setItem(SUB_KEY, JSON.stringify(newState)).catch(() => {});
    // Supabase 동기화 (실패해도 로컬은 유지)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('subscriptions').upsert({
          user_id: user.id,
          plan_id: newState.planId,
          is_active: newState.isActive,
          is_trial: newState.isTrial,
          trial_ends_at: newState.trialEndsAt,
          period_ends_at: newState.periodEndsAt,
          billing_cycle: newState.billingCycle,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    } catch {}
  };

  // 14일 무료 체험 시작
  const startTrial = useCallback(async (planId = 'basic') => {
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const newState = {
      ...DEFAULT_STATE,
      planId,
      isActive: false,
      isTrial: true,
      trialEndsAt: trialEnds.toISOString(),
      purchasedAt: new Date().toISOString(),
    };
    await save(newState);
    return newState;
  }, []);

  // 결제 완료 (RevenueCat 콜백 또는 수동 업그레이드)
  const upgradePlan = useCallback(async (planId, billingCycle = 'monthly') => {
    const periodEnds = new Date();
    if (billingCycle === 'annual') {
      periodEnds.setFullYear(periodEnds.getFullYear() + 1);
    } else {
      periodEnds.setMonth(periodEnds.getMonth() + 1);
    }
    const newState = {
      planId,
      isActive: true,
      isTrial: false,
      trialEndsAt: null,
      periodEndsAt: periodEnds.toISOString(),
      billingCycle,
      purchasedAt: new Date().toISOString(),
    };
    await save(newState);
    return newState;
  }, []);

  // 구매 복원 (RevenueCat restorePurchases)
  const restorePurchase = useCallback(async () => {
    // TODO: RevenueCat SDK 연동 시 실제 복원 로직
    // 현재는 Supabase에서 최신 구독 상태 조회
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('subscriptions')
          .select('*').eq('user_id', user.id).single();
        if (data && data.is_active) {
          const restored = {
            planId: data.plan_id,
            isActive: data.is_active,
            isTrial: data.is_trial,
            trialEndsAt: data.trial_ends_at,
            periodEndsAt: data.period_ends_at,
            billingCycle: data.billing_cycle,
            purchasedAt: data.updated_at,
          };
          await save(restored);
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  // 구독 취소
  const cancelSubscription = useCallback(async () => {
    const newState = { ...DEFAULT_STATE };
    await save(newState);
  }, []);

  // 기능 접근 가능 여부
  const checkFeature = useCallback((featureKey) => {
    const { planId, isActive, isTrial } = sub;
    const hasPremium = isActive || isTrial;
    const premiumFeatures = ['ocr', 'aging', 'closing', 'margin', 'supplier', 'education'];
    if (!premiumFeatures.includes(featureKey)) return true;
    return hasPremium;
  }, [sub]);

  const plan = PLANS[sub.planId] || PLANS.free;
  const isPremium = sub.isActive || sub.isTrial;

  // 만료일까지 남은 일수
  const daysLeft = (() => {
    const target = sub.isTrial ? sub.trialEndsAt : sub.periodEndsAt;
    if (!target) return null;
    const diff = new Date(target) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  return (
    <SubscriptionContext.Provider value={{
      sub, plan, isPremium, isTrial: sub.isTrial, daysLeft,
      startTrial, upgradePlan, restorePurchase, cancelSubscription, checkFeature,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
