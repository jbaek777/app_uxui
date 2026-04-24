import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { signInWithGoogle as socialGoogle, signInWithKakao as socialKakao } from './socialAuth';
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

  // 이메일 회원가입 — 이메일 인증 없이 즉시 로그인
  //
  // 정책 (2026-04-23):
  //   · Supabase 대시보드 Authentication → Providers → Email → "Confirm email" OFF
  //   · 가입 즉시 session 발급 → 바로 앱 사용 가능
  //   · 이메일 진위 여부는 검증하지 않음 (MVP 단계 간소화)
  //
  // 나중에 카카오·구글 소셜로그인 전환 시 이 함수는 제거 예정
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

  // ─── 소셜 로그인 (Google / Kakao) ───────────────────
  // socialAuth.js 의 공통 OAuth 흐름 경유. Supabase 세션이
  // setSession 되면 onAuthStateChange 가 발동 → user 상태 자동 갱신
  const signInWithGoogle = useCallback(async () => {
    const { user } = await socialGoogle();
    return user;
  }, []);

  const signInWithKakao = useCallback(async () => {
    const { user } = await socialKakao();
    return user;
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

  // 관리자 여부 체크 (user_profiles.role === 'admin')
  //
  // 용도:
  //   · 로그인 직후 온보딩 스킵 여부 결정 (관리자는 사업장 없음)
  //   · App 재시작 시 admin role 복원
  //
  // 반환: { isAdmin: boolean, displayName: string|null }
  //   · 네트워크 실패 시 { isAdmin: false } 안전 기본값
  const checkIsAdmin = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return { isAdmin: false, displayName: null };
      const { data } = await supabase
        .from('user_profiles')
        .select('role, display_name')
        .eq('auth_uid', currentUser.id)
        .maybeSingle();
      return {
        isAdmin: data?.role === 'admin',
        displayName: data?.display_name || null,
      };
    } catch {
      return { isAdmin: false, displayName: null };
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
      signInWithGoogle, signInWithKakao,
      loadStoreFromCloud, loadMembersFromCloud, checkIsAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
