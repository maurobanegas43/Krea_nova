-- 000003_create_payments.up.sql
-- Enables payment gateway integration, deposit tracking, and adds gateway_clearing account type.

ALTER TABLE ledger_accounts DROP CONSTRAINT IF EXISTS ledger_accounts_account_type_check;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_account_type_check 
    CHECK (account_type IN ('fiat_escrow', 'investor_wallet', 'platform_fee', 'token_pool', 'gateway_clearing'));

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('mercadopago', 'stripe', 'simulated')),
    external_id VARCHAR(128) NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    checkout_url TEXT,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ext_id ON payments(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key);
