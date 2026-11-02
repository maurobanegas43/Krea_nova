-- Migration 000008: Add dni_hash for O(1) blind index lookups and index phone for uniqueness checks
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS dni_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_dni_hash ON investor_profiles(dni_hash);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
