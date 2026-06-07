-- 준비물(checklist_items) 누락 컬럼 보강
-- 기존 데이터는 그대로 유지됩니다 (ADD COLUMN IF NOT EXISTS)
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS place TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS note TEXT;
