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
  const loadStoreFromCloud = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      // AsyncStorage에도 캐시
      const biz = {
        bizNo:    data.biz_no || data.store_id || '',
        bizName:  data.store_name || '',
        owner:    data.owner || '',
        bizType:  data.biz_type || '개인사업자',
        addrSi:   data.region_si || '',
        addrGu:   data.region_gu || '',
        addrDong: data.region_dong || '',
        species:  data.species || [],
      };
      await AsyncStorage.setItem('@meatbig_biz', JSON.stringify(biz));
      await AsyncStorage.setItem('@meatbig_onboarded', 'true');
      if (data.invite_pin) {
        await AsyncStorage.setItem('@meatbig_invite_pin', data.invite_pin);
      }
      return biz;
    } catch { return null; }
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
