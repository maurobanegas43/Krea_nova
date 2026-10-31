package gin

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

type createOrderRequest struct {
	ProjectID          string           `json:"projectId" binding:"required"`
	UserID             string           `json:"userId" binding:"required"`
	OrderType          market.OrderType `json:"orderType" binding:"required"`
	TokenCount         int64            `json:"tokenCount" binding:"required,gt=0"`
	PricePerTokenCents int64            `json:"pricePerTokenCents" binding:"required,gt=0"`
}

type executeTradeRequest struct {
	TakerUserID string `json:"takerUserId" binding:"required"`
	TokenCount  int64  `json:"tokenCount"`
}

type cancelOrderRequest struct {
	UserID string `json:"userId" binding:"required"`
}

type MarketHandler struct {
	svc *services.MarketService
}

func NewMarketHandler(svc *services.MarketService) *MarketHandler {
	return &MarketHandler{svc: svc}
}

func (h *MarketHandler) Register(rg *gin.RouterGroup) {
	g := rg.Group("/market")
	g.GET("/orders", h.listOrders)
	g.POST("/orders", h.createOrder)
	g.POST("/orders/:id/execute", h.executeTrade)
	g.POST("/orders/:id/cancel", h.cancelOrder)
	g.GET("/users/:id/orders", h.listUserOrders)
	g.GET("/users/:id/holdings", h.getUserHoldings)
	g.GET("/users/:id/holdings/:projectId", h.getUserProjectHoldings)
}

func (h *MarketHandler) listOrders(c *gin.Context) {
	projectID := c.Query("projectId")
	statusStr := c.Query("status")
	if statusStr == "" {
		statusStr = "open"
	}
	typeStr := c.Query("type")

	orders, err := h.svc.ListOrders(
		c.Request.Context(),
		projectID,
		market.OrderStatus(statusStr),
		market.OrderType(typeStr),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if orders == nil {
		orders = []*market.Order{}
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *MarketHandler) createOrder(c *gin.Context) {
	var req createOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	ord, err := h.svc.CreateOrder(c.Request.Context(), services.CreateOrderCommand{
		ProjectID:          req.ProjectID,
		UserID:             req.UserID,
		OrderType:          req.OrderType,
		TokenCount:         req.TokenCount,
		PricePerTokenCents: req.PricePerTokenCents,
	})
	if err != nil {
		switch {
		case errors.Is(err, user.ErrKYCNotVerified):
			c.JSON(http.StatusForbidden, errorResponse{Code: "KYC_REQUIRED", Message: "El inversor debe contar con KYC verificado para operar en mercado secundario"})
		case errors.Is(err, services.ErrInsufficientTokens):
			c.JSON(http.StatusBadRequest, errorResponse{Code: "INSUFFICIENT_TOKENS", Message: "Saldo de tokens insuficiente en cartera para publicar orden de venta"})
		case errors.Is(err, project.ErrNotFound):
			c.JSON(http.StatusNotFound, errorResponse{Code: "PROJECT_NOT_FOUND", Message: err.Error()})
		case errors.Is(err, market.ErrInvalidTokenCount), errors.Is(err, market.ErrInvalidPrice), errors.Is(err, market.ErrInvalidOrderType):
			c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_ORDER_PARAM", Message: err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": ord})
}

func (h *MarketHandler) executeTrade(c *gin.Context) {
	orderID := c.Param("id")
	var req executeTradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	trade, err := h.svc.ExecuteTrade(c.Request.Context(), services.ExecuteTradeCommand{
		TakerUserID: req.TakerUserID,
		OrderID:     orderID,
		TokenCount:  req.TokenCount,
	})
	if err != nil {
		switch {
		case errors.Is(err, user.ErrKYCNotVerified):
			c.JSON(http.StatusForbidden, errorResponse{Code: "KYC_REQUIRED", Message: "El inversor debe contar con KYC verificado para operar"})
		case errors.Is(err, market.ErrOrderNotFound):
			c.JSON(http.StatusNotFound, errorResponse{Code: "ORDER_NOT_FOUND", Message: "Orden no encontrada"})
		case errors.Is(err, market.ErrOrderNotOpen):
			c.JSON(http.StatusBadRequest, errorResponse{Code: "ORDER_NOT_OPEN", Message: "La orden ya no se encuentra abierta"})
		case errors.Is(err, market.ErrSelfTrade):
			c.JSON(http.StatusBadRequest, errorResponse{Code: "SELF_TRADE_PROHIBITED", Message: "No puedes operar contra tu propia orden"})
		case errors.Is(err, services.ErrInsufficientTokens):
			c.JSON(http.StatusBadRequest, errorResponse{Code: "INSUFFICIENT_TOKENS", Message: "Saldo de tokens insuficiente para ejecutar la venta"})
		default:
			c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": trade})
}

func (h *MarketHandler) cancelOrder(c *gin.Context) {
	orderID := c.Param("id")
	var req cancelOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Code: "INVALID_REQUEST", Message: err.Error()})
		return
	}

	ord, err := h.svc.CancelOrder(c.Request.Context(), orderID, req.UserID)
	if err != nil {
		switch {
		case errors.Is(err, market.ErrOrderNotFound):
			c.JSON(http.StatusNotFound, errorResponse{Code: "ORDER_NOT_FOUND", Message: "Orden no encontrada"})
		case errors.Is(err, services.ErrUnauthorized):
			c.JSON(http.StatusForbidden, errorResponse{Code: "UNAUTHORIZED", Message: "Solo el creador puede cancelar la orden"})
		default:
			c.JSON(http.StatusBadRequest, errorResponse{Code: "CANCEL_FAILED", Message: err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ord})
}

func (h *MarketHandler) listUserOrders(c *gin.Context) {
	userID := c.Param("id")
	orders, err := h.svc.ListUserOrders(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if orders == nil {
		orders = []*market.Order{}
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *MarketHandler) getUserHoldings(c *gin.Context) {
	userID := c.Param("id")
	holdings, err := h.svc.GetUserHoldings(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	if holdings == nil {
		holdings = []services.UserHoldingDTO{}
	}
	c.JSON(http.StatusOK, gin.H{"data": holdings})
}

func (h *MarketHandler) getUserProjectHoldings(c *gin.Context) {
	userID := c.Param("id")
	projectID := c.Param("projectId")
	count, err := h.svc.GetUserTokenCount(c.Request.Context(), userID, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Code: "INTERNAL_ERROR", Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"tokenCount": count}})
}
