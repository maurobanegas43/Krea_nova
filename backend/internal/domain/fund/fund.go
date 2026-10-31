// Package fund models financial operations, investment commitments, and the immutable
// double-entry ledger for fund movements in the relational database.
package fund

import (
	"errors"
	"time"
)

type InvestmentStatus string

const (
	InvestmentPending   InvestmentStatus = "pending"
	InvestmentActive    InvestmentStatus = "active"
	InvestmentCancelled InvestmentStatus = "cancelled"
	InvestmentCompleted InvestmentStatus = "completed"
)

type AccountType string

const (
	AccountFiatEscrow        AccountType = "fiat_escrow"
	AccountInvestor          AccountType = "investor_wallet"
	AccountPlatformFee       AccountType = "platform_fee"
	AccountGatewayClearing   AccountType = "gateway_clearing"
)

type EntryType string

const (
	EntryDebit  EntryType = "DEBIT"
	EntryCredit EntryType = "CREDIT"
)

var (
	ErrInvalidAmount         = errors.New("fund: amount must be strictly greater than zero")
	ErrUnbalancedTransaction = errors.New("fund: double-entry transaction must sum to zero (debits equal credits)")
	ErrInvestmentNotFound    = errors.New("fund: investment not found")
	ErrAccountNotFound       = errors.New("fund: ledger account not found")
	ErrInsufficientBalance   = errors.New("fund: insufficient funds in account")
)

// Investment represents a direct capital commitment to a project/fund.
type Investment struct {
	ID              string           `json:"id"`
	ProjectID       string           `json:"projectId"`
	ProjectName     string           `json:"projectName,omitempty"`
	TokenSymbol     string           `json:"tokenSymbol,omitempty"`
	Category        string           `json:"category,omitempty"`
	ExpectedAPY     float64          `json:"expectedApy,omitempty"`
	InvestorID      string           `json:"investorId"`
	AmountCents     int64            `json:"amountCents"`
	TokenCount      int              `json:"tokenCount"`
	TokenPriceCents int64            `json:"tokenPriceCents"`
	Status          InvestmentStatus `json:"status"`
	CreatedAt       time.Time        `json:"createdAt"`
}

// NewInvestment validates the financial commitment.
func NewInvestment(id, projectID, investorID string, amountCents int64, now time.Time) (*Investment, error) {
	if amountCents <= 0 {
		return nil, ErrInvalidAmount
	}
	tokenPrice := int64(10000) // $100.00 USD default token denomination
	tokens := int(amountCents / tokenPrice)
	if tokens < 1 {
		tokens = 1
	}
	return &Investment{
		ID:              id,
		ProjectID:       projectID,
		InvestorID:      investorID,
		AmountCents:     amountCents,
		TokenCount:      tokens,
		TokenPriceCents: tokenPrice,
		Status:          InvestmentPending,
		CreatedAt:       now,
	}, nil
}

// LedgerAccount represents a balance-holding account in the relational ledger.
type LedgerAccount struct {
	ID          string      `json:"id"`
	UserID      *string     `json:"userId,omitempty"` // NULL for system-level accounts (e.g., escrow or fee pool)
	AccountType AccountType `json:"accountType"`
	Currency    string      `json:"currency"`
	IsActive    bool        `json:"isActive"`
	CreatedAt   time.Time   `json:"createdAt"`
}

// LedgerEntry is an immutable transaction record adhering to double-entry accounting.
type LedgerEntry struct {
	ID                 string    `json:"id"`
	AccountID          string    `json:"accountId"`
	TransactionGroupID string    `json:"transactionGroupId"` // Shared across paired debit/credit entries
	EntryType          EntryType `json:"entryType"`
	AmountCents        int64     `json:"amountCents"`
	ReferenceType      string    `json:"referenceType"` // "investment", "deposit", "withdrawal", "fee", "yield"
	ReferenceID        string    `json:"referenceId"`
	Description        string    `json:"description"`
	CreatedAt          time.Time `json:"createdAt"`
}

// FiduciaryAccount represents official bank custody rails and smart contract vaults.
type FiduciaryAccount struct {
	ID                 string `json:"id"`
	BankName           string `json:"bankName"`
	AccountHolder      string `json:"accountHolder"`
	CUIT               string `json:"cuit"`
	AccountType        string `json:"accountType"`
	CBU                string `json:"cbu"`
	Alias              string `json:"alias"`
	Currency           string `json:"currency"`
	CryptoToken        string `json:"cryptoToken"`
	CryptoNetwork      string `json:"cryptoNetwork"`
	CryptoVaultAddress string `json:"cryptoVaultAddress"`
}

// ValidateTransactionPair checks that the transaction group maintains zero-sum equilibrium.
func ValidateTransactionPair(entries []LedgerEntry) error {
	if len(entries) < 2 {
		return ErrUnbalancedTransaction
	}

	var totalDebit, totalCredit int64
	for _, entry := range entries {
		if entry.AmountCents <= 0 {
			return ErrInvalidAmount
		}
		switch entry.EntryType {
		case EntryDebit:
			totalDebit += entry.AmountCents
		case EntryCredit:
			totalCredit += entry.AmountCents
		default:
			return ErrUnbalancedTransaction
		}
	}

	if totalDebit != totalCredit {
		return ErrUnbalancedTransaction
	}
	return nil
}
