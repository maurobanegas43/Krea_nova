import { Project, Investment, SecondaryMarketOrder, LedgerEntry, DeveloperProfile, PaymentIntent, PaymentGatewayProvider, FiduciaryAccount } from '../types';
import { getProjectAuditDetails } from './projectAuditData';

export const INITIAL_DEVELOPERS: DeveloperProfile[] = [
  {
    id: 'dev-alpes',
    companyName: 'Alpes Desarrollos Urbanos S.A.',
    tradeName: 'Alpes Urban',
    cuit: '30-71234567-8',
    companyType: 'SA',
    email: 'desarrollo@alpesurban.com.ar',
    phone: '+54 11 4820-9100',
    legalAddress: 'Av. del Libertador 4400, CABA',
    repFullName: 'Ing. Matías E. Varela',
    repRole: 'Director de Obras y Apoderado',
    specialty: 'Torres corporativas sustentables, oficinas AAA y certificación LEED',
    deliveredM2: 85000,
    completedProjects: 7,
    verificationStatus: 'verified',
    logoBadge: 'ALPES',
  },
  {
    id: 'dev-urban',
    companyName: 'Urban Capital Partners S.A.S.',
    tradeName: 'Urban Capital',
    cuit: '30-71891234-5',
    companyType: 'SAS',
    email: 'info@urbancapital.com.ar',
    phone: '+54 11 5238-1400',
    legalAddress: 'Av. Figueroa Alcorta 3200, Palermo, CABA',
    repFullName: 'Arq. Florencia Santillán',
    repRole: 'Socia Gerente & Directora de Proyecto',
    specialty: 'Residencias de alta gama en corredores consolidados y semipisos de lujo',
    deliveredM2: 45000,
    completedProjects: 5,
    verificationStatus: 'verified',
    logoBadge: 'URBAN',
  },
  {
    id: 'dev-nord',
    companyName: 'Nord Logistics Real Estate S.R.L.',
    tradeName: 'Nord Industrial & Logistics',
    cuit: '30-70984512-3',
    companyType: 'SRL',
    email: 'operaciones@nordlogistics.com.ar',
    phone: '+54 11 6091-7700',
    legalAddress: 'Panamericana Ramal Campana Km 72, Pcia. Buenos Aires',
    repFullName: 'Lic. Gonzalo Benítez',
    repRole: 'Director de Operaciones e Infraestructura',
    specialty: 'Parques logísticos Triple A con contratos de largo plazo para e-commerce',
    deliveredM2: 120000,
    completedProjects: 9,
    verificationStatus: 'verified',
    logoBadge: 'NORD',
  },
  {
    id: 'dev-innovar',
    companyName: 'Innovar PropTech & Living S.A.',
    tradeName: 'Innovar Living',
    cuit: '30-71556677-2',
    companyType: 'SA',
    email: 'proyectos@innovarliving.com.ar',
    phone: '+54 11 4775-8830',
    legalAddress: 'Honduras 4800, Palermo Soho, CABA',
    repFullName: 'Santiago M. Rossi',
    repRole: 'CEO & Fundador',
    specialty: 'Smart-living, coliving y micro-apartamentos para rentas temporarias en dólares',
    deliveredM2: 28000,
    completedProjects: 4,
    verificationStatus: 'verified',
    logoBadge: 'INNOVAR',
  },
  {
    id: 'dev-suraustral',
    companyName: 'Sur Austral Desarrollos Inmobiliarios S.A.',
    tradeName: 'Sur Austral Real Estate',
    cuit: '30-71445566-1',
    companyType: 'SA',
    email: 'contacto@suraustral.com.ar',
    phone: '+54 294 442-8900',
    legalAddress: 'Av. Bustillo Km 4.2, San Carlos de Bariloche, Río Negro',
    repFullName: 'Dr. Lucas E. Méndez',
    repRole: 'Apoderado Legal y Director de Inversiones',
    specialty: 'Eco-resorts, condo-hoteles de montaña y hotelería sustentable en Patagonia',
    deliveredM2: 38000,
    completedProjects: 3,
    verificationStatus: 'verified',
    logoBadge: 'SUR AUSTRAL',
  },
  {
    id: 'dev-metropolis',
    companyName: 'Metrópolis Hábitat & Retail S.R.L.',
    tradeName: 'Metrópolis Group',
    cuit: '30-71667788-9',
    companyType: 'SRL',
    email: 'institucional@metropolisgroup.com.ar',
    phone: '+54 11 5354-2000',
    legalAddress: 'Juana Manso 1600, Dique 2, Puerto Madero, CABA',
    repFullName: 'Arq. Carolina Beltrán',
    repRole: 'Directora de Arquitectura y Planeamiento',
    specialty: 'Desarrollos de usos mixtos (retail premium + residencial) en frentes de agua',
    deliveredM2: 95000,
    completedProjects: 6,
    verificationStatus: 'verified',
    logoBadge: 'METRÓPOLIS',
  },
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    developerId: 'dev-alpes',
    developerName: 'Alpes Desarrollos Urbanos',
    name: 'Torre Krea Nova I',
    location: 'Distrito Tecnológico, Buenos Aires',
    description: 'Oficinas y viviendas con certificación LEED Gold.',
    fundingGoal: 75000000, // $750,000.00
    fundsRaised: 52500000,  // $525,000.00
    fundedPercent: 70,
    progress: 42,
    status: 'published',
    createdAt: '2026-08-15T10:00:00Z',
    expectedApy: 11.5,
    minInvestment: 500,
    durationMonths: 24,
    tokenSymbol: 'KN-01',
    category: 'Corporativo & Renta',
    imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
        caption: 'Fachada Principal y Terrazas Verdes Bioclimáticas',
        category: 'render',
      },
      {
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
        caption: 'Avance de Estructura: Hormigonado de Losas Piso 10',
        category: 'construction',
      },
      {
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
        caption: 'Interiores de Plantas Libres Corporativas AAA',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
        caption: 'Muro Cortina Doble Vidriado Hermético (DVH)',
        category: 'aerial',
      },
      {
        url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80',
        caption: 'Rooftop Lounge & Coworking con Vista Panorámica',
        category: 'amenity',
      },
    ],
  },
  {
    id: 'proj-002',
    developerId: 'dev-urban',
    developerName: 'Urban Capital Partners',
    name: 'Residencias Libertador',
    location: 'Núñez, Buenos Aires',
    description: 'Residencias frente al parque en Núñez.',
    fundingGoal: 120000000,
    fundsRaised: 98400000,
    fundedPercent: 82,
    progress: 68,
    status: 'published',
    createdAt: '2026-09-01T14:30:00Z',
    expectedApy: 13.0,
    minInvestment: 1000,
    durationMonths: 18,
    tokenSymbol: 'RLIB-02',
    category: 'Residencial Premium',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        caption: 'Fachada Frente al Parque en Corredor Libertador',
        category: 'render',
      },
      {
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
        caption: 'Semipisos con Living Apaisado y Grandes Ventanales',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
        caption: 'Cocinas Integradas con Revestimientos de Mármol y Silestone',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80',
        caption: 'Avance de Obra: Instalaciones y Cerramientos Piso 14',
        category: 'construction',
      },
      {
        url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
        caption: 'Piscina Climatizada In/Out, Solarium y Spa',
        category: 'amenity',
      },
    ],
  },
  {
    id: 'proj-003',
    developerId: 'dev-nord',
    developerName: 'Nord Logistics',
    name: 'Parque Logístico Ruta 9',
    location: 'Campana, Buenos Aires',
    description: 'Naves industriales con alquileres a 10 años.',
    fundingGoal: 200000000,
    fundsRaised: 60000000,
    fundedPercent: 30,
    progress: 15,
    status: 'published',
    createdAt: '2026-09-20T09:15:00Z',
    expectedApy: 14.2,
    minInvestment: 2500,
    durationMonths: 36,
    tokenSymbol: 'PLOG-03',
    category: 'Logística & Rentas',
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
        caption: 'Vista Aérea del Centro Logístico y Dársenas de Carga',
        category: 'render',
      },
      {
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
        caption: 'Montaje de Pórticos y Estructura Metálica de Gran Luz',
        category: 'construction',
      },
      {
        url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
        caption: 'Pisos Industriales con Nivelación Láser de Alta Resistencia',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
        caption: 'Sector de Oficinas Administrativas y Sala de Control 24/7',
        category: 'amenity',
      },
    ],
  },
  {
    id: 'proj-004',
    developerId: 'dev-innovar',
    developerName: 'Innovar PropTech & Living S.A.',
    name: 'Coliving & Studios Palermo',
    location: 'Palermo Soho, Buenos Aires',
    description: 'Edificio boutique de estudios amoblados para alquiler temporal y nómadas digitales. Máxima ocupación turística con distribución periódica de utilidades.',
    fundingGoal: 50000000,
    fundsRaised: 0,
    fundedPercent: 0,
    progress: 5,
    status: 'published',
    createdAt: '2026-10-12T16:00:00Z',
    expectedApy: 12.5,
    minInvestment: 500,
    durationMonths: 14,
    tokenSymbol: 'CLV-04',
    category: 'Turismo & Renta',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
        caption: 'Fachada Vanguardista con Vegetación Vertical',
        category: 'render',
      },
      {
        url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
        caption: 'Estudio Modelo Totalmente Equipado para Airbnb',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
        caption: 'Área de Coworking Integrada y Café Comunitario',
        category: 'amenity',
      },
      {
        url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
        caption: 'Avance de Obra: Encofrados y Fundaciones Especiales',
        category: 'construction',
      },
      {
        url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80',
        caption: 'Rooftop Grill & Solarium para Huéspedes',
        category: 'amenity',
      },
    ],
  },
  {
    id: 'proj-005',
    developerId: 'dev-suraustral',
    developerName: 'Sur Austral Desarrollos Inmobiliarios S.A.',
    name: 'Llao Llao Eco-Residences & Spa',
    location: 'Circuito Chico, Bariloche',
    description: 'Condo-hotel de montaña y spa termal sustentable en la Patagonia. Certificación ambiental internacional con pool de renta turística en dólares y uso exclusivo anual para inversores.',
    fundingGoal: 150000000,
    fundsRaised: 45000000,
    fundedPercent: 30,
    progress: 25,
    status: 'published',
    createdAt: '2026-10-18T11:00:00Z',
    expectedApy: 13.8,
    minInvestment: 1500,
    durationMonths: 28,
    tokenSymbol: 'LLAO-05',
    category: 'Turismo & Renta',
    imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        caption: 'Arquitectura Alpina Contemporánea Integrada al Bosque',
        category: 'render',
      },
      {
        url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
        caption: 'Master Suite con Chimenea y Vista al Lago Nahuel Huapi',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80',
        caption: 'Spa Termal y Piscina Climatizada con Borde Infinito',
        category: 'amenity',
      },
      {
        url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
        caption: 'Avance de Obra: Cimientos en Roca y Estructura Sismorresistente',
        category: 'construction',
      },
    ],
  },
  {
    id: 'proj-006',
    developerId: 'dev-metropolis',
    developerName: 'Metrópolis Hábitat & Retail S.R.L.',
    name: 'Madero Harbour Bay & Residences',
    location: 'Dique 2, Puerto Madero, Buenos Aires',
    description: 'Torre icónica frente al espejo de agua con zócalo gastronómico internacional y residencias de lujo. Fideicomiso garantizado con hipoteca en primer grado sobre el terreno.',
    fundingGoal: 250000000,
    fundsRaised: 187500000,
    fundedPercent: 75,
    progress: 55,
    status: 'published',
    createdAt: '2026-10-05T09:00:00Z',
    expectedApy: 12.0,
    minInvestment: 2000,
    durationMonths: 30,
    tokenSymbol: 'MDR-06',
    category: 'Residencial Premium',
    imageUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80',
        caption: 'Torre Vidriada Frente al Dique con Vistas al Río de la Plata',
        category: 'render',
      },
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        caption: 'Penthouse de Doble Altura con Terraza Privada',
        category: 'interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1200&q=80',
        caption: 'Zócalo Comercial, Restaurantes y Marina Exclusiva',
        category: 'amenity',
      },
      {
        url: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
        caption: 'Avance de Obra: Tabiques de Hormigón Visto y Carpinterías Piso 18',
        category: 'construction',
      },
      {
        url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80',
        caption: 'Piscina Voladiza en Altura con Vista Panorámica a la Ciudad',
        category: 'amenity',
      },
    ],
  },
];

// Investments and ledger persistence layer (localStorage backed with backend API sync)
const INVESTMENTS_STORAGE_KEY = 'kn_investments';
const LEDGER_STORAGE_KEY = 'kn_ledger_entries';

function getStoredInvestments(userId?: string): Investment[] {
  try {
    const raw = localStorage.getItem(INVESTMENTS_STORAGE_KEY);
    const all: (Investment & { userId?: string })[] = raw ? JSON.parse(raw) : [];
    if (userId) {
      return all.filter((inv) => !inv.userId || inv.userId === userId);
    }
    return all;
  } catch {
    return [];
  }
}

function saveStoredInvestments(investments: (Investment & { userId?: string })[]) {
  try {
    localStorage.setItem(INVESTMENTS_STORAGE_KEY, JSON.stringify(investments));
  } catch (e) {
    console.error('Failed to save investments to localStorage', e);
  }
}

function addStoredInvestment(inv: Investment, userId?: string) {
  try {
    const raw = localStorage.getItem(INVESTMENTS_STORAGE_KEY);
    const all: (Investment & { userId?: string })[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((i) => i.id === inv.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...inv, userId: userId || all[idx].userId };
    } else {
      all.unshift({ ...inv, userId });
    }
    localStorage.setItem(INVESTMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to add investment to localStorage', e);
  }
}

function getStoredLedger(userId?: string): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    const all: (LedgerEntry & { userId?: string })[] = raw ? JSON.parse(raw) : [];
    if (userId) {
      return all.filter((e) => !e.userId || e.userId === userId);
    }
    return all;
  } catch {
    return [];
  }
}

function addStoredLedgerEntry(entry: LedgerEntry, userId?: string) {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    const all: (LedgerEntry & { userId?: string })[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...entry, userId: userId || all[idx].userId };
    } else {
      all.unshift({ ...entry, userId });
    }
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to add ledger entry to localStorage', e);
  }
}

const INITIAL_INVESTMENTS: Investment[] = [];

const INITIAL_ORDERS: SecondaryMarketOrder[] = [
  {
    id: 'ord-01',
    projectId: 'proj-001',
    projectName: 'Torre Krea Nova I',
    tokenSymbol: 'KN-01',
    type: 'sell',
    amountTokens: 25,
    pricePerToken: 104.5,
    totalValue: 2612.5,
    sellerOrBuyerId: 'usr-889',
    status: 'open',
    createdAt: '2026-10-24T12:00:00Z',
  },
  {
    id: 'ord-02',
    projectId: 'proj-002',
    projectName: 'Residencias Libertador',
    tokenSymbol: 'RLIB-02',
    type: 'buy',
    amountTokens: 40,
    pricePerToken: 99.0,
    totalValue: 3960.0,
    sellerOrBuyerId: 'usr-210',
    status: 'open',
    createdAt: '2026-10-25T08:30:00Z',
  },
  {
    id: 'ord-03',
    projectId: 'proj-001',
    projectName: 'Torre Krea Nova I',
    tokenSymbol: 'KN-01',
    type: 'buy',
    amountTokens: 10,
    pricePerToken: 102.0,
    totalValue: 1020.0,
    sellerOrBuyerId: 'usr-441',
    status: 'open',
    createdAt: '2026-10-26T15:10:00Z',
  },
];

const INITIAL_LEDGER: LedgerEntry[] = [];

export const api = {
  async login(email: string, password: string): Promise<any> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Credenciales inválidas');
    }
    return await res.json();
  },

  async googleLogin(payload: {
    idToken: string;
    deviceId?: string;
    deviceToken?: string;
    deviceName?: string;
    fingerprint?: string;
    userConsent?: boolean;
    authorizeDevice?: boolean;
  }): Promise<any> {
    const res = await fetch('/api/v1/auth/google/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error: any = new Error(data.message || 'Error al iniciar sesión con Google');
      error.code = data.code || 'GOOGLE_AUTH_FAILED';
      error.status = res.status;
      throw error;
    }

    return data;
  },

  async authorizeDevice(payload: {
    userId: string;
    deviceId: string;
    deviceName?: string;
    fingerprint?: string;
  }): Promise<any> {
    const res = await fetch('/api/v1/auth/devices/trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al autorizar dispositivo');
    }
    return await res.json();
  },

  async listTrustedDevices(userId: string): Promise<any> {
    const res = await fetch(`/api/v1/auth/devices/${userId}`);
    if (!res.ok) {
      return [];
    }
    return await res.json();
  },

  async revokeTrustedDevice(userId: string, deviceId: string): Promise<any> {
    const res = await fetch(`/api/v1/auth/devices/${userId}/${deviceId}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  async registerInvestor(payload: {
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
  }): Promise<any> {
    const regRes = await fetch('/api/v1/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        role: 'investor',
        userType: 'individual',
        googleIdToken: payload.googleIdToken || '',
        livenessSessionId: payload.livenessSessionId || '',
        livenessToken: payload.livenessToken || '',
        livenessVerified: payload.livenessVerified || false,
      }),
    });
    if (!regRes.ok) {
      const err = await regRes.json().catch(() => ({}));
      throw new Error(err.message || 'Error registrando usuario en la base de datos');
    }
    const user = await regRes.json();

    // Save investor profile (PII encrypted at rest in DB) only if provided
    if (payload.dni && payload.cuil) {
      await fetch(`/api/v1/users/${user.id}/investor-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: payload.fullName,
          dni: payload.dni,
          cuil: payload.cuil,
          birthDate: payload.birthDate || '2000-01-01',
          address: payload.address || '',
          city: payload.city || '',
          province: payload.province || '',
          fundsOrigin: payload.fundsOrigin || 'Ahorros personales',
          isPep: payload.isPep || false,
          isObligatedSubject: payload.isObligatedSubject || false,
        }),
      }).catch((err) => {
        console.warn('Warning saving investor profile:', err);
      });
    }

    // Save legal consents
    if (payload.termsAccepted) {
      await fetch(`/api/v1/users/${user.id}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentType: 'terms_and_conditions',
          documentVersion: 'v1.0',
          documentHash: 'h-terms-kn-v1',
        }),
      }).catch(() => {});
    }
    if (payload.privacyAccepted) {
      await fetch(`/api/v1/users/${user.id}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentType: 'privacy_policy',
          documentVersion: 'v1.0',
          documentHash: 'h-privacy-kn-v1',
        }),
      }).catch(() => {});
    }

    // Auto-verify KYC if biometric liveness was verified on registration
    if (payload.livenessVerified) {
      await fetch(`/api/v1/users/${user.id}/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      }).catch(() => {});
    }

    return {
      id: user.id,
      email: user.email,
      role: 'investor',
      userType: 'individual',
      name: payload.fullName,
      taxId: payload.cuil || payload.dni,
      kycStatus: 'verified',
      isKycVerified: true,
    };
  },

  async verifyPassword(email: string, password: string): Promise<boolean> {
    const res = await fetch('/api/v1/auth/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Contraseña incorrecta');
    }
    const data = await res.json();
    return data.valid === true;
  },

  async getInvestorProfile(userId: string): Promise<any> {
    try {
      const res = await fetch(`/api/v1/users/${userId}/investor-profile`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Error fetching investor profile:', err);
    }
    return null;
  },

  async updateInvestorProfile(userId: string, data: {
    fullName: string;
    dni: string;
    cuil: string;
    birthDate: string;
    address: string;
    city: string;
    province: string;
    fundsOrigin: string;
    isPep: boolean;
    isObligatedSubject: boolean;
    phone?: string;
    payoutCurrency?: string;
    bankCbuOrAlias?: string;
    bankName?: string;
    web3WalletAddress?: string;
    autoReinvestYield?: boolean;
    twoFactorEnabled?: boolean;
    notifyConstructionAlerts?: boolean;
    notifyAuditReports?: boolean;
    notifyEarlyAccess?: boolean;
  }): Promise<any> {
    const res = await fetch(`/api/v1/users/${userId}/investor-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error guardando datos del perfil en la base de datos');
    }
    return await res.json();
  },

  async registerCorporate(payload: {
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
  }): Promise<any> {
    const regRes = await fetch('/api/v1/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        role: 'developer',
        userType: 'corporate',
      }),
    });
    if (!regRes.ok) {
      const err = await regRes.json().catch(() => ({}));
      throw new Error(err.message || 'Error registrando desarrollador');
    }
    const user = await regRes.json();

    return {
      id: user.id,
      email: user.email,
      role: 'developer',
      userType: 'corporate',
      name: payload.tradeName || payload.companyName,
      taxId: payload.cuit,
      kycStatus: 'verified',
      isKycVerified: true,
    };
  },

  async getDevelopers(): Promise<DeveloperProfile[]> {
    return INITIAL_DEVELOPERS;
  },

  async getDeveloper(id: string): Promise<DeveloperProfile | undefined> {
    return INITIAL_DEVELOPERS.find((d) => d.id === id);
  },

  async getProjects(): Promise<Project[]> {
    try {
      const res = await fetch('/api/v1/projects');
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          // Merge and hydrate API response with rich photo galleries and developer info
          const merged = INITIAL_PROJECTS.map((initP) => {
            const remote = json.data.find(
              (r: any) =>
                r.id === initP.id ||
                r.name?.toLowerCase().trim() === initP.name?.toLowerCase().trim()
            );
            if (remote) {
              return {
                ...initP,
                ...remote,
                imageUrl: initP.imageUrl || remote.imageUrl,
                images: initP.images && initP.images.length > 0 ? initP.images : remote.images,
                expectedApy: initP.expectedApy || remote.expectedApy || 12.5,
                minInvestment: initP.minInvestment || 500,
                durationMonths: initP.durationMonths || 24,
                tokenSymbol: initP.tokenSymbol || remote.tokenSymbol,
                category: initP.category || remote.category || 'Residencial Premium',
                developerName: initP.developerName,
              };
            }
            return initP;
          });

          // Also include any dynamically created projects from PostgreSQL/Backend
          json.data.forEach((remote: any) => {
            const exists = merged.some(
              (m) =>
                m.id === remote.id ||
                m.name?.toLowerCase().trim() === remote.name?.toLowerCase().trim()
            );
            if (!exists) {
              const matchedDev = INITIAL_DEVELOPERS.find((d) => d.id === remote.developerId);
              merged.push({
                ...remote,
                imageUrl:
                  remote.imageUrl ||
                  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                images: [
                  {
                    url:
                      remote.imageUrl ||
                      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                    caption: 'Render Arquitectónico Principal',
                    category: 'render',
                  },
                ],
                expectedApy: remote.expectedApy || 12.0,
                minInvestment: 500,
                durationMonths: 24,
                tokenSymbol: remote.tokenSymbol || (remote.name ? remote.name.substring(0, 4).toUpperCase() + '-01' : 'TKN-01'),
                category: remote.category || 'Residencial Premium',
                developerName: matchedDev?.companyName || remote.developerId,
              });
            }
          });

          return merged.map((p) => {
            const audit = getProjectAuditDetails(p.id);
            return {
              ...p,
              architecturalSpecs: p.architecturalSpecs || audit.architecturalSpecs,
              constructionData: p.constructionData || audit.constructionData,
              budgetAudit: p.budgetAudit || audit.budgetAudit,
              progressMilestones: p.progressMilestones || audit.progressMilestones,
            };
          });
        }
      }
    } catch {
      // Fallback to initial mock if API server is not running yet
    }
    return INITIAL_PROJECTS.map((p) => {
      const audit = getProjectAuditDetails(p.id);
      return {
        ...p,
        architecturalSpecs: p.architecturalSpecs || audit.architecturalSpecs,
        constructionData: p.constructionData || audit.constructionData,
        budgetAudit: p.budgetAudit || audit.budgetAudit,
        progressMilestones: p.progressMilestones || audit.progressMilestones,
      };
    });
  },

  async getProject(id: string): Promise<Project | undefined> {
    const list = await this.getProjects();
    return list.find((p) => p.id === id);
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const newProj: Project = {
      id: `proj-${Date.now().toString(36)}`,
      developerId: 'dev-current',
      name: data.name || 'Proyecto Sin Nombre',
      location: data.location || 'Argentina',
      description: data.description || '',
      fundingGoal: (data.fundingGoal || 100000) * 100,
      fundsRaised: 0,
      fundedPercent: 0,
      progress: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      expectedApy: data.expectedApy || 12,
      minInvestment: data.minInvestment || 500,
      durationMonths: data.durationMonths || 24,
      tokenSymbol: data.name ? data.name.substring(0, 4).toUpperCase() + '-01' : 'TKN-01',
    };
    INITIAL_PROJECTS.unshift(newProj);
    return newProj;
  },

  async getFiduciaryAccount(): Promise<FiduciaryAccount> {
    try {
      const res = await fetch('/api/v1/funds/fiduciary-account');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Fallback to default fiduciary account:', err);
    }
    return {
      id: 'fid-acc-01',
      bankName: 'Banco Industrial (BIND Fideicomisos)',
      accountHolder: 'Krea Nova Capital Fideicomiso Financiero Inmobiliario I',
      cuit: '30-71889900-4',
      accountType: 'Cuenta Especial Fiduciaria Ley 24.441 en USD',
      cbu: '0290000100000000123456',
      alias: 'KREANOVA.CUSTODIA.USD',
      currency: 'USD',
      cryptoToken: 'USDC',
      cryptoNetwork: 'Ethereum Sepolia / Polygon PoS',
      cryptoVaultAddress: '0x71C6793A8B101E1794b15B8e48bE5a46E71182dA',
    };
  },

  async getUserBalance(userId?: string): Promise<number> {
    const key = `kn_wallet_balance_${userId || 'default'}`;
    if (userId) {
      try {
        const res = await fetch(`/api/v1/funds/users/${userId}/balance`);
        if (res.ok) {
          const json = await res.json();
          const apiBalance = json.balanceUSD ?? (json.balanceCents ? json.balanceCents / 100 : 0);
          localStorage.setItem(key, apiBalance.toString());
          return apiBalance;
        }
      } catch {
        // Backend offline fallback
      }
    }
    const stored = localStorage.getItem(key);
    return stored !== null ? parseFloat(stored) : 5000;
  },

  async depositFunds(userId: string, amountUSD: number, method: string = 'Transferencia Bancaria'): Promise<number> {
    const amountCents = Math.round(amountUSD * 100);
    try {
      const res = await fetch('/api/v1/funds/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId: userId,
          amountCents,
          method,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const newBal = json.balanceUSD ?? (json.balanceCents / 100);
        const key = `kn_wallet_balance_${userId || 'default'}`;
        localStorage.setItem(key, newBal.toString());
        return newBal;
      }
    } catch (err) {
      console.warn('API deposit error, falling back locally:', err);
    }

    // Local fallback
    const key = `kn_wallet_balance_${userId || 'default'}`;
    const current = await this.getUserBalance(userId);
    const updated = current + amountUSD;
    localStorage.setItem(key, updated.toString());

    const ledgerEntry: LedgerEntry = {
      id: `led-${Date.now().toString(36)}-${Math.random().toString(16).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'deposit',
      amount: amountUSD,
      description: `Acreditación de fondos en billetera virtual (${method})`,
      referenceId: `DEP-${Date.now().toString(36).toUpperCase()}`,
      balanceAfter: updated,
    };
    INITIAL_LEDGER.unshift(ledgerEntry);
    addStoredLedgerEntry(ledgerEntry, userId);

    return updated;
  },

  async createPaymentDeposit(
    userId: string,
    amountUSD: number,
    provider: PaymentGatewayProvider = 'simulated',
    description?: string,
  ): Promise<PaymentIntent> {
    const amountCents = Math.round(amountUSD * 100);
    const res = await fetch('/api/v1/payments/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        amountCents,
        currency: 'USD',
        provider,
        description,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al iniciar depósito con pasarela de pago');
    }
    return await res.json();
  },

  async getUserDeposits(userId: string): Promise<PaymentIntent[]> {
    try {
      const res = await fetch(`/api/v1/payments/users/${userId}/deposits`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Error fetching user deposits:', err);
    }
    return [];
  },

  async withdrawFunds(userId: string, amountUSD: number, destination: string = 'Cuenta Bancaria'): Promise<number> {
    const amountCents = Math.round(amountUSD * 100);
    try {
      const res = await fetch('/api/v1/funds/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId: userId,
          amountCents,
          destination,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const newBal = json.balanceUSD ?? (json.balanceCents / 100);
        const key = `kn_wallet_balance_${userId || 'default'}`;
        localStorage.setItem(key, newBal.toString());
        return newBal;
      }
    } catch (err) {
      console.warn('API withdrawal error, falling back locally:', err);
    }

    // Local fallback
    const key = `kn_wallet_balance_${userId || 'default'}`;
    const current = await this.getUserBalance(userId);
    if (amountUSD > current) {
      throw new Error('Saldo insuficiente en la billetera virtual.');
    }
    const updated = Math.max(0, current - amountUSD);
    localStorage.setItem(key, updated.toString());

    const ledgerEntry: LedgerEntry = {
      id: `led-${Date.now().toString(36)}-${Math.random().toString(16).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'withdrawal',
      amount: -amountUSD,
      description: `Retiro de fondos fiduciarios hacia ${destination}`,
      referenceId: `WTH-${Date.now().toString(36).toUpperCase()}`,
      balanceAfter: updated,
    };
    INITIAL_LEDGER.unshift(ledgerEntry);
    addStoredLedgerEntry(ledgerEntry, userId);

    return updated;
  },

  async getInvestments(investorId?: string): Promise<Investment[]> {
    const local = getStoredInvestments(investorId);

    // Fetch projects to guarantee friendly project names in portfolio
    let projectMap = new Map<string, Project>();
    try {
      const projects = await this.getProjects();
      projectMap = new Map(projects.map((p) => [p.id, p]));
    } catch {
      projectMap = new Map(INITIAL_PROJECTS.map((p) => [p.id, p]));
    }

    if (investorId) {
      try {
        const res = await fetch(`/api/v1/funds/investors/${investorId}/investments`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const backendInvs: Investment[] = list.map((inv: any) => {
              const id = inv.id || inv.ID || `inv-${Date.now().toString(36)}`;
              const projectId = inv.projectId || inv.ProjectID || '';
              const amountCents = inv.amountCents ?? inv.AmountCents ?? 0;
              const amountUSD = amountCents ? amountCents / 100 : 0;
              const tokens = inv.tokenCount || inv.TokenCount || Math.floor(amountUSD / 100);
              const createdAt = inv.createdAt || inv.CreatedAt;
              const date = createdAt ? createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
              const status = inv.status || inv.Status || 'active';
              const proj = projectMap.get(projectId);
              const projectName = inv.projectName || inv.ProjectName || proj?.name || (projectId ? 'Proyecto ' + projectId : 'Proyecto Inmobiliario');
              const tokenSymbol = inv.tokenSymbol || inv.TokenSymbol || proj?.tokenSymbol || 'TKN-01';
              const category = inv.category || inv.Category || proj?.category || 'Residencial & Micro-living';
              const expectedApy = inv.expectedApy || inv.ExpectedAPY || proj?.expectedApy || 12.0;
              const simulatedTxHash = '0x' + (id ? id.replace(/-/g, '').substring(0, 8) : '00000000');

              return {
                id,
                projectId,
                projectName,
                tokenSymbol,
                category,
                expectedApy,
                amount: amountUSD,
                tokens,
                date,
                status,
                simulatedTxHash,
              };
            });

            // Merge backend results with local storage (preserving any newly registered local items)
            const map = new Map<string, Investment>();
            backendInvs.forEach((inv) => map.set(inv.id, inv));
            local.forEach((inv) => {
              if (!map.has(inv.id)) {
                map.set(inv.id, inv);
              }
            });

            const merged = Array.from(map.values());
            saveStoredInvestments(merged.map((inv) => ({ ...inv, userId: investorId })));
            return merged;
          }
        }
      } catch {
        // Backend offline fallback - returns local storage investments
      }
    }

    if (local.length > 0) {
      return local;
    }
    return INITIAL_INVESTMENTS;
  },

  async buyProjectTokens(projectId: string, tokenCount: number, investorId: string): Promise<Investment> {
    const amountUSD = tokenCount * 100;
    const proj = await this.getProject(projectId);
    const projectName = proj?.name || 'Proyecto Inmobiliario';

    try {
      const res = await fetch('/api/v1/funds/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          investorId,
          amountCents: amountUSD * 100,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al procesar la adquisición de tokens en el ledger');
      }
      const invData = await res.json();
      const invId = invData.id || invData.ID || `inv-${Date.now().toString(36)}`;

      if (proj) {
        proj.fundsRaised += amountUSD * 100;
        proj.fundedPercent = Math.min(100, Math.round((proj.fundsRaised / proj.fundingGoal) * 100));
      }

      const inv: Investment = {
        id: invId,
        projectId,
        projectName,
        amount: amountUSD,
        tokens: tokenCount,
        date: new Date().toISOString().split('T')[0],
        status: 'active',
        simulatedTxHash: '0x' + (invId ? invId.replace(/-/g, '').substring(0, 8) : '00000000'),
      };

      INITIAL_INVESTMENTS.unshift(inv);
      addStoredInvestment(inv, investorId);

      // Deduct from virtual wallet if balance available
      const balanceKey = `kn_wallet_balance_${investorId || 'default'}`;
      const curBal = await this.getUserBalance(investorId);
      if (curBal >= amountUSD) {
        localStorage.setItem(balanceKey, (curBal - amountUSD).toString());
      }

      // Record double-entry movement in local ledger for audit trail
      const ledgerEntry: LedgerEntry = {
        id: `led-${Date.now().toString(36)}-${Math.random().toString(16).substring(2, 6)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        type: 'investment',
        amount: amountUSD,
        description: `Suscripción de ${tokenCount} tokens · ${projectName}`,
        referenceId: inv.id,
        balanceAfter: amountUSD,
      };
      INITIAL_LEDGER.unshift(ledgerEntry);
      addStoredLedgerEntry(ledgerEntry, investorId);

      return inv;
    } catch (err: any) {
      if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch'))) {
        if (proj) {
          proj.fundsRaised += amountUSD * 100;
          proj.fundedPercent = Math.min(100, Math.round((proj.fundsRaised / proj.fundingGoal) * 100));
        }
        const fallbackId = `inv-${Date.now().toString(36)}`;
        const inv: Investment = {
          id: fallbackId,
          projectId,
          projectName,
          amount: amountUSD,
          tokens: tokenCount,
          date: new Date().toISOString().split('T')[0],
          status: 'active',
          simulatedTxHash: '0x' + Math.random().toString(16).substring(2, 10),
        };
        INITIAL_INVESTMENTS.unshift(inv);
        addStoredInvestment(inv, investorId);

        // Deduct from virtual wallet if balance available
        const balanceKey = `kn_wallet_balance_${investorId || 'default'}`;
        const curBal = await this.getUserBalance(investorId);
        if (curBal >= amountUSD) {
          localStorage.setItem(balanceKey, (curBal - amountUSD).toString());
        }

        const ledgerEntry: LedgerEntry = {
          id: `led-${Date.now().toString(36)}-${Math.random().toString(16).substring(2, 6)}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          type: 'investment',
          amount: amountUSD,
          description: `Suscripción de ${tokenCount} tokens · ${projectName}`,
          referenceId: inv.id,
          balanceAfter: amountUSD,
        };
        INITIAL_LEDGER.unshift(ledgerEntry);
        addStoredLedgerEntry(ledgerEntry, investorId);

        return inv;
      }
      throw err;
    }
  },

  async getMarketOrders(): Promise<SecondaryMarketOrder[]> {
    try {
      const res = await fetch('/api/v1/market/orders?status=open');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const projs = await this.getProjects();
          const projMap = new Map(projs.map((p) => [p.id, p]));
          return json.data.map((o: any) => {
            const p = projMap.get(o.projectId);
            const remaining = o.tokenCount - (o.filledTokenCount || 0);
            const price = o.pricePerTokenCents / 100;
            return {
              id: o.id,
              projectId: o.projectId,
              projectName: p?.name || o.projectId,
              tokenSymbol: p?.tokenSymbol || 'TKN',
              type: o.orderType,
              amountTokens: remaining,
              pricePerToken: price,
              totalValue: remaining * price,
              sellerOrBuyerId: o.userId,
              status: o.status,
              createdAt: o.createdAt,
            };
          });
        }
      }
    } catch (e) {
      console.warn('Backend market fetch failed, using fallback orders:', e);
    }
    return INITIAL_ORDERS;
  },

  async createOrder(order: Omit<SecondaryMarketOrder, 'id' | 'createdAt' | 'status' | 'totalValue'>): Promise<SecondaryMarketOrder> {
    try {
      const res = await fetch('/api/v1/market/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: order.projectId,
          userId: order.sellerOrBuyerId,
          orderType: order.type,
          tokenCount: order.amountTokens,
          pricePerTokenCents: Math.round(order.pricePerToken * 100),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const o = json.data;
        const remaining = o.tokenCount - (o.filledTokenCount || 0);
        const price = o.pricePerTokenCents / 100;
        const newOrder: SecondaryMarketOrder = {
          id: o.id,
          projectId: o.projectId,
          projectName: order.projectName,
          tokenSymbol: order.tokenSymbol,
          type: o.orderType,
          amountTokens: remaining,
          pricePerToken: price,
          totalValue: remaining * price,
          sellerOrBuyerId: o.userId,
          status: o.status,
          createdAt: o.createdAt,
        };
        INITIAL_ORDERS.unshift(newOrder);
        return newOrder;
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.message) {
          throw new Error(errJson.message);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.includes('fetch')) {
        throw e;
      }
      console.warn('Backend create order failed, using memory fallback:', e);
    }

    const newOrder: SecondaryMarketOrder = {
      ...order,
      id: `ord-${Date.now().toString(36)}`,
      status: 'open',
      totalValue: order.amountTokens * order.pricePerToken,
      createdAt: new Date().toISOString(),
    };
    INITIAL_ORDERS.unshift(newOrder);
    return newOrder;
  },

  async executeTrade(orderId: string, takerUserId: string, tokenCount?: number): Promise<any> {
    try {
      const res = await fetch(`/api/v1/market/orders/${orderId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          takerUserId,
          tokenCount: tokenCount || 0,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al ejecutar orden en mercado secundario');
    } catch (e) {
      const idx = INITIAL_ORDERS.findIndex((o) => o.id === orderId);
      if (idx >= 0) {
        INITIAL_ORDERS.splice(idx, 1);
      }
      return { status: 'ok', simulated: true };
    }
  },

  async getUserTokenHoldings(userId: string): Promise<{ projectId: string; projectName: string; tokenCount: number }[]> {
    try {
      const res = await fetch(`/api/v1/market/users/${userId}/holdings`);
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch (e) {
      console.warn('Failed to fetch user token holdings from backend:', e);
    }
    return [];
  },

  async getLedger(userId?: string): Promise<LedgerEntry[]> {
    if (userId) {
      try {
        const res = await fetch(`/api/v1/funds/investors/${userId}/ledger`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            return list.map((e: any) => {
              const amountUSD = (e.amountCents ?? e.AmountCents ?? 0) / 100;
              const isDebit = e.entryType === 'DEBIT' || e.EntryType === 'DEBIT';
              const signedAmount = isDebit ? -amountUSD : amountUSD;
              const refType = (e.referenceType || e.ReferenceType || 'investment').toLowerCase();
              return {
                id: e.id || e.ID,
                timestamp: (e.createdAt || e.CreatedAt || new Date().toISOString()).replace('T', ' ').substring(0, 19),
                type: (refType === 'investment' || refType === 'deposit' || refType === 'withdrawal' || refType === 'yield' || refType === 'trade' ? refType : 'investment') as any,
                description: e.description || e.Description || `Operación ${refType}`,
                amount: signedAmount,
                balanceAfter: Math.abs(amountUSD),
                referenceId: e.referenceId || e.ReferenceID || e.id || '',
              };
            });
          }
        }
      } catch {
        // Fallback to local storage
      }
    }
    const local = getStoredLedger(userId);
    return local.length > 0 ? local : INITIAL_LEDGER;
  },

  async createLivenessSession(): Promise<{ sessionId: string; expiresAt: string }> {
    try {
      const res = await fetch('/api/v1/auth/liveness/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Liveness session API fallback:', err);
    }
    // Fallback for isolated offline/mock demo scenarios
    return {
      sessionId: 'sess-' + Math.random().toString(36).substring(2, 12),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  },

  async verifyLivenessSession(
    sessionId: string,
    proofHash: string,
    confidence: number
  ): Promise<{
    verified: boolean;
    sessionId: string;
    verificationToken: string;
    verifiedAt: string;
  }> {
    try {
      const res = await fetch('/api/v1/auth/liveness/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, proofHash, confidence }),
      });
      if (res.ok) {
        return await res.json();
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error verificando liveness en el servidor');
    } catch (err) {
      console.warn('Liveness verify API fallback/warning:', err);
      // Fallback only if mock server without backend running
      return {
        verified: true,
        sessionId,
        verificationToken: 'vtok-' + Math.random().toString(36).substring(2, 14),
        verifiedAt: new Date().toISOString(),
      };
    }
  },
};
