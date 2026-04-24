/**
 * 소셜 로그인 (Google + Kakao) — Supabase Auth 경유
 *
 * 흐름 (두 provider 공통):
 *   1) supabase.auth.signInWithOAuth 로 인증 URL 발급
 *   2) WebBrowser.openAuthSessionAsync 로 외부 브라우저 오픈
 *   3) 인증 완료 → redirect URL 로 돌아옴 (access_token + refresh_token 포함)
 *   4) URL 파싱 후 supabase.auth.setSession({ access_token, refresh_token })
 *   5) AuthContext 의 onAuthStateChange 가 자동으로 user 상태 반영
 *
 * 전제 조건 (Supabase Dashboard):
 *   - Auth → Providers → Google 활성화됨 (Client ID + Secret 입력됨)
 *   - Auth → Providers → Kakao 활성화됨 (REST API 키 + Client Secret 입력됨)
 *   - Auth → URL Configuration → Redirect URLs 에 앱 스킴 등록:
 *       · meatbig://auth-callback                                (EAS Build production)
 *       · exp://127.0.0.1:PORT/--/auth-callback                  (Expo Go 로컬)
 *       · https://auth.expo.io/@jbaek777/meatmanager             (Expo Go proxy)
 *
 * 호환:
 *   - Expo Go (Expo SDK 54) ✅ (proxy 경유)
 *   - EAS Build (custom scheme `meatbig`) ✅
 */
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Expo Go / 개발 중에는 WebBrowser 가 브라우저를 닫을 때 세션 warm-up 필요
WebBrowser.maybeCompleteAuthSession();

/**
 * Redirect URI 결정
 *   · EAS Build: meatbig://auth-callback
 *   · Expo Go:   exp+meatmanager://... 또는 Expo auth proxy
 * makeRedirectUri 가 실행 환경에 따라 자동 선택
 */
function getRedirectUri() {
  return makeRedirectUri({
    scheme: 'meatbig',
    path: 'auth-callback',
  });
}

/**
 * 공통 OAuth 흐름
 * @param {'google'|'kakao'} provider
 * @returns {Promise<{user: object, session: object}>}
 */
async function signInWithOAuth(provider) {
  const redirectTo = getRedirectUri();
  console.log('[socialAuth] START provider=', provider, 'redirectTo=', redirectTo);

  // 1) Supabase 에게 OAuth 시작 URL 을 요청
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true, // RN 이므로 수동으로 브라우저 열어야 함
      queryParams:
        provider === 'google'
          ? { access_type: 'offline' } // prompt:'consent' 제거 — 재로그인 방해
          : undefined,
    },
  });

  if (error) {
    console.log('[socialAuth] signInWithOAuth error=', error);
    throw error;
  }
  if (!data?.url) throw new Error('OAuth URL 을 받지 못했습니다.');
  console.log('[socialAuth] FULL OAuth URL=', data.url);

  // 2) 브라우저(WebBrowser) 로 인증 UI 띄움 → 완료 대기
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('[socialAuth] WebBrowser result.type=', result.type);
  console.log('[socialAuth] WebBrowser result.url=', result.url || '(none)');

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('로그인이 취소되었습니다.');
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('로그인 창이 비정상 종료되었습니다.');
  }

  // 3) Redirect URL 에서 토큰 파싱
  //    형식: meatbig://auth-callback#access_token=...&refresh_token=...
  //    또는 쿼리스트링 방식: ?code=...  (PKCE flow)
  const { access_token, refresh_token } = parseTokens(result.url);
  console.log('[socialAuth] parseTokens access_token?', !!access_token, 'refresh_token?', !!refresh_token);

  if (!access_token || !refresh_token) {
    // PKCE 방식일 수 있음 — 이 경우 exchangeCodeForSession 사용
    const code = parseCode(result.url);
    console.log('[socialAuth] parseCode code?', !!code);
    if (code) {
      const { data: sessData, error: sessErr } =
        await supabase.auth.exchangeCodeForSession(code);
      if (sessErr) {
        console.log('[socialAuth] exchangeCodeForSession error=', sessErr);
        throw sessErr;
      }
      console.log('[socialAuth] PKCE success user=', sessData.user?.email);
      return { user: sessData.user, session: sessData.session };
    }
    throw new Error('인증 토큰을 받지 못했습니다.');
  }

  // 4) Supabase 세션 설정
  const { data: sessData, error: sessErr } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessErr) {
    console.log('[socialAuth] setSession error=', sessErr);
    throw sessErr;
  }
  console.log('[socialAuth] Implicit success user=', sessData.user?.email);

  return { user: sessData.user, session: sessData.session };
}

/** 토큰 해시 프래그먼트 파싱 (Implicit flow) */
function parseTokens(url) {
  // meatbig://auth-callback#access_token=abc&refresh_token=xyz&...
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return {};
  const hash = url.substring(hashIdx + 1);
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  };
}

/** 쿼리스트링 code 파싱 (PKCE flow) */
function parseCode(url) {
  const parsed = Linking.parse(url);
  return parsed?.queryParams?.code || null;
}

// ─── 공개 API ─────────────────────────────────────────────
export async function signInWithGoogle() {
  return signInWithOAuth('google');
}

export async function signInWithKakao() {
  return signInWithOAuth('kakao');
}

export { getRedirectUri };
