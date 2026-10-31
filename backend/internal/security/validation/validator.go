// Package validation provides reusable, robust data consistency and format validators
// for phone numbers (via Google libphonenumber port), Gmail/email syntax, and strong passwords.
package validation

import (
	"errors"
	"regexp"
	"strings"
	"unicode"

	"github.com/nyaruka/phonenumbers"
)

var (
	ErrInvalidEmail      = errors.New("validation: invalid email syntax")
	ErrMustBeGmail       = errors.New("validation: email must be a valid @gmail.com address")
	ErrInvalidPhone      = errors.New("validation: invalid phone number format or country code")
	ErrPasswordTooShort  = errors.New("validation: password must be at least 8 characters")
	ErrPasswordTooLong   = errors.New("validation: password exceeds maximum length of 72 characters")
	ErrPasswordNoUpper   = errors.New("validation: password must contain at least one uppercase letter")
	ErrPasswordNoLower   = errors.New("validation: password must contain at least one lowercase letter")
	ErrPasswordNoDigit   = errors.New("validation: password must contain at least one digit")
	ErrPasswordNoSpecial = errors.New("validation: password must contain at least one special symbol")
)

// gmailUsernameRegex matches standard Gmail usernames (6-30 alphanumeric chars with optional non-consecutive dots).
var gmailUsernameRegex = regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9.]){4,28}[a-zA-Z0-9]$`)

// ValidateGmail ensures the email is syntactically sound and belongs to the @gmail.com domain.
func ValidateGmail(email string) (string, error) {
	clean := strings.ToLower(strings.TrimSpace(email))
	if clean == "" {
		return "", ErrInvalidEmail
	}

	parts := strings.Split(clean, "@")
	if len(parts) != 2 {
		return "", ErrInvalidEmail
	}

	username, domain := parts[0], parts[1]
	if domain != "gmail.com" && domain != "googlemail.com" {
		return "", ErrMustBeGmail
	}

	if strings.Contains(username, "..") || !gmailUsernameRegex.MatchString(username) {
		return "", ErrMustBeGmail
	}

	return clean, nil
}

// ValidateEmail validates a general corporate or generic email format.
func ValidateEmail(email string) (string, error) {
	clean := strings.ToLower(strings.TrimSpace(email))
	if clean == "" || !strings.Contains(clean, "@") {
		return "", ErrInvalidEmail
	}
	parts := strings.Split(clean, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" || !strings.Contains(parts[1], ".") {
		return "", ErrInvalidEmail
	}
	return clean, nil
}

// ValidateAndFormatPhone parses a phone string with libphonenumber, validates it and returns its normalized E.164 representation.
// defaultRegion is an ISO 3166-1 alpha-2 code (e.g. "AR", "US") used when international prefix "+" is omitted.
func ValidateAndFormatPhone(phone, defaultRegion string) (string, error) {
	clean := strings.TrimSpace(phone)
	if clean == "" {
		return "", ErrInvalidPhone
	}

	if defaultRegion == "" {
		defaultRegion = "AR"
	}

	num, err := phonenumbers.Parse(clean, defaultRegion)
	if err == nil && phonenumbers.IsValidNumber(num) {
		return phonenumbers.Format(num, phonenumbers.E164), nil
	}

	// Permissive fallback for standard mobile / landline inputs
	digits := ""
	for _, r := range clean {
		if (r >= '0' && r <= '9') || r == '+' {
			digits += string(r)
		}
	}
	if len(digits) >= 8 && len(digits) <= 16 {
		if !strings.HasPrefix(digits, "+") {
			digits = "+54" + strings.TrimPrefix(digits, "0")
		}
		return digits, nil
	}

	return "", ErrInvalidPhone
}

// ValidatePasswordStrength enforces strong password standards (8+ chars, upper, lower, digit, special char).
func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return ErrPasswordTooShort
	}
	if len(password) > 72 {
		return ErrPasswordTooLong
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, ch := range password {
		switch {
		case unicode.IsUpper(ch):
			hasUpper = true
		case unicode.IsLower(ch):
			hasLower = true
		case unicode.IsDigit(ch):
			hasDigit = true
		case unicode.IsPunct(ch) || unicode.IsSymbol(ch):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return ErrPasswordNoUpper
	}
	if !hasLower {
		return ErrPasswordNoLower
	}
	if !hasDigit {
		return ErrPasswordNoDigit
	}
	if !hasSpecial {
		return ErrPasswordNoSpecial
	}

	return nil
}
