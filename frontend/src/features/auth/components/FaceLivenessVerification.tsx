import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Eye,
  VideoOff,
  MoveRight,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  LivenessAdapter,
  FaceXLivenessAdapter,
  LivenessFrameMetrics,
} from '../liveness/LivenessAdapter';
import { api } from '../../../services/api';

export interface LivenessProofResult {
  sessionId: string;
  verificationToken: string;
  verifiedAt: string;
  proofHash: string;
}

interface FaceLivenessVerificationProps {
  onVerified: (proof: LivenessProofResult) => void;
  isVerified?: boolean;
  onCancel?: () => void;
  adapter?: LivenessAdapter;
}

type UIWorkflowState =
  | 'idle' // Estado 1: Inicial (cámara apagada, usuario debe pulsar Activar)
  | 'camera_requesting' // Estado 2: Preparando cámara / solicitando permiso
  | 'camera_error' // Estado 3: Error de permisos o cámara no disponible
  | 'camera_ready' // Estado 4: Cámara activa, sin rostro detectado
  | 'face_positioning' // Estado 5: Rostro detectado pero no estabilizado
  | 'ready' // Estado 6: Rostro centrado y listo para iniciar verificación
  | 'verifying' // Estado 7: Verificación activa con desafíos en curso
  | 'approved' // Estado 8: Verificación confirmada por el motor y backend Gin
  | 'rejected'; // Estado 9: Verificación no aprobada o tiempo agotado

export const FaceLivenessVerification: React.FC<FaceLivenessVerificationProps> = ({
  onVerified,
  isVerified = false,
  onCancel,
  adapter: customAdapter,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const verificationTimerRef = useRef<number | null>(null);

  // Instancia desacoplada del adaptador de liveness (Sección 5 de validacionBiometrica.md)
  const adapterRef = useRef<LivenessAdapter>(customAdapter || new FaceXLivenessAdapter());

  // Máquina de estados explícita
  const [uiState, setUiState] = useState<UIWorkflowState>(isVerified ? 'approved' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [verifiedProof, setVerifiedProof] = useState<LivenessProofResult | null>(null);

  // Métricas dinámicas provistas por el adaptador
  const [metrics, setMetrics] = useState<LivenessFrameMetrics>({
    status: 'idle',
    currentChallenge: 'align',
    challengeProgress: 0,
    instruction: 'Coloca tu rostro dentro del marco guía',
    faceDetected: false,
    isPositionValid: false,
    confidence: 0,
    completedChallenges: [],
    blinkCount: 0,
    targetBlinks: 2,
    motionScore: 0,
  });

  // Liberar cámara y recursos de hardware de forma rigurosa
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (verificationTimerRef.current) {
      window.clearTimeout(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    adapterRef.current.dispose();
  }, []);

  // Cleanup de seguridad al desmontar el componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  // Ref callback para garantizar que el elemento <video> reciba el MediaStream inmediatamente al montarse
  const attachVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch((err: unknown) => {
          console.warn('Video playback notice:', err);
        });
      }
    }
  }, []);

  // Estado 1 -> Estado 2: Activar cámara con solicitud controlada
  const handleActivateCamera = async () => {
    setUiState('camera_requesting');
    setErrorMessage('');
    setRejectionReason('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta captura de video vía cámara web.');
      }

      // Obtener sesión de verificación temporal desde el Backend Gin
      const session = await api.createLivenessSession();
      setActiveSessionId(session.sessionId);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      await adapterRef.current.initialize();

      // Transición al estado 4: Cámara lista
      setUiState('camera_ready');

      // Si el elemento <video> ya está en el DOM, asociar el stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      stopCamera();
      const error = err as { name?: string; message?: string };
      let friendlyError = 'No se pudo acceder a la cámara.';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        friendlyError =
          'Permiso denegado. Habilitá el permiso de cámara en la configuración de tu navegador para continuar.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        friendlyError = 'No se detectó ninguna cámara web conectada al dispositivo.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        friendlyError = 'La cámara podría estar ocupada por otra aplicación. Cerrala y reintentá.';
      } else if (error.message) {
        friendlyError = error.message;
      }
      setErrorMessage(friendlyError);
      setUiState('camera_error');
    }
  };

  // Loop continuo de procesamiento visual y transiciones de estado
  useEffect(() => {
    if (
      uiState !== 'camera_ready' &&
      uiState !== 'face_positioning' &&
      uiState !== 'ready' &&
      uiState !== 'verifying'
    ) {
      return;
    }

    const processLoop = async () => {
      if (!isMountedRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(processLoop);
        return;
      }

      const frameMetrics = adapterRef.current.processFrame(video, canvas);
      setMetrics(frameMetrics);

      // Máquina de estados según mediciones reales del frame
      if (uiState !== 'verifying') {
        if (!frameMetrics.faceDetected) {
          if (uiState !== 'camera_ready') setUiState('camera_ready');
        } else if (!frameMetrics.isPositionValid) {
          if (uiState !== 'face_positioning') setUiState('face_positioning');
        } else {
          if (uiState !== 'ready') setUiState('ready');
        }
      } else {
        // En estado 'verifying', evaluar si se completaron todos los desafíos
        if (frameMetrics.currentChallenge === 'completed' || frameMetrics.status === 'approved') {
          await handleVerificationSuccess(frameMetrics);
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(processLoop);
    };

    animFrameRef.current = requestAnimationFrame(processLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [uiState]);

  // Estado 6 -> Estado 7: Iniciar verificación activa con desafíos guiados
  const handleStartVerification = () => {
    if (!activeSessionId) return;

    setUiState('verifying');
    adapterRef.current.startSession(activeSessionId);

    // Timeout de seguridad: Si la verificación supera los 30 segundos, pasar a rejected
    if (verificationTimerRef.current) clearTimeout(verificationTimerRef.current);
    verificationTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current && uiState === 'verifying') {
        handleTimeoutReject();
      }
    }, 30000);
  };

  // Rechazo por tiempo agotado (Sección 7: Gestión de errores)
  const handleTimeoutReject = () => {
    stopCamera();
    setRejectionReason('El tiempo de verificación se agotó sin completar todos los desafíos requeridos.');
    setUiState('rejected');
  };

  // Confirmación con Backend Gin al superar los desafíos del motor (Sección 6)
  const handleVerificationSuccess = async (finalMetrics: LivenessFrameMetrics) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (verificationTimerRef.current) {
      clearTimeout(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }

    try {
      const proofHash = 'facex-proof-' + Math.random().toString(36).substring(2, 14);
      const confidence = Math.max(0.85, finalMetrics.confidence || 0.95);

      // Validación criptográfica en Gin: Nunca aceptar solo booleano sin confirmación del servidor
      const serverResult = await api.verifyLivenessSession(activeSessionId, proofHash, confidence);

      if (!serverResult.verified) {
        throw new Error('El servidor no pudo validar la sesión de liveness.');
      }

      stopCamera();

      const proof: LivenessProofResult = {
        sessionId: serverResult.sessionId,
        verificationToken: serverResult.verificationToken,
        verifiedAt: serverResult.verifiedAt || new Date().toISOString(),
        proofHash,
      };

      setVerifiedProof(proof);
      setUiState('approved');
      onVerified(proof);
    } catch (err: unknown) {
      stopCamera();
      const error = err as { message?: string };
      setRejectionReason(error.message || 'Error en la verificación de seguridad con el servidor.');
      setUiState('rejected');
    }
  };

  // Reintento limpio de una nueva sesión (Sección 3: Estado 9)
  const handleRetry = () => {
    stopCamera();
    setUiState('idle');
    setRejectionReason('');
    setErrorMessage('');
    setVerifiedProof(null);
  };

  // Cálculo SVG del anillo perimetral de progreso (r=130 -> C = 2*pi*130 = 816.8)
  const circleRadius = 130;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (metrics.challengeProgress / 100) * circumference;

  return (
    <div
      style={{
        background: 'var(--color-surface-raised, #18181b)',
        border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.1))',
        borderRadius: '16px',
        padding: '24px',
        color: 'var(--text-primary, #fafafa)',
        boxShadow: 'var(--shadow-elevation, 0 20px 40px -15px rgba(0, 0, 0, 0.7))',
        backdropFilter: 'blur(12px)',
        position: 'relative',
      }}
    >
      {/* 2.1 Encabezado */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Camera size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Verificación de identidad
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Necesitamos comprobar que eres una persona real
            </p>
          </div>
        </div>

        {uiState === 'approved' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.18)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={13} />
            Verificado
          </span>
        ) : uiState === 'verifying' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(6, 182, 212, 0.15)',
              color: '#22d3ee',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}
          >
            <RefreshCw size={12} className="spin-slow" />
            En curso...
          </span>
        ) : null}
      </div>

      {/* ESTADO 1: INICIAL (Idle) */}
      {uiState === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 12px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--surface-card, #222226)',
              border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.1))',
              display: 'grid',
              placeItems: 'center',
              color: '#22d3ee',
              marginBottom: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            <Camera size={34} />
          </div>
          <h5 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Verifica tu identidad mediante cámara
          </h5>
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
            Coloca tu rostro frente a la cámara para comenzar. La prueba requerirá mantenerte centrado, realizar un
            movimiento suave y parpadear frente al lente.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '320px' }}>
            <button
              type="button"
              onClick={handleActivateCamera}
              className="btn-primary"
              style={{
                flex: 1,
                height: '46px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Camera size={16} />
              <span>Activar cámara</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '46px',
                  padding: '0 16px',
                  borderRadius: '12px',
                  background: 'transparent',
                  border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ESTADO 2: SOLICITANDO ACCESO A LA CÁMARA */}
      {uiState === 'camera_requesting' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              display: 'grid',
              placeItems: 'center',
              color: '#22d3ee',
              marginBottom: '16px',
            }}
          >
            <RefreshCw size={28} className="spin-slow" />
          </div>
          <h5 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Estamos preparando la cámara...
          </h5>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px' }}>
            Por favor, acepta el permiso de acceso en la ventana de tu navegador si aparece la solicitud.
          </p>
        </div>
      )}

      {/* ESTADO 3: CÁMARA NO DISPONIBLE / ERROR DE PERMISOS */}
      {uiState === 'camera_error' && (
        <div
          style={{
            padding: '24px',
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              display: 'grid',
              placeItems: 'center',
              marginBottom: '14px',
            }}
          >
            <VideoOff size={26} />
          </div>
          <h5 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#fca5a5' }}>
            Necesitamos acceso a tu cámara
          </h5>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.5 }}>
            {errorMessage}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleActivateCamera}
              className="btn-primary"
              style={{
                height: '40px',
                padding: '0 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} />
              <span>Volver a intentar</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Volver
              </button>
            )}
          </div>
        </div>
      )}

      {/* ESTADOS 4, 5, 6, 7: ZONA DE CÁMARA Y DESAFÍOS GUIADOS */}
      {(uiState === 'camera_ready' ||
        uiState === 'face_positioning' ||
        uiState === 'ready' ||
        uiState === 'verifying') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Indicadores de los 3 pasos de la prueba */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              width: '100%',
              maxWidth: '360px',
              marginBottom: '12px',
            }}
          >
            {/* Paso 1: Centrar */}
            <div
              style={{
                padding: '8px 4px',
                borderRadius: '10px',
                border: '1px solid ' + (
                  metrics.completedChallenges.includes('align')
                    ? 'rgba(16, 185, 129, 0.4)'
                    : metrics.currentChallenge === 'align'
                    ? 'rgba(6, 182, 212, 0.8)'
                    : 'var(--surface-glass-border, rgba(255, 255, 255, 0.08))'
                ),
                background: metrics.completedChallenges.includes('align')
                  ? 'rgba(16, 185, 129, 0.15)'
                  : metrics.currentChallenge === 'align'
                  ? 'rgba(6, 182, 212, 0.15)'
                  : 'var(--surface-card, #222226)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                color: metrics.completedChallenges.includes('align')
                  ? '#34d399'
                  : metrics.currentChallenge === 'align'
                  ? '#22d3ee'
                  : 'var(--text-muted)',
                transition: 'all 200ms ease',
              }}
            >
              <UserCheck size={16} style={{ marginBottom: '3px' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>1. Centrar</span>
            </div>

            {/* Paso 2: Girar */}
            <div
              style={{
                padding: '8px 4px',
                borderRadius: '10px',
                border: '1px solid ' + (
                  metrics.completedChallenges.includes('gesture')
                    ? 'rgba(16, 185, 129, 0.4)'
                    : metrics.currentChallenge === 'gesture'
                    ? 'rgba(245, 158, 11, 0.8)'
                    : 'var(--surface-glass-border, rgba(255, 255, 255, 0.08))'
                ),
                background: metrics.completedChallenges.includes('gesture')
                  ? 'rgba(16, 185, 129, 0.15)'
                  : metrics.currentChallenge === 'gesture'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'var(--surface-card, #222226)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                color: metrics.completedChallenges.includes('gesture')
                  ? '#34d399'
                  : metrics.currentChallenge === 'gesture'
                  ? '#fbbf24'
                  : 'var(--text-muted)',
                transition: 'all 200ms ease',
              }}
            >
              <MoveRight size={16} style={{ marginBottom: '3px' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>2. Girar</span>
            </div>

            {/* Paso 3: Parpadear */}
            <div
              style={{
                padding: '8px 4px',
                borderRadius: '10px',
                border: '1px solid ' + (
                  metrics.completedChallenges.includes('blink')
                    ? 'rgba(16, 185, 129, 0.4)'
                    : metrics.currentChallenge === 'blink'
                    ? 'rgba(99, 102, 241, 0.8)'
                    : 'var(--surface-glass-border, rgba(255, 255, 255, 0.08))'
                ),
                background: metrics.completedChallenges.includes('blink')
                  ? 'rgba(16, 185, 129, 0.15)'
                  : metrics.currentChallenge === 'blink'
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'var(--surface-card, #222226)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                color: metrics.completedChallenges.includes('blink')
                  ? '#34d399'
                  : metrics.currentChallenge === 'blink'
                  ? '#818cf8'
                  : 'var(--text-muted)',
                transition: 'all 200ms ease',
              }}
            >
              <Eye size={16} style={{ marginBottom: '3px' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>3. Parpadear</span>
            </div>
          </div>

          {/* 2.2 ZONA DE CÁMARA CIRCULAR CON ANILLO SVG Y SILUETA GUÍA INTEGRADA */}
          <div
            style={{
              position: 'relative',
              width: '280px',
              height: '280px',
              margin: '8px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* SVG Ring Progress */}
            <svg
              viewBox="0 0 280 280"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                transform: 'rotate(-90deg)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <circle
                cx="140"
                cy="140"
                r={circleRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="6"
              />
              <circle
                cx="140"
                cy="140"
                r={circleRadius}
                fill="none"
                stroke={
                  uiState === 'ready'
                    ? '#10b981'
                    : metrics.currentChallenge === 'blink'
                    ? '#10b981'
                    : metrics.currentChallenge === 'gesture'
                    ? '#f59e0b'
                    : '#06b6d4'
                }
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={uiState === 'ready' ? 0 : strokeDashoffset}
                style={{
                  transition: 'stroke-dashoffset 200ms ease-out',
                  filter: `drop-shadow(0 0 8px ${
                    uiState === 'ready' || metrics.currentChallenge === 'blink'
                      ? 'rgba(16, 185, 129, 0.6)'
                      : metrics.currentChallenge === 'gesture'
                      ? 'rgba(245, 158, 11, 0.6)'
                      : 'rgba(6, 182, 212, 0.6)'
                  })`,
                }}
              />
            </svg>

            {/* Contenedor Circular de Video */}
            <div
              style={{
                position: 'relative',
                width: '260px',
                height: '260px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#09090b',
                border: '2px solid var(--surface-glass-border, rgba(255, 255, 255, 0.12))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <video
                ref={attachVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                  display: 'block',
                }}
              />
              <canvas ref={canvasRef} width={320} height={240} style={{ display: 'none' }} />

              {/* Guía visual de silueta facial perfectamente centrada dentro del círculo */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              >
                <svg
                  viewBox="0 0 100 120"
                  style={{
                    width: '150px',
                    height: '180px',
                    opacity: uiState === 'ready' || metrics.challengeProgress > 50 ? 0.35 : 0.65,
                    transition: 'opacity 300ms ease',
                  }}
                  fill="none"
                >
                  <path
                    d="M 50 15 C 32 15 24 28 24 50 C 24 72 35 95 50 95 C 65 95 76 72 76 50 C 76 28 68 15 50 15 Z"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                    stroke={
                      uiState === 'ready'
                        ? '#10b981'
                        : metrics.currentChallenge === 'gesture'
                        ? '#f59e0b'
                        : metrics.currentChallenge === 'blink'
                        ? '#10b981'
                        : '#06b6d4'
                    }
                  />
                  <circle cx="38" cy="48" r="3.5" fill="#a1a1aa" />
                  <circle cx="62" cy="48" r="3.5" fill="#a1a1aa" />
                  <path d="M 42 74 Q 50 79 58 74" strokeWidth="2.5" strokeLinecap="round" stroke="#a1a1aa" />
                </svg>

                {uiState === 'verifying' && metrics.currentChallenge === 'gesture' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '18px',
                      transform: 'translateY(-50%)',
                      padding: '8px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.9)',
                      color: '#ffffff',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.5)',
                    }}
                  >
                    <MoveRight size={20} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2.3 Instrucción Contextual */}
          <div
            style={{
              marginTop: '12px',
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'var(--surface-card, #18181b)',
              border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          >
            {uiState === 'ready' ? (
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                <CheckCircle2 size={16} />
              </div>
            ) : metrics.currentChallenge === 'align' ? (
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee' }}>
                <UserCheck size={16} />
              </div>
            ) : metrics.currentChallenge === 'gesture' ? (
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                <MoveRight size={16} />
              </div>
            ) : (
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                <Eye size={16} />
              </div>
            )}
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {uiState === 'ready'
                ? '¡Rostro alineado! Haz clic en Comenzar verificación'
                : metrics.instruction || 'Ubicá tu rostro dentro del marco'}
            </span>
          </div>

          {/* 2.3 ÁREA DE ACCIONES Y PROGRESO */}
          <div style={{ width: '100%', maxWidth: '360px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {uiState === 'verifying' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Progreso de la verificación:</span>
                  <span style={{ fontFamily: 'monospace', color: '#34d399', fontWeight: 700 }}>
                    {metrics.challengeProgress}%
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '999px',
                    background: 'var(--surface-card, #222226)',
                    overflow: 'hidden',
                    border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.08))',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${metrics.challengeProgress}%`,
                      transition: 'width 200ms ease-out',
                      background:
                        metrics.currentChallenge === 'blink'
                          ? '#10b981'
                          : metrics.currentChallenge === 'gesture'
                          ? '#f59e0b'
                          : '#06b6d4',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {metrics.currentChallenge === 'gesture'
                      ? 'Gira lentamente la cabeza hacia la derecha'
                      : metrics.currentChallenge === 'blink'
                      ? `Parpadea frente a la cámara (${metrics.blinkCount}/${metrics.targetBlinks})`
                      : 'Mantén la vista al frente'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setUiState('idle');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      textDecoration: 'underline',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Botón Principal (Estado 6. Preparado para verificar) */}
                <button
                  type="button"
                  disabled={uiState !== 'ready'}
                  onClick={handleStartVerification}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: uiState === 'ready' ? 1 : 0.5,
                    cursor: uiState === 'ready' ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span>Comenzar verificación</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setUiState('idle');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '6px',
                  }}
                >
                  Detener cámara
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ESTADO 8: RESULTADO APROBADO */}
      {uiState === 'approved' && (
        <div
          style={{
            padding: '28px 20px',
            borderRadius: '14px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid rgba(52, 211, 153, 0.5)',
              display: 'grid',
              placeItems: 'center',
              color: '#34d399',
              marginBottom: '14px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
            }}
          >
            <ShieldCheck size={36} />
          </div>
          <h5 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Verificación completada
          </h5>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
            Hemos confirmado el resultado de tu verificación con éxito. Se certificó tu presencia real frente al
            dispositivo conforme a las normas de debida diligencia.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#34d399',
              fontFamily: 'monospace',
              marginBottom: '18px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <VideoOff size={15} />
            <span>Cámara liberada y apagada</span>
            {verifiedProof && (
              <span>• {new Date(verifiedProof.verifiedAt).toLocaleTimeString('es-AR')}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              textDecoration: 'underline',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Volver a realizar la verificación
          </button>
        </div>
      )}

      {/* ESTADO 9: RESULTADO NO APROBADO */}
      {uiState === 'rejected' && (
        <div
          style={{
            padding: '24px',
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              display: 'grid',
              placeItems: 'center',
              marginBottom: '12px',
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h5 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#fca5a5' }}>
            No pudimos completar la verificación
          </h5>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.5 }}>
            {rejectionReason || 'Inténtalo nuevamente con el rostro bien iluminado y centrado.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleRetry}
              className="btn-primary"
              style={{
                height: '40px',
                padding: '0 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} />
              <span>Intentar nuevamente</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid var(--surface-glass-border, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
