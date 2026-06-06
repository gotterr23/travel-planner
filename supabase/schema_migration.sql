-- 마이그레이션 1: 준비 보드와 사진에 일정 연결 컬럼 추가
-- Supabase 대시보드 → SQL Editor에서 실행하세요

ALTER TABLE reference_items
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;

-- 마이그레이션 2: 준비 보드 아이템에 다중 카테고리 지원
ALTER TABLE reference_items
  ADD COLUMN IF NOT EXISTS schedule_ids UUID[] DEFAULT '{}';

-- 기존 단일 schedule_id 데이터를 schedule_ids 배열로 마이그레이션
UPDATE reference_items
SET schedule_ids = ARRAY[schedule_id]
WHERE schedule_id IS NOT NULL
  AND (schedule_ids IS NULL OR array_length(schedule_ids, 1) IS NULL);

-- 마이그레이션 3: 여행별 설정 저장 (예산 카테고리 이름 등)
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
