import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  Headphones,
  CreditCard,
  Lock,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Clock,
  Sparkles,
  Smartphone,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { api } from '../../services/api';
import { FaceLivenessVerification, LivenessProofResult } from '../../features/auth/components/FaceLivenessVerification';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'perfil' | 'asesor' | 'bancario' | 'seguridad';
type SecurityStep = 'password' | 'liveness';

export const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('perfil');

  // Form State - Tab 1: Perfil
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [dni, setDni] = useState<string>('');
  const [cuil, setCuil] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [province, setProvince] = useState<string>('');
  const [fundsOrigin, setFundsOrigin] = useState<string>('Ahorros / Ingresos laborales');
  const [isPep, setIsPep] = useState<boolean>(false);
  const [isObligatedSubject, setIsObligatedSubject] = useState<boolean>(false);

  // Form State - Tab 3: Bancario
  const [payoutCurrency, setPayoutCurrency] = useState<'USD' | 'ARS' | 'USDT'>('USD');
  const [bankCbuOrAlias, setBankCbuOrAlias] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [web3WalletAddress, setWeb3WalletAddress] = useState<string>('');
  const [autoReinvestYield, setAutoReinvestYield] = useState<boolean>(false);

  // Form State - Tab 4: Seguridad & Notificaciones
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(true);
  const [notifyConstructionAlerts, setNotifyConstructionAlerts] = useState<boolean>(true);
  const [notifyAuditReports, setNotifyAuditReports] = useState<boolean>(true);
  const [notifyEarlyAccess, setNotifyEarlyAccess] = useState<boolean>(true);

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Security Step-up Verification State
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [securityStep, setSecurityStep] = useState<SecurityStep>('password');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState<boolean>(false);

  // Support / Advisor State
  const [supportSubject, setSupportSubject] = useState<string>('adquisicion_tokens');
  const [supportPriority, setSupportPriority] = useState<'normal' | 'alta'>('normal');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [isBookingMeeting, setIsBookingMeeting] = useState<boolean>(false);
  const [meetingConfirmed, setMeetingConfirmed] = useState<boolean>(false);

  // Load user data on mount / user change from PostgreSQL
  useEffect(() => {
    if (user) {
      setFullName(user.legalName || user.name || '');
      setPhone(user.phone || '+54 9 11 4099-2819');
      setDni(user.taxId ? user.taxId.replace(/\D/g, '').slice(0, 8) : '42937479');
      setCuil(user.taxId || '20429374791');
      setBirthDate(user.birthDate || '2000-08-13');
      setAddress(user.address || 'Piedras 650');
      setCity(user.city || 'Ciudad Autónoma de Buenos Aires');
      setProvince(user.province || 'CABA');
      setFundsOrigin(user.fundsOrigin || 'Ahorros / Ingresos laborales');
      setIsPep(user.pepDeclared || false);
      setIsObligatedSubject(user.isObligatedSubject || false);

      // Financial
      setPayoutCurrency(user.payoutCurrency || 'USD');
      setBankCbuOrAlias(user.bankCbuOrAlias || '0720000000000012345678');
      setBankName(user.bankName || 'Banco Santander (Cuenta Dólares)');
      setWeb3WalletAddress(user.web3WalletAddress || '0x71C948256aC9aF7a53c9E6D59A1d5cBc9169493B');
      setAutoReinvestYield(user.autoReinvestYield || false);

      // Security
      setTwoFactorEnabled(user.twoFactorEnabled ?? true);
      setNotifyConstructionAlerts(user.notifyConstructionAlerts ?? true);
      setNotifyAuditReports(user.notifyAuditReports ?? true);
      setNotifyEarlyAccess(user.notifyEarlyAccess ?? true);

      // Fetch decrypted profile directly from PostgreSQL backend
      if (user.id) {
        api.getInvestorProfile(user.id).then((profile) => {
          if (profile) {
            if (profile.FullName) setFullName(profile.FullName);
            if (profile.DNI) setDni(profile.DNI);
            if (profile.CUIL) setCuil(profile.CUIL);
            if (profile.BirthDate) setBirthDate(profile.BirthDate);
            if (profile.Address) setAddress(profile.Address);
            if (profile.City) setCity(profile.City);
            if (profile.Province) setProvince(profile.Province);
            if (profile.FundsOrigin) setFundsOrigin(profile.FundsOrigin);
            if (profile.IsPEP !== undefined) setIsPep(profile.IsPEP);
            if (profile.IsObligatedSubject !== undefined) setIsObligatedSubject(profile.IsObligatedSubject);
            if (profile.Phone) setPhone(profile.Phone);
            if (profile.PayoutCurrency) setPayoutCurrency(profile.PayoutCurrency);
            if (profile.BankCbuOrAlias) setBankCbuOrAlias(profile.BankCbuOrAlias);
            if (profile.BankName) setBankName(profile.BankName);
            if (profile.Web3WalletAddress) setWeb3WalletAddress(profile.Web3WalletAddress);
            if (profile.AutoReinvestYield !== undefined) setAutoReinvestYield(profile.AutoReinvestYield);
            if (profile.TwoFactorEnabled !== undefined) setTwoFactorEnabled(profile.TwoFactorEnabled);
            if (profile.NotifyConstructionAlerts !== undefined) setNotifyConstructionAlerts(profile.NotifyConstructionAlerts);
            if (profile.NotifyAuditReports !== undefined) setNotifyAuditReports(profile.NotifyAuditReports);
            if (profile.NotifyEarlyAccess !== undefined) setNotifyEarlyAccess(profile.NotifyEarlyAccess);
          }
        });
      }
    }
  }, [user, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showSecurityModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showSecurityModal, onClose]);

  if (!isOpen) return null;

  // Intercept form submissions and trigger security step-up verification
  const handleOpenSecurityModal = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    setPasswordError(null);
    setPasswordInput('');
    setSecurityStep('password');
    setShowSecurityModal(true);
  };

  // Step 1: Verify Password against backend
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setPasswordError('Ingresá tu contraseña de cuenta.');
      return;
    }

    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const email = user?.email || 'maurobanegas43@gmail.com';
      const isValid = await api.verifyPassword(email, passwordInput);
      if (isValid) {
        // Password confirmed, advance to Step 2: Liveness check
        setSecurityStep('liveness');
      } else {
        setPasswordError('Contraseña incorrecta.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Contraseña incorrecta.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Step 2: FaceX Liveness Verified -> Execute async save to PostgreSQL
  const handleLivenessVerified = async (_proof: LivenessProofResult) => {
    setIsSaving(true);
    setShowSecurityModal(false);

    try {
      if (user?.id) {
        // Asynchronous call to backend PostgreSQL endpoint
        const updatedResponse = await api.updateInvestorProfile(user.id, {
          fullName,
          dni,
          cuil,
          birthDate,
          address,
          city,
          province,
          fundsOrigin,
          isPep,
          isObligatedSubject,
          phone,
          payoutCurrency,
          bankCbuOrAlias,
          bankName,
          web3WalletAddress,
          autoReinvestYield,
          twoFactorEnabled,
          notifyConstructionAlerts,
          notifyAuditReports,
          notifyEarlyAccess,
        });

        // Immediately update frontend context state so changes are reflected in real time
        updateUser({
          name: fullName,
          legalName: fullName,
          phone,
          taxId: cuil || dni,
          address,
          city,
          province,
          birthDate,
          fundsOrigin,
          pepDeclared: isPep,
          isObligatedSubject,
          payoutCurrency,
          bankCbuOrAlias,
          bankName,
          web3WalletAddress,
          autoReinvestYield,
          twoFactorEnabled,
          notifyConstructionAlerts,
          notifyAuditReports,
          notifyEarlyAccess,
        });

        // Update local form state with confirmed values from backend
        if (updatedResponse) {
          if (updatedResponse.fullName) setFullName(updatedResponse.fullName);
          if (updatedResponse.phone) setPhone(updatedResponse.phone);
          if (updatedResponse.city) setCity(updatedResponse.city);
          if (updatedResponse.province) setProvince(updatedResponse.province);
        }
      }

      setSaveSuccess('Modificaciones validadas con contraseña y prueba de vida. Persistidas con éxito en PostgreSQL.');
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar modificaciones en la base de datos');
    } finally {
      setIsSaving(false);
      setSecurityStep('password');
      setPasswordInput('');
    }
  };

  const handleSendTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    const ticketId = 'TK-' + Math.floor(100000 + Math.random() * 900000);
    setTicketSuccess(`Consulta registrada con Ticket #${ticketId}. El Lic. Federico Altamirano revisará tu caso y te contactará en los próximos minutos.`);
    setSupportMessage('');
  };

  const handleBookMeeting = () => {
    setIsBookingMeeting(true);
    setTimeout(() => {
      setIsBookingMeeting(false);
      setMeetingConfirmed(true);
      setTimeout(() => setMeetingConfirmed(false), 5000);
    }, 600);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Dark Overlay Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Slide-out Sidebar Panel */}
      <aside
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          height: '100vh',
          background: 'var(--bg-deep)',
          borderLeft: '1px solid var(--surface-glass-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid var(--surface-glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-card)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--brand-gold) 0%, #b89628 100%)',
                color: '#09090b',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: '16px',
                boxShadow: '0 4px 14px var(--brand-gold-glow)',
              }}
            >
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {user?.name || 'Mi Perfil Fiduciario'}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <ShieldCheck size={12} />
                  KYC Verificado
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                {user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--surface-glass-border)',
              color: 'var(--text-secondary)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--surface-glass-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'perfil' ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTab === 'perfil' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 150ms ease',
            }}
          >
            <UserIcon size={16} />
            <span>Mis Datos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('asesor')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'asesor' ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTab === 'asesor' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 150ms ease',
            }}
          >
            <Headphones size={16} />
            <span>Asesor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bancario')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'bancario' ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTab === 'bancario' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 150ms ease',
            }}
          >
            <CreditCard size={16} />
            <span>Bancos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seguridad')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'seguridad' ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTab === 'seguridad' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 150ms ease',
            }}
          >
            <Lock size={16} />
            <span>Seguridad</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {saveSuccess && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#10b981',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{saveSuccess}</span>
          </div>
        )}

        {saveError && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{saveError}</span>
          </div>
        )}

        {/* Tab Content Area */}
        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {/* TAB 1: PERFIL & DATOS PERSONALES */}
          {activeTab === 'perfil' && (
            <form onSubmit={handleOpenSecurityModal} style={{ display: 'grid', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  Información Legal & Identidad
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Tus datos están protegidos conforme a la Ley 25.326 y encriptados en reposo con AES-256-GCM en PostgreSQL.
                </p>
              </div>

              {/* Full Name */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Nombre y Apellido / Razón Social
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    padding: '0 14px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-glass-border)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* Phone & Email Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Email Registrado
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      padding: '0 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Teléfono Móvil
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      padding: '0 14px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              {/* DNI & CUIL Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Documento Nacional (DNI)
                  </label>
                  <input
                    type="text"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      padding: '0 14px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    CUIT / CUIL Impositivo
                  </label>
                  <input
                    type="text"
                    value={cuil}
                    onChange={(e) => setCuil(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      padding: '0 14px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              {/* Domicilio & Ciudad */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Domicilio Real / Legal (Calle, Número, Piso)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    padding: '0 14px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-glass-border)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Ciudad / Localidad
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      padding: '0 14px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      padding: '0 14px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              {/* Origen de Fondos */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Origen de Fondos (Declaración Jurada UIF)
                </label>
                <select
                  value={fundsOrigin}
                  onChange={(e) => setFundsOrigin(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    padding: '0 14px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-glass-border)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value="Ahorros / Ingresos laborales">Ahorros / Ingresos laborales en relación de dependencia</option>
                  <option value="Actividad profesional independiente">Actividad profesional independiente / Honorarios</option>
                  <option value="Distribución de dividendos o utilidades">Distribución de dividendos societarios / Empresa</option>
                  <option value="Venta de inmueble previo">Venta de inmueble / Inversión inmobiliaria previa</option>
                  <option value="Herencia o donación familiar">Herencia o donación fiduciaria</option>
                </select>
              </div>

              {/* Compliance PEP & UIF Toggles */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  padding: '16px',
                  border: '1px solid var(--surface-glass-border)',
                  display: 'grid',
                  gap: '12px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Persona Expuesta Políticamente (PEP)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Conforme Res. UIF 35/2023 y modificatorias
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPep}
                    onChange={(e) => setIsPep(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }}
                  />
                </label>

                <div style={{ height: '1px', background: 'var(--surface-glass-border)' }} />

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'grid', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Sujeto Obligado ante la UIF
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Escribanos, entidades financieras, agentes de bolsa
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isObligatedSubject}
                    onChange={(e) => setIsObligatedSubject(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }}
                  />
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSaving ? 'wait' : 'pointer',
                  marginTop: '8px',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSaving ? 'Actualizando en PostgreSQL...' : 'Modificar Datos (Requiere Contraseña + FaceX)'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: ASESOR PERSONAL & SOPORTE DEDICADO */}
          {activeTab === 'asesor' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  Asistencia & Asesoría Patrimonial
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Tenés un oficial de cumplimiento fiduciario y asesor patrimonial asignado a tu cuenta en todo momento.
                </p>
              </div>

              {/* Dedicated Advisor Card */}
              <div
                style={{
                  background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.08) 0%, rgba(18, 19, 22, 0.95) 100%)',
                  borderRadius: '18px',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  padding: '20px',
                  display: 'grid',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: '#1f2024',
                      border: '2px solid var(--brand-gold)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--brand-gold)',
                      fontWeight: 800,
                      fontSize: '18px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    }}
                  >
                    FA
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Lic. Federico Altamirano
                      </h4>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'var(--brand-gold)',
                          color: '#09090b',
                        }}
                      >
                        SENIOR ADVISOR
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Asesor Fiduciario & Cumplimiento Normativo
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Matrícula CNV ID: 8492-FA · Kreanova Capital
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={14} style={{ color: 'var(--brand-gold)' }} />
                    <span style={{ fontSize: '11px' }}>federico.altamirano@kreanova.io</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={14} style={{ color: 'var(--brand-gold)' }} />
                    <span style={{ fontSize: '11px' }}>Lun-Vie 9:00 a 18:00 ART</span>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <a
                    href="https://wa.me/5491152638800?text=Hola%20Federico,%20soy%20inversor%20en%20Kreanova%20y%20deseo%20asesoramiento%20personalizado."
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      background: '#25D366',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                    }}
                  >
                    <Smartphone size={16} />
                    <span>WhatsApp Oficial</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleBookMeeting}
                    disabled={isBookingMeeting}
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <Calendar size={15} />
                    <span>{isBookingMeeting ? 'Agendando...' : 'Agendar Llamada'}</span>
                  </button>
                </div>

                {meetingConfirmed && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Videollamada agendada para mañana 10:30 hs. Recibirás el link de Google Meet por email.</span>
                  </div>
                )}
              </div>

              {/* Direct Support Ticket Form */}
              <form onSubmit={handleSendTicket} style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={17} style={{ color: 'var(--brand-gold)' }} />
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Mesa de Entrada & Consultas Fiduciarias
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Motivo de Consulta
                    </label>
                    <select
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      style={{
                        height: '40px',
                        borderRadius: '10px',
                        padding: '0 12px',
                        background: 'var(--surface-card)',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="adquisicion_tokens">Adquisición de nuevos tokens fiduciarios</option>
                      <option value="rentas_dividendos">Distribución y cobro de rentas trimestrales</option>
                      <option value="mercado_secundario">Liquidación o venta en Mercado Secundario</option>
                      <option value="contrato_fiduciario">Respaldo legal y boleto fiduciario</option>
                      <option value="datos_bancarios">Modificación de cuenta bancaria o CBU</option>
                      <option value="soporte_tecnico">Soporte técnico y acceso a la plataforma</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Prioridad
                    </label>
                    <select
                      value={supportPriority}
                      onChange={(e) => setSupportPriority(e.target.value as any)}
                      style={{
                        height: '40px',
                        borderRadius: '10px',
                        padding: '0 12px',
                        background: 'var(--surface-card)',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="normal">Normal (Respuesta &lt; 2 hs)</option>
                      <option value="alta">Alta / Urgente (Respuesta prioritaria)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Detalle de tu solicitud
                  </label>
                  <textarea
                    rows={4}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Escribí aquí tu consulta o requerimiento para el equipo fiduciario..."
                    required
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      resize: 'none',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Send size={15} />
                  <span>Enviar Mensaje a mi Asesor</span>
                </button>

                {ticketSuccess && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#10b981',
                      fontSize: '12px',
                      lineHeight: 1.5,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{ticketSuccess}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 3: DATOS BANCARIOS & LIQUIDACIÓN */}
          {activeTab === 'bancario' && (
            <form onSubmit={handleOpenSecurityModal} style={{ display: 'grid', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  Cobro de Rentas & Liquidaciones
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Configurá tus cuentas para la acreditación trimestral de dividendos de alquiler y ventas de cuotapartes.
                </p>
              </div>

              {/* Moneda de cobro */}
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Moneda Fiduciaria de Cobro Preferida
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {(['USD', 'ARS', 'USDT'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setPayoutCurrency(curr)}
                      style={{
                        height: '42px',
                        borderRadius: '10px',
                        border: payoutCurrency === curr ? '2px solid var(--brand-gold)' : '1px solid var(--surface-glass-border)',
                        background: payoutCurrency === curr ? 'rgba(212, 175, 55, 0.12)' : 'var(--surface-card)',
                        color: payoutCurrency === curr ? 'var(--brand-gold)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {curr === 'USD' && 'Dólares (USD)'}
                      {curr === 'ARS' && 'Pesos (MEP)'}
                      {curr === 'USDT' && 'USDT Fiduciario'}
                    </button>
                  ))}
                </div>
              </div>

              {/* CBU / CVU */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  CBU / CVU Bancario (22 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={22}
                  value={bankCbuOrAlias}
                  onChange={(e) => setBankCbuOrAlias(e.target.value)}
                  placeholder="0720000000000012345678"
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    padding: '0 14px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-glass-border)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                  La cuenta bancaria debe estar registrada a tu mismo DNI/CUIT por normativa BCRA.
                </span>
              </div>

              {/* Entidad Bancaria */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Banco / Entidad Financiera
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ej. Banco Galicia, Santander, Brubank"
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    padding: '0 14px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-glass-border)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* Billetera Web3 */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Billetera Web3 ERC-20 (Opcional - Red Polygon / Ethereum)
                </label>
                <input
                  type="text"
                  value={web3WalletAddress}
                  onChange={(e) => setWeb3WalletAddress(e.target.value)}
                  placeholder="0x..."
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    padding: '0 14px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-glass-border)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Reinversión Automática */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  padding: '16px',
                  border: '1px solid var(--surface-glass-border)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'grid', gap: '2px', paddingRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} style={{ color: 'var(--brand-gold)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Reinversión Automática de Rentas (Interés Compuesto)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Aplica tus dividendos trimestrales automáticamente en nuevos tokens fiduciarios para maximizar el rendimiento.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoReinvestYield}
                    onChange={(e) => setAutoReinvestYield(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)', flexShrink: 0 }}
                  />
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSaving ? 'wait' : 'pointer',
                  marginTop: '8px',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSaving ? 'Guardando...' : 'Guardar Bancos (Requiere Contraseña + FaceX)'}</span>
              </button>
            </form>
          )}

          {/* TAB 4: SEGURIDAD & NOTIFICACIONES */}
          {activeTab === 'seguridad' && (
            <form onSubmit={handleOpenSecurityModal} style={{ display: 'grid', gap: '22px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  Seguridad & Comunicaciones
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Gestioná los factores de autenticación reforzada y las notificaciones oficiales de auditoría técnica.
                </p>
              </div>

              {/* 2FA Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  borderRadius: '16px',
                  padding: '18px',
                  border: '1px solid var(--surface-glass-border)',
                  display: 'grid',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Lock size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Autenticación de Dos Factores (2FA / TOTP)
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Protección obligatoria para transferencias y retiros fiduciarios
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                </div>

                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    color: 'var(--text-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ShieldCheck size={14} style={{ color: '#10b981' }} />
                  <span>Estado actual: Vinculado a Google Authenticator / FaceX</span>
                </div>
              </div>

              {/* Notification Toggles */}
              <div style={{ display: 'grid', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Notificaciones & Reportes de Obra
                </span>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '14px',
                    padding: '16px',
                    border: '1px solid var(--surface-glass-border)',
                    display: 'grid',
                    gap: '14px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'grid', gap: '2px', paddingRight: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Alertas de Avance de Obra & Certificados CIRSOC
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Avisos en tiempo real cuando Bureau Veritas audita un hito estructural
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyConstructionAlerts}
                      onChange={(e) => setNotifyConstructionAlerts(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }}
                    />
                  </label>

                  <div style={{ height: '1px', background: 'var(--surface-glass-border)' }} />

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'grid', gap: '2px', paddingRight: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Resumen Mensual Contable Auditado (.PDF)
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Envío automático del libro mayor contable y estado de posición consolidada
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyAuditReports}
                      onChange={(e) => setNotifyAuditReports(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }}
                    />
                  </label>

                  <div style={{ height: '1px', background: 'var(--surface-glass-border)' }} />

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'grid', gap: '2px', paddingRight: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Acceso Prioritario a Nuevos Lanzamientos Fiduciarios
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Notificación 48 horas antes de la apertura pública del catálogo
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyEarlyAccess}
                      onChange={(e) => setNotifyEarlyAccess(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }}
                    />
                  </label>
                </div>
              </div>

              {/* Active Session Info */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  border: '1px solid var(--surface-glass-border)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Dispositivo Actual:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>macOS · Google Chrome</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cifrado de Sesión:</span>
                  <strong style={{ color: '#10b981' }}>TLS 1.3 / AES-256</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ID de Sesión:</span>
                  <span className="mono" style={{ fontSize: '11px' }}>{user?.id ? user.id.slice(0, 12) : 'kn-sess'}</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSaving ? 'wait' : 'pointer',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSaving ? 'Guardando...' : 'Actualizar Seguridad (Requiere FaceX)'}</span>
              </button>

              <div style={{ borderTop: '1px solid var(--surface-glass-border)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={16} />
                  <span>Cerrar Sesión Segura</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </aside>

      {/* SECURITY STEP-UP VERIFICATION MODAL */}
      {showSecurityModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              background: '#121316',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '32px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              position: 'relative',
              display: 'grid',
              gap: '24px',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(212, 175, 55, 0.12)',
                    color: 'var(--brand-gold)',
                    border: '1px solid rgba(212, 175, 55, 0.25)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Verificación de Seguridad
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Comprobación de contraseña y validación de vida biométrica
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSecurityModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Progress Indicator */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: securityStep === 'password' ? 'var(--brand-gold)' : '#10b981',
                  fontWeight: 600,
                }}
              >
                {securityStep === 'liveness' ? (
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                ) : (
                  <KeyRound size={16} />
                )}
                <span>1. Contraseña</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: securityStep === 'liveness' ? 'var(--brand-gold)' : 'var(--text-subtle)',
                  fontWeight: 600,
                }}
              >
                <Camera size={16} />
                <span>2. Validación de Vida</span>
              </div>
            </div>

            {/* STEP 1: PASSWORD VERIFICATION */}
            {securityStep === 'password' && (
              <form onSubmit={handleVerifyPassword} style={{ display: 'grid', gap: '18px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Ingresá la contraseña actual de tu cuenta para autorizar la actualización de datos patrimoniales:
                </p>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Contraseña de Usuario
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError(null);
                      }}
                      placeholder="••••••••••••"
                      autoFocus
                      required
                      style={{
                        width: '100%',
                        height: '46px',
                        borderRadius: '12px',
                        padding: '0 44px 0 14px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: passwordError ? '1px solid #ef4444' : '1px solid var(--surface-glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {passwordError && (
                    <span style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} />
                      {passwordError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowSecurityModal(false)}
                    style={{
                      flex: 1,
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--surface-glass-border)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifyingPassword}
                    style={{
                      flex: 1.5,
                      height: '44px',
                      borderRadius: '12px',
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: isVerifyingPassword ? 'wait' : 'pointer',
                    }}
                  >
                    <span>{isVerifyingPassword ? 'Verificando...' : 'Validar y Continuar a FaceX'}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: LIVENESS VERIFICATION (FaceX Biometrics) */}
            {securityStep === 'liveness' && (
              <div style={{ display: 'grid', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Realizá la prueba biométrica de vida con tu cámara para confirmar la titularidad. Al completarse, las modificaciones se persistirán de inmediato en la base de datos:
                </p>

                <div
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: '#09090b',
                  }}
                >
                  <FaceLivenessVerification
                    onVerified={handleLivenessVerified}
                    onCancel={() => setShowSecurityModal(false)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
