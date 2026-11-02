package services_test

import (
	"context"
	"testing"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/memory"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/crypto"
)

func TestUserService_RegisterAndPIIEncryption(t *testing.T) {
	ctx := context.Background()
	userRepo := memory.NewUserRepository()
	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	svc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)

	// 1. Register User with valid Gmail and valid Phone
	u, err := svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "investor.test@gmail.com",
		Phone:    "+5491112345678",
		Password: "SecurePassword123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err != nil {
		t.Fatalf("unexpected error registering user: %v", err)
	}
	if u.ID == "" {
		t.Errorf("expected non-empty user ID")
	}

	// 2. Save Investor Profile with sensitive PII
	rawDNI := "40123456"
	rawCUIL := "20-40123456-7"
	rawAddress := "Av. Corrientes 1234, CABA"

	profile, err := svc.SaveInvestorProfile(ctx, services.SaveInvestorProfileCommand{
		UserID:             u.ID,
		FullName:           "Carlos Perez",
		DNI:                rawDNI,
		CUIL:               rawCUIL,
		BirthDate:          "1990-05-15",
		Address:            rawAddress,
		City:               "Buenos Aires",
		Province:           "CABA",
		FundsOrigin:        "Salario",
		IsPEP:              false,
		IsObligatedSubject: false,
	})
	if err != nil {
		t.Fatalf("unexpected error saving profile: %v", err)
	}
	if profile.ID == "" {
		t.Errorf("expected generated profile ID")
	}

	// Verify in repository that raw PII is NOT stored in plain text
	rawStored, err := userRepo.FindInvestorProfileByUserID(ctx, u.ID)
	if err != nil || rawStored == nil {
		t.Fatalf("profile not found in repo")
	}
	if rawStored.DNIEncrypted == rawDNI {
		t.Errorf("DNI stored in plain text!")
	}
	if rawStored.CUILEncrypted == rawCUIL {
		t.Errorf("CUIL stored in plain text!")
	}
	if rawStored.AddressEncrypted == rawAddress {
		t.Errorf("Address stored in plain text!")
	}

	// 3. Retrieve decrypted profile for authorized service consumption
	decrypted, err := svc.GetInvestorProfile(ctx, u.ID)
	if err != nil {
		t.Fatalf("unexpected error getting profile: %v", err)
	}
	if decrypted.DNI != rawDNI {
		t.Errorf("expected decrypted DNI %s, got %s", rawDNI, decrypted.DNI)
	}
	if decrypted.CUIL != rawCUIL {
		t.Errorf("expected decrypted CUIL %s, got %s", rawCUIL, decrypted.CUIL)
	}
	if decrypted.Address != rawAddress {
		t.Errorf("expected decrypted address %s, got %s", rawAddress, decrypted.Address)
	}

	// 4. Update KYC Status
	if err := svc.UpdateKYCStatus(ctx, u.ID, user.KYCVerified); err != nil {
		t.Fatalf("failed to update KYC status: %v", err)
	}

	updated, _ := svc.GetInvestorProfile(ctx, u.ID)
	if updated.KYCStatus != user.KYCVerified {
		t.Errorf("expected KYC status %s, got %s", user.KYCVerified, updated.KYCStatus)
	}
}

func TestUserService_LegalConsent(t *testing.T) {
	ctx := context.Background()
	userRepo := memory.NewUserRepository()
	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	svc := services.NewUserService(userRepo, encryptor, hasher, memory.RandomID{}, memory.SystemClock{})

	err := svc.RecordConsent(ctx, services.RecordConsentCommand{
		UserID:          "usr-123",
		ConsentType:     user.ConsentTermsAndConditions,
		DocumentVersion: "v1.2",
		DocumentHash:    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		IPAddress:       "190.12.34.56",
	})
	if err != nil {
		t.Fatalf("failed to record consent: %v", err)
	}
}

func TestUserService_ValidationFailures(t *testing.T) {
	ctx := context.Background()
	userRepo := memory.NewUserRepository()
	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	svc := services.NewUserService(userRepo, encryptor, hasher, memory.RandomID{}, memory.SystemClock{})

	// 1. Invalid domain (not gmail)
	_, err := svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "test@outlook.com",
		Phone:    "+5491112345678",
		Password: "ValidPass123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err == nil {
		t.Errorf("expected error for non-gmail domain")
	}

	// 2. Invalid phone
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "validuser@gmail.com",
		Phone:    "123",
		Password: "ValidPass123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err == nil {
		t.Errorf("expected error for invalid phone number")
	}

	// 3. Weak password
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "validuser@gmail.com",
		Phone:    "+5491112345678",
		Password: "weak",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err == nil {
		t.Errorf("expected error for weak password")
	}
}

type mockGoogleVerifier struct {
	email string
	err   error
}

func (m *mockGoogleVerifier) VerifyIDToken(ctx context.Context, idToken string) (*ports.GoogleClaims, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &ports.GoogleClaims{
		Email:         m.email,
		EmailVerified: true,
		Subject:       "google-sub-123",
		Name:          "Carlos Perez",
	}, nil
}

func TestUserService_RegisterWithGoogleToken(t *testing.T) {
	ctx := context.Background()
	userRepo := memory.NewUserRepository()
	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	svc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)
	svc.SetGoogleVerifier(&mockGoogleVerifier{email: "googleuser@gmail.com"})

	// Success match
	u, err := svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:         "googleuser@gmail.com",
		Phone:         "+5491112345678",
		Password:      "SecurePassword123!",
		Role:          user.RoleInvestor,
		UserType:      user.UserTypeIndividual,
		GoogleIDToken: "valid-sample-token",
	})
	if err != nil {
		t.Fatalf("unexpected error registering user with valid token: %v", err)
	}
	if u.Email != "googleuser@gmail.com" {
		t.Errorf("expected email googleuser@gmail.com, got %s", u.Email)
	}

	// Mismatched email
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:         "otheruser@gmail.com",
		Phone:         "+5491112345678",
		Password:      "SecurePassword123!",
		Role:          user.RoleInvestor,
		UserType:      user.UserTypeIndividual,
		GoogleIDToken: "valid-sample-token",
	})
	if err == nil {
		t.Fatalf("expected error for mismatched token email")
	}
}

func TestUserService_LivenessSessionLifecycleAndSecurity(t *testing.T) {
	ctx := context.Background()
	userRepo := memory.NewUserRepository()
	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	svc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)

	// 1. Create session
	session, err := svc.CreateLivenessSession(ctx)
	if err != nil {
		t.Fatalf("failed to create liveness session: %v", err)
	}
	if session.ID == "" || session.VerificationToken == "" {
		t.Fatalf("session missing ID or verification token")
	}
	if session.Verified {
		t.Errorf("new session must not be verified initially")
	}

	// 2. Reject registration if livenessVerified is claimed without valid session
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:            "investor1@gmail.com",
		Phone:            "+5491112345678",
		Password:         "SecurePassword123!",
		Role:             user.RoleInvestor,
		UserType:         user.UserTypeIndividual,
		LivenessVerified: true, // No session provided!
	})
	if err == nil {
		t.Fatalf("expected error when claiming livenessVerified without session ID/token")
	}

	// 3. Reject verify with insufficient confidence
	_, err = svc.VerifyLivenessSession(ctx, session.ID, "hash-proof-123", 0.5)
	if err == nil {
		t.Fatalf("expected error for low confidence")
	}

	// 4. Verify session successfully
	verifiedSession, err := svc.VerifyLivenessSession(ctx, session.ID, "hash-proof-123", 0.95)
	if err != nil {
		t.Fatalf("unexpected error verifying session: %v", err)
	}
	if !verifiedSession.Verified {
		t.Fatalf("session must be marked verified")
	}

	// 5. Register user with valid session and token
	u, err := svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:             "investor1@gmail.com",
		Phone:             "+5491112345678",
		Password:          "SecurePassword123!",
		Role:              user.RoleInvestor,
		UserType:          user.UserTypeIndividual,
		LivenessSessionID: verifiedSession.ID,
		LivenessToken:     verifiedSession.VerificationToken,
		LivenessVerified:  true,
	})
	if err != nil {
		t.Fatalf("unexpected error registering with verified session: %v", err)
	}
	if u.Email != "investor1@gmail.com" {
		t.Errorf("expected email investor1@gmail.com, got %s", u.Email)
	}

	// 6. Anti-replay attack: Reusing consumed session must fail
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:             "investor2@gmail.com",
		Phone:             "+5491112345679",
		Password:          "SecurePassword123!",
		Role:              user.RoleInvestor,
		UserType:          user.UserTypeIndividual,
		LivenessSessionID: verifiedSession.ID,
		LivenessToken:     verifiedSession.VerificationToken,
		LivenessVerified:  true,
	})
	if err == nil {
		t.Fatalf("expected error when attempting replay of consumed liveness session")
	}
}

func TestUserService_CheckAvailabilityAndUniquenessConstraints(t *testing.T) {
	ctx := context.Background()
	userRepo := memory.NewUserRepository()
	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	svc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)

	// 1. Initial check - all available
	avail, err := svc.CheckAvailability(ctx, "inversor.demo@gmail.com", "+5491133334444", "38999111")
	if err != nil {
		t.Fatalf("unexpected error checking availability: %v", err)
	}
	if !avail.Available || avail.EmailExists || avail.PhoneExists || avail.DNIExists {
		t.Fatalf("expected all available, got %+v", avail)
	}

	// 2. Register first user with email, phone and DNI
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "inversor.demo@gmail.com",
		Phone:    "+5491133334444",
		DNI:      "38999111",
		Password: "Password123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err != nil {
		t.Fatalf("unexpected error registering user: %v", err)
	}

	// 3. Check availability when already taken
	checkEmail, _ := svc.CheckAvailability(ctx, "inversor.demo@gmail.com", "", "")
	if checkEmail.Available || !checkEmail.EmailExists {
		t.Fatalf("expected email taken, got %+v", checkEmail)
	}

	checkPhone, _ := svc.CheckAvailability(ctx, "", "11 3333-4444", "")
	if checkPhone.Available || !checkPhone.PhoneExists {
		t.Fatalf("expected phone taken, got %+v", checkPhone)
	}

	checkDNI, _ := svc.CheckAvailability(ctx, "", "", "38.999.111")
	if checkDNI.Available || !checkDNI.DNIExists {
		t.Fatalf("expected DNI taken, got %+v", checkDNI)
	}

	// 4. Try duplicate registration - must fail with appropriate errors
	// Duplicate email
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "inversor.demo@gmail.com",
		Phone:    "+5491188889999",
		DNI:      "37000111",
		Password: "Password123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err != services.ErrEmailAlreadyRegistered {
		t.Fatalf("expected ErrEmailAlreadyRegistered, got %v", err)
	}

	// Duplicate phone
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "otro.inversor@gmail.com",
		Phone:    "+5491133334444",
		DNI:      "37000111",
		Password: "Password123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err != services.ErrPhoneAlreadyRegistered {
		t.Fatalf("expected ErrPhoneAlreadyRegistered, got %v", err)
	}

	// Duplicate DNI
	_, err = svc.RegisterUser(ctx, services.RegisterUserCommand{
		Email:    "otro.inversor@gmail.com",
		Phone:    "+5491188889999",
		DNI:      "38999111",
		Password: "Password123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err != services.ErrDNIAlreadyRegistered {
		t.Fatalf("expected ErrDNIAlreadyRegistered, got %v", err)
	}
}

// Ensure interface compliance
var _ = time.Now
