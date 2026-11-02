// Command api is the composition root: it wires ports to concrete adapters.
package main

import (
	"context"
	"encoding/hex"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	httpgin "github.com/maurobanegas43/proyecto_final/backend/internal/adapters/inbound/http/gin"
	"github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/memory"
	outboundPay "github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/payment"
	"github.com/maurobanegas43/proyecto_final/backend/internal/adapters/outbound/postgres"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	"github.com/maurobanegas43/proyecto_final/backend/internal/application/services"
	"github.com/maurobanegas43/proyecto_final/backend/internal/config"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/fund"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/market"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/project"
	"github.com/maurobanegas43/proyecto_final/backend/internal/domain/user"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/crypto"
	"github.com/maurobanegas43/proyecto_final/backend/internal/security/google"
)

func main() {
	cfg := config.Load()

	// 1. Cryptographic adapters (AES-256-GCM for PII & Bcrypt for passwords)
	encKey, err := hex.DecodeString(cfg.EncryptionKeyHex)
	if err != nil || len(encKey) != 32 {
		log.Printf("warning: invalid or missing 32-byte encryption key in hex, using fallback 32-byte key")
		encKey = []byte("12345678901234567890123456789012")
	}
	encryptor, err := crypto.NewAESGCMEncryptor(encKey)
	if err != nil {
		log.Fatalf("failed to initialize AES-GCM encryptor: %v", err)
	}
	hasher := crypto.NewBcryptHasher(12)

	// 2. Outbound adapters (PostgreSQL if configured, memory fallback)
	var (
		projectRepo ports.ProjectRepository
		userRepo    ports.UserRepository
		fundRepo    ports.FundRepository
		marketRepo  ports.MarketRepository
		paymentRepo ports.PaymentRepository
	)

	if cfg.DatabaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Printf("warning: postgresql connection failed (%v); falling back to memory adapter", err)
			projectRepo = memory.NewProjectRepository()
			userRepo = memory.NewUserRepository()
			fundRepo = memory.NewFundRepository()
			marketRepo = memory.NewMarketRepository()
			paymentRepo = memory.NewPaymentRepository()
		} else {
			log.Println("connected to PostgreSQL successfully")
			projectRepo = postgres.NewProjectRepository(pool)
			userRepo = postgres.NewUserRepository(pool)
			fundRepo = postgres.NewFundRepository(pool)
			marketRepo = postgres.NewMarketRepository(pool)
			paymentRepo = postgres.NewPaymentRepository(pool)
		}
	} else {
		log.Println("no DATABASE_URL provided; using in-memory adapters")
		projectRepo = memory.NewProjectRepository()
		userRepo = memory.NewUserRepository()
		fundRepo = memory.NewFundRepository()
		marketRepo = memory.NewMarketRepository()
		paymentRepo = memory.NewPaymentRepository()
	}

	idGen := memory.RandomID{}
	clock := memory.SystemClock{}

	// Seed projects, users and market orders if empty (memory or new database)
	seedInitialProjects(projectRepo)
	seedInitialUsers(userRepo, encryptor, hasher)
	seedInitialMarket(marketRepo, fundRepo)

	// 3. Application services
	projectSvc := services.NewProjectService(projectRepo, idGen, clock)
	userSvc := services.NewUserService(userRepo, encryptor, hasher, idGen, clock)
	if cfg.GoogleClientID != "" {
		log.Println("enabling Google ID Token verification with client id configured")
	}
	userSvc.SetGoogleVerifier(google.NewTokenVerifier(cfg.GoogleClientID))
	fundSvc := services.NewFundService(fundRepo, projectRepo, userRepo, idGen, clock)
	marketSvc := services.NewMarketService(marketRepo, projectRepo, userRepo, fundRepo, idGen, clock)
	paymentSvc := services.NewPaymentService(paymentRepo, fundRepo, userRepo, idGen, clock)
	paymentSvc.RegisterGateway(outboundPay.NewSimulatedGateway())
	paymentSvc.RegisterGateway(outboundPay.NewMercadoPagoGateway(outboundPay.MercadoPagoConfig{}))

	// 4. Inbound HTTP adapter (Gin)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), cors(cfg.AllowedOrigin))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")
	httpgin.NewProjectHandler(projectSvc).Register(v1)
	userHandler := httpgin.NewUserHandler(userSvc)
	userHandler.Register(v1)
	userHandler.RegisterAuthRoutes(v1)
	httpgin.NewFundHandler(fundSvc).Register(v1)
	httpgin.NewMarketHandler(marketSvc).Register(v1)
	httpgin.NewPaymentHandler(paymentSvc).Register(v1)

	log.Printf("api listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}

// cors is a restrictive single-origin CORS middleware.
func cors(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,Idempotency-Key")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func seedInitialProjects(repo ports.ProjectRepository) {
	ctx := context.Background()
	existing, err := repo.List(ctx, nil)
	if err == nil && len(existing) > 0 {
		return
	}

	now := time.Now()
	projects := []*project.Project{
		{
			ID:          "proj-001",
			DeveloperID: "dev-alpes",
			Name:        "Torre Krea Nova I",
			Location:    "Distrito Tecnológico, Buenos Aires",
			Description: "Torre corporativa y de micro-living sustentable con certificación LEED Gold.",
			FundingGoal: 75000000,
			FundsRaised: 52500000,
			Progress:    42,
			Status:      project.StatusPublished,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "proj-002",
			DeveloperID: "dev-urban",
			Name:        "Residencias Libertador",
			Location:    "Núñez, Buenos Aires",
			Description: "Complejo residencial exclusivo frente al parque en el corredor más cotizado de la ciudad.",
			FundingGoal: 120000000,
			FundsRaised: 98400000,
			Progress:    68,
			Status:      project.StatusPublished,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "proj-003",
			DeveloperID: "dev-nord",
			Name:        "Parque Logístico Ruta 9",
			Location:    "Campana, Buenos Aires",
			Description: "Naves industriales Triple A con contratos de alquiler a 10 años.",
			FundingGoal: 200000000,
			FundsRaised: 60000000,
			Progress:    15,
			Status:      project.StatusPublished,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "proj-004",
			DeveloperID: "dev-innovar",
			Name:        "Coliving & Studios Palermo",
			Location:    "Palermo Soho, Buenos Aires",
			Description: "Edificio boutique de estudios amoblados para alquiler temporal y nómadas digitales.",
			FundingGoal: 50000000,
			FundsRaised: 0,
			Progress:    5,
			Status:      project.StatusPublished,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "proj-005",
			DeveloperID: "dev-suraustral",
			Name:        "Llao Llao Eco-Residences & Spa",
			Location:    "Circuito Chico, Bariloche",
			Description: "Condo-hotel de montaña y spa termal sustentable en la Patagonia.",
			FundingGoal: 150000000,
			FundsRaised: 45000000,
			Progress:    25,
			Status:      project.StatusPublished,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "proj-006",
			DeveloperID: "dev-metropolis",
			Name:        "Madero Harbour Bay & Residences",
			Location:    "Dique 2, Puerto Madero, Buenos Aires",
			Description: "Torre icónica frente al espejo de agua con zócalo gastronómico y residencias de lujo.",
			FundingGoal: 250000000,
			FundsRaised: 187500000,
			Progress:    55,
			Status:      project.StatusPublished,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}

	for _, p := range projects {
		_ = repo.Save(ctx, p)
	}
}

func seedInitialUsers(repo ports.UserRepository, encryptor crypto.Encryptor, hasher crypto.PasswordHasher) {
	ctx := context.Background()
	existing, _ := repo.FindUserByEmail(ctx, "inversor@kreanova.capital")
	if existing != nil {
		return
	}

	now := time.Now()
	investorPassHash, err := hasher.HashPassword("Inversor2026!")
	if err == nil {
		investor := &user.User{
			ID:           "usr-investor-01",
			Email:        "inversor@kreanova.capital",
			Phone:        "+54 9 11 4000-8800",
			PasswordHash: investorPassHash,
			Role:         user.RoleInvestor,
			UserType:     user.UserTypeIndividual,
			IsActive:     true,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		_ = repo.SaveUser(ctx, investor)

		dniEnc, _ := encryptor.Encrypt("38123456")
		cuilEnc, _ := encryptor.Encrypt("20-38123456-7")
		addrEnc, _ := encryptor.Encrypt("Av. del Libertador 2200, CABA")

		profile := &user.InvestorProfile{
			ID:                 "prof-investor-01",
			UserID:             investor.ID,
			FullName:           "Inversor Institucional Demo",
			DNIEncrypted:       dniEnc,
			DNIHash:            crypto.HashSHA256("38123456"),
			CUILEncrypted:      cuilEnc,
			BirthDate:          "1990-05-15",
			AddressEncrypted:   addrEnc,
			City:               "Buenos Aires",
			Province:           "CABA",
			FundsOrigin:        "Actividad Comercial / Ahorro Inmobiliario",
			IsPEP:              false,
			IsObligatedSubject: false,
			KYCStatus:          user.KYCVerified,
			VerifiedAt:         &now,
		}
		_ = repo.SaveInvestorProfile(ctx, profile)
	}

	// Seed registered Google user for verification & trusted device login demo
	existingGoogle, _ := repo.FindUserByEmail(ctx, "inversor.verificado@gmail.com")
	if existingGoogle == nil {
		googleUserPassHash, _ := hasher.HashPassword("Inversor2026!")
		googleUser := &user.User{
			ID:           "usr-investor-google-01",
			Email:        "inversor.verificado@gmail.com",
			Phone:        "+54 9 11 5555-4321",
			PasswordHash: googleUserPassHash,
			Role:         user.RoleInvestor,
			UserType:     user.UserTypeIndividual,
			IsActive:     true,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		_ = repo.SaveUser(ctx, googleUser)

		dniEnc, _ := encryptor.Encrypt("36987654")
		cuilEnc, _ := encryptor.Encrypt("20-36987654-2")
		addrEnc, _ := encryptor.Encrypt("Av. Santa Fe 3400, CABA")

		googleProfile := &user.InvestorProfile{
			ID:                 "prof-investor-google-01",
			UserID:             googleUser.ID,
			FullName:           "Inversor Calificado",
			DNIEncrypted:       dniEnc,
			DNIHash:            crypto.HashSHA256("36987654"),
			CUILEncrypted:      cuilEnc,
			BirthDate:          "1989-08-22",
			AddressEncrypted:   addrEnc,
			City:               "Buenos Aires",
			Province:           "CABA",
			FundsOrigin:        "Rendimientos e Inversiones",
			IsPEP:              false,
			IsObligatedSubject: false,
			KYCStatus:          user.KYCVerified,
			VerifiedAt:         &now,
		}
		_ = repo.SaveInvestorProfile(ctx, googleProfile)
	}

	devPassHash, err := hasher.HashPassword("Desarrollo2026!")
	if err == nil {
		devEmails := []struct {
			id    string
			email string
		}{
			{"usr-dev-alpes", "desarrollo@alpesurban.com.ar"},
			{"usr-dev-urban", "info@urbancapital.com.ar"},
			{"usr-dev-nord", "operaciones@nordlogistics.com.ar"},
			{"usr-dev-innovar", "proyectos@innovarliving.com.ar"},
			{"usr-dev-suraustral", "contacto@suraustral.com.ar"},
			{"usr-dev-metropolis", "institucional@metropolisgroup.com.ar"},
		}
		for _, d := range devEmails {
			u := &user.User{
				ID:           d.id,
				Email:        d.email,
				Phone:        "+54 11 4820-9100",
				PasswordHash: devPassHash,
				Role:         user.RoleDeveloper,
				UserType:     user.UserTypeCorporate,
				IsActive:     true,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			_ = repo.SaveUser(ctx, u)
		}
	}
}

func seedInitialMarket(mRepo ports.MarketRepository, fRepo ports.FundRepository) {
	ctx := context.Background()
	existing, _ := mRepo.ListOrders(ctx, "", "", "")
	if len(existing) > 0 {
		return
	}
	now := time.Now()
	_ = mRepo.SaveOrder(ctx, &market.Order{
		ID:                 "ord-01",
		ProjectID:          "proj-001",
		UserID:             "usr-investor-01",
		OrderType:          market.OrderTypeSell,
		TokenCount:         25,
		PricePerTokenCents: 10450,
		FilledTokenCount:   0,
		Status:             market.StatusOpen,
		CreatedAt:          now.Add(-2 * time.Hour),
	})
	_ = mRepo.SaveOrder(ctx, &market.Order{
		ID:                 "ord-02",
		ProjectID:          "proj-002",
		UserID:             "usr-investor-01",
		OrderType:          market.OrderTypeBuy,
		TokenCount:         15,
		PricePerTokenCents: 9900,
		FilledTokenCount:   0,
		Status:             market.StatusOpen,
		CreatedAt:          now.Add(-1 * time.Hour),
	})
	if fRepo != nil {
		_ = fRepo.SaveInvestment(ctx, &fund.Investment{
			ID:          "inv-seed-01",
			ProjectID:   "proj-001",
			InvestorID:  "usr-investor-01",
			AmountCents: 500000,
			Status:      fund.InvestmentActive,
			CreatedAt:   now.Add(-24 * time.Hour),
		})
	}
}

