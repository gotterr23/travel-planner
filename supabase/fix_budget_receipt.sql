-- 예산 지출(budget_items)에 영수증 이미지 컬럼 추가
-- 기존 데이터는 그대로 유지됩니다 (ADD COLUMN IF NOT EXISTS)
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS receipt_url TEXT;
