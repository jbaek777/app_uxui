# 개인정보처리방침·이용약관 공개 호스팅 가이드

> **목표**: `privacy-policy.md`, `terms-of-service.md` 를 누구나 접속 가능한 **공개 URL** 로 만들기
> **왜 필수**: 앱스토어 심사는 공개 URL(https://...) 을 요구. 로컬 파일이나 PDF 첨부로는 반려됨
> **소요 시간**: 30분 ~ 1시간 (GitHub Pages 기준)
> **비용**: **무료** (GitHub Pages)

---

## 🎯 결론부터

**추천 방법**: GitHub Pages + `legal/` 폴더 그대로 사용

| 최종 URL | 용도 |
|---|---|
| `https://jbaek777.github.io/app_uxui/privacy-policy/` | 개인정보처리방침 |
| `https://jbaek777.github.io/app_uxui/terms-of-service/` | 이용약관 |
| `https://jbaek777.github.io/app_uxui/` | 랜딩 (index.md) |

> 저장소 이름이 `app_uxui` 이기 때문에 URL 도 `/app_uxui/` 경로를 사용합니다.

이 URL 을 **앱스토어 양식**, **앱 내 설정화면 링크**, **이메일 서명** 어디든 붙이면 됩니다.

---

## 🥇 방법 1: GitHub Pages (★★★ 강력 추천)

### 왜 GitHub Pages인가
- ✅ 완전 **무료** (퍼블릭 저장소 기준)
- ✅ HTTPS 자동 적용 (앱스토어 필수 요건)
- ✅ 이미 코드가 GitHub에 있어서 추가 서비스 불필요
- ✅ `.md` 파일 자동으로 HTML 렌더링 (Jekyll 내장)
- ✅ 수정하면 `git push` 만으로 자동 반영 (1~2분 내)

### ❶ 저장소 공개 설정 확인
1. GitHub 접속 → `meatmanager` 저장소
2. **Settings** → **General** 맨 아래
3. 저장소가 **Private** 이면 **Public** 으로 변경
   - ⚠️ 코드가 공개되어도 되는지 확인 필수
   - 민감 정보(.env, API 키)가 커밋 이력에 남아있으면 **절대 Public 금지**
   - Private 유지하고 싶으면 **방법 2 (Vercel)** 로 이동

### ❷ GitHub Pages 활성화
1. 저장소 **Settings** → 왼쪽 메뉴 **Pages**
2. **Source**: `Deploy from a branch` 선택
3. **Branch**: `main` + `/ (root)` 선택 → **Save**
4. 1~2분 대기 → 상단에 초록 박스로 URL 표시됨
   - 예: `Your site is live at https://jbaek777.github.io/app_uxui/`

### ❸ Jekyll 설정 파일 추가 (선택이지만 권장)
루트에 `_config.yml` 파일 생성:

```yaml
title: 미트빅(MeatBig) 법적 문서
description: 미트빅 앱 개인정보처리방침·이용약관
theme: jekyll-theme-cayman
markdown: kramdown
include:
  - legal
exclude:
  - node_modules
  - android
  - ios
  - src
  - supabase
  - "*.lock"
  - "*.log"
```

### ❹ 문서 상단에 front-matter 추가 (필수)
Jekyll 이 렌더링하려면 `.md` 파일 맨 위에 아래 블록이 있어야 합니다.

**`legal/privacy-policy.md` 맨 위에 추가**:
```yaml
---
layout: default
title: 개인정보처리방침
permalink: /privacy-policy/
---
```

**`legal/terms-of-service.md` 맨 위에 추가**:
```yaml
---
layout: default
title: 이용약관
permalink: /terms-of-service/
---
```

### ❺ 커밋 & 푸시
```bash
git add _config.yml legal/privacy-policy.md legal/terms-of-service.md
git commit -m "docs: GitHub Pages 호스팅 설정"
git push origin main
```

### ❻ 확인
1분 후 브라우저로 접속:
- https://jbaek777.github.io/app_uxui/privacy-policy/
- https://jbaek777.github.io/app_uxui/terms-of-service/

✅ 마크다운이 HTML 로 예쁘게 렌더링되면 완료.

---

## 🥈 방법 2: Vercel (저장소 Private 유지하고 싶을 때)

### 장점
- ✅ Private 저장소도 무료 호스팅
- ✅ HTTPS 자동, CDN 빠름
- ✅ 커스텀 도메인 쉬움

### 순서
1. https://vercel.com 가입 (GitHub 계정 연동)
2. **New Project** → `meatmanager` 저장소 선택
3. **Framework Preset**: `Other`
4. **Root Directory**: `legal`
5. **Build Command**: 비워둠
6. **Output Directory**: `./`
7. **Deploy** 클릭
8. 배포 후 URL: `https://meatmanager-[hash].vercel.app/privacy-policy.md`

### 단점
- `.md` 파일이 그대로 노출 (HTML 렌더링 안 됨)
- 해결: `privacy-policy.md` 를 `privacy-policy.html` 로 변환 필요 (pandoc 또는 VSCode 플러그인)

---

## 🥉 방법 3: Notion 공개 페이지 (가장 간단)

### 장점
- ✅ 코드·배포 지식 불필요
- ✅ 5분이면 완료
- ✅ 수정하면 즉시 반영

### 순서
1. Notion 에서 새 페이지 생성
2. `privacy-policy.md` 전체 복사 → Notion 에 붙여넣기 (자동 변환됨)
3. 우측 상단 **공유** → **웹에 공개** 토글 ON
4. **링크 복사** → 이 URL 을 앱스토어에 등록

### 단점
- URL 이 못생김: `https://www.notion.so/abc123...`
- 커스텀 도메인은 유료 플랜 필요
- Notion 이 다운되면 문서도 접근 불가

### 이럴 때 추천
- 임시로 급하게 심사 제출해야 할 때
- 공식 사이트 출시 전 1주일 버전

---

## 📱 방법 4: 심플 정적 호스팅 비교

| 서비스 | 무료 | HTTPS | 마크다운 렌더링 | 커스텀 도메인 | 추천 상황 |
|---|---|---|---|---|---|
| **GitHub Pages** | ✅ | ✅ | ✅ (Jekyll) | ✅ | **기본 추천** |
| **Vercel** | ✅ | ✅ | ❌ (HTML 변환 필요) | ✅ | Private 저장소 |
| **Netlify** | ✅ | ✅ | △ (플러그인 필요) | ✅ | Vercel 대안 |
| **Notion** | ✅ | ✅ | ✅ | ❌ (유료) | 급할 때 |
| **Cloudflare Pages** | ✅ | ✅ | ❌ | ✅ | 속도 최우선 |

---

## 🔗 앱 코드에 URL 연결하기

호스팅 완료 후 앱 안에서 이 URL 을 열어주는 링크가 필요합니다.

### ❶ `SettingsScreen` 에 "개인정보처리방침" 버튼
```javascript
import { Linking } from 'react-native';

const PRIVACY_URL = 'https://jbaek777.github.io/app_uxui/privacy-policy/';
const TERMS_URL   = 'https://jbaek777.github.io/app_uxui/terms-of-service/';

<TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
  <Text>개인정보처리방침</Text>
</TouchableOpacity>

<TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
  <Text>이용약관</Text>
</TouchableOpacity>
```

### ❷ `PaywallScreen` 하단 푸터
```javascript
<Text style={styles.footerLinks}>
  <Text onPress={() => Linking.openURL(TERMS_URL)}>이용약관</Text>
  {' · '}
  <Text onPress={() => Linking.openURL(PRIVACY_URL)}>개인정보처리방침</Text>
</Text>
```

### ❸ 회원가입 화면 동의 체크박스 옆
```javascript
<Text>
  <Text onPress={() => Linking.openURL(TERMS_URL)} style={{textDecorationLine:'underline'}}>
    이용약관
  </Text>
  {' 및 '}
  <Text onPress={() => Linking.openURL(PRIVACY_URL)} style={{textDecorationLine:'underline'}}>
    개인정보처리방침
  </Text>
  {' 에 동의합니다'}
</Text>
```

### ❹ 한 곳에 URL 상수 관리 (권장)
`src/constants/legalUrls.js` 생성:
```javascript
export const LEGAL_URLS = {
  privacy: 'https://jbaek777.github.io/app_uxui/privacy-policy/',
  terms:   'https://jbaek777.github.io/app_uxui/terms-of-service/',
  support: 'mailto:skystory1031@gmail.com',
};
```

---

## 🧪 필수 검증 체크리스트

호스팅 완료 후 **반드시** 확인:

### 접근성
- [ ] URL 클릭 → 페이지 정상 로드 (404 아님)
- [ ] HTTPS (자물쇠 아이콘 표시)
- [ ] 로그인 없이 **누구나** 접속 가능
- [ ] 모바일에서도 가독성 OK (글자 안 깨짐)

### 내용
- [ ] 6개 플레이스홀더 모두 실제 값으로 치환됨
  - [회사명], [대표자명], [사업자등록번호], [사업장 주소], [고객지원 전화], [시행일자]
- [ ] 오타·줄바꿈 문제 없음
- [ ] 이메일 주소 클릭하면 메일 앱 열림
- [ ] 목차 링크가 정상 작동

### 속도
- [ ] 첫 로드 3초 이내
- [ ] 한국에서 직접 접속해서 확인 (VPN 없이)

### SEO (선택)
- [ ] 구글에서 `site:jbaek777.github.io/app_uxui` 검색으로 노출 확인
- [ ] 앱 이름으로 검색했을 때 나오게 하고 싶으면 `_config.yml` 의 `title` 수정

---

## 📝 앱스토어 양식에 입력할 자리

### Google Play Console
1. `정책 > 앱 콘텐츠 > 개인정보처리방침`
2. **URL 필드**에 `https://jbaek777.github.io/app_uxui/privacy-policy/` 붙여넣기
3. `저장` → 심사 자동 통과

### Apple App Store Connect
1. `앱 정보 > 일반` 하단
2. **개인정보처리방침 URL**: 위와 동일
3. **이용약관 URL**: `https://jbaek777.github.io/app_uxui/terms-of-service/`
4. `저장`

### 회원가입 동의 화면
- 회원가입시 URL 링크 **반드시 제공** (한국 법 요구사항)
- 체크박스 옆에 "이용약관 및 개인정보처리방침에 동의합니다" + 링크

---

## 🚨 자주 발생하는 문제 & 해결

### 문제 1: GitHub Pages URL 이 404
**원인**: `_config.yml` 누락 또는 front-matter 없음
**해결**:
1. 저장소 루트에 `_config.yml` 있는지 확인
2. `.md` 파일 맨 위에 `---` 블록 있는지 확인
3. Settings > Pages 에서 **빌드 상태** 확인 (에러 로그 표시됨)

### 문제 2: 스타일이 엉망
**원인**: Jekyll 테마 미지정
**해결**: `_config.yml` 에 `theme: jekyll-theme-cayman` 추가

### 문제 3: 한글이 깨짐
**원인**: `.md` 파일 인코딩이 UTF-8 아님
**해결**: VSCode 우측 하단 인코딩 표시 확인 → `UTF-8` 로 저장

### 문제 4: 앱 내 Linking.openURL 이 작동 안 함
**원인**: Android 에서 외부 브라우저 권한 누락 (거의 없음)
**해결**:
```javascript
import * as WebBrowser from 'expo-web-browser';
// Linking 대신 WebBrowser.openBrowserAsync(URL) 사용
```
→ 인앱 브라우저로 열려서 UX 더 좋음

### 문제 5: 수정해도 반영이 안 됨
**원인**: Jekyll 빌드 캐시 또는 CDN 캐시
**해결**:
1. `git push` 후 5분 대기
2. 강제 새로고침 (Ctrl+Shift+R / Cmd+Shift+R)
3. Settings > Pages > `Re-run jobs` 버튼

---

## 💰 비용 정리

| 항목 | 비용 |
|---|---|
| GitHub Pages 호스팅 | **0원** |
| 도메인(.io 서브도메인) | **0원** |
| HTTPS 인증서 | **0원** |
| 트래픽 | **0원** (월 100GB 까지) |
| **합계** | **0원** |

커스텀 도메인 (예: `legal.meatbig.co.kr`) 원하면:
- `.co.kr` 도메인 연 15,000원 ~ 22,000원
- DNS 설정은 가비아·후이즈 등에서 CNAME 추가 (10분)

---

## 🎬 추천 진행 순서

1. **오늘**: GitHub Pages 활성화 + `_config.yml` 추가 + front-matter 추가 + 푸시
2. **내일**: 6개 플레이스홀더 실제 값 채우기 (사업자 등록 완료 후)
3. **앱 심사 제출 전**: 모바일에서 URL 접속 검증
4. **출시 후**: 내용 수정 필요하면 `git push` 만으로 즉시 반영

---

## 📁 최종 파일 구조

```
meatmanager/
├── _config.yml                          ← 새로 추가
├── legal/
│   ├── privacy-policy.md               ← front-matter 추가
│   ├── terms-of-service.md             ← front-matter 추가
│   ├── store-listing-copy.md
│   ├── screenshot-guide.md
│   ├── play-data-safety-answers.md
│   └── hosting-guide.md                ← 본 문서
└── src/
    └── constants/
        └── legalUrls.js                 ← 새로 추가 (선택)
```

---

## 🔗 관련 파일
- `privacy-policy.md` — 호스팅 대상 문서 ①
- `terms-of-service.md` — 호스팅 대상 문서 ②
- `../project_launch_checklist.md` — 전체 출시 체크리스트 (STEP 1 에서 이 URL 필요)

---

## 🆘 막히면

1. GitHub Pages 공식: https://pages.github.com/
2. Jekyll 테마 갤러리: https://pages.github.com/themes/
3. GitHub Pages 빌드 로그: 저장소 → Actions 탭
