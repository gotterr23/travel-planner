-- 준비보드 자료에 다중 카테고리 지원
-- 기존 데이터는 그대로 유지됩니다 (ADD COLUMN IF NOT EXISTS)
ALTER TABLE reference_items ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
