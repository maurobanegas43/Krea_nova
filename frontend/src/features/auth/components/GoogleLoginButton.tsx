import React, { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface GoogleLoginButtonProps {
  onSuccess: (data: {
    email: string;
    name?: string;
    picture?: string;
    idToken: string;
  }) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
  text?: string;
}

// Module-level state to guarantee Google GSI is initialized only once across renders & StrictMode
let gsiInitialized = false;
let activeSuccessCallback: ((data: { email: string; name?: string; picture?: string; idToken: string }) => void) | null = null;
let activeErrorCallback: ((err: string) => void) | null = null;

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  isLoading = false,
  text = 'Continuar con Google',
}) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const hiddenBtnRef = useRef<HTMLDivElement>(null);

  // Keep references to current callbacks without triggering re-initialization
  useEffect(() => {
    activeSuccessCallback = onSuccess;
    activeErrorCallback = onError || null;
  }, [onSuccess, onError]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const setup = () => {
      if (!window.google?.accounts?.id || !clientId) return false;

      // Initialize GSI once globally
      if (!gsiInitialized) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (!response.credential) {
                activeErrorCallback?.('No se recibió la credencial de Google.');
                return;
              }

              try {
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                  atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
                );
                const payload = JSON.parse(jsonPayload);
                activeSuccessCallback?.({
                  email: payload.email,
                  name: payload.name,
                  picture: payload.picture,
                  idToken: response.credential,
                });
              } catch {
                activeErrorCallback?.('Error al procesar el token de Google');
              }
            },
          });
          gsiInitialized = true;
        } catch (err) {
          console.warn('Google GSI initialization notice:', err);
        }
      }

      // Render native button into hidden container for reliable iframe click interception
      if (hiddenBtnRef.current && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.renderButton(hiddenBtnRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            width: 360,
          });
        } catch (renderErr) {
          console.warn('renderButton notice:', renderErr);
        }
      }

      return true;
    };

    if (!setup()) {
      interval = setInterval(() => {
        if (setup()) {
          if (interval) clearInterval(interval);
        }
      }, 150);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [clientId]);

  const handleClick = () => {
    if (isLoading) return;

    // Try finding the native Google iframe or button to trigger it directly
    const nativeBtn = hiddenBtnRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
    if (nativeBtn) {
      nativeBtn.click();
      return;
    }

    // Fallback to prompt() if native button element is not clickable
    if (window.google?.accounts?.id && clientId) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification && typeof notification.isNotDisplayed === 'function' && notification.isNotDisplayed()) {
          const reason = typeof notification.getNotDisplayedReason === 'function' ? notification.getNotDisplayedReason() : '';
          if (reason === 'unregistered_origin') {
            activeErrorCallback?.('Origen no autorizado en Google Cloud Console para este Client ID (http://localhost:5173).');
          }
        }
      });
    } else {
      activeErrorCallback?.('Servicio de Google Identity Services no disponible.');
    }
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Hidden container where Google renders its native button iframe */}
      <div
        ref={hiddenBtnRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.001,
          zIndex: 2,
          overflow: 'hidden',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          pointerEvents: isLoading ? 'none' : 'auto',
        }}
      />

      {/* Styled Branded Button (Visible to user) */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleClick}
        style={{
          width: '100%',
          height: '46px',
          borderRadius: '12px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--surface-glass-border)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          transition: 'all var(--transition-fast)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {isLoading ? (
          <>
            <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--brand-primary, #6366f1)' }} />
            <span>Verificando con Google...</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{text}</span>
          </>
        )}
      </button>
    </div>
  );
};
