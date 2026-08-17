
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import LineManagement from './components/LineManagement.tsx';
import BatchManagement from './components/BatchManagement.tsx';
import CageManagement from './components/CageManagement.tsx';
import CageInventory from './components/CageInventory.tsx';
import Maintenance from './components/Maintenance.tsx';
import FeedingLog from './components/FeedingLog.tsx';
import MortalityLog from './components/MortalityLog.tsx';
import BiometryLog from './components/BiometryLog.tsx';
import FeedManagement from './components/FeedManagement.tsx';
import UserManagement from './components/UserManagement.tsx';
import CloudSettings from './components/CloudSettings.tsx';
import ProtocolManagement from './components/ProtocolManagement.tsx';
import CapexManagement from './components/CapexManagement.tsx';
import PCMManagement from './components/PCMManagement.tsx';
import SlaughterHouse from './components/SlaughterHouse.tsx';
import Login from './components/Login.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { loadState, saveState, getSession, saveSession, ensureStateIntegrity, fetchRemoteState, subscribeToRemoteChanges, repairArray, getSupabaseConfig } from './store.ts';
import { AppState, User } from './types.ts';
import { Loader2, RefreshCw, AlertTriangle, X, Cloud, CheckCircle2 } from 'lucide-react';

import { checkAndTriggerAlerts } from './src/services/alertService.ts';

const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingBackground, setIsSyncingBackground] = useState(false);
  const [lastAlertCheck, setLastAlertCheck] = useState(0);
  const [activeAlert, setActiveAlert] = useState<{title: string, message: string} | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState(false);
  
  const isSavingRef = useRef(false);
  const lastSavedStateRef = useRef<AppState | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initApp = useCallback(async () => {
    try {
      let data = await loadState();
      
      // Migration: Inject missing timestamps to ensure sync works for old data
      const inject = (arr: any[]) => (arr || []).map(i => {
        if (typeof i !== 'object' || i === null || !i.id) return i;
        return i.updatedAt ? i : { ...i, updatedAt: 1 };
      });
      // Migration: Update cage models to new definitions cleanly
      const validModels = new Set(['2x2x2', '3x2x2,5', '3x2x2.5', '3x3x3', '4x4x4', 'Circular']);
      const migrateCages = (cages: any[]) => (cages || []).map(c => {
        if (!c || typeof c !== 'object') return c;
        let newModel = c.model;
        const nameLower = (c.name || '').toLowerCase();

        if (nameLower.includes('2x2x2') || nameLower.includes('2x2')) {
          newModel = '2x2x2';
        } else if (nameLower.includes('3x2x2,5') || nameLower.includes('3x2x2.5') || nameLower.includes('3x2')) {
          newModel = '3x2x2,5';
        } else if (nameLower.includes('3x3x3') || nameLower.includes('3x3')) {
          newModel = '3x3x3';
        } else if (nameLower.includes('4x4x4') || nameLower.includes('4x4') || nameLower.includes('6x6')) {
          newModel = '4x4x4';
        } else if (validModels.has(c.model)) {
          if (c.model === '3x2x2.5') newModel = '3x2x2,5';
        } else if (c.model === '4x4' || c.model === '6x6') {
          newModel = '4x4x4';
        } else {
          const { length: l, width: w, depth: d } = c.dimensions || {};
          const dimKey = `${l}x${w}x${d}`;
          if (dimKey === '2x2x2') newModel = '2x2x2';
          else if (dimKey === '3x2x2.5' || dimKey === '3x2x2,5') newModel = '3x2x2,5';
          else if (dimKey === '3x3x3') newModel = '3x3x3';
          else if (dimKey === '4x4x4') newModel = '4x4x4';
        }

        let dimensions = c.dimensions;
        if (!dimensions || typeof dimensions !== 'object' || !dimensions.length || !dimensions.width || !dimensions.depth) {
          if (newModel === '2x2x2') {
            dimensions = { length: 2, width: 2, depth: 2 };
          } else if (newModel === '3x2x2,5') {
            dimensions = { length: 3, width: 2, depth: 2.5 };
          } else if (newModel === '3x3x3') {
            dimensions = { length: 3, width: 3, depth: 3 };
          } else if (newModel === '4x4x4') {
            dimensions = { length: 4, width: 4, depth: 4 };
          }
        }

        if (newModel !== c.model || JSON.stringify(dimensions) !== JSON.stringify(c.dimensions)) {
          return { ...c, model: newModel, dimensions, updatedAt: Date.now() };
        }
        return c;
      });

      // migrateChecklists is not defined here but it was present in previous turns. 
      // I will assume it's part of data cleanup if it existed.
      // Looking at the view_file output, it wasn't there. 

      // Migration: Create cold chambers from existing logs if they don't exist
      const initialChambers = data.coldChambers || [];
      const initialLogs = data.coldStorageLogs || [];
      const migratedChambers = [...initialChambers];
      
      const migratedLogs = initialLogs.map(l => {
        if (l.chamberName && !l.chamberId) {
          // Use a deterministic ID based on the name to avoid duplicates across users
          const deterministicId = `chamber-${l.chamberName.toLowerCase().replace(/\s+/g, '-')}`;
          let chamber = migratedChambers.find(c => c.id === deterministicId || c.name === l.chamberName);
          
          if (!chamber) {
            chamber = {
              id: deterministicId,
              name: l.chamberName,
              updatedAt: Date.now()
            };
            migratedChambers.push(chamber);
          }
          return { ...l, chamberId: chamber.id, time: l.time || '12:00', updatedAt: Date.now() };
        }
        return l;
      });

      data = {
        ...data,
        users: repairArray(inject(data.users)), // repairArray now handles nested allowedTabs too
        lines: inject(data.lines),
        batches: inject(data.batches),
        cages: migrateCages(inject(data.cages)),
        feedTypes: inject(data.feedTypes),
        feedingLogs: inject(data.feedingLogs),
        feedStockLogs: inject(data.feedStockLogs),
        mortalityLogs: inject(data.mortalityLogs),
        biometryLogs: inject(data.biometryLogs),
        slaughterLogs: inject(data.slaughterLogs),
        slaughterExpenses: inject(data.slaughterExpenses || []),
        slaughterEmployees: inject(data.slaughterEmployees || []),
        slaughterHRIndicators: inject(data.slaughterHRIndicators || []),
        slaughterHREntries: inject(data.slaughterHREntries || []),
        slaughterHRVacancies: inject(data.slaughterHRVacancies || []),
        slaughterSupplyItems: inject(data.slaughterSupplyItems || []),
        slaughterSuppliers: inject(data.slaughterSuppliers || []),
        slaughterSupplyRequests: inject(data.slaughterSupplyRequests || []),
        slaughterPurchaseOrders: inject(data.slaughterPurchaseOrders || []),
        slaughterSupplyInvoices: inject(data.slaughterSupplyInvoices || []),
        slaughterExpenseCategories: repairArray(data.slaughterExpenseCategories),
        slaughterHREntryTypes: repairArray(data.slaughterHREntryTypes),
        slaughterHRDepartments: repairArray(data.slaughterHRDepartments),
        slaughterHRRoles: repairArray(data.slaughterHRRoles),
        slaughterSupplyCategories: repairArray(data.slaughterSupplyCategories),
        deletedIds: repairArray(data.deletedIds || []),
        harvestLogs: inject(data.harvestLogs || []),
        harvestSchedules: inject(data.harvestSchedules || []),
        batchExpenses: inject(data.batchExpenses || []),
        batchRevenues: inject(data.batchRevenues || []),
        coldStorageLogs: inject(migratedLogs),
        utilityLogs: inject(data.utilityLogs || []),
        coldChambers: inject(migratedChambers),
        protocols: inject(data.protocols),
        standardCurves: inject(data.standardCurves || []),
        feedingTables: inject(data.feedingTables || []),
        portfolios: inject(data.portfolios),
        capexProjects: inject(data.capexProjects),
        capexInvoices: inject(data.capexInvoices),
        capexPurchaseOrders: inject(data.capexPurchaseOrders || []),
        costCenters: inject(data.costCenters || []),
        pcmEquipments: inject(data.pcmEquipments || []),
        pcmStoppageReasons: inject(data.pcmStoppageReasons || []),
        pcmProductionStoppages: inject(data.pcmProductionStoppages || []),
        pcmPlannedImprovements: inject(data.pcmPlannedImprovements || []),
      };

      // 1. Sempre buscar o estado canônico do servidor/nuvem na inicialização
      setIsSyncingBackground(true);
      try {
        const initialConfig = data.supabaseConfig || getSupabaseConfig();
        const remote = await fetchRemoteState(initialConfig);
        if (remote) {
          const merged = ensureStateIntegrity(data, remote, 'remote');
          data = merged;
          if (remote.supabaseConfig) {
            saveSupabaseConfig(remote.supabaseConfig);
          }
        }
      } catch (syncErr) {
        console.warn('Erro na sincronização inicial:', syncErr);
      } finally {
        setIsSyncingBackground(false);
      }

      setState(data);
      lastSavedStateRef.current = data;
      
      const savedUser = getSession();
      if (savedUser) {
        const updatedUser = data.users.find(u => u.id === savedUser.id || (savedUser.username && u.username.toLowerCase() === savedUser.username.toLowerCase()));
        
        const now = Date.now();
        const lastAccess = updatedUser?.lastLoginAt 
          ? new Date(updatedUser.lastLoginAt).getTime() 
          : (updatedUser?.updatedAt || now);
        const daysInactive = (now - lastAccess) / (1000 * 60 * 60 * 24);
        const isBlockedInactive = updatedUser && !updatedUser.isMaster && (updatedUser.blockedDueToInactivity || daysInactive > 30);

        if (updatedUser && (updatedUser.isApproved || updatedUser.isMaster) && !isBlockedInactive) {
          const nowIso = new Date().toISOString();
          const activeUser = { ...updatedUser, lastSync: nowIso, updatedAt: Date.now() };
          setCurrentUser(activeUser);
          saveSession(activeUser);
          data = {
            ...data,
            lastSync: nowIso,
            users: data.users.map(u => u.id === activeUser.id ? activeUser : u)
          };
          const configToUse = data.supabaseConfig || getSupabaseConfig();
          saveState(data, configToUse).catch(() => {});
        } else {
          if (isBlockedInactive && updatedUser) {
            data = {
              ...data,
              users: data.users.map(u => u.id === updatedUser.id ? { ...u, blockedDueToInactivity: true, updatedAt: Date.now() } : u)
            };
          }
          setCurrentUser(null);
          saveSession(null);
        }
      }
    } catch (err) {
      console.error('Erro ao inicializar app:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const backgroundSync = useCallback(async () => {
    if (!state || isSyncingBackground || isSavingRef.current) return;
    
    setIsSyncingBackground(true);
    try {
      const configToUse = state.supabaseConfig || currentUser?.supabaseConfig || getSupabaseConfig();
      const remote = await fetchRemoteState(configToUse);
      
      if (remote) {
        const merged = ensureStateIntegrity(state, remote, 'remote');
        const nowIso = new Date().toISOString();
        
        const updatedUsers = merged.users.map(u => 
          currentUser && (u.id === currentUser.id || (currentUser.username && u.username === currentUser.username))
            ? { ...u, lastSync: nowIso, updatedAt: Math.max(Number(u.updatedAt) || 0, Date.now()) } 
            : u
        );
        
        const finalMerged = { ...merged, lastSync: nowIso, users: updatedUsers };

        // If nothing changed in the merge and timestamps are equal, avoid unnecessary re-renders
        if (areStatesEqual(state, finalMerged)) {
          setIsSyncingBackground(false);
          return;
        }

        setState(finalMerged);
        lastSavedStateRef.current = finalMerged;
      }
    } catch (err) {
      console.warn('Erro na sincronização de background:', err);
    } finally {
      setIsSyncingBackground(false);
    }
  }, [state, currentUser, isSyncingBackground]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expParam = params.get('s_exp');
    if (expParam) {
      const expTime = Number(expParam);
      if (!isNaN(expTime) && Date.now() > expTime) {
        const expiredDate = new Date(expTime).toLocaleString('pt-BR');
        setActiveAlert({
          title: 'Link de Convite Expirado',
          message: `O link de convite acessado possuía validade de 24 horas e venceu em ${expiredDate}. Solicite um novo link ao administrador para vincular o aplicativo.`
        });
      }
    }
    initApp();
  }, [initApp]);

  // Realtime Subscription
  useEffect(() => {
    if (!state || isLoading) return;

    const configToUse = state.supabaseConfig || currentUser?.supabaseConfig || getSupabaseConfig();
    if (!configToUse) return;

    const unsubscribe = subscribeToRemoteChanges(configToUse, (remoteState) => {
      // Don't skip updates, merge carefully with remote priority
      setState(prev => {
        if (!prev) return remoteState;
        
        const merged = ensureStateIntegrity(prev, remoteState, 'remote');
        lastSavedStateRef.current = merged;
        return merged;
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.supabaseConfig, state?.supabaseConfig, isLoading]);

  useEffect(() => {
    if (state && !isLoading) {
      // Avoid saving if state hasn't changed from what we last saved or loaded
      if (lastSavedStateRef.current === state) return;

      // Debounce saving
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      isSavingRef.current = true; // Mark as saving/dirty immediately to protect local state
      saveTimeoutRef.current = setTimeout(() => {
        const configToUse = state.supabaseConfig || currentUser?.supabaseConfig || getSupabaseConfig();
        
        saveState(state, configToUse).then((finalState) => {
          if (finalState) {
            lastSavedStateRef.current = finalState;
            setState(prev => prev ? ensureStateIntegrity(prev, finalState, 'local') : finalState);
          }
        }).finally(() => {
          isSavingRef.current = false;
        });
      }, 500); 

      // Verificar alertas
      const now = Date.now();
      if (now - lastAlertCheck > 300000) {
        const alert = checkAndTriggerAlerts(state);
        if (alert) {
          setActiveAlert(alert);
          setTimeout(() => setActiveAlert(null), 10000);
        }
        setLastAlertCheck(now);
      }
    }
    
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, isLoading, lastAlertCheck, currentUser?.supabaseConfig]);

  useEffect(() => {
    if (state && currentUser) {
      const updatedUser = state.users.find(u => u.id === currentUser.id || (currentUser.username && u.username.toLowerCase() === currentUser.username.toLowerCase()));
      
      if (!updatedUser || (!updatedUser.isApproved && !updatedUser.isMaster)) {
        handleLogout();
        alert("Sua sessão foi encerrada porque sua conta foi excluída ou desativada no sistema.");
      } else if (!updatedUser.isMaster && updatedUser.blockedDueToInactivity) {
        handleLogout();
        alert("Sua conta foi bloqueada por inatividade (> 30 dias). Solicite a liberação ao administrador.");
      } else {
        const needsPermissionSync = 
          updatedUser.canEdit !== currentUser.canEdit ||
          updatedUser.isMaster !== currentUser.isMaster ||
          updatedUser.name !== currentUser.name ||
          updatedUser.email !== currentUser.email ||
          JSON.stringify(updatedUser.allowedTabs) !== JSON.stringify(currentUser.allowedTabs);

        if (needsPermissionSync) {
          const merged = { ...currentUser, ...updatedUser };
          setCurrentUser(merged);
          saveSession(merged);
        }
      }
    }
  }, [state?.users, currentUser]);

  // Deslogar usuários sem movimentação na página por mais de 10 minutos
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        setInactivityNotice(true);
      }, 10 * 60 * 1000); // 10 minutos sem atividade
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [currentUser]);

  useEffect(() => {
    (window as any).forceSync = backgroundSync;
    return () => { delete (window as any).forceSync; };
  }, [backgroundSync]);

  useEffect(() => {
    const handleSyncTrigger = () => {
      if (document.visibilityState === 'visible') {
        backgroundSync();
      }
    };

    window.addEventListener('focus', handleSyncTrigger);
    document.addEventListener('visibilitychange', handleSyncTrigger);

    const interval = setInterval(() => {
      handleSyncTrigger();
    }, 15000); // 15s sync interval for continuous synchronization across all devices

    return () => {
      window.removeEventListener('focus', handleSyncTrigger);
      document.removeEventListener('visibilitychange', handleSyncTrigger);
      clearInterval(interval);
    };
  }, [backgroundSync]);

  useEffect(() => {
    if (currentUser && !currentUser.isMaster && activeTab !== 'dashboard') {
      const allowedTabs = currentUser.allowedTabs || [];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, currentUser]);

  const handleStateUpdate = useCallback((update: Partial<AppState>) => {
    setState(prev => {
      if (!prev) return prev;

      // Detect which keys actually changed
      const changedKeys = (Object.keys(update) as Array<keyof AppState>).filter(key => update[key] !== (prev as any)[key]);
      if (changedKeys.length === 0) return prev;

      const ensureTimestamps = (newList: any[], oldList: any[]) => {
        if (newList === oldList) return oldList;
        
        // Skip for primitive arrays
        if (!newList) return oldList || [];
        if (newList.length === 0 && oldList && oldList.length > 0 && typeof oldList[0] === 'object' && oldList[0] !== null && oldList[0].id) {
          return [];
        }
        if (typeof newList[0] !== 'object' || newList[0] === null || !newList[0].id) return newList;

        let anyChanged = (oldList || []).length !== (newList || []).length;
        const oldMap = new Map((oldList || []).filter(i => i && i.id).map(item => [item.id, item]));
        
        const processedList = newList.map(item => {
          if (!item || !item.id) return item;
          const oldItem = oldMap.get(item.id);
          if (!oldItem) {
            anyChanged = true;
            return { ...item, updatedAt: item.updatedAt || Date.now() };
          }
          
          let itemChanged = false;
          // Compare object fields
          const keys = new Set([...Object.keys(item), ...Object.keys(oldItem)]);
          for (const k of keys) {
            if (k === 'updatedAt' || k === 'lastSync') continue;
            const v1 = (item as any)[k];
            const v2 = (oldItem as any)[k];
            if (JSON.stringify(v1) !== JSON.stringify(v2)) {
              itemChanged = true;
              break;
            }
          }
          
          if (itemChanged) {
            anyChanged = true;
            return { ...item, updatedAt: Date.now() };
          }
          return item; 
        });

        return anyChanged ? processedList : (oldList || []);
      };

      const newState = { ...prev };
      let actuallyChanged = false;
      const newlyDeletedIds: string[] = [];

      changedKeys.forEach(key => {
        const newVal = update[key];
        const oldVal = (prev as any)[key];

        if (Array.isArray(newVal) && Array.isArray(oldVal)) {
          // Detect deleted items by ID to create tombstones
          if (oldVal.length > 0 && typeof oldVal[0] === 'object' && oldVal[0] !== null && oldVal[0].id) {
            const newIdSet = new Set((newVal || []).filter(item => item && typeof item === 'object' && item.id).map(item => item.id));
            oldVal.forEach(item => {
              if (item && typeof item === 'object' && item.id && !newIdSet.has(item.id)) {
                newlyDeletedIds.push(item.id);
              }
            });
          }

          const processedList = ensureTimestamps(newVal, oldVal);
          if (processedList !== oldVal) {
            (newState as any)[key] = processedList;
            actuallyChanged = true;
          }
        } else if (newVal !== oldVal) {
          (newState as any)[key] = newVal;
          actuallyChanged = true;
        }
      });

      if (!actuallyChanged && newlyDeletedIds.length === 0) return prev;

      const combinedDeletedIds = Array.from(new Set([
        ...(prev.deletedIds || []),
        ...(newState.deletedIds || []),
        ...newlyDeletedIds
      ]));
      newState.deletedIds = combinedDeletedIds;

      const merged = ensureStateIntegrity(newState, undefined, 'local');
      return merged;
    });
  }, []);

  const handleLogin = useCallback(async (user: User) => {
    setCurrentUser(user);
    saveSession(user);
    
    // Sincronizar imediatamente após o login buscando estado canônico do servidor/nuvem
    setIsSyncingBackground(true);
    try {
      const configToUse = user.supabaseConfig || state?.supabaseConfig || getSupabaseConfig();
      const remote = await fetchRemoteState(configToUse);
      if (remote) {
        setState(prev => {
          if (!prev) return remote;
          const merged = ensureStateIntegrity(prev, remote, 'remote');
          lastSavedStateRef.current = merged;
          return merged;
        });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar após login:', err);
    } finally {
      setIsSyncingBackground(false);
    }
  }, [state]);

  const handleLogout = () => {
    setCurrentUser(null);
    saveSession(null);
    setActiveTab('dashboard');
  };

  const handleLoginSync = useCallback(async () => {
    try {
      const configToUse = state?.supabaseConfig || getSupabaseConfig();
      const remote = await fetchRemoteState(configToUse);
      if (remote) {
        const localState = state || await loadState();
        const mergedState = ensureStateIntegrity(localState, remote, 'remote');
        setState(mergedState);
        lastSavedStateRef.current = mergedState;
        return mergedState;
      }
    } catch (err) {
      console.warn('Erro ao sincronizar login:', err);
    }
    return state;
  }, [state]);

  const handleRegister = useCallback(async (u: User) => {
    const userWithTimestamp = { ...u, updatedAt: Date.now() };

    // Update local state immediately
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, users: [...prev.users, userWithTimestamp] };
    });

    // Force an immediate save to Supabase
    const configToUse = state?.supabaseConfig || getSupabaseConfig();
    if (configToUse && state) {
      try {
        const stateToSave = { ...state, users: [...state.users, userWithTimestamp] };
        await saveState(stateToSave, configToUse);
        console.log('Registro salvo na nuvem com sucesso');
      } catch (err) {
        console.error('Erro ao salvar registro na nuvem:', err);
      }
    }
  }, [state]);

  useEffect(() => {
    if (state && currentUser?.isMaster) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const batchesToCleanup = (state.batches || []).filter(b => 
        b.isClosed && b.closedAt && new Date(b.closedAt) < ninetyDaysAgo
      );

      if (batchesToCleanup.length > 0) {
        const batchIdsToRemoveArray = batchesToCleanup.map(b => b.id);
        const batchIdsToRemove = new Set(batchIdsToRemoveArray);

        const feedingLogsToRemove = (state.feedingLogs || []).filter((f) => batchIdsToRemove.has(f.batchId || '')).map(f => f.id);
        const mortalityLogsToRemove = (state.mortalityLogs || []).filter((m) => batchIdsToRemove.has(m.batchId || '')).map(m => m.id);
        const biometryLogsToRemove = (state.biometryLogs || []).filter((b) => batchIdsToRemove.has(b.batchId || '')).map(b => b.id);
        const harvestLogsToRemove = (state.harvestLogs || []).filter((h) => batchIdsToRemove.has(h.batchId)).map(h => h.id);
        const batchExpensesToRemove = (state.batchExpenses || []).filter((e) => batchIdsToRemove.has(e.batchId)).map(e => e.id);
        const batchRevenuesToRemove = (state.batchRevenues || []).filter((r) => batchIdsToRemove.has(r.batchId)).map(r => r.id);
        const harvestSchedulesToRemove = (state.harvestSchedules || []).filter((hs) => batchIdsToRemove.has(hs.batchId)).map(hs => hs.id);

        const allRemovedIds = [
          ...batchIdsToRemoveArray,
          ...feedingLogsToRemove,
          ...mortalityLogsToRemove,
          ...biometryLogsToRemove,
          ...harvestLogsToRemove,
          ...batchExpensesToRemove,
          ...batchRevenuesToRemove,
          ...harvestSchedulesToRemove,
        ];

        const newState: AppState = {
          ...state,
          batches: (state.batches || []).filter(b => !batchIdsToRemove.has(b.id)),
          feedingLogs: (state.feedingLogs || []).filter(l => !batchIdsToRemove.has(l.batchId || '')),
          mortalityLogs: (state.mortalityLogs || []).filter(l => !batchIdsToRemove.has(l.batchId || '')),
          biometryLogs: (state.biometryLogs || []).filter(l => !batchIdsToRemove.has(l.batchId || '')),
          harvestLogs: (state.harvestLogs || []).filter(l => !batchIdsToRemove.has(l.batchId)),
          harvestSchedules: (state.harvestSchedules || []).filter(l => !batchIdsToRemove.has(l.batchId)),
          batchExpenses: (state.batchExpenses || []).filter(l => !batchIdsToRemove.has(l.batchId)),
          batchRevenues: (state.batchRevenues || []).filter(l => !batchIdsToRemove.has(l.batchId)),
          slaughterLogs: state.slaughterLogs || [],
          cages: (state.cages || []).map(c => c.batchId && batchIdsToRemove.has(c.batchId) ? { ...c, batchId: undefined, initialFishCount: undefined, settlementDate: undefined, harvestDate: undefined } : c),
          deletedIds: Array.from(new Set([...(state.deletedIds || []), ...allRemovedIds]))
        };

        handleStateUpdate(newState);
        console.log(`Sistema: Limpeza automática realizada para ${batchesToCleanup.length} lotes arquivados há mais de 90 dias.`);
      }
    }
  }, [state, currentUser, handleStateUpdate]);

  const renderContent = () => {
    if (!state || !currentUser) return null;
    switch (activeTab) {
      case 'dashboard': return <Dashboard state={state} />;
      case 'capex': return <CapexManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'inventory': return <CageInventory state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'maintenance': return <Maintenance state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'protocols': return <ProtocolManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'batches': return <BatchManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'lines': return <LineManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'cages': return <CageManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'feed': return <FeedManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'feeding': return <FeedingLog state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'biometry': return <BiometryLog state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'mortality': return <MortalityLog state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'slaughter': return <SlaughterHouse state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'pcm': return <PCMManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'users': return <UserManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'cloud': return <CloudSettings state={state} onUpdate={handleStateUpdate} currentUser={currentUser} onSync={backgroundSync} isSyncing={isSyncingBackground} />;
      default: return <Dashboard state={state} />;
    }
  };

  if (isLoading || !state) {
    return (
      <div className="min-h-screen bg-[#1a1f1a] flex flex-col items-center justify-center text-[#e4e4d4]">
        <Loader2 className="w-12 h-12 text-[#e4e4d4] animate-spin mb-4 opacity-40" />
        <h2 className="text-xl font-black tracking-widest uppercase italic opacity-80">AquaGestão</h2>
        {!state && !isLoading && (
          <div className="mt-4 text-center">
            <p className="text-xs text-red-400 mb-2">Erro ao carregar os dados.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest">Recarregar</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {isSyncingBackground ? (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow-sm border-emerald-100 flex items-center gap-2 pointer-events-none">
          <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Sincronizando...</span>
        </div>
      ) : (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] bg-white/40 backdrop-blur px-3 py-1 rounded-full shadow-sm border border-emerald-100/50 flex items-center gap-2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity print:hidden">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Nuvem Ativa</span>
        </div>
      )}
      {activeAlert && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-4 rounded-3xl shadow-2xl border border-red-500 flex items-start gap-4 animate-in slide-in-from-bottom-10 duration-500 max-w-md w-[90%] print:hidden">
          <div className="p-2 bg-white/20 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black uppercase tracking-tighter italic">{activeAlert.title}</h4>
            <p className="text-[10px] font-bold opacity-90 uppercase leading-relaxed mt-1">{activeAlert.message}</p>
          </div>
          <button onClick={() => setActiveAlert(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {!currentUser ? (
        <div className="relative">
          {inactivityNotice && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-amber-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 max-w-md w-[90%] border border-amber-500 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-200" />
                <span className="text-xs font-bold uppercase tracking-wider leading-snug">
                  Sessão encerrada após 10 minutos sem atividade na página para garantir a sincronização. Faça login novamente.
                </span>
              </div>
              <button onClick={() => setInactivityNotice(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <Login state={state!} onLogin={(u) => { setInactivityNotice(false); handleLogin(u); }} onRegister={handleRegister} onUpdateState={handleStateUpdate} onSync={handleLoginSync} />
        </div>
      ) : (
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout} state={state!}>
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </Layout>
      )}
    </>
  );
};

export default App;
