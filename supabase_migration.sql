-- =====================================================
-- MeatBig Supabase Migration
-- Supabase Dashboard > SQL Editor 에서 실행
-- =====================================================

-- 1. 고기 재고
CREATE TABLE IF NOT EXISTS meat_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cut TEXT NOT NULL,
  origin TEXT DEFAULT '',
  qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  buy_price INTEGER DEFAULT 0,
  sell_price INTEGER DEFAULT 0,
  expire TEXT,
  dday INTEGER DEFAULT 99,
  status TEXT DEFAULT 'ok',
  sold BOOLEAN DEFAULT false,
  sold_date TEXT,
  edit_count INTEGER DEFAULT 0,
  edit_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 판매 이력
CREATE TABLE IF NOT EXISTS sales_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cut TEXT NOT NULL,
  origin TEXT,
  qty NUMERIC DEFAULT 0,
  buy_price INTEGER DEFAULT 0,
  sell_price INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  sold_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 수율 계산 이력
CREATE TABLE IF NOT EXISTS yield_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT DEFAULT '',
  init_weight NUMERIC,
  final_weight NUMERIC,
  yield_pct TEXT,
  loss_kg TEXT,
  real_cost INTEGER DEFAULT 0,
  recommend INTEGER DEFAULT 0,
  calc_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 숙성 관리 (이미 있을 수 있음)
CREATE TABLE IF NOT EXISTS aging_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cut TEXT,
  grade TEXT,
  trace TEXT,
  origin TEXT,
  start_date TEXT,
  day INTEGER DEFAULT 0,
  target_day INTEGER DEFAULT 28,
  temp NUMERIC,
  humidity NUMERIC,
  weight NUMERIC,
  init_weight NUMERIC,
  status TEXT DEFAULT 'aging',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 위생일지 (이미 있을 수 있음)
CREATE TABLE IF NOT EXISTS hygiene_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_date TEXT,
  log_time TEXT,
  session TEXT,
  inspector TEXT,
  items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pass',
  signature BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 온도/습도 기록 (이미 있을 수 있음)
CREATE TABLE IF NOT EXISTS sensor_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_date TEXT,
  log_time TEXT,
  temp NUMERIC,
  humidity NUMERIC,
  person TEXT,
  status TEXT DEFAULT 'ok',
  note TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 직원
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '직원',
  pin TEXT,
  hire TEXT,
  health TEXT,
  edu TEXT,
  status TEXT DEFAULT 'ok',
  color TEXT DEFAULT '#3d7ef5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 소비기한 수정 로그
CREATE TABLE IF NOT EXISTS expiry_edit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meat_id TEXT,
  cut TEXT,
  old_expire TEXT,
  new_expire TEXT,
  edit_count INTEGER,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 마감 정산
CREATE TABLE IF NOT EXISTS closing_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date TEXT,
  sales JSONB DEFAULT '[]',
  waste JSONB DEFAULT '[]',
  total_revenue INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  total_waste INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 (anon 키로 읽기/쓰기 허용 — 베타용, 추후 인증 추가)
ALTER TABLE meat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE aging_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hygiene_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE expiry_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_reports ENABLE ROW LEVEL SECURITY;

-- 베타 기간 모든 접근 허용 (추후 인증 기반으로 변경)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'meat_inventory','sales_history','yield_history','aging_items',
    'hygiene_logs','sensor_logs','employees','expiry_edit_logs','closing_reports'
  ])
  LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "Allow all for %1$s" ON %1$s FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
