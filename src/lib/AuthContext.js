import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    // 세션 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 이메일 로그인
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }, []);

  // 이메일 회원가입
  // Supabase 대시보드 Auth → Confirm email 활성화 시:
  //   · data.user 는 반환되지만 data.session 은 null
  //   · 사용자가 메일함의 인증 링크 클릭해야 로그인 가능
  // 활성화 안 돼 있으면 session 즉시 발급 (기존 동작 유지)
  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { user: data.user, session: data.session };
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // 로컬 데이터 초기화
    await AsyncStorage.multiRemove([
      '@meatbig_onboarded', '@meatbig_biz', '@meatbig_staff',
      '@meatbig_invite_pin', '@meatbig_role', '@meatbig_current_staff',
      '@meatbig_store_uuid',
    ]);
  }, []);

  // 비밀번호 재설정 이메일 발송
  //   · Supabase 는 {Site URL}/reset-password 형태로 redirect_to 만들어 보냄
  //   · 사용자는 메일함의 재설정 링크 클릭 → 임시 세션 발급 → 새 비밀번호 입력 플로우
  //   · RN 앱에서 새 비밀번호 입력 UI 는 추후 Deep Link 연결 시 구현 (현재는 Supabase 웹 UI 활용)
  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return true;
  }, []);

  // Supabase stores 테이블에서 가게 정보 불러오기 (기기 변경 시 복원)
  //
  // 안전한 복원 경로:
  //   1) 사장: stores.auth_uid = auth.uid() 매칭
  //   2) 직원: store_members.auth_uid = auth.uid() → 연결된 store 로드
  //
  // 신규 가입자는 양쪽 모두 NULL → null 반환 → 온보딩 화면으로 진입
  //
  // 선행 조건: supabase/migrations/20260422_security_hardening.sql 적용
  //   (stores.auth_uid, store_members.auth_uid 컬럼 + RLS 정책)
  const loadStoreFromCloud = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // 1) 내가 사장인 store 우선 조회
      let { data: ownerStore } = await supabase
        .from('stores')
        .select('*')
        .eq('auth_uid', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2) 사장 store 없으면, 직원으로 속한 store 조회
      let storeRow = ownerStore;
      if (!storeRow) {
        const { data: membership } = await supabase
          .from('store_members')
          .select('store_id, stores(*)')
          .eq('auth_uid', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        storeRow = membership?.stores || null;
      }

      if (!storeRow) return null;

      const biz = {
        bizNo:    storeRow.biz_no || storeRow.store_id || '',
        bizName:  storeRow.store_name || '',
        owner:    storeRow.owner || '',
        bizType:  storeRow.biz_type || '개인사업자',
        addrSi:   storeRow.region_si || '',
        addrGu:   storeRow.region_gu || '',
        addrDong: storeRow.region_dong || '',
        species:  storeRow.species || [],
      };
      await AsyncStorage.setItem('@meatbig_biz', JSON.stringify(biz));
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');
      if (storeRow.invite_pin) {
        await AsyncStorage.setItem('@meatbig_invite_pin', storeRow.invite_pin);
      }
      // ⭐ 기기 변경 복원 시에도 store UUID 캐시 — RLS child 테이블 insert 에 필수
      if (storeRow.id) {
        await AsyncStorage.setItem('@meatbig_store_uuid', storeRow.id);
      }
      return biz;
    } catch {
      return null;
    }
  }, []);

  // store_members에서 직원 정보 불러오기
  const loadMembersFromCloud = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('store_members')
        .select('*')
        .order('created_at', { ascending: true });
      if (error || !data) return null;
      const members = data.map(m => ({
        id: m.id, name: m.name, role: m.role, pin: m.pin || '',
      }));
      await AsyncStorage.setItem('@meatbig_staff', JSON.stringify(members));
      return members;
    } catch { return null; }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, authReady,
      signIn, signUp, signOut, resetPassword,
      loadStoreFromCloud, loadMembersFromCloud,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
