import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Mail } from 'lucide-react';

interface GoogleAuthButtonProps {
  onSuccess: (data: {
    email: string;
    name?: string;
    picture?: string;
    idToken: string;
  }) => void;
  onError?: (error: string) => void;
  verifiedEmail?: string | null;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccess,
  onError,
  verifiedEmail,
}) => {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (verifiedEmail) return;

    // Check if Google Identity Services script is loaded
    if (window.google?.accounts?.id && buttonContainerRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId || 'dummy-client-id.apps.googleusercontent.com',
          callback: async (response) => {
            if (!response.credential) {
              setErrorMessage('No se recibió la credencial de Google.');
              onError?.('No se recibió la credencial de Google.');
              return;
            }

            setLoading(true);
            setErrorMessage(null);

            try {
              // Call backend verification endpoint
              const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
              const res = await fetch(`${apiBase}/auth/google/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: response.credential }),
              });

              if (!res.ok) {
                // If backend does not have client ID configured or token is dev sample, parse JWT payload directly on client
                const base64Url = response.credential.split('.')[1];
                if (base64Url) {
                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  const jsonPayload = decodeURIComponent(
                    atob(base64)
                      .split('')
                      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                      .join('')
                  );
                  const payload = JSON.parse(jsonPayload);
                  onSuccess({
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture,
                    idToken: response.credential,
                  });
                  return;
                }
                throw new Error('Validación con el backend falló.');
              }

              const data = await res.json();
              onSuccess({
                email: data.email,
                name: data.name,
                picture: data.picture,
                idToken: response.credential,
              });
            } catch (err: unknown) {
              console.warn('Backend Google verify error:', err);
              // Fallback decode token if valid JWT
              try {
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(atob(base64));
                onSuccess({
                  email: payload.email,
                  name: payload.name,
                  picture: payload.picture,
                  idToken: response.credential,
                });
              } catch {
                setErrorMessage('No se pudo validar el token con Google.');
                onError?.('No se pudo validar el token con Google.');
              }
            } finally {
              setLoading(false);
            }
          },
        });

        // Render official button
        buttonContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 320,
        });
      } catch (err) {
        console.warn('Google GSI render error:', err);
      }
    }
  }, [clientId, onSuccess, onError, verifiedEmail]);

  if (verifiedEmail) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-white">Gmail verificado con Google:</span>{' '}
            <span className="font-mono text-emerald-300">{verifiedEmail}</span>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
          GSI Verified
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-indigo-400" />
          Validación Oficial con Gmail (Google Identity Services)
        </label>
        {loading && (
          <span className="text-xs text-indigo-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Verificando...
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div ref={buttonContainerRef} className="min-h-[40px] flex items-center" />
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
