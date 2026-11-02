package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/crypto"
)

func cleanDigits(s string) string {
	res := make([]rune, 0, len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			res = append(res, r)
		}
	}
	return string(res)
}

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) SaveUser(ctx context.Context, u *user.User) error {
	query := `
		INSERT INTO users (id, email, phone, password_hash, role, user_type, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			phone = EXCLUDED.phone,
			password_hash = EXCLUDED.password_hash,
			role = EXCLUDED.role,
			user_type = EXCLUDED.user_type,
			is_active = EXCLUDED.is_active,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.pool.Exec(ctx, query,
		u.ID, u.Email, u.Phone, u.PasswordHash, string(u.Role), string(u.UserType), u.IsActive, u.CreatedAt, u.UpdatedAt,
	)
	return err
}

func (r *UserRepository) FindUserByID(ctx context.Context, id string) (*user.User, error) {
	query := `SELECT id, email, phone, password_hash, role, user_type, is_active, created_at, updated_at FROM users WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)

	var u user.User
	var phone *string
	var role, uType string
	err := row.Scan(&u.ID, &u.Email, &phone, &u.PasswordHash, &role, &uType, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if phone != nil {
		u.Phone = *phone
	}
	u.Role = user.Role(role)
	u.UserType = user.UserType(uType)
	return &u, nil
}

func (r *UserRepository) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	query := `SELECT id, email, phone, password_hash, role, user_type, is_active, created_at, updated_at FROM users WHERE email = $1`
	row := r.pool.QueryRow(ctx, query, email)

	var u user.User
	var phone *string
	var role, uType string
	err := row.Scan(&u.ID, &u.Email, &phone, &u.PasswordHash, &role, &uType, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if phone != nil {
		u.Phone = *phone
	}
	u.Role = user.Role(role)
	u.UserType = user.UserType(uType)
	return &u, nil
}

// ExistsByEmail queries only a constant 1 to check email presence without retrieving sensitive user columns.
func (r *UserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	clean := strings.ToLower(strings.TrimSpace(email))
	if clean == "" {
		return false, nil
	}
	query := `SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1`
	var exists int
	err := r.pool.QueryRow(ctx, query, clean).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return exists == 1, nil
}

// ExistsByPhone queries only a constant 1 to verify whether the phone number is already registered.
func (r *UserRepository) ExistsByPhone(ctx context.Context, phone string) (bool, error) {
	digits := cleanDigits(phone)
	if digits == "" {
		return false, nil
	}
	query := `
		SELECT 1 FROM users 
		WHERE phone = $1 
		   OR regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = $2
		   OR (length($2) >= 8 AND length(regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) >= 8 
		       AND RIGHT(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 8) = RIGHT($2, 8))
		LIMIT 1
	`
	var exists int
	err := r.pool.QueryRow(ctx, query, phone, digits).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return exists == 1, nil
}

// ExistsByDNI queries only a constant 1 using the deterministic DNI blind index hash.
func (r *UserRepository) ExistsByDNI(ctx context.Context, dni string) (bool, error) {
	clean := cleanDigits(dni)
	if clean == "" {
		return false, nil
	}
	hash := crypto.HashSHA256(clean)
	query := `SELECT 1 FROM investor_profiles WHERE dni_hash = $1 LIMIT 1`
	var exists int
	err := r.pool.QueryRow(ctx, query, hash).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return exists == 1, nil
}

// FindUserByPhone fetches strictly minimal user identity columns (id, email, phone) needed for lookup.
func (r *UserRepository) FindUserByPhone(ctx context.Context, phone string) (*user.User, error) {
	digits := cleanDigits(phone)
	if digits == "" {
		return nil, nil
	}
	query := `SELECT id, email, phone FROM users WHERE phone = $1 OR regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = $2 LIMIT 1`
	row := r.pool.QueryRow(ctx, query, phone, digits)

	var u user.User
	var phoneVal *string
	err := row.Scan(&u.ID, &u.Email, &phoneVal)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if phoneVal != nil {
		u.Phone = *phoneVal
	}
	return &u, nil
}

// FindInvestorProfileByDNI fetches strictly minimal profile reference (id, user_id) needed for validation.
func (r *UserRepository) FindInvestorProfileByDNI(ctx context.Context, dni string) (*user.InvestorProfile, error) {
	clean := cleanDigits(dni)
	if clean == "" {
		return nil, nil
	}
	hash := crypto.HashSHA256(clean)
	query := `SELECT id, user_id, COALESCE(dni_hash, '') FROM investor_profiles WHERE dni_hash = $1 LIMIT 1`
	row := r.pool.QueryRow(ctx, query, hash)

	var p user.InvestorProfile
	err := row.Scan(&p.ID, &p.UserID, &p.DNIHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *UserRepository) SaveInvestorProfile(ctx context.Context, p *user.InvestorProfile) error {
	query := `
		INSERT INTO investor_profiles (
			id, user_id, full_name, dni_encrypted, dni_hash, cuil_encrypted, birth_date,
			address_encrypted, city, province, funds_origin, is_pep, is_obligated_subject,
			kyc_status, verified_at, phone, payout_currency, bank_cbu_or_alias,
			bank_name, web3_wallet_address, auto_reinvest_yield, two_factor_enabled,
			notify_construction_alerts, notify_audit_reports, notify_early_access
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
		)
		ON CONFLICT (user_id) DO UPDATE SET
			full_name = EXCLUDED.full_name,
			dni_encrypted = EXCLUDED.dni_encrypted,
			dni_hash = EXCLUDED.dni_hash,
			cuil_encrypted = EXCLUDED.cuil_encrypted,
			birth_date = EXCLUDED.birth_date,
			address_encrypted = EXCLUDED.address_encrypted,
			city = EXCLUDED.city,
			province = EXCLUDED.province,
			funds_origin = EXCLUDED.funds_origin,
			is_pep = EXCLUDED.is_pep,
			is_obligated_subject = EXCLUDED.is_obligated_subject,
			kyc_status = EXCLUDED.kyc_status,
			verified_at = EXCLUDED.verified_at,
			phone = EXCLUDED.phone,
			payout_currency = EXCLUDED.payout_currency,
			bank_cbu_or_alias = EXCLUDED.bank_cbu_or_alias,
			bank_name = EXCLUDED.bank_name,
			web3_wallet_address = EXCLUDED.web3_wallet_address,
			auto_reinvest_yield = EXCLUDED.auto_reinvest_yield,
			two_factor_enabled = EXCLUDED.two_factor_enabled,
			notify_construction_alerts = EXCLUDED.notify_construction_alerts,
			notify_audit_reports = EXCLUDED.notify_audit_reports,
			notify_early_access = EXCLUDED.notify_early_access
	`
	_, err := r.pool.Exec(ctx, query,
		p.ID, p.UserID, p.FullName, p.DNIEncrypted, p.DNIHash, p.CUILEncrypted, p.BirthDate,
		p.AddressEncrypted, p.City, p.Province, p.FundsOrigin, p.IsPEP, p.IsObligatedSubject,
		string(p.KYCStatus), p.VerifiedAt, p.Phone, p.PayoutCurrency, p.BankCbuOrAlias,
		p.BankName, p.Web3WalletAddress, p.AutoReinvestYield, p.TwoFactorEnabled,
		p.NotifyConstructionAlerts, p.NotifyAuditReports, p.NotifyEarlyAccess,
	)
	if err != nil {
		return err
	}

	if p.Phone != "" {
		_, _ = r.pool.Exec(ctx, `UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`, p.Phone, p.UserID)
	}

	return nil
}

func (r *UserRepository) FindInvestorProfileByUserID(ctx context.Context, userID string) (*user.InvestorProfile, error) {
	query := `
		SELECT id, user_id, full_name, dni_encrypted, COALESCE(dni_hash, ''), cuil_encrypted, birth_date,
		       address_encrypted, city, province, funds_origin, is_pep, is_obligated_subject,
		       kyc_status, verified_at,
		       COALESCE(phone, ''), COALESCE(payout_currency, 'USD'), COALESCE(bank_cbu_or_alias, ''),
		       COALESCE(bank_name, ''), COALESCE(web3_wallet_address, ''), COALESCE(auto_reinvest_yield, false),
		       COALESCE(two_factor_enabled, true), COALESCE(notify_construction_alerts, true),
		       COALESCE(notify_audit_reports, true), COALESCE(notify_early_access, true)
		FROM investor_profiles WHERE user_id = $1
	`
	row := r.pool.QueryRow(ctx, query, userID)

	var p user.InvestorProfile
	var kyc string
	err := row.Scan(
		&p.ID, &p.UserID, &p.FullName, &p.DNIEncrypted, &p.DNIHash, &p.CUILEncrypted, &p.BirthDate,
		&p.AddressEncrypted, &p.City, &p.Province, &p.FundsOrigin, &p.IsPEP, &p.IsObligatedSubject,
		&kyc, &p.VerifiedAt,
		&p.Phone, &p.PayoutCurrency, &p.BankCbuOrAlias, &p.BankName, &p.Web3WalletAddress,
		&p.AutoReinvestYield, &p.TwoFactorEnabled, &p.NotifyConstructionAlerts,
		&p.NotifyAuditReports, &p.NotifyEarlyAccess,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	p.KYCStatus = user.KYCStatus(kyc)
	return &p, nil
}

func (r *UserRepository) UpdateKYCStatus(ctx context.Context, userID string, status user.KYCStatus) error {
	query := `UPDATE investor_profiles SET kyc_status = $1, verified_at = CASE WHEN $1::varchar = 'verified' THEN NOW() ELSE NULL END WHERE user_id = $2`
	_, err := r.pool.Exec(ctx, query, string(status), userID)
	return err
}

func (r *UserRepository) SaveLegalConsent(ctx context.Context, consent *user.LegalConsent) error {
	query := `
		INSERT INTO legal_consents (id, user_id, consent_type, document_version, document_hash, ip_address, accepted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.pool.Exec(ctx, query,
		consent.ID, consent.UserID, string(consent.ConsentType), consent.DocumentVersion, consent.DocumentHash, consent.IPAddress, consent.AcceptedAt,
	)
	return err
}

func (r *UserRepository) SaveTrustedDevice(ctx context.Context, device *user.TrustedDevice) error {
	query := `
		INSERT INTO trusted_devices (
			id, user_id, device_id, device_token, device_name, fingerprint, ip_address, user_agent, is_active, trusted_at, last_used_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (user_id, device_id) DO UPDATE SET
			device_token = EXCLUDED.device_token,
			device_name = EXCLUDED.device_name,
			fingerprint = EXCLUDED.fingerprint,
			ip_address = EXCLUDED.ip_address,
			user_agent = EXCLUDED.user_agent,
			is_active = EXCLUDED.is_active,
			last_used_at = EXCLUDED.last_used_at
	`
	_, err := r.pool.Exec(ctx, query,
		device.ID, device.UserID, device.DeviceID, device.DeviceToken, device.DeviceName,
		device.Fingerprint, device.IPAddress, device.UserAgent, device.IsActive, device.TrustedAt, device.LastUsedAt,
	)
	return err
}

func (r *UserRepository) FindTrustedDevice(ctx context.Context, userID, deviceID string) (*user.TrustedDevice, error) {
	query := `
		SELECT id, user_id, device_id, device_token, device_name, fingerprint, ip_address, user_agent, is_active, trusted_at, last_used_at
		FROM trusted_devices
		WHERE user_id = $1 AND device_id = $2 AND is_active = TRUE
	`
	row := r.pool.QueryRow(ctx, query, userID, deviceID)
	var d user.TrustedDevice
	var ip, ua *string
	err := row.Scan(
		&d.ID, &d.UserID, &d.DeviceID, &d.DeviceToken, &d.DeviceName, &d.Fingerprint,
		&ip, &ua, &d.IsActive, &d.TrustedAt, &d.LastUsedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if ip != nil {
		d.IPAddress = *ip
	}
	if ua != nil {
		d.UserAgent = *ua
	}
	return &d, nil
}

func (r *UserRepository) ListTrustedDevices(ctx context.Context, userID string) ([]*user.TrustedDevice, error) {
	query := `
		SELECT id, user_id, device_id, device_token, device_name, fingerprint, ip_address, user_agent, is_active, trusted_at, last_used_at
		FROM trusted_devices
		WHERE user_id = $1 AND is_active = TRUE
		ORDER BY last_used_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*user.TrustedDevice
	for rows.Next() {
		var d user.TrustedDevice
		var ip, ua *string
		if err := rows.Scan(
			&d.ID, &d.UserID, &d.DeviceID, &d.DeviceToken, &d.DeviceName, &d.Fingerprint,
			&ip, &ua, &d.IsActive, &d.TrustedAt, &d.LastUsedAt,
		); err != nil {
			return nil, err
		}
		if ip != nil {
			d.IPAddress = *ip
		}
		if ua != nil {
			d.UserAgent = *ua
		}
		list = append(list, &d)
	}
	return list, nil
}

func (r *UserRepository) RevokeTrustedDevice(ctx context.Context, userID, deviceID string) error {
	query := `UPDATE trusted_devices SET is_active = FALSE WHERE user_id = $1 AND device_id = $2`
	_, err := r.pool.Exec(ctx, query, userID, deviceID)
	return err
}
