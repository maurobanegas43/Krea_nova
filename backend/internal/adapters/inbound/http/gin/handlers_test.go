package gin_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	httpgin "github.com/maurobanegas43/proyecto_final/backend/internal/adapters/inbound/http/gin"
	"github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/memory"
	outboundPay "github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/payment"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/crypto"
)

func setupTestRouter() (*gin.Engine, *services.UserService, *services.FundService, *services.ProjectService) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	userRepo := memory.NewUserRepository()
	projectRepo := memory.NewProjectRepository()
	fundRepo := memory.NewFundRepository()
	marketRepo := memory.NewMarketRepository()
	paymentRepo := memory.NewPaymentRepository()

	userSvc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)
	fundSvc := services.NewFundService(fundRepo, projectRepo, userRepo, idGen, clock)
	projectSvc := services.NewProjectService(projectRepo, idGen, clock)
	marketSvc := services.NewMarketService(marketRepo, projectRepo, userRepo, fundRepo, idGen, clock)
	_ = userSvc
	_ = fundSvc
	_ = projectSvc
	paymentSvc := services.NewPaymentService(paymentRepo, fundRepo, userRepo, idGen, clock)
	paymentSvc.RegisterGateway(outboundPay.NewSimulatedGateway())

	v1 := r.Group("/api/v1")
	userH := httpgin.NewUserHandler(userSvc)
	userH.Register(v1)
	userH.RegisterAuthRoutes(v1)
	httpgin.NewFundHandler(fundSvc).Register(v1)
	httpgin.NewProjectHandler(projectSvc).Register(v1)
	httpgin.NewMarketHandler(marketSvc).Register(v1)
	httpgin.NewPaymentHandler(paymentSvc).Register(v1)

	return r, userSvc, fundSvc, projectSvc
}

func TestUserAndFundEndpoints_E2E(t *testing.T) {
	r, _, _, projectSvc := setupTestRouter()

	// 1. Test POST /api/v1/users/register
	regPayload := map[string]interface{}{
		"email":    "investor.test@gmail.com",
		"phone":    "+54 9 11 1234-5678",
		"password": "Password1234!",
		"role":     "investor",
		"userType": "individual",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on register, got %d: %s", w.Code, w.Body.String())
	}

	var regResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &regResp)
	userID := regResp["id"].(string)

	// 2. Test POST /api/v1/users/:id/investor-profile (encrypting PII)
	profPayload := map[string]interface{}{
		"fullName":           "Mariano Lopez",
		"dni":                "35123456",
		"cuil":               "20-35123456-9",
		"birthDate":          "1988-10-20",
		"address":            "Av. Libertador 4500",
		"city":               "Buenos Aires",
		"province":           "CABA",
		"fundsOrigin":        "Ahorros bancarios",
		"isPep":              false,
		"isObligatedSubject": false,
	}
	body, _ = json.Marshal(profPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/"+userID+"/investor-profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on save profile, got %d: %s", w.Code, w.Body.String())
	}

	// 3. Test GET /api/v1/users/:id/investor-profile (decrypted verification)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/users/"+userID+"/investor-profile", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get profile, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Create and publish a project
	proj, _ := projectSvc.CreateProject(req.Context(), services.CreateProjectCommand{
		DeveloperID: "dev-01",
		Name:        "Residencias Krea",
		Location:    "Palermo, CABA",
		Description: "Edificio premium",
		FundingGoal: 100000000,
	})
	_, _ = projectSvc.SubmitForReview(req.Context(), proj.ID)
	_, _ = projectSvc.ApproveProject(req.Context(), proj.ID)
	proj.Status = project.StatusPublished // Set published

	// 5. Attempt investment when KYC is pending -> expect 403 Forbidden
	invPayload := map[string]interface{}{
		"projectId":   proj.ID,
		"investorId":  userID,
		"amountCents": 500000,
	}
	body, _ = json.Marshal(invPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/funds/investments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when KYC pending, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Verify KYC via endpoint POST /api/v1/users/:id/kyc
	kycPayload := map[string]interface{}{"status": "verified"}
	body, _ = json.Marshal(kycPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/"+userID+"/kyc", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update KYC, got %d: %s", w.Code, w.Body.String())
	}

	// 7. Re-attempt investment -> expect 201 Created
	body, _ = json.Marshal(invPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/funds/investments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on investment after KYC verified, got %d: %s", w.Code, w.Body.String())
	}

	// 8. Test GET /api/v1/funds/users/:id/balance
	req = httptest.NewRequest(http.MethodGet, "/api/v1/funds/users/"+userID+"/balance", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on user balance, got %d: %s", w.Code, w.Body.String())
	}
}

type mockAuthGoogleVerifier struct{}

func (m *mockAuthGoogleVerifier) VerifyIDToken(ctx context.Context, idToken string) (*ports.GoogleClaims, error) {
	if idToken == "valid-token" {
		return &ports.GoogleClaims{
			Email:         "verified.investor@gmail.com",
			EmailVerified: true,
			Subject:       "sub-12345",
			Name:          "Verified Investor",
		}, nil
	}
	return nil, errors.New("invalid token")
}

func TestGoogleAuthEndpoint(t *testing.T) {
	r, userSvc, _, _ := setupTestRouter()
	userSvc.SetGoogleVerifier(&mockAuthGoogleVerifier{})

	// 1. Invalid payload
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/verify", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", w.Code)
	}

	// 2. Invalid token
	payload, _ := json.Marshal(map[string]string{"idToken": "bad-token"})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/verify", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", w.Code)
	}

	// 3. Valid token
	payload, _ = json.Marshal(map[string]string{"idToken": "valid-token"})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/verify", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var res map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["email"] != "verified.investor@gmail.com" {
		t.Errorf("expected email verified.investor@gmail.com, got %v", res["email"])
	}
}

func TestGoogleLogin_AssociationAndTrustedDeviceFlow(t *testing.T) {
	r, userSvc, _, _ := setupTestRouter()
	userSvc.SetGoogleVerifier(&mockAuthGoogleVerifier{})

	// Case 1: Account not associated/registered -> Must return 404 with ACCOUNT_NOT_ASSOCIATED
	loginPayload := map[string]interface{}{
		"idToken":  "valid-token",
		"deviceId": "dev-client-123",
	}
	body, _ := json.Marshal(loginPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found for unassociated account, got %d: %s", w.Code, w.Body.String())
	}
	var notFoundResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &notFoundResp)
	if notFoundResp["code"] != "ACCOUNT_NOT_ASSOCIATED" {
		t.Fatalf("expected code ACCOUNT_NOT_ASSOCIATED, got %v", notFoundResp["code"])
	}

	// Register the user first so account is associated
	regPayload := map[string]interface{}{
		"email":    "verified.investor@gmail.com",
		"phone":    "+54 9 11 9876-5432",
		"password": "Password1234!",
		"role":     "investor",
		"userType": "individual",
	}
	body, _ = json.Marshal(regPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on user register: %s", w.Body.String())
	}

	// Case 2: User consent NOT provided yet -> Must require consent
	loginPayload = map[string]interface{}{
		"idToken":     "valid-token",
		"deviceId":    "dev-client-123",
		"userConsent": false,
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK with challenge, got %d: %s", w.Code, w.Body.String())
	}
	var consentResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &consentResp)
	if consentResp["requiresUserConsent"] != true {
		t.Fatalf("expected requiresUserConsent: true, got %v", consentResp)
	}

	// Case 3: User consent provided, but untrusted device and authorizeDevice=false -> Must require device authorization
	loginPayload = map[string]interface{}{
		"idToken":         "valid-token",
		"deviceId":        "dev-client-123",
		"userConsent":     true,
		"authorizeDevice": false,
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK with device challenge, got %d: %s", w.Code, w.Body.String())
	}
	var deviceChallengeResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &deviceChallengeResp)
	if deviceChallengeResp["requiresDeviceAuthorization"] != true {
		t.Fatalf("expected requiresDeviceAuthorization: true, got %v", deviceChallengeResp)
	}

	// Case 4: User consent provided AND authorizeDevice=true -> Must succeed and issue trusted deviceToken
	loginPayload = map[string]interface{}{
		"idToken":         "valid-token",
		"deviceId":        "dev-client-123",
		"deviceName":      "Chrome en macOS",
		"fingerprint":     "mock-fingerprint-sha256",
		"userConsent":     true,
		"authorizeDevice": true,
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on authorized device login, got %d: %s", w.Code, w.Body.String())
	}
	var successResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &successResp)
	if successResp["email"] != "verified.investor@gmail.com" {
		t.Fatalf("expected email verified.investor@gmail.com, got %v", successResp["email"])
	}
	trustedDevice, ok := successResp["trustedDevice"].(map[string]interface{})
	if !ok || trustedDevice["deviceToken"] == "" {
		t.Fatalf("expected trustedDevice with non-empty deviceToken, got %v", successResp["trustedDevice"])
	}
	savedToken := trustedDevice["deviceToken"].(string)

	// Case 5: Subsequent login with saved deviceToken -> Succeeds directly without device authorization challenge
	loginPayload = map[string]interface{}{
		"idToken":         "valid-token",
		"deviceId":        "dev-client-123",
		"deviceToken":     savedToken,
		"userConsent":     true,
		"authorizeDevice": false, // Doesn't need re-authorization
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on recognized trusted device login, got %d: %s", w.Code, w.Body.String())
	}
	var recognizedResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &recognizedResp)
	if recognizedResp["requiresDeviceAuthorization"] == true {
		t.Fatalf("device should be trusted, but received requiresDeviceAuthorization")
	}
}

func TestLivenessEndpoints_Flow(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// 1. Create liveness session: POST /api/v1/auth/liveness/session
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/liveness/session", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on liveness session creation, got %d: %s", w.Code, w.Body.String())
	}

	var sessionResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &sessionResp)
	sessionID, ok := sessionResp["sessionId"].(string)
	if !ok || sessionID == "" {
		t.Fatalf("missing sessionId in response")
	}

	// 2. Query status: GET /api/v1/auth/liveness/session/:id
	req = httptest.NewRequest(http.MethodGet, "/api/v1/auth/liveness/session/"+sessionID, nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get liveness session, got %d", w.Code)
	}

	// 3. Verify session with proof: POST /api/v1/auth/liveness/verify
	verifyPayload, _ := json.Marshal(map[string]interface{}{
		"sessionId":  sessionID,
		"proofHash":  "facex-proof-abc123xyz",
		"confidence": 0.98,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/liveness/verify", bytes.NewReader(verifyPayload))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on verify liveness, got %d: %s", w.Code, w.Body.String())
	}

	var verifyResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &verifyResp)
	token, ok := verifyResp["verificationToken"].(string)
	if !ok || token == "" {
		t.Fatalf("expected verificationToken in response")
	}

	// 4. Register investor using verified liveness session
	regPayload := map[string]interface{}{
		"email":             "investor.liveness@gmail.com",
		"phone":             "+54 9 11 1234-5678",
		"password":          "Password1234!",
		"role":              "investor",
		"userType":          "individual",
		"livenessSessionId": sessionID,
		"livenessToken":     token,
		"livenessVerified":  true,
	}
	body, _ := json.Marshal(regPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on registration with liveness token, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLoginHandler(t *testing.T) {
	r, userSvc, _, _ := setupTestRouter()

	// 1. Create a user first
	_, err := userSvc.RegisterUser(context.Background(), services.RegisterUserCommand{
		Email:    "login.test@gmail.com",
		Phone:    "+54 9 11 5555-1234",
		Password: "Password123!",
		Role:     user.RoleInvestor,
		UserType: user.UserTypeIndividual,
	})
	if err != nil {
		t.Fatalf("failed to seed test user: %v", err)
	}

	// 2. Successful login
	loginPayload := map[string]string{
		"email":    "login.test@gmail.com",
		"password": "Password123!",
	}
	body, _ := json.Marshal(loginPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on valid login, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["email"] != "login.test@gmail.com" {
		t.Errorf("expected email login.test@gmail.com, got %v", res["email"])
	}

	// 3. Failed login with wrong password
	badPayload := map[string]string{
		"email":    "login.test@gmail.com",
		"password": "WrongPassword123!",
	}
	badBody, _ := json.Marshal(badPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(badBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized on wrong password, got %d", w.Code)
	}
}

func TestMarketEndpoints_E2E(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	key := []byte("12345678901234567890123456789012")
	encryptor, _ := crypto.NewAESGCMEncryptor(key)
	hasher := crypto.NewBcryptHasher(10)
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	userRepo := memory.NewUserRepository()
	projectRepo := memory.NewProjectRepository()
	fundRepo := memory.NewFundRepository()
	marketRepo := memory.NewMarketRepository()

	userSvc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)
	fundSvc := services.NewFundService(fundRepo, projectRepo, userRepo, idGen, clock)
	projectSvc := services.NewProjectService(projectRepo, idGen, clock)
	marketSvc := services.NewMarketService(marketRepo, projectRepo, userRepo, fundRepo, idGen, clock)
	_ = userSvc
	_ = fundSvc
	_ = projectSvc

	v1 := r.Group("/api/v1")
	httpgin.NewMarketHandler(marketSvc).Register(v1)

	ctx := context.Background()
	now := time.Now()

	// Setup users
	seller, _ := user.NewUser("usr-seller", "seller@market.com", "+5411111", "hash", user.RoleInvestor, user.UserTypeIndividual, now)
	_ = userRepo.SaveUser(ctx, seller)
	_ = userRepo.SaveInvestorProfile(ctx, &user.InvestorProfile{
		ID:        "prof-seller",
		UserID:    seller.ID,
		KYCStatus: user.KYCVerified,
	})

	buyer, _ := user.NewUser("usr-buyer", "buyer@market.com", "+5422222", "hash", user.RoleInvestor, user.UserTypeIndividual, now)
	_ = userRepo.SaveUser(ctx, buyer)
	_ = userRepo.SaveInvestorProfile(ctx, &user.InvestorProfile{
		ID:        "prof-buyer",
		UserID:    buyer.ID,
		KYCStatus: user.KYCVerified,
	})

	// Setup published project
	proj, _ := project.New("proj-market-1", "dev-1", "Torre Market", "CABA", "Desc", 10000000, now)
	_ = proj.TransitionTo(project.StatusUnderReview, now)
	_ = proj.TransitionTo(project.StatusApproved, now)
	_ = proj.TransitionTo(project.StatusPublished, now)
	_ = projectRepo.Save(ctx, proj)

	// Seller owns 30 tokens ($3,000)
	inv, _ := fund.NewInvestment("inv-seller", proj.ID, seller.ID, 300000, now)
	inv.Status = fund.InvestmentActive
	_ = fundRepo.SaveInvestment(ctx, inv)

	// 1. GET /api/v1/market/orders initially empty
	req := httptest.NewRequest(http.MethodGet, "/api/v1/market/orders", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	// 2. POST /api/v1/market/orders (Sell 10 tokens at $105)
	orderPayload := map[string]interface{}{
		"projectId":          proj.ID,
		"userId":             seller.ID,
		"orderType":          "sell",
		"tokenCount":         10,
		"pricePerTokenCents": 10500,
	}
	body, _ := json.Marshal(orderPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/market/orders", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on order create, got %d: %s", w.Code, w.Body.String())
	}

	var createResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &createResp)
	orderData := createResp["data"].(map[string]interface{})
	orderID := orderData["id"].(string)

	// 3. Buyer executes trade taking 5 tokens
	execPayload := map[string]interface{}{
		"takerUserId": buyer.ID,
		"tokenCount":  5,
	}
	execBody, _ := json.Marshal(execPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/market/orders/"+orderID+"/execute", bytes.NewReader(execBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on trade execute, got %d: %s", w.Code, w.Body.String())
	}

	// 4. GET /api/v1/market/users/:id/holdings for buyer
	req = httptest.NewRequest(http.MethodGet, "/api/v1/market/users/"+buyer.ID+"/holdings", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on user holdings, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPaymentGateway_DepositAndAssetPurchase(t *testing.T) {
	r, _, _, projectSvc := setupTestRouter()
	ctx := context.Background()

	// 1. Create investor with verified KYC via HTTP
	regPayload := map[string]interface{}{
		"email":    "investor.gateway@gmail.com",
		"phone":    "+54 9 11 9988-7766",
		"password": "Password123!",
		"role":     "investor",
		"userType": "individual",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 on register: %s", w.Body.String())
	}

	var regResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &regResp)
	userID := regResp["id"].(string)

	// Create investor profile
	profPayload := map[string]interface{}{
		"fullName":           "Test Investor Gateway",
		"dni":                "35999888",
		"cuil":               "20-35999888-9",
		"birthDate":          "1990-01-01",
		"address":            "Av. Corrientes 1234",
		"city":               "Buenos Aires",
		"province":           "CABA",
		"fundsOrigin":        "Ahorros",
		"isPep":              false,
		"isObligatedSubject": false,
	}
	body, _ = json.Marshal(profPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/"+userID+"/investor-profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on profile save: %s", w.Body.String())
	}

	// Verify KYC
	kycPayload := map[string]interface{}{"status": "verified"}
	body, _ = json.Marshal(kycPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/"+userID+"/kyc", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on kyc update: %s", w.Body.String())
	}

	// 2. Create and publish a project (asset)
	proj, _ := projectSvc.CreateProject(ctx, services.CreateProjectCommand{
		DeveloperID: "dev-01",
		Name:        "Torre Pagos Gateway",
		Location:    "Puerto Madero, CABA",
		Description: "Desarrollo residencial premium",
		FundingGoal: 50000000,
	})
	_, _ = projectSvc.SubmitForReview(ctx, proj.ID)
	_, _ = projectSvc.ApproveProject(ctx, proj.ID)
	proj.Status = project.StatusPublished

	// 3. Attempt to buy assets with validateBalance=true before deposit -> MUST FAIL (Insufficient funds)
	buyPayload := map[string]interface{}{
		"projectId":       proj.ID,
		"investorId":      userID,
		"amountCents":     200000, // $2,000 USD
		"validateBalance": true,
	}
	body, _ = json.Marshal(buyPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/funds/investments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request on investment without balance, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Create deposit intent via Payment Gateway
	depPayload := map[string]interface{}{
		"userId":      userID,
		"amountCents": 500000, // $5,000 USD
		"currency":    "USD",
		"provider":    "simulated",
		"description": "Depósito para compra de activos en Krea Nova",
	}
	body, _ = json.Marshal(depPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/payments/deposits", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on payment deposit intent, got %d: %s", w.Code, w.Body.String())
	}

	var depResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &depResp)
	paymentID := depResp["id"].(string)
	externalID := depResp["externalId"].(string)
	checkoutURL := depResp["checkoutUrl"].(string)

	if paymentID == "" || checkoutURL == "" {
		t.Fatalf("expected payment ID and checkout URL in response, got %v", depResp)
	}

	// 5. Confirm deposit via provider webhook
	webhookBody := []byte(`{"externalId":"` + externalID + `","status":"approved"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/payments/webhook/simulated", bytes.NewReader(webhookBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on deposit webhook confirmation, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Check user's cuenta comitente balance -> must be 500000 ($5,000 USD)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/funds/users/"+userID+"/balance", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on user balance, got %d: %s", w.Code, w.Body.String())
	}
	var balResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &balResp)
	if balResp["balanceCents"].(float64) != 500000 {
		t.Fatalf("expected 500000 cents in cuenta comitente, got %v", balResp["balanceCents"])
	}

	// 7. Now purchase asset with validateBalance=true -> MUST SUCCEED
	body, _ = json.Marshal(buyPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/funds/investments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on investment after deposit, got %d: %s", w.Code, w.Body.String())
	}

	// 8. Check remaining balance in cuenta comitente -> must be 500000 - 200000 = 300000
	req = httptest.NewRequest(http.MethodGet, "/api/v1/funds/users/"+userID+"/balance", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	_ = json.Unmarshal(w.Body.Bytes(), &balResp)
	if balResp["balanceCents"].(float64) != 300000 {
		t.Fatalf("expected remaining balance of 300000 cents, got %v", balResp["balanceCents"])
	}

	// 9. Check deposit history
	req = httptest.NewRequest(http.MethodGet, "/api/v1/payments/users/"+userID+"/deposits", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on user deposits list, got %d: %s", w.Code, w.Body.String())
	}
	var listResp []map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &listResp)
	if len(listResp) != 1 || listResp[0]["status"] != "approved" {
		t.Fatalf("expected 1 approved deposit in history, got %v", listResp)
	}
}

func TestCheckAvailabilityAndRegisterConflicts(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// 1. Initial check: should be available
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/check?email=test.investor@gmail.com&phone=+5491122223333&dni=39111222", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on check availability, got %d: %s", w.Code, w.Body.String())
	}
	var avail map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &avail)
	if avail["available"] != true {
		t.Fatalf("expected available = true, got %v", avail)
	}

	// 2. Register user with email, phone, and DNI
	regBody, _ := json.Marshal(map[string]interface{}{
		"email":    "test.investor@gmail.com",
		"phone":    "+5491122223333",
		"dni":      "39111222",
		"password": "Password2026!",
		"role":     "investor",
		"userType": "individual",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(regBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on register, got %d: %s", w.Code, w.Body.String())
	}

	// 3. Check endpoint again: must indicate unavailable with specific flags
	req = httptest.NewRequest(http.MethodGet, "/api/v1/users/check?email=test.investor@gmail.com", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	_ = json.Unmarshal(w.Body.Bytes(), &avail)
	if avail["available"] != false || avail["emailExists"] != true {
		t.Fatalf("expected emailExists = true and available = false, got %v", avail)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/v1/users/check?phone=+5491122223333", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	_ = json.Unmarshal(w.Body.Bytes(), &avail)
	if avail["available"] != false || avail["phoneExists"] != true {
		t.Fatalf("expected phoneExists = true and available = false, got %v", avail)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/v1/users/check?dni=39111222", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	_ = json.Unmarshal(w.Body.Bytes(), &avail)
	if avail["available"] != false || avail["dniExists"] != true {
		t.Fatalf("expected dniExists = true and available = false, got %v", avail)
	}

	// 4. Duplicate registration attempts must return 409 Conflict with clear messages
	// Duplicate email:
	dupEmail, _ := json.Marshal(map[string]interface{}{
		"email":    "test.investor@gmail.com",
		"phone":    "+5491199998888",
		"dni":      "40111222",
		"password": "Password2026!",
		"role":     "investor",
		"userType": "individual",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(dupEmail))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict on duplicate email, got %d: %s", w.Code, w.Body.String())
	}

	// Duplicate phone:
	dupPhone, _ := json.Marshal(map[string]interface{}{
		"email":    "other.investor@gmail.com",
		"phone":    "+5491122223333",
		"dni":      "40111222",
		"password": "Password2026!",
		"role":     "investor",
		"userType": "individual",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(dupPhone))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict on duplicate phone, got %d: %s", w.Code, w.Body.String())
	}

	// Duplicate DNI:
	dupDNI, _ := json.Marshal(map[string]interface{}{
		"email":    "other.investor@gmail.com",
		"phone":    "+5491199998888",
		"dni":      "39111222",
		"password": "Password2026!",
		"role":     "investor",
		"userType": "individual",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/users/register", bytes.NewReader(dupDNI))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict on duplicate DNI, got %d: %s", w.Code, w.Body.String())
	}
}


