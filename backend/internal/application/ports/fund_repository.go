package ports

import (
	"context"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
)

// FundRepository manages persistence for investment commitments and balanced ledger operations.
type FundRepository interface {
	SaveInvestment(ctx context.Context, inv *fund.Investment) error
	FindInvestmentByID(ctx context.Context, id string) (*fund.Investment, error)
	ListInvestmentsByProject(ctx context.Context, projectID string) ([]*fund.Investment, error)
	ListInvestmentsByInvestor(ctx context.Context, investorID string) ([]*fund.Investment, error)

	SaveLedgerAccount(ctx context.Context, acc *fund.LedgerAccount) error
	FindLedgerAccountByID(ctx context.Context, id string) (*fund.LedgerAccount, error)
	FindLedgerAccountByUser(ctx context.Context, userID string, accType fund.AccountType) (*fund.LedgerAccount, error)

	// RecordTransaction writes paired debit/credit entries atomically under ACID guarantees.
	RecordTransaction(ctx context.Context, entries []fund.LedgerEntry) error
	GetAccountBalance(ctx context.Context, accountID string) (int64, error)
	ListLedgerEntriesByAccount(ctx context.Context, accountID string) ([]fund.LedgerEntry, error)
	GetFiduciaryAccount(ctx context.Context) (*fund.FiduciaryAccount, error)
}
