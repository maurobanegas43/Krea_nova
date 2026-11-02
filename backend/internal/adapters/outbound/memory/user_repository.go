package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/crypto"
)

type UserRepository struct {
	mu       sync.RWMutex
	users    map[string]*user.User
	byEmail  map[string]string // email -> user_id
	byPhone  map[string]string // normalized phone digits -> user_id
	profiles map[string]*user.InvestorProfile
	byDNI    map[string]string // dni_hash -> user_id
	consents []*user.LegalConsent
	devices  map[string]*user.TrustedDevice // key: userID + ":" + deviceID
}

func cleanDigits(s string) string {
	res := make([]rune, 0, len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			res = append(res, r)
		}
	}
	return string(res)
}

func NewUserRepository() *UserRepository {
	return &UserRepository{
		users:    make(map[string]*user.User),
		byEmail:  make(map[string]string),
		byPhone:  make(map[string]string),
		profiles: make(map[string]*user.InvestorProfile),
		byDNI:    make(map[string]string),
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
	if u.Phone != "" {
		digits := cleanDigits(u.Phone)
		if digits != "" {
			r.byPhone[digits] = u.ID
		}
	}
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

func (r *UserRepository) ExistsByEmail(_ context.Context, email string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.byEmail[strings.ToLower(strings.TrimSpace(email))]
	return exists, nil
}

func (r *UserRepository) ExistsByPhone(_ context.Context, phone string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	clean := cleanDigits(phone)
	if clean == "" {
		return false, nil
	}
	if _, ok := r.byPhone[clean]; ok {
		return true, nil
	}
	for _, u := range r.users {
		uClean := cleanDigits(u.Phone)
		if uClean == "" {
			continue
		}
		if uClean == clean || strings.HasSuffix(uClean, clean) || strings.HasSuffix(clean, uClean) {
			return true, nil
		}
		if len(clean) >= 8 && len(uClean) >= 8 && clean[len(clean)-8:] == uClean[len(uClean)-8:] {
			return true, nil
		}
	}
	return false, nil
}

func (r *UserRepository) ExistsByDNI(_ context.Context, dni string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	clean := cleanDigits(dni)
	if clean == "" {
		return false, nil
	}
	hash := crypto.HashSHA256(clean)
	if _, ok := r.byDNI[hash]; ok {
		return true, nil
	}
	for _, p := range r.profiles {
		if p.DNIHash == hash {
			return true, nil
		}
	}
	return false, nil
}

func (r *UserRepository) FindUserByPhone(_ context.Context, phone string) (*user.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	clean := cleanDigits(phone)
	if clean == "" {
		return nil, nil
	}
	if id, ok := r.byPhone[clean]; ok {
		return r.FindUserByID(context.Background(), id)
	}
	for _, u := range r.users {
		uClean := cleanDigits(u.Phone)
		if uClean != "" && (uClean == clean || strings.HasSuffix(uClean, clean) || strings.HasSuffix(clean, uClean)) {
			cp := *u
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *UserRepository) SaveInvestorProfile(_ context.Context, p *user.InvestorProfile) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *p
	r.profiles[p.UserID] = &cp
	if p.DNIHash != "" {
		r.byDNI[p.DNIHash] = p.UserID
	}
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

func (r *UserRepository) FindInvestorProfileByDNI(_ context.Context, dni string) (*user.InvestorProfile, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	clean := cleanDigits(dni)
	if clean == "" {
		return nil, nil
	}
	hash := crypto.HashSHA256(clean)
	if userID, ok := r.byDNI[hash]; ok {
		return r.FindInvestorProfileByUserID(context.Background(), userID)
	}
	for _, p := range r.profiles {
		if p.DNIHash == hash {
			cp := *p
			return &cp, nil
		}
	}
	return nil, nil
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
