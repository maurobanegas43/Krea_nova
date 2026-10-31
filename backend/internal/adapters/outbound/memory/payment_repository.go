package memory

import (
	"context"
	"sync"

	domain "github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

type PaymentRepository struct {
	mu       sync.RWMutex
	payments map[string]*domain.Payment
}

func NewPaymentRepository() *PaymentRepository {
	return &PaymentRepository{
		payments: make(map[string]*domain.Payment),
	}
}

func (r *PaymentRepository) Save(ctx context.Context, p *domain.Payment) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cp := *p
	r.payments[p.ID] = &cp
	return nil
}

func (r *PaymentRepository) FindByID(ctx context.Context, id string) (*domain.Payment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.payments[id]
	if !ok {
		return nil, nil
	}
	cp := *p
	return &cp, nil
}

func (r *PaymentRepository) FindByExternalID(ctx context.Context, provider domain.GatewayProvider, externalID string) (*domain.Payment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, p := range r.payments {
		if p.Provider == provider && p.ExternalID == externalID {
			cp := *p
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *PaymentRepository) FindByIdempotencyKey(ctx context.Context, key string) (*domain.Payment, error) {
	if key == "" {
		return nil, nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, p := range r.payments {
		if p.IdempotencyKey == key {
			cp := *p
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *PaymentRepository) ListByUserID(ctx context.Context, userID string) ([]*domain.Payment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var res []*domain.Payment
	for _, p := range r.payments {
		if p.UserID == userID {
			cp := *p
			res = append(res, &cp)
		}
	}
	return res, nil
}
