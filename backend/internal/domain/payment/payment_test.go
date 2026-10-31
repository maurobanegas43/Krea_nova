package payment_test

import (
	"errors"
	"testing"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

func TestNewPayment_Validations(t *testing.T) {
	now := time.Now()

	// 1. Invalid amount <= 0
	_, err := payment.New("p-1", "user-1", payment.ProviderSimulated, 0, "USD", "", now)
	if !errors.Is(err, payment.ErrInvalidAmount) {
		t.Fatalf("expected ErrInvalidAmount, got: %v", err)
	}

	// 2. Unsupported provider
	_, err = payment.New("p-1", "user-1", payment.GatewayProvider("unknown_provider"), 1000, "USD", "", now)
	if !errors.Is(err, payment.ErrUnsupportedProvider) {
		t.Fatalf("expected ErrUnsupportedProvider, got: %v", err)
	}

	// 3. Valid payment intent creation
	p, err := payment.New("p-1", "user-1", payment.ProviderMercadoPago, 50000, "USD", "idem-123", now)
	if err != nil {
		t.Fatalf("unexpected error creating payment: %v", err)
	}
	if p.Status != payment.StatusPending {
		t.Fatalf("expected initial status pending, got: %s", p.Status)
	}

	// 4. Mark approved
	err = p.MarkApproved(now.Add(time.Minute))
	if err != nil {
		t.Fatalf("unexpected error marking approved: %v", err)
	}
	if p.Status != payment.StatusApproved {
		t.Fatalf("expected status approved, got: %s", p.Status)
	}

	// 5. Cannot mark approved or rejected again once approved
	err = p.MarkApproved(now.Add(2 * time.Minute))
	if !errors.Is(err, payment.ErrAlreadyProcessed) {
		t.Fatalf("expected ErrAlreadyProcessed when re-approving, got: %v", err)
	}
}
