package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	domain "github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

// SimulatedGateway provides a deterministic in-memory payment provider for testing, demo, and local dev.
type SimulatedGateway struct {
	mu       sync.RWMutex
	statuses map[string]domain.PaymentStatus
}

func NewSimulatedGateway() *SimulatedGateway {
	return &SimulatedGateway{
		statuses: make(map[string]domain.PaymentStatus),
	}
}

func (g *SimulatedGateway) Provider() domain.GatewayProvider {
	return domain.ProviderSimulated
}

func (g *SimulatedGateway) CreatePayment(ctx context.Context, input ports.GatewayPaymentInput) (*ports.GatewayPaymentOutput, error) {
	extID := fmt.Sprintf("sim_%s", input.PaymentID)

	g.mu.Lock()
	g.statuses[extID] = domain.StatusPending
	g.mu.Unlock()

	return &ports.GatewayPaymentOutput{
		ExternalID:  extID,
		CheckoutURL: fmt.Sprintf("https://sandbox.kreanova.local/checkout/%s", extID),
		Status:      domain.StatusPending,
	}, nil
}

func (g *SimulatedGateway) GetPaymentStatus(ctx context.Context, externalID string) (domain.PaymentStatus, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if st, ok := g.statuses[externalID]; ok {
		return st, nil
	}
	return domain.StatusPending, nil
}

func (g *SimulatedGateway) SetStatus(externalID string, status domain.PaymentStatus) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.statuses[externalID] = status
}

func (g *SimulatedGateway) ParseWebhook(ctx context.Context, headers map[string][]string, payload []byte) (*ports.WebhookResult, error) {
	var body struct {
		ExternalID string `json:"externalId"`
		Status     string `json:"status"`
	}
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, domain.ErrInvalidWebhook
	}
	st := domain.PaymentStatus(body.Status)
	if st == "" {
		st = domain.StatusApproved
	}
	return &ports.WebhookResult{
		ExternalID: body.ExternalID,
		Status:     st,
	}, nil
}
