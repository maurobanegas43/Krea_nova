/**
 * Legal & Regulatory Validations for Argentina (Krea Nova Fintech Platform)
 * Based on:
 * - Ley 25.326 (Protección de Datos Personales)
 * - Ley 25.246 / Res. UIF 49/2024 (Prevención de Lavado de Activos / KYC)
 * - Código Civil y Comercial (Capacidad civil y mayoría de edad +18 años)
 * - Ley 19.550 (Sociedades Comerciales)
 */

/**
 * Validates an Argentine CUIT/CUIL using the official Modulo 11 algorithm (AFIP/ARCA).
 */
export function validateCuitCuil(raw: string): { isValid: boolean; message?: string } {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length !== 11) {
    return { isValid: false, message: 'El CUIT/CUIL debe contener exactamente 11 dígitos numéricos.' };
  }

  const prefix = cleaned.substring(0, 2);
  const validPrefixes = ['20', '23', '24', '27', '30', '33', '34'];
  if (!validPrefixes.includes(prefix)) {
    return { isValid: false, message: `Prefijo inválido (${prefix}). Debe ser 20, 23, 24, 27 (personas humanas) o 30, 33, 34 (empresas).` };
  }

  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * multipliers[i];
  }

  const mod = sum % 11;
  let verifier = 11 - mod;
  if (verifier === 11) verifier = 0;
  if (verifier === 10) verifier = 9;

  const actualVerifier = parseInt(cleaned[10], 10);
  if (verifier !== actualVerifier) {
    return { isValid: false, message: 'Dígito verificador de CUIT/CUIL incorrecto (Módulo 11 AFIP/ARCA).' };
  }

  return { isValid: true };
}

/**
 * Validates Argentine DNI format (7 to 8 digits).
 */
export function validateDni(raw: string): { isValid: boolean; message?: string } {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length < 7 || cleaned.length > 8) {
    return { isValid: false, message: 'El DNI debe tener entre 7 y 8 dígitos numéricos.' };
  }
  return { isValid: true };
}

/**
 * Validates that an investor is at least 18 years old (Código Civil y Comercial de la Nación).
 */
export function validateAdultAge(birthDateString: string): { isValid: boolean; age: number; message?: string } {
  if (!birthDateString) {
    return { isValid: false, age: 0, message: 'La fecha de nacimiento es requerida.' };
  }

  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) {
    return { isValid: false, age: 0, message: 'Fecha de nacimiento inválida.' };
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 18) {
    return {
      isValid: false,
      age,
      message: `El titular tiene ${age} años. La normativa legal exige un mínimo de 18 años para operar en inversiones inmobiliarias.`,
    };
  }

  if (age > 120) {
    return { isValid: false, age, message: 'Por favor ingrese una fecha de nacimiento válida.' };
  }

  return { isValid: true, age };
}

/**
 * Validates password complexity for financial security.
 */
export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (password.length < 8) {
    return { isValid: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'La contraseña debe incluir al menos una letra mayúscula.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'La contraseña debe incluir al menos una letra minúscula.' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'La contraseña debe incluir al menos un número.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>\-_=+]/.test(password)) {
    return { isValid: false, message: 'La contraseña debe incluir al menos un símbolo o caracter especial (ej. !, @, #, $, _).' };
  }
  return { isValid: true };
}

/**
 * Validates email format.
 */
export function validateEmail(email: string): { isValid: boolean; message?: string } {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { isValid: false, message: 'Por favor ingrese un correo electrónico válido.' };
  }
  return { isValid: true };
}

/**
 * Validates Gmail domain specifically for investors.
 */
export function validateGmailAddress(email: string): { isValid: boolean; message?: string } {
  const clean = email.trim().toLowerCase();
  const baseCheck = validateEmail(clean);
  if (!baseCheck.isValid) return baseCheck;

  if (!clean.endsWith('@gmail.com') && !clean.endsWith('@googlemail.com')) {
    return { isValid: false, message: 'Para inversores, se requiere una casilla oficial @gmail.com validada.' };
  }
  return { isValid: true };
}

/**
 * Validates Argentine phone number format (at least 10 digits including area code).
 */
export function validatePhoneNumber(raw: string): { isValid: boolean; message?: string } {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) {
    return {
      isValid: false,
      message: 'El teléfono debe incluir código de área y número (mínimo 10 dígitos, ej: 11 4000 8800).',
    };
  }
  if (digits.length > 15) {
    return {
      isValid: false,
      message: 'El número de teléfono excede la longitud permitida.',
    };
  }
  return { isValid: true };
}
