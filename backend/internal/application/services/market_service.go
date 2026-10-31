package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

var (
	ErrInsufficientTokens = errors.New("market: insufficient token holdings to place or execute sell order")
	ErrUnauthorized       = errors.New("market: user is not authorized to perform this operation")
)

type CreateOrderCommand struct {
	ProjectID          string
	UserID             string
	OrderType          market.OrderType
	TokenCount         int64
	PricePerTokenCents int64
}

type ExecuteTradeCommand struct {
	TakerUserID string
	OrderID     string
	TokenCount  int64 // 0 means take all remaining tokens
}

type UserHoldingDTO struct {
	ProjectID   string `json:"projectId"`
	ProjectName string `json:"projectName"`
	TokenCount  int64  `json:"tokenCount"`
}

type MarketService struct {
	marketRepo  ports.MarketRepository
	projectRepo ports.ProjectRepository
	userRepo    ports.UserRepository
	fundRepo    ports.FundRepository
	ids         ports.IDGenerator
	clock       ports.Clock
}

func NewMarketService(
	marketRepo ports.MarketRepository,
	projectRepo ports.ProjectRepository,
	userRepo ports.UserRepository,
	fundRepo ports.FundRepository,
	ids ports.IDGenerator,
	clock ports.Clock,
) *MarketService {
	return &MarketService{
		marketRepo:  marketRepo,
		projectRepo: projectRepo,
		userRepo:    userRepo,
		fundRepo:    fundRepo,
		ids:         ids,
		clock:       clock,
	}
}

// CreateOrder places a new maker limit order.
func (s *MarketService) CreateOrder(ctx context.Context, cmd CreateOrderCommand) (*market.Order, error) {
	// 1. Regulatory verification: only KYC-verified users can operate in secondary market
	profile, err := s.userRepo.FindInvestorProfileByUserID(ctx, cmd.UserID)
	if err != nil || profile == nil || profile.KYCStatus != user.KYCVerified {
		return nil, user.ErrKYCNotVerified
	}

	// 2. Validate project
	proj, err := s.projectRepo.FindByID(ctx, cmd.ProjectID)
	if err != nil || proj == nil {
		return nil, project.ErrNotFound
	}
	if proj.Status != project.StatusPublished && proj.Status != project.StatusApproved {
		return nil, errors.New("market: project is not open for trading")
	}

	// 3. For SELL orders: verify user owns enough free tokens
	if cmd.OrderType == market.OrderTypeSell {
		holdings, err := s.GetUserTokenCount(ctx, cmd.UserID, cmd.ProjectID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify holdings: %w", err)
		}

		// Also check existing open sell orders by this user
		openOrders, err := s.marketRepo.ListOrdersByUser(ctx, cmd.UserID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify active orders: %w", err)
		}
		var committedTokens int64
		for _, o := range openOrders {
			if o.ProjectID == cmd.ProjectID && o.OrderType == market.OrderTypeSell && (o.Status == market.StatusOpen || o.Status == market.StatusPartiallyFilled) {
				committedTokens += o.RemainingTokens()
			}
		}

		if holdings < committedTokens+cmd.TokenCount {
			return nil, ErrInsufficientTokens
		}
	}

	now := s.clock.Now()
	orderID := s.ids.NewID()
	ord, err := market.NewOrder(orderID, cmd.ProjectID, cmd.UserID, cmd.OrderType, cmd.TokenCount, cmd.PricePerTokenCents, now)
	if err != nil {
		return nil, err
	}

	if err := s.marketRepo.SaveOrder(ctx, ord); err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	return ord, nil
}

// ListOrders returns filtered orders for the order book.
func (s *MarketService) ListOrders(ctx context.Context, projectID string, status market.OrderStatus, oType market.OrderType) ([]*market.Order, error) {
	return s.marketRepo.ListOrders(ctx, projectID, status, oType)
}

// ListUserOrders returns all orders for a specific user.
func (s *MarketService) ListUserOrders(ctx context.Context, userID string) ([]*market.Order, error) {
	return s.marketRepo.ListOrdersByUser(ctx, userID)
}

// CancelOrder allows the creator to cancel an unfilled or partially filled order.
func (s *MarketService) CancelOrder(ctx context.Context, orderID, userID string) (*market.Order, error) {
	ord, err := s.marketRepo.FindOrderByID(ctx, orderID)
	if err != nil || ord == nil {
		return nil, market.ErrOrderNotFound
	}
	if ord.UserID != userID {
		return nil, ErrUnauthorized
	}
	if err := ord.Cancel(); err != nil {
		return nil, err
	}
	if err := s.marketRepo.SaveOrder(ctx, ord); err != nil {
		return nil, fmt.Errorf("failed to update order: %w", err)
	}
	return ord, nil
}

// ExecuteTrade executes a taker operation against an existing open maker order.
func (s *MarketService) ExecuteTrade(ctx context.Context, cmd ExecuteTradeCommand) (*market.Trade, error) {
	// 1. Taker KYC verification
	profile, err := s.userRepo.FindInvestorProfileByUserID(ctx, cmd.TakerUserID)
	if err != nil || profile == nil || profile.KYCStatus != user.KYCVerified {
		return nil, user.ErrKYCNotVerified
	}

	// 2. Fetch maker order
	makerOrder, err := s.marketRepo.FindOrderByID(ctx, cmd.OrderID)
	if err != nil || makerOrder == nil {
		return nil, market.ErrOrderNotFound
	}
	if makerOrder.Status != market.StatusOpen && makerOrder.Status != market.StatusPartiallyFilled {
		return nil, market.ErrOrderNotOpen
	}
	if makerOrder.UserID == cmd.TakerUserID {
		return nil, market.ErrSelfTrade
	}

	tradeVolume := cmd.TokenCount
	if tradeVolume <= 0 || tradeVolume > makerOrder.RemainingTokens() {
		tradeVolume = makerOrder.RemainingTokens()
	}

	now := s.clock.Now()

	// 3. Prepare counter-order for taker
	var buyOrder, sellOrder *market.Order
	takerOrderType := market.OrderTypeBuy
	if makerOrder.OrderType == market.OrderTypeBuy {
		takerOrderType = market.OrderTypeSell
	}

	takerOrderID := s.ids.NewID()
	takerOrder, err := market.NewOrder(takerOrderID, makerOrder.ProjectID, cmd.TakerUserID, takerOrderType, tradeVolume, makerOrder.PricePerTokenCents, now)
	if err != nil {
		return nil, err
	}

	// If taker is selling, verify taker has sufficient tokens
	if takerOrderType == market.OrderTypeSell {
		holdings, err := s.GetUserTokenCount(ctx, cmd.TakerUserID, makerOrder.ProjectID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify holdings: %w", err)
		}
		if holdings < tradeVolume {
			return nil, ErrInsufficientTokens
		}
	}

	if makerOrder.OrderType == market.OrderTypeSell {
		buyOrder = takerOrder
		sellOrder = makerOrder
	} else {
		buyOrder = makerOrder
		sellOrder = takerOrder
	}

	// 4. Fill both orders
	if err := buyOrder.ApplyFill(tradeVolume); err != nil {
		return nil, err
	}
	if err := sellOrder.ApplyFill(tradeVolume); err != nil {
		return nil, err
	}

	// 5. Create trade record
	tradeID := s.ids.NewID()
	trade, err := market.NewTrade(tradeID, buyOrder.ID, sellOrder.ID, tradeVolume, makerOrder.PricePerTokenCents, now)
	if err != nil {
		return nil, err
	}

	// 6. Persist trade and updated orders
	if err := s.marketRepo.SaveTrade(ctx, trade, buyOrder, sellOrder); err != nil {
		return nil, fmt.Errorf("failed to record trade: %w", err)
	}

	// 7. Double-entry ledger settlement between buyer and seller if fundRepo is present
	if s.fundRepo != nil {
		buyerAcc, errB := s.fundRepo.FindLedgerAccountByUser(ctx, buyOrder.UserID, fund.AccountInvestor)
		sellerAcc, errS := s.fundRepo.FindLedgerAccountByUser(ctx, sellOrder.UserID, fund.AccountInvestor)
		if errB == nil && errS == nil && buyerAcc != nil && sellerAcc != nil {
			txGroup := "trade-" + trade.ID
			entries := []fund.LedgerEntry{
				{
					ID:                 s.ids.NewID(),
					AccountID:          buyerAcc.ID,
					TransactionGroupID: txGroup,
					EntryType:          fund.EntryDebit,
					AmountCents:        trade.TotalAmountCents,
					ReferenceType:      "secondary_trade_buy",
					ReferenceID:        trade.ID,
					CreatedAt:          now,
				},
				{
					ID:                 s.ids.NewID(),
					AccountID:          sellerAcc.ID,
					TransactionGroupID: txGroup,
					EntryType:          fund.EntryCredit,
					AmountCents:        trade.TotalAmountCents,
					ReferenceType:      "secondary_trade_sell",
					ReferenceID:        trade.ID,
					CreatedAt:          now,
				},
			}
			_ = s.fundRepo.RecordTransaction(ctx, entries)
		}
	}

	return trade, nil
}

// GetUserTokenCount returns the total active tokens a user holds for a project.
func (s *MarketService) GetUserTokenCount(ctx context.Context, userID, projectID string) (int64, error) {
	// Baseline: Primary market investments (assuming 1 token = $100 = 10000 cents default or from investment)
	var totalTokens int64 = 0
	if s.fundRepo != nil {
		invs, err := s.fundRepo.ListInvestmentsByInvestor(ctx, userID)
		if err == nil {
			for _, inv := range invs {
				if inv.ProjectID == projectID && (inv.Status == fund.InvestmentActive || inv.Status == fund.InvestmentCompleted) {
					// 1 token = 10000 cents ($100 USD)
					totalTokens += inv.AmountCents / 10000
				}
			}
		}
	}

	// Plus net secondary market trades
	netTradeTokens, err := s.marketRepo.GetUserTokenBalance(ctx, userID, projectID)
	if err == nil {
		totalTokens += netTradeTokens
	}

	if totalTokens < 0 {
		totalTokens = 0
	}
	return totalTokens, nil
}

// GetUserHoldings returns aggregated token holdings for all projects where user has tokens.
func (s *MarketService) GetUserHoldings(ctx context.Context, userID string) ([]UserHoldingDTO, error) {
	projects, err := s.projectRepo.List(ctx, nil)
	if err != nil {
		return nil, err
	}

	var holdings []UserHoldingDTO
	for _, p := range projects {
		count, err := s.GetUserTokenCount(ctx, userID, p.ID)
		if err == nil && count > 0 {
			holdings = append(holdings, UserHoldingDTO{
				ProjectID:   p.ID,
				ProjectName: p.Name,
				TokenCount:  count,
			})
		}
	}
	return holdings, nil
}
