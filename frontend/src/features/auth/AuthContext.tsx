import React, { createContext, useContext, useState } from 'react';
import { api } from '../../services/api';

export type UserRole = 'investor' | 'developer' | 'admin';
export type UserType = 'individual' | 'corporate';
export type KycStatus = 'pending' | 'verified' | 'requires_documentation' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  userType: UserType;
  taxId?: string; // DNI, CUIL or CUIT
  legalName?: string; // Full legal name or Company trade name
  companyType?: string; // SA, SRL, SAS, Fideicomiso
  legalRepresentative?: string;
  kycStatus: KycStatus;
  isKycVerified: boolean;
  pepDeclared: boolean;
  livenessVerified?: boolean;
  googleVerified?: boolean;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  address?: string;
  city?: string;
  province?: string;
  birthDate?: string;
  fundsOrigin?: string;
  isObligatedSubject?: boolean;
  // Financial & Operational Preferences
  payoutCurrency?: 'USD' | 'ARS' | 'USDT';
  bankCbuOrAlias?: string;
  bankName?: string;
  web3WalletAddress?: string;
  autoReinvestYield?: boolean;
  // Security & Notifications
  twoFactorEnabled?: boolean;
  notifyConstructionAlerts?: boolean;
  notifyAuditReports?: boolean;
  notifyEarlyAccess?: boolean;
  trustedDevice?: {
    deviceId: string;
    deviceName: string;
    trustedAt: string;
  };
}

interface RegisterInvestorPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  dni: string;
  cuil: string;
  birthDate: string;
  address: string;
  city: string;
  province: string;
  isPep: boolean;
  isObligatedSubject: boolean;
  fundsOrigin: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  googleIdToken?: string;
  livenessVerified?: boolean;
  livenessProofHash?: string;
  livenessSessionId?: string;
  livenessToken?: string;
}

interface RegisterCorporatePayload {
  companyName: string;
  tradeName: string;
  companyType: string;
  cuit: string;
  registrationNumber: string;
  legalAddress: string;
  repFullName: string;
  repRole: string;
  repDni: string;
  repCuil: string;
  email: string;
  password: string;
  phone: string;
  isPep: boolean;
  uboDeclared: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string, role?: UserRole, extra?: Partial<User>) => Promise<void>;
  loginWithGoogle: (backendUser: any) => Promise<void>;
  registerInvestor: (payload: RegisterInvestorPayload) => Promise<void>;
  registerCorporate: (payload: RegisterCorporatePayload) => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('kn_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const loginWithGoogle = async (backendUser: any) => {
    const newUser: User = {
      id: backendUser.id,
      name: backendUser.name || backendUser.email.split('@')[0].toUpperCase(),
      email: backendUser.email,
      role: (backendUser.role as UserRole) || 'investor',
      userType: (backendUser.userType as UserType) || 'individual',
      taxId: backendUser.taxId,
      legalName: backendUser.name,
      kycStatus: backendUser.kycStatus || 'verified',
      isKycVerified: backendUser.isKycVerified ?? true,
      googleVerified: true,
      pepDeclared: false,
      termsAcceptedAt: new Date().toISOString(),
      privacyAcceptedAt: new Date().toISOString(),
      trustedDevice: backendUser.trustedDevice,
    };
    setUser(newUser);
    localStorage.setItem('kn_auth_user', JSON.stringify(newUser));
  };

  const login = async (email: string, password?: string, role: UserRole = 'investor', extra?: Partial<User>) => {
    if (password) {
      try {
        const backendUser = await api.login(email, password);
        const newUser: User = {
          id: backendUser.id,
          name: backendUser.name || email.split('@')[0].toUpperCase(),
          email: backendUser.email,
          role: (backendUser.role as UserRole) || role,
          userType: (backendUser.userType as UserType) || (role === 'developer' ? 'corporate' : 'individual'),
          taxId: backendUser.taxId || extra?.taxId,
          legalName: extra?.legalName || backendUser.name,
          companyType: extra?.companyType,
          legalRepresentative: extra?.legalRepresentative,
          kycStatus: backendUser.kycStatus || 'verified',
          isKycVerified: backendUser.isKycVerified ?? true,
          pepDeclared: false,
          termsAcceptedAt: new Date().toISOString(),
          privacyAcceptedAt: new Date().toISOString(),
          ...extra,
        };
        setUser(newUser);
        localStorage.setItem('kn_auth_user', JSON.stringify(newUser));
        return;
      } catch (err) {
        throw err;
      }
    }

    // Direct developer profile selection or demo fallback with real DB ID
    const newUser: User = {
      id: extra?.id || 'usr-investor-01',
      name: extra?.name || email.split('@')[0].toUpperCase(),
      email,
      role,
      userType: role === 'developer' ? 'corporate' : 'individual',
      taxId: extra?.taxId,
      legalName: extra?.legalName,
      companyType: extra?.companyType,
      legalRepresentative: extra?.legalRepresentative,
      kycStatus: 'verified',
      isKycVerified: true,
      pepDeclared: false,
      termsAcceptedAt: new Date().toISOString(),
      privacyAcceptedAt: new Date().toISOString(),
      ...extra,
    };
    setUser(newUser);
    localStorage.setItem('kn_auth_user', JSON.stringify(newUser));
  };

  const registerInvestor = async (payload: RegisterInvestorPayload) => {
    try {
      const persistedUser = await api.registerInvestor(payload);
      const newUser: User = {
        id: persistedUser.id,
        name: persistedUser.name,
        email: persistedUser.email,
        role: 'investor',
        userType: 'individual',
        taxId: persistedUser.taxId,
        legalName: payload.fullName,
        kycStatus: persistedUser.kycStatus || 'verified',
        isKycVerified: persistedUser.isKycVerified ?? true,
        pepDeclared: payload.isPep,
        livenessVerified: payload.livenessVerified ?? true,
        googleVerified: !!payload.googleIdToken,
        termsAcceptedAt: new Date().toISOString(),
        privacyAcceptedAt: new Date().toISOString(),
      };
      setUser(newUser);
      localStorage.setItem('kn_auth_user', JSON.stringify(newUser));
    } catch (err) {
      console.error('Registration failed:', err);
      throw err;
    }
  };

  const registerCorporate = async (payload: RegisterCorporatePayload) => {
    try {
      const persistedUser = await api.registerCorporate(payload);
      const newUser: User = {
        id: persistedUser.id,
        name: persistedUser.name,
        email: persistedUser.email,
        role: 'developer',
        userType: 'corporate',
        taxId: persistedUser.taxId,
        legalName: payload.companyName,
        companyType: payload.companyType,
        legalRepresentative: payload.repFullName,
        kycStatus: persistedUser.kycStatus || 'verified',
        isKycVerified: true,
        pepDeclared: payload.isPep,
        termsAcceptedAt: new Date().toISOString(),
        privacyAcceptedAt: new Date().toISOString(),
      };
      setUser(newUser);
      localStorage.setItem('kn_auth_user', JSON.stringify(newUser));
    } catch (err) {
      console.error('Corporate registration failed:', err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kn_auth_user');
  };

  const updateUser = (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('kn_auth_user', JSON.stringify(next));
      } catch (e) {
        console.error('Error saving updated user to localStorage:', e);
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        registerInvestor,
        registerCorporate,
        updateUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
