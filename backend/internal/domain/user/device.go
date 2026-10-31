package user

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidDeviceID  = errors.New("device: invalid device id")
	ErrDeviceNotTrusted = errors.New("device: device is not trusted or token expired")
	ErrDeviceRevoked    = errors.New("device: device authorization was revoked")
)

// TrustedDevice represents a registered client device authorized by the user
// to access investment assets, complying with fintech security standards.
type TrustedDevice struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	DeviceID    string    `json:"deviceId"`
	DeviceToken string    `json:"deviceToken"` // Unique cryptographic token for this device
	DeviceName  string    `json:"deviceName"`  // Friendly name e.g. "Chrome en macOS"
	Fingerprint string    `json:"fingerprint"` // Deterministic client signature
	IPAddress   string    `json:"ipAddress"`
	UserAgent   string    `json:"userAgent"`
	IsActive    bool      `json:"isActive"`
	TrustedAt   time.Time `json:"trustedAt"`
	LastUsedAt  time.Time `json:"lastUsedAt"`
}

// NewTrustedDevice instantiates and validates a new trusted device record.
func NewTrustedDevice(id, userID, deviceID, deviceToken, deviceName, fingerprint, ipAddress, userAgent string, now time.Time) (*TrustedDevice, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("device: user id is required")
	}
	cleanDeviceID := strings.TrimSpace(deviceID)
	if cleanDeviceID == "" {
		return nil, ErrInvalidDeviceID
	}
	cleanToken := strings.TrimSpace(deviceToken)
	if cleanToken == "" {
		return nil, errors.New("device: device token is required")
	}

	cleanName := strings.TrimSpace(deviceName)
	if cleanName == "" {
		cleanName = "Dispositivo no identificado"
	}

	return &TrustedDevice{
		ID:          id,
		UserID:      userID,
		DeviceID:    cleanDeviceID,
		DeviceToken: cleanToken,
		DeviceName:  cleanName,
		Fingerprint: strings.TrimSpace(fingerprint),
		IPAddress:   strings.TrimSpace(ipAddress),
		UserAgent:   strings.TrimSpace(userAgent),
		IsActive:    true,
		TrustedAt:   now,
		LastUsedAt:  now,
	}, nil
}
