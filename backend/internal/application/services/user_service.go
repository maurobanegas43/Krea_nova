package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/crypto"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/validation"
)

var (
	ErrUserAlreadyExists           = errors.New("user: email already registered")
	ErrUserNotFound                = errors.New("user: not found")
	ErrProfileNotFound             = errors.New("user: investor profile not found")
	ErrLivenessRequired            = errors.New("user: liveness verification required for investors")
	ErrLivenessSessionNotFound     = errors.New("user: liveness session not found")
	ErrLivenessSessionExpired      = errors.New("user: liveness session expired")
	ErrLivenessSessionConsumed     = errors.New("user: liveness session already consumed")
	ErrLivenessInsufficientQuality = errors.New("user: liveness confidence below acceptable threshold")
	ErrLivenessTokenInvalid        = errors.New("user: liveness verification token invalid")
	ErrInvalidCredentials          = errors.New("user: invalid email or password")
	ErrAccountNotAssociated        = errors.New("user: la cuenta de Google no se encuentra registrada o asociada")
	ErrConsentRequired             = errors.New("user: el usuario debe permitir el inicio de sesión explícitamente")
	ErrDeviceAuthorizationRequired = errors.New("device: dispositivo no reconocido, requiere autorización de dispositivo de confianza")
)

type GoogleLoginCommand struct {
	IDToken         string
	DeviceID        string
	DeviceToken     string
	DeviceName      string
	Fingerprint     string
	IPAddress       string
	UserAgent       string
	UserConsent     bool
	AuthorizeDevice bool
}

type GoogleLoginResult struct {
	User                        *user.User                `json:"user,omitempty"`
	Profile                     *DecryptedInvestorProfile `json:"profile,omitempty"`
	TrustedDevice               *user.TrustedDevice       `json:"trustedDevice,omitempty"`
	RequiresUserConsent         bool                      `json:"requiresUserConsent"`
	RequiresDeviceAuthorization bool                      `json:"requiresDeviceAuthorization"`
	GoogleEmail                 string                    `json:"googleEmail"`
	GoogleName                  string                    `json:"googleName,omitempty"`
	GooglePicture               string                    `json:"googlePicture,omitempty"`
}

type LivenessSession struct {
	ID                string     `json:"sessionId"`
	CreatedAt         time.Time  `json:"createdAt"`
	ExpiresAt         time.Time  `json:"expiresAt"`
	Verified          bool       `json:"verified"`
	VerifiedAt        *time.Time `json:"verifiedAt,omitempty"`
	Confidence        float64    `json:"confidence,omitempty"`
	ProofHash         string     `json:"proofHash,omitempty"`
	VerificationToken string     `json:"verificationToken,omitempty"`
	Consumed          bool       `json:"consumed"`
}

type RegisterUserCommand struct {
	Email             string
	Phone             string
	Password          string
	Role              user.Role
	UserType          user.UserType
	GoogleIDToken     string
	LivenessSessionID string
	LivenessToken     string
	LivenessVerified  bool
}

type SaveInvestorProfileCommand struct {
	UserID                   string
	FullName                 string
	DNI                      string // Plaintext PII to be encrypted
	CUIL                     string // Plaintext PII to be encrypted
	BirthDate                string
	Address                  string // Plaintext PII to be encrypted
	City                     string
	Province                 string
	FundsOrigin              string
	IsPEP                    bool
	IsObligatedSubject       bool
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

type RecordConsentCommand struct {
	UserID          string
	ConsentType     user.ConsentType
	DocumentVersion string
	DocumentHash    string
	IPAddress       string
}

type DecryptedInvestorProfile struct {
	ID                       string
	UserID                   string
	FullName                 string
	DNI                      string // Decrypted
	CUIL                     string // Decrypted
	BirthDate                string
	Address                  string // Decrypted
	City                     string
	Province                 string
	FundsOrigin              string
	IsPEP                    bool
	IsObligatedSubject       bool
	KYCStatus                user.KYCStatus
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

type UserService struct {
	repo             ports.UserRepository
	encryptor        crypto.Encryptor
	hasher           crypto.PasswordHasher
	ids              ports.IDGenerator
	clock            ports.Clock
	googleVerifier   ports.GoogleTokenVerifier
	livenessMu       sync.RWMutex
	livenessSessions map[string]*LivenessSession
}

func NewUserService(
	repo ports.UserRepository,
	encryptor crypto.Encryptor,
	hasher crypto.PasswordHasher,
	ids ports.IDGenerator,
	clock ports.Clock,
) *UserService {
	return &UserService{
		repo:             repo,
		encryptor:        encryptor,
		hasher:           hasher,
		ids:              ids,
		clock:            clock,
		livenessSessions: make(map[string]*LivenessSession),
	}
}

func (s *UserService) SetGoogleVerifier(gv ports.GoogleTokenVerifier) {
	s.googleVerifier = gv
}

func (s *UserService) VerifyGoogleIDToken(ctx context.Context, idToken string) (*ports.GoogleClaims, error) {
	if s.googleVerifier == nil {
		return nil, errors.New("user: google token verification not configured")
	}
	return s.googleVerifier.VerifyIDToken(ctx, idToken)
}

func (s *UserService) CreateLivenessSession(ctx context.Context) (*LivenessSession, error) {
	s.livenessMu.Lock()
	defer s.livenessMu.Unlock()

	now := s.clock.Now()
	sessionID := s.ids.NewID()
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, errors.New("user: failed to generate liveness verification token")
	}

	session := &LivenessSession{
		ID:                sessionID,
		CreatedAt:         now,
		ExpiresAt:         now.Add(10 * time.Minute),
		Verified:          false,
		VerificationToken: hex.EncodeToString(tokenBytes),
		Consumed:          false,
	}

	s.livenessSessions[sessionID] = session
	return session, nil
}

func (s *UserService) VerifyLivenessSession(ctx context.Context, sessionID, proofHash string, confidence float64) (*LivenessSession, error) {
	s.livenessMu.Lock()
	defer s.livenessMu.Unlock()

	session, exists := s.livenessSessions[sessionID]
	if !exists {
		return nil, ErrLivenessSessionNotFound
	}

	now := s.clock.Now()
	if now.After(session.ExpiresAt) {
		return nil, ErrLivenessSessionExpired
	}

	if session.Consumed {
		return nil, ErrLivenessSessionConsumed
	}

	if confidence < 0.70 {
		return nil, ErrLivenessInsufficientQuality
	}

	if proofHash == "" {
		return nil, errors.New("user: proof hash is required")
	}

	session.Verified = true
	session.VerifiedAt = &now
	session.Confidence = confidence
	session.ProofHash = proofHash

	return session, nil
}

func (s *UserService) GetLivenessSession(ctx context.Context, sessionID string) (*LivenessSession, error) {
	s.livenessMu.RLock()
	defer s.livenessMu.RUnlock()

	session, exists := s.livenessSessions[sessionID]
	if !exists {
		return nil, ErrLivenessSessionNotFound
	}
	return session, nil
}

func (s *UserService) validateLivenessSession(sessionID, token string) error {
	s.livenessMu.RLock()
	defer s.livenessMu.RUnlock()

	session, exists := s.livenessSessions[sessionID]
	if !exists {
		return ErrLivenessSessionNotFound
	}

	now := s.clock.Now()
	if now.After(session.ExpiresAt) {
		return ErrLivenessSessionExpired
	}

	if session.Consumed {
		return ErrLivenessSessionConsumed
	}

	if !session.Verified {
		return errors.New("user: liveness verification has not been completed")
	}

	if session.VerificationToken != token {
		return ErrLivenessTokenInvalid
	}

	return nil
}

func (s *UserService) consumeLivenessSession(sessionID, token string) error {
	s.livenessMu.Lock()
	defer s.livenessMu.Unlock()

	session, exists := s.livenessSessions[sessionID]
	if !exists {
		return ErrLivenessSessionNotFound
	}

	now := s.clock.Now()
	if now.After(session.ExpiresAt) {
		return ErrLivenessSessionExpired
	}

	if session.Consumed {
		return ErrLivenessSessionConsumed
	}

	if !session.Verified {
		return errors.New("user: liveness verification has not been completed")
	}

	if session.VerificationToken != token {
		return ErrLivenessTokenInvalid
	}

	session.Consumed = true
	return nil
}

func (s *UserService) RegisterUser(ctx context.Context, cmd RegisterUserCommand) (*user.User, error) {
	// Liveness verification check: Validate without burning the session yet
	if cmd.LivenessVerified {
		if cmd.LivenessSessionID == "" || cmd.LivenessToken == "" {
			return nil, errors.New("user: cannot claim liveness verification without a valid verified backend session")
		}
		if err := s.validateLivenessSession(cmd.LivenessSessionID, cmd.LivenessToken); err != nil {
			return nil, err
		}
	} else if cmd.Role == user.RoleInvestor && cmd.LivenessSessionID != "" {
		if err := s.validateLivenessSession(cmd.LivenessSessionID, cmd.LivenessToken); err != nil {
			return nil, err
		}
	}
	// 1. Strict format & consistency validations
	var (
		cleanEmail string
		err        error
	)
	if cmd.Role == user.RoleInvestor {
		cleanEmail, err = validation.ValidateGmail(cmd.Email)
		if err != nil {
			return nil, err
		}
	} else {
		cleanEmail, err = validation.ValidateEmail(cmd.Email)
		if err != nil {
			return nil, err
		}
	}

	if cmd.GoogleIDToken != "" && s.googleVerifier != nil {
		claims, err := s.googleVerifier.VerifyIDToken(ctx, cmd.GoogleIDToken)
		if err != nil {
			return nil, errors.New("user: invalid google id token: " + err.Error())
		}
		if claims.Email != cleanEmail {
			return nil, errors.New("user: token email does not match registered email")
		}
	}

	cleanPhone, err := validation.ValidateAndFormatPhone(cmd.Phone, "AR")
	if err != nil {
		return nil, err
	}

	if err := validation.ValidatePasswordStrength(cmd.Password); err != nil {
		return nil, err
	}

	// 2. Uniqueness check
	existing, _ := s.repo.FindUserByEmail(ctx, cleanEmail)
	if existing != nil {
		return nil, ErrUserAlreadyExists
	}

	// 3. Consume the liveness session now that all validations passed
	if cmd.LivenessSessionID != "" && cmd.LivenessToken != "" {
		if err := s.consumeLivenessSession(cmd.LivenessSessionID, cmd.LivenessToken); err != nil {
			return nil, err
		}
	}

	// 4. Secure password hashing
	passHash, err := s.hasher.HashPassword(cmd.Password)
	if err != nil {
		return nil, err
	}

	// 5. Domain entity creation with validated invariants
	u, err := user.NewUser(s.ids.NewID(), cleanEmail, cleanPhone, passHash, cmd.Role, cmd.UserType, s.clock.Now())
	if err != nil {
		return nil, err
	}

	if err := s.repo.SaveUser(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *UserService) AuthenticateUser(ctx context.Context, email, password string) (*user.User, *DecryptedInvestorProfile, error) {
	cleanEmail, err := validation.ValidateGmail(email)
	if err != nil {
		cleanEmail = email
	}

	u, err := s.repo.FindUserByEmail(ctx, cleanEmail)
	if err != nil || u == nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := s.hasher.ComparePassword(u.PasswordHash, password); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	profile, _ := s.GetInvestorProfile(ctx, u.ID)
	return u, profile, nil
}

func (s *UserService) SaveInvestorProfile(ctx context.Context, cmd SaveInvestorProfileCommand) (*user.InvestorProfile, error) {
	u, err := s.repo.FindUserByID(ctx, cmd.UserID)
	if err != nil || u == nil {
		return nil, ErrUserNotFound
	}

	// Encrypt sensitive PII with AES-256-GCM before database storage
	dniEnc, err := s.encryptor.Encrypt(cmd.DNI)
	if err != nil {
		return nil, err
	}
	cuilEnc, err := s.encryptor.Encrypt(cmd.CUIL)
	if err != nil {
		return nil, err
	}
	addrEnc, err := s.encryptor.Encrypt(cmd.Address)
	if err != nil {
		return nil, err
	}

	kycStatus := user.KYCPending
	var verifiedAt *time.Time
	if existing, _ := s.repo.FindInvestorProfileByUserID(ctx, cmd.UserID); existing != nil {
		if existing.KYCStatus == user.KYCVerified {
			kycStatus = user.KYCVerified
			verifiedAt = existing.VerifiedAt
		}
	}

	profile := &user.InvestorProfile{
		ID:                       s.ids.NewID(),
		UserID:                   cmd.UserID,
		FullName:                 cmd.FullName,
		DNIEncrypted:             dniEnc,
		CUILEncrypted:            cuilEnc,
		BirthDate:                cmd.BirthDate,
		AddressEncrypted:         addrEnc,
		City:                     cmd.City,
		Province:                 cmd.Province,
		FundsOrigin:              cmd.FundsOrigin,
		IsPEP:                    cmd.IsPEP,
		IsObligatedSubject:       cmd.IsObligatedSubject,
		KYCStatus:                kycStatus,
		VerifiedAt:               verifiedAt,
		Phone:                    cmd.Phone,
		PayoutCurrency:           cmd.PayoutCurrency,
		BankCbuOrAlias:           cmd.BankCbuOrAlias,
		BankName:                 cmd.BankName,
		Web3WalletAddress:        cmd.Web3WalletAddress,
		AutoReinvestYield:        cmd.AutoReinvestYield,
		TwoFactorEnabled:         cmd.TwoFactorEnabled,
		NotifyConstructionAlerts: cmd.NotifyConstructionAlerts,
		NotifyAuditReports:       cmd.NotifyAuditReports,
		NotifyEarlyAccess:        cmd.NotifyEarlyAccess,
	}

	if err := s.repo.SaveInvestorProfile(ctx, profile); err != nil {
		return nil, err
	}
	return profile, nil
}

func (s *UserService) GetInvestorProfile(ctx context.Context, userID string) (*DecryptedInvestorProfile, error) {
	p, err := s.repo.FindInvestorProfileByUserID(ctx, userID)
	if err != nil || p == nil {
		return nil, ErrProfileNotFound
	}

	dniDec, _ := s.encryptor.Decrypt(p.DNIEncrypted)
	cuilDec, _ := s.encryptor.Decrypt(p.CUILEncrypted)
	addrDec, _ := s.encryptor.Decrypt(p.AddressEncrypted)

	return &DecryptedInvestorProfile{
		ID:                       p.ID,
		UserID:                   p.UserID,
		FullName:                 p.FullName,
		DNI:                      dniDec,
		CUIL:                     cuilDec,
		BirthDate:                p.BirthDate,
		Address:                  addrDec,
		City:                     p.City,
		Province:                 p.Province,
		FundsOrigin:              p.FundsOrigin,
		IsPEP:                    p.IsPEP,
		IsObligatedSubject:       p.IsObligatedSubject,
		KYCStatus:                p.KYCStatus,
		VerifiedAt:               p.VerifiedAt,
		Phone:                    p.Phone,
		PayoutCurrency:           p.PayoutCurrency,
		BankCbuOrAlias:           p.BankCbuOrAlias,
		BankName:                 p.BankName,
		Web3WalletAddress:        p.Web3WalletAddress,
		AutoReinvestYield:        p.AutoReinvestYield,
		TwoFactorEnabled:         p.TwoFactorEnabled,
		NotifyConstructionAlerts: p.NotifyConstructionAlerts,
		NotifyAuditReports:       p.NotifyAuditReports,
		NotifyEarlyAccess:        p.NotifyEarlyAccess,
	}, nil
}

func (s *UserService) UpdateKYCStatus(ctx context.Context, userID string, status user.KYCStatus) error {
	u, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || u == nil {
		return ErrUserNotFound
	}
	return s.repo.UpdateKYCStatus(ctx, userID, status)
}

func (s *UserService) RecordConsent(ctx context.Context, cmd RecordConsentCommand) error {
	consent := &user.LegalConsent{
		ID:              s.ids.NewID(),
		UserID:          cmd.UserID,
		ConsentType:     cmd.ConsentType,
		DocumentVersion: cmd.DocumentVersion,
		DocumentHash:    cmd.DocumentHash,
		IPAddress:       cmd.IPAddress,
		AcceptedAt:      s.clock.Now(),
	}
	return s.repo.SaveLegalConsent(ctx, consent)
}

func (s *UserService) AuthenticateWithGoogle(ctx context.Context, cmd GoogleLoginCommand) (*GoogleLoginResult, error) {
	var (
		claims *ports.GoogleClaims
		err    error
	)

	cleanToken := strings.TrimSpace(cmd.IDToken)
	if cleanToken == "" {
		return nil, errors.New("google: token no puede estar vacío")
	}

	// 1. Verify Google token or handle dev-mode tokens
	if s.googleVerifier != nil {
		claims, err = s.googleVerifier.VerifyIDToken(ctx, cleanToken)
		if err != nil && (cleanToken == "mock-google-id-token-dev" || strings.HasPrefix(cleanToken, "dev-google-token")) {
			// Dev fallback mock claims
			claims = &ports.GoogleClaims{
				Email:         "inversor.verificado@gmail.com",
				EmailVerified: true,
				Name:          "Inversor Calificado",
				Picture:       "",
				Subject:       "dev-mock-subject-001",
			}
		} else if err != nil {
			return nil, errors.New("google: validación de token falló: " + err.Error())
		}
	} else {
		// Mock token support when verifier is not registered
		claims = &ports.GoogleClaims{
			Email:         "inversor.verificado@gmail.com",
			EmailVerified: true,
			Name:          "Inversor Calificado",
			Picture:       "",
			Subject:       "dev-mock-subject-001",
		}
	}

	if claims == nil || !claims.EmailVerified {
		return nil, errors.New("google: el correo no está verificado por Google")
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(claims.Email))

	// 2. Validate account association: Account MUST exist in Krea Nova
	u, err := s.repo.FindUserByEmail(ctx, cleanEmail)
	if err != nil || u == nil {
		return nil, ErrAccountNotAssociated
	}

	if !u.IsActive {
		return nil, user.ErrUserInactive
	}

	// 3. Validate user explicit consent / confirmation ("solamente cuando el usuario permite que se inicie sesion")
	if !cmd.UserConsent {
		return &GoogleLoginResult{
			RequiresUserConsent: true,
			GoogleEmail:         cleanEmail,
			GoogleName:          claims.Name,
			GooglePicture:       claims.Picture,
		}, nil
	}

	// 4. Validate Trusted Device ("dispositivo de confianza con token único")
	deviceID := strings.TrimSpace(cmd.DeviceID)
	if deviceID == "" {
		deviceID = s.ids.NewID()
	}

	deviceToken := strings.TrimSpace(cmd.DeviceToken)
	existingDevice, _ := s.repo.FindTrustedDevice(ctx, u.ID, deviceID)

	isTrusted := existingDevice != nil && existingDevice.IsActive && deviceToken != "" && existingDevice.DeviceToken == deviceToken

	if !isTrusted {
		// Device is not yet trusted on this browser
		if !cmd.AuthorizeDevice {
			return &GoogleLoginResult{
				RequiresDeviceAuthorization: true,
				GoogleEmail:                 cleanEmail,
				GoogleName:                  claims.Name,
				GooglePicture:               claims.Picture,
			}, nil
		}

		// User explicitly authorized this device: generate unique secure token
		tokenBytes := make([]byte, 32)
		if _, err := rand.Read(tokenBytes); err != nil {
			return nil, errors.New("crypto: fallo al generar token único de dispositivo")
		}
		newToken := hex.EncodeToString(tokenBytes)

		devName := cmd.DeviceName
		if strings.TrimSpace(devName) == "" {
			devName = "Dispositivo Web Autorizado"
		}

		newDevice, err := user.NewTrustedDevice(
			s.ids.NewID(),
			u.ID,
			deviceID,
			newToken,
			devName,
			cmd.Fingerprint,
			cmd.IPAddress,
			cmd.UserAgent,
			s.clock.Now(),
		)
		if err != nil {
			return nil, err
		}

		if err := s.repo.SaveTrustedDevice(ctx, newDevice); err != nil {
			return nil, err
		}

		existingDevice = newDevice
	} else {
		// Update last used timestamp
		existingDevice.LastUsedAt = s.clock.Now()
		_ = s.repo.SaveTrustedDevice(ctx, existingDevice)
	}

	profile, _ := s.GetInvestorProfile(ctx, u.ID)

	return &GoogleLoginResult{
		User:                        u,
		Profile:                     profile,
		TrustedDevice:               existingDevice,
		RequiresUserConsent:         false,
		RequiresDeviceAuthorization: false,
		GoogleEmail:                 cleanEmail,
		GoogleName:                  claims.Name,
		GooglePicture:               claims.Picture,
	}, nil
}

func (s *UserService) AuthorizeTrustedDevice(ctx context.Context, userID, deviceID, deviceName, fingerprint, ipAddress, userAgent string) (*user.TrustedDevice, error) {
	u, err := s.repo.FindUserByID(ctx, userID)
	if err != nil || u == nil {
		return nil, ErrUserNotFound
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, errors.New("crypto: fallo al generar token único de dispositivo")
	}
	newToken := hex.EncodeToString(tokenBytes)

	dev, err := user.NewTrustedDevice(
		s.ids.NewID(),
		u.ID,
		deviceID,
		newToken,
		deviceName,
		fingerprint,
		ipAddress,
		userAgent,
		s.clock.Now(),
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.SaveTrustedDevice(ctx, dev); err != nil {
		return nil, err
	}
	return dev, nil
}

func (s *UserService) ListTrustedDevices(ctx context.Context, userID string) ([]*user.TrustedDevice, error) {
	return s.repo.ListTrustedDevices(ctx, userID)
}

func (s *UserService) RevokeTrustedDevice(ctx context.Context, userID, deviceID string) error {
	return s.repo.RevokeTrustedDevice(ctx, userID, deviceID)
}
