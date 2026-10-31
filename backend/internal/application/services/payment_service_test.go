package services_test

import (
	"context"
	"errors"
	"testing"

	"github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/memory"
	outboundPay "github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/payment"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

func TestPaymentService_DepositFlowAndDoubleEntry(t *testing.T) {
	ctx := context.Background()

	paymentRepo := memory.NewPaymentRepository()
	fundRepo := memory.NewFundRepository()
	userRepo := memory.NewUserRepository()
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	svc := services.NewPaymentService(paymentRepo, fundRepo, userRepo, idGen, clock)
	simGw := outboundPay.NewSimulatedGateway()
	svc.RegisterGateway(simGw)

	// Setup user
	userID := "user-investor-test"
	_ = userRepo.SaveUser(ctx, &user.User{
		ID:       userID,
		Email:    "test@kreanova.com",
		Role:     user.RoleInvestor,
		IsActive: true,
	})

	// 1. Create deposit intent
	p, err := svc.CreateDeposit(ctx, services.CreateDepositCommand{
		UserID:      userID,
		AmountCents: 5000000, // $50,000.00
		Currency:    "USD",
		Provider:    payment.ProviderSimulated,
	})
	if err != nil {
		t.Fatalf("unexpected error creating deposit: %v", err)
	}

	if p.Status != payment.StatusPending {
		t.Fatalf("expected status pending, got: %s", p.Status)
	}
	if p.AmountCents != 5000000 {
		t.Fatalf("expected amount 5000000, got: %d", p.AmountCents)
	}
	if p.CheckoutURL == "" {
		t.Fatalf("expected non-empty checkout url")
	}

	// 2. Confirm deposit
	confirmed, err := svc.ConfirmDeposit(ctx, p.ID)
	if err != nil {
		t.Fatalf("unexpected error confirming deposit: %v", err)
	}
	if confirmed.Status != payment.StatusApproved {
		t.Fatalf("expected status approved, got: %s", confirmed.Status)
	}

	// 3. Verify investor cuenta comitente balance has been credited with 5000000
	investorAcc, err := fundRepo.FindLedgerAccountByUser(ctx, userID, fund.AccountInvestor)
	if err != nil || investorAcc == nil {
		t.Fatalf("investor account comitente not created")
	}

	bal, err := fundRepo.GetAccountBalance(ctx, investorAcc.ID)
	if err != nil {
		t.Fatalf("failed to get account balance: %v", err)
	}
	if bal != 5000000 {
		t.Errorf("expected balance to be 5000000, got: %d", bal)
	}

	// 4. Verify system clearing account was debited
	systemKey := "system_gateway_clearing"
	clearingAcc, err := fundRepo.FindLedgerAccountByUser(ctx, systemKey, fund.AccountGatewayClearing)
	if err != nil || clearingAcc == nil {
		t.Fatalf("clearing account not created")
	}
	clearingBal, err := fundRepo.GetAccountBalance(ctx, clearingAcc.ID)
	if err != nil {
		t.Fatalf("failed to get clearing balance: %v", err)
	}
	if clearingBal != -5000000 {
		t.Errorf("expected clearing balance to be -5000000, got: %d", clearingBal)
	}

	// Zero sum equilibrium
	if bal+clearingBal != 0 {
		t.Errorf("expected zero sum, got %d", bal+clearingBal)
	}

	// 5. Idempotent re-confirmation
	reConfirmed, err := svc.ConfirmDeposit(ctx, p.ID)
	if err != nil {
		t.Fatalf("expected re-confirmation to succeed idempotently, got: %v", err)
	}
	if reConfirmed.Status != payment.StatusApproved {
		t.Fatalf("expected status approved, got %s", reConfirmed.Status)
	}
	// Balance should still be 5000000 (not duplicated)
	balAfter, _ := fundRepo.GetAccountBalance(ctx, investorAcc.ID)
	if balAfter != 5000000 {
		t.Fatalf("expected balance to stay 5000000, got %d", balAfter)
	}
}

func TestPaymentService_UnknownUserOrGateway(t *testing.T) {
	ctx := context.Background()
	svc := services.NewPaymentService(
		memory.NewPaymentRepository(),
		memory.NewFundRepository(),
		memory.NewUserRepository(),
		memory.RandomID{},
		memory.SystemClock{},
	)

	// User not found
	_, err := svc.CreateDeposit(ctx, services.CreateDepositCommand{
		UserID:      "ghost-user",
		AmountCents: 1000,
		Provider:    payment.ProviderSimulated,
	})
	if !errors.Is(err, services.ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got: %v", err)
	}
}
