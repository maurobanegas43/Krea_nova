// Package user defines the domain entities for users, authentication, investor/developer profiles,
// and legal consents. It preserves domain invariants without infrastructure dependencies.
package user

import (
	"errors"
	"strings"
	"time"
)

type Role string

const (
	RoleInvestor  Role = "investor"
	RoleDeveloper Role = "developer"
	RoleAdmin     Role = "admin"
)

type UserType string

const (
	UserTypeIndividual UserType = "individual"
	UserTypeCorporate  UserType = "corporate"
)

type KYCStatus string

const (
	KYCPending  KYCStatus = "pending"
	KYCVerified KYCStatus = "verified"
	KYCRejected KYCStatus = "rejected"
)

type ConsentType string

const (
	ConsentTermsAndConditions ConsentType = "terms_and_conditions"
	ConsentPrivacyPolicy      ConsentType = "privacy_policy"
	ConsentSwornTruth         ConsentType = "sworn_truth"
)

var (
	ErrInvalidEmail      = errors.New("user: invalid email address")
	ErrEmptyPasswordHash = errors.New("user: password hash is required")
	ErrInvalidRole       = errors.New("user: invalid user role")
	ErrUserInactive      = errors.New("user: account is inactive")
	ErrKYCNotVerified    = errors.New("user: kyc verification required before performing financial operations")
)

// User represents the root account entity.
type User struct {
	ID           string
	Email        string
	Phone        string
	PasswordHash string
	Role         Role
	UserType     UserType
	IsActive     bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NewUser creates a new User with baseline validations.
func NewUser(id, email, phone, passwordHash string, role Role, uType UserType, now time.Time) (*User, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if cleanEmail == "" || !strings.Contains(cleanEmail, "@") {
		return nil, ErrInvalidEmail
	}
	if strings.TrimSpace(passwordHash) == "" {
		return nil, ErrEmptyPasswordHash
	}
	switch role {
	case RoleInvestor, RoleDeveloper, RoleAdmin:
	default:
		return nil, ErrInvalidRole
	}

	return &User{
		ID:           id,
		Email:        cleanEmail,
		Phone:        strings.TrimSpace(phone),
		PasswordHash: passwordHash,
		Role:         role,
		UserType:     uType,
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// InvestorProfile contains PII stored strictly in encrypted form.
type InvestorProfile struct {
	ID                       string
	UserID                   string
	FullName                 string
	DNIEncrypted             string // AES-256-GCM encrypted
	DNIHash                  string // Deterministic SHA-256 for blind index check
	CUILEncrypted            string // AES-256-GCM encrypted
	BirthDate                string // YYYY-MM-DD
	AddressEncrypted         string // AES-256-GCM encrypted
	City                     string
	Province                 string
	FundsOrigin              string
	IsPEP                    bool
	IsObligatedSubject       bool
	KYCStatus                KYCStatus
	VerifiedAt               *time.Time
	Phone                    string
	PayoutCurrency           string
	BankCbuOrAlias           string
	BankName                 string
	Web3WalletAddress        string
	AutoReinvestYield        bool
	TwoFactorEnabled         bool
	NotifyConstructionAlerts bool
	NotifyAuditReports       bool
	NotifyEarlyAccess        bool
}

// DeveloperProfile represents legal entities sponsoring projects.
type DeveloperProfile struct {
	ID                 string
	UserID             string
	CompanyName        string
	TradeName          string
	CompanyType        string // SA, SAS, SRL, Fideicomiso
	CUIT               string
	RegistrationNumber string
	LegalAddress       string
	RepFullName        string
	RepRole            string
	RepDNIEncrypted    string // AES-256-GCM encrypted
	RepCUILEncrypted   string // AES-256-GCM encrypted
	UBODeclared        bool
	VerificationStatus KYCStatus
	VerifiedAt         *time.Time
}

// LegalConsent models recorded acceptances with immutability.
type LegalConsent struct {
	ID              string
	UserID          string
	ConsentType     ConsentType
	DocumentVersion string
	DocumentHash    string
	IPAddress       string
	AcceptedAt      time.Time
}
