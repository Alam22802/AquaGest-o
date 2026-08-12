
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
  password: 'admin',
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
  deletedIds: []
};

function isObjectModified(a: any, b: any): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  const keys = Object.keys(a);
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'lastSync') continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      return true;
    }
  }
  return false;
}

function mergeArraysById<T extends { id: string, updatedAt?: number | string }>(
  local: T[], 
  remote: T[], 
  deletedIds: string[] = [],
  priority: 'local' | 'remote' = 'local'
): T[] {
  const safeLocal = local || [];
  const safeRemote = remote || [];
  
  if (safeRemote.length === 0 && deletedIds.length === 0) return safeLocal;
  if (safeLocal.length === 0 && deletedIds.length === 0) return safeRemote;
  
  const map = new Map<string, T>();
  const deletedSet = deletedIds.length > 0 ? new Set(deletedIds) : null;

  const now = Date.now();
  const getTime = (item: T): number => {
    if (!item || item.updatedAt === undefined || item.updatedAt === null) return 0;
    let t = typeof item.updatedAt === 'number' ? item.updatedAt : new Date(item.updatedAt).getTime();
    if (isNaN(t)) return 0;
    if (t > now + 60000) return now; // Cap future timestamps
    return t;
  };

  // 1. Process local items first
  for (let i = 0; i < safeLocal.length; i++) {
    const item = safeLocal[i];
    if (!item || !item.id || (deletedSet && deletedSet.has(item.id))) continue;
    map.set(item.id, item);
  }

  // 2. Process remote items
  for (let i = 0; i < safeRemote.length; i++) {
    const item = safeRemote[i];
    if (!item || !item.id || (deletedSet && deletedSet.has(item.id))) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const itemTime = getTime(item);
      const existingTime = getTime(existing);
      
      if (itemTime > existingTime) {
        // Remote is newer
        map.set(item.id, { ...existing, ...item, updatedAt: itemTime });
      } else if (existingTime > itemTime) {
        // Local is newer
        map.set(item.id, { ...item, ...existing, updatedAt: existingTime });
      } else {
        // Equal timestamps: resolve according to priority and keep modified fields
        const modified = isObjectModified(existing, item);
        if (priority === 'local') {
          const newTime = modified ? Date.now() : (existingTime || Date.now());
          map.set(item.id, { ...item, ...existing, updatedAt: newTime });
        } else {
          const newTime = modified ? Date.now() : (itemTime || Date.now());
          map.set(item.id, { ...existing, ...item, updatedAt: newTime });
        }
      }
    }
  }

  return Array.from(map.values());
}

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
    map.set(u.id, u);
  }

  // Process local users
  for (let i = 0; i < safeLocal.length; i++) {
    const u = safeLocal[i];
    if (!u || !u.id || (deletedSet && deletedSet.has(u.id))) continue;
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

      const primary = (localTime > remoteTime || (priority === 'local' && localTime >= remoteTime)) ? u : existing;

      const mergedUser: User = {
        ...primary,
        isApproved: mergedApproval,
        lastSync: latestLastSync,
        updatedAt: Math.max(localTime, remoteTime) || Date.now(),
        canEdit: existing.isApproved ? existing.canEdit : u.canEdit,
        allowedTabs: existing.isApproved ? existing.allowedTabs : u.allowedTabs,
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

        // If updatedAt exists and is non-zero, matching upA === upB guarantees equality for updated objects
        if (upA === 0 || upB === 0) {
          if (JSON.stringify(itemA) !== JSON.stringify(itemB)) return false;
        }
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
  const trimmedDeletedIds = combinedDeletedIdsArray.length > 2000 ? combinedDeletedIdsArray.slice(-2000) : combinedDeletedIdsArray;

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
  
  const filterByTombstone = (arr: any[]) => {
    if (!arr) return [];
    if (deletedSet.size === 0) return arr;
    return arr.filter(i => !deletedSet.has(i.id));
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
    slaughterLogs: filterByTombstone(base.slaughterLogs || []),
    slaughterExpenses: filterByTombstone(base.slaughterExpenses || []),
    slaughterEmployees: filterByTombstone(base.slaughterEmployees || []),
    slaughterHRIndicators: filterByTombstone(base.slaughterHRIndicators || []),
    slaughterHREntries: filterByTombstone(base.slaughterHREntries || []),
    slaughterHRVacancies: filterByTombstone(base.slaughterHRVacancies || []),
    slaughterExpenseCategories: base.slaughterExpenseCategories || initialState.slaughterExpenseCategories,
    slaughterHREntryTypes: base.slaughterHREntryTypes || initialState.slaughterHREntryTypes,
    slaughterHRDepartments: base.slaughterHRDepartments || initialState.slaughterHRDepartments,
    slaughterHRRoles: base.slaughterHRRoles || initialState.slaughterHRRoles,
    slaughterSupplyItems: filterByTombstone(base.slaughterSupplyItems || []),
    slaughterSuppliers: filterByTombstone(base.slaughterSuppliers || []),
    slaughterSupplyRequests: filterByTombstone(base.slaughterSupplyRequests || []),
    slaughterPurchaseOrders: filterByTombstone(base.slaughterPurchaseOrders || []),
    slaughterSupplyInvoices: filterByTombstone(base.slaughterSupplyInvoices || []),
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
    coldStorageLogs: filterByTombstone(base.coldStorageLogs || []),
    utilityLogs: filterByTombstone(base.utilityLogs || []),
    coldChambers: filterByTombstone(base.coldChambers || []),
    pcpSuppliers: filterByTombstone(base.pcpSuppliers || []),
    pcpSlaughterSchedules: filterByTombstone(base.pcpSlaughterSchedules || []),
    feedingTables: filterByTombstone(base.feedingTables || []),
    costCenters: filterByTombstone(base.costCenters || []),
    pcmEquipments: filterByTombstone(base.pcmEquipments || []),
    pcmStoppageReasons: filterByTombstone(base.pcmStoppageReasons || []),
    pcmProductionStoppages: filterByTombstone(base.pcmProductionStoppages || []),
    pcmPlannedImprovements: filterByTombstone(base.pcmPlannedImprovements || []),
    farmTargetCapacity: base.farmTargetCapacity || 0,
  };

  const finalResult = mergeWith ? {
    ...result,
    users: mergeUsers(result.users, mergeWith.users, combinedDeletedIdsArray, priority),
    slaughterLogs: mergeArraysById(result.slaughterLogs, mergeWith.slaughterLogs, combinedDeletedIdsArray, priority),
    feedTypes: mergeArraysById(result.feedTypes, mergeWith.feedTypes, combinedDeletedIdsArray, priority),
    lines: mergeArraysById(result.lines, mergeWith.lines, combinedDeletedIdsArray, priority),
    batches: mergeArraysById(result.batches, mergeWith.batches, combinedDeletedIdsArray, priority),
    cages: mergeArraysById(result.cages, mergeWith.cages, combinedDeletedIdsArray, priority),
    feedingLogs: mergeArraysById(result.feedingLogs, mergeWith.feedingLogs, combinedDeletedIdsArray, priority),
    feedStockLogs: mergeArraysById(result.feedStockLogs || [], mergeWith.feedStockLogs || [], combinedDeletedIdsArray, priority),
    mortalityLogs: mergeArraysById(result.mortalityLogs, mergeWith.mortalityLogs, combinedDeletedIdsArray, priority),
    biometryLogs: mergeArraysById(result.biometryLogs, mergeWith.biometryLogs, combinedDeletedIdsArray, priority),
    slaughterExpenses: mergeArraysById(result.slaughterExpenses || [], mergeWith.slaughterExpenses || [], combinedDeletedIdsArray, priority),
    slaughterEmployees: mergeArraysById(result.slaughterEmployees || [], mergeWith.slaughterEmployees || [], combinedDeletedIdsArray, priority),
    slaughterHRIndicators: mergeArraysById(result.slaughterHRIndicators || [], mergeWith.slaughterHRIndicators || [], combinedDeletedIdsArray, priority),
    slaughterHREntries: mergeArraysById(result.slaughterHREntries || [], mergeWith.slaughterHREntries || [], combinedDeletedIdsArray, priority),
    slaughterHRVacancies: mergeArraysById(result.slaughterHRVacancies || [], mergeWith.slaughterHRVacancies || [], combinedDeletedIdsArray, priority),
    slaughterSupplyItems: mergeArraysById(result.slaughterSupplyItems || [], mergeWith.slaughterSupplyItems || [], combinedDeletedIdsArray, priority),
    slaughterSuppliers: mergeArraysById(result.slaughterSuppliers || [], mergeWith.slaughterSuppliers || [], combinedDeletedIdsArray, priority),
    slaughterSupplyRequests: mergeArraysById(result.slaughterSupplyRequests || [], mergeWith.slaughterSupplyRequests || [], combinedDeletedIdsArray, priority),
    slaughterPurchaseOrders: mergeArraysById(result.slaughterPurchaseOrders || [], mergeWith.slaughterPurchaseOrders || [], combinedDeletedIdsArray, priority),
    slaughterSupplyInvoices: mergeArraysById(result.slaughterSupplyInvoices || [], mergeWith.slaughterSupplyInvoices || [], combinedDeletedIdsArray, priority),
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
    coldStorageLogs: mergeArraysById(result.coldStorageLogs || [], mergeWith.coldStorageLogs || [], combinedDeletedIdsArray, priority),
    utilityLogs: mergeArraysById(result.utilityLogs || [], mergeWith.utilityLogs || [], combinedDeletedIdsArray, priority),
    coldChambers: mergeArraysById(result.coldChambers || [], mergeWith.coldChambers || [], combinedDeletedIdsArray, priority),
    pcpSuppliers: mergeArraysById(result.pcpSuppliers || [], mergeWith.pcpSuppliers || [], combinedDeletedIdsArray, priority),
    pcpSlaughterSchedules: mergeArraysById(result.pcpSlaughterSchedules || [], mergeWith.pcpSlaughterSchedules || [], combinedDeletedIdsArray, priority),
    feedingTables: mergeArraysById(result.feedingTables || [], mergeWith.feedingTables || [], combinedDeletedIdsArray, priority),
    costCenters: mergeArraysById(result.costCenters || [], mergeWith.costCenters || [], combinedDeletedIdsArray, priority),
    pcmEquipments: mergeArraysById(result.pcmEquipments || [], mergeWith.pcmEquipments || [], combinedDeletedIdsArray, priority),
    pcmStoppageReasons: mergeArraysById(result.pcmStoppageReasons || [], mergeWith.pcmStoppageReasons || [], combinedDeletedIdsArray, priority),
    pcmProductionStoppages: mergeArraysById(result.pcmProductionStoppages || [], mergeWith.pcmProductionStoppages || [], combinedDeletedIdsArray, priority),
    pcmPlannedImprovements: mergeArraysById(result.pcmPlannedImprovements || [], mergeWith.pcmPlannedImprovements || [], combinedDeletedIdsArray, priority),
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
    if (batchId) {
      const existingBatch = batches.find(b => b.id === batchId);
      if (!existingBatch && batches.length > 0) {
        batchId = undefined;
      }
    }
    if (!batchId) {
      for (const b of batches) {
        const hasLogs = (finalResult.feedingLogs || []).some(f => f.cageId === cage.id && f.batchId === b.id) ||
                        (finalResult.mortalityLogs || []).some(m => m.cageId === cage.id && m.batchId === b.id) ||
                        (finalResult.biometryLogs || []).some(bio => bio.cageId === cage.id && bio.batchId === b.id) ||
                        (finalResult.harvestLogs || []).some(h => h.cageId === cage.id && h.batchId === b.id);
        if (hasLogs) {
          batchId = b.id;
          break;
        }
      }
    }
    return { ...cage, batchId };
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
    let { batchId, initialFishCount, status, harvestDate, settlementDate } = cage;

    // Check if this cage has a harvest log for this batch
    let harvest = batchId ? harvestLogs.find(h => h.cageId === cage.id && h.batchId === batchId) : null;

    if (status === 'Em Uso') {
      status = 'Ocupada';
    }
    if (!status) {
      status = batchId ? 'Ocupada' : 'Disponível';
    }
    if (batchId) {
      const batch = batches.find(b => b.id === batchId);
      if (batch && !settlementDate) {
        settlementDate = batch.settlementDate;
      }
      if (harvest && status === 'Ocupada') {
        harvestDate = harvest.date || harvestDate;
      }
    }

    if (batchId && (!initialFishCount || initialFishCount <= 0)) {
      const batch = batches.find(b => b.id === batchId);
      if (batch && batch.initialQuantity > 0) {
        const batchCages = cagesByBatchMap.get(batch.id) || [];
        const knownFishSum = batchCages
          .filter(c => c.id !== cage.id && c.initialFishCount && c.initialFishCount > 0)
          .reduce((a, c) => a + (c.initialFishCount || 0), 0);

        const harvestSum = harvestLogs
          .filter(h => h.batchId === batch.id)
          .reduce((a, h) => a + (h.initialFishCount || h.fishCount || 0), 0);

        const nurseryMort = mortalityLogs
          .filter(m => m.batchId === batch.id && !m.cageId)
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
    if (currentBatchId && isValidForBatch(currentBatchId, cageId, logDateStr)) {
      return currentBatchId;
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

  const purgedLogIds: string[] = [];

  if (finalResult.feedingLogs && finalResult.feedingLogs.length > 0) {
    const validFeedingLogs: any[] = [];
    finalResult.feedingLogs.forEach(f => {
      const fDate = (f.timestamp || '').split('T')[0];
      const correctBatchId = getReconciledBatchId(f.cageId, fDate, f.batchId);
      const targetBatchId = (correctBatchId && batchMap.has(correctBatchId) && !deletedSet.has(correctBatchId)) 
        ? correctBatchId 
        : (f.batchId && batchMap.has(f.batchId) && !deletedSet.has(f.batchId) ? f.batchId : '');
      
      if (targetBatchId) {
        validFeedingLogs.push(targetBatchId !== f.batchId ? { ...f, batchId: targetBatchId, updatedAt: Date.now() } : f);
      } else if (f.cageId && normalizedCages.some(c => c.id === f.cageId)) {
        validFeedingLogs.push(f);
      } else {
        if (f.id) purgedLogIds.push(f.id);
      }
    });
    finalResult.feedingLogs = validFeedingLogs;
  }

  // Adjust/Normalize Lote 02 feeding logs if Lote 02 exists in batches
  const batch02 = (finalResult.batches || []).find(b => {
    const bnNoLote = (b.name || '').replace(/^lote\s*/i, '').trim();
    const bnNum = bnNoLote.replace(/^0+/, '');
    return bnNum === '2' || bnNoLote === '02' || bnNoLote === '2';
  });

  if (batch02) {
    const ft23 = (finalResult.feedTypes || []).find(t => {
      const n = (t.name || '').toLowerCase();
      return (n.includes('2') && n.includes('3')) || t.id === 'feed-2-3mm';
    }) || { id: 'feed-2-3mm', name: 'Ração 2 a 3mm' };

    const ft34 = (finalResult.feedTypes || []).find(t => {
      const n = (t.name || '').toLowerCase();
      return (n.includes('3') && n.includes('4')) || t.id === 'feed-3-4mm';
    }) || { id: 'feed-3-4mm', name: 'Ração 3 a 4mm' };

    const ft46 = (finalResult.feedTypes || []).find(t => {
      const n = (t.name || '').toLowerCase();
      return (n.includes('4') && n.includes('6')) || t.id === 'feed-4-6mm';
    }) || { id: 'feed-4-6mm', name: 'Ração 4 a 6mm' };

    const currentBatch02Logs = (finalResult.feedingLogs || []).filter(f => f.batchId === batch02.id);
    
    const sum23 = currentBatch02Logs.filter(f => f.feedTypeId === ft23.id).reduce((acc, f) => acc + (f.amount || 0), 0);
    const sum34 = currentBatch02Logs.filter(f => f.feedTypeId === ft34.id).reduce((acc, f) => acc + (f.amount || 0), 0);
    const sum46 = currentBatch02Logs.filter(f => f.feedTypeId === ft46.id).reduce((acc, f) => acc + (f.amount || 0), 0);

    const target23Grams = 1637200; // 1.637,2 KG
    const target34Grams = 5664900; // 5.664,9 KG
    const target46Grams = 83196600; // 83.196,6 KG

    if (sum23 !== target23Grams || sum34 !== target34Grams || sum46 !== target46Grams) {
      const otherLogs = (finalResult.feedingLogs || []).filter(f => f.batchId !== batch02.id);
      
      const cageId02 = (batch02.cageIds && batch02.cageIds.length > 0) ? batch02.cageIds[0] : (normalizedCages[0]?.id || 'c-lote02-01');
      const logTimestamp = batch02.settlementDate 
        ? `${batch02.settlementDate}T12:00:00.000Z`
        : (batch02.closedAt || '2025-06-01T12:00:00.000Z');

      const fixedLogs = [
        {
          id: `lote02-feed-23-${batch02.id}`,
          batchId: batch02.id,
          cageId: cageId02,
          feedTypeId: ft23.id,
          amount: target23Grams,
          timestamp: logTimestamp,
          userId: batch02.userId || 'system',
          updatedAt: Date.now()
        },
        {
          id: `lote02-feed-34-${batch02.id}`,
          batchId: batch02.id,
          cageId: cageId02,
          feedTypeId: ft34.id,
          amount: target34Grams,
          timestamp: logTimestamp,
          userId: batch02.userId || 'system',
          updatedAt: Date.now()
        },
        {
          id: `lote02-feed-46-${batch02.id}`,
          batchId: batch02.id,
          cageId: cageId02,
          feedTypeId: ft46.id,
          amount: target46Grams,
          timestamp: logTimestamp,
          userId: batch02.userId || 'system',
          updatedAt: Date.now()
        }
      ];

      finalResult.feedingLogs = [...otherLogs, ...fixedLogs];
    }
  }

  if (finalResult.mortalityLogs && finalResult.mortalityLogs.length > 0) {
    const validMortalityLogs: any[] = [];
    finalResult.mortalityLogs.forEach(m => {
      const mDate = m.date || '';
      const correctBatchId = getReconciledBatchId(m.cageId, mDate, m.batchId);
      const targetBatchId = (correctBatchId && batchMap.has(correctBatchId) && !deletedSet.has(correctBatchId))
        ? correctBatchId
        : (m.batchId && batchMap.has(m.batchId) && !deletedSet.has(m.batchId) ? m.batchId : '');

      if (targetBatchId) {
        validMortalityLogs.push(targetBatchId !== m.batchId ? { ...m, batchId: targetBatchId, updatedAt: Date.now() } : m);
      } else if (m.cageId && normalizedCages.some(c => c.id === m.cageId)) {
        validMortalityLogs.push(m);
      } else {
        if (m.id) purgedLogIds.push(m.id);
      }
    });
    finalResult.mortalityLogs = validMortalityLogs;
  }

  if (finalResult.biometryLogs && finalResult.biometryLogs.length > 0) {
    const validBiometryLogs: any[] = [];
    finalResult.biometryLogs.forEach(b => {
      const bDate = b.date || '';
      const correctBatchId = getReconciledBatchId(b.cageId, bDate, b.batchId);
      const targetBatchId = (correctBatchId && batchMap.has(correctBatchId) && !deletedSet.has(correctBatchId))
        ? correctBatchId
        : (b.batchId && batchMap.has(b.batchId) && !deletedSet.has(b.batchId) ? b.batchId : '');

      if (targetBatchId) {
        validBiometryLogs.push(targetBatchId !== b.batchId ? { ...b, batchId: targetBatchId, updatedAt: Date.now() } : b);
      } else if (b.cageId && normalizedCages.some(c => c.id === b.cageId)) {
        validBiometryLogs.push(b);
      } else {
        if (b.id) purgedLogIds.push(b.id);
      }
    });
    finalResult.biometryLogs = validBiometryLogs;
  }

  if (finalResult.harvestLogs && finalResult.harvestLogs.length > 0) {
    const validHarvestLogs: any[] = [];
    finalResult.harvestLogs.forEach(h => {
      if (h.batchId && batchMap.has(h.batchId) && !deletedSet.has(h.batchId)) {
        validHarvestLogs.push(h);
      } else {
        if (h.id) purgedLogIds.push(h.id);
      }
    });
    finalResult.harvestLogs = validHarvestLogs;
  }

  if (finalResult.harvestSchedules && finalResult.harvestSchedules.length > 0) {
    const validHarvestSchedules: any[] = [];
    finalResult.harvestSchedules.forEach(hs => {
      if (hs.batchId && batchMap.has(hs.batchId) && !deletedSet.has(hs.batchId)) {
        validHarvestSchedules.push(hs);
      } else {
        if (hs.id) purgedLogIds.push(hs.id);
      }
    });
    finalResult.harvestSchedules = validHarvestSchedules;
  }

  if (finalResult.batchExpenses && finalResult.batchExpenses.length > 0) {
    const validExpenses: any[] = [];
    finalResult.batchExpenses.forEach(e => {
      if (e.batchId && batchMap.has(e.batchId) && !deletedSet.has(e.batchId)) {
        validExpenses.push(e);
      } else {
        if (e.id) purgedLogIds.push(e.id);
      }
    });
    finalResult.batchExpenses = validExpenses;
  }

  if (finalResult.batchRevenues && finalResult.batchRevenues.length > 0) {
    const validRevenues: any[] = [];
    finalResult.batchRevenues.forEach(r => {
      if (r.batchId && batchMap.has(r.batchId) && !deletedSet.has(r.batchId)) {
        validRevenues.push(r);
      } else {
        if (r.id) purgedLogIds.push(r.id);
      }
    });
    finalResult.batchRevenues = validRevenues;
  }

  if (finalResult.slaughterLogs && finalResult.slaughterLogs.length > 0) {
    const validSlaughterLogs: any[] = [];
    finalResult.slaughterLogs.forEach((s: any) => {
      if (!s.batchId || (batchMap.has(s.batchId) && !deletedSet.has(s.batchId))) {
        validSlaughterLogs.push(s);
      } else {
        if (s.id) purgedLogIds.push(s.id);
      }
    });
    finalResult.slaughterLogs = validSlaughterLogs;
  }

  if (purgedLogIds.length > 0) {
    finalResult.deletedIds = Array.from(new Set([
      ...(finalResult.deletedIds || []),
      ...purgedLogIds
    ]));
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

  if (urlParam && keyParam) {
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

export const applyConfigFromLink = (link: string): boolean => {
  try {
    const url = new URL(link);
    const s_url = url.searchParams.get('s_url');
    const s_key = url.searchParams.get('s_key');
    if (s_url && s_key) {
      const config = { url: decodeURIComponent(s_url), key: decodeURIComponent(s_key) };
      try {
        localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
      } catch (e) {
        console.warn('Falha ao salvar config Supabase (Quota)');
      }
      return true;
    }
  } catch (e) {
    console.error('Link inválido', e);
  }
  return false;
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
  let remoteData: AppState | null = null;

  // 1. Try Supabase first if configured
  const supabase = getSupabase(config);
  if (supabase) {
    try {
      const { data } = await supabase.from('farm_data').select('state').eq('id', 'singleton').maybeSingle();
      if (data?.state) {
        remoteData = data.state;
      }
    } catch (err) {
      // ignore error
    }
  }

  // 2. Fetch from central server persistence (/api/farm-state)
  try {
    const res = await fetch('/api/farm-state');
    if (res.ok) {
      const json = await res.json();
      if (json && json.state) {
        remoteData = remoteData 
          ? ensureStateIntegrity(remoteData, json.state, 'remote')
          : json.state;
      }
    }
  } catch (err) {
    // server API offline or unreachable
  }

  return remoteData;
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
    const compressed = LZString.compressToUTF16(jsonStr);
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (err) {
    console.error('Erro de Quota no localStorage:', err);
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
      const compressed = LZString.compressToUTF16(JSON.stringify(minimizedState));
      localStorage.setItem(STORAGE_KEY, compressed);
    } catch (e) {
      console.warn('Não foi possível salvar nem o estado reduzido no cache local.');
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
        mergedStateToSave = ensureStateIntegrity(mergedStateToSave, json.state, 'local');
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

  // Update local cache with merged state
  try {
    const mergedJson = JSON.stringify(mergedStateToSave);
    localStorage.setItem(STORAGE_KEY, LZString.compressToUTF16(mergedJson));
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
