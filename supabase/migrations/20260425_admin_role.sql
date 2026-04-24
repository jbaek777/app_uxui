-- =====================================================
-- 🛡️ 관리자 계정 시스템 — 2026-04-25
--
-- 목표:
--   1) user_profiles 테이블 신규 → 사용자 메타(role, display_name) 분리 관리
--   2) is_admin() SECURITY DEFINER 함수 → RLS 정책에서 관리자 검사
--   3) 기존 store_id 기반 RLS 정책에 "OR is_admin()" 추가
--      → 관리자는 모든 매장 데이터 SELECT 가능 (수정·삭제는 불가, 읽기 전용)
--      → 일반 유저(사장·직원)는 본인 소속 매장만 (변화 없음)
--
-- 관리자 계정 생성 방법 (본 마이그레이션 실행 후):
--   Step 1. Supabase Dashboard > Authentication > Users > "Add user"
--           - Email: meatbigadmin@gmail.com
--           - Password: (랜덤 16자 이상 권장)
--           - "Auto Confirm User" 체크
--   Step 2. 아래 SQL 한 줄 실행:
--     INSERT INTO user_profiles (auth_uid, role, display_name)
--     SELECT id, 'admin', 'MeatBig 관리자'
--       FROM auth.users
--      WHERE email = 'meatbigadmin@gmail.com';
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1. user_profiles 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  auth_uid      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin', 'support')),
  display_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION user_profiles_touch_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION user_profiles_touch_updated();

-- RLS: 본인 프로필은 본인만, 관리자는 모든 프로필 읽기
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS up_self ON user_profiles;
CREATE POLICY up_self ON user_profiles
  FOR ALL
  USING      (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid());

-- =====================================================
-- SECTION 2. is_admin() 헬퍼 함수
--
-- RLS 정책 안에서 재귀 없이 관리자 체크 가능 (SECURITY DEFINER)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE auth_uid = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 관리자 본인 프로필은 admin role 기반으로도 읽기 가능하게
DROP POLICY IF EXISTS up_admin_read ON user_profiles;
CREATE POLICY up_admin_read ON user_profiles
  FOR SELECT
  USING (public.is_admin());

-- =====================================================
-- SECTION 3. 기존 테이블 RLS 에 관리자 읽기 예외 추가
--
-- 정책명: {tbl}_admin_read — SELECT 만 허용 (안전장치)
-- =====================================================
CREATE OR REPLACE FUNCTION apply_admin_read(tbl TEXT) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name=tbl
  ) THEN
    RAISE NOTICE '⏭  skip admin policy: table public.% not found', tbl;
    RETURN;
  END IF;

  EXECUTE format('DROP POLICY IF EXISTS %s_admin_read ON %I', tbl, tbl);
  EXECUTE format($p$
    CREATE POLICY %s_admin_read ON %I
      FOR SELECT
      USING (public.is_admin())
  $p$, tbl, tbl);
END;
$$ LANGUAGE plpgsql;

-- stores + store_members + 모든 데이터 테이블
SELECT apply_admin_read('stores');
SELECT apply_admin_read('store_members');
SELECT apply_admin_read('meat_inventory');
SELECT apply_admin_read('sales_history');
SELECT apply_admin_read('yield_history');
SELECT apply_admin_read('aging_items');
SELECT apply_admin_read('hygiene_logs');
SELECT apply_admin_read('sensor_logs');
SELECT apply_admin_read('employees');
SELECT apply_admin_read('expiry_edit_logs');
SELECT apply_admin_read('closing_reports');
SELECT apply_admin_read('inventory');
SELECT apply_admin_read('documents');
SELECT apply_admin_read('job_profiles');
SELECT apply_admin_read('headhunt_requests');

DROP FUNCTION IF EXISTS apply_admin_read(TEXT);

-- =====================================================
-- SECTION 4. 신규 사용자 가입 시 user_profiles 자동 생성 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (auth_uid, role, display_name)
  VALUES (
    NEW.id,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (auth_uid) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SECTION 5. 기존 auth.users 백필 (이미 가입된 사용자 user_profiles 누락 방지)
-- =====================================================
INSERT INTO user_profiles (auth_uid, role, display_name)
SELECT
  id,
  'user',
  COALESCE(raw_user_meta_data->>'display_name', email)
FROM auth.users
ON CONFLICT (auth_uid) DO NOTHING;

COMMIT;

-- =====================================================
-- 검증 쿼리 (마이그레이션 적용 후 실행 권장)
-- =====================================================

-- 1) user_profiles 테이블 확인
-- SELECT auth_uid, role, display_name FROM user_profiles ORDER BY created_at DESC LIMIT 10;

-- 2) 관리자 1명 지정 (meatbigadmin@gmail.com 계정을 Supabase Auth에 먼저 생성한 뒤)
-- UPDATE user_profiles
--    SET role = 'admin', display_name = 'MeatBig 관리자'
--  WHERE auth_uid = (SELECT id FROM auth.users WHERE email = 'meatbigadmin@gmail.com');

-- 3) is_admin() 함수 직접 테스트 (로그인 세션에서)
-- SELECT public.is_admin();

-- 4) 관리자 read 정책 확인
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname = 'public' AND policyname LIKE '%_admin_read'
--  ORDER BY tablename;
