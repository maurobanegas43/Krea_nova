package ports

import (
	"context"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

// GatewayPaymentInput contains parameters required by an external payment processor.
type GatewayPaymentInput struct {
	PaymentID   string
	UserID      string
	UserEmail   string
	AmountCents int64
	Currency    string
	Description string
	RedirectURL string
}

// GatewayPaymentOutput holds the outcome of creating an intent with a payment gateway.
type GatewayPaymentOutput struct {
	ExternalID  string
	CheckoutURL string
	Status      payment.PaymentStatus
}

// WebhookResult represents the normalized result of a verified gateway webhook event.
type WebhookResult struct {
	ExternalID string
	Status     payment.PaymentStatus
}

// PaymentGateway abstracts external payment providers (MercadoPago, Stripe, Simulated).
type PaymentGateway interface {
	Provider() payment.GatewayProvider
	CreatePayment(ctx context.Context, input GatewayPaymentInput) (*GatewayPaymentOutput, error)
	GetPaymentStatus(ctx context.Context, externalID string) (payment.PaymentStatus, error)
	ParseWebhook(ctx context.Context, headers map[string][]string, payload []byte) (*WebhookResult, error)
}

// PaymentRepository manages persistence and query operations for payment intents.
type PaymentRepository interface {
	Save(ctx context.Context, p *payment.Payment) error
	FindByID(ctx context.Context, id string) (*payment.Payment, error)
	FindByExternalID(ctx context.Context, provider payment.GatewayProvider, externalID string) (*payment.Payment, error)
	FindByIdempotencyKey(ctx context.Context, key string) (*payment.Payment, error)
	ListByUserID(ctx context.Context, userID string) ([]*payment.Payment, error)
}
