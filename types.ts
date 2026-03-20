
export interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  isMaster?: boolean;
  isApproved: boolean;
  canEdit: boolean;
  allowedTabs?: string[];
  receiveNotifications: boolean; 
  passwordResetRequested?: boolean;
  needsPasswordReset?: boolean;
  supabaseConfig?: { url: string; key: string };
  lastSync?: string;
  updatedAt?: number;
}

export interface NotificationSettings {
  notifyMasterOnNewUser: boolean;
  notifyOnLowFeed: boolean;
  systemEmailSender: string;
  updatedAt?: number;
}

export interface ProductionProtocol {
  id: string;
  name: string;
  species: string;
  targetWeight: number;
  expectedFca: number;
  estimatedDays: number;
  userId?: string;
  updatedAt?: number;
}

export interface Line {
  id: string;
  name: string;
  userId?: string;
  updatedAt?: number;
}

export interface Batch {
  id: string;
  name: string;
  settlementDate: string;
  initialQuantity: number;
  initialUnitWeight: number;
  protocolId?: string;
  expectedHarvestDate?: string;
  isSettlementComplete?: boolean;
  isClosed?: boolean;
  closedAt?: string;
  userId?: string;
  updatedAt?: number;
}

export type CageStatus = 'Disponível' | 'Ocupada' | 'Manutenção' | 'Limpeza' | 'Avaliação' | 'Sucata';

export interface Cage {
  id: string;
  lineId?: string;
  name: string;
  model: '4x4' | '6x6' | '8x8' | '12x12' | 'Circular';
  dimensions: {
    length: number;
    width: number;
    depth: number;
  };
  stockingDensity?: number;
  stockingCapacity: number;
  status: CageStatus;
  userId?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  batchId?: string;
  initialFishCount?: number;
  settlementDate?: string;
  harvestDate?: string;
  updatedAt?: number;
}

export interface FeedType {
  id: string;
  name: string; 
  totalStock: number;
  maxCapacity: number;
  minStockPercentage: number;
  userId?: string;
  updatedAt?: number;
}

export interface FeedingLog {
  id: string;
  cageId: string;
  batchId?: string;
  feedTypeId: string;
  amount: number;
  timestamp: string;
  userId: string;
  updatedAt?: number;
}

export interface MortalityLog {
  id: string;
  cageId: string;
  batchId?: string;
  count: number;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface BiometryLog {
  id: string;
  cageId: string;
  batchId?: string;
  averageWeight: number;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface SlaughterLog {
  id: string;
  producer: string;
  date: string;
  gtaWeight: number;
  packingList: number;
  receptionWeight: number;
  startTime: string;
  slaughterBatch: string;
  endTime: string;
  packedQuantity: number;
  packagingBatch: string;
  freightValue?: number;
  fieldCondemnation?: number;
  transportCondemnation?: number;
  slaughterCondemnation?: number;
  invoiceValue?: number;
  revenuePerKg?: number;
  renderingWeight?: number;
  userId: string;
  timestamp: string;
  updatedAt?: number;
}

export interface SlaughterExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  quantity?: number;
  unitValue?: number;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface SlaughterEmployee {
  id: string;
  registrationNumber: string;
  name: string;
  role: string;
  department: string;
  admissionDate: string;
  status: 'Ativo' | 'Inativo';
  updatedAt?: number;
}

export interface SlaughterHREntry {
  id: string;
  employeeIds: string[];
  type: string;
  date: string;
  days?: number;
  description?: string;
  userId: string;
  updatedAt?: number;
}

export interface SlaughterHRIndicator {
  id: string;
  month: number;
  year: number;
  turnover: number;
  absenteeism: number;
  accidents: number;
  userId: string;
  updatedAt?: number;
}

export interface SlaughterSupplyItem {
  id: string;
  code: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  updatedAt?: number;
}

export interface SlaughterSupplier {
  id: string;
  code: string;
  name: string;
  cnpj?: string;
  contact?: string;
  phone?: string;
  userId: string;
  updatedAt?: number;
}

export interface SlaughterSupplyRequest {
  id: string;
  itemId: string;
  supplierId?: string;
  quantity: number;
  requesterId: string;
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  date: string;
  updatedAt?: number;
}

export interface SlaughterPurchaseOrder {
  id: string;
  code: string;
  itemId: string;
  supplierId?: string;
  quantity: number;
  requesterId: string;
  status: 'Pendente' | 'Aprovado' | 'Cancelado' | 'Recebido';
  date: string;
  updatedAt?: number;
}

export interface SlaughterSupplyInvoice {
  id: string;
  itemId: string;
  supplierId: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  invoiceNumber: string;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface HarvestLog {
  id: string;
  batchId: string;
  cageId: string;
  fishCount: number;
  totalWeight: number;
  averageWeight?: number;
  initialFishCount?: number; // Qtd inicial na gaiola no momento da despesca
  date: string;
  userId: string;
  timestamp: string;
  updatedAt?: number;
}

export type FeedStockLogType = 'Entrada' | 'Ajuste';

export interface FeedStockLog {
  id: string;
  feedTypeId: string;
  amount: number; // em gramas
  type: FeedStockLogType;
  timestamp: string;
  userId: string;
  updatedAt?: number;
}

export interface InvestmentPortfolio {
  id: string;
  name: string;
  totalValue: number;
  startDate: string;
  endDate: string;
  manager: string;
  userId?: string;
  updatedAt?: number;
}

export interface CapexProject {
  id: string;
  portfolioId: string;
  name: string;
  costCenter: string;
  plannedValue: number;
  startDate: string;
  endDate: string;
  responsible: string;
  investmentArea: string;
  userId?: string;
  updatedAt?: number;
}

export type CapexInvoiceType = 'Prestação de Serviço' | 'Aquisição';

export interface CapexInvoice {
  id: string;
  portfolioId: string;
  projectId: string;
  invoiceNumber: string;
  supplier: string;
  cnpj: string;
  items: string;
  type: CapexInvoiceType;
  value: number;
  date: string;
  deliveryDate: string;
  description: string;
  userId: string;
  timestamp: string;
  updatedAt?: number;
}

export interface HarvestSchedule {
  id: string;
  date: string;
  lastFeedingDate?: string;
  cageIds: string[];
  batchId: string;
  notes?: string;
  userId: string;
  updatedAt: number;
}

export interface ColdStorageLog {
  id: string;
  date: string;
  chamberName: string;
  temperature: number;
  userId: string;
  timestamp: string;
  updatedAt: number;
}

export interface UtilityLog {
  id: string;
  date: string;
  type: 'water' | 'energy';
  reading: number;
  userId: string;
  timestamp: string;
  updatedAt: number;
}

export interface BatchExpense {
  id: string;
  batchId: string;
  description: string;
  category: string;
  value: number;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface AppState {
  users: User[];
  lines: Line[];
  batches: Batch[];
  cages: Cage[];
  feedTypes: FeedType[];
  feedingLogs: FeedingLog[];
  feedStockLogs: FeedStockLog[];
  mortalityLogs: MortalityLog[];
  biometryLogs: BiometryLog[];
  slaughterLogs: SlaughterLog[];
  slaughterExpenses?: SlaughterExpense[];
  slaughterEmployees?: SlaughterEmployee[];
  slaughterHRIndicators?: SlaughterHRIndicator[];
  slaughterHREntries?: SlaughterHREntry[];
  slaughterSupplyItems?: SlaughterSupplyItem[];
  slaughterSuppliers?: SlaughterSupplier[];
  slaughterSupplyRequests?: SlaughterSupplyRequest[];
  slaughterPurchaseOrders?: SlaughterPurchaseOrder[];
  slaughterSupplyInvoices?: SlaughterSupplyInvoice[];
  slaughterSupplyCategories?: string[];
  slaughterExpenseCategories?: string[];
  slaughterHREntryTypes?: string[];
  slaughterHRDepartments?: string[];
  slaughterHRRoles?: string[];
  harvestLogs?: HarvestLog[];
  harvestSchedules?: HarvestSchedule[];
  batchExpenses?: BatchExpense[];
  coldStorageLogs?: ColdStorageLog[];
  utilityLogs?: UtilityLog[];
  protocols: ProductionProtocol[];
  portfolios: InvestmentPortfolio[];
  capexProjects: CapexProject[];
  capexInvoices: CapexInvoice[];
  farmTargetCapacity?: number;
  notificationSettings?: NotificationSettings;
  supabaseConfig?: { url: string; key: string };
  lastSync?: string;
  deletedIds?: string[];
}
