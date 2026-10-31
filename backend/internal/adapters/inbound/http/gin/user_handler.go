package gin

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type authUserResponse struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	UserType      string `json:"userType"`
	Name          string `json:"name"`
	TaxId         string `json:"taxId,omitempty"`
	KYCStatus     string `json:"kycStatus"`
	IsKYCVerified bool   `json:"isKycVerified"`
}

type registerRequest struct {
	Email             string `json:"email" binding:"required,email"`
	Phone             string `json:"phone" binding:"required"`
	Password          string `json:"password" binding:"required,min=8,max=72"`
	Role              string `json:"role" binding:"required,oneof=investor developer admin"`
	UserType          string `json:"userType" binding:"required,oneof=individual corporate"`
	GoogleIDToken     string `json:"googleIdToken"`
	LivenessSessionID string `json:"livenessSessionId"`
	LivenessToken     string `json:"livenessToken"`
	LivenessVerified  bool   `json:"livenessVerified"`
}

type verifyGoogleRequest struct {
	IDToken string `json:"idToken" binding:"required"`
}

type googleLoginRequest struct {
	IDToken         string `json:"idToken" binding:"required"`
	DeviceID        string `json:"deviceId"`
	DeviceToken     string `json:"deviceToken"`
	DeviceName      string `json:"deviceName"`
	Fingerprint     string `json:"fingerprint"`
	UserConsent     bool   `json:"userConsent"`
	AuthorizeDevice bool   `json:"authorizeDevice"`
}

type authorizeDeviceRequest struct {
	UserID      string `json:"userId" binding:"required"`
	DeviceID    string `json:"deviceId" binding:"required"`
	DeviceName  string `json:"deviceName"`
	Fingerprint string `json:"fingerprint"`
}

type verifyLivenessRequest struct {
	SessionID  string  `json:"sessionId" binding:"required"`
	ProofHash  string  `json:"proofHash" binding:"required"`
	Confidence float64 `json:"confidence" binding:"required"`
}

type investorProfileRequest struct {
	FullName                 string `json:"fullName" binding:"required"`
	DNI                      string `json:"dni" binding:"required"`         // Sensitive PII
	CUIL                     string `json:"cuil" binding:"required"`        // Sensitive PII
	BirthDate                string `json:"birthDate" binding:"required"`
	Address                  string `json:"address" binding:"required"`     // Sensitive PII
	City                     string `json:"city" binding:"required"`
	Province                 string `json:"province" binding:"required"`
	FundsOrigin              string `json:"fundsOrigin" binding:"required"`
	IsPEP                    bool   `json:"isPep"`
	IsObligatedSubject       bool   `json:"isObligatedSubject"`
	Phone                    string `json:"phone"`
	PayoutCurrency           string `json:"payoutCurrency"`
	BankCbuOrAlias           string `json:"bankCbuOrAlias"`
	BankName                 string `json:"bankName"`
	Web3WalletAddress        string `json:"web3WalletAddress"`
	AutoReinvestYield        bool   `json:"autoReinvestYield"`
	TwoFactorEnabled         bool   `json:"twoFactorEnabled"`
	NotifyConstructionAlerts bool   `json:"notifyConstructionAlerts"`
	NotifyAuditReports       bool   `json:"notifyAuditReports"`
	NotifyEarlyAccess        bool   `json:"notifyEarlyAccess"`
}

type updateKYCRequest struct {
	Status string `json:"status" binding:"required"`
}

type consentRequest struct {
	ConsentType     string `json:"consentType" binding:"required"`
	DocumentVersion string `json:"documentVersion" binding:"required"`
	DocumentHash    string `json:"documentHash" binding:"required"`
}

type UserHandler struct {
	svc *services.UserService
}

func NewUserHandler(svc *services.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

func (h *UserHandler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/users")
	g.POST("/register", h.register)
	g.POST("/:id/investor-profile", h.saveInvestorProfile)
	g.GET("/:id/investor-profile", h.getInvestorProfile)
	g.POST("/:id/kyc", h.updateKYC)
	g.POST("/:id/consents", h.recordConsent)
}

func (h *UserHandler) RegisterAuthRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/auth")
	g.POST("/login", h.login)
	g.POST("/verify-password", h.verifyPassword)
	g.POST("/google/verify", h.verifyGoogleToken)
	g.POST("/google/login", h.googleLogin)
	g.POST("/devices/trust", h.authorizeDevice)
	g.GET("/devices/:userId", h.listDevices)
	g.DELETE("/devices/:userId/:deviceId", h.revokeDevice)
	g.POST("/liveness/session", h.createLivenessSession)
	g.POST("/liveness/verify", h.verifyLiveness)
	g.GET("/liveness/session/:id", h.getLivenessSession)
}

func (h *UserHandler) verifyPassword(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: "Email y contraseña requeridos"})
		return
	}

	_, _, err := h.svc.AuthenticateUser(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errorResponse{Code: "INVALID_PASSWORD", Message: "Contraseña incorrecta"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true, "message": "Contraseña verificada con éxito"})
}

func (h *UserHandler) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: "Email y contraseña requeridos"})
		return
	}

	u, profile, err := h.svc.AuthenticateUser(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errorResponse{Code: "INVALID_CREDENTIALS", Message: "Email o contraseña incorrectos"})
		return
	}

	name := u.Email
	taxID := ""
	kycStatus := "verified"
	isVerified := true

	if profile != nil {
		name = profile.FullName
		taxID = profile.CUIL
		kycStatus = string(profile.KYCStatus)
		isVerified = profile.KYCStatus == user.KYCVerified
	}

	c.JSON(http.StatusOK, authUserResponse{
		ID:            u.ID,
		Email:         u.Email,
		Role:          string(u.Role),
		UserType:      string(u.UserType),
		Name:          name,
		TaxId:         taxID,
		KYCStatus:     kycStatus,
		IsKYCVerified: isVerified,
	})
}

func (h *UserHandler) createLivenessSession(c *gin.Context) {
	session, err := h.svc.CreateLivenessSession(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "LIVENESS_SESSION_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"sessionId": session.ID,
		"expiresAt": session.ExpiresAt.Format(time.RFC3339),
	})
}

func (h *UserHandler) verifyLiveness(c *gin.Context) {
	var req verifyLivenessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	session, err := h.svc.VerifyLivenessSession(c.Request.Context(), req.SessionID, req.ProofHash, req.Confidence)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, services.ErrLivenessSessionNotFound) {
			status = http.StatusNotFound
		} else if errors.Is(err, services.ErrLivenessSessionExpired) || errors.Is(err, services.ErrLivenessSessionConsumed) {
			status = http.StatusGone
		}
		c.JSON(status, errorResponse{Code: "LIVENESS_VERIFICATION_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"verified":          session.Verified,
		"sessionId":         session.ID,
		"verificationToken": session.VerificationToken,
		"verifiedAt":        session.VerifiedAt.Format(time.RFC3339),
	})
}

func (h *UserHandler) getLivenessSession(c *gin.Context) {
	sessionID := c.Param("id")
	session, err := h.svc.GetLivenessSession(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Code: "SESSION_NOT_FOUND", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessionId": session.ID,
		"verified":  session.Verified,
		"expiresAt": session.ExpiresAt.Format(time.RFC3339),
		"consumed":  session.Consumed,
	})
}

func (h *UserHandler) verifyGoogleToken(c *gin.Context) {
	var req verifyGoogleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	claims, err := h.svc.VerifyGoogleIDToken(c.Request.Context(), req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errorResponse{Code: "GOOGLE_TOKEN_INVALID", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"email":         claims.Email,
		"emailVerified": claims.EmailVerified,
		"name":          claims.Name,
		"picture":       claims.Picture,
		"subject":       claims.Subject,
	})
}

func (h *UserHandler) register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("registration JSON bind error: %v", err)
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	u, err := h.svc.RegisterUser(c.Request.Context(), services.RegisterUserCommand{
		Email:             req.Email,
		Phone:             req.Phone,
		Password:          req.Password,
		Role:              user.Role(req.Role),
		UserType:          user.UserType(req.UserType),
		GoogleIDToken:     req.GoogleIDToken,
		LivenessSessionID: req.LivenessSessionID,
		LivenessToken:     req.LivenessToken,
		LivenessVerified:  req.LivenessVerified,
	})
	if err != nil {
		log.Printf("RegisterUser error: %v (email: %s, role: %s, livenessSessionID: %s)", err, req.Email, req.Role, req.LivenessSessionID)
		if errors.Is(err, services.ErrUserAlreadyExists) {
			c.JSON(http.StatusConflict, errorResponse{Code: "USER_ALREADY_EXISTS", Message: "El correo electrónico ya se encuentra registrado."})
			return
		}
		c.JSON(http.StatusBadRequest, errorResponse{Code: "REGISTRATION_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        u.ID,
		"email":     u.Email,
		"phone":     u.Phone,
		"role":      u.Role,
		"userType":  u.UserType,
		"isActive":  u.IsActive,
		"createdAt": u.CreatedAt,
	})
}

func (h *UserHandler) saveInvestorProfile(c *gin.Context) {
	userID := c.Param("id")
	var req investorProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	profile, err := h.svc.SaveInvestorProfile(c.Request.Context(), services.SaveInvestorProfileCommand{
		UserID:                   userID,
		FullName:                 req.FullName,
		DNI:                      req.DNI,
		CUIL:                     req.CUIL,
		BirthDate:                req.BirthDate,
		Address:                  req.Address,
		City:                     req.City,
		Province:                 req.Province,
		FundsOrigin:              req.FundsOrigin,
		IsPEP:                    req.IsPEP,
		IsObligatedSubject:       req.IsObligatedSubject,
		Phone:                    req.Phone,
		PayoutCurrency:           req.PayoutCurrency,
		BankCbuOrAlias:           req.BankCbuOrAlias,
		BankName:                 req.BankName,
		Web3WalletAddress:        req.Web3WalletAddress,
		AutoReinvestYield:        req.AutoReinvestYield,
		TwoFactorEnabled:         req.TwoFactorEnabled,
		NotifyConstructionAlerts: req.NotifyConstructionAlerts,
		NotifyAuditReports:       req.NotifyAuditReports,
		NotifyEarlyAccess:        req.NotifyEarlyAccess,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "PROFILE_SAVE_FAILED", Message: err.Error()})
		return
	}

	// Respond with acknowledgement and populated fields
	c.JSON(http.StatusOK, gin.H{
		"id":                       profile.ID,
		"userId":                   profile.UserID,
		"fullName":                 profile.FullName,
		"kycStatus":                profile.KYCStatus,
		"phone":                    profile.Phone,
		"payoutCurrency":           profile.PayoutCurrency,
		"bankCbuOrAlias":           profile.BankCbuOrAlias,
		"bankName":                 profile.BankName,
		"web3WalletAddress":        profile.Web3WalletAddress,
		"autoReinvestYield":        profile.AutoReinvestYield,
		"twoFactorEnabled":         profile.TwoFactorEnabled,
		"notifyConstructionAlerts": profile.NotifyConstructionAlerts,
		"notifyAuditReports":       profile.NotifyAuditReports,
		"notifyEarlyAccess":        profile.NotifyEarlyAccess,
		"status":                   "stored_encrypted",
	})
}

func (h *UserHandler) getInvestorProfile(c *gin.Context) {
	userID := c.Param("id")
	profile, err := h.svc.GetInvestorProfile(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, services.ErrProfileNotFound) {
			c.JSON(http.StatusNotFound, errorResponse{Code: "PROFILE_NOT_FOUND", Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "PROFILE_GET_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *UserHandler) updateKYC(c *gin.Context) {
	userID := c.Param("id")
	var req updateKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	if err := h.svc.UpdateKYCStatus(c.Request.Context(), userID, user.KYCStatus(req.Status)); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "KYC_UPDATE_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "kycStatus": req.Status})
}

func (h *UserHandler) recordConsent(c *gin.Context) {
	userID := c.Param("id")
	var req consentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	ip := c.ClientIP()
	if ip == "" {
		ip = "127.0.0.1"
	}

	err := h.svc.RecordConsent(c.Request.Context(), services.RecordConsentCommand{
		UserID:          userID,
		ConsentType:     user.ConsentType(req.ConsentType),
		DocumentVersion: req.DocumentVersion,
		DocumentHash:    req.DocumentHash,
		IPAddress:       ip,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "CONSENT_RECORD_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "recorded"})
}

func (h *UserHandler) googleLogin(c *gin.Context) {
	var req googleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	ip := c.ClientIP()
	if ip == "" {
		ip = "127.0.0.1"
	}
	ua := c.GetHeader("User-Agent")

	res, err := h.svc.AuthenticateWithGoogle(c.Request.Context(), services.GoogleLoginCommand{
		IDToken:         req.IDToken,
		DeviceID:        req.DeviceID,
		DeviceToken:     req.DeviceToken,
		DeviceName:      req.DeviceName,
		Fingerprint:     req.Fingerprint,
		IPAddress:       ip,
		UserAgent:       ua,
		UserConsent:     req.UserConsent,
		AuthorizeDevice: req.AuthorizeDevice,
	})

	if err != nil {
		if errors.Is(err, services.ErrAccountNotAssociated) {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "ACCOUNT_NOT_ASSOCIATED",
				"message": "La cuenta de Google no se encuentra registrada o asociada en el sistema. Por favor, crea tu cuenta primero.",
			})
			return
		}
		if errors.Is(err, user.ErrUserInactive) {
			c.JSON(http.StatusForbidden, errorResponse{Code: "USER_INACTIVE", Message: "La cuenta está inactiva o suspendida."})
			return
		}
		c.JSON(http.StatusUnauthorized, errorResponse{Code: "AUTH_FAILED", Message: err.Error()})
		return
	}

	if res.RequiresUserConsent {
		c.JSON(http.StatusOK, gin.H{
			"status":              "REQUIRE_USER_CONSENT",
			"message":             "Se requiere tu confirmación para iniciar sesión con Google",
			"requiresUserConsent": true,
			"email":               res.GoogleEmail,
			"name":                res.GoogleName,
			"picture":             res.GooglePicture,
		})
		return
	}

	if res.RequiresDeviceAuthorization {
		c.JSON(http.StatusOK, gin.H{
			"status":                      "REQUIRE_DEVICE_AUTHORIZATION",
			"message":                     "Dispositivo no reconocido. Se requiere autorización de dispositivo de confianza.",
			"requiresDeviceAuthorization": true,
			"email":                       res.GoogleEmail,
			"name":                        res.GoogleName,
			"deviceId":                    req.DeviceID,
		})
		return
	}

	// Successful login
	name := res.User.Email
	taxID := ""
	kycStatus := "verified"
	isVerified := true

	if res.Profile != nil {
		name = res.Profile.FullName
		taxID = res.Profile.CUIL
		kycStatus = string(res.Profile.KYCStatus)
		isVerified = res.Profile.KYCStatus == user.KYCVerified
	}

	resp := gin.H{
		"id":            res.User.ID,
		"email":         res.User.Email,
		"role":          string(res.User.Role),
		"userType":      string(res.User.UserType),
		"name":          name,
		"taxId":         taxID,
		"kycStatus":     kycStatus,
		"isKycVerified": isVerified,
	}

	if res.TrustedDevice != nil {
		resp["trustedDevice"] = gin.H{
			"deviceId":    res.TrustedDevice.DeviceID,
			"deviceToken": res.TrustedDevice.DeviceToken,
			"deviceName":  res.TrustedDevice.DeviceName,
			"trustedAt":   res.TrustedDevice.TrustedAt.Format(time.RFC3339),
			"lastUsedAt":  res.TrustedDevice.LastUsedAt.Format(time.RFC3339),
		}
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) authorizeDevice(c *gin.Context) {
	var req authorizeDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	ip := c.ClientIP()
	if ip == "" {
		ip = "127.0.0.1"
	}
	ua := c.GetHeader("User-Agent")

	device, err := h.svc.AuthorizeTrustedDevice(
		c.Request.Context(),
		req.UserID,
		req.DeviceID,
		req.DeviceName,
		req.Fingerprint,
		ip,
		ua,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "AUTHORIZE_DEVICE_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deviceId":    device.DeviceID,
		"deviceToken": device.DeviceToken,
		"deviceName":  device.DeviceName,
		"trustedAt":   device.TrustedAt.Format(time.RFC3339),
	})
}

func (h *UserHandler) listDevices(c *gin.Context) {
	userID := c.Param("userId")
	devices, err := h.svc.ListTrustedDevices(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "LIST_DEVICES_FAILED", Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, devices)
}

func (h *UserHandler) revokeDevice(c *gin.Context) {
	userID := c.Param("userId")
	deviceID := c.Param("deviceId")
	if err := h.svc.RevokeTrustedDevice(c.Request.Context(), userID, deviceID); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "REVOKE_DEVICE_FAILED", Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "revoked"})
}
