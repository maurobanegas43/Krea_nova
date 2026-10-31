export type ProjectStatus = 'draft' | 'under_review' | 'approved' | 'rejected' | 'published';

export interface ProjectImage {
  url: string;
  caption: string;
  category?: 'render' | 'construction' | 'interior' | 'amenity' | 'aerial';
}

export interface DeveloperProfile {
  id: string;
  companyName: string;
  tradeName: string;
  cuit: string;
  companyType: 'SA' | 'SAS' | 'SRL' | 'Fideicomiso';
  email: string;
  phone: string;
  legalAddress: string;
  repFullName: string;
  repRole: string;
  specialty: string;
  deliveredM2: number;
  completedProjects: number;
  verificationStatus: 'verified' | 'pending';
  logoBadge?: string;
}

export interface BudgetItem {
  id: string;
  category: 'material' | 'payroll' | 'equipment' | 'permits_fees';
  concept: string;
  details: string;
  quantity?: number;
  unit?: string;
  unitPriceUSD?: number;
  totalUSD: number;
  datePaid: string;
  recipientOrSupplier: string;
  receiptNumber: string;
}

export interface ProgressMilestone {
  id: string;
  date: string;
  title: string;
  phase: string;
  percentage: number;
  inspector: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  reportSummary: string;
  technicalDetails: string;
}

export interface ArchitecturalSpecs {
  studioName: string;
  leadArchitect: string;
  structuralEngineer: string;
  landscapeDesign?: string;
  designConcept: string;
  sustainabilityRating: string;
  totalBuiltAreaM2: number;
  sellableAreaM2: number;
  floorsCount: number;
  subfloorsCount: number;
  totalUnitsCount: number;
  amenitiesDescription: string;
}

export interface ConstructionData {
  generalContractor: string;
  technicalAuditor: string;
  permitNumber: string;
  workStartDate: string;
  estimatedDeliveryDate: string;
  insurancePolicy: string;
  fiduciaryTrustee: string;
  notaryPublic: string;
  currentWorkStatusSummary: string;
}

export interface ProjectBudgetAudit {
  totalBudgetUSD: number;
  executedBudgetUSD: number;
  rubrosSummary: {
    rubro: string;
    budgetedUSD: number;
    executedUSD: number;
    percentage: number;
  }[];
  budgetItems: BudgetItem[];
}

export interface Project {
  id: string;
  developerId: string;
  developerName?: string;
  name: string;
  location: string;
  description: string;
  fundingGoal: number; // in minor units / cents or USD
  fundsRaised: number;
  fundedPercent: number;
  progress: number; // construction progress 0-100
  status: ProjectStatus;
  createdAt: string;
  expectedApy?: number;
  minInvestment?: number;
  durationMonths?: number;
  tokenSymbol?: string;
  imageUrl?: string;
  images?: ProjectImage[];
  category?: string;
  architecturalSpecs?: ArchitecturalSpecs;
  constructionData?: ConstructionData;
  budgetAudit?: ProjectBudgetAudit;
  progressMilestones?: ProgressMilestone[];
}

export interface Investment {
  id: string;
  projectId: string;
  projectName: string;
  tokenSymbol?: string;
  category?: string;
  expectedApy?: number;
  amount: number;
  tokens: number;
  date: string;
  status: 'active' | 'completed' | 'processing' | 'pending';
  simulatedTxHash: string;
}

export interface FiduciaryAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  cuit: string;
  accountType: string;
  cbu: string;
  alias: string;
  currency: string;
  cryptoToken: string;
  cryptoNetwork: string;
  cryptoVaultAddress: string;
}

export interface SecondaryMarketOrder {
  id: string;
  projectId: string;
  projectName: string;
  tokenSymbol: string;
  type: 'buy' | 'sell';
  amountTokens: number;
  pricePerToken: number;
  totalValue: number;
  sellerOrBuyerId: string;
  status: 'open' | 'matched' | 'cancelled';
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  type: 'deposit' | 'investment' | 'yield' | 'trade' | 'withdrawal';
  description: string;
  amount: number;
  balanceAfter: number;
  referenceId: string;
}

export type PaymentGatewayProvider = 'simulated' | 'mercadopago' | 'stripe';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PaymentIntent {
  id: string;
  userId: string;
  provider: PaymentGatewayProvider;
  externalId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  createdAt: string;
  updatedAt: string;
}
