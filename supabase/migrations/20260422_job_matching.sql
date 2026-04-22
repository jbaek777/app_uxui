-- =====================================================
-- 구인구직 플랫폼 (Job matching) — Phase 1 MVP
-- 생성일: 2026-04-22
-- 직업정보제공사업 기반 — 알선·중개 없음, 정보제공만
--
-- 핵심 원칙:
--   · 구직자(staff): 프로필·자가역량평가 무료
--   · 구인자(owner): 프로모 기간 무료 + 20건/월 헤드헌팅 쿼터
--   · 프로모 종료 후: Pro 플랜 기본 10건/월 + 추가구매 10건/₩15,000
--   · dual-view: public_profile(익명) + revealed_profile(수락 시만)
--   · RLS: auth_uid 기반 (owner는 자기 store, staff는 자기 profile)
-- =====================================================

-- 사업장 초대 코드 (hybrid UUID + 8자리 영숫자)
ALTER TABLE IF EXISTS stores
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR(8) UNIQUE;
-- I/O/0/1 제외한 영숫자 8자리 — 앱 또는 함수에서 생성

-- ─── 1. 구직 프로필 (staff 작성) ─────────────────────
CREATE TABLE IF NOT EXISTS job_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),

  -- 본인정보 (revealed 대상 — 수락 전에는 사장에게 노출 안함)
  full_name           TEXT NOT NULL,              -- 실명
  phone               TEXT,                       -- 본인인증 완료된 번호만
  birth_year          INT,

  -- 공개 프로필 (public view에 노출됨 — 익명)
  nickname            TEXT,                       -- 닉네임 (옵션)
  region_si           TEXT,                       -- 광역시/도
  region_gu           TEXT,                       -- 시/군/구
  career_years        INT DEFAULT 0,
  preferred_species   TEXT[],                     -- ['한우','한돈','흑돼지']
  preferred_role      TEXT,                       -- '발골','판매','관리','매니저' etc.
  desired_pay         TEXT,                       -- '시급 15,000원' 등 자유기입
  work_hours_pref     TEXT,                       -- '오전','오후','풀타임','협의'
  available_from      DATE,                       -- 근무 가능 시작일
  intro_text          TEXT,                       -- 자기소개 (익명 공개)
  certs               TEXT[],                     -- ['도축기능사','한식조리사'] 등
  photo_blurred_url   TEXT,                       -- 블러처리된 사진 (익명)
  photo_original_url  TEXT,                       -- 원본 (수락 시만 공개)

  -- 자가역량평가 결과
  assessment_grade    TEXT,                       -- 'D','C','B','A','S'
  assessment_score    NUMERIC(6,2),
  assessment_data     JSONB,                      -- 51문항 답변 원본
  assessed_at         TIMESTAMPTZ,

  -- 공개 상태
  is_public           BOOLEAN DEFAULT false,      -- 탐색에 노출되는지
  phone_verified      BOOLEAN DEFAULT false,

  -- 평판
  review_avg          NUMERIC(3,2),               -- 평균 평점
  review_count        INT DEFAULT 0,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_profiles_public
  ON job_profiles(is_public, region_si, assessment_grade)
  WHERE is_public = true;

-- ─── 2. 헤드헌팅 요청 (owner → staff) ─────────────────
CREATE TABLE IF NOT EXISTS headhunt_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),  -- 보낸 사장의 uid

  -- 보낸 사람 (owner) — RLS 판단용
  from_store_id       UUID,                       -- stores.id 참조 가능
  from_store_name     TEXT,
  from_owner_name     TEXT,

  -- 받는 사람 (staff) — profile_id만 저장, 실명은 수락 시 공개
  to_profile_id       UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,

  -- 메시지
  message             TEXT,                       -- 사장 → 구직자 제안 메시지
  offered_pay         TEXT,
  offered_role        TEXT,
  offered_start_date  DATE,

  -- 상태
  status              TEXT DEFAULT 'pending',     -- pending | accepted | declined | expired
  decided_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hh_to_profile ON headhunt_requests(to_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_hh_from_auth  ON headhunt_requests(auth_uid, status);

-- ─── 3. 쿼터 사용 기록 (월별) ─────────────────────────
CREATE TABLE IF NOT EXISTS contact_quota_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),
  store_id            UUID,                       -- 어느 가게 기준 집계
  year_month          VARCHAR(7) NOT NULL,        -- 'YYYY-MM'
  used_count          INT DEFAULT 0,              -- 이번 달 사용한 헤드헌팅 건수
  purchased_quota     INT DEFAULT 0,              -- 추가 구매한 쿼터 (이번 달 한정)
  plan_base_quota     INT DEFAULT 0,              -- 플랜 기본 쿼터 (프로모:20, Pro:10, 그외:0)
  UNIQUE (auth_uid, year_month)
);

-- ─── 4. 신고 (user reporting) ─────────────────────────
CREATE TABLE IF NOT EXISTS job_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),
  target_type         TEXT NOT NULL,              -- 'profile' | 'headhunt_request' | 'store'
  target_id           UUID NOT NULL,
  reason              TEXT,                       -- 'spam'|'impersonation'|'rude'|'etc'
  description         TEXT,
  status              TEXT DEFAULT 'open',        -- open | reviewing | resolved | rejected
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_reports_target ON job_reports(target_type, target_id, status);

-- ─── 5. 상호 후기 (근무 종료 후) ──────────────────────
CREATE TABLE IF NOT EXISTS job_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),
  reviewer_type       TEXT NOT NULL,              -- 'owner' | 'staff'
  reviewee_type       TEXT NOT NULL,              -- 'owner' | 'staff'
  reviewee_profile_id UUID,                       -- staff 리뷰인 경우
  reviewee_store_id   UUID,                       -- owner 리뷰인 경우
  rating              INT CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT,
  worked_from         DATE,
  worked_to           DATE,
  headhunt_request_id UUID REFERENCES headhunt_requests(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_staff ON job_reviews(reviewee_profile_id);
CREATE INDEX IF NOT EXISTS idx_reviews_store ON job_reviews(reviewee_store_id);

-- ─── 6. 휴대폰 본인인증 기록 ───────────────────────────
CREATE TABLE IF NOT EXISTS phone_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid            UUID NOT NULL DEFAULT auth.uid(),
  phone_hash          TEXT NOT NULL,              -- 전화번호 해시 (중복 가입 방지)
  ci_hash             TEXT,                       -- 본인인증 CI 해시 (옵션)
  verified_at         TIMESTAMPTZ DEFAULT NOW(),
  provider            TEXT,                       -- 'pass','sms-otp' 등
  UNIQUE (phone_hash)
);

-- ─── 7. Public view (익명 프로필) ──────────────────────
CREATE OR REPLACE VIEW job_profiles_public AS
SELECT
  id,
  nickname,
  region_si,
  region_gu,
  career_years,
  preferred_species,
  preferred_role,
  desired_pay,
  work_hours_pref,
  available_from,
  intro_text,
  certs,
  photo_blurred_url,       -- 원본은 제외
  assessment_grade,
  assessment_score,
  review_avg,
  review_count,
  phone_verified,
  created_at
FROM job_profiles
WHERE is_public = true;

-- ─── 8. Revealed view (수락 시만) ──────────────────────
-- 함수로 래핑 — headhunt_request_id + accepted 상태만 접근 허용
CREATE OR REPLACE FUNCTION get_revealed_profile(request_id UUID)
RETURNS TABLE (
  profile_id    UUID,
  full_name     TEXT,
  phone         TEXT,
  region_si     TEXT,
  region_gu     TEXT,
  photo_url     TEXT,
  assessment_grade TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.full_name, p.phone,
    p.region_si, p.region_gu,
    p.photo_original_url,
    p.assessment_grade
  FROM headhunt_requests r
  JOIN job_profiles p ON p.id = r.to_profile_id
  WHERE r.id = request_id
    AND r.auth_uid = auth.uid()       -- 요청 보낸 본인만
    AND r.status = 'accepted';        -- 수락된 경우만
END;
$$;

-- ─── RLS 정책 ────────────────────────────────────────
ALTER TABLE job_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE headhunt_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- job_profiles: 본인은 모두, 타인은 public만
DROP POLICY IF EXISTS jp_own   ON job_profiles;
DROP POLICY IF EXISTS jp_read_public ON job_profiles;
CREATE POLICY jp_own   ON job_profiles FOR ALL USING (auth_uid = auth.uid());
CREATE POLICY jp_read_public ON job_profiles FOR SELECT USING (is_public = true);

-- headhunt_requests: 보낸 사장 본인 + 받은 구직자 본인만
DROP POLICY IF EXISTS hh_sender   ON headhunt_requests;
DROP POLICY IF EXISTS hh_receiver ON headhunt_requests;
CREATE POLICY hh_sender ON headhunt_requests FOR ALL USING (auth_uid = auth.uid());
CREATE POLICY hh_receiver ON headhunt_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM job_profiles
    WHERE job_profiles.id = headhunt_requests.to_profile_id
      AND job_profiles.auth_uid = auth.uid()
  )
);
-- 구직자의 수락/거절 update 허용
DROP POLICY IF EXISTS hh_receiver_update ON headhunt_requests;
CREATE POLICY hh_receiver_update ON headhunt_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM job_profiles
    WHERE job_profiles.id = headhunt_requests.to_profile_id
      AND job_profiles.auth_uid = auth.uid()
  )
);

-- contact_quota_usage: 본인만
DROP POLICY IF EXISTS cqu_own ON contact_quota_usage;
CREATE POLICY cqu_own ON contact_quota_usage FOR ALL USING (auth_uid = auth.uid());

-- job_reports: 작성자 본인만 (관리자는 service_role 키로 접근)
DROP POLICY IF EXISTS jr_own ON job_reports;
CREATE POLICY jr_own ON job_reports FOR ALL USING (auth_uid = auth.uid());

-- job_reviews: 누구나 읽기 가능, 작성자 본인만 수정
DROP POLICY IF EXISTS jrv_read   ON job_reviews;
DROP POLICY IF EXISTS jrv_owner  ON job_reviews;
CREATE POLICY jrv_read  ON job_reviews FOR SELECT USING (true);
CREATE POLICY jrv_owner ON job_reviews FOR INSERT WITH CHECK (auth_uid = auth.uid());
CREATE POLICY jrv_upd   ON job_reviews FOR UPDATE USING (auth_uid = auth.uid());

-- phone_verifications: 본인만
DROP POLICY IF EXISTS pv_own ON phone_verifications;
CREATE POLICY pv_own ON phone_verifications FOR ALL USING (auth_uid = auth.uid());

-- ─── updated_at 트리거 ────────────────────────────────
CREATE OR REPLACE FUNCTION job_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_jp_updated ON job_profiles;
CREATE TRIGGER trg_jp_updated
  BEFORE UPDATE ON job_profiles
  FOR EACH ROW EXECUTE FUNCTION job_set_updated_at();

DROP TRIGGER IF EXISTS trg_hh_updated ON headhunt_requests;
CREATE TRIGGER trg_hh_updated
  BEFORE UPDATE ON headhunt_requests
  FOR EACH ROW EXECUTE FUNCTION job_set_updated_at();

-- ─── 사업장 초대 코드 생성 함수 (I/O/0/1 제외) ────────
CREATE OR REPLACE FUNCTION gen_invite_code()
RETURNS VARCHAR(8) LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32자 (I/O/0/1 제외)
  code  TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- 기존 stores 중 invite_code가 null인 row에 코드 배정 (일회성)
UPDATE stores SET invite_code = gen_invite_code() WHERE invite_code IS NULL;

-- =====================================================
-- 끝.
-- =====================================================
