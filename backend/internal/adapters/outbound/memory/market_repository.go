package memory

import (
	"context"
	"sync"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
)

type MarketRepository struct {
	mu     sync.RWMutex
	orders map[string]*market.Order
	trades map[string]*market.Trade
}

func NewMarketRepository() *MarketRepository {
	return &MarketRepository{
		orders: make(map[string]*market.Order),
		trades: make(map[string]*market.Trade),
	}
}

func (r *MarketRepository) SaveOrder(ctx context.Context, ord *market.Order) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copied := *ord
	r.orders[ord.ID] = &copied
	return nil
}

func (r *MarketRepository) FindOrderByID(ctx context.Context, id string) (*market.Order, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ord, ok := r.orders[id]
	if !ok {
		return nil, market.ErrOrderNotFound
	}
	copied := *ord
	return &copied, nil
}

func (r *MarketRepository) ListOrders(ctx context.Context, projectID string, status market.OrderStatus, oType market.OrderType) ([]*market.Order, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*market.Order
	for _, ord := range r.orders {
		if projectID != "" && ord.ProjectID != projectID {
			continue
		}
		if status != "" && ord.Status != status {
			continue
		}
		if oType != "" && ord.OrderType != oType {
			continue
		}
		copied := *ord
		result = append(result, &copied)
	}
	return result, nil
}

func (r *MarketRepository) ListOrdersByUser(ctx context.Context, userID string) ([]*market.Order, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*market.Order
	for _, ord := range r.orders {
		if ord.UserID == userID {
			copied := *ord
			result = append(result, &copied)
		}
	}
	return result, nil
}

func (r *MarketRepository) SaveTrade(ctx context.Context, trade *market.Trade, buyOrder *market.Order, sellOrder *market.Order) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	tradeCopy := *trade
	r.trades[trade.ID] = &tradeCopy

	buyCopy := *buyOrder
	r.orders[buyOrder.ID] = &buyCopy

	sellCopy := *sellOrder
	r.orders[sellOrder.ID] = &sellCopy

	return nil
}

func (r *MarketRepository) ListTradesByProject(ctx context.Context, projectID string) ([]*market.Trade, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*market.Trade
	for _, t := range r.trades {
		buyOrd, ok := r.orders[t.BuyOrderID]
		if ok && buyOrd.ProjectID == projectID {
			tradeCopy := *t
			result = append(result, &tradeCopy)
		}
	}
	return result, nil
}

func (r *MarketRepository) GetUserTokenBalance(ctx context.Context, userID, projectID string) (int64, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var balance int64 = 0

	// Aggregate from executed trades
	for _, t := range r.trades {
		buyOrd, hasBuy := r.orders[t.BuyOrderID]
		sellOrd, hasSell := r.orders[t.SellOrderID]

		if hasBuy && buyOrd.ProjectID == projectID && buyOrd.UserID == userID {
			balance += t.TokenCount
		}
		if hasSell && sellOrd.ProjectID == projectID && sellOrd.UserID == userID {
			balance -= t.TokenCount
		}
	}

	return balance, nil
}
