-- Migration 000004: Add user preferences, financial rails, and notification settings to investor_profiles
ALTER TABLE investor_profiles
ADD COLUMN IF NOT EXISTS phone VARCHAR(32) DEFAULT '',
ADD COLUMN IF NOT EXISTS payout_currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS bank_cbu_or_alias VARCHAR(64) DEFAULT '',
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) DEFAULT '',
ADD COLUMN IF NOT EXISTS web3_wallet_address VARCHAR(128) DEFAULT '',
ADD COLUMN IF NOT EXISTS auto_reinvest_yield BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_construction_alerts BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_audit_reports BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_early_access BOOLEAN DEFAULT TRUE;
