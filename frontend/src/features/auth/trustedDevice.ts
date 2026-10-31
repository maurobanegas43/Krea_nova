/**
 * Utility for client-side device identification, fingerprinting, and
 * Trusted Device Token management compliant with financial security standards.
 */

export interface DeviceInfo {
  deviceId: string;
  deviceToken: string | null;
  deviceName: string;
  fingerprint: string;
}

const DEVICE_ID_KEY = 'kn_device_id';
const DEVICE_TOKEN_KEY = 'kn_trusted_device_token';

/**
 * Returns or generates a persistent device UUID for this browser.
 */
export function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        deviceId = crypto.randomUUID();
      } else {
        deviceId = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      }
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'dev-ephemeral-' + Date.now();
  }
}

/**
 * Retrieves the stored trusted device token, if any.
 */
export function getTrustedDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the unique cryptographic trusted device token received from backend.
 */
export function saveTrustedDeviceToken(token: string): void {
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch (err) {
    console.warn('Could not save trusted device token:', err);
  }
}

/**
 * Revokes local trust for this device.
 */
export function clearTrustedDeviceToken(): void {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {}
}

/**
 * Detects OS and browser to display a friendly name to the user.
 */
export function getDeviceFriendlyName(): string {
  if (typeof window === 'undefined') return 'Dispositivo Web';

  const ua = navigator.userAgent;
  let browser = 'Navegador Web';
  let os = 'Dispositivo';

  // Detect OS
  if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Detect Browser
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  return `${browser} en ${os}`;
}

/**
 * Generates a stable client fingerprint hash using WebCrypto SHA-256.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server-context';

  const components = [
    navigator.userAgent || '',
    navigator.language || '',
    (window.screen?.width || 0) + 'x' + (window.screen?.height || 0),
    (window.screen?.colorDepth || 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.hardwareConcurrency || 1,
  ].join('|');

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(components);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Simple fallback hash
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
      hash = (hash << 5) - hash + components.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Gathers complete device info ready for authentication payloads.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = getOrCreateDeviceId();
  const deviceToken = getTrustedDeviceToken();
  const deviceName = getDeviceFriendlyName();
  const fingerprint = await getDeviceFingerprint();

  return {
    deviceId,
    deviceToken,
    deviceName,
    fingerprint,
  };
}
