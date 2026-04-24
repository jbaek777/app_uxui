/**
 * 법적 문서 공개 URL
 *
 * 호스팅: GitHub Pages (jbaek777/app_uxui) + 커스텀 도메인 meatbig.co.kr (2026-04-25~)
 * 호스팅 가이드: legal/hosting-guide.md
 * 원본 마크다운: legal/privacy-policy.md, legal/terms-of-service.md
 *
 * 한 곳에서만 관리하므로, 도메인 이전 시 본 파일만 수정하면 됩니다.
 *
 * ⚠️ 이전 GitHub Pages 주소 (fallback):
 *   https://jbaek777.github.io/app_uxui/ — 커스텀 도메인 장애 시 복구용
 */
import { Linking, Alert } from 'react-native';

export const LEGAL_URLS = {
  privacy: 'https://meatbig.co.kr/privacy-policy/',
  terms:   'https://meatbig.co.kr/terms-of-service/',
  landing: 'https://meatbig.co.kr/',
  supportEmail: 'skystory1031@gmail.com',
};

/**
 * 법적 문서 URL 열기 (외부 브라우저).
 * 실패 시 사용자에게 알림.
 */
export async function openLegalUrl(urlKey) {
  const url = LEGAL_URLS[urlKey];
  if (!url) {
    Alert.alert('오류', `알 수 없는 문서: ${urlKey}`);
    return;
  }
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('열 수 없음', `다음 주소를 브라우저에서 직접 열어주세요:\n\n${url}`);
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert('오류', '링크를 여는 중 문제가 발생했습니다.\n' + String(e?.message || e));
  }
}

export async function openPrivacyPolicy() {
  return openLegalUrl('privacy');
}

export async function openTermsOfService() {
  return openLegalUrl('terms');
}

export async function openSupportEmail() {
  const url = `mailto:${LEGAL_URLS.supportEmail}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('이메일', `메일 앱을 열 수 없습니다.\n직접 보내주세요: ${LEGAL_URLS.supportEmail}`);
  }
}
