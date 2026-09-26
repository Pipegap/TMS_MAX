ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS okved_code TEXT;

ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS okved_name TEXT;

CREATE INDEX IF NOT EXISTS idx_business_profiles_okved_code
    ON business_profiles (okved_code);