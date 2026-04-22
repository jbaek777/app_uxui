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
  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // 로컬 데이터 초기화
    await AsyncStorage.multiRemove([
      '@meatbig_onboarded', '@meatbig_biz', '@meatbig_staff',
      '@meatbig_invite_pin', '@meatbig_role', '@meatbig_current_staff',
    ]);
  }, []);

  // Supabase stores 테이블에서 가게 정보 불러오기 (기기 변경 시 복원)
  //
  // ⚠️ 현재 stores 테이블 스키마에는 auth_uid 컬럼이 없어,
  //    사용자별 소유권을 DB 레벨에서 식별할 수 없음.
  //    따라서 "임의로 첫 store를 복원" 하는 방식은 안전하지 않음
  //    (남의 가게가 복원되거나, 신규 가입자에게 무관한 store가 연결됨).
  //
  //    올바른 복원 경로:
  //     · 사장 재가입: 온보딩에서 사업자번호 재입력 → upsert(onConflict: store_id)로 이어감
  //     · 직원 재가입: 온보딩에서 사업자번호 + 초대코드 입력
  //
  //    이 함수는 stores 스키마에 auth_uid 컬럼이 추가되기 전까지 null 반환.
  const loadStoreFromCloud = useCallback(async () => {
    // TODO: stores 테이블에 auth_uid 컬럼 추가 후, 아래 구현으로 복귀:
    //   .from('stores').select('*').eq('auth_uid', user.id).maybeSingle()
    return null;
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
      signIn, signUp, signOut,
      loadStoreFromCloud, loadMembersFromCloud,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
