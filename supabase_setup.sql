-- ============================================
-- MeatManager Supabase 테이블 설정 SQL
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================

-- 1. 숙성 관리
CREATE TABLE IF NOT EXISTS aging_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cut         TEXT NOT NULL,
  grade       TEXT NOT NULL DEFAULT '1+',
  origin      TEXT NOT NULL DEFAULT '국내산(한우)',
  trace       TEXT,
  start_date  TEXT,
  day         INTEGER DEFAULT 0,
  target_day  INTEGER DEFAULT 28,
  temp        NUMERIC(4,1) DEFAULT 1.0,
  humidity    INTEGER DEFAULT 82,
  weight      NUMERIC(6,2) DEFAULT 0,
  init_weight NUMERIC(6,2) DEFAULT 0,
  status      TEXT DEFAULT 'early',
  notes       TEXT DEFAULT '—',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 위생 일지
CREATE TABLE IF NOT EXISTS hygiene_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_date    TEXT NOT NULL,
  log_time    TEXT,
  inspector   TEXT DEFAULT '미입력',
  items       JSONB DEFAULT '[]',
  status      TEXT DEFAULT 'pass',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 온도·습도 기록
CREATE TABLE IF NOT EXISTS sensor_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TEXT NOT NULL,
  temp        NUMERIC(4,1) NOT NULL,
  humidity    INTEGER,
  person      TEXT,
  note        TEXT DEFAULT '—',
  status      TEXT DEFAULT 'ok',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 직원 관리
CREATE TABLE IF NOT EXISTS employees (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT DEFAULT '정육사',
  hire        TEXT,
  health      TEXT,
  edu         TEXT,
  status      TEXT DEFAULT 'ok',
  color       TEXT DEFAULT '#e8950a',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 재고 관리
CREATE TABLE IF NOT EXISTS inventory (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  unit        TEXT DEFAULT 'ea',
  qty         NUMERIC(8,2) DEFAULT 0,
  min_qty     NUMERIC(8,2) DEFAULT 0,
  price       INTEGER DEFAULT 0,
  cat         TEXT DEFAULT '소모품',
  last_order  TEXT,
  status      TEXT DEFAULT 'ok',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 서류 관리
CREATE TABLE IF NOT EXISTS documents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label       TEXT NOT NULL,
  sub         TEXT,
  doc_date    TEXT,
  status      TEXT DEFAULT 'ok',
  file_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security) - 공개 접근 허용
-- 실제 서비스 시 auth 기반으로 변경 권장
-- ============================================
ALTER TABLE aging_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hygiene_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON aging_items  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON hygiene_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON sensor_logs  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON employees    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON inventory    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON documents    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 초기 샘플 데이터 (선택 사항)
-- ============================================
INSERT INTO aging_items (cut, grade, origin, trace, start_date, day, target_day, temp, humidity, weight, init_weight, status, notes)
VALUES
  ('채끝 (Ribeye)',    '1+', '국내산(한우)', 'HN-26021142', '2026.03.04', 23, 28, 1.2, 82, 12.8, 14.5, 'aging',  '색상 양호'),
  ('등심 (Striploin)', '1',  '국내산(한우)', 'HN-26021198', '2026.03.09', 18, 28, 1.1, 80, 10.2, 11.8, 'aging',  '—'),
  ('갈비 (Short Rib)', '1+', '미국산',       'HN-26030087', '2026.03.16', 11, 21, 1.3, 83,  8.9,  9.5, 'aging',  '—'),
  ('목심 (Chuck)',     '2',  '호주산',       'HN-26030201', '2026.03.21',  6, 21, 1.0, 82,  7.1,  7.5, 'early',  '—');

INSERT INTO hygiene_logs (log_date, log_time, inspector, items, status)
VALUES
  ('2026.03.27', '09:15', '홍길동', '["🪵 도마 소독 완료","🔪 칼·기구 소독 완료","🙌 손 세척 확인","작업장 온도: 3°C"]', 'pass'),
  ('2026.03.26', '09:05', '홍길동', '["🪵 도마 소독 완료","🔪 칼·기구 소독 완료","🙌 손 세척 확인"]', 'pass');

INSERT INTO employees (name, role, hire, health, edu, status, color)
VALUES
  ('홍길동', '정육사',  '2023.03.01', '2027.01.15', '2027.02.20', 'ok',      '#e8950a'),
  ('김○○',  '정육사',  '2024.06.15', '2026.02.10', '2027.01.10', 'expired', '#3d7ef5'),
  ('이○○',  '보조직원', '2025.01.10', '2028.03.05', '2027.06.15', 'ok',      '#12b87a');

INSERT INTO inventory (name, unit, qty, min_qty, price, cat, last_order, status)
VALUES
  ('진공포장지 (대)',   'roll',  2, 5,  42000, '소모품', '2026.03.10', 'critical'),
  ('소독제 (500ml)',   'EA',    1, 3,   8900, '소모품', '2026.03.05', 'critical'),
  ('위생장갑 (100매)', 'box',   8, 5,  12000, '소모품', '2026.03.15', 'ok'),
  ('포장비닐 롤',      'roll',  3, 4,  18000, '소모품', '2026.03.12', 'low'),
  ('체온계',           'EA',    2, 1,  35000, '장비',   '2025.12.01', 'ok');
