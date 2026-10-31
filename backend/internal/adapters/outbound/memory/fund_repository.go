package memory

import (
	"context"
	"sync"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
)

type FundRepository struct {
	mu          sync.RWMutex
	investments map[string]*fund.Investment
	accounts    map[string]*fund.LedgerAccount
	entries     []fund.LedgerEntry
}

func NewFundRepository() *FundRepository {
	return &FundRepository{
		investments: make(map[string]*fund.Investment),
		accounts:    make(map[string]*fund.LedgerAccount),
		entries:     make([]fund.LedgerEntry, 0),
	}
}

func (r *FundRepository) SaveInvestment(_ context.Context, inv *fund.Investment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *inv
	r.investments[inv.ID] = &cp
	return nil
}

func (r *FundRepository) FindInvestmentByID(_ context.Context, id string) (*fund.Investment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	inv, ok := r.investments[id]
	if !ok {
		return nil, nil
	}
	cp := *inv
	return &cp, nil
}

func (r *FundRepository) ListInvestmentsByProject(_ context.Context, projectID string) ([]*fund.Investment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*fund.Investment
	for _, inv := range r.investments {
		if inv.ProjectID == projectID {
			cp := *inv
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (r *FundRepository) ListInvestmentsByInvestor(_ context.Context, investorID string) ([]*fund.Investment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*fund.Investment
	for _, inv := range r.investments {
		if inv.InvestorID == investorID {
			cp := *inv
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (r *FundRepository) SaveLedgerAccount(_ context.Context, acc *fund.LedgerAccount) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *acc
	r.accounts[acc.ID] = &cp
	return nil
}

func (r *FundRepository) FindLedgerAccountByID(_ context.Context, id string) (*fund.LedgerAccount, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	acc, ok := r.accounts[id]
	if !ok {
		return nil, nil
	}
	cp := *acc
	return &cp, nil
}

func (r *FundRepository) FindLedgerAccountByUser(_ context.Context, userID string, accType fund.AccountType) (*fund.LedgerAccount, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, acc := range r.accounts {
		if acc.UserID != nil && *acc.UserID == userID && acc.AccountType == accType {
			cp := *acc
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *FundRepository) RecordTransaction(_ context.Context, entries []fund.LedgerEntry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, entry := range entries {
		r.entries = append(r.entries, entry)
	}
	return nil
}

func (r *FundRepository) GetAccountBalance(_ context.Context, accountID string) (int64, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var balance int64
	for _, entry := range r.entries {
		if entry.AccountID == accountID {
			if entry.EntryType == fund.EntryCredit {
				balance += entry.AmountCents
			} else if entry.EntryType == fund.EntryDebit {
				balance -= entry.AmountCents
			}
		}
	}
	return balance, nil
}

func (r *FundRepository) ListLedgerEntriesByAccount(_ context.Context, accountID string) ([]fund.LedgerEntry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []fund.LedgerEntry
	for i := len(r.entries) - 1; i >= 0; i-- {
		if r.entries[i].AccountID == accountID {
			out = append(out, r.entries[i])
		}
	}
	return out, nil
}

func (r *FundRepository) GetFiduciaryAccount(_ context.Context) (*fund.FiduciaryAccount, error) {
	return &fund.FiduciaryAccount{
		ID:                 "fid-acc-01",
		BankName:           "Banco Industrial (BIND Fideicomisos)",
		AccountHolder:      "Krea Nova Capital Fideicomiso Financiero Inmobiliario I",
		CUIT:               "30-71889900-4",
		AccountType:        "Cuenta Especial Fiduciaria Ley 24.441 en USD",
		CBU:                "0290000100000000123456",
		Alias:              "KREANOVA.CUSTODIA.USD",
		Currency:           "USD",
		CryptoToken:        "USDC",
		CryptoNetwork:      "Ethereum Sepolia / Polygon PoS",
		CryptoVaultAddress: "0x71C6793A8B101E1794b15B8e48bE5a46E71182dA",
	}, nil
}
