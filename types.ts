
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
  receiveNotifications: boolean; 
  updatedAt?: number;
}

export interface NotificationSettings {
  notifyMasterOnNewUser: boolean;
  notifyOnLowFeed: boolean;
  notifyOnWaterCritical: boolean;
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
  userId?: string;
  updatedAt?: number;
}

export type CageStatus = 'Disponível' | 'Ocupada' | 'Manutenção' | 'Limpeza';

export interface Cage {
  id: string;
  lineId?: string;
  name: string;
  dimensions: {
    length: number;
    width: number;
    depth: number;
  };
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
  feedTypeId: string;
  amount: number;
  timestamp: string;
  userId: string;
  updatedAt?: number;
}

export interface MortalityLog {
  id: string;
  cageId: string;
  count: number;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface BiometryLog {
  id: string;
  cageId: string;
  averageWeight: number;
  date: string;
  userId: string;
  updatedAt?: number;
}

export interface WaterLog {
  id: string;
  date: string;
  time: string;
  temperature: number;
  ph: number;
  oxygen: number;
  transparency: number;
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
  userId: string;
  timestamp: string;
  updatedAt?: number;
}

export interface AppState {
  users: User[];
  lines: Line[];
  batches: Batch[];
  cages: Cage[];
  feedTypes: FeedType[];
  feedingLogs: FeedingLog[];
  mortalityLogs: MortalityLog[];
  biometryLogs: BiometryLog[];
  waterLogs: WaterLog[];
  slaughterLogs: SlaughterLog[];
  protocols: ProductionProtocol[];
  notificationSettings?: NotificationSettings;
  supabaseConfig?: { url: string; key: string };
  lastSync?: string;
  deletedIds?: string[];
}
