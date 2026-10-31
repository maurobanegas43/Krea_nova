-- Migration 000003: Secondary Market Orders and Trades
CREATE TABLE IF NOT EXISTS secondary_market_orders (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('buy', 'sell')),
    token_count BIGINT NOT NULL CHECK (token_count > 0),
    price_per_token_cents BIGINT NOT NULL CHECK (price_per_token_cents > 0),
    filled_token_count BIGINT NOT NULL DEFAULT 0 CHECK (filled_token_count >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_filled', 'filled', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secondary_market_trades (
    id VARCHAR(64) PRIMARY KEY,
    buy_order_id VARCHAR(64) NOT NULL REFERENCES secondary_market_orders(id) ON DELETE RESTRICT,
    sell_order_id VARCHAR(64) NOT NULL REFERENCES secondary_market_orders(id) ON DELETE RESTRICT,
    token_count BIGINT NOT NULL CHECK (token_count > 0),
    price_per_token_cents BIGINT NOT NULL CHECK (price_per_token_cents > 0),
    total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents > 0),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_open_orders ON secondary_market_orders(project_id, status, price_per_token_cents);
CREATE INDEX IF NOT EXISTS idx_market_user_orders ON secondary_market_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_buy_order ON secondary_market_trades(buy_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_sell_order ON secondary_market_trades(sell_order_id);
