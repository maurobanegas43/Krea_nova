package gin

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

type createInvestmentRequest struct {
	ProjectID       string `json:"projectId" binding:"required"`
	InvestorID      string `json:"investorId" binding:"required"`
	AmountCents     int64  `json:"amountCents" binding:"required,gt=0"`
	ValidateBalance bool   `json:"validateBalance"`
}

type depositRequest struct {
	InvestorID  string `json:"investorId" binding:"required"`
	AmountCents int64  `json:"amountCents" binding:"required,gt=0"`
	Method      string `json:"method"`
}

type withdrawRequest struct {
	InvestorID  string `json:"investorId" binding:"required"`
	AmountCents int64  `json:"amountCents" binding:"required,gt=0"`
	Destination string `json:"destination"`
}

type FundHandler struct {
	svc *services.FundService
}

func NewFundHandler(svc *services.FundService) *FundHandler {
	return &FundHandler{svc: svc}
}

func (h *FundHandler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/funds")
	g.POST("/investments", h.createInvestment)
	g.GET("/investments/:id", h.getInvestment)
	g.GET("/investors/:id/investments", h.listInvestorInvestments)
	g.GET("/investors/:id/ledger", h.listInvestorLedger)
	g.POST("/deposits", h.depositFunds)
	g.POST("/withdrawals", h.withdrawFunds)
	g.GET("/fiduciary-account", h.getFiduciaryAccount)
	g.GET("/accounts/:id/balance", h.getBalance)
	g.GET("/users/:id/balance", h.getUserBalance)
}

func (h *FundHandler) createInvestment(c *gin.Context) {
	var req createInvestmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	inv, err := h.svc.InvestInProject(c.Request.Context(), services.CreateInvestmentCommand{
		ProjectID:       req.ProjectID,
		InvestorID:      req.InvestorID,
		AmountCents:     req.AmountCents,
		ValidateBalance: req.ValidateBalance,
	})
	if err != nil {
		if errors.Is(err, fund.ErrInsufficientBalance) {
			c.JSON(http.StatusBadRequest, errorResponse{
				Code:    "INSUFFICIENT_FUNDS",
				Message: "Saldo insuficiente en cuenta comitente para adquirir activos. Realice un depósito previo.",
			})
			return
		}
		if errors.Is(err, user.ErrKYCNotVerified) {
			c.JSON(http.StatusForbidden, errorResponse{
				Code:    "KYC_REQUIRED",
				Message: "Investor must complete KYC verification before investing funds.",
			})
			return
		}
		if errors.Is(err, project.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse{Code: "PROJECT_NOT_FOUND", Message: err.Error()})
			return
		}
		if errors.Is(err, services.ErrProjectNotInvestable) {
			c.JSON(http.StatusConflict, errorResponse{Code: "PROJECT_NOT_INVESTABLE", Message: err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVESTMENT_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":          inv.ID,
		"projectId":   inv.ProjectID,
		"investorId":  inv.InvestorID,
		"amountCents": inv.AmountCents,
		"status":      inv.Status,
		"createdAt":   inv.CreatedAt,
	})
}

func (h *FundHandler) getInvestment(c *gin.Context) {
	id := c.Param("id")
	inv, err := h.svc.GetInvestment(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if inv == nil {
		c.JSON(http.StatusNotFound, errorResponse{Code: "NOT_FOUND", Message: "Investment not found"})
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *FundHandler) listInvestorInvestments(c *gin.Context) {
	investorID := c.Param("id")
	list, err := h.svc.ListInvestmentsByInvestor(c.Request.Context(), investorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if list == nil {
		list = []*fund.Investment{}
	}
	c.JSON(http.StatusOK, list)
}

func (h *FundHandler) getBalance(c *gin.Context) {
	accountID := c.Param("id")
	balance, err := h.svc.GetAccountBalance(c.Request.Context(), accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"accountId":    accountID,
		"balanceCents": balance,
	})
}

func (h *FundHandler) getUserBalance(c *gin.Context) {
	userID := c.Param("id")
	balance, err := h.svc.GetInvestorBalance(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userId":       userID,
		"balanceCents": balance,
		"balanceUSD":   float64(balance) / 100.0,
	})
}

func (h *FundHandler) depositFunds(c *gin.Context) {
	var req depositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	newBalance, err := h.svc.DepositFunds(c.Request.Context(), req.InvestorID, req.AmountCents, req.Method)
	if err != nil {
		if errors.Is(err, user.ErrKYCNotVerified) {
			c.JSON(http.StatusForbidden, errorResponse{Code: "KYC_REQUIRED", Message: "Investor must be KYC verified before depositing funds."})
			return
		}
		c.JSON(http.StatusBadRequest, errorResponse{Code: "DEPOSIT_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"investorId":   req.InvestorID,
		"balanceCents": newBalance,
		"balanceUSD":   float64(newBalance) / 100.0,
		"message":      "Funds successfully credited to fiduciary virtual wallet.",
	})
}

func (h *FundHandler) withdrawFunds(c *gin.Context) {
	var req withdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	newBalance, err := h.svc.WithdrawFunds(c.Request.Context(), req.InvestorID, req.AmountCents, req.Destination)
	if err != nil {
		if errors.Is(err, fund.ErrInsufficientBalance) {
			c.JSON(http.StatusBadRequest, errorResponse{Code: "INSUFFICIENT_FUNDS", Message: "Insufficient balance for withdrawal."})
			return
		}
		c.JSON(http.StatusBadRequest, errorResponse{Code: "WITHDRAWAL_FAILED", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"investorId":   req.InvestorID,
		"balanceCents": newBalance,
		"balanceUSD":   float64(newBalance) / 100.0,
		"message":      "Withdrawal successfully processed from fiduciary account.",
	})
}

func (h *FundHandler) listInvestorLedger(c *gin.Context) {
	investorID := c.Param("id")
	entries, err := h.svc.ListInvestorLedger(c.Request.Context(), investorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if entries == nil {
		entries = []fund.LedgerEntry{}
	}
	c.JSON(http.StatusOK, entries)
}

func (h *FundHandler) getFiduciaryAccount(c *gin.Context) {
	fa, err := h.svc.GetFiduciaryAccount(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if fa == nil {
		c.JSON(http.StatusNotFound, errorResponse{Code: "NOT_FOUND", Message: "Fiduciary account not configured."})
		return
	}
	c.JSON(http.StatusOK, fa)
}
