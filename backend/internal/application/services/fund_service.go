package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

var (
	ErrProjectNotInvestable = errors.New("fund: project is not published or open for investment")
)

type CreateInvestmentCommand struct {
	ProjectID       string
	InvestorID      string
	AmountCents     int64
	ValidateBalance bool
}

type FundService struct {
	fundRepo    ports.FundRepository
	projectRepo ports.ProjectRepository
	userRepo    ports.UserRepository
	ids         ports.IDGenerator
	clock       ports.Clock
}

func NewFundService(
	fundRepo ports.FundRepository,
	projectRepo ports.ProjectRepository,
	userRepo ports.UserRepository,
	ids ports.IDGenerator,
	clock ports.Clock,
) *FundService {
	return &FundService{
		fundRepo:    fundRepo,
		projectRepo: projectRepo,
		userRepo:    userRepo,
		ids:         ids,
		clock:       clock,
	}
}

// InvestInProject executes an investment with regulatory validation and double-entry ledger bookkeeping.
func (s *FundService) InvestInProject(ctx context.Context, cmd CreateInvestmentCommand) (*fund.Investment, error) {
	// 1. Regulatory rule: KYC must be verified before any capital allocation
	investorProfile, err := s.userRepo.FindInvestorProfileByUserID(ctx, cmd.InvestorID)
	if err != nil || investorProfile == nil || investorProfile.KYCStatus != user.KYCVerified {
		return nil, user.ErrKYCNotVerified
	}

	// 2. Validate project state
	proj, err := s.projectRepo.FindByID(ctx, cmd.ProjectID)
	if err != nil || proj == nil {
		return nil, project.ErrNotFound
	}
	if proj.Status != project.StatusPublished && proj.Status != project.StatusApproved {
		return nil, ErrProjectNotInvestable
	}

	now := s.clock.Now()
	invID := s.ids.NewID()
	inv, err := fund.NewInvestment(invID, cmd.ProjectID, cmd.InvestorID, cmd.AmountCents, now)
	if err != nil {
		return nil, err
	}

	// 3. Resolve or initialize ledger accounts
	investorAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, cmd.InvestorID, fund.AccountInvestor)
	if err != nil || investorAcc == nil {
		investorAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &cmd.InvestorID,
			AccountType: fund.AccountInvestor,
			Currency:    "USD",
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, investorAcc); err != nil {
			return nil, err
		}
	}

	// Optional strict balance validation for cuenta comitente asset purchases
	if cmd.ValidateBalance {
		bal, err := s.fundRepo.GetAccountBalance(ctx, investorAcc.ID)
		if err != nil {
			return nil, err
		}
		if bal < cmd.AmountCents {
			return nil, fund.ErrInsufficientBalance
		}
	}

	escrowAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, cmd.ProjectID, fund.AccountFiatEscrow)
	if err != nil || escrowAcc == nil {
		escrowAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &cmd.ProjectID,
			AccountType: fund.AccountFiatEscrow,
			Currency:    "USD",
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, escrowAcc); err != nil {
			return nil, err
		}
	}

	// 4. Generate balanced double-entry transaction (Zero-Sum Rule)
	txGroupID := s.ids.NewID()
	desc := fmt.Sprintf("Suscripción de cuotapartes · %s", proj.Name)
	entries := []fund.LedgerEntry{
		{
			ID:                 s.ids.NewID(),
			AccountID:          investorAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryDebit,
			AmountCents:        cmd.AmountCents,
			ReferenceType:      "investment",
			ReferenceID:        invID,
			Description:        desc,
			CreatedAt:          now,
		},
		{
			ID:                 s.ids.NewID(),
			AccountID:          escrowAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryCredit,
			AmountCents:        cmd.AmountCents,
			ReferenceType:      "investment",
			ReferenceID:        invID,
			Description:        desc,
			CreatedAt:          now,
		},
	}

	if err := fund.ValidateTransactionPair(entries); err != nil {
		return nil, err
	}

	// 5. Persist investment and transaction in atomic storage
	if err := s.fundRepo.SaveInvestment(ctx, inv); err != nil {
		return nil, err
	}

	if err := s.fundRepo.RecordTransaction(ctx, entries); err != nil {
		return nil, err
	}

	// 6. Update project raised funds
	proj.FundsRaised += project.Money(cmd.AmountCents)
	_ = s.projectRepo.Save(ctx, proj)

	return inv, nil
}

// DepositFunds registers a cash deposit into the investor's virtual wallet.
func (s *FundService) DepositFunds(ctx context.Context, investorID string, amountCents int64, method string) (int64, error) {
	if amountCents <= 0 {
		return 0, fund.ErrInvalidAmount
	}
	investorProfile, err := s.userRepo.FindInvestorProfileByUserID(ctx, investorID)
	if err != nil || investorProfile == nil || investorProfile.KYCStatus != user.KYCVerified {
		return 0, user.ErrKYCNotVerified
	}

	now := s.clock.Now()
	investorAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, investorID, fund.AccountInvestor)
	if err != nil || investorAcc == nil {
		investorAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &investorID,
			AccountType: fund.AccountInvestor,
			Currency:    "USD",
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, investorAcc); err != nil {
			return 0, err
		}
	}

	sysEscrowID := "sys-fiat-escrow"
	escrowAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, sysEscrowID, fund.AccountFiatEscrow)
	if err != nil || escrowAcc == nil {
		escrowAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &sysEscrowID,
			AccountType: fund.AccountFiatEscrow,
			Currency:    "USD",
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, escrowAcc); err != nil {
			return 0, err
		}
	}

	txGroupID := s.ids.NewID()
	depID := s.ids.NewID()
	if method == "" {
		method = "Transferencia Bancaria"
	}
	desc := fmt.Sprintf("Acreditación de fondos fiduciarios (%s)", method)
	entries := []fund.LedgerEntry{
		{
			ID:                 s.ids.NewID(),
			AccountID:          investorAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryCredit,
			AmountCents:        amountCents,
			ReferenceType:      "deposit",
			ReferenceID:        depID,
			Description:        desc,
			CreatedAt:          now,
		},
		{
			ID:                 s.ids.NewID(),
			AccountID:          escrowAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryDebit,
			AmountCents:        amountCents,
			ReferenceType:      "deposit",
			ReferenceID:        depID,
			Description:        desc,
			CreatedAt:          now,
		},
	}

	if err := fund.ValidateTransactionPair(entries); err != nil {
		return 0, err
	}
	if err := s.fundRepo.RecordTransaction(ctx, entries); err != nil {
		return 0, err
	}

	return s.fundRepo.GetAccountBalance(ctx, investorAcc.ID)
}

// WithdrawFunds processes an extraction from the investor's balance.
func (s *FundService) WithdrawFunds(ctx context.Context, investorID string, amountCents int64, destination string) (int64, error) {
	if amountCents <= 0 {
		return 0, fund.ErrInvalidAmount
	}
	investorAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, investorID, fund.AccountInvestor)
	if err != nil || investorAcc == nil {
		return 0, fund.ErrInsufficientBalance
	}
	balance, err := s.fundRepo.GetAccountBalance(ctx, investorAcc.ID)
	if err != nil || balance < amountCents {
		return 0, fund.ErrInsufficientBalance
	}

	now := s.clock.Now()
	sysEscrowID := "sys-fiat-escrow"
	escrowAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, sysEscrowID, fund.AccountFiatEscrow)
	if err != nil || escrowAcc == nil {
		escrowAcc = &fund.LedgerAccount{
			ID:          s.ids.NewID(),
			UserID:      &sysEscrowID,
			AccountType: fund.AccountFiatEscrow,
			Currency:    "USD",
			IsActive:    true,
			CreatedAt:   now,
		}
		if err := s.fundRepo.SaveLedgerAccount(ctx, escrowAcc); err != nil {
			return 0, err
		}
	}

	txGroupID := s.ids.NewID()
	wthID := s.ids.NewID()
	if destination == "" {
		destination = "Cuenta Bancaria Registrada"
	}
	desc := fmt.Sprintf("Extracción fiduciaria hacia %s", destination)
	entries := []fund.LedgerEntry{
		{
			ID:                 s.ids.NewID(),
			AccountID:          investorAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryDebit,
			AmountCents:        amountCents,
			ReferenceType:      "withdrawal",
			ReferenceID:        wthID,
			Description:        desc,
			CreatedAt:          now,
		},
		{
			ID:                 s.ids.NewID(),
			AccountID:          escrowAcc.ID,
			TransactionGroupID: txGroupID,
			EntryType:          fund.EntryCredit,
			AmountCents:        amountCents,
			ReferenceType:      "withdrawal",
			ReferenceID:        wthID,
			Description:        desc,
			CreatedAt:          now,
		},
	}

	if err := fund.ValidateTransactionPair(entries); err != nil {
		return 0, err
	}
	if err := s.fundRepo.RecordTransaction(ctx, entries); err != nil {
		return 0, err
	}

	return s.fundRepo.GetAccountBalance(ctx, investorAcc.ID)
}

func (s *FundService) ListInvestorLedger(ctx context.Context, investorID string) ([]fund.LedgerEntry, error) {
	investorAcc, err := s.fundRepo.FindLedgerAccountByUser(ctx, investorID, fund.AccountInvestor)
	if err != nil || investorAcc == nil {
		return []fund.LedgerEntry{}, nil
	}
	return s.fundRepo.ListLedgerEntriesByAccount(ctx, investorAcc.ID)
}

func (s *FundService) GetFiduciaryAccount(ctx context.Context) (*fund.FiduciaryAccount, error) {
	return s.fundRepo.GetFiduciaryAccount(ctx)
}

func (s *FundService) GetInvestment(ctx context.Context, id string) (*fund.Investment, error) {
	return s.fundRepo.FindInvestmentByID(ctx, id)
}

func (s *FundService) GetAccountBalance(ctx context.Context, accountID string) (int64, error) {
	return s.fundRepo.GetAccountBalance(ctx, accountID)
}

func (s *FundService) GetInvestorBalance(ctx context.Context, userID string) (int64, error) {
	acc, err := s.fundRepo.FindLedgerAccountByUser(ctx, userID, fund.AccountInvestor)
	if err != nil || acc == nil {
		return 0, nil
	}
	return s.fundRepo.GetAccountBalance(ctx, acc.ID)
}

func (s *FundService) ListInvestmentsByInvestor(ctx context.Context, investorID string) ([]*fund.Investment, error) {
	return s.fundRepo.ListInvestmentsByInvestor(ctx, investorID)
}
