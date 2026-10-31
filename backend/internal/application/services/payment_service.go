package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

var (
	ErrGatewayNotFound = errors.New("payment: gateway provider not registered")
)

type CreateDepositCommand struct {
	UserID         string
	AmountCents    int64
	Currency       string
	Provider       payment.GatewayProvider
	IdempotencyKey string
	Description    string
	RedirectURL    string
}

type PaymentService struct {
	paymentRepo ports.PaymentRepository
	fundRepo    ports.FundRepository
	userRepo    ports.UserRepository
	gateways    map[payment.GatewayProvider]ports.PaymentGateway
	ids         ports.IDGenerator
	clock       ports.Clock
}

func NewPaymentService(
	paymentRepo ports.PaymentRepository,
	fundRepo ports.FundRepository,
	userRepo ports.UserRepository,
	ids ports.IDGenerator,
	clock ports.Clock,
) *PaymentService {
	return &PaymentService{
		paymentRepo: paymentRepo,
		fundRepo:    fundRepo,
		userRepo:    userRepo,
		gateways:    make(map[payment.GatewayProvider]ports.PaymentGateway),
		ids:         ids,
		clock:       clock,
	}
}

// RegisterGateway adds or replaces a payment gateway implementation.
func (s *PaymentService) RegisterGateway(gateway ports.PaymentGateway) {
	s.gateways[gateway.Provider()] = gateway
}

// CreateDeposit registers a deposit intent and delegates checkout link generation to the selected payment gateway.
func (s *PaymentService) CreateDeposit(ctx context.Context, cmd CreateDepositCommand) (*payment.Payment, error) {
	if cmd.IdempotencyKey != "" {
		existing, err := s.paymentRepo.FindByIdempotencyKey(ctx, cmd.IdempotencyKey)
		if err == nil && existing != nil {
			return existing, nil
		}
	}

	u, err := s.userRepo.FindUserByID(ctx, cmd.UserID)
	if err != nil || u == nil {
		return nil, ErrUserNotFound
	}

	// Gateway resolution
	gw, ok := s.gateways[cmd.Provider]
	if !ok {
		return nil, ErrGatewayNotFound
	}

	now := s.clock.Now()
	paymentID := s.ids.NewID()

	p, err := payment.New(paymentID, cmd.UserID, cmd.Provider, cmd.AmountCents, cmd.Currency, cmd.IdempotencyKey, now)
	if err != nil {
		return nil, err
	}

	desc := cmd.Description
	if desc == "" {
		desc = fmt.Sprintf("Depósito en Cuenta Comitente - %s", u.Email)
	}

	gwOutput, err := gw.CreatePayment(ctx, ports.GatewayPaymentInput{
		PaymentID:   paymentID,
		UserID:      cmd.UserID,
		UserEmail:   u.Email,
		AmountCents: cmd.AmountCents,
		Currency:    p.Currency,
		Description: desc,
		RedirectURL: cmd.RedirectURL,
	})
	if err != nil {
		return nil, fmt.Errorf("payment gateway error: %w", err)
	}

	p.ExternalID = gwOutput.ExternalID
	p.CheckoutURL = gwOutput.CheckoutURL

	if err := s.paymentRepo.Save(ctx, p); err != nil {
		return nil, err
	}

	return p, nil
}

// ConfirmDeposit handles state transition to approved and writes balanced double-entry ledger entries.
func (s *PaymentService) ConfirmDeposit(ctx context.Context, paymentID string) (*payment.Payment, error) {
	p, err := s.paymentRepo.FindByID(ctx, paymentID)
	if err != nil || p == nil {
		return nil, payment.ErrPaymentNotFound
	}

	if p.Status == payment.StatusApproved {
		return p, nil // Idempotent no-op
	}

	now := s.clock.Now()
	if err := p.MarkApproved(now); err != nil {
		return nil, err
	}

	// 1. Resolve or initialize investor's cuenta comitente ledger account
	investorAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, p.UserID, fund.AccountInvestor)
	if err != nil || investorAcc == nil {
		investorAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &p.UserID,
			AccountType: fund.AccountInvestor,
			Currency:    p.Currency,
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, investorAcc); err != nil {
			return nil, err
		}
	}

	// 2. Resolve or initialize system gateway clearing account
	systemGatewayKey := "system_gateway_clearing"
	clearingAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, systemGatewayKey, fund.AccountGatewayClearing)
	if err != nil || clearingAcc == nil {
		clearingAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &systemGatewayKey,
			AccountType: fund.AccountGatewayClearing,
			Currency:    p.Currency,
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, clearingAcc); err != nil {
			return nil, err
		}
	}

	// 3. Generate double-entry transaction pair (Zero-Sum Rule)
	// Gateway clearing is debited, Investor wallet is credited with deposit balance.
	txGroupID := s.ids.NewID()
	entries := []fund.LedgerEntry{
		{
			ID:                 s.ids.NewID(),
			AccountID:          clearingAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryDebit,
			AmountCents:        p.AmountCents,
			ReferenceType:      "deposit",
			ReferenceID:        p.ID,
			CreatedAt:          now,
		},
		{
			ID:                 s.ids.NewID(),
			AccountID:          investorAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryCredit,
			AmountCents:        p.AmountCents,
			ReferenceType:      "deposit",
			ReferenceID:        p.ID,
			CreatedAt:          now,
		},
	}

	if err := fund.ValidateTransactionPair(entries); err != nil {
		return nil, err
	}

	// 4. Record ledger transaction atomically
	if err := s.fundRepo.RecordTransaction(ctx, entries); err != nil {
		return nil, err
	}

	// 5. Persist approved status
	if err := s.paymentRepo.Save(ctx, p); err != nil {
		return nil, err
	}

	return p, nil
}

// ProcessWebhook receives webhook notifications from a provider and synchronizes payment state.
func (s *PaymentService) ProcessWebhook(ctx context.Context, provider payment.GatewayProvider, headers map[string][]string, payload []byte) error {
	gw, ok := s.gateways[provider]
	if !ok {
		return ErrGatewayNotFound
	}

	res, err := gw.ParseWebhook(ctx, headers, payload)
	if err != nil {
		return err
	}
	if res == nil || res.ExternalID == "" {
		return nil
	}

	p, err := s.paymentRepo.FindByExternalID(ctx, provider, res.ExternalID)
	if err != nil || p == nil {
		return payment.ErrPaymentNotFound
	}

	if res.Status == payment.StatusApproved {
		_, err = s.ConfirmDeposit(ctx, p.ID)
		return err
	} else if res.Status == payment.StatusRejected || res.Status == payment.StatusCancelled {
		now := s.clock.Now()
		_ = p.MarkRejected(now)
		return s.paymentRepo.Save(ctx, p)
	}

	return nil
}

func (s *PaymentService) GetPayment(ctx context.Context, id string) (*payment.Payment, error) {
	return s.paymentRepo.FindByID(ctx, id)
}

func (s *PaymentService) ListUserPayments(ctx context.Context, userID string) ([]*payment.Payment, error) {
	return s.paymentRepo.ListByUserID(ctx, userID)
}
