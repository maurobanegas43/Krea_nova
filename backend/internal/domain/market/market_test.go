package market_test

import (
	"testing"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
)

func TestNewOrder_Validations(t *testing.T) {
	now := time.Now()

	// Zero tokens
	_, err := market.NewOrder("ord-1", "proj-1", "usr-1", market.OrderTypeBuy, 0, 100, now)
	if err != market.ErrInvalidTokenCount {
		t.Fatalf("expected ErrInvalidTokenCount, got %v", err)
	}

	// Zero price
	_, err = market.NewOrder("ord-1", "proj-1", "usr-1", market.OrderTypeBuy, 10, 0, now)
	if err != market.ErrInvalidPrice {
		t.Fatalf("expected ErrInvalidPrice, got %v", err)
	}

	// Invalid order type
	_, err = market.NewOrder("ord-1", "proj-1", "usr-1", "unknown", 10, 100, now)
	if err != market.ErrInvalidOrderType {
		t.Fatalf("expected ErrInvalidOrderType, got %v", err)
	}

	// Valid order
	ord, err := market.NewOrder("ord-1", "proj-1", "usr-1", market.OrderTypeBuy, 10, 100, now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ord.Status != market.StatusOpen || ord.RemainingTokens() != 10 {
		t.Fatalf("invalid initial state: %+v", ord)
	}
}

func TestOrder_ApplyFill(t *testing.T) {
	now := time.Now()
	ord, _ := market.NewOrder("ord-1", "proj-1", "usr-1", market.OrderTypeBuy, 10, 100, now)

	// Partial fill
	err := ord.ApplyFill(4)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ord.Status != market.StatusPartiallyFilled || ord.RemainingTokens() != 6 {
		t.Fatalf("expected 6 remaining and partially filled, got %d and %s", ord.RemainingTokens(), ord.Status)
	}

	// Overfill
	err = ord.ApplyFill(7)
	if err != market.ErrOrderOverfilled {
		t.Fatalf("expected ErrOrderOverfilled, got %v", err)
	}

	// Complete fill
	err = ord.ApplyFill(6)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ord.Status != market.StatusFilled || ord.RemainingTokens() != 0 {
		t.Fatalf("expected filled status and 0 remaining, got %s and %d", ord.Status, ord.RemainingTokens())
	}
}
