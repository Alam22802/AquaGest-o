
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

function mergeArraysById<T extends { id: string, updatedAt?: number | string }>(
  local: T[], 
  remote: T[], 
  deletedIds: string[] = [],
  priority: 'local' | 'remote' = 'remote'
): T[] {
  const safeLocal = local || [];
  const safeRemote = remote || [];
  
  if (safeRemote.length === 0 && deletedIds.length === 0) return safeLocal;
  if (safeLocal.length === 0 && deletedIds.length === 0) return safeRemote;
  
  const map = new Map<string, T>();
  const deletedSet = deletedIds.length > 0 ? new Set(deletedIds) : null;

  const getTime = (item: T): number => {
    if (!item || item.updatedAt === undefined || item.updatedAt === null) return 0;
    if (typeof item.updatedAt === 'number') return item.updatedAt;
    const parsed = new Date(item.updatedAt).getTime();
    return isNaN(parsed) ? 0 : parsed;
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
      
      // If remote item is STRICTLY newer, update map
      if (itemTime > existingTime) {
        map.set(item.id, item);
      } else if (itemTime === existingTime) {
        // Equal timestamp!
        // When timestamps are equal (or both 0), PRESERVE local item
        // so that recent/pending local user edits or additions are NEVER wiped by remote state.
        if (priority === 'remote' && (!existingTime || existingTime === 0)) {
          // If neither has a timestamp, prefer local to keep current user's changes
          // map already has existing (local), so leave it.
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

  // 1. Process remote users first (these are the server state)
  for (let i = 0; i < safeRemote.length; i++) {
    const u = safeRemote[i];
    if (!u || !u.id || (deletedSet && deletedSet.has(u.id))) continue;
    map.set(u.id, u);
  }

  // 2. Process local users (these are local browser state)
  for (let i = 0; i < safeLocal.length; i++) {
    const u = safeLocal[i];
    if (!u || !u.id || (deletedSet && deletedSet.has(u.id))) continue;
    const existing = map.get(u.id);
    if (!existing) {
      // Exist only locally (e.g. newly registered, not yet synced)
      map.set(u.id, u);
    } else {
      // Exists in both.
      // Remote (database) is the sovereign source of truth for approvals, passwords and permissions.
      const localTime = Number(u.updatedAt) || 0;
      const remoteTime = Number(existing.updatedAt) || 0;

      // Keep sovereign approval status and roles from remote if remote approved it,
      // or if either is approved, let's keep approved = true to prevent lockouts due to system clock mismatches!
      const mergedApproval = existing.isApproved || u.isApproved;
      
      const mergedUser: User = {
        ...existing,
        isApproved: mergedApproval,
        // If approved on remote, keep permissions/roles from remote
        canEdit: existing.isApproved ? existing.canEdit : u.canEdit,
        allowedTabs: existing.isApproved ? existing.allowedTabs : u.allowedTabs,
      };

      if (priority === 'local' && localTime > remoteTime) {
        map.set(u.id, {
          ...u,
          isApproved: mergedApproval,
          canEdit: existing.isApproved ? existing.canEdit : u.canEdit,
          allowedTabs: existing.isApproved ? existing.allowedTabs : u.allowedTabs,
        });
      } else {
        map.set(u.id, mergedUser);
      }
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
        if (Number(itemA.updatedAt || 0) !== Number(itemB.updatedAt || 0)) return false;
      } else {
        if (itemA !== itemB) return false;
      }
    }
  }

  return true;
};

export const ensureStateIntegrity = (state: any, mergeWith?: AppState, priority: 'local' | 'remote' = 'remote'): AppState => {
  const rawDeletedIds = [
    ...(state?.deletedIds || []),
    ...(mergeWith?.deletedIds || [])
  ];
  
  const repairedDeletedIdsArr = repairArray(rawDeletedIds);
  const combinedDeletedIdsArray = Array.from(new Set(repairedDeletedIdsArr));
  
  const deletedSet = new Set(combinedDeletedIdsArray);

  const base: AppState = {
    ...initialState,
    ...state,
    deletedIds: combinedDeletedIdsArray,
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

  if (state && areStatesEqual(state, finalResult)) {
    return state;
  }
  return finalResult;
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

export const getSupabase = (stateConfig?: { url: string, key: string }) => {
  const config = stateConfig || getSupabaseConfig();
  if (!config?.url || !config?.key) return null;
  try {
    return createClient(config.url, config.key);
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
  const supabase = getSupabase(config);
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('farm_data').select('state').eq('id', 'singleton').maybeSingle();
    return data?.state || null;
  } catch {
    return null;
  }
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
  let finalState = integrityState;
  
  const configToUse = userConfig || integrityState.supabaseConfig;
  
  if (configToUse) {
    try {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(configToUse));
    } catch (e) {
      console.warn('Não foi possível salvar config do Supabase no localStorage');
    }
  }

  const supabase = getSupabase(configToUse);
  if (supabase) {
    try {
      const remote = await fetchRemoteState(configToUse);
      finalState = remote ? ensureStateIntegrity(integrityState, remote, 'local') : integrityState;
      await supabase.from('farm_data').upsert({ id: 'singleton', state: finalState, last_sync: new Date().toISOString() });
    } catch (err) {
      console.error('Erro de sincronização:', err);
    }
  }

  try {
    const jsonStr = JSON.stringify(finalState);
    const compressed = LZString.compressToUTF16(jsonStr);
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (err) {
    console.error('Erro de Quota no localStorage:', err);
    try {
      const minimizedState = {
        ...finalState,
        feedingLogs: finalState.feedingLogs.slice(-500),
        mortalityLogs: finalState.mortalityLogs.slice(-500),
        biometryLogs: finalState.biometryLogs.slice(-500),
        feedStockLogs: (finalState.feedStockLogs || []).slice(-500),
        slaughterLogs: finalState.slaughterLogs.slice(-500),
        slaughterExpenses: (finalState.slaughterExpenses || []).slice(-500),
      };
      const compressed = LZString.compressToUTF16(JSON.stringify(minimizedState));
      localStorage.setItem(STORAGE_KEY, compressed);
      console.log('Estado salvo no cache local após minificação (excesso de quota).');
    } catch (e) {
      console.warn('Não foi possível salvar nem o estado reduzido no cache local.');
    }
  }

  return finalState;
};

export const subscribeToRemoteChanges = (config: {url: string, key: string}, callback: (newState: AppState) => void) => {
  const supabase = getSupabase(config);
  if (!supabase) return null;

  const channel = supabase
    .channel('farm_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'farm_data', filter: 'id=eq.singleton' },
      (payload) => {
        if (payload.new && payload.new.state) {
          callback(payload.new.state);
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
