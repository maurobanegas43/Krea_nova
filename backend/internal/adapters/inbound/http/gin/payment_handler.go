package gin

import (
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

type createDepositRequest struct {
	UserID      string `json:"userId" binding:"required"`
	AmountCents int64  `json:"amountCents" binding:"required,gt=0"`
	Currency    string `json:"currency"`
	Provider    string `json:"provider" binding:"required"`
	RedirectURL string `json:"redirectUrl"`
	Description string `json:"description"`
}

type PaymentHandler struct {
	svc *services.PaymentService
}

func NewPaymentHandler(svc *services.PaymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc}
}

func (h *PaymentHandler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/payments")
	g.POST("/deposits", h.createDeposit)
	g.POST("/webhook/:provider", h.handleWebhook)
	g.GET("/deposits/:id", h.getDeposit)
	g.GET("/users/:id/deposits", h.listUserDeposits)
}

func (h *PaymentHandler) createDeposit(c *gin.Context) {
	var req createDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	idempotencyKey := c.GetHeader("Idempotency-Key")

	prov := payment.GatewayProvider(req.Provider)
	p, err := h.svc.CreateDeposit(c.Request.Context(), services.CreateDepositCommand{
		UserID:         req.UserID,
		AmountCents:    req.AmountCents,
		Currency:       req.Currency,
		Provider:       prov,
		IdempotencyKey: idempotencyKey,
		Description:    req.Description,
		RedirectURL:    req.RedirectURL,
	})
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, errorResponse{Code: "USER_NOT_FOUND", Message: err.Error()})
			return
		}
		if errors.Is(err, services.ErrGatewayNotFound) || errors.Is(err, payment.ErrUnsupportedProvider) {
			c.JSON(http.StatusBadRequest, errorResponse{Code: "UNSUPPORTED_PROVIDER", Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "DEPOSIT_CREATION_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, p)
}

func (h *PaymentHandler) handleWebhook(c *gin.Context) {
	provider := payment.GatewayProvider(c.Param("provider"))

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_PAYLOAD", Message: err.Error()})
		return
	}

	headers := make(map[string][]string)
	for k, v := range c.Request.Header {
		headers[k] = v
	}

	err = h.svc.ProcessWebhook(c.Request.Context(), provider, headers, bodyBytes)
	if err != nil {
		// Log warning but return OK or 400 according to standard webhook contracts
		c.JSON(http.StatusOK, gin.H{"status": "received", "warning": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *PaymentHandler) getDeposit(c *gin.Context) {
	id := c.Param("id")
	p, err := h.svc.GetPayment(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, errorResponse{Code: "NOT_FOUND", Message: "Payment intent not found"})
		return
	}

	c.JSON(http.StatusOK, p)
}

func (h *PaymentHandler) listUserDeposits(c *gin.Context) {
	userID := c.Param("id")
	list, err := h.svc.ListUserPayments(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if list == nil {
		list = []*payment.Payment{}
	}

	c.JSON(http.StatusOK, list)
}
