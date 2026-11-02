package ports

import (
	"context"
	"time"
)

// GoogleClaims holds the verified claims extracted from a Google ID Token.
type GoogleClaims struct {
	Email         string
	EmailVerified bool
	Subject       string
	Name          string
	Picture       string
}

// GoogleTokenVerifier defines the contract for verifying Google Identity Services ID Tokens.
type GoogleTokenVerifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (*GoogleClaims, error)
}

// PasswordRecoveryEmail holds the payload required to send a password reset email via Google Gmail API.
type PasswordRecoveryEmail struct {
	ToEmail          string
	RecipientName    string
	RecoveryURL      string
	ExpiresInMinutes int
	RequestedAt      time.Time
	IPAddress        string
}

// EmailSender defines the outbound port for transactional email delivery (implemented via Google Gmail API).
type EmailSender interface {
	SendPasswordRecoveryEmail(ctx context.Context, msg PasswordRecoveryEmail) error
}

