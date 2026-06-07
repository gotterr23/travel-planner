-- 준비물(checklist_items)에 통합 카테고리 컬럼 추가
-- 기존 데이터는 그대로 유지됩니다 (ADD COLUMN IF NOT EXISTS)
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS category TEXT;
