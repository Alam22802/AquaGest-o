
import { AppState, User, NotificationSettings, SlaughterLog } from './types';
import { createClient } from '@supabase/supabase-js';

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
  notifyOnWaterCritical: true,
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
  mortalityLogs: [],
  biometryLogs: [],
  waterLogs: [],
  slaughterLogs: [],
  protocols: [],
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
  const baseOrder = priority === 'remote' ? [...safeLocal, ...safeRemote] : [...safeRemote, ...safeLocal];

  baseOrder.forEach(item => {
    if (item && item.id && !deletedIds.includes(item.id)) {
      map.set(item.id, item);
    }
  });

  const allItems = [...safeLocal, ...safeRemote];
  allItems.forEach(item => {
    if (!item || !item.id || deletedIds.includes(item.id)) return;
    const existing = map.get(item.id);
    if (existing) {
      const itemTime = item.updatedAt || 0;
      const existingTime = existing.updatedAt || 0;
      if (itemTime > existingTime) {
        map.set(item.id, item);
      }
    } else {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

export const ensureStateIntegrity = (state: any, mergeWith?: AppState, priority: 'local' | 'remote' = 'remote'): AppState => {
  const combinedDeletedIds = Array.from(new Set([
    ...(state?.deletedIds || []),
    ...(mergeWith?.deletedIds || [])
  ]));

  const base: AppState = {
    ...initialState,
    ...state,
    deletedIds: combinedDeletedIds
  };

  const filterByTombstone = (arr: any[]) => (arr || []).filter(i => !combinedDeletedIds.includes(i.id));

  const result: AppState = {
    ...base,
    users: filterByTombstone(base.users || initialState.users),
    lines: filterByTombstone(base.lines),
    batches: filterByTombstone(base.batches),
    cages: filterByTombstone(base.cages),
    feedTypes: filterByTombstone(base.feedTypes),
    feedingLogs: filterByTombstone(base.feedingLogs),
    mortalityLogs: filterByTombstone(base.mortalityLogs),
    biometryLogs: filterByTombstone(base.biometryLogs),
    waterLogs: filterByTombstone(base.waterLogs),
    slaughterLogs: filterByTombstone(base.slaughterLogs),
    protocols: filterByTombstone(base.protocols),
  };

  if (mergeWith) {
    return {
      ...result,
      users: mergeArraysById(result.users, mergeWith.users, combinedDeletedIds, priority),
      slaughterLogs: mergeArraysById(result.slaughterLogs, mergeWith.slaughterLogs, combinedDeletedIds, priority),
      feedTypes: mergeArraysById(result.feedTypes, mergeWith.feedTypes, combinedDeletedIds, priority),
      lines: mergeArraysById(result.lines, mergeWith.lines, combinedDeletedIds, priority),
      batches: mergeArraysById(result.batches, mergeWith.batches, combinedDeletedIds, priority),
      cages: mergeArraysById(result.cages, mergeWith.cages, combinedDeletedIds, priority),
      feedingLogs: mergeArraysById(result.feedingLogs, mergeWith.feedingLogs, combinedDeletedIds, priority),
      mortalityLogs: mergeArraysById(result.mortalityLogs, mergeWith.mortalityLogs, combinedDeletedIds, priority),
      biometryLogs: mergeArraysById(result.biometryLogs, mergeWith.biometryLogs, combinedDeletedIds, priority),
      waterLogs: mergeArraysById(result.waterLogs, mergeWith.waterLogs, combinedDeletedIds, priority),
      protocols: mergeArraysById(result.protocols, mergeWith.protocols, combinedDeletedIds, priority),
    };
  }
  return result;
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
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
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
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
};

export const saveState = async (state: AppState, userConfig?: {url: string, key: string}): Promise<void> => {
  const integrityState = ensureStateIntegrity(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(integrityState));
  
  const configToUse = userConfig || integrityState.supabaseConfig;
  
  if (configToUse) {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(configToUse));
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
