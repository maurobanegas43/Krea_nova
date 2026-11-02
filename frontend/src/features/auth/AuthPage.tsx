import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlertCircle,
  AlertTriangle,
  Laptop,
  CheckCircle2,
  Fingerprint,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import {
  validatePassword,
  validateEmail,
  validateGmailAddress,
  validateDni,
  validatePhoneNumber,
} from './legalValidation';
import { GoogleLoginButton } from './components/GoogleLoginButton';
import { FaceLivenessVerification, LivenessProofResult } from './components/FaceLivenessVerification';
import { getDeviceInfo, saveTrustedDeviceToken, DeviceInfo } from './trustedDevice';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, loginWithGoogle, registerInvestor, registerCorporate } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Mode: login or register
  const [isLogin, setIsLogin] = useState<boolean>(searchParams.get('mode') !== 'register');
  const [role, setRole] = useState<'investor' | 'developer'>('investor');

  // Account type dropdown (replaces the two side-by-side profile cards)
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRoleMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setIsRoleMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsRoleMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRoleMenuOpen]);

  // Step state for register wizard (Investor: 1: Contact, 2: FaceX Liveness, 3: Legal Data, 4: Declarations)
  const [registerStep, setRegisterStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Login & Trusted Device state
  const [googleLoginState, setGoogleLoginState] = useState<'idle' | 'loading' | 'consent' | 'trusted_device' | 'unassociated_error'>('idle');
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleUserData, setGoogleUserData] = useState<{ email: string; name?: string; picture?: string; idToken: string } | null>(null);
  const [detectedDevice, setDetectedDevice] = useState<DeviceInfo | null>(null);
  const [trustDeviceConsent, setTrustDeviceConsent] = useState(true);

  // Google GSI & FaceX Biometrics state (Investor onboarding)
  const [googleVerifiedEmail, setGoogleVerifiedEmail] = useState<string | null>(null);
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [googleAuthNotice, setGoogleAuthNotice] = useState<string | null>(null);
  const [googleRegisterLoading, setGoogleRegisterLoading] = useState(false);
  const [livenessProof, setLivenessProof] = useState<LivenessProofResult | null>(null);

  // Common credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  // Investor specific fields
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');

  // Corporate specific fields
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');

  // Step 1 validation state
  const [isValidatingStep1, setIsValidatingStep1] = useState(false);

  // Form error states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setIsLogin(false);
    } else if (searchParams.get('mode') === 'login') {
      setIsLogin(true);
    }
  }, [searchParams]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setFormErrors({ email: emailCheck.message || 'Email inválido' });
      return;
    }
    if (!password) {
      setFormErrors({ password: 'Debe ingresar su contraseña' });
      return;
    }

    try {
      await login(email, password, role);
      navigate('/app');
    } catch (err: any) {
      setFormErrors({ password: err.message || 'Credenciales inválidas' });
    }
  };

  // Google Login initiation & association validation
  const handleGoogleLoginInitiate = async (data: {
    email: string;
    name?: string;
    picture?: string;
    idToken: string;
  }) => {
    setGoogleLoginState('loading');
    setGoogleAuthError(null);
    setGoogleUserData(data);

    try {
      const devInfo = await getDeviceInfo();
      setDetectedDevice(devInfo);

      // Attempt login with userConsent: false to check association & consent first
      const res = await api.googleLogin({
        idToken: data.idToken,
        deviceId: devInfo.deviceId,
        deviceToken: devInfo.deviceToken || undefined,
        deviceName: devInfo.deviceName,
        fingerprint: devInfo.fingerprint,
        userConsent: false,
        authorizeDevice: false,
      });

      if (res.requiresUserConsent) {
        setGoogleLoginState('consent');
        return;
      }

      if (res.requiresDeviceAuthorization) {
        setGoogleLoginState('trusted_device');
        return;
      }

      if (res.trustedDevice?.deviceToken) {
        saveTrustedDeviceToken(res.trustedDevice.deviceToken);
      }
      await loginWithGoogle(res);
      navigate('/app');
    } catch (err: any) {
      if (err.code === 'ACCOUNT_NOT_ASSOCIATED' || err.status === 404) {
        setGoogleLoginState('unassociated_error');
      } else {
        setGoogleAuthError(err.message || 'Error al iniciar sesión con Google');
        setGoogleLoginState('idle');
      }
    }
  };

  // Explicit user consent given to start session
  const handleConfirmGoogleConsent = async () => {
    if (!googleUserData || !detectedDevice) return;
    setGoogleLoginState('loading');
    setGoogleAuthError(null);

    try {
      const res = await api.googleLogin({
        idToken: googleUserData.idToken,
        deviceId: detectedDevice.deviceId,
        deviceToken: detectedDevice.deviceToken || undefined,
        deviceName: detectedDevice.deviceName,
        fingerprint: detectedDevice.fingerprint,
        userConsent: true,
        authorizeDevice: false,
      });

      if (res.requiresDeviceAuthorization) {
        setGoogleLoginState('trusted_device');
        return;
      }

      if (res.trustedDevice?.deviceToken) {
        saveTrustedDeviceToken(res.trustedDevice.deviceToken);
      }
      await loginWithGoogle(res);
      navigate('/app');
    } catch (err: any) {
      if (err.code === 'ACCOUNT_NOT_ASSOCIATED' || err.status === 404) {
        setGoogleLoginState('unassociated_error');
      } else {
        setGoogleAuthError(err.message || 'Error al validar consentimiento');
        setGoogleLoginState('idle');
      }
    }
  };

  // Explicit device authorization confirmed
  const handleConfirmDeviceAuthorization = async () => {
    if (!googleUserData || !detectedDevice) return;
    setGoogleLoginState('loading');
    setGoogleAuthError(null);

    try {
      const res = await api.googleLogin({
        idToken: googleUserData.idToken,
        deviceId: detectedDevice.deviceId,
        deviceName: detectedDevice.deviceName,
        fingerprint: detectedDevice.fingerprint,
        userConsent: true,
        authorizeDevice: true, // Registers this device as trusted and issues unique token
      });

      if (res.trustedDevice?.deviceToken) {
        saveTrustedDeviceToken(res.trustedDevice.deviceToken);
      }
      await loginWithGoogle(res);
      navigate('/app');
    } catch (err: any) {
      setGoogleAuthError(err.message || 'Fallo al autorizar el dispositivo de confianza');
      setGoogleLoginState('trusted_device');
    }
  };

  // Google Registration Autofill Success Handler
  const handleGoogleRegisterSuccess = async (data: { email: string; name?: string; picture?: string; idToken: string }) => {
    setGoogleRegisterLoading(false);
    setGoogleAuthNotice(null);
    setFormErrors((prev) => {
      const copy = { ...prev };
      delete copy.googleAuth;
      return copy;
    });

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const verifyRes = await fetch(`${apiBase}/auth/google/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: data.idToken }),
      });

      let candidateEmail = data.email;
      let candidateName = data.name;
      let isAlreadyRegistered = false;

      if (verifyRes.ok) {
        const verifiedData = await verifyRes.json();
        if (verifiedData.email) candidateEmail = verifiedData.email;
        if (verifiedData.name) candidateName = verifiedData.name;
        if (verifiedData.alreadyRegistered) isAlreadyRegistered = true;
      }

      // Validar si la cuenta de Google ya se encuentra en la base de datos
      if (!isAlreadyRegistered) {
        const check = await api.checkUserAvailability({ email: candidateEmail });
        if (check.emailExists) isAlreadyRegistered = true;
      }

      if (isAlreadyRegistered) {
        setGoogleIdToken(null);
        setGoogleVerifiedEmail(null);
        setGoogleAuthNotice(null);
        setFormErrors((prev) => ({
          ...prev,
          email: 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión.',
          googleAuth: `La cuenta de Google (${candidateEmail}) ya está registrada en el sistema. No podés crear una cuenta duplicada. Por favor iniciá sesión con tus credenciales.`,
          step1: 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión con su cuenta.',
        }));
        return;
      }

      // Si no está registrado, se autocompletan los datos y se habilita la continuidad
      if (candidateName && !fullName) {
        setFullName(candidateName);
      }
      if (candidateEmail) {
        setEmail(candidateEmail);
        setGoogleVerifiedEmail(candidateEmail);
      }
      setGoogleIdToken(data.idToken);
      setGoogleAuthNotice('✓ Cuenta de Google validada y disponible. Podés continuar con el registro.');
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.email;
        delete copy.googleAuth;
        delete copy.step1;
        return copy;
      });
    } catch {
      // Verificación de respaldo ante contingencias de red
      const check = await api.checkUserAvailability({ email: data.email });
      if (check.emailExists) {
        setGoogleIdToken(null);
        setGoogleVerifiedEmail(null);
        setGoogleAuthNotice(null);
        setFormErrors((prev) => ({
          ...prev,
          email: 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión.',
          googleAuth: `La cuenta de Google (${data.email}) ya está registrada en el sistema. Por favor iniciá sesión.`,
          step1: 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión con su cuenta.',
        }));
        return;
      }

      if (data.name && !fullName) setFullName(data.name);
      if (data.email) {
        setEmail(data.email);
        setGoogleVerifiedEmail(data.email);
      }
      setGoogleIdToken(data.idToken);
      setGoogleAuthNotice('✓ Cuenta de Google validada y disponible para el registro.');
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.email;
        delete copy.googleAuth;
        delete copy.step1;
        return copy;
      });
    }
  };

  // Real-time single field availability check on blur
  const checkSingleFieldAvailability = async (field: 'email' | 'phone' | 'dni', value: string) => {
    const cleanVal = value.trim();
    if (!cleanVal) return;

    if (field === 'dni' && role === 'investor') {
      const c = validateDni(cleanVal);
      if (!c.isValid) return;
      try {
        const res = await api.checkUserAvailability({ dni: cleanVal });
        if (res.dniExists) {
          setFormErrors((prev) => ({
            ...prev,
            dni: 'El DNI ingresado ya está registrado. Ya existe una cuenta asociada a este documento.',
            step1: 'El DNI ingresado ya está registrado. Ingrese otro documento o inicie sesión.',
          }));
        }
      } catch {}
    } else if (field === 'phone') {
      const c = validatePhoneNumber(cleanVal);
      if (!c.isValid) return;
      try {
        const res = await api.checkUserAvailability({ phone: cleanVal });
        if (res.phoneExists) {
          setFormErrors((prev) => ({
            ...prev,
            phone: 'El número de teléfono ya está registrado. Ingrese otro número de teléfono.',
            step1: 'El número de teléfono ya está registrado. Ingrese otro número de teléfono.',
          }));
        }
      } catch {}
    } else if (field === 'email') {
      const c = role === 'investor' ? validateGmailAddress(cleanVal) : validateEmail(cleanVal);
      if (!c.isValid) return;
      try {
        const res = await api.checkUserAvailability({ email: cleanVal });
        if (res.emailExists) {
          setFormErrors((prev) => ({
            ...prev,
            email: 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión.',
            step1: 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión.',
          }));
        }
      } catch {}
    }
  };

  // Step 1 Validation Sequence (Contact, Personal Data & Database Uniqueness before Biometrics)
  const validateStep1 = async (): Promise<boolean> => {
    const errors: Record<string, string> = {};

    // 1. Validar Nombre
    if (role === 'investor') {
      if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
        errors.fullName = 'Ingrese su nombre y apellido completos (mínimo 2 palabras).';
      }
      // 2. Validar DNI
      const dniCheck = validateDni(dni);
      if (!dniCheck.isValid) {
        errors.dni = dniCheck.message || 'El DNI debe tener entre 7 y 8 dígitos numéricos.';
      }
    } else {
      if (!companyName.trim()) {
        errors.companyName = 'Ingrese la Razón Social completa de la empresa.';
      }
    }

    // 3. Validar Correo Electrónico
    if (role === 'investor') {
      const gmailCheck = validateGmailAddress(email);
      if (!gmailCheck.isValid) {
        errors.email = gmailCheck.message || 'Para inversores, se requiere una casilla oficial @gmail.com válida.';
      }
    } else {
      const emailCheck = validateEmail(email);
      if (!emailCheck.isValid) {
        errors.email = emailCheck.message || 'Email corporativo inválido.';
      }
    }

    // 4. Validar Teléfono
    const phoneCheck = validatePhoneNumber(phone);
    if (!phoneCheck.isValid) {
      errors.phone = phoneCheck.message || 'Ingrese un número telefónico de contacto válido con código de área.';
    }

    // 5. Validar Contraseña
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.isValid) {
      errors.password = pwdCheck.message || 'La contraseña debe contener al menos 8 caracteres, mayúscula, minúscula y número.';
    }

    // Si existen fallos de formato, detener la secuencia antes de consultar la DB o avanzar
    if (Object.keys(errors).length > 0) {
      errors.step1 = 'Por favor complete o corrija los campos marcados en rojo antes de continuar a la biometría.';
      setFormErrors(errors);
      return false;
    }

    // 6. Validación secuencial estricta contra la Base de Datos antes de ir a biometría
    setIsValidatingStep1(true);
    try {
      const avail = await api.checkUserAvailability({
        email: email.trim(),
        phone: phone.trim(),
        dni: role === 'investor' && dni.trim() ? dni.trim() : undefined,
      });

      if (!avail.available) {
        const reasons: string[] = [];
        if (avail.emailExists) {
          errors.email = 'El correo ingresado ya está registrado. Ingrese otro correo o inicie sesión.';
          reasons.push('el correo ingresado ya está registrado (ingrese otro correo)');
        }
        if (avail.dniExists) {
          errors.dni = 'El DNI ingresado ya está registrado. Ya existe una cuenta asociada a este documento.';
          reasons.push('el DNI ingresado ya está registrado');
        }
        if (avail.phoneExists) {
          errors.phone = 'El número de teléfono ya está registrado. Ingrese otro número de teléfono.';
          reasons.push('el número de teléfono ya está registrado (ingrese otro número)');
        }

        errors.step1 = `No es posible continuar con el registro: ${reasons.join(', ')}. Cada usuario puede tener una única cuenta en la plataforma.`;
        setFormErrors(errors);
        return false;
      }
    } catch (err: any) {
      console.warn('Error verificando disponibilidad previa a biometría:', err);
    } finally {
      setIsValidatingStep1(false);
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Registration Submit handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerStep === 1) {
      const isValid = await validateStep1();
      if (isValid) {
        setRegisterStep(2);
      }
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      if (role === 'investor') {
        if (!livenessProof) {
          setFormErrors({ liveness: 'Debe completar la prueba de vida biométrica para finalizar el registro.' });
          return;
        }

        await registerInvestor({
          fullName,
          email,
          password,
          phone,
          dni,
          cuil: '',
          birthDate: '2000-01-01',
          address: '',
          city: '',
          province: '',
          isPep: false,
          isObligatedSubject: false,
          fundsOrigin: 'Ahorros personales',
          termsAccepted: true,
          privacyAccepted: true,
          googleIdToken: googleIdToken || undefined,
          livenessVerified: true,
          livenessProofHash: livenessProof.proofHash,
          livenessSessionId: livenessProof.sessionId,
          livenessToken: livenessProof.verificationToken,
        });
      } else {
        await registerCorporate({
          companyName,
          tradeName: tradeName || companyName,
          companyType: 'S.A.',
          cuit: '30-71122334-9',
          registrationNumber: '',
          legalAddress: '',
          repFullName: companyName,
          repRole: 'Apoderado',
          repDni: '',
          repCuil: '',
          email,
          password,
          phone,
          isPep: false,
          uboDeclared: true,
          termsAccepted: true,
          privacyAccepted: true,
        });
      }

      navigate('/app');
    } catch (err: any) {
      const msg = err.message || 'Error registrando usuario';
      if (msg.toLowerCase().includes('dni') || msg.includes('DNI_ALREADY_EXISTS')) {
        setFormErrors({ dni: 'Ya hay una cuenta con ese DNI registrado.' });
        setRegisterStep(1);
      } else if (msg.toLowerCase().includes('teléfono') || msg.toLowerCase().includes('telefono') || msg.includes('phone') || msg.includes('PHONE_ALREADY_EXISTS')) {
        setFormErrors({ phone: 'El número de teléfono ya se encuentra registrado. Ingrese un número de teléfono válido.' });
        setRegisterStep(1);
      } else if (msg.toLowerCase().includes('correo') || msg.toLowerCase().includes('email') || msg.includes('EMAIL_ALREADY_EXISTS') || msg.toLowerCase().includes('already exists')) {
        setFormErrors({ email: 'El correo ya se encuentra registrado. Ingrese un correo electrónico válido.' });
        setRegisterStep(1);
      } else {
        setFormErrors({ general: msg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-bg)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 16px',
        position: 'relative',
        transition: 'background var(--transition-fast), color var(--transition-fast)',
      }}
    >
      {/* Top Bar with Home Link & Theme Switcher */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
          }}
        >
          ← Volver a Krea Nova
        </Link>

        <button
          onClick={toggleTheme}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--btn-secondary-bg)',
            border: '1px solid var(--btn-secondary-border)',
            color: 'var(--text-primary)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
          title={theme === 'dark' ? 'Cambiar a modo Blanco' : 'Cambiar a modo Negro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Brand Header - Pure Bold Typographic Logo (No Square Icon) */}
      {/* Brand Header with Majestic Tree of Life Logo */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          textDecoration: 'none',
          marginBottom: '24px',
          marginTop: isLogin ? '16px' : '40px',
        }}
      >
        <img
          src="/logo-sm.png"
          alt="Krea Nova"
          style={{
            width: '46px',
            height: '46px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 10px var(--brand-gold-glow))',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 900,
              letterSpacing: '0.03em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            KREA NOVA
          </span>
        </div>
      </Link>

      {/* Main Auth Container Card */}
      <div
        style={{
          maxWidth: isLogin ? '440px' : '640px',
          width: '100%',
          padding: 'clamp(24px, 4vw, 36px)',
          borderRadius: '24px',
          background: 'var(--surface-card)',
          border: '1px solid var(--surface-glass-border)',
          boxShadow: 'var(--shadow-elevation)',
          transition: 'all var(--transition-fast)',
        }}
      >
        {/* Toggle Login / Register */}
        <div
          style={{
            display: 'flex',
            background: 'var(--color-surface-raised)',
            padding: '4px',
            borderRadius: '999px',
            marginBottom: '26px',
            border: '1px solid var(--surface-glass-border)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setFormErrors({});
            }}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              color: isLogin ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              background: isLogin ? 'var(--btn-primary-bg)' : 'transparent',
              transition: 'all var(--transition-fast)',
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setFormErrors({});
            }}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              color: !isLogin ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              background: !isLogin ? 'var(--btn-primary-bg)' : 'transparent',
              transition: 'all var(--transition-fast)',
            }}
          >
            Crear Cuenta
          </button>
        </div>

        {/* ---------------- LOGIN VIEW ---------------- */}
        {isLogin ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Ingresá a tu cuenta
              </h1>
            </div>

            {/* Google Authentication for Login */}
            <div style={{ marginBottom: '16px' }}>
              <GoogleLoginButton
                onSuccess={handleGoogleLoginInitiate}
                onError={(err) => setGoogleAuthError(err)}
                isLoading={googleLoginState === 'loading'}
              />
            </div>

            {googleAuthError && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{googleAuthError}</span>
              </div>
            )}

            {/* Visual Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '18px 0',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'var(--surface-glass-border)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                o ingresá con correo
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--surface-glass-border)' }} />
            </div>

            <form onSubmit={handleLoginSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Correo electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    required
                    placeholder="nombre@ejemplo.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    style={{
                      width: '100%',
                      height: '46px',
                      paddingLeft: '42px',
                      paddingRight: '14px',
                      borderRadius: '12px',
                      background: 'var(--color-surface-raised)',
                      border: `1px solid ${formErrors.email ? '#ef4444' : 'var(--surface-glass-border)'}`,
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  />
                  <Mail size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                </div>
                {formErrors.email && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                    {formErrors.email}
                  </span>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                    }}
                    style={{
                      width: '100%',
                      height: '46px',
                      paddingLeft: '42px',
                      paddingRight: '42px',
                      borderRadius: '12px',
                      background: 'var(--color-surface-raised)',
                      border: `1px solid ${formErrors.password ? '#ef4444' : 'var(--surface-glass-border)'}`,
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  />
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '13px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formErrors.password && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                    {formErrors.password}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  marginTop: '6px',
                  gap: '8px',
                }}
              >
                <span>Iniciar Sesión</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Seamless Call to Action for Registration */}
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                ¿Todavía no tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setFormErrors({});
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Registrate gratis
                </button>
              </span>
            </div>

            {/* Modal: Cuenta de Google No Asociada */}
            {googleLoginState === 'unassociated_error' && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(6px)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 120,
                  padding: '20px',
                }}
                onClick={() => setGoogleLoginState('idle')}
              >
                <div
                  style={{
                    maxWidth: '440px',
                    width: '100%',
                    background: 'var(--surface-card)',
                    borderRadius: '20px',
                    padding: '24px',
                    border: '1px solid var(--surface-glass-border)',
                    boxShadow: 'var(--shadow-elevation)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f59e0b',
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Cuenta no asociada
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Validación de cuenta registrada
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    El correo <strong style={{ color: 'var(--text-primary)' }}>{googleUserData?.email}</strong> no se encuentra registrado ni asociado en Krea Nova.
                    Para acceder y operar en la plataforma, debés crear tu cuenta primero.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setIsLogin(false);
                        setRole('investor');
                        if (googleUserData?.email) {
                          setGoogleVerifiedEmail(googleUserData.email);
                          setEmail(googleUserData.email);
                        }
                        if (googleUserData?.name) {
                          setFullName(googleUserData.name);
                        }
                        setGoogleLoginState('idle');
                      }}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        gap: '6px',
                      }}
                    >
                      <span>Crear cuenta con este correo</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoogleLoginState('idle')}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Intentar con otro correo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Confirmación de Consentimiento del Usuario */}
            {googleLoginState === 'consent' && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(6px)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 120,
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    maxWidth: '440px',
                    width: '100%',
                    background: 'var(--surface-card)',
                    borderRadius: '20px',
                    padding: '24px',
                    border: '1px solid var(--surface-glass-border)',
                    boxShadow: 'var(--shadow-elevation)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--brand-primary, #6366f1)',
                        flexShrink: 0,
                      }}
                    >
                      <UserCheck size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Confirmar inicio de sesión
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Autorización explícita requerida
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'var(--color-surface-raised)',
                      border: '1px solid var(--surface-glass-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--brand-primary, #6366f1)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      {googleUserData?.name ? googleUserData.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {googleUserData?.name || 'Inversor Registrado'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {googleUserData?.email}
                      </div>
                    </div>
                    <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    ¿Autorizás el inicio de sesión en Krea Nova con esta cuenta de Google? Se verificará la validez del dispositivo antes de ingresar.
                  </p>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setGoogleLoginState('idle')}
                      style={{
                        flex: 1,
                        height: '42px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleConfirmGoogleConsent}
                      style={{
                        flex: 1.5,
                        height: '42px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        gap: '6px',
                      }}
                    >
                      <span>Autorizar e Ingresar</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Autorización de Dispositivo de Confianza */}
            {googleLoginState === 'trusted_device' && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(6px)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 120,
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    maxWidth: '460px',
                    width: '100%',
                    background: 'var(--surface-card)',
                    borderRadius: '20px',
                    padding: '24px',
                    border: '1px solid var(--surface-glass-border)',
                    boxShadow: 'var(--shadow-elevation)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#10b981',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Dispositivo de Confianza Requerido
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Token único de seguridad por dispositivo
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    Detectamos un acceso desde un nuevo equipo o navegador. Para salvaguardar la custodia de tus activos, Krea Nova exige autorizar cada dispositivo y vincular un token criptográfico único.
                  </p>

                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'var(--color-surface-raised)',
                      border: '1px solid var(--surface-glass-border)',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Laptop size={16} style={{ color: 'var(--brand-primary, #6366f1)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {detectedDevice?.deviceName || 'Navegador Web'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Fingerprint size={14} />
                      <span style={{ fontFamily: 'monospace' }}>
                        Token ID: kn-dev-{detectedDevice?.fingerprint ? detectedDevice.fingerprint.slice(0, 12) : 'gen'}...
                      </span>
                    </div>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      lineHeight: 1.4,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={trustDeviceConsent}
                      onChange={(e) => setTrustDeviceConsent(e.target.checked)}
                      style={{ marginTop: '2px', accentColor: 'var(--brand-primary, #6366f1)', width: '16px', height: '16px' }}
                    />
                    <span>
                      Confío en este dispositivo y autorizo a Krea Nova a registrar un token único de acceso seguro para futuras sesiones.
                    </span>
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setGoogleLoginState('idle')}
                      style={{
                        flex: 1,
                        height: '42px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!trustDeviceConsent}
                      onClick={handleConfirmDeviceAuthorization}
                      style={{
                        flex: 1.6,
                        height: '42px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        gap: '6px',
                        opacity: !trustDeviceConsent ? 0.6 : 1,
                        cursor: !trustDeviceConsent ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>Autorizar Dispositivo</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Recuperación */}
            {forgotPasswordOpen && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(4px)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 100,
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    maxWidth: '420px',
                    width: '100%',
                    background: 'var(--surface-card)',
                    borderRadius: '20px',
                    padding: '28px',
                    border: '1px solid var(--surface-glass-border)',
                    boxShadow: 'var(--shadow-elevation)',
                  }}
                >
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                    Recuperá tu contraseña
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
                    Ingresá tu correo electrónico y te enviaremos las instrucciones para restablecer tu contraseña en minutos.
                  </p>
                  <input
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    defaultValue={email}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      background: 'var(--color-surface-raised)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      marginBottom: '16px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordOpen(false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--surface-glass-border)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        alert('Te enviamos un enlace a tu correo para restablecer tu contraseña.');
                        setForgotPasswordOpen(false);
                      }}
                      className="btn-primary"
                      style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px' }}
                    >
                      Enviar enlace
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ---------------- REGISTER VIEW (DUAL PROFILES) ---------------- */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Registro
              </h1>
            </div>

            {/* Profile Selector: Persona Humana vs Persona Jurídica */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Seleccioná el Tipo de Cuenta
              </label>

              {(() => {
                const roleOptions = [
                  {
                    value: 'investor' as const,
                    label: 'Inversor',
                    description: 'Persona Humana. Invertí en desarrollos premium desde $500 USD.',
                    Icon: UserCheck,
                  },
                  {
                    value: 'developer' as const,
                    label: 'Constructora',
                    description: 'Persona Jurídica. Presentá proyectos para captar financiamiento.',
                    Icon: Building2,
                  },
                ];
                const selected = roleOptions.find((o) => o.value === role) ?? roleOptions[0];
                const SelectedIcon = selected.Icon;

                return (
                  <div ref={roleMenuRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isRoleMenuOpen}
                      onClick={() => setIsRoleMenuOpen((open) => !open)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: `2px solid ${isRoleMenuOpen ? 'var(--text-primary)' : 'var(--surface-glass-border)'}`,
                        background: 'var(--color-surface-raised)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <SelectedIcon size={18} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selected.label}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {selected.description}
                        </span>
                      </div>
                      <ChevronDown
                        size={18}
                        style={{
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          transform: isRoleMenuOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform var(--transition-fast)',
                        }}
                      />
                    </button>

                    {isRoleMenuOpen && (
                      <div
                        role="listbox"
                        aria-label="Tipo de cuenta"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          left: 0,
                          right: 0,
                          zIndex: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '6px',
                          borderRadius: '16px',
                          border: '1px solid var(--surface-glass-border)',
                          background: 'var(--surface-card)',
                          boxShadow: 'var(--shadow-elevation)',
                        }}
                      >
                        {roleOptions.map(({ value, label, description, Icon }) => {
                          const isSelected = role === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                if (!isSelected) {
                                  setRole(value);
                                  setRegisterStep(1);
                                  setFormErrors({});
                                }
                                setIsRoleMenuOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: 'none',
                                background: isSelected ? 'var(--color-surface-raised)' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background var(--transition-fast)',
                              }}
                            >
                              <Icon size={18} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{label}</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{description}</span>
                              </div>
                              {isSelected && <Check size={16} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Stepper Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '28px',
                padding: '12px 18px',
                borderRadius: '14px',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--surface-glass-border)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: registerStep >= 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: registerStep >= 1 ? 'var(--btn-primary-bg)' : 'var(--surface-card)', color: registerStep >= 1 ? 'var(--btn-primary-text)' : 'var(--text-muted)', display: 'grid', placeItems: 'center', fontSize: '11px' }}>
                  1
                </span>
                <span>{role === 'investor' ? 'Datos Personales' : 'Datos de la Empresa'}</span>
              </div>
              <div style={{ height: '1px', flex: 1, margin: '0 12px', background: 'var(--surface-glass-border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: registerStep >= 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: registerStep >= 2 ? 'var(--btn-primary-bg)' : 'var(--surface-card)', color: registerStep >= 2 ? 'var(--btn-primary-text)' : 'var(--text-muted)', display: 'grid', placeItems: 'center', fontSize: '11px' }}>
                  2
                </span>
                <span>{role === 'investor' ? 'Biometría' : 'Confirmación'}</span>
              </div>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              {/* STEP 1: Credenciales y Contacto */}
              {registerStep === 1 && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {role === 'investor' ? (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                          Nombre y Apellido Completos (según DNI) *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            required
                            placeholder="Ej: Martín Alejandro Benítez"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              if (formErrors.fullName) {
                                setFormErrors((prev) => {
                                  const c = { ...prev };
                                  delete c.fullName;
                                  return c;
                                });
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '44px',
                              paddingLeft: '40px',
                              paddingRight: '14px',
                              borderRadius: '10px',
                              background: 'var(--color-surface-raised)',
                              border: `1px solid ${formErrors.fullName ? '#ef4444' : 'var(--surface-glass-border)'}`,
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          <User size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                        </div>
                        {formErrors.fullName && <span style={{ fontSize: '11px', color: '#ef4444' }}>{formErrors.fullName}</span>}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                          Documento Nacional de Identidad (DNI) *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            required
                            maxLength={8}
                            placeholder="Ej: 38123456"
                            value={dni}
                            onBlur={() => checkSingleFieldAvailability('dni', dni)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                              setDni(val);
                              if (formErrors.dni || formErrors.step1) {
                                setFormErrors((prev) => {
                                  const c = { ...prev };
                                  delete c.dni;
                                  delete c.step1;
                                  return c;
                                });
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '44px',
                              paddingLeft: '40px',
                              paddingRight: '14px',
                              borderRadius: '10px',
                              background: 'var(--color-surface-raised)',
                              border: `1px solid ${formErrors.dni ? '#ef4444' : 'var(--surface-glass-border)'}`,
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          <Fingerprint size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                        </div>
                        {formErrors.dni && <span style={{ fontSize: '11px', color: '#ef4444' }}>{formErrors.dni}</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                          Razón Social de la Desarrolladora / Constructora *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            required
                            placeholder="Ej: Alpes Desarrollos Urbanos S.A."
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            style={{
                              width: '100%',
                              height: '44px',
                              paddingLeft: '40px',
                              paddingRight: '14px',
                              borderRadius: '10px',
                              background: 'var(--color-surface-raised)',
                              border: `1px solid ${formErrors.companyName ? '#ef4444' : 'var(--surface-glass-border)'}`,
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          <Building2 size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                        </div>
                        {formErrors.companyName && <span style={{ fontSize: '11px', color: '#ef4444' }}>{formErrors.companyName}</span>}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                          Nombre Comercial / Marca de Fantasía (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Grupo Alpes Urban"
                          value={tradeName}
                          onChange={(e) => setTradeName(e.target.value)}
                          style={{
                            width: '100%',
                            height: '44px',
                            padding: '0 14px',
                            borderRadius: '10px',
                            background: 'var(--color-surface-raised)',
                            border: '1px solid var(--surface-glass-border)',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>
                        {role === 'investor' ? 'Correo Electrónico Gmail *' : 'Correo Electrónico Oficial *'}
                      </label>
                      {role === 'investor' && googleVerifiedEmail && (
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={14} /> Casilla Verificada
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        required
                        placeholder={role === 'investor' ? 'ejemplo@gmail.com' : 'contacto@dominio.com'}
                        value={email}
                        onBlur={() => checkSingleFieldAvailability('email', email)}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (googleVerifiedEmail && e.target.value !== googleVerifiedEmail) {
                            setGoogleVerifiedEmail(null);
                            setGoogleIdToken(null);
                          }
                          if (formErrors.email || formErrors.step1) {
                            setFormErrors((prev) => {
                              const c = { ...prev };
                              delete c.email;
                              delete c.step1;
                              return c;
                            });
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '44px',
                          paddingLeft: '40px',
                          paddingRight: '14px',
                          borderRadius: '10px',
                          background: role === 'investor' && googleVerifiedEmail ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-surface-raised)',
                          border: `1px solid ${
                            formErrors.email
                              ? '#ef4444'
                              : role === 'investor' && googleVerifiedEmail
                              ? '#10b981'
                              : 'var(--surface-glass-border)'
                          }`,
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <Mail size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: role === 'investor' && googleVerifiedEmail ? '#10b981' : 'var(--text-muted)' }} />
                    </div>
                    {formErrors.email && <span style={{ fontSize: '11px', color: '#ef4444' }}>{formErrors.email}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Teléfono Celular con Código de Área *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="tel"
                        required
                        placeholder="+54 9 11 5555-0199"
                        value={phone}
                        onBlur={() => checkSingleFieldAvailability('phone', phone)}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (formErrors.phone || formErrors.step1) {
                            setFormErrors((prev) => {
                              const c = { ...prev };
                              delete c.phone;
                              delete c.step1;
                              return c;
                            });
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '44px',
                          paddingLeft: '40px',
                          paddingRight: '14px',
                          borderRadius: '10px',
                          background: 'var(--color-surface-raised)',
                          border: `1px solid ${formErrors.phone ? '#ef4444' : 'var(--surface-glass-border)'}`,
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <Phone size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                    </div>
                    {formErrors.phone && <span style={{ fontSize: '11px', color: '#ef4444' }}>{formErrors.phone}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Contraseña de Acceso Seguro *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (formErrors.password || formErrors.step1) {
                            setFormErrors((prev) => {
                              const c = { ...prev };
                              delete c.password;
                              delete c.step1;
                              return c;
                            });
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '44px',
                          paddingLeft: '40px',
                          paddingRight: '40px',
                          borderRadius: '10px',
                          background: 'var(--color-surface-raised)',
                          border: `1px solid ${formErrors.password ? '#ef4444' : 'var(--surface-glass-border)'}`,
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {formErrors.password && <span style={{ fontSize: '11px', color: '#ef4444' }}>{formErrors.password}</span>}
                  </div>

                  {/* Sección Google Registration - Ubicada al final de los campos de datos personales */}
                  <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 16px' }}>
                      <div style={{ flex: 1, height: '1px', background: 'var(--surface-glass-border)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        O autocompletá con tu cuenta
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'var(--surface-glass-border)' }} />
                    </div>

                    <GoogleLoginButton
                      text="Registrarse con Google"
                      onSuccess={handleGoogleRegisterSuccess}
                      onError={(err) => setFormErrors((prev) => ({ ...prev, googleAuth: err }))}
                      isLoading={googleRegisterLoading}
                    />

                    {googleAuthNotice && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: '#60a5fa',
                          fontSize: '11px',
                          lineHeight: 1.4,
                        }}
                      >
                        {googleAuthNotice}
                      </div>
                    )}
                    {formErrors.googleAuth && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#ef4444', lineHeight: 1.4, fontWeight: 500 }}>
                          {formErrors.googleAuth}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLogin(true);
                            setFormErrors({});
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#3b82f6',
                            textDecoration: 'underline',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Ir a Iniciar Sesión con esta cuenta →
                        </button>
                      </div>
                    )}
                  </div>

                  {formErrors.step1 && (
                    <div
                      style={{
                        marginTop: '12px',
                        marginBottom: '4px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        fontSize: '13px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        lineHeight: 1.4,
                      }}
                    >
                      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
                      <div>
                        <strong style={{ display: 'block', color: '#ef4444', marginBottom: '2px', fontSize: '13px' }}>
                          Atención: No es posible avanzar al registro
                        </strong>
                        <span style={{ fontSize: '12px' }}>{formErrors.step1}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isValidatingStep1}
                    onClick={async () => {
                      if (isValidatingStep1) return;
                      const valid = await validateStep1();
                      if (valid) {
                        setRegisterStep(2);
                      }
                    }}
                    className="btn-primary"
                    style={{ height: '46px', marginTop: '12px', borderRadius: '10px', gap: '8px', opacity: isValidatingStep1 ? 0.7 : 1, cursor: isValidatingStep1 ? 'wait' : 'pointer' }}
                  >
                    <span>
                      {isValidatingStep1
                        ? 'Verificando datos...'
                        : role === 'investor'
                        ? 'Continuar a Biometría'
                        : 'Continuar a Confirmación'}
                    </span>
                    <ArrowRight size={16} />
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>¿Ya tenés una cuenta? </span>
                    <button
                      type="button"
                      onClick={() => setIsLogin(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Iniciar Sesión
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Biometría (Inversor) o Confirmación (Constructora) */}
              {registerStep === 2 && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {role === 'investor' ? (
                    <div>
                      <FaceLivenessVerification
                        isVerified={!!livenessProof}
                        onCancel={() => setRegisterStep(1)}
                        onVerified={(proof) => {
                          setLivenessProof(proof);
                          setFormErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.liveness;
                            return copy;
                          });
                        }}
                      />

                      {formErrors.liveness && (
                        <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '12px' }}>
                          {formErrors.liveness}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--color-surface-raised)', border: '1px solid var(--surface-glass-border)' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>
                        Confirmación de Datos de la Constructora
                      </h3>
                      <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Razón Social: </span>
                          <strong>{companyName}</strong>
                        </div>
                        {tradeName && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Nombre Comercial: </span>
                            <strong>{tradeName}</strong>
                          </div>
                        )}
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Correo Oficial: </span>
                          <strong>{email}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Teléfono: </span>
                          <strong>{phone}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {formErrors.general && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        fontSize: '13px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <span>{formErrors.general}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setRegisterStep(1)}
                      style={{
                        flex: 1,
                        height: '46px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || (role === 'investor' && !livenessProof)}
                      className="btn-primary"
                      style={{
                        flex: 2,
                        height: '46px',
                        borderRadius: '10px',
                        gap: '8px',
                        opacity: isSubmitting || (role === 'investor' && !livenessProof) ? 0.6 : 1,
                        cursor: isSubmitting || (role === 'investor' && !livenessProof) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span>{isSubmitting ? 'Registrando...' : 'Finalizar Registro'}</span>
                      <ShieldCheck size={16} />
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
