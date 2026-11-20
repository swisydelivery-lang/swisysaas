-- 001-zones.sql : delivery zones and fee snapshot columns
CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  office_id INT NOT NULL REFERENCES offices(id),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS zones_office_name_uq ON zones (office_id, lower(btrim(name)));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_zone TEXT,
  ADD COLUMN IF NOT EXISTS pickup_zone_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS dropoff_zone TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_zone_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extra_pickups JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS calculated_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fee_overridden BOOLEAN NOT NULL DEFAULT FALSE;

GRANT ALL ON ALL TABLES IN SCHEMA public TO swisy_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO swisy_app;
