package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/maurobanegas43/proyecto_final/backend/internal/application/ports"
	domain "github.com/maurobanegas43/proyecto_final/backend/internal/domain/payment"
)

type MercadoPagoConfig struct {
	AccessToken string
	WebhookKey  string
	BaseURL     string
}

type MercadoPagoGateway struct {
	cfg        MercadoPagoConfig
	httpClient *http.Client
}

func NewMercadoPagoGateway(cfg MercadoPagoConfig) *MercadoPagoGateway {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.mercadopago.com"
	}
	cfg.BaseURL = baseURL

	return &MercadoPagoGateway{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (g *MercadoPagoGateway) Provider() domain.GatewayProvider {
	return domain.ProviderMercadoPago
}

type mpPreferenceItem struct {
	Title       string  `json:"title"`
	Quantity    int     `json:"quantity"`
	CurrencyID  string  `json:"currency_id"`
	UnitPrice   float64 `json:"unit_price"`
	Description string  `json:"description,omitempty"`
}

type mpPreferencePayer struct {
	Email string `json:"email"`
}

type mpPreferenceRequest struct {
	Items             []mpPreferenceItem `json:"items"`
	Payer             mpPreferencePayer  `json:"payer"`
	ExternalReference string             `json:"external_reference"`
	BackURLs          map[string]string  `json:"back_urls,omitempty"`
	NotificationURL   string             `json:"notification_url,omitempty"`
}

type mpPreferenceResponse struct {
	ID               string `json:"id"`
	InitPoint        string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

func (g *MercadoPagoGateway) CreatePayment(ctx context.Context, input ports.GatewayPaymentInput) (*ports.GatewayPaymentOutput, error) {
	// If AccessToken is empty (e.g. running in test or local without live MP secrets), return sandbox fallback
	if g.cfg.AccessToken == "" {
		extID := fmt.Sprintf("mp_pref_%s", input.PaymentID)
		return &ports.GatewayPaymentOutput{
			ExternalID:  extID,
			CheckoutURL: fmt.Sprintf("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=%s", extID),
			Status:      domain.StatusPending,
		}, nil
	}

	amountDecimal := float64(input.AmountCents) / 100.0
	currency := input.Currency
	if currency == "USD" {
		// In Argentina, Mercado Pago accounts usually settle in ARS or USD depending on account capability
		currency = "USD"
	}

	reqBody := mpPreferenceRequest{
		Items: []mpPreferenceItem{
			{
				Title:       "Depósito en Cuenta Comitente - Krea Nova",
				Quantity:    1,
				CurrencyID:  currency,
				UnitPrice:   amountDecimal,
				Description: input.Description,
			},
		},
		Payer: mpPreferencePayer{
			Email: input.UserEmail,
		},
		ExternalReference: input.PaymentID,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("mercadopago: error marshaling preference request: %w", err)
	}

	url := fmt.Sprintf("%s/checkout/preferences", g.cfg.BaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+g.cfg.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mercadopago: request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("mercadopago: unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var prefResp mpPreferenceResponse
	if err := json.NewDecoder(resp.Body).Decode(&prefResp); err != nil {
		return nil, fmt.Errorf("mercadopago: failed to decode response: %w", err)
	}

	checkoutURL := prefResp.InitPoint
	if prefResp.SandboxInitPoint != "" {
		checkoutURL = prefResp.SandboxInitPoint
	}

	return &ports.GatewayPaymentOutput{
		ExternalID:  prefResp.ID,
		CheckoutURL: checkoutURL,
		Status:      domain.StatusPending,
	}, nil
}

func (g *MercadoPagoGateway) GetPaymentStatus(ctx context.Context, externalID string) (domain.PaymentStatus, error) {
	if g.cfg.AccessToken == "" {
		return domain.StatusPending, nil
	}

	url := fmt.Sprintf("%s/v1/payments/%s", g.cfg.BaseURL, externalID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return domain.StatusPending, err
	}
	req.Header.Set("Authorization", "Bearer "+g.cfg.AccessToken)

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return domain.StatusPending, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return domain.StatusPending, domain.ErrPaymentNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return domain.StatusPending, fmt.Errorf("mercadopago: check payment failed with status %d", resp.StatusCode)
	}

	var mpPayment struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&mpPayment); err != nil {
		return domain.StatusPending, err
	}

	switch mpPayment.Status {
	case "approved":
		return domain.StatusApproved, nil
	case "rejected":
		return domain.StatusRejected, nil
	case "cancelled":
		return domain.StatusCancelled, nil
	default:
		return domain.StatusPending, nil
	}
}

type mpWebhookNotification struct {
	Action string `json:"action"`
	Type   string `json:"type"`
	Data   struct {
		ID string `json:"id"`
	} `json:"data"`
}

func (g *MercadoPagoGateway) ParseWebhook(ctx context.Context, headers map[string][]string, payload []byte) (*ports.WebhookResult, error) {
	var notif mpWebhookNotification
	if err := json.Unmarshal(payload, &notif); err != nil {
		return nil, domain.ErrInvalidWebhook
	}

	if notif.Data.ID == "" {
		return nil, domain.ErrInvalidWebhook
	}

	status, err := g.GetPaymentStatus(ctx, notif.Data.ID)
	if err != nil {
		return nil, err
	}

	return &ports.WebhookResult{
		ExternalID: notif.Data.ID,
		Status:     status,
	}, nil
}
