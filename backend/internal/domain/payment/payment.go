// Package payment models deposit intents, external payment provider gateways,
// and idempotent processing for investor cuenta comitente funding.
package payment

import (
	"errors"
	"time"
)

type PaymentStatus string

const (
	StatusPending   PaymentStatus = "pending"
	StatusApproved  PaymentStatus = "approved"
	StatusRejected  PaymentStatus = "rejected"
	StatusCancelled PaymentStatus = "cancelled"
)

type GatewayProvider string

const (
	ProviderSimulated   GatewayProvider = "simulated"
	ProviderMercadoPago GatewayProvider = "mercadopago"
	ProviderStripe      GatewayProvider = "stripe"
)

var (
	ErrInvalidAmount       = errors.New("payment: amount must be strictly greater than zero")
	ErrUnsupportedProvider = errors.New("payment: unsupported gateway provider")
	ErrPaymentNotFound     = errors.New("payment: payment intent not found")
	ErrAlreadyProcessed    = errors.New("payment: payment has already been processed")
	ErrInvalidWebhook      = errors.New("payment: invalid webhook payload or signature")
)

// Payment represents a monetary deposit transaction initiated via an external or simulated gateway.
type Payment struct {
	ID             string          `json:"id"`
	UserID         string          `json:"userId"`
	Provider       GatewayProvider `json:"provider"`
	ExternalID     string          `json:"externalId"`
	AmountCents    int64           `json:"amountCents"`
	Currency       string          `json:"currency"`
	Status         PaymentStatus   `json:"status"`
	CheckoutURL    string          `json:"checkoutUrl,omitempty"`
	IdempotencyKey string          `json:"idempotencyKey,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

// New creates and validates a new Payment intent.
func New(id, userID string, provider GatewayProvider, amountCents int64, currency string, idempotencyKey string, now time.Time) (*Payment, error) {
	if amountCents <= 0 {
		return nil, ErrInvalidAmount
	}

	switch provider {
	case ProviderSimulated, ProviderMercadoPago, ProviderStripe:
	default:
		return nil, ErrUnsupportedProvider
	}

	if currency == "" {
		currency = "USD"
	}

	return &Payment{
		ID:             id,
		UserID:         userID,
		Provider:       provider,
		AmountCents:    amountCents,
		Currency:       currency,
		Status:         StatusPending,
		IdempotencyKey: idempotencyKey,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

// MarkApproved transitions the payment to approved state.
func (p *Payment) MarkApproved(now time.Time) error {
	if p.Status == StatusApproved {
		return ErrAlreadyProcessed
	}
	p.Status = StatusApproved
	p.UpdatedAt = now
	return nil
}

// MarkRejected transitions the payment to rejected state.
func (p *Payment) MarkRejected(now time.Time) error {
	if p.Status == StatusApproved {
		return ErrAlreadyProcessed
	}
	p.Status = StatusRejected
	p.UpdatedAt = now
	return nil
}
