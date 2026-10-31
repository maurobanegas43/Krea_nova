package services_test

import (
	"context"
	"testing"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/memory"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
)

func TestMarketService_CreateOrderAndExecuteTrade(t *testing.T) {
	ctx := context.Background()
	marketRepo := memory.NewMarketRepository()
	projectRepo := memory.NewProjectRepository()
	userRepo := memory.NewUserRepository()
	fundRepo := memory.NewFundRepository()
	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	svc := services.NewMarketService(marketRepo, projectRepo, userRepo, fundRepo, idGen, clock)

	// Setup users: seller and buyer with verified KYC
	sellerID := "seller-1"
	buyerID := "buyer-1"
	now := time.Now()

	sellerUser, _ := user.NewUser(sellerID, "seller@example.com", "+5411000", "hash", user.RoleInvestor, user.UserTypeIndividual, now)
	_ = userRepo.SaveUser(ctx, sellerUser)
	_ = userRepo.SaveInvestorProfile(ctx, &user.InvestorProfile{
		ID:        "prof-seller",
		UserID:    sellerID,
		KYCStatus: user.KYCVerified,
	})

	buyerUser, _ := user.NewUser(buyerID, "buyer@example.com", "+5411111", "hash", user.RoleInvestor, user.UserTypeIndividual, now)
	_ = userRepo.SaveUser(ctx, buyerUser)
	_ = userRepo.SaveInvestorProfile(ctx, &user.InvestorProfile{
		ID:        "prof-buyer",
		UserID:    buyerID,
		KYCStatus: user.KYCVerified,
	})

	// Setup project in published state
	proj, _ := project.New("proj-test", "dev-1", "Torre Alpha", "CABA", "Desc", 10000000, now)
	_ = proj.TransitionTo(project.StatusUnderReview, now)
	_ = proj.TransitionTo(project.StatusApproved, now)
	_ = proj.TransitionTo(project.StatusPublished, now)
	_ = projectRepo.Save(ctx, proj)

	// Seller has 20 tokens via primary market investment ($2,000 USD = 200,000 cents = 20 tokens)
	inv, _ := fund.NewInvestment("inv-1", proj.ID, sellerID, 200000, now)
	inv.Status = fund.InvestmentActive
	_ = fundRepo.SaveInvestment(ctx, inv)

	// 1. Seller creates sell order for 10 tokens at $105 (10500 cents)
	sellOrder, err := svc.CreateOrder(ctx, services.CreateOrderCommand{
		ProjectID:          proj.ID,
		UserID:             sellerID,
		OrderType:          market.OrderTypeSell,
		TokenCount:         10,
		PricePerTokenCents: 10500,
	})
	if err != nil {
		t.Fatalf("unexpected error creating sell order: %v", err)
	}
	if sellOrder.Status != market.StatusOpen || sellOrder.RemainingTokens() != 10 {
		t.Fatalf("unexpected order state: %+v", sellOrder)
	}

	// 2. Seller tries to create another sell order exceeding holdings -> should fail
	_, err = svc.CreateOrder(ctx, services.CreateOrderCommand{
		ProjectID:          proj.ID,
		UserID:             sellerID,
		OrderType:          market.OrderTypeSell,
		TokenCount:         15, // only 10 tokens left (20 - 10 = 10)
		PricePerTokenCents: 10500,
	})
	if err != services.ErrInsufficientTokens {
		t.Fatalf("expected ErrInsufficientTokens, got %v", err)
	}

	// 3. Buyer executes trade taking 5 tokens from the sell order
	trade, err := svc.ExecuteTrade(ctx, services.ExecuteTradeCommand{
		TakerUserID: buyerID,
		OrderID:     sellOrder.ID,
		TokenCount:  5,
	})
	if err != nil {
		t.Fatalf("unexpected error executing trade: %v", err)
	}
	if trade.TokenCount != 5 || trade.TotalAmountCents != 5*10500 {
		t.Fatalf("unexpected trade metrics: %+v", trade)
	}

	// 4. Verify updated maker order status
	updatedOrder, _ := marketRepo.FindOrderByID(ctx, sellOrder.ID)
	if updatedOrder.Status != market.StatusPartiallyFilled || updatedOrder.RemainingTokens() != 5 {
		t.Fatalf("expected order to be partially filled with 5 remaining, got %s and %d", updatedOrder.Status, updatedOrder.RemainingTokens())
	}

	// 5. Verify buyer token balance
	buyerTokens, err := svc.GetUserTokenCount(ctx, buyerID, proj.ID)
	if err != nil || buyerTokens != 5 {
		t.Fatalf("expected buyer to hold 5 tokens, got %d (err: %v)", buyerTokens, err)
	}
}
