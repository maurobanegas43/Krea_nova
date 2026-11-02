// Package crypto provides cryptographic utilities for sensitive data protection
// complying with data privacy regulations (e.g., PII encryption at rest).
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidKeySize    = errors.New("crypto: encryption key must be 32 bytes for AES-256")
	ErrCiphertextTooShort = errors.New("crypto: ciphertext too short")
	ErrDecryptionFailed  = errors.New("crypto: authentication or decryption failed")
)

// Encryptor defines the contract for encrypting and decrypting sensitive fields.
type Encryptor interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

// PasswordHasher defines the contract for password hashing and verification.
type PasswordHasher interface {
	HashPassword(password string) (string, error)
	ComparePassword(hash, password string) error
}

// AESGCMEncryptor implements AES-256-GCM encryption with prepended nonce.
type AESGCMEncryptor struct {
	key []byte
}

// NewAESGCMEncryptor initializes an AES-256-GCM encryptor with a 32-byte key.
func NewAESGCMEncryptor(key []byte) (*AESGCMEncryptor, error) {
	if len(key) != 32 {
		return nil, ErrInvalidKeySize
	}
	return &AESGCMEncryptor{key: key}, nil
}

// Encrypt encrypts a plaintext string and returns a base64-encoded payload containing [nonce + ciphertext + tag].
func (e *AESGCMEncryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt decodes a base64 payload and decrypts the AES-GCM ciphertext.
func (e *AESGCMEncryptor) Decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrCiphertextTooShort
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	return string(plaintext), nil
}

// BcryptHasher implements PasswordHasher using bcrypt with configurable cost.
type BcryptHasher struct {
	cost int
}

// NewBcryptHasher creates a hasher with the recommended cost (at least 12).
func NewBcryptHasher(cost int) *BcryptHasher {
	if cost < bcrypt.DefaultCost {
		cost = bcrypt.DefaultCost
	}
	return &BcryptHasher{cost: cost}
}

// HashPassword hashes a raw password using bcrypt.
func (h *BcryptHasher) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), h.cost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ComparePassword compares a hashed password with its possible plaintext equivalent.
func (h *BcryptHasher) ComparePassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// HashSHA256 returns a hex-encoded SHA-256 digest of the input string, suitable for blind index lookups.
func HashSHA256(val string) string {
	sum := sha256.Sum256([]byte(val))
	return hex.EncodeToString(sum[:])
}
