package ports

import (
	"context"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

// UserRepository abstracts persistence for user accounts and profiles.
type UserRepository interface {
	SaveUser(ctx context.Context, u *user.User) error
	FindUserByID(ctx context.Context, id string) (*user.User, error)
	FindUserByEmail(ctx context.Context, email string) (*user.User, error)
	FindUserByPhone(ctx context.Context, phone string) (*user.User, error)

	// Lightweight existence checks for registration validation (queries only presence, no sensitive PII loaded)
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByPhone(ctx context.Context, phone string) (bool, error)
	ExistsByDNI(ctx context.Context, dni string) (bool, error)

	SaveInvestorProfile(ctx context.Context, profile *user.InvestorProfile) error
	FindInvestorProfileByUserID(ctx context.Context, userID string) (*user.InvestorProfile, error)
	FindInvestorProfileByDNI(ctx context.Context, dni string) (*user.InvestorProfile, error)
	UpdateKYCStatus(ctx context.Context, userID string, status user.KYCStatus) error

	SaveLegalConsent(ctx context.Context, consent *user.LegalConsent) error

	// Trusted Devices management
	SaveTrustedDevice(ctx context.Context, device *user.TrustedDevice) error
	FindTrustedDevice(ctx context.Context, userID, deviceID string) (*user.TrustedDevice, error)
	ListTrustedDevices(ctx context.Context, userID string) ([]*user.TrustedDevice, error)
	RevokeTrustedDevice(ctx context.Context, userID, deviceID string) error

	// Password Recovery & Rate Limiting (3 requests per hour per client)
	CountRecentRecoveryAttempts(ctx context.Context, email, ipAddress string, since time.Time) (int, error)
	RecordRecoveryAttempt(ctx context.Context, id, email, ipAddress string, createdAt time.Time) error
	SavePasswordRecoveryToken(ctx context.Context, token *user.PasswordRecoveryToken) error
	FindPasswordRecoveryTokenByHash(ctx context.Context, tokenHash string) (*user.PasswordRecoveryToken, error)
	MarkPasswordRecoveryTokenConsumed(ctx context.Context, id string, consumedAt time.Time) error
	UpdateUserPassword(ctx context.Context, userID, passwordHash string, updatedAt time.Time) error
}
