-- ⚠️ 경고: 이 파일을 실행하면 모든 데이터가 영구 삭제됩니다!
-- 개발 환경 초기화 전용입니다. 운영 DB에서는 절대 실행하지 마세요.

-- ================================================================
-- 기존 테이블 전체 삭제
-- ================================================================
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS reference_items CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS trips CASCADE;

-- ================================================================
-- 1. 여행 테이블
-- ================================================================
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  cover_image_url TEXT,
  admin_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  member_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  board_categories JSONB DEFAULT '["숙소", "맛집", "관광지", "교통", "쇼핑", "기타"]'::jsonb,
  settings JSONB DEFAULT '{}',
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trips_device_id ON trips(device_id);

-- ================================================================
-- 2. 일정 테이블
-- ================================================================
CREATE TABLE schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  order_index INTEGER DEFAULT 0,
  place_name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  memo TEXT,
  time TEXT,
  participants TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. 준비 보드 테이블
-- ================================================================
CREATE TABLE reference_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('link', 'image')) NOT NULL,
  title TEXT,
  url TEXT,
  image_url TEXT,
  memo TEXT,
  category TEXT DEFAULT '기타',
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  schedule_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 4. 앨범 테이블
-- ================================================================
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 5. 예산 테이블
-- ================================================================
CREATE TABLE budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  category TEXT CHECK (category IN ('숙박', '교통', '식비', '관광', '기타')) NOT NULL DEFAULT '기타',
  title TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  paid_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 6. 준비물 체크리스트 테이블
-- ================================================================
CREATE TABLE checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  place TEXT,
  time TEXT,
  title TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- RLS (보안 설정)
-- ================================================================
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reference_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON budget_items FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON checklist_items FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- Storage 업로드 권한 (이미 있으면 삭제 후 재생성)
-- ================================================================
DROP POLICY IF EXISTS "allow_upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_select" ON storage.objects;
DROP POLICY IF EXISTS "allow_update" ON storage.objects;
DROP POLICY IF EXISTS "allow_delete" ON storage.objects;

CREATE POLICY "allow_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('photos', 'references'));
CREATE POLICY "allow_select" ON storage.objects FOR SELECT USING (bucket_id IN ('photos', 'references'));
CREATE POLICY "allow_update" ON storage.objects FOR UPDATE USING (bucket_id IN ('photos', 'references'));
CREATE POLICY "allow_delete" ON storage.objects FOR DELETE USING (bucket_id IN ('photos', 'references'));
