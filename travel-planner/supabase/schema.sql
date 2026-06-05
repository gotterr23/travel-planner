-- 여행 플래너 Supabase 스키마
-- Supabase 대시보드 → SQL Editor에 이 내용을 붙여넣고 실행하세요

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

-- 3. 준비 보드 테이블 (링크 + 레퍼런스 사진)
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

-- RLS (Row Level Security) — 링크 기반이므로 모두 허용
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "모두 읽기 가능" ON trips FOR SELECT USING (true);
CREATE POLICY "모두 쓰기 가능" ON trips FOR INSERT WITH CHECK (true);
CREATE POLICY "모두 수정 가능" ON trips FOR UPDATE USING (true);
CREATE POLICY "모두 삭제 가능" ON trips FOR DELETE USING (true);

CREATE POLICY "모두 읽기 가능" ON schedules FOR SELECT USING (true);
CREATE POLICY "모두 쓰기 가능" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "모두 수정 가능" ON schedules FOR UPDATE USING (true);
CREATE POLICY "모두 삭제 가능" ON schedules FOR DELETE USING (true);

CREATE POLICY "모두 읽기 가능" ON reference_items FOR SELECT USING (true);
CREATE POLICY "모두 쓰기 가능" ON reference_items FOR INSERT WITH CHECK (true);
CREATE POLICY "모두 수정 가능" ON reference_items FOR UPDATE USING (true);
CREATE POLICY "모두 삭제 가능" ON reference_items FOR DELETE USING (true);

CREATE POLICY "모두 읽기 가능" ON photos FOR SELECT USING (true);
CREATE POLICY "모두 쓰기 가능" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "모두 수정 가능" ON photos FOR UPDATE USING (true);
CREATE POLICY "모두 삭제 가능" ON photos FOR DELETE USING (true);

CREATE POLICY "모두 읽기 가능" ON budget_items FOR SELECT USING (true);
CREATE POLICY "모두 쓰기 가능" ON budget_items FOR INSERT WITH CHECK (true);
CREATE POLICY "모두 수정 가능" ON budget_items FOR UPDATE USING (true);
CREATE POLICY "모두 삭제 가능" ON budget_items FOR DELETE USING (true);
