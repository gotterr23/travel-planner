-- 기존 테이블 삭제 후 새로 만들기
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS reference_items CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS trips CASCADE;

-- 1. 여행 테이블
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  cover_image_url TEXT,
  admin_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  member_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 일정 테이블
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 준비 보드 테이블
CREATE TABLE reference_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('link', 'image')) NOT NULL,
  title TEXT,
  url TEXT,
  image_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 앨범 테이블
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 예산 테이블
CREATE TABLE budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  category TEXT CHECK (category IN ('숙박', '교통', '식비', '관광', '기타')) NOT NULL DEFAULT '기타',
  title TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  paid_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 보안 설정
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
