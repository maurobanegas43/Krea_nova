package user

import (
	"errors"
	"strings"
	"time"
)

const (
	// MaxRecoveryRequestsPerHour defines the strict per-client hourly limit for password recovery requests.
	MaxRecoveryRequestsPerHour = 3

	// RecoveryRateLimitWindow is the sliding window duration for rate limiting recovery requests.
	RecoveryRateLimitWindow = time.Hour

	// RecoveryTokenTTL is the validity period of a password recovery link sent via Gmail.
	RecoveryTokenTTL = 30 * time.Minute
)

var (
	ErrRecoveryRateLimitExceeded = errors.New("recovery: maximum of 3 recovery requests per hour exceeded")
	ErrRecoveryTokenInvalid      = errors.New("recovery: token is invalid or does not exist")
	ErrRecoveryTokenExpired      = errors.New("recovery: token has expired")
	ErrRecoveryTokenConsumed     = errors.New("recovery: token has already been used")
)

// PasswordRecoveryToken represents a single-use cryptographic token issued to reset a user's password via Gmail.
type PasswordRecoveryToken struct {
	ID          string     `json:"id"`
	UserID      string     `json:"userId"`
	Email       string     `json:"email"`
	TokenHash   string     `json:"-"` // SHA-256 hash of the raw token; plaintext is never persisted
	IPAddress   string     `json:"ipAddress"`
	UserAgent   string     `json:"userAgent"`
	ExpiresAt   time.Time  `json:"expiresAt"`
	ConsumedAt  *time.Time `json:"consumedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// NewPasswordRecoveryToken creates a validated PasswordRecoveryToken entity.
func NewPasswordRecoveryToken(id, userID, email, tokenHash, ipAddress, userAgent string, now time.Time) (*PasswordRecoveryToken, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("recovery: token id is required")
	}
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("recovery: user id is required")
	}
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if cleanEmail == "" || !strings.Contains(cleanEmail, "@") {
		return nil, ErrInvalidEmail
	}
	cleanHash := strings.TrimSpace(tokenHash)
	if cleanHash == "" {
		return nil, ErrRecoveryTokenInvalid
	}

	return &PasswordRecoveryToken{
		ID:        strings.TrimSpace(id),
		UserID:    strings.TrimSpace(userID),
		Email:     cleanEmail,
		TokenHash: cleanHash,
		IPAddress: strings.TrimSpace(ipAddress),
		UserAgent: strings.TrimSpace(userAgent),
		ExpiresAt: now.Add(RecoveryTokenTTL),
		CreatedAt: now,
	}, nil
}

// IsExpired reports whether the recovery token has passed its expiration timestamp.
func (t *PasswordRecoveryToken) IsExpired(now time.Time) bool {
	return now.After(t.ExpiresAt)
}

// IsConsumed reports whether the recovery token has already been used.
func (t *PasswordRecoveryToken) IsConsumed() bool {
	return t.ConsumedAt != nil
}

// Validate checks that the token has neither been consumed nor expired at the given timestamp.
func (t *PasswordRecoveryToken) Validate(now time.Time) error {
	if t == nil {
		return ErrRecoveryTokenInvalid
	}
	if t.IsConsumed() {
		return ErrRecoveryTokenConsumed
	}
	if t.IsExpired(now) {
		return ErrRecoveryTokenExpired
	}
	return nil
}
