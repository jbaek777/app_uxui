/**
 * SubscriptionContext
 * - 구독 단위: 사업장(store_id = 사업자번호) 기준
 * - 유저(개인)는 구독 개념 없음 — 사업장 구독을 공유
 * - 사장만 구독 변경 가능, 직원은 읽기만
 * - AsyncStorage 로컬 캐시 + Supabase 서버 동기화
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
  planId:      'free',
  isActive:    false,
  isTrial:     false,
  trialUsed:   false,   // 사업장 단위 체험 사용 여부 (영구)
  trialEndsAt: null,
  periodEndsAt:null,
  billingCycle:null,
  storeId:     null,    // 사업자번호 (구독 키)
};

const SubscriptionContext = createContext({
  sub: DEFAULT_STATE,
  plan: PLANS.free,
  isPremium: false,
  isTrial: false,
  daysLeft: null,
  startTrial: async () => {},
  upgradePlan: async () => {},
  restorePurchase: async () => {},
  cancelSubscription: async () => {},
  checkFeature: () => true,
});

// ─── 현재 유저의 사업자번호(storeId) 조회 ─────────────────
async function getMyStoreId() {
  try {
    // 1) 로컬 캐시 먼저
    const bizRaw = await AsyncStorage.getItem('@meatbig_biz');
    if (bizRaw) {
      const biz = JSON.parse(bizRaw);
      const sid = (biz.bizNo || '').replace(/-/g, '');
      if (sid) return sid;
    }
    // 2) Supabase stores에서 조회 (사장)
    const { data: ownedStore } = await supabase
      .from('stores')
      .select('store_id')
      .limit(1)
      .maybeSingle();
    if (ownedStore?.store_id) return ownedStore.store_id;

    // 3) store_members에서 조회 (직원)
    const { data: memberRow } = await supabase
      .from('store_members')
      .select('store_id, stores(store_id)')
      .limit(1)
      .maybeSingle();
    if (memberRow?.stores?.store_id) return memberRow.stores.store_id;
  } catch {}
  return null;
}

export function SubscriptionProvider({ children }) {
  const [sub, setSub] = useState(DEFAULT_STATE);

  // 앱 시작 시 로드
  useEffect(() => {
    (async () => {
      try {
        // 1) 로컬 캐시
        const raw = await AsyncStorage.getItem(SUB_KEY);
        if (raw) {
          const saved = checkExpiry(JSON.parse(raw));
          setSub(saved);
        }
        // 2) Supabase 서버에서 최신 구독 상태 동기화
        await syncFromServer();
      } catch {}
    })();
  }, []);

  // 만료 자동 체크
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

  // Supabase → 로컬 동기화 (서버 우선)
  const syncFromServer = async () => {
    try {
      const storeId = await getMyStoreId();
      if (!storeId) return;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (!error && data) {
        const synced = checkExpiry({
          planId:       data.plan_id || 'free',
          isActive:     data.is_active || false,
          isTrial:      data.is_trial || false,
          trialUsed:    data.trial_used || false,
          trialEndsAt:  data.trial_ends_at || null,
          periodEndsAt: data.period_ends_at || null,
          billingCycle: data.billing_cycle || null,
          storeId,
        });
        setSub(synced);
        await AsyncStorage.setItem(SUB_KEY, JSON.stringify(synced));
      }
    } catch {}
  };

  // 로컬 + Supabase 저장
  const save = async (newState) => {
    const storeId = newState.storeId || await getMyStoreId();
    const finalState = { ...newState, storeId };
    setSub(finalState);
    await AsyncStorage.setItem(SUB_KEY, JSON.stringify(finalState)).catch(() => {});

    // Supabase 동기화 (사장만 쓰기 가능 — RLS)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && storeId) {
        await supabase.from('subscriptions').upsert({
          store_id:     storeId,
          owner_uid:    user.id,
          plan_id:      finalState.planId,
          is_active:    finalState.isActive,
          is_trial:     finalState.isTrial,
          trial_used:   finalState.trialUsed,
          trial_ends_at:  finalState.trialEndsAt,
          period_ends_at: finalState.periodEndsAt,
          billing_cycle:  finalState.billingCycle,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'store_id' });
      }
    } catch {}
  };

  // ─── 14일 무료 체험 시작 ────────────────────────────────
  const startTrial = useCallback(async (planId = 'basic') => {
    const storeId = await getMyStoreId();

    // 서버에서 체험 이력 확인 (사업장 단위 — 어뷰징 방지)
    if (storeId) {
      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('trial_used')
          .eq('store_id', storeId)
          .maybeSingle();

        if (data?.trial_used === true) {
          return { success: false, reason: 'already_used' };
        }
      } catch {}
    }

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const newState = {
      ...DEFAULT_STATE,
      planId,
      isActive:    false,
      isTrial:     true,
      trialUsed:   true,   // 영구 기록
      trialEndsAt: trialEnds.toISOString(),
      storeId,
    };
    await save(newState);
    return { success: true };
  }, []);

  // ─── 결제 완료 ──────────────────────────────────────────
  const upgradePlan = useCallback(async (planId, billingCycle = 'monthly') => {
    const storeId = await getMyStoreId();
    const periodEnds = new Date();
    if (billingCycle === 'annual') {
      periodEnds.setFullYear(periodEnds.getFullYear() + 1);
    } else {
      periodEnds.setMonth(periodEnds.getMonth() + 1);
    }
    const newState = {
      planId,
      isActive:     true,
      isTrial:      false,
      trialUsed:    true,  // 결제했으면 체험도 사용한 것으로
      trialEndsAt:  null,
      periodEndsAt: periodEnds.toISOString(),
      billingCycle,
      storeId,
    };
    await save(newState);
    return newState;
  }, []);

  // ─── 구매 복원 ──────────────────────────────────────────
  const restorePurchase = useCallback(async () => {
    await syncFromServer();
    return true;
  }, []);

  // ─── 구독 취소 ──────────────────────────────────────────
  const cancelSubscription = useCallback(async () => {
    const storeId = await getMyStoreId();
    // trialUsed는 유지 (재체험 방지)
    const newState = {
      ...DEFAULT_STATE,
      trialUsed: sub.trialUsed,
      storeId,
    };
    await save(newState);
  }, [sub.trialUsed]);

  // ─── 기능 접근 가능 여부 ────────────────────────────────
  const checkFeature = useCallback((featureKey) => {
    const { planId, isActive, isTrial } = sub;
    const hasPremium = isActive || isTrial;
    const premiumFeatures = ['ocr', 'aging', 'closing', 'margin', 'supplier', 'education'];
    if (!premiumFeatures.includes(featureKey)) return true;
    return hasPremium;
  }, [sub]);

  const plan = PLANS[sub.planId] || PLANS.free;
  const isPremium = sub.isActive || sub.isTrial;

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
