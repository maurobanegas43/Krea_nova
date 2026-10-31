// Package market encapsulates domain rules for secondary market orders and trade executions.
package market

import (
	"errors"
	"time"
)

type OrderType string

const (
	OrderTypeBuy  OrderType = "buy"
	OrderTypeSell OrderType = "sell"
)

type OrderStatus string

const (
	StatusOpen            OrderStatus = "open"
	StatusPartiallyFilled OrderStatus = "partially_filled"
	StatusFilled          OrderStatus = "filled"
	StatusCancelled       OrderStatus = "cancelled"
)

var (
	ErrInvalidTokenCount = errors.New("market: token count must be strictly greater than zero")
	ErrInvalidPrice      = errors.New("market: price per token must be strictly greater than zero")
	ErrInvalidOrderType  = errors.New("market: invalid order type (must be 'buy' or 'sell')")
	ErrOrderNotFound     = errors.New("market: order not found")
	ErrOrderNotOpen      = errors.New("market: order is not open for trading")
	ErrOrderOverfilled   = errors.New("market: trade volume exceeds remaining open tokens")
	ErrSelfTrade         = errors.New("market: cannot match order against oneself")
	ErrInvalidTrade      = errors.New("market: incompatible orders for trade execution")
)

// Order represents a maker buy or sell limit order.
type Order struct {
	ID                 string      `json:"id"`
	ProjectID          string      `json:"projectId"`
	UserID             string      `json:"userId"`
	OrderType          OrderType   `json:"orderType"`
	TokenCount         int64       `json:"tokenCount"`
	PricePerTokenCents int64       `json:"pricePerTokenCents"`
	FilledTokenCount   int64       `json:"filledTokenCount"`
	Status             OrderStatus `json:"status"`
	CreatedAt          time.Time   `json:"createdAt"`
}

// RemainingTokens returns the unfilled tokens for the order.
func (o *Order) RemainingTokens() int64 {
	return o.TokenCount - o.FilledTokenCount
}

// CanExecuteWith validates whether another order can cross against this order.
func (o *Order) CanExecuteWith(other *Order) error {
	if o.Status != StatusOpen && o.Status != StatusPartiallyFilled {
		return ErrOrderNotOpen
	}
	if other.Status != StatusOpen && other.Status != StatusPartiallyFilled {
		return ErrOrderNotOpen
	}
	if o.ProjectID != other.ProjectID {
		return ErrInvalidTrade
	}
	if o.UserID == other.UserID {
		return ErrSelfTrade
	}
	if o.OrderType == other.OrderType {
		return ErrInvalidTrade
	}
	return nil
}

// ApplyFill records a matched volume and updates status accordingly.
func (o *Order) ApplyFill(count int64) error {
	if count <= 0 {
		return ErrInvalidTokenCount
	}
	if o.FilledTokenCount+count > o.TokenCount {
		return ErrOrderOverfilled
	}
	o.FilledTokenCount += count
	if o.FilledTokenCount == o.TokenCount {
		o.Status = StatusFilled
	} else {
		o.Status = StatusPartiallyFilled
	}
	return nil
}

// Cancel sets the status to cancelled if the order was not filled yet.
func (o *Order) Cancel() error {
	if o.Status == StatusFilled {
		return errors.New("market: cannot cancel an already filled order")
	}
	o.Status = StatusCancelled
	return nil
}

// NewOrder validates and creates an open order.
func NewOrder(id, projectID, userID string, oType OrderType, tokens, priceCents int64, now time.Time) (*Order, error) {
	if tokens <= 0 {
		return nil, ErrInvalidTokenCount
	}
	if priceCents <= 0 {
		return nil, ErrInvalidPrice
	}
	if oType != OrderTypeBuy && oType != OrderTypeSell {
		return nil, ErrInvalidOrderType
	}
	if projectID == "" || userID == "" {
		return nil, errors.New("market: project ID and user ID are required")
	}

	return &Order{
		ID:                 id,
		ProjectID:          projectID,
		UserID:             userID,
		OrderType:          oType,
		TokenCount:         tokens,
		PricePerTokenCents: priceCents,
		FilledTokenCount:   0,
		Status:             StatusOpen,
		CreatedAt:          now,
	}, nil
}

// Trade represents a matched atomic execution between a buy and sell order.
type Trade struct {
	ID                 string    `json:"id"`
	BuyOrderID         string    `json:"buyOrderId"`
	SellOrderID        string    `json:"sellOrderId"`
	TokenCount         int64     `json:"tokenCount"`
	PricePerTokenCents int64     `json:"pricePerTokenCents"`
	TotalAmountCents   int64     `json:"totalAmountCents"`
	ExecutedAt         time.Time `json:"executedAt"`
}

// NewTrade creates a valid executed trade record.
func NewTrade(id, buyOrderID, sellOrderID string, tokens, priceCents int64, now time.Time) (*Trade, error) {
	if tokens <= 0 {
		return nil, ErrInvalidTokenCount
	}
	if priceCents <= 0 {
		return nil, ErrInvalidPrice
	}
	return &Trade{
		ID:                 id,
		BuyOrderID:         buyOrderID,
		SellOrderID:        sellOrderID,
		TokenCount:         tokens,
		PricePerTokenCents: priceCents,
		TotalAmountCents:   tokens * priceCents,
		ExecutedAt:         now,
	}, nil
}
