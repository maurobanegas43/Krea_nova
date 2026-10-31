package ports

import (
	"context"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

// UserRepository abstracts persistence for user accounts and profiles.
type UserRepository interface {
	SaveUser(ctx context.Context, u *user.User) error
	FindUserByID(ctx context.Context, id string) (*user.User, error)
	FindUserByEmail(ctx context.Context, email string) (*user.User, error)

	SaveInvestorProfile(ctx context.Context, profile *user.InvestorProfile) error
	FindInvestorProfileByUserID(ctx context.Context, userID string) (*user.InvestorProfile, error)
	UpdateKYCStatus(ctx context.Context, userID string, status user.KYCStatus) error

	SaveLegalConsent(ctx context.Context, consent *user.LegalConsent) error

	// Trusted Devices management
	SaveTrustedDevice(ctx context.Context, device *user.TrustedDevice) error
	FindTrustedDevice(ctx context.Context, userID, deviceID string) (*user.TrustedDevice, error)
	ListTrustedDevices(ctx context.Context, userID string) ([]*user.TrustedDevice, error)
	RevokeTrustedDevice(ctx context.Context, userID, deviceID string) error
}
