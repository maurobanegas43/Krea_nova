package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	domain "github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

type PaymentRepository struct {
	pool *pgxpool.Pool
}

func NewPaymentRepository(pool *pgxpool.Pool) *PaymentRepository {
	return &PaymentRepository{pool: pool}
}

func (r *PaymentRepository) Save(ctx context.Context, p *domain.Payment) error {
	query := `
		INSERT INTO payments (
			id, user_id, provider, external_id, amount_cents, currency, status, checkout_url, idempotency_key, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status,
			external_id = EXCLUDED.external_id,
			checkout_url = EXCLUDED.checkout_url,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.pool.Exec(ctx, query,
		p.ID, p.UserID, string(p.Provider), p.ExternalID, p.AmountCents, p.Currency,
		string(p.Status), p.CheckoutURL, p.IdempotencyKey, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *PaymentRepository) FindByID(ctx context.Context, id string) (*domain.Payment, error) {
	query := `
		SELECT id, user_id, provider, external_id, amount_cents, currency, status, checkout_url, idempotency_key, created_at, updated_at
		FROM payments
		WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)

	var (
		p        domain.Payment
		provider string
		status   string
	)
	err := row.Scan(
		&p.ID, &p.UserID, &provider, &p.ExternalID, &p.AmountCents, &p.Currency,
		&status, &p.CheckoutURL, &p.IdempotencyKey, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	p.Provider = domain.GatewayProvider(provider)
	p.Status = domain.PaymentStatus(status)
	return &p, nil
}

func (r *PaymentRepository) FindByExternalID(ctx context.Context, provider domain.GatewayProvider, externalID string) (*domain.Payment, error) {
	query := `
		SELECT id, user_id, provider, external_id, amount_cents, currency, status, checkout_url, idempotency_key, created_at, updated_at
		FROM payments
		WHERE provider = $1 AND external_id = $2
	`
	row := r.pool.QueryRow(ctx, query, string(provider), externalID)

	var (
		p        domain.Payment
		provStr  string
		status   string
	)
	err := row.Scan(
		&p.ID, &p.UserID, &provStr, &p.ExternalID, &p.AmountCents, &p.Currency,
		&status, &p.CheckoutURL, &p.IdempotencyKey, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	p.Provider = domain.GatewayProvider(provStr)
	p.Status = domain.PaymentStatus(status)
	return &p, nil
}

func (r *PaymentRepository) FindByIdempotencyKey(ctx context.Context, key string) (*domain.Payment, error) {
	if key == "" {
		return nil, nil
	}
	query := `
		SELECT id, user_id, provider, external_id, amount_cents, currency, status, checkout_url, idempotency_key, created_at, updated_at
		FROM payments
		WHERE idempotency_key = $1
	`
	row := r.pool.QueryRow(ctx, query, key)

	var (
		p        domain.Payment
		provider string
		status   string
	)
	err := row.Scan(
		&p.ID, &p.UserID, &provider, &p.ExternalID, &p.AmountCents, &p.Currency,
		&status, &p.CheckoutURL, &p.IdempotencyKey, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	p.Provider = domain.GatewayProvider(provider)
	p.Status = domain.PaymentStatus(status)
	return &p, nil
}

func (r *PaymentRepository) ListByUserID(ctx context.Context, userID string) ([]*domain.Payment, error) {
	query := `
		SELECT id, user_id, provider, external_id, amount_cents, currency, status, checkout_url, idempotency_key, created_at, updated_at
		FROM payments
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*domain.Payment
	for rows.Next() {
		var (
			p        domain.Payment
			provider string
			status   string
		)
		err := rows.Scan(
			&p.ID, &p.UserID, &provider, &p.ExternalID, &p.AmountCents, &p.Currency,
			&status, &p.CheckoutURL, &p.IdempotencyKey, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		p.Provider = domain.GatewayProvider(provider)
		p.Status = domain.PaymentStatus(status)
		result = append(result, &p)
	}
	return result, rows.Err()
}
