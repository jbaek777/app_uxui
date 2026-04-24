# 🛡️ 관리자 계정 설정 가이드

> **목표**: `meatbigadmin@gmail.com` 으로 MeatBig 관리자 권한 부여
> **소요 시간**: 15분
> **전제**: Gmail 계정(`meatbigadmin@gmail.com`) 이미 생성 완료 ✅

---

## 🎯 작동 원리

```
┌─────────────────┐      ┌──────────────────┐     ┌─────────────────┐
│ meatbigadmin    │─────▶│  Supabase Auth   │────▶│ user_profiles   │
│ Gmail 계정      │      │  (email+password)│     │ role='admin'    │
└─────────────────┘      └──────────────────┘     └─────────────────┘
                                  │                         │
                                  ▼                         ▼
                         ┌──────────────────┐    ┌──────────────────┐
                         │ admin-dashboard  │    │ AdminScreen 모바일│
                         │  (웹, 데스크탑)  │    │ (PIN 없이 진입)  │
                         └──────────────────┘    └──────────────────┘
```

---

## ⚙️ Step 1 — DB 마이그레이션 적용

### 1-1. Supabase Dashboard 접속
👉 https://supabase.com/dashboard

### 1-2. 프로젝트 선택 → **SQL Editor**

### 1-3. `New query` 클릭 → 아래 파일 내용을 **전체 복사**해서 붙여넣기
```
C:\Users\백승진\meatmanager\meatmanager\supabase\migrations\20260425_admin_role.sql
```

### 1-4. **Run** 클릭

성공 시:
- ✅ `user_profiles` 테이블 생성
- ✅ `is_admin()` 함수 생성
- ✅ 15개 테이블에 `_admin_read` 정책 추가
- ✅ 기존 유저 백필 (role='user')

### 1-5. 검증 쿼리
```sql
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public' AND policyname LIKE '%_admin_read'
 ORDER BY tablename;
```
→ 약 15개 row 반환되면 정상

---

## 👤 Step 2 — Supabase Auth 에 관리자 계정 등록

### 2-1. Supabase Dashboard > 왼쪽 메뉴 **Authentication** > **Users**

### 2-2. 우측 상단 **Add user** > **Create new user** 클릭

### 2-3. 입력

| 필드 | 값 |
|---|---|
| **Email** | `meatbigadmin@gmail.com` |
| **Password** | 16자 이상 랜덤 (예: `Mb!AdminPw2026@K9xZ`) |
| **Auto Confirm User** | ✅ 체크 (필수) |
| **User Metadata** | 생략 |

### 2-4. **Create user** 클릭

### 2-5. 비밀번호 안전한 곳에 저장

> 🔐 **권장 저장 위치**: 1Password / Bitwarden / 메모장 보안폴더
> 분실 시 Dashboard > Users > 해당 계정 > `Send password recovery`

---

## 🔑 Step 3 — user_profiles 에 관리자 권한 부여

### 3-1. Supabase Dashboard > SQL Editor 로 돌아가기

### 3-2. 아래 쿼리 실행:
```sql
-- meatbigadmin@gmail.com 계정을 관리자로 승격
INSERT INTO user_profiles (auth_uid, role, display_name)
SELECT id, 'admin', 'MeatBig 관리자'
  FROM auth.users
 WHERE email = 'meatbigadmin@gmail.com'
ON CONFLICT (auth_uid) DO UPDATE
   SET role = 'admin',
       display_name = 'MeatBig 관리자';
```

### 3-3. 결과 확인
```sql
SELECT up.auth_uid, up.role, up.display_name, u.email
  FROM user_profiles up
  JOIN auth.users u ON u.id = up.auth_uid
 WHERE up.role = 'admin';
```
→ 1개 row 나오면 성공

### 3-4. `is_admin()` 함수 테스트 (Dashboard 의 SQL Editor 는 service_role 이라 일반 유저 시뮬레이션 불가 — 실제 테스트는 Step 4 에서)

---

## 🖥 Step 4 — 웹 대시보드 로그인 테스트

### 4-1. HTML 파일 열기

파일 경로:
```
C:\Users\백승진\meatmanager\meatmanager\admin-dashboard.html
```

**방법 A**: 파일 탐색기에서 더블클릭 → 기본 브라우저로 열림
**방법 B**: 크롬 주소창에 `file:///C:/Users/백승진/meatmanager/meatmanager/admin-dashboard.html` 입력

### 4-2. 로그인 화면 확인
- 이메일 입력란 + 비밀번호 입력란 2개 보여야 함
- 기존 "비밀번호만" 입력하던 화면은 구버전 — 새로고침(Ctrl+F5)

### 4-3. 로그인
- **Email**: `meatbigadmin@gmail.com`
- **Password**: Step 2-3 에서 설정한 비밀번호

### 4-4. 대시보드 진입 확인
- 상단 우측에 `👤 meatbigadmin@gmail.com` 표시
- **9개 탭** 모두 정상 데이터 표시 (데이터가 하나도 없으면 비어있음 — 정상)
- 상단 **로그아웃** 버튼 보임

### 4-5. 검증 테스트

**❌ 잘못된 비밀번호 입력 시**:
- "이메일 또는 비밀번호가 올바르지 않습니다" 에러

**❌ 일반 유저 계정(예: skystory1031@gmail.com)으로 로그인 시**:
- Auth 통과 → role 검증 실패 → "이 계정은 관리자 권한이 없습니다" → 자동 로그아웃

**✅ 관리자 계정 로그인**:
- 모든 데이터 표시 (RLS 우회)

---

## 📱 Step 5 — 앱 내 AdminScreen 테스트

### 5-1. 앱에서 `meatbigadmin@gmail.com` 으로 로그인
- 기존 LoginScreen 에서 이메일·비밀번호 입력
- 소셜 로그인 아님 (일반 이메일 로그인)

### 5-2. 설정 화면 이동

### 5-3. "**앱 정보**" 카드의 **버전 영역을 1.5초 길게 누르기**
→ AdminScreen 으로 진입

### 5-4. 결과 확인
- ✅ **관리자 계정**: PIN 입력 화면 건너뛰고 **바로 대시보드** 표시
- 상단에 초록색 `👤 MeatBig 관리자 · 관리자 계정 로그인` 배지
- 9개 기능 토글 Switch 표시

### 5-5. 일반 유저 계정으로 로그인했을 때 (폴백)
- PIN 입력 화면 표시 (기존 동작 유지)
- "관리자 계정으로 로그인하면 PIN 없이 진입 가능합니다" 안내

---

## 🔒 보안 체크리스트

- [ ] `meatbigadmin@gmail.com` Gmail 에 **2단계 인증** 설정
- [ ] Supabase 비밀번호 16자 이상 + 특수문자 포함
- [ ] 비밀번호를 코드·문서·git 에 **절대 기록 안 함**
- [ ] Gmail 복구 이메일/전화번호 설정
- [ ] admin-dashboard.html 은 **로컬에서만** 열기 (웹 호스팅 금지 — ANON_KEY 노출됨)

---

## 🚨 문제 해결

### Q1. 로그인은 되는데 데이터가 안 보임
→ `user_profiles.role` 이 `'admin'` 인지 확인:
```sql
SELECT role FROM user_profiles
 WHERE auth_uid = (SELECT id FROM auth.users WHERE email = 'meatbigadmin@gmail.com');
```
'user' 로 나오면 Step 3-2 SQL 재실행

### Q2. "이 계정은 관리자 권한이 없습니다"
→ Step 3 완료 안 됨. Step 3-2 SQL 실행

### Q3. HTML 대시보드 열었는데 로그인 화면 안 나옴
→ 캐시 문제: Ctrl+Shift+R (강제 새로고침)

### Q4. 앱에서 Admin 진입해도 PIN 화면만 보임
→ user_profiles 마이그레이션 미배포 또는 role 부여 실패
→ Step 1 + Step 3 재확인

### Q5. 관리자 계정이 여러 매장의 데이터를 못 봄
→ `is_admin()` 함수가 SECURITY DEFINER 로 생성됐는지 확인:
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'is_admin';
```
`prosecdef = true` 여야 함. `false` 면 Step 1 마이그레이션 일부 실패

### Q6. 비밀번호 분실
→ Dashboard > Authentication > Users > 해당 계정 > **Send password recovery**
→ `meatbigadmin@gmail.com` 수신함에서 리셋 링크 클릭

---

## 🔗 관련 파일

| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260425_admin_role.sql` | DB 스키마 |
| `admin-dashboard.html` | 웹 대시보드 (데스크탑) |
| `src/screens/AdminScreen.js` | 앱 내 관리자 화면 (모바일) |
| `../.claude/.../memory/reference_admin_system.md` | 운영 레퍼런스 (민감 정보 제외) |

---

## 💡 운영 팁

### 정기 점검 (월 1회)
- [ ] `user_profiles` 에서 `role='admin'` 계정 수 확인 (계속 1개여야 함)
- [ ] 비밀번호 교체 (6개월마다)
- [ ] Supabase Auth > Users > Session 탭에서 의심 로그인 확인

### 팀 확장 시
다른 팀원에게도 관리자 권한 주려면:
```sql
INSERT INTO user_profiles (auth_uid, role, display_name)
SELECT id, 'admin', '팀원 이름'
  FROM auth.users WHERE email = '팀원이메일@example.com';
```

### 권한 강등
```sql
UPDATE user_profiles SET role = 'user'
 WHERE auth_uid = (SELECT id FROM auth.users WHERE email = '강등할이메일');
```
