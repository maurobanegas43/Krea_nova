package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
)

type MarketRepository struct {
	pool *pgxpool.Pool
}

func NewMarketRepository(pool *pgxpool.Pool) *MarketRepository {
	return &MarketRepository{pool: pool}
}

func (r *MarketRepository) SaveOrder(ctx context.Context, ord *market.Order) error {
	query := `
		INSERT INTO secondary_market_orders (
			id, project_id, user_id, order_type, token_count, price_per_token_cents, filled_token_count, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			filled_token_count = EXCLUDED.filled_token_count,
			status = EXCLUDED.status
	`
	_, err := r.pool.Exec(ctx, query,
		ord.ID, ord.ProjectID, ord.UserID, string(ord.OrderType),
		ord.TokenCount, ord.PricePerTokenCents, ord.FilledTokenCount,
		string(ord.Status), ord.CreatedAt,
	)
	return err
}

func (r *MarketRepository) FindOrderByID(ctx context.Context, id string) (*market.Order, error) {
	query := `
		SELECT id, project_id, user_id, order_type, token_count, price_per_token_cents, filled_token_count, status, created_at
		FROM secondary_market_orders
		WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)

	var ord market.Order
	var oType, status string
	err := row.Scan(
		&ord.ID, &ord.ProjectID, &ord.UserID, &oType,
		&ord.TokenCount, &ord.PricePerTokenCents, &ord.FilledTokenCount,
		&status, &ord.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, market.ErrOrderNotFound
		}
		return nil, err
	}
	ord.OrderType = market.OrderType(oType)
	ord.Status = market.OrderStatus(status)
	return &ord, nil
}

func (r *MarketRepository) ListOrders(ctx context.Context, projectID string, status market.OrderStatus, oType market.OrderType) ([]*market.Order, error) {
	query := `
		SELECT id, project_id, user_id, order_type, token_count, price_per_token_cents, filled_token_count, status, created_at
		FROM secondary_market_orders
		WHERE ($1 = '' OR project_id = $1)
		  AND ($2 = '' OR status = $2)
		  AND ($3 = '' OR order_type = $3)
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, projectID, string(status), string(oType))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*market.Order
	for rows.Next() {
		var ord market.Order
		var ot, st string
		if err := rows.Scan(
			&ord.ID, &ord.ProjectID, &ord.UserID, &ot,
			&ord.TokenCount, &ord.PricePerTokenCents, &ord.FilledTokenCount,
			&st, &ord.CreatedAt,
		); err != nil {
			return nil, err
		}
		ord.OrderType = market.OrderType(ot)
		ord.Status = market.OrderStatus(st)
		result = append(result, &ord)
	}
	return result, rows.Err()
}

func (r *MarketRepository) ListOrdersByUser(ctx context.Context, userID string) ([]*market.Order, error) {
	query := `
		SELECT id, project_id, user_id, order_type, token_count, price_per_token_cents, filled_token_count, status, created_at
		FROM secondary_market_orders
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*market.Order
	for rows.Next() {
		var ord market.Order
		var ot, st string
		if err := rows.Scan(
			&ord.ID, &ord.ProjectID, &ord.UserID, &ot,
			&ord.TokenCount, &ord.PricePerTokenCents, &ord.FilledTokenCount,
			&st, &ord.CreatedAt,
		); err != nil {
			return nil, err
		}
		ord.OrderType = market.OrderType(ot)
		ord.Status = market.OrderStatus(st)
		result = append(result, &ord)
	}
	return result, rows.Err()
}

func (r *MarketRepository) SaveTrade(ctx context.Context, trade *market.Trade, buyOrder *market.Order, sellOrder *market.Order) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Insert trade
	tradeQuery := `
		INSERT INTO secondary_market_trades (
			id, buy_order_id, sell_order_id, token_count, price_per_token_cents, total_amount_cents, executed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if _, err := tx.Exec(ctx, tradeQuery,
		trade.ID, trade.BuyOrderID, trade.SellOrderID,
		trade.TokenCount, trade.PricePerTokenCents, trade.TotalAmountCents, trade.ExecutedAt,
	); err != nil {
		return fmt.Errorf("failed to record trade: %w", err)
	}

	// 2. Update buy order
	updateBuy := `
		UPDATE secondary_market_orders
		SET filled_token_count = $1, status = $2
		WHERE id = $3
	`
	if _, err := tx.Exec(ctx, updateBuy, buyOrder.FilledTokenCount, string(buyOrder.Status), buyOrder.ID); err != nil {
		return fmt.Errorf("failed to update buy order: %w", err)
	}

	// 3. Update sell order
	updateSell := `
		UPDATE secondary_market_orders
		SET filled_token_count = $1, status = $2
		WHERE id = $3
	`
	if _, err := tx.Exec(ctx, updateSell, sellOrder.FilledTokenCount, string(sellOrder.Status), sellOrder.ID); err != nil {
		return fmt.Errorf("failed to update sell order: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *MarketRepository) ListTradesByProject(ctx context.Context, projectID string) ([]*market.Trade, error) {
	query := `
		SELECT t.id, t.buy_order_id, t.sell_order_id, t.token_count, t.price_per_token_cents, t.total_amount_cents, t.executed_at
		FROM secondary_market_trades t
		JOIN secondary_market_orders o ON t.buy_order_id = o.id
		WHERE o.project_id = $1
		ORDER BY t.executed_at DESC
	`
	rows, err := r.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*market.Trade
	for rows.Next() {
		var t market.Trade
		if err := rows.Scan(
			&t.ID, &t.BuyOrderID, &t.SellOrderID,
			&t.TokenCount, &t.PricePerTokenCents, &t.TotalAmountCents, &t.ExecutedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, &t)
	}
	return result, rows.Err()
}

func (r *MarketRepository) GetUserTokenBalance(ctx context.Context, userID, projectID string) (int64, error) {
	query := `
		SELECT
			COALESCE(SUM(CASE WHEN bo.user_id = $1 THEN t.token_count ELSE 0 END), 0) -
			COALESCE(SUM(CASE WHEN so.user_id = $1 THEN t.token_count ELSE 0 END), 0) AS balance
		FROM secondary_market_trades t
		JOIN secondary_market_orders bo ON t.buy_order_id = bo.id
		JOIN secondary_market_orders so ON t.sell_order_id = so.id
		WHERE bo.project_id = $2
	`
	row := r.pool.QueryRow(ctx, query, userID, projectID)
	var balance int64
	if err := row.Scan(&balance); err != nil {
		return 0, err
	}
	return balance, nil
}
