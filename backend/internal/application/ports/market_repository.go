package ports

import (
	"context"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
)

// MarketRepository defines persistence operations for secondary market order book and executions.
type MarketRepository interface {
	SaveOrder(ctx context.Context, ord *market.Order) error
	FindOrderByID(ctx context.Context, id string) (*market.Order, error)
	ListOrders(ctx context.Context, projectID string, status market.OrderStatus, oType market.OrderType) ([]*market.Order, error)
	ListOrdersByUser(ctx context.Context, userID string) ([]*market.Order, error)
	SaveTrade(ctx context.Context, trade *market.Trade, buyOrder *market.Order, sellOrder *market.Order) error
	ListTradesByProject(ctx context.Context, projectID string) ([]*market.Trade, error)
	GetUserTokenBalance(ctx context.Context, userID, projectID string) (int64, error)
}
