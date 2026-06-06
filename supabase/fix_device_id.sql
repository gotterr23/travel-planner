-- trips 테이블에 device_id 컬럼 추가
ALTER TABLE trips ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_trips_device_id ON trips(device_id);
