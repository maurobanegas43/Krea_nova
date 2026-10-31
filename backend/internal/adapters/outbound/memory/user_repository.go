package memory

import (
	"context"
	"sync"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

type UserRepository struct {
	mu       sync.RWMutex
	users    map[string]*user.User
	byEmail  map[string]string // email -> user_id
	profiles map[string]*user.InvestorProfile
	consents []*user.LegalConsent
	devices  map[string]*user.TrustedDevice // key: userID + ":" + deviceID
}

func NewUserRepository() *UserRepository {
	return &UserRepository{
		users:    make(map[string]*user.User),
		byEmail:  make(map[string]string),
		profiles: make(map[string]*user.InvestorProfile),
		consents: make([]*user.LegalConsent, 0),
		devices:  make(map[string]*user.TrustedDevice),
	}
}

func (r *UserRepository) SaveUser(_ context.Context, u *user.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *u
	r.users[u.ID] = &cp
	r.byEmail[u.Email] = u.ID
	return nil
}

func (r *UserRepository) FindUserByID(_ context.Context, id string) (*user.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[id]
	if !ok {
		return nil, nil
	}
	cp := *u
	return &cp, nil
}

func (r *UserRepository) FindUserByEmail(_ context.Context, email string) (*user.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	id, ok := r.byEmail[email]
	if !ok {
		return nil, nil
	}
	return r.FindUserByID(context.Background(), id)
}

func (r *UserRepository) SaveInvestorProfile(_ context.Context, p *user.InvestorProfile) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *p
	r.profiles[p.UserID] = &cp
	return nil
}

func (r *UserRepository) FindInvestorProfileByUserID(_ context.Context, userID string) (*user.InvestorProfile, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.profiles[userID]
	if !ok {
		return nil, nil
	}
	cp := *p
	return &cp, nil
}

func (r *UserRepository) UpdateKYCStatus(_ context.Context, userID string, status user.KYCStatus) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.profiles[userID]
	if !ok {
		now := time.Now()
		r.profiles[userID] = &user.InvestorProfile{
			ID:         userID + "-prof",
			UserID:     userID,
			FullName:   "Investor " + userID,
			KYCStatus:  status,
			VerifiedAt: &now,
		}
		return nil
	}
	p.KYCStatus = status
	if status == user.KYCVerified {
		now := time.Now()
		p.VerifiedAt = &now
	}
	return nil
}

func (r *UserRepository) SaveLegalConsent(_ context.Context, consent *user.LegalConsent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *consent
	r.consents = append(r.consents, &cp)
	return nil
}

func (r *UserRepository) SaveTrustedDevice(_ context.Context, device *user.TrustedDevice) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := device.UserID + ":" + device.DeviceID
	cp := *device
	r.devices[key] = &cp
	return nil
}

func (r *UserRepository) FindTrustedDevice(_ context.Context, userID, deviceID string) (*user.TrustedDevice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	key := userID + ":" + deviceID
	d, ok := r.devices[key]
	if !ok || !d.IsActive {
		return nil, nil
	}
	cp := *d
	return &cp, nil
}

func (r *UserRepository) ListTrustedDevices(_ context.Context, userID string) ([]*user.TrustedDevice, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []*user.TrustedDevice
	prefix := userID + ":"
	for k, d := range r.devices {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix && d.IsActive {
			cp := *d
			list = append(list, &cp)
		}
	}
	return list, nil
}

func (r *UserRepository) RevokeTrustedDevice(_ context.Context, userID, deviceID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := userID + ":" + deviceID
	if d, ok := r.devices[key]; ok {
		d.IsActive = false
	}
	return nil
}
