-- =====================================================
-- 🔒 보안 강화 마이그레이션 — Multi-tenant 격리 + RLS 정식화
-- 생성일: 2026-04-22
--
-- 배경:
--   초기 베타에서 "public_all" / "Allow all" 정책으로 전체 접근 허용 상태
--   → ANON 키만 있으면 모든 정육점의 데이터 조회·수정 가능 (Critical)
--
-- 목표:
--   1) stores 테이블에 auth_uid 추가 → 사용자 ↔ 가게 1:1 매핑
--   2) store_members에 auth_uid 추가 → 직원 계정 ↔ 사업장 연결
--   3) 모든 데이터 테이블에 store_id 추가 → multi-tenant 격리
--   4) 기존 "Allow all" 정책 제거, auth.uid() 기반 RLS로 교체
--
-- ⚠️ 주의사항:
--   · 기존 레코드는 auth_uid=NULL, store_id=NULL 상태
--   · 마이그레이션 후 AsyncStorage의 로컬 데이터가 있는 기존 사용자는
--     OnboardingScreen 재진입 시 upsert로 auth_uid 채워짐
--   · "기존 레코드 백필 전략" 은 아래 [백필] 섹션 참조
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 0. 컬럼 먼저 전부 추가 (정책이 서로 참조하므로 순서 중요)
-- =====================================================
ALTER TABLE stores        ADD COLUMN IF NOT EXISTS auth_uid UUID DEFAULT auth.uid();
ALTER TABLE store_members ADD COLUMN IF NOT EXISTS auth_uid UUID;

CREATE INDEX IF NOT EXISTS idx_stores_auth_uid        ON stores(auth_uid);
CREATE INDEX IF NOT EXISTS idx_store_members_auth_uid ON store_members(auth_uid);
CREATE INDEX IF NOT EXISTS idx_store_members_store    ON store_members(store_id);

-- =====================================================
-- SECTION 0.5. SECURITY DEFINER 헬퍼 — RLS 무한재귀 회피
--
-- 문제: store_members 정책이 다시 store_members 를 조회하면
--       Postgres 가 "infinite recursion detected in policy" 에러 발생
-- 해결: SECURITY DEFINER 함수 내부에서는 RLS 가 우회되므로
--       정책이 이 함수만 호출하면 재귀 없음
-- =====================================================
CREATE OR REPLACE FUNCTION public.user_store_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id       FROM stores        WHERE auth_uid = auth.uid()
  UNION
  SELECT store_id FROM store_members WHERE auth_uid = auth.uid()
$$;

-- 익명 롤에게 EXECUTE 권한 부여 (RLS 컨텍스트에서 호출 가능해야 함)
GRANT EXECUTE ON FUNCTION public.user_store_ids() TO anon, authenticated;

-- =====================================================
-- SECTION 1. stores 테이블 — 소유자 식별 + RLS
-- =====================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 기존 전체 허용 정책 제거
DROP POLICY IF EXISTS "public_all"         ON stores;
DROP POLICY IF EXISTS "Allow all for stores" ON stores;
DROP POLICY IF EXISTS "Allow all"          ON stores;

-- 소유자(사장) 본인 store만 접근
DROP POLICY IF EXISTS stores_owner ON stores;
CREATE POLICY stores_owner ON stores
  FOR ALL
  USING      (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid());

-- 직원도 소속 store 읽기 가능 (store_members에 연결되어 있으면)
DROP POLICY IF EXISTS stores_member_read ON stores;
CREATE POLICY stores_member_read ON stores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM store_members m
      WHERE m.store_id = stores.id
        AND m.auth_uid = auth.uid()
    )
  );

-- =====================================================
-- SECTION 2. store_members — 직원 계정 연결
-- =====================================================
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON store_members;
DROP POLICY IF EXISTS "Allow all"  ON store_members;

-- 같은 store 소속자만 전체 조회 가능 (사장·직원 모두) — 재귀 회피용 함수 사용
DROP POLICY IF EXISTS sm_same_store_read ON store_members;
CREATE POLICY sm_same_store_read ON store_members
  FOR SELECT
  USING (store_id IN (SELECT public.user_store_ids()));

-- INSERT/UPDATE/DELETE는 store 사장만
DROP POLICY IF EXISTS sm_owner_write ON store_members;
CREATE POLICY sm_owner_write ON store_members
  FOR ALL
  USING      (store_id IN (SELECT id FROM stores WHERE auth_uid = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE auth_uid = auth.uid()));

-- =====================================================
-- SECTION 3. 데이터 테이블 — store_id 컬럼 + multi-tenant RLS
--
-- 적용 대상:
--   meat_inventory, sales_history, yield_history,
--   aging_items, hygiene_logs, sensor_logs,
--   employees, expiry_edit_logs, closing_reports,
--   inventory, documents
-- =====================================================

-- 반복 정책 적용 함수 (공통 로직)
CREATE OR REPLACE FUNCTION apply_store_rls(tbl TEXT) RETURNS VOID AS $$
DECLARE
  col_type TEXT;
BEGIN
  -- 기존 store_id 컬럼이 TEXT(옛날 bizNo 포맷)이면 *_legacy 로 개명
  -- → 새 UUID 컬럼과 충돌 방지, 옛 데이터는 보존 (수동 백필용)
  SELECT data_type INTO col_type
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name=tbl AND column_name='store_id';

  IF col_type IS NOT NULL AND col_type <> 'uuid' THEN
    -- 옛 인덱스도 함께 개명 (이름 충돌 방지)
    EXECUTE format('ALTER INDEX IF EXISTS idx_%s_store_id RENAME TO idx_%s_store_id_legacy', tbl, tbl);
    EXECUTE format('ALTER TABLE %I RENAME COLUMN store_id TO store_id_legacy', tbl);
  END IF;

  -- UUID store_id 컬럼 추가 (이미 UUID 면 스킵)
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS store_id UUID', tbl);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_store_id ON %I(store_id)', tbl, tbl);

  -- RLS 활성화
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

  -- 기존 전체 허용 정책 삭제 (이름 여러 버전 대응)
  EXECUTE format('DROP POLICY IF EXISTS "public_all" ON %I', tbl);
  EXECUTE format('DROP POLICY IF EXISTS "Allow all"  ON %I', tbl);
  -- 정책명은 식별자이므로 %I 로 감싸야 함 (%L 은 문자열 리터럴 — 42601 에러 원인)
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Allow all for ' || tbl, tbl);

  -- 새 정책: 소속 store 만 접근 (사장 + 직원 모두) — SECURITY DEFINER 함수로 재귀 회피
  EXECUTE format('DROP POLICY IF EXISTS %s_store_access ON %I', tbl, tbl);
  EXECUTE format($p$
    CREATE POLICY %s_store_access ON %I
      FOR ALL
      USING      (store_id IN (SELECT public.user_store_ids()))
      WITH CHECK (store_id IN (SELECT public.user_store_ids()))
  $p$, tbl, tbl);
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 적용
SELECT apply_store_rls('meat_inventory');
SELECT apply_store_rls('sales_history');
SELECT apply_store_rls('yield_history');
SELECT apply_store_rls('aging_items');
SELECT apply_store_rls('hygiene_logs');
SELECT apply_store_rls('sensor_logs');
SELECT apply_store_rls('employees');
SELECT apply_store_rls('expiry_edit_logs');
SELECT apply_store_rls('closing_reports');
SELECT apply_store_rls('inventory');
SELECT apply_store_rls('documents');

-- 함수는 정리
DROP FUNCTION IF EXISTS apply_store_rls(TEXT);

-- =====================================================
-- SECTION 4. 백필 (기존 데이터가 있는 경우)
--
-- 기존에 누군가 이미 데이터를 쌓아둔 상태라면,
-- 해당 데이터의 소유 store_id/auth_uid 가 비어있어 접근 불가.
--
-- ⚠️ 소유자가 명확하지 않으면 자동 백필 불가 (수동 확인 필요).
--
-- 추천 전략:
--   1) 테스트 데이터라면 → 전부 DELETE 후 새로 시작
--   2) 실데이터라면      → store_id_legacy (옛 bizNo TEXT) ↔ stores.store_id 매칭으로 UUID 백필
--
-- 2) 실데이터 백필 샘플 (필요시 주석 해제 후 수동 실행):
--
-- UPDATE meat_inventory m
--    SET store_id = s.id
--   FROM stores s
--  WHERE m.store_id IS NULL
--    AND m.store_id_legacy = s.store_id;
-- (다른 테이블 동일 패턴 반복)
--
-- 1) 테스트 데이터 삭제 샘플 (필요시 주석 해제 후 수동 실행):
--
-- DELETE FROM meat_inventory   WHERE store_id IS NULL;
-- DELETE FROM sales_history    WHERE store_id IS NULL;
-- DELETE FROM yield_history    WHERE store_id IS NULL;
-- DELETE FROM aging_items      WHERE store_id IS NULL;
-- DELETE FROM hygiene_logs     WHERE store_id IS NULL;
-- DELETE FROM sensor_logs      WHERE store_id IS NULL;
-- DELETE FROM employees        WHERE store_id IS NULL;
-- DELETE FROM expiry_edit_logs WHERE store_id IS NULL;
-- DELETE FROM closing_reports  WHERE store_id IS NULL;
-- DELETE FROM inventory        WHERE store_id IS NULL;
-- DELETE FROM documents        WHERE store_id IS NULL;
-- =====================================================

COMMIT;

-- =====================================================
-- 확인 쿼리 (적용 후 실행해서 검증)
--
-- 1) 모든 테이블 RLS 활성화 여부
-- SELECT tablename, rowsecurity
-- FROM pg_tables WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- 2) 전체 허용 정책이 남아있지 않은지
-- SELECT tablename, policyname, qual
-- FROM pg_policies WHERE schemaname = 'public'
--   AND (qual = 'true' OR qual IS NULL);
-- =====================================================
