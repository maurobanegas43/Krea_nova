-- Migration 000007: Create trusted_devices table for secure device verification and token tracking
CREATE TABLE IF NOT EXISTS trusted_devices (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    device_token VARCHAR(255) NOT NULL,
    device_name VARCHAR(200) NOT NULL,
    fingerprint VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    trusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_device_id ON trusted_devices(device_id);
