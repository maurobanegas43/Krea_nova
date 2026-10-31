-- Migration 000003: Add portfolio, wallet, and fiduciary account columns and relations

-- 1. Extend projects with financial, token, and asset classification attributes
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Residencial & Micro-living',
ADD COLUMN IF NOT EXISTS token_symbol VARCHAR(20) NOT NULL DEFAULT 'TKN-01',
ADD COLUMN IF NOT EXISTS expected_apy NUMERIC(5, 2) NOT NULL DEFAULT 12.0,
ADD COLUMN IF NOT EXISTS min_investment BIGINT NOT NULL DEFAULT 50000,
ADD COLUMN IF NOT EXISTS duration_months INT NOT NULL DEFAULT 24,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Extend investments with token counting and price per token
ALTER TABLE investments 
ADD COLUMN IF NOT EXISTS token_count INT NOT NULL DEFAULT 1 CHECK (token_count > 0),
ADD COLUMN IF NOT EXISTS token_price_cents BIGINT NOT NULL DEFAULT 10000 CHECK (token_price_cents > 0);

-- 3. Extend ledger_entries with explicit audit description
ALTER TABLE ledger_entries 
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- 4. Create Fiduciary Custody Accounts table for bank rails and stablecoin vaults
CREATE TABLE IF NOT EXISTS fiduciary_bank_accounts (
    id VARCHAR(64) PRIMARY KEY,
    bank_name VARCHAR(120) NOT NULL,
    account_holder VARCHAR(200) NOT NULL,
    cuit VARCHAR(32) NOT NULL,
    account_type VARCHAR(64) NOT NULL,
    cbu VARCHAR(32) NOT NULL,
    alias VARCHAR(64) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    crypto_token VARCHAR(20) NOT NULL DEFAULT 'USDC',
    crypto_network VARCHAR(64) NOT NULL DEFAULT 'Ethereum Sepolia / Polygon PoS',
    crypto_vault_address VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed official fiduciary custody account
INSERT INTO fiduciary_bank_accounts (
    id, bank_name, account_holder, cuit, account_type, cbu, alias, currency, crypto_token, crypto_network, crypto_vault_address, is_active, created_at
) VALUES (
    'fid-acc-01',
    'Banco Industrial (BIND Fideicomisos)',
    'Krea Nova Capital Fideicomiso Financiero Inmobiliario I',
    '30-71889900-4',
    'Cuenta Especial Fiduciaria Ley 24.441 en USD',
    '0290000100000000123456',
    'KREANOVA.CUSTODIA.USD',
    'USD',
    'USDC',
    'Ethereum Sepolia / Polygon PoS',
    '0x71C6793A8B101E1794b15B8e48bE5a46E71182dA',
    TRUE,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Update seeded projects with accurate categories and token symbols
UPDATE projects SET 
    category = 'Corporativo & Renta LEED', 
    token_symbol = 'KN-01', 
    expected_apy = 11.5, 
    image_url = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80' 
WHERE id = 'proj-001';

UPDATE projects SET 
    category = 'Residencial Premium', 
    token_symbol = 'RLIB-02', 
    expected_apy = 10.8, 
    image_url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' 
WHERE id = 'proj-002';

UPDATE projects SET 
    category = 'Logística & Distribución', 
    token_symbol = 'PLOG-03', 
    expected_apy = 13.2, 
    image_url = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80' 
WHERE id = 'proj-003';

UPDATE projects SET 
    category = 'Micro-living & Alquiler Temporal', 
    token_symbol = 'CSPL-04', 
    expected_apy = 14.0, 
    image_url = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80' 
WHERE id = 'proj-004';

UPDATE projects SET 
    category = 'Hotelería & Eco-Resort', 
    token_symbol = 'SURA-05', 
    expected_apy = 12.5, 
    image_url = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80' 
WHERE id = 'proj-005';

UPDATE projects SET 
    category = 'Usos Mixtos Frente de Agua', 
    token_symbol = 'MKR-06', 
    expected_apy = 11.0, 
    image_url = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80' 
WHERE id = 'proj-006';
