
import { AppState, User, NotificationSettings, SlaughterLog } from './types';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'aquagestao_v1';
const SUPABASE_CONFIG_KEY = 'aquagestao_supabase_config';
const SESSION_KEY = 'aquagestao_session';

const safeLocalStorageSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && (
      e.code === 22 || 
      e.code === 1014 || 
      e.name === 'QuotaExceededError' || 
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.warn('LocalStorage quota exceeded. Attempting to prune state...');
      if (key === STORAGE_KEY) {
        try {
          const state = JSON.parse(value) as AppState;
          
          const sortByRecent = (arr: any[], limit: number) => {
            if (!arr || arr.length === 0) return [];
            return [...arr].sort((a, b) => {
              const timeA = Number(a.updatedAt) || 0;
              const timeB = Number(b.updatedAt) || 0;
              if (timeA !== timeB) return timeB - timeA;
              const dateA = a.date || a.timestamp || '';
              const dateB = b.date || b.timestamp || '';
              if (dateA || dateB) return dateB.localeCompare(dateA);
              return 0;
            }).slice(0, limit);
          };

          // Conservative pruning for emergency space - keep much more history
          const prunedState: AppState = {
            ...state,
            feedingLogs: sortByRecent(state.feedingLogs || [], 10000),
            mortalityLogs: sortByRecent(state.mortalityLogs || [], 10000),
            biometryLogs: sortByRecent(state.biometryLogs || [], 10000),
            slaughterLogs: sortByRecent(state.slaughterLogs || [], 10000),
            harvestLogs: sortByRecent(state.harvestLogs || [], 10000),
            utilityLogs: sortByRecent(state.utilityLogs || [], 10000),
            coldStorageLogs: sortByRecent(state.coldStorageLogs || [], 10000),
            feedStockLogs: sortByRecent(state.feedStockLogs || [], 10000),
            feedingTables: (state.feedingTables || []).slice(0, 300),
            deletedIds: (state.deletedIds || []).slice(-500), 
          };
          localStorage.setItem(key, JSON.stringify(prunedState));
          console.log('State pruned and saved successfully.');
        } catch (innerError) {
          console.error('Failed to save even after pruning:', innerError);
          // Don't reload/clear, just let it fail silently or log it
        }
      }
    } else {
      throw e;
    }
  }
};

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
  protocols: [],
  standardCurves: [],
  portfolios: [],
  capexProjects: [],
  capexInvoices: [],
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

function mergeArraysById<T extends { id: string, updatedAt?: number }>(
  local: T[], 
  remote: T[], 
  deletedIds: string[] = [],
  priority: 'local' | 'remote' = 'remote'
): T[] {
  const map = new Map<string, T>();
  const safeLocal = local || [];
  const safeRemote = remote || [];
  const deletedSet = new Set(deletedIds);

  const processItem = (item: T) => {
    if (!item || !item.id || deletedSet.has(item.id)) return;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const itemTime = Number(item.updatedAt) || 0;
      const existingTime = Number(existing.updatedAt) || 0;
      if (itemTime > existingTime) {
        map.set(item.id, item);
      } else if (itemTime === existingTime && priority === 'remote') {
        map.set(item.id, item);
      }
    }
  };

  safeLocal.forEach(processItem);
  safeRemote.forEach(processItem);

  return Array.from(map.values());
}

export const ensureStateIntegrity = (state: any, mergeWith?: AppState, priority: 'local' | 'remote' = 'remote'): AppState => {
  // Prune deletedIds to keep only the last 500 to save space
  const initialDeletedIds = state?.deletedIds || [];
  const mergeDeletedIds = mergeWith?.deletedIds || [];
  const allDeletedIds = Array.from(new Set([...initialDeletedIds, ...mergeDeletedIds]));
  // We keep a decent amount of deleted IDs to ensure sync consistency, but limit it to avoid bloat
  const combinedDeletedIds = allDeletedIds.slice(-2000); 

  // If priority is 'local' and we are doing a full merge (like from an import), 
  // we might want to ignore some deleted IDs. 
  // For now, we just ensure that common collections are handled.

  const base: AppState = {
    ...initialState,
    ...state,
    deletedIds: combinedDeletedIds
  };

  const filterByTombstone = (arr: any[]) => (arr || []).filter(i => !combinedDeletedIds.includes(i.id));

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
    harvestLogs: filterByTombstone(base.harvestLogs || []),
    harvestSchedules: filterByTombstone(base.harvestSchedules || []),
    batchExpenses: filterByTombstone(base.batchExpenses || []),
    batchRevenues: filterByTombstone(base.batchRevenues || []),
    coldStorageLogs: filterByTombstone(base.coldStorageLogs || []),
    utilityLogs: filterByTombstone(base.utilityLogs || []),
    coldChambers: filterByTombstone(base.coldChambers || []),
    feedingTables: filterByTombstone(base.feedingTables || []),
    costCenters: filterByTombstone(base.costCenters || []),
    pcmEquipments: filterByTombstone(base.pcmEquipments || []),
    pcmStoppageReasons: filterByTombstone(base.pcmStoppageReasons || []),
    pcmProductionStoppages: filterByTombstone(base.pcmProductionStoppages || []),
    pcmPlannedImprovements: filterByTombstone(base.pcmPlannedImprovements || []),
    farmTargetCapacity: base.farmTargetCapacity || 0,
  };

  if (mergeWith) {
    const mergedResult: AppState = {
      ...result,
      users: mergeArraysById(result.users, mergeWith.users, combinedDeletedIds, priority),
      slaughterLogs: mergeArraysById(result.slaughterLogs, mergeWith.slaughterLogs, combinedDeletedIds, priority),
      feedTypes: mergeArraysById(result.feedTypes, mergeWith.feedTypes, combinedDeletedIds, priority),
      lines: mergeArraysById(result.lines, mergeWith.lines, combinedDeletedIds, priority),
      batches: mergeArraysById(result.batches, mergeWith.batches, combinedDeletedIds, priority),
      cages: mergeArraysById(result.cages, mergeWith.cages, combinedDeletedIds, priority),
      feedingLogs: mergeArraysById(result.feedingLogs, mergeWith.feedingLogs, combinedDeletedIds, priority),
      feedStockLogs: mergeArraysById(result.feedStockLogs || [], mergeWith.feedStockLogs || [], combinedDeletedIds, priority),
      mortalityLogs: mergeArraysById(result.mortalityLogs, mergeWith.mortalityLogs, combinedDeletedIds, priority),
      biometryLogs: mergeArraysById(result.biometryLogs, mergeWith.biometryLogs, combinedDeletedIds, priority),
      slaughterExpenses: mergeArraysById(result.slaughterExpenses || [], mergeWith.slaughterExpenses || [], combinedDeletedIds, priority),
      slaughterEmployees: mergeArraysById(result.slaughterEmployees || [], mergeWith.slaughterEmployees || [], combinedDeletedIds, priority),
      slaughterHRIndicators: mergeArraysById(result.slaughterHRIndicators || [], mergeWith.slaughterHRIndicators || [], combinedDeletedIds, priority),
      slaughterHREntries: mergeArraysById(result.slaughterHREntries || [], mergeWith.slaughterHREntries || [], combinedDeletedIds, priority),
      slaughterHRVacancies: mergeArraysById(result.slaughterHRVacancies || [], mergeWith.slaughterHRVacancies || [], combinedDeletedIds, priority),
      slaughterSupplyItems: mergeArraysById(result.slaughterSupplyItems || [], mergeWith.slaughterSupplyItems || [], combinedDeletedIds, priority),
      slaughterSuppliers: mergeArraysById(result.slaughterSuppliers || [], mergeWith.slaughterSuppliers || [], combinedDeletedIds, priority),
      slaughterSupplyRequests: mergeArraysById(result.slaughterSupplyRequests || [], mergeWith.slaughterSupplyRequests || [], combinedDeletedIds, priority),
      slaughterPurchaseOrders: mergeArraysById(result.slaughterPurchaseOrders || [], mergeWith.slaughterPurchaseOrders || [], combinedDeletedIds, priority),
      slaughterSupplyInvoices: mergeArraysById(result.slaughterSupplyInvoices || [], mergeWith.slaughterSupplyInvoices || [], combinedDeletedIds, priority),
      slaughterSupplyCategories: (mergeWith.slaughterSupplyCategoriesUpdated || 0) > (result.slaughterSupplyCategoriesUpdated || 0) ? mergeWith.slaughterSupplyCategories : result.slaughterSupplyCategories,
      slaughterSupplyCategoriesUpdated: Math.max(result.slaughterSupplyCategoriesUpdated || 0, mergeWith.slaughterSupplyCategoriesUpdated || 0),
      slaughterExpenseCategories: (mergeWith.slaughterExpenseCategoriesUpdated || 0) > (result.slaughterExpenseCategoriesUpdated || 0) ? mergeWith.slaughterExpenseCategories : result.slaughterExpenseCategories,
      slaughterExpenseCategoriesUpdated: Math.max(result.slaughterExpenseCategoriesUpdated || 0, mergeWith.slaughterExpenseCategoriesUpdated || 0),
      slaughterHREntryTypes: (mergeWith.slaughterHREntryTypesUpdated || 0) > (result.slaughterHREntryTypesUpdated || 0) ? mergeWith.slaughterHREntryTypes : result.slaughterHREntryTypes,
      slaughterHREntryTypesUpdated: Math.max(result.slaughterHREntryTypesUpdated || 0, mergeWith.slaughterHREntryTypesUpdated || 0),
      slaughterHRDepartments: (mergeWith.slaughterHRDepartmentsUpdated || 0) > (result.slaughterHRDepartmentsUpdated || 0) ? mergeWith.slaughterHRDepartments : result.slaughterHRDepartments,
      slaughterHRDepartmentsUpdated: Math.max(result.slaughterHRDepartmentsUpdated || 0, mergeWith.slaughterHRDepartmentsUpdated || 0),
      slaughterHRRoles: (mergeWith.slaughterHRRolesUpdated || 0) > (result.slaughterHRRolesUpdated || 0) ? mergeWith.slaughterHRRoles : result.slaughterHRRoles,
      slaughterHRRolesUpdated: Math.max(result.slaughterHRRolesUpdated || 0, mergeWith.slaughterHRRolesUpdated || 0),
      protocols: mergeArraysById(result.protocols, mergeWith.protocols, combinedDeletedIds, priority),
      standardCurves: mergeArraysById(result.standardCurves || [], mergeWith.standardCurves || [], combinedDeletedIds, priority),
      portfolios: mergeArraysById(result.portfolios || [], mergeWith.portfolios || [], combinedDeletedIds, priority),
      capexProjects: mergeArraysById(result.capexProjects || [], mergeWith.capexProjects || [], combinedDeletedIds, priority),
      capexInvoices: mergeArraysById(result.capexInvoices || [], mergeWith.capexInvoices || [], combinedDeletedIds, priority),
      harvestLogs: mergeArraysById(result.harvestLogs || [], mergeWith.harvestLogs || [], combinedDeletedIds, priority),
      harvestSchedules: mergeArraysById(result.harvestSchedules || [], mergeWith.harvestSchedules || [], combinedDeletedIds, priority),
      batchExpenses: mergeArraysById(result.batchExpenses || [], mergeWith.batchExpenses || [], combinedDeletedIds, priority),
      batchRevenues: mergeArraysById(result.batchRevenues || [], mergeWith.batchRevenues || [], combinedDeletedIds, priority),
      coldStorageLogs: mergeArraysById(result.coldStorageLogs || [], mergeWith.coldStorageLogs || [], combinedDeletedIds, priority),
      utilityLogs: mergeArraysById(result.utilityLogs || [], mergeWith.utilityLogs || [], combinedDeletedIds, priority),
      coldChambers: mergeArraysById(result.coldChambers || [], mergeWith.coldChambers || [], combinedDeletedIds, priority),
      feedingTables: mergeArraysById(result.feedingTables || [], mergeWith.feedingTables || [], combinedDeletedIds, priority),
      costCenters: mergeArraysById(result.costCenters || [], mergeWith.costCenters || [], combinedDeletedIds, priority),
      pcmEquipments: mergeArraysById(result.pcmEquipments || [], mergeWith.pcmEquipments || [], combinedDeletedIds, priority),
      pcmStoppageReasons: mergeArraysById(result.pcmStoppageReasons || [], mergeWith.pcmStoppageReasons || [], combinedDeletedIds, priority),
      pcmProductionStoppages: mergeArraysById(result.pcmProductionStoppages || [], mergeWith.pcmProductionStoppages || [], combinedDeletedIds, priority),
      pcmPlannedImprovements: mergeArraysById(result.pcmPlannedImprovements || [], mergeWith.pcmPlannedImprovements || [], combinedDeletedIds, priority),
      farmTargetCapacity: priority === 'remote' 
        ? (mergeWith.farmTargetCapacity !== undefined ? mergeWith.farmTargetCapacity : result.farmTargetCapacity)
        : (result.farmTargetCapacity !== undefined ? result.farmTargetCapacity : mergeWith.farmTargetCapacity),
    };

    // Note: Removed automatic pruning from here. 
    // Pruning should only happen during safeLocalStorageSetItem to protect the cloud state from truncation.
    return mergedResult;
  }

  return result;
};

/**
 * Força a restauração completa de um estado vindo de um backup JSON.
 * Ignora IDs deletados atuais para permitir que dados antigos sejam recuperados.
 */
export const restoreFromBackup = (backup: AppState): AppState => {
  // Garantir que o backup tenha todos os campos necessários e limpar deletedIds ANTES de processar a integridade
  // para que itens marcados como excluídos no backup NÃO sejam filtrados
  const base = { ...initialState, ...backup, deletedIds: [] };
  
  return {
    ...ensureStateIntegrity(base),
    deletedIds: [], // Reinicia a lista de exclusões
    lastSync: new Date().toISOString()
  };
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
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
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
      safeLocalStorageSetItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
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
    safeLocalStorageSetItem(SESSION_KEY, JSON.stringify(user));
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
  let state = localData ? ensureStateIntegrity(JSON.parse(localData)) : initialState;

  const config = getSupabaseConfig();
  if (config) state.supabaseConfig = config;

  const remote = await fetchRemoteState(state.supabaseConfig);
  if (remote) {
    state = ensureStateIntegrity(state, remote, 'remote');
    safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
};

export const saveState = async (state: AppState, userConfig?: {url: string, key: string}): Promise<void> => {
  const integrityState = ensureStateIntegrity(state);
  safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(integrityState));
  
  const configToUse = userConfig || integrityState.supabaseConfig;
  
  if (configToUse) {
    safeLocalStorageSetItem(SUPABASE_CONFIG_KEY, JSON.stringify(configToUse));
  }

  const supabase = getSupabase(configToUse);
  if (supabase) {
    try {
      const remote = await fetchRemoteState(configToUse);
      const finalState = remote ? ensureStateIntegrity(integrityState, remote, 'local') : integrityState;
      await supabase.from('farm_data').upsert({ id: 'singleton', state: finalState, last_sync: new Date().toISOString() });
    } catch (err) {
      console.error('Erro de sincronização:', err);
    }
  }
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
