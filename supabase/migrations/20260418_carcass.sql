-- =====================================================
-- 계근 입고 (Carcass weighing) — Phase 1 MVP
-- 생성일: 2026-04-18
-- 소 한 마리(또는 반마리/쿼터)를 통째로 구매 → 산피/지육/발골 3단 계근 → 부위별 분할
-- =====================================================

-- ─── 원두 계근 세션 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS carcass_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),

  -- 매장 메타 (multi-tenant RLS 편의용)
  store_id            TEXT,
  store_name          TEXT,
  biz_type            TEXT,
  region_si           TEXT,
  region_gu           TEXT,
  region_dong         TEXT,

  -- 헤더 정보
  species             TEXT,                 -- 한우 / 육우 / 한돈 / 흑돼지 / 기타
  trace_no            TEXT,                 -- 축산물이력번호 (선택)
  supplier_name       TEXT,
  purchase_date       DATE,

  -- 3단 무게 측정
  live_weight_kg      NUMERIC(10,3),        -- 산피 무게
  live_unit_price     NUMERIC(12,2),        -- 산피 Kg단가
  carcass_weight_kg   NUMERIC(10,3),        -- 지육 무게
  trimmed_weight_kg   NUMERIC(10,3),        -- 기름뺀지육(발골) 무게
  fat_weight_kg       NUMERIC(10,3),

  -- 부대비용
  transport_cost      NUMERIC(12,0) DEFAULT 0,
  unload_cost         NUMERIC(12,0) DEFAULT 0,
  broker_cost         NUMERIC(12,0) DEFAULT 0,
  hoof_cost           NUMERIC(12,0) DEFAULT 0,

  -- 집계 (클라이언트에서 계산해 저장)
  total_cost          NUMERIC(12,2),
  trimmed_unit_price  NUMERIC(12,2),        -- total_cost / trimmed_weight_kg
  expected_revenue    NUMERIC(14,2),
  expected_margin     NUMERIC(14,2),
  margin_pct          NUMERIC(6,3),

  status              TEXT DEFAULT 'done',  -- draft | weighing | done
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carcass_sessions_auth_uid  ON carcass_sessions(auth_uid);
CREATE INDEX IF NOT EXISTS idx_carcass_sessions_store_id  ON carcass_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_carcass_sessions_created   ON carcass_sessions(created_at DESC);


-- ─── 부위별 계근 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS carcass_parts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES carcass_sessions(id) ON DELETE CASCADE,
  auth_uid             UUID NOT NULL DEFAULT auth.uid(),
  store_id             TEXT,

  part_name            TEXT NOT NULL,
  part_order           INTEGER DEFAULT 0,
  is_custom            BOOLEAN DEFAULT FALSE,    -- 사업장에서 추가한 커스텀 부위

  weight_kg            NUMERIC(10,3),
  ratio                NUMERIC(6,5),             -- weight_kg / trimmed_weight_kg
  allocated_cost       NUMERIC(12,2),            -- ratio × session.total_cost
  retail_price_kg      NUMERIC(12,2),
  retail_price_600g    NUMERIC(12,2),
  sale_amount          NUMERIC(14,2),
  profit               NUMERIC(14,2),

  linked_inventory_id  TEXT,                      -- 연결된 meat_inventory row
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carcass_parts_session   ON carcass_parts(session_id);
CREATE INDEX IF NOT EXISTS idx_carcass_parts_auth_uid  ON carcass_parts(auth_uid);
CREATE INDEX IF NOT EXISTS idx_carcass_parts_name      ON carcass_parts(part_name);


-- ─── 매장별 부위 프리셋 (커스텀 부위 저장) ────────────
CREATE TABLE IF NOT EXISTS carcass_part_presets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid             UUID NOT NULL DEFAULT auth.uid(),
  store_id             TEXT,
  species              TEXT NOT NULL,              -- 한우 / 육우 / 한돈 ...

  parts_enabled        JSONB,                      -- ["등심","안심",...] (사용 부위)
  custom_parts         JSONB,                      -- [{ name, order, defaultPrice }]
  default_prices       JSONB,                      -- { "등심": 15833, ... }
  default_extras       JSONB,                      -- { transport: 150000, ... }
  last_ratios          JSONB,                      -- 최근 평균 수율 캐시

  updated_at           TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (store_id, species)
);

CREATE INDEX IF NOT EXISTS idx_carcass_preset_store  ON carcass_part_presets(store_id);


-- ─── RLS 활성화 ──────────────────────────────────────
ALTER TABLE carcass_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carcass_parts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE carcass_part_presets ENABLE ROW LEVEL SECURITY;

-- 세션: 본인 것만 CRUD
DROP POLICY IF EXISTS "carcass_sessions_rw_own" ON carcass_sessions;
CREATE POLICY "carcass_sessions_rw_own" ON carcass_sessions
  FOR ALL USING (auth_uid = auth.uid()) WITH CHECK (auth_uid = auth.uid());

-- 부위
DROP POLICY IF EXISTS "carcass_parts_rw_own" ON carcass_parts;
CREATE POLICY "carcass_parts_rw_own" ON carcass_parts
  FOR ALL USING (auth_uid = auth.uid()) WITH CHECK (auth_uid = auth.uid());

-- 프리셋
DROP POLICY IF EXISTS "carcass_presets_rw_own" ON carcass_part_presets;
CREATE POLICY "carcass_presets_rw_own" ON carcass_part_presets
  FOR ALL USING (auth_uid = auth.uid()) WITH CHECK (auth_uid = auth.uid());


-- ─── 수율 평균 집계 뷰 (Sheet1 기능 자동화용, Phase 2에서 활용) ─
CREATE OR REPLACE VIEW carcass_yield_stats AS
SELECT
  p.auth_uid,
  p.store_id,
  s.species,
  p.part_name,
  COUNT(*)                AS sample_count,
  AVG(p.ratio)            AS avg_ratio,
  STDDEV(p.ratio)         AS stddev_ratio,
  AVG(p.retail_price_kg)  AS avg_price_kg,
  MAX(p.created_at)       AS last_recorded_at
FROM carcass_parts p
JOIN carcass_sessions s ON s.id = p.session_id
WHERE p.ratio IS NOT NULL
GROUP BY p.auth_uid, p.store_id, s.species, p.part_name;
