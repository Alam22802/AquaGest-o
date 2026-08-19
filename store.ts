
import { AppState, User, NotificationSettings, SlaughterLog } from './types';
import { createClient } from '@supabase/supabase-js';
import LZString from 'lz-string';

const STORAGE_KEY = 'aquagestao_v1';
const SUPABASE_CONFIG_KEY = 'aquagestao_supabase_config';
const SESSION_KEY = 'aquagestao_session';

const initialMaster: User = {
  id: 'master-001',
  name: 'Administrador Mestre',
  username: 'admin',
  phone: '00000000000',
  email: 'mestre@fazenda.com',
  password: 'Costafoods@2026',
  isMaster: true,
  isApproved: true,
  canEdit: true,
  receiveNotifications: true,
  updatedAt: 1
};

const defaultNotificationSettings: NotificationSettings = {
  notifyMasterOnNewUser: true,
  notifyOnLowFeed: true,
  systemEmailSender: 'noreply@aquagestao.com',
  updatedAt: 1
};

export const isBatchMatch = (targetIdOrName: string | undefined, batch: any): boolean => {
  if (!targetIdOrName || !batch) return false;
  const tid = targetIdOrName.trim().toLowerCase();
  if (tid === batch.id?.toLowerCase()) return true;

  const bn = (batch.name || '').trim().toLowerCase();
  if (tid === bn) return true;

  const tidNorm = tid.replace(/[^a-z0-9]/g, '');
  const bnNorm = bn.replace(/[^a-z0-9]/g, '');
  if (tidNorm.length > 0 && tidNorm === bnNorm) return true;

  const tidNoLote = tid.replace(/^lote\s*/i, '').trim();
  const bnNoLote = bn.replace(/^lote\s*/i, '').trim();
  if (tidNoLote.length > 0 && tidNoLote === bnNoLote) return true;

  const tidNum = tidNoLote.replace(/^0+/, '');
  const bnNum = bnNoLote.replace(/^0+/, '');
  if (tidNum.length > 0 && tidNum === bnNum) return true;

  return false;
};

const initialState: AppState = {
  users: [initialMaster],
  lines: [],
  batches: [],
  cages: [],
  feedTypes: [],
  feedingLogs: [],
  feedStockLogs: [],
  mortalityLogs: [],
  biometryLogs: [],
  slaughterLogs: [],
  slaughterExpenses: [],
  slaughterEmployees: [],
  slaughterHRIndicators: [],
  slaughterHREntries: [],
  slaughterHRVacancies: [],
  slaughterExpenseCategories: ['Folha de Pagamento', 'Manutenção', 'Energia', 'Água', 'Insumos', 'Prestação de Serviços', 'Outros'],
  slaughterHREntryTypes: ['Falta', 'Atestado Médico', 'Acidente', 'Turnover', 'Outros'],
  slaughterHRDepartments: ['Abate', 'Desossa', 'Expedição', 'Administrativo', 'Limpeza', 'Manutenção'],
  slaughterHRRoles: ['Operador', 'Supervisor', 'Gerente', 'Auxiliar', 'Técnico'],
  slaughterSupplyItems: [],
  slaughterSupplyRequests: [],
  slaughterPurchaseOrders: [],
  slaughterSupplyInvoices: [],
  slaughterSupplyCategories: [],
  harvestLogs: [],
  harvestSchedules: [],
  batchExpenses: [],
  batchRevenues: [],
  coldStorageLogs: [],
  utilityLogs: [],
  coldChambers: [],
  pcpSuppliers: [],
  pcpSlaughterSchedules: [],
  protocols: [],
  standardCurves: [],
  portfolios: [],
  capexProjects: [],
  capexInvoices: [],
  capexPurchaseOrders: [],
  feedingTables: [],
  costCenters: [],
  pcmEquipments: [],
  pcmStoppageReasons: [],
  pcmProductionStoppages: [],
  pcmPlannedImprovements: [],
  farmTargetCapacity: 0,
  notificationSettings: defaultNotificationSettings,
  deletedIds: [
    '9ce0396e-06cf-416d-b795-ae69fc473fae',
    '01/2026 - L2',
    '972c8350-2c1c-42e4-b325-43a8d83802ee'
  ]
};

function isObjectModified(a: any, b: any): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  const keysA = Object.keys(a);
  for (const key of keysA) {
    if (key === 'updatedAt' || key === 'lastSync') continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      return true;
    }
  }
  const keysB = Object.keys(b);
  for (const key of keysB) {
    if (key === 'updatedAt' || key === 'lastSync') continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      return true;
    }
  }
  return false;
}

function mergeArraysById<T extends { id: string, name?: string, batchId?: string, updatedAt?: number | string }>(
  local: T[], 
  remote: T[], 
  deletedIds: string[] = [],
  priority: 'local' | 'remote' = 'local',
  preserveOnBatchDeletion: boolean = false
): T[] {
  const safeLocal = local || [];
  const safeRemote = remote || [];
  
  const map = new Map<string, T>();
  const deletedSet = new Set(deletedIds || []);

  const now = Date.now();
  const getTime = (item: T): number => {
    if (!item || item.updatedAt === undefined || item.updatedAt === null) return 0;
    let t = typeof item.updatedAt === 'number' ? item.updatedAt : new Date(item.updatedAt).getTime();
    if (isNaN(t)) return 0;
    if (t > now + 60000) return now; // Cap future timestamps
    return t;
  };

  const isItemDeleted = (item: any): boolean => {
    if (!item || !item.id) return true;
    if (deletedSet.has(item.id)) return true;
    if (!preserveOnBatchDeletion) {
      if (item.name && deletedSet.has(item.name)) return true;
      if (item.batchId && deletedSet.has(item.batchId)) return true;
    }
    return false;
  };

  // 1. Process local items first
  for (let i = 0; i < safeLocal.length; i++) {
    const item = safeLocal[i];
    if (isItemDeleted(item)) continue;
    map.set(item.id, item);
  }

  // 2. Process remote items
  for (let i = 0; i < safeRemote.length; i++) {
    const item = safeRemote[i];
    if (isItemDeleted(item)) continue;
    
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const itemTime = getTime(item);
      const existingTime = getTime(existing);
      const isModified = isObjectModified(existing, item);
      
      if (itemTime > existingTime) {
        // Remote is strictly newer
        map.set(item.id, item);
      } else if (existingTime > itemTime) {
        // Local is strictly newer
        map.set(item.id, existing);
      } else {
        // Equal timestamps: if modified and local priority, keep local
        if (priority === 'local') {
          map.set(item.id, existing);
        } else {
          map.set(item.id, isModified ? item : existing);
        }
      }
    }
  }

  return Array.from(map.values()).filter(i => !isItemDeleted(i));
}

export const normalizeLoginString = (str?: string): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, ' '); // normalize spaces
};

export const matchUserCredentials = (user: User, inputUsername: string): boolean => {
  if (!user || !inputUsername) return false;
  const inputRaw = inputUsername.trim();
  const inputNorm = normalizeLoginString(inputUsername);
  const inputCompact = inputNorm.replace(/\s+/g, '');

  const uName = user.username ? user.username.trim() : '';
  const uNameNorm = normalizeLoginString(user.username);
  const uNameCompact = uNameNorm.replace(/\s+/g, '');

  const uEmail = user.email ? user.email.trim().toLowerCase() : '';
  const uFullNameNorm = normalizeLoginString(user.name);

  // 1. Direct username match (case-insensitive)
  if (uName.toLowerCase() === inputRaw.toLowerCase()) return true;

  // 2. Normalized username match (accent-free, trimmed)
  if (uNameNorm === inputNorm) return true;

  // 3. Compact username match (ignoring internal spaces)
  if (uNameCompact.length > 0 && uNameCompact === inputCompact) return true;

  // 4. Email match
  if (uEmail && (uEmail === inputRaw.toLowerCase() || uEmail === inputNorm)) return true;

  // 5. Special aliases for Master Admin
  if (user.isMaster || uNameNorm === 'admin') {
    if (['admin', 'administrador', 'mestre', 'master'].includes(inputNorm)) return true;
    if (uEmail && uEmail === inputRaw.toLowerCase()) return true;
  }

  // 6. Full name match (accent-free)
  if (uFullNameNorm === inputNorm && inputNorm.length > 2) return true;

  return false;
};

export const matchUserPassword = (user: User, inputPassword: string): boolean => {
  if (!user) return false;
  const rawPass = inputPassword || '';
  const trimmedPass = rawPass.trim();
  const userPass = user.password || '';
  const userTrimmed = userPass.trim();

  // 1. Exact match
  if (userPass === rawPass) return true;

  // 2. Trimmed match
  if (userTrimmed === trimmedPass) return true;

  // 3. Master admin default password fallback
  if (user.isMaster && (trimmedPass === 'Costafoods@2026' || trimmedPass === 'admin')) return true;

  return false;
};

function mergeUsers(
  local: User[], 
  remote: User[], 
  deletedIds: string[] = [],
  priority: 'local' | 'remote' = 'remote'
): User[] {
  const safeLocal = local || [];
  const safeRemote = remote || [];
  
  const map = new Map<string, User>();
  const deletedSet = deletedIds.length > 0 ? new Set(deletedIds) : null;

  // Process remote users first
  for (let i = 0; i < safeRemote.length; i++) {
    const u = safeRemote[i];
    if (!u || !u.id || (deletedSet && deletedSet.has(u.id))) continue;
    map.set(u.id, {
      ...u,
      username: u.username ? u.username.trim() : '',
      name: u.name ? u.name.trim() : ''
    });
  }

  // Process local users
  for (let i = 0; i < safeLocal.length; i++) {
    const rawU = safeLocal[i];
    if (!rawU || !rawU.id || (deletedSet && deletedSet.has(rawU.id))) continue;
    const u: User = {
      ...rawU,
      username: rawU.username ? rawU.username.trim() : '',
      name: rawU.name ? rawU.name.trim() : ''
    };

    const existing = map.get(u.id);
    if (!existing) {
      map.set(u.id, u);
    } else {
      const localTime = Number(u.updatedAt) || 0;
      const remoteTime = Number(existing.updatedAt) || 0;

      const mergedApproval = existing.isApproved || u.isApproved;

      // Calculate latest lastSync timestamp between local and remote
      const uSyncTime = u.lastSync ? new Date(u.lastSync).getTime() : 0;
      const exSyncTime = existing.lastSync ? new Date(existing.lastSync).getTime() : 0;
      const latestLastSync = (uSyncTime >= exSyncTime && u.lastSync) ? u.lastSync : existing.lastSync;

      const isLocalPrimary = (localTime > remoteTime || (priority === 'local' && localTime >= remoteTime));
      const primary = isLocalPrimary ? u : existing;
      const secondary = isLocalPrimary ? existing : u;

      // Password reset request logic:
      // Preserve passwordResetRequested = true if either requested it,
      // UNLESS the primary record was updated with a new password or temporary password (needsPasswordReset: true and passwordResetRequested: false)
      let mergedPasswordResetRequested = (existing.passwordResetRequested || u.passwordResetRequested) || false;
      if (primary.passwordResetRequested === false && (primary.needsPasswordReset || (secondary.password !== primary.password && primary.password))) {
        mergedPasswordResetRequested = false;
      }

      // Unlock request logic:
      let mergedUnlockRequested = (existing.accessUnlockRequested || u.accessUnlockRequested) || false;
      if (primary.accessUnlockRequested === false && !primary.blockedDueToInactivity) {
        mergedUnlockRequested = false;
      }

      const mergedNeedsPasswordReset = (primary.needsPasswordReset !== undefined)
        ? primary.needsPasswordReset
        : (existing.needsPasswordReset || u.needsPasswordReset || false);

      const mergedUser: User = {
        ...primary,
        isApproved: mergedApproval,
        passwordResetRequested: mergedPasswordResetRequested,
        accessUnlockRequested: mergedUnlockRequested,
        needsPasswordReset: mergedNeedsPasswordReset,
        lastSync: latestLastSync,
        updatedAt: Math.max(localTime, remoteTime) || Date.now(),
        canEdit: primary.isMaster ? true : primary.canEdit,
        allowedTabs: primary.isMaster ? undefined : primary.allowedTabs,
      };

      map.set(u.id, mergedUser);
    }
  }

  return Array.from(map.values());
}

export const repairArray = (arr: any[]): any[] => {
  if (!Array.isArray(arr)) return arr || [];
  return arr.map(item => {
    if (item && typeof item === 'object' && !item.id && (Object.keys(item).includes('0') || item.updatedAt)) {
      // Check if it looks like a spread string object
      const keys = Object.keys(item).filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
      if (keys.length > 0) {
        return keys.map(k => (item as any)[k]).join('');
      }
    }
    // Deep repair for users if needed
    if (item && typeof item === 'object' && item.id && item.username && item.allowedTabs) {
      return {
        ...item,
        allowedTabs: repairArray(item.allowedTabs)
      };
    }
    return item;
  });
};

export const areStatesEqual = (a: AppState, b: AppState): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  
  if (a.farmTargetCapacity !== b.farmTargetCapacity) return false;
  if (JSON.stringify(a.supabaseConfig) !== JSON.stringify(b.supabaseConfig)) return false;
  if (JSON.stringify(a.notificationSettings) !== JSON.stringify(b.notificationSettings)) return false;

  const arrayKeys: Array<keyof AppState> = [
    'users', 'lines', 'batches', 'cages', 'feedTypes', 'feedingLogs',
    'feedStockLogs', 'mortalityLogs', 'biometryLogs', 'slaughterLogs',
    'slaughterExpenses', 'slaughterEmployees', 'slaughterHRIndicators',
    'slaughterHREntries', 'slaughterHRVacancies', 'slaughterSupplyItems',
    'slaughterSuppliers', 'slaughterSupplyRequests', 'slaughterPurchaseOrders',
    'slaughterSupplyInvoices', 'harvestLogs', 'harvestSchedules',
    'batchExpenses', 'batchRevenues', 'coldStorageLogs', 'utilityLogs',
    'coldChambers', 'protocols', 'standardCurves', 'portfolios',
    'capexProjects', 'capexInvoices', 'capexPurchaseOrders', 'feedingTables', 'costCenters',
    'pcmEquipments', 'pcmStoppageReasons', 'pcmProductionStoppages',
    'pcmPlannedImprovements', 'deletedIds',
    'slaughterSupplyCategories', 'slaughterExpenseCategories', 'slaughterHREntryTypes', 'slaughterHRDepartments', 'slaughterHRRoles'
  ];

  for (let idx = 0; idx < arrayKeys.length; idx++) {
    const key = arrayKeys[idx];
    const arrA = a[key] as any[];
    const arrB = b[key] as any[];

    if (!arrA && !arrB) continue;
    if (!arrA || !arrB) return false;
    if (arrA.length !== arrB.length) return false;

    for (let i = 0; i < arrA.length; i++) {
      const itemA = arrA[i];
      const itemB = arrB[i];

      if (typeof itemA !== typeof itemB) return false;
      if (itemA === itemB) continue;

      if (itemA && itemB && typeof itemA === 'object') {
        if (itemA.id !== itemB.id) return false;
        const upA = Number(itemA.updatedAt || 0);
        const upB = Number(itemB.updatedAt || 0);
        if (upA !== upB) return false;
        
        // Fast checks on key primitive fields before full stringify
        if (itemA.amount !== itemB.amount) return false;
        if (itemA.count !== itemB.count) return false;
        if (itemA.batchId !== itemB.batchId) return false;
        if (itemA.cageId !== itemB.cageId) return false;
        if (itemA.date !== itemB.date) return false;
        if (itemA.timestamp !== itemB.timestamp) return false;
        if (itemA.averageWeight !== itemB.averageWeight) return false;

        if (JSON.stringify(itemA) !== JSON.stringify(itemB)) return false;
      } else {
        if (itemA !== itemB) return false;
      }
    }
  }

  return true;
};

export const ensureStateIntegrity = (state: any, mergeWith?: AppState, priority: 'local' | 'remote' = 'local'): AppState => {
  const rawDeletedIds = [
    ...(state?.deletedIds || []),
    ...(mergeWith?.deletedIds || [])
  ];
  
  const repairedDeletedIdsArr = repairArray(rawDeletedIds);
  const combinedDeletedIdsArray = Array.from(new Set(
    repairedDeletedIdsArr.filter(id => typeof id === 'string' && id.trim() !== '')
  ));
  const trimmedDeletedIds = combinedDeletedIdsArray.length > 10000 ? combinedDeletedIdsArray.slice(-10000) : combinedDeletedIdsArray;

  const deletedSet = new Set(trimmedDeletedIds);

  const base: AppState = {
    ...initialState,
    ...state,
    deletedIds: trimmedDeletedIds,
    slaughterExpenseCategories: repairArray(state?.slaughterExpenseCategories || initialState.slaughterExpenseCategories),
    slaughterHREntryTypes: repairArray(state?.slaughterHREntryTypes || initialState.slaughterHREntryTypes),
    slaughterHRDepartments: repairArray(state?.slaughterHRDepartments || initialState.slaughterHRDepartments),
    slaughterHRRoles: repairArray(state?.slaughterHRRoles || initialState.slaughterHRRoles),
    slaughterSupplyCategories: repairArray(state?.slaughterSupplyCategories || initialState.slaughterSupplyCategories),
    users: repairArray(state?.users || initialState.users)
  };
  
  const filterByTombstone = (arr: any[], preserveOnBatchDeletion: boolean = false) => {
    if (!arr) return [];
    if (deletedSet.size === 0) return arr;
    return arr.filter(i => {
      if (!i || !i.id) return false;
      if (deletedSet.has(i.id)) return false;
      if (!preserveOnBatchDeletion) {
        if (i.name && deletedSet.has(i.name)) return false;
        if (i.batchId && deletedSet.has(i.batchId)) return false;
      }
      return true;
    });
  };

  const result: AppState = {
    ...base,
    users: filterByTombstone(base.users || initialState.users),
    lines: filterByTombstone(base.lines || []),
    batches: filterByTombstone(base.batches || []),
    cages: filterByTombstone(base.cages || []),
    feedTypes: filterByTombstone(base.feedTypes || []),
    feedingLogs: filterByTombstone(base.feedingLogs || []),
    feedStockLogs: filterByTombstone(base.feedStockLogs || []),
    mortalityLogs: filterByTombstone(base.mortalityLogs || []),
    biometryLogs: filterByTombstone(base.biometryLogs || []),
    slaughterLogs: filterByTombstone(base.slaughterLogs || [], true),
    slaughterExpenses: filterByTombstone(base.slaughterExpenses || [], true),
    slaughterEmployees: filterByTombstone(base.slaughterEmployees || [], true),
    slaughterHRIndicators: filterByTombstone(base.slaughterHRIndicators || [], true),
    slaughterHREntries: filterByTombstone(base.slaughterHREntries || [], true),
    slaughterHRVacancies: filterByTombstone(base.slaughterHRVacancies || [], true),
    slaughterExpenseCategories: base.slaughterExpenseCategories || initialState.slaughterExpenseCategories,
    slaughterHREntryTypes: base.slaughterHREntryTypes || initialState.slaughterHREntryTypes,
    slaughterHRDepartments: base.slaughterHRDepartments || initialState.slaughterHRDepartments,
    slaughterHRRoles: base.slaughterHRRoles || initialState.slaughterHRRoles,
    slaughterSupplyItems: filterByTombstone(base.slaughterSupplyItems || [], true),
    slaughterSuppliers: filterByTombstone(base.slaughterSuppliers || [], true),
    slaughterSupplyRequests: filterByTombstone(base.slaughterSupplyRequests || [], true),
    slaughterPurchaseOrders: filterByTombstone(base.slaughterPurchaseOrders || [], true),
    slaughterSupplyInvoices: filterByTombstone(base.slaughterSupplyInvoices || [], true),
    slaughterSupplyCategories: base.slaughterSupplyCategories || initialState.slaughterSupplyCategories,
    slaughterSupplyCategoriesUpdated: base.slaughterSupplyCategoriesUpdated || 0,
    protocols: filterByTombstone(base.protocols || []),
    standardCurves: filterByTombstone(base.standardCurves || []),
    portfolios: filterByTombstone(base.portfolios || []),
    capexProjects: filterByTombstone(base.capexProjects || []),
    capexInvoices: filterByTombstone(base.capexInvoices || []),
    capexPurchaseOrders: filterByTombstone(base.capexPurchaseOrders || []),
    harvestLogs: filterByTombstone(base.harvestLogs || []),
    harvestSchedules: filterByTombstone(base.harvestSchedules || []),
    batchExpenses: filterByTombstone(base.batchExpenses || []),
    batchRevenues: filterByTombstone(base.batchRevenues || []),
    coldStorageLogs: filterByTombstone(base.coldStorageLogs || [], true),
    utilityLogs: filterByTombstone(base.utilityLogs || [], true),
    coldChambers: filterByTombstone(base.coldChambers || [], true),
    pcpSuppliers: filterByTombstone(base.pcpSuppliers || [], true),
    pcpSlaughterSchedules: filterByTombstone(base.pcpSlaughterSchedules || [], true),
    feedingTables: filterByTombstone(base.feedingTables || []),
    costCenters: filterByTombstone(base.costCenters || []),
    pcmEquipments: filterByTombstone(base.pcmEquipments || [], true),
    pcmStoppageReasons: filterByTombstone(base.pcmStoppageReasons || [], true),
    pcmProductionStoppages: filterByTombstone(base.pcmProductionStoppages || [], true),
    pcmPlannedImprovements: filterByTombstone(base.pcmPlannedImprovements || [], true),
    farmTargetCapacity: base.farmTargetCapacity || 0,
  };

  const finalResult = mergeWith ? {
    ...result,
    users: mergeUsers(result.users, mergeWith.users, combinedDeletedIdsArray, priority),
    slaughterLogs: mergeArraysById(result.slaughterLogs, mergeWith.slaughterLogs, combinedDeletedIdsArray, priority, true),
    feedTypes: mergeArraysById(result.feedTypes, mergeWith.feedTypes, combinedDeletedIdsArray, priority),
    lines: mergeArraysById(result.lines, mergeWith.lines, combinedDeletedIdsArray, priority),
    batches: mergeArraysById(result.batches, mergeWith.batches, combinedDeletedIdsArray, priority),
    cages: mergeArraysById(result.cages, mergeWith.cages, combinedDeletedIdsArray, priority),
    feedingLogs: mergeArraysById(result.feedingLogs, mergeWith.feedingLogs, combinedDeletedIdsArray, priority),
    feedStockLogs: mergeArraysById(result.feedStockLogs || [], mergeWith.feedStockLogs || [], combinedDeletedIdsArray, priority),
    mortalityLogs: mergeArraysById(result.mortalityLogs, mergeWith.mortalityLogs, combinedDeletedIdsArray, priority),
    biometryLogs: mergeArraysById(result.biometryLogs, mergeWith.biometryLogs, combinedDeletedIdsArray, priority),
    slaughterExpenses: mergeArraysById(result.slaughterExpenses || [], mergeWith.slaughterExpenses || [], combinedDeletedIdsArray, priority, true),
    slaughterEmployees: mergeArraysById(result.slaughterEmployees || [], mergeWith.slaughterEmployees || [], combinedDeletedIdsArray, priority, true),
    slaughterHRIndicators: mergeArraysById(result.slaughterHRIndicators || [], mergeWith.slaughterHRIndicators || [], combinedDeletedIdsArray, priority, true),
    slaughterHREntries: mergeArraysById(result.slaughterHREntries || [], mergeWith.slaughterHREntries || [], combinedDeletedIdsArray, priority, true),
    slaughterHRVacancies: mergeArraysById(result.slaughterHRVacancies || [], mergeWith.slaughterHRVacancies || [], combinedDeletedIdsArray, priority, true),
    slaughterSupplyItems: mergeArraysById(result.slaughterSupplyItems || [], mergeWith.slaughterSupplyItems || [], combinedDeletedIdsArray, priority, true),
    slaughterSuppliers: mergeArraysById(result.slaughterSuppliers || [], mergeWith.slaughterSuppliers || [], combinedDeletedIdsArray, priority, true),
    slaughterSupplyRequests: mergeArraysById(result.slaughterSupplyRequests || [], mergeWith.slaughterSupplyRequests || [], combinedDeletedIdsArray, priority, true),
    slaughterPurchaseOrders: mergeArraysById(result.slaughterPurchaseOrders || [], mergeWith.slaughterPurchaseOrders || [], combinedDeletedIdsArray, priority, true),
    slaughterSupplyInvoices: mergeArraysById(result.slaughterSupplyInvoices || [], mergeWith.slaughterSupplyInvoices || [], combinedDeletedIdsArray, priority, true),
    slaughterSupplyCategories: Array.from(new Set([...(result.slaughterSupplyCategories || []), ...(mergeWith.slaughterSupplyCategories || [])])),
    slaughterSupplyCategoriesUpdated: Math.max(result.slaughterSupplyCategoriesUpdated || 0, mergeWith.slaughterSupplyCategoriesUpdated || 0),
    slaughterExpenseCategories: Array.from(new Set([...(result.slaughterExpenseCategories || []), ...(mergeWith.slaughterExpenseCategories || [])])),
    slaughterExpenseCategoriesUpdated: Math.max(result.slaughterExpenseCategoriesUpdated || 0, mergeWith.slaughterExpenseCategoriesUpdated || 0),
    slaughterHREntryTypes: Array.from(new Set([...(result.slaughterHREntryTypes || []), ...(mergeWith.slaughterHREntryTypes || [])])),
    slaughterHREntryTypesUpdated: Math.max(result.slaughterHREntryTypesUpdated || 0, mergeWith.slaughterHREntryTypesUpdated || 0),
    slaughterHRDepartments: Array.from(new Set([...(result.slaughterHRDepartments || []), ...(mergeWith.slaughterHRDepartments || [])])),
    slaughterHRDepartmentsUpdated: Math.max(result.slaughterHRDepartmentsUpdated || 0, mergeWith.slaughterHRDepartmentsUpdated || 0),
    slaughterHRRoles: Array.from(new Set([...(result.slaughterHRRoles || []), ...(mergeWith.slaughterHRRoles || [])])),
    slaughterHRRolesUpdated: Math.max(result.slaughterHRRolesUpdated || 0, mergeWith.slaughterHRRolesUpdated || 0),
    protocols: mergeArraysById(result.protocols, mergeWith.protocols, combinedDeletedIdsArray, priority),
    standardCurves: mergeArraysById(result.standardCurves || [], mergeWith.standardCurves || [], combinedDeletedIdsArray, priority),
    portfolios: mergeArraysById(result.portfolios || [], mergeWith.portfolios || [], combinedDeletedIdsArray, priority),
    capexProjects: mergeArraysById(result.capexProjects || [], mergeWith.capexProjects || [], combinedDeletedIdsArray, priority),
    capexInvoices: mergeArraysById(result.capexInvoices || [], mergeWith.capexInvoices || [], combinedDeletedIdsArray, priority),
    capexPurchaseOrders: mergeArraysById(result.capexPurchaseOrders || [], mergeWith.capexPurchaseOrders || [], combinedDeletedIdsArray, priority),
    harvestLogs: mergeArraysById(result.harvestLogs || [], mergeWith.harvestLogs || [], combinedDeletedIdsArray, priority),
    harvestSchedules: mergeArraysById(result.harvestSchedules || [], mergeWith.harvestSchedules || [], combinedDeletedIdsArray, priority),
    batchExpenses: mergeArraysById(result.batchExpenses || [], mergeWith.batchExpenses || [], combinedDeletedIdsArray, priority),
    batchRevenues: mergeArraysById(result.batchRevenues || [], mergeWith.batchRevenues || [], combinedDeletedIdsArray, priority),
    coldStorageLogs: mergeArraysById(result.coldStorageLogs || [], mergeWith.coldStorageLogs || [], combinedDeletedIdsArray, priority, true),
    utilityLogs: mergeArraysById(result.utilityLogs || [], mergeWith.utilityLogs || [], combinedDeletedIdsArray, priority, true),
    coldChambers: mergeArraysById(result.coldChambers || [], mergeWith.coldChambers || [], combinedDeletedIdsArray, priority, true),
    pcpSuppliers: mergeArraysById(result.pcpSuppliers || [], mergeWith.pcpSuppliers || [], combinedDeletedIdsArray, priority, true),
    pcpSlaughterSchedules: mergeArraysById(result.pcpSlaughterSchedules || [], mergeWith.pcpSlaughterSchedules || [], combinedDeletedIdsArray, priority, true),
    feedingTables: mergeArraysById(result.feedingTables || [], mergeWith.feedingTables || [], combinedDeletedIdsArray, priority),
    costCenters: mergeArraysById(result.costCenters || [], mergeWith.costCenters || [], combinedDeletedIdsArray, priority),
    pcmEquipments: mergeArraysById(result.pcmEquipments || [], mergeWith.pcmEquipments || [], combinedDeletedIdsArray, priority, true),
    pcmStoppageReasons: mergeArraysById(result.pcmStoppageReasons || [], mergeWith.pcmStoppageReasons || [], combinedDeletedIdsArray, priority, true),
    pcmProductionStoppages: mergeArraysById(result.pcmProductionStoppages || [], mergeWith.pcmProductionStoppages || [], combinedDeletedIdsArray, priority, true),
    pcmPlannedImprovements: mergeArraysById(result.pcmPlannedImprovements || [], mergeWith.pcmPlannedImprovements || [], combinedDeletedIdsArray, priority, true),
    farmTargetCapacity: priority === 'remote' 
      ? (mergeWith.farmTargetCapacity !== undefined ? mergeWith.farmTargetCapacity : result.farmTargetCapacity)
      : (result.farmTargetCapacity !== undefined ? result.farmTargetCapacity : mergeWith.farmTargetCapacity),
  } : result;

  const batches = finalResult.batches || [];
  const harvestLogs = finalResult.harvestLogs || [];
  const mortalityLogs = finalResult.mortalityLogs || [];

  const rawCages = finalResult.cages || [];

  // Step 1: Resolve batchId for each cage first
  const cagesWithResolvedBatch = rawCages.map(cage => {
    let batchId = cage.batchId;
    let status = cage.status;
    let maintenanceStartDate = cage.maintenanceStartDate;

    if (batchId) {
      const existingBatch = batches.find(b => b.id === batchId || isBatchMatch(batchId, b));
      if (!existingBatch || existingBatch.isClosed || deletedSet.has(existingBatch.id)) {
        batchId = undefined;
      } else {
        // Se a gaiola já possui registro de despesca finalizado para este lote e não foi repovoada posteriormente
        const batchHarvest = harvestLogs.find(h => h.cageId === cage.id && (h.batchId === existingBatch.id || isBatchMatch(h.batchId, existingBatch)));
        if (batchHarvest) {
          const harvestDate = batchHarvest.date ? batchHarvest.date.split('T')[0] : '';
          const cageSettlement = cage.settlementDate ? cage.settlementDate.split('T')[0] : '';
          if (!cageSettlement || (harvestDate && cageSettlement <= harvestDate)) {
            batchId = undefined;
            if (!status || status === 'Ocupada') {
              status = 'Limpeza';
            }
            if (!maintenanceStartDate) {
              maintenanceStartDate = harvestDate || new Date().toISOString().split('T')[0];
            }
          }
        }
      }
    }

    // Unlink cage only if it is explicitly in scrap/maintenance/evaluation without fish count
    if (cage.status && ['Sucata', 'Manutenção', 'Avaliação'].includes(cage.status) && (!batchId || !cage.initialFishCount)) {
      batchId = undefined;
    }

    return { ...cage, batchId, status, maintenanceStartDate };
  });

  // Step 2: Build batch map using resolved batch IDs
  const cagesByBatchMap = new Map<string, typeof rawCages>();
  cagesWithResolvedBatch.forEach(cage => {
    if (cage.batchId) {
      const list = cagesByBatchMap.get(cage.batchId) || [];
      list.push(cage);
      cagesByBatchMap.set(cage.batchId, list);
    }
  });

  // Step 3: Normalize cages
  const normalizedCages = cagesWithResolvedBatch.map(cage => {
    let { batchId, initialFishCount, status, harvestDate, settlementDate, maintenanceStartDate, maintenanceEndDate } = cage;

    if (status === 'Em Uso') {
      status = 'Ocupada';
    }

    if (!batchId) {
      initialFishCount = undefined;
      settlementDate = undefined;
      harvestDate = undefined;

      if (!status || status === 'Ocupada') {
        status = 'Limpeza';
      }
    } else {
      status = 'Ocupada';
      const batch = batches.find(b => b.id === batchId || isBatchMatch(batchId, b));
      if (batch && !settlementDate) {
        settlementDate = batch.settlementDate;
      }

      if (!initialFishCount || initialFishCount <= 0) {
        if (batch && batch.initialQuantity > 0) {
          const batchCages = cagesByBatchMap.get(batch.id) || [];
          const knownFishSum = batchCages
            .filter(c => c.id !== cage.id && c.initialFishCount && c.initialFishCount > 0)
            .reduce((a, c) => a + (c.initialFishCount || 0), 0);

          const harvestSum = harvestLogs
            .filter(h => h.batchId === batch.id || isBatchMatch(h.batchId, batch))
            .reduce((a, h) => a + (h.initialFishCount || h.fishCount || 0), 0);

          const nurseryMort = mortalityLogs
            .filter(m => (m.batchId === batch.id || isBatchMatch(m.batchId, batch)) && !m.cageId)
            .reduce((a, m) => a + m.count, 0);

          const uncountedCages = batchCages.filter(c => !c.initialFishCount || c.initialFishCount <= 0);
          const remainingFish = Math.max(0, batch.initialQuantity - knownFishSum - harvestSum - nurseryMort);

          if (uncountedCages.length > 0 && remainingFish > 0) {
            let calculated = Math.round(remainingFish / uncountedCages.length);
            if (cage.stockingCapacity && cage.stockingCapacity > 0 && calculated > cage.stockingCapacity) {
              calculated = cage.stockingCapacity;
            }
            initialFishCount = calculated > 0 ? calculated : (cage.stockingCapacity || 10000);
          }
        } else {
          initialFishCount = cage.stockingCapacity || 10000;
        }
      }
    }

    // Set maintenance dates cleanly
    if (['Limpeza', 'Manutenção', 'Avaliação'].includes(status)) {
      if (!maintenanceStartDate) {
        const cageHarvests = harvestLogs.filter(h => h.cageId === cage.id);
        if (cageHarvests.length > 0) {
          const latestHarvest = cageHarvests.reduce((latest, h) => (h.date > latest.date ? h : latest), cageHarvests[0]);
          if (latestHarvest && latestHarvest.date) {
            maintenanceStartDate = latestHarvest.date;
          }
        } else if (cage.harvestDate) {
          maintenanceStartDate = cage.harvestDate;
        }
      }
    } else {
      maintenanceStartDate = undefined;
      maintenanceEndDate = undefined;
    }

    let updatedAt = typeof cage.updatedAt === 'number'
      ? cage.updatedAt
      : (cage.updatedAt ? new Date(cage.updatedAt).getTime() : 1);

    const oldCage = (state?.cages || []).find((c: any) => c.id === cage.id);
    const hasCageChanged = !oldCage || 
      batchId !== oldCage.batchId || 
      status !== oldCage.status || 
      initialFishCount !== oldCage.initialFishCount || 
      settlementDate !== oldCage.settlementDate ||
      harvestDate !== oldCage.harvestDate ||
      maintenanceStartDate !== oldCage.maintenanceStartDate ||
      maintenanceEndDate !== oldCage.maintenanceEndDate ||
      cage.name !== oldCage.name ||
      cage.model !== oldCage.model ||
      cage.stockingDensity !== oldCage.stockingDensity ||
      cage.stockingCapacity !== oldCage.stockingCapacity ||
      JSON.stringify(cage.dimensions) !== JSON.stringify(oldCage.dimensions);

    if (hasCageChanged) {
      updatedAt = Math.max(updatedAt, Date.now());
    }

    return {
      ...cage,
      batchId,
      initialFishCount,
      settlementDate,
      status,
      harvestDate,
      maintenanceStartDate,
      maintenanceEndDate,
      updatedAt
    };
  });

  // Reconcile batchId on feeding, mortality, and biometry logs based on log date and batch timeline
  const allBatches = finalResult.batches || [];
  const batchMap = new Map(allBatches.map(b => [b.id, b]));
  
  const batchEndDates = new Map<string, string>();
  (finalResult.harvestLogs || []).forEach(h => {
    if (h.batchId && h.date) {
      const current = batchEndDates.get(h.batchId);
      if (!current || h.date > current) {
        batchEndDates.set(h.batchId, h.date);
      }
    }
  });

  const isValidForBatch = (batchId: string, cageId?: string, logDateStr?: string): boolean => {
    const b = batchMap.get(batchId);
    if (!b || deletedSet.has(b.id)) return false;

    if (logDateStr) {
      const cleanDate = logDateStr.split('T')[0];
      if (b.settlementDate && cleanDate < b.settlementDate) return false;
      if (b.isClosed && b.closedAt && cleanDate > b.closedAt.split('T')[0]) return false;
      if (b.harvestDate && cleanDate > b.harvestDate) return false;

      if (cageId) {
        const cageHarvests = (finalResult.harvestLogs || []).filter(h => h.cageId === cageId && h.batchId === b.id);
        if (cageHarvests.length > 0) {
          const maxHarvestDate = cageHarvests.reduce((max, h) => (h.date && h.date > max) ? h.date : max, '');
          if (maxHarvestDate && cleanDate > maxHarvestDate) return false;
        }
      }
    }
    return true;
  };

  const getReconciledBatchId = (cageId: string | undefined, logDateStr: string | undefined, currentBatchId?: string): string => {
    if (currentBatchId) {
      if (batchMap.has(currentBatchId) && !deletedSet.has(currentBatchId)) {
        return currentBatchId;
      }
      const matched = allBatches.find(b => {
        const tid = currentBatchId.trim().toLowerCase();
        if (b.id?.toLowerCase() === tid) return true;
        const bn = (b.name || '').trim().toLowerCase();
        if (bn === tid) return true;
        const tidNorm = tid.replace(/[^a-z0-9]/g, '');
        const bnNorm = bn.replace(/[^a-z0-9]/g, '');
        if (tidNorm.length > 0 && tidNorm === bnNorm) return true;
        const tidNoLote = tid.replace(/^lote\s*/i, '').trim();
        const bnNoLote = bn.replace(/^lote\s*/i, '').trim();
        if (tidNoLote.length > 0 && tidNoLote === bnNoLote) return true;
        const tidNum = tidNoLote.replace(/^0+/, '');
        const bnNum = bnNoLote.replace(/^0+/, '');
        return tidNum.length > 0 && tidNum === bnNum;
      });
      if (matched && !deletedSet.has(matched.id)) {
        return matched.id;
      }
    }

    if (!logDateStr) {
      return (currentBatchId && isValidForBatch(currentBatchId, cageId)) ? currentBatchId : '';
    }

    const logDate = logDateStr.split('T')[0];

    // Search for a batch that housed cageId on logDate and is valid for logDate
    for (const b of allBatches) {
      if (!isValidForBatch(b.id, cageId, logDateStr)) continue;

      if (cageId) {
        const isCageInBatch = (b.cageIds || []).includes(cageId) || 
          normalizedCages.some(c => c.id === cageId && c.batchId === b.id) ||
          (finalResult.harvestLogs || []).some(h => h.cageId === cageId && h.batchId === b.id);

        if (isCageInBatch) {
          return b.id;
        }
      }
    }

    return '';
  };

  if (finalResult.feedingLogs && finalResult.feedingLogs.length > 0) {
    finalResult.feedingLogs = finalResult.feedingLogs
      .filter(f => !deletedSet.has(f.id) && (!f.batchId || !deletedSet.has(f.batchId)))
      .map(f => {
        const fDate = (f.timestamp || '').split('T')[0];
        const correctBatchId = getReconciledBatchId(f.cageId, fDate, f.batchId);
        const targetBatchId = (correctBatchId && batchMap.has(correctBatchId) && !deletedSet.has(correctBatchId)) 
          ? correctBatchId 
          : (f.batchId && batchMap.has(f.batchId) && !deletedSet.has(f.batchId) ? f.batchId : (f.batchId || ''));
        
        if (targetBatchId && targetBatchId !== f.batchId) {
          return { ...f, batchId: targetBatchId, updatedAt: f.updatedAt || Date.now() };
        }
        return f;
      });
  }

  if (finalResult.mortalityLogs && finalResult.mortalityLogs.length > 0) {
    finalResult.mortalityLogs = finalResult.mortalityLogs
      .filter(m => !deletedSet.has(m.id) && (!m.batchId || !deletedSet.has(m.batchId)))
      .map(m => {
        const mDate = m.date || '';
        const correctBatchId = getReconciledBatchId(m.cageId, mDate, m.batchId);
        const targetBatchId = (correctBatchId && batchMap.has(correctBatchId) && !deletedSet.has(correctBatchId))
          ? correctBatchId
          : (m.batchId && batchMap.has(m.batchId) && !deletedSet.has(m.batchId) ? m.batchId : (m.batchId || ''));

        if (targetBatchId && targetBatchId !== m.batchId) {
          return { ...m, batchId: targetBatchId, updatedAt: m.updatedAt || Date.now() };
        }
        return m;
      });
  }

  if (finalResult.biometryLogs && finalResult.biometryLogs.length > 0) {
    finalResult.biometryLogs = finalResult.biometryLogs
      .filter(b => !deletedSet.has(b.id) && (!b.batchId || !deletedSet.has(b.batchId)))
      .map(b => {
        const bDate = b.date || '';
        const correctBatchId = getReconciledBatchId(b.cageId, bDate, b.batchId);
        const targetBatchId = (correctBatchId && batchMap.has(correctBatchId) && !deletedSet.has(correctBatchId))
          ? correctBatchId
          : (b.batchId && batchMap.has(b.batchId) && !deletedSet.has(b.batchId) ? b.batchId : (b.batchId || ''));

        if (targetBatchId && targetBatchId !== b.batchId) {
          return { ...b, batchId: targetBatchId, updatedAt: b.updatedAt || Date.now() };
        }
        return b;
      });
  }

  if (finalResult.harvestLogs && finalResult.harvestLogs.length > 0) {
    finalResult.harvestLogs = finalResult.harvestLogs.filter(h => !deletedSet.has(h.id) && (!h.batchId || !deletedSet.has(h.batchId)));
  }

  if (finalResult.harvestSchedules && finalResult.harvestSchedules.length > 0) {
    finalResult.harvestSchedules = finalResult.harvestSchedules.filter(hs => {
      if (!hs || !hs.id || deletedSet.has(hs.id)) return false;
      if (hs.batchId) {
        if (deletedSet.has(hs.batchId)) return false;
        const b = batchMap.get(hs.batchId);
        if (b && (b.isClosed || b.name === '03/2026 - L3' || b.name === '01/2026 - L2')) return false;
      }
      return true;
    });
  }

  if (finalResult.batchExpenses && finalResult.batchExpenses.length > 0) {
    finalResult.batchExpenses = finalResult.batchExpenses.filter(e => !deletedSet.has(e.id) && (!e.batchId || !deletedSet.has(e.batchId)));
  }

  if (finalResult.batchRevenues && finalResult.batchRevenues.length > 0) {
    finalResult.batchRevenues = finalResult.batchRevenues.filter(r => !deletedSet.has(r.id) && (!r.batchId || !deletedSet.has(r.batchId)));
  }

  if (finalResult.slaughterLogs && finalResult.slaughterLogs.length > 0) {
    const validSlaughterLogs: any[] = [];
    finalResult.slaughterLogs.forEach((s: any) => {
      // Keep slaughter logs permanently for slaughterhouse tracking/history
      // Only purge if the specific slaughter log id itself was deleted directly
      if (s && s.id && !deletedSet.has(s.id)) {
        const batch = s.batchId ? batchMap.get(s.batchId) : undefined;
        let slaughterBatchName = s.slaughterBatch;
        if (!slaughterBatchName || slaughterBatchName === 'undefined' || slaughterBatchName === 'null' || slaughterBatchName === 'Lote') {
          slaughterBatchName = (batch ? batch.name : (s.batchId && s.batchId !== 'undefined' ? s.batchId : '')) || s.slaughterBatch || 'Lote';
        }
        validSlaughterLogs.push({
          ...s,
          batchId: (s.batchId === 'undefined' || s.batchId === 'null') ? '' : (s.batchId || ''),
          slaughterBatch: slaughterBatchName
        });
      }
    });
    finalResult.slaughterLogs = validSlaughterLogs;
  }

  // Ensure default feed types exist on initial state, but do not overwrite existing feed stock
  const targetFeedDefinitions = [
    { id: 'feed-4-6mm', name: 'Ração 4 a 6mm', totalStock: 16914500, maxCapacity: 25000, minStockPercentage: 20 },
    { id: 'feed-3-4mm', name: 'Ração 3 a 4mm', totalStock: 144300, maxCapacity: 10000, minStockPercentage: 20 },
    { id: 'feed-2-3mm', name: 'Ração 2 a 3mm', totalStock: 100, maxCapacity: 5000, minStockPercentage: 20 },
  ];

  if (!finalResult.feedTypes || finalResult.feedTypes.length === 0) {
    finalResult.feedTypes = targetFeedDefinitions.map(f => ({ ...f, updatedAt: Date.now() }));
  } else {
    // Keep existing feedTypes and totalStock intact. Only add missing feed types if missing.
    const existingNames = finalResult.feedTypes.map(f => (f.name || '').toLowerCase());
    targetFeedDefinitions.forEach(def => {
      const exists = existingNames.some(n => 
        (def.id === 'feed-4-6mm' && n.includes('4') && n.includes('6')) ||
        (def.id === 'feed-3-4mm' && n.includes('3') && n.includes('4')) ||
        (def.id === 'feed-2-3mm' && n.includes('2') && n.includes('3'))
      );
      if (!exists && !finalResult.feedTypes.some(f => f.id === def.id)) {
        finalResult.feedTypes.push({ ...def, updatedAt: Date.now() });
      }
    });
  }

  // Ensure stock logs exist, but DO NOT overwrite existing logs or user edits
  if (!finalResult.feedStockLogs || finalResult.feedStockLogs.length === 0) {
    const feed46 = finalResult.feedTypes.find(f => {
      const n = (f.name || '').toLowerCase();
      return (n.includes('4') && n.includes('6')) || f.id === 'feed-4-6mm';
    }) || finalResult.feedTypes[0];

    const feed46Id = feed46 ? feed46.id : 'feed-01';

    finalResult.feedStockLogs = [
      {
        id: 'log-stock-2026-07-25-01',
        feedTypeId: feed46Id,
        amount: 12930000, // 12.930 kg (12.930.000 g)
        type: 'Entrada',
        timestamp: '2026-07-25T10:00:00.000Z',
        userId: 'master-001',
        updatedAt: Date.now()
      }
    ];
  }

  const stateWithNormalizedCages = {
    ...finalResult,
    cages: normalizedCages
  };

  if (state && areStatesEqual(state, stateWithNormalizedCages)) {
    return state;
  }
  return stateWithNormalizedCages;
};

export const getSupabaseConfig = () => {
  // 1. Tenta pegar de Variáveis de Ambiente (Vite/GitHub Secrets)
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  
  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  // 2. Tenta pegar dos parâmetros da URL (Convite)
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('s_url');
  const keyParam = params.get('s_key');
  const expParam = params.get('s_exp');

  if (urlParam && keyParam) {
    if (expParam) {
      const expTime = Number(expParam);
      if (!isNaN(expTime) && Date.now() > expTime) {
        console.warn('Link de convite expirado (24h de validade).');
        const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
        return saved ? JSON.parse(saved) : null;
      }
    }
    const config = { url: decodeURIComponent(urlParam), key: decodeURIComponent(keyParam) };
    try {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Falha ao salvar config Supabase (Quota)');
    }
    return config;
  }

  // 3. Tenta pegar do armazenamento local
  const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
  return saved ? JSON.parse(saved) : null;
};

export interface ApplyLinkResult {
  success: boolean;
  message: string;
}

export const generateInviteLink = (config?: { url: string; key: string }): string => {
  const cfg = config || getSupabaseConfig();
  const baseUrl = window.location.origin + window.location.pathname;
  if (!cfg?.url || !cfg?.key) {
    return baseUrl;
  }
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Validade de 24 horas
  return `${baseUrl}?s_url=${encodeURIComponent(cfg.url)}&s_key=${encodeURIComponent(cfg.key)}&s_exp=${expiresAt}`;
};

export const applyConfigFromLink = (link: string): ApplyLinkResult => {
  try {
    const url = new URL(link);
    const s_url = url.searchParams.get('s_url');
    const s_key = url.searchParams.get('s_key');
    const s_exp = url.searchParams.get('s_exp');

    if (!s_url || !s_key) {
      return { success: false, message: 'Link de convite inválido ou incompleto. Certifique-se de copiar o link completo.' };
    }

    if (s_exp) {
      const expTime = Number(s_exp);
      if (!isNaN(expTime) && Date.now() > expTime) {
        const expiredDate = new Date(expTime).toLocaleString('pt-BR');
        return {
          success: false,
          message: `Este link de convite expirou! Ele possuía validade de 24 horas e venceu em ${expiredDate}. Solicite um novo link ao administrador.`
        };
      }
    }

    const config = { url: decodeURIComponent(s_url), key: decodeURIComponent(s_key) };
    try {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Falha ao salvar config Supabase (Quota)');
    }
    return { success: true, message: 'Link de convite e configurações vinculados com sucesso!' };
  } catch (e) {
    console.error('Link inválido', e);
    return { success: false, message: 'Formato de link inválido. Verifique o link fornecido.' };
  }
};

let cachedSupabaseClient: any = null;
let cachedSupabaseKey = '';

export const getSupabase = (stateConfig?: { url: string, key: string }) => {
  const config = stateConfig || getSupabaseConfig();
  if (!config?.url || !config?.key) return null;
  
  const cacheKey = `${config.url}::${config.key}`;
  if (cachedSupabaseClient && cachedSupabaseKey === cacheKey) {
    return cachedSupabaseClient;
  }

  try {
    cachedSupabaseClient = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: false,
      }
    });
    cachedSupabaseKey = cacheKey;
    return cachedSupabaseClient;
  } catch {
    return null;
  }
};

export const saveSession = (user: User | null) => {
  if (user) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Falha ao salvar sessão (Quota)');
    }
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

export const getSession = (): User | null => {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return null; }
};

export const fetchRemoteState = async (config?: {url: string, key: string}): Promise<AppState | null> => {
  let serverData: AppState | null = null;
  let supabaseData: AppState | null = null;

  // 1. Fetch from central server persistence (/api/farm-state)
  try {
    const res = await fetch('/api/farm-state');
    if (res.ok) {
      const json = await res.json();
      if (json && json.state) {
        serverData = json.state;
      }
    }
  } catch (err) {
    // server API offline or unreachable
  }

  // 2. Try Supabase if configured
  const configToUse = config || serverData?.supabaseConfig || getSupabaseConfig();
  const supabase = getSupabase(configToUse);
  if (supabase) {
    try {
      const { data } = await supabase.from('farm_data').select('state').eq('id', 'singleton').maybeSingle();
      if (data?.state) {
        supabaseData = data.state;
      }
    } catch (err) {
      // ignore error
    }
  }

  if (serverData && supabaseData) {
    return ensureStateIntegrity(serverData, supabaseData, 'remote');
  }

  return supabaseData || serverData || null;
};

export const loadState = async (): Promise<AppState> => {
  const localData = localStorage.getItem(STORAGE_KEY);
  let state: AppState;

  if (localData) {
    try {
      // Tenta descomprimir primeiro
      let decompressed = LZString.decompressFromUTF16(localData);
      
      // Se a descompressão falhar ou retornar nulo, pode ser que o dado não esteja comprimido (versão antiga)
      if (!decompressed) {
        // Verifica se parece um JSON (inicia com { ou [)
        if (localData.trim().startsWith('{') || localData.trim().startsWith('[')) {
          decompressed = localData;
        } else {
          throw new Error('Falha na descompressão do estado local');
        }
      }

      state = ensureStateIntegrity(JSON.parse(decompressed));
    } catch (err) {
      console.error('Erro ao ler estado do localStorage:', err);
      state = initialState;
    }
  } else {
    state = initialState;
  }

  const config = getSupabaseConfig();
  if (config) state.supabaseConfig = config;

  return state;
};

export const saveState = async (state: AppState, userConfig?: {url: string, key: string}): Promise<AppState> => {
  const integrityState = ensureStateIntegrity(state);
  const configToUse = userConfig || integrityState.supabaseConfig || getSupabaseConfig();
  
  if (configToUse) {
    try {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(configToUse));
    } catch (e) {
      console.warn('Não foi possível salvar config do Supabase no localStorage');
    }
  }

  // Save to LocalStorage immediately for instant UI responsiveness
  try {
    const jsonStr = JSON.stringify(integrityState);
    localStorage.setItem(STORAGE_KEY, jsonStr);
  } catch (err) {
    try {
      const jsonStr = JSON.stringify(integrityState);
      const compressed = LZString.compressToUTF16(jsonStr);
      localStorage.setItem(STORAGE_KEY, compressed);
    } catch (e2) {
      console.error('Erro de Quota no localStorage:', e2);
      try {
        const minimizedState = {
          ...integrityState,
          feedingLogs: integrityState.feedingLogs.slice(-500),
          mortalityLogs: integrityState.mortalityLogs.slice(-500),
          biometryLogs: integrityState.biometryLogs.slice(-500),
          feedStockLogs: (integrityState.feedStockLogs || []).slice(-500),
          slaughterLogs: integrityState.slaughterLogs.slice(-500),
          slaughterExpenses: (integrityState.slaughterExpenses || []).slice(-500),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimizedState));
      } catch (e3) {
        console.warn('Não foi possível salvar nem o estado reduzido no cache local.');
      }
    }
  }

  let mergedStateToSave = integrityState;

  // 1. Sync with server API (/api/farm-state)
  try {
    const res = await fetch('/api/farm-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: integrityState })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.state) {
        mergedStateToSave = json.state;
      }
    }
  } catch (e) {
    console.warn('Erro na sincronização via servidor API:', e);
  }

  // 2. Upsert to Supabase in background with two-way merging if configured
  const supabase = getSupabase(configToUse);
  if (supabase) {
    try {
      const { data } = await supabase.from('farm_data').select('state').eq('id', 'singleton').maybeSingle();
      const remoteState = data?.state as AppState | undefined;
      
      mergedStateToSave = remoteState 
        ? ensureStateIntegrity(mergedStateToSave, remoteState, 'local') 
        : mergedStateToSave;

      await supabase.from('farm_data').upsert({ id: 'singleton', state: mergedStateToSave, last_sync: new Date().toISOString() });
    } catch (err) {
      console.error('Erro de sincronização Supabase:', err);
    }
  }

  // Update local cache with merged state fast
  try {
    const mergedJson = JSON.stringify(mergedStateToSave);
    localStorage.setItem(STORAGE_KEY, mergedJson);
  } catch (e) {
    // ignore quota error
  }

  return mergedStateToSave;
};

export const subscribeToRemoteChanges = (config: {url: string, key: string}, callback: (newState: AppState) => void) => {
  const supabase = getSupabase(config);
  if (!supabase) return null;

  const channel = supabase
    .channel('farm_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'farm_data', filter: 'id=eq.singleton' },
      (payload) => {
        if (payload.new && (payload.new as any).state) {
          callback((payload.new as any).state);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const exportData = (state: AppState) => {
  const dataStr = JSON.stringify(ensureStateIntegrity(state), null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', `backup_piscicultura_${new Date().toISOString().split('T')[0]}.json`);
  linkElement.click();
};

export const forceAdminMassSync = async (adminState: AppState, config?: { url: string; key: string }): Promise<{ success: boolean; message: string }> => {
  try {
    const integrityState = ensureStateIntegrity({
      ...adminState,
      lastSync: Date.now()
    });

    const configToUse = config || integrityState.supabaseConfig || getSupabaseConfig();

    // 1. Force save to server API (overwrites server state)
    try {
      await fetch('/api/farm-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: integrityState, force: true })
      });
    } catch (err) {
      console.warn('Erro na sincronização em massa com o servidor:', err);
    }

    // 2. Force overwrite in Supabase (WITHOUT merging)
    const supabase = getSupabase(configToUse);
    if (supabase) {
      const { error } = await supabase
        .from('farm_data')
        .upsert({ id: 'singleton', state: integrityState, last_sync: new Date().toISOString() });
      if (error) {
        console.error('Erro no upsert forçado do Supabase:', error);
      }
    }

    // 3. Update localStorage
    try {
      const jsonStr = JSON.stringify(integrityState);
      localStorage.setItem(STORAGE_KEY, LZString.compressToUTF16(jsonStr));
    } catch (e) {
      console.warn('Erro de cota ao salvar no localStorage:', e);
    }

    return {
      success: true,
      message: 'Sincronização em massa concluída com sucesso! Todos os dados do Administrador foram replicados para o banco central e nuvem. Todos os usuários agora visualizarão a mesma base de dados.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Falha na sincronização em massa: ' + (err?.message || 'Erro desconhecido')
    };
  }
};
