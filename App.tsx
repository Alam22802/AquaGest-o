
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
import { loadState, saveState, getSession, saveSession, ensureStateIntegrity, fetchRemoteState, subscribeToRemoteChanges } from './store.ts';
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
  
  const isSavingRef = useRef(false);
  const lastSavedStateRef = useRef<AppState | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initApp = useCallback(async () => {
    try {
      let data = await loadState();
      
      // Migration: Inject missing timestamps to ensure sync works for old data
      const inject = (arr: any[]) => (arr || []).map(i => i.updatedAt ? i : { ...i, updatedAt: Date.now() });
      // Migration: Update cage models to new definitions
      const migrateCages = (cages: any[]) => (cages || []).map(c => {
        const { length: l, width: w, depth: d } = c.dimensions || {};
        const dimKey = `${l}x${w}x${d}`;
        let newModel = c.model;
        
        if (dimKey === '2x2x2') newModel = '2x2x2';
        else if (dimKey === '3x2x2.5') newModel = '3x2x2,5';
        else if (dimKey === '3x3x3') newModel = '3x3x3';
        else if (dimKey === '4x4x4') newModel = '4x4x4';
        else if (c.model === '4x4') newModel = '4x4x4'; // Fallback for old 4x4
        else if (c.model === '6x6') newModel = '4x4x4'; // Fallback for old 6x6 (as requested it doesn't exist)
        
        if (newModel !== c.model) {
          return { ...c, model: newModel, updatedAt: Date.now() };
        }
        return c;
      });

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
        users: inject(data.users),
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
        costCenters: inject(data.costCenters || []),
        pcmEquipments: inject(data.pcmEquipments || []),
        pcmStoppageReasons: inject(data.pcmStoppageReasons || []),
        pcmProductionStoppages: inject(data.pcmProductionStoppages || []),
        pcmPlannedImprovements: inject(data.pcmPlannedImprovements || []),
      };

      setState(data);
      lastSavedStateRef.current = data;
      
      const savedUser = getSession();
      if (savedUser) {
        const updatedUser = data.users.find(u => u.id === savedUser.id);
        if (updatedUser && updatedUser.isApproved) {
          setCurrentUser(updatedUser);
          
          // Se o usuário tem uma config diferente da global, forçar um sync remoto agora
          if (updatedUser.supabaseConfig && 
              (updatedUser.supabaseConfig.url !== data.supabaseConfig?.url || 
               updatedUser.supabaseConfig.key !== data.supabaseConfig?.key)) {
             setIsSyncingBackground(true);
             const remote = await fetchRemoteState(updatedUser.supabaseConfig);
             if (remote) {
               const merged = ensureStateIntegrity(data, remote, 'remote');
               setState(merged);
               lastSavedStateRef.current = merged;
             }
             setIsSyncingBackground(false);
          }
        } else if (updatedUser && !updatedUser.isApproved) {
          setCurrentUser(null);
          saveSession(null);
        } else {
           setCurrentUser(savedUser);
        }
      }
    } catch (err) {
      console.error('Erro ao inicializar app:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const backgroundSync = useCallback(async () => {
    if (!state || !currentUser || isSyncingBackground || isSavingRef.current) return;
    
    setIsSyncingBackground(true);
    try {
      const configToUse = state.supabaseConfig || currentUser.supabaseConfig;
      const remote = await fetchRemoteState(configToUse);
      
      if (remote) {
        // Simple check to avoid unnecessary updates if remote is same as local
        if (lastSavedStateRef.current && JSON.stringify(remote) === JSON.stringify(lastSavedStateRef.current)) {
          setIsSyncingBackground(false);
          return;
        }

        const merged = ensureStateIntegrity(state, remote, 'remote');
        
        const updatedUsers = merged.users.map(u => 
          u.id === currentUser.id ? { ...u, lastSync: new Date().toISOString() } : u
        );
        
        const finalState = { ...merged, users: updatedUsers };
        setState(finalState);
        lastSavedStateRef.current = merged;
      }
    } catch (err) {
      console.warn('Erro na sincronização de background:', err);
    } finally {
      setIsSyncingBackground(false);
    }
  }, [state, currentUser, isSyncingBackground]);

  useEffect(() => { initApp(); }, [initApp]);

  // Realtime Subscription
  useEffect(() => {
    if (!state || !currentUser || isLoading) return;

    const configToUse = state.supabaseConfig || currentUser.supabaseConfig;
    if (!configToUse) return;

    const unsubscribe = subscribeToRemoteChanges(configToUse, (remoteState) => {
      if (isSavingRef.current) return;

      setState(prev => {
        if (!prev) return remoteState;
        
        const merged = ensureStateIntegrity(prev, remoteState, 'remote');
        lastSavedStateRef.current = remoteState;
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
        const configToUse = state.supabaseConfig || currentUser?.supabaseConfig;
        
        saveState(state, configToUse).then(() => {
          lastSavedStateRef.current = state;
        }).finally(() => {
          isSavingRef.current = false;
        });
      }, 2000); 

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
      const updatedUser = state.users.find(u => u.id === currentUser.id);
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(updatedUser);
        saveSession(updatedUser);
      }
    }
  }, [state, currentUser]);

  useEffect(() => {
    const interval = setInterval(backgroundSync, 30000); 
    return () => clearInterval(interval);
  }, [backgroundSync]);

  useEffect(() => {
    if (currentUser && !currentUser.isMaster && activeTab !== 'dashboard') {
      const allowedTabs = currentUser.allowedTabs || [];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, currentUser]);

  const handleStateUpdate = useCallback((newState: AppState) => {
    setState(prev => {
      if (!prev) return newState;

      // Optimized timestamp injection: only for items that actually changed
      const injectTimestamps = (oldList: any[], newList: any[]) => {
        if (oldList === newList) return oldList;
        
        const oldMap = new Map((oldList || []).map(i => [i.id, i]));
        let listChanged = (oldList || []).length !== (newList || []).length;
        
        const updatedList = (newList || []).map(item => {
          const oldItem = oldMap.get(item.id);
          if (!oldItem) {
            listChanged = true;
            return { ...item, updatedAt: Date.now() };
          }
          
          let hasChanged = false;
          const keys = Object.keys(item) as (keyof typeof item)[];
          for (const key of keys) {
            if (key === 'updatedAt') continue;
            if ((item as any)[key] !== (oldItem as any)[key]) {
              hasChanged = true;
              break;
            }
          }
          
          if (hasChanged) {
            listChanged = true;
            return { ...item, updatedAt: Date.now() };
          }
          return oldItem;
        });

        return listChanged ? updatedList : oldList;
      };

      const stateWithTimestamps: AppState = {
        ...newState,
        users: injectTimestamps(prev.users, newState.users),
        lines: injectTimestamps(prev.lines, newState.lines),
        batches: injectTimestamps(prev.batches, newState.batches),
        cages: injectTimestamps(prev.cages, newState.cages),
        feedTypes: injectTimestamps(prev.feedTypes, newState.feedTypes),
        feedingLogs: injectTimestamps(prev.feedingLogs, newState.feedingLogs),
        feedStockLogs: injectTimestamps(prev.feedStockLogs, newState.feedStockLogs),
        mortalityLogs: injectTimestamps(prev.mortalityLogs, newState.mortalityLogs),
        biometryLogs: injectTimestamps(prev.biometryLogs, newState.biometryLogs),
        slaughterLogs: injectTimestamps(prev.slaughterLogs, newState.slaughterLogs),
        slaughterExpenses: injectTimestamps(prev.slaughterExpenses || [], newState.slaughterExpenses || []),
        slaughterEmployees: injectTimestamps(prev.slaughterEmployees || [], newState.slaughterEmployees || []),
        slaughterHRIndicators: injectTimestamps(prev.slaughterHRIndicators || [], newState.slaughterHRIndicators || []),
        slaughterHREntries: injectTimestamps(prev.slaughterHREntries || [], newState.slaughterHREntries || []),
        slaughterHRVacancies: injectTimestamps(prev.slaughterHRVacancies || [], newState.slaughterHRVacancies || []),
        slaughterSupplyItems: injectTimestamps(prev.slaughterSupplyItems || [], newState.slaughterSupplyItems || []),
        slaughterSuppliers: injectTimestamps(prev.slaughterSuppliers || [], newState.slaughterSuppliers || []),
        slaughterSupplyRequests: injectTimestamps(prev.slaughterSupplyRequests || [], newState.slaughterSupplyRequests || []),
        slaughterPurchaseOrders: injectTimestamps(prev.slaughterPurchaseOrders || [], newState.slaughterPurchaseOrders || []),
        slaughterSupplyInvoices: injectTimestamps(prev.slaughterSupplyInvoices || [], newState.slaughterSupplyInvoices || []),
        harvestLogs: injectTimestamps(prev.harvestLogs || [], newState.harvestLogs || []),
        harvestSchedules: injectTimestamps(prev.harvestSchedules || [], newState.harvestSchedules || []),
        batchExpenses: injectTimestamps(prev.batchExpenses || [], newState.batchExpenses || []),
        batchRevenues: injectTimestamps(prev.batchRevenues || [], newState.batchRevenues || []),
        coldStorageLogs: injectTimestamps(prev.coldStorageLogs || [], newState.coldStorageLogs || []),
        utilityLogs: injectTimestamps(prev.utilityLogs || [], newState.utilityLogs || []),
        coldChambers: injectTimestamps(prev.coldChambers || [], newState.coldChambers || []),
        protocols: injectTimestamps(prev.protocols, newState.protocols),
        standardCurves: injectTimestamps(prev.standardCurves || [], newState.standardCurves || []),
        feedingTables: injectTimestamps(prev.feedingTables || [], newState.feedingTables || []),
        portfolios: injectTimestamps(prev.portfolios, newState.portfolios),
        capexProjects: injectTimestamps(prev.capexProjects, newState.capexProjects),
        capexInvoices: injectTimestamps(prev.capexInvoices, newState.capexInvoices),
        costCenters: injectTimestamps(prev.costCenters || [], newState.costCenters || []),
        pcmEquipments: injectTimestamps(prev.pcmEquipments || [], newState.pcmEquipments || []),
        pcmStoppageReasons: injectTimestamps(prev.pcmStoppageReasons || [], newState.pcmStoppageReasons || []),
        pcmProductionStoppages: injectTimestamps(prev.pcmProductionStoppages || [], newState.pcmProductionStoppages || []),
        pcmPlannedImprovements: injectTimestamps(prev.pcmPlannedImprovements || [], newState.pcmPlannedImprovements || []),
        slaughterHRRolesUpdated: JSON.stringify(prev.slaughterHRRoles) !== JSON.stringify(newState.slaughterHRRoles) ? Date.now() : prev.slaughterHRRolesUpdated,
        slaughterHRDepartmentsUpdated: JSON.stringify(prev.slaughterHRDepartments) !== JSON.stringify(newState.slaughterHRDepartments) ? Date.now() : prev.slaughterHRDepartmentsUpdated,
        slaughterHREntryTypesUpdated: JSON.stringify(prev.slaughterHREntryTypes) !== JSON.stringify(newState.slaughterHREntryTypes) ? Date.now() : prev.slaughterHREntryTypesUpdated,
        slaughterExpenseCategoriesUpdated: JSON.stringify(prev.slaughterExpenseCategories) !== JSON.stringify(newState.slaughterExpenseCategories) ? Date.now() : prev.slaughterExpenseCategoriesUpdated,
        slaughterSupplyCategoriesUpdated: JSON.stringify(prev.slaughterSupplyCategories) !== JSON.stringify(newState.slaughterSupplyCategories) ? Date.now() : prev.slaughterSupplyCategoriesUpdated,
      };

      const findDeleted = (oldList: any[], newList: any[]) => {
        if (!oldList || !newList || oldList === newList) return [];
        const newIds = new Set(newList.map(i => i.id));
        return oldList.filter(i => i && i.id && !newIds.has(i.id)).map(i => i.id);
      };

      const deleted = [
        ...findDeleted(prev.users, stateWithTimestamps.users),
        ...findDeleted(prev.lines, stateWithTimestamps.lines),
        ...findDeleted(prev.batches, stateWithTimestamps.batches),
        ...findDeleted(prev.cages, stateWithTimestamps.cages),
        ...findDeleted(prev.feedTypes, stateWithTimestamps.feedTypes),
        ...findDeleted(prev.feedingLogs, stateWithTimestamps.feedingLogs),
        ...findDeleted(prev.feedStockLogs, stateWithTimestamps.feedStockLogs),
        ...findDeleted(prev.mortalityLogs, stateWithTimestamps.mortalityLogs),
        ...findDeleted(prev.biometryLogs, stateWithTimestamps.biometryLogs),
        ...findDeleted(prev.slaughterLogs, stateWithTimestamps.slaughterLogs),
        ...findDeleted(prev.slaughterExpenses || [], stateWithTimestamps.slaughterExpenses || []),
        ...findDeleted(prev.slaughterEmployees || [], stateWithTimestamps.slaughterEmployees || []),
        ...findDeleted(prev.slaughterHRIndicators || [], stateWithTimestamps.slaughterHRIndicators || []),
        ...findDeleted(prev.slaughterHREntries || [], stateWithTimestamps.slaughterHREntries || []),
        ...findDeleted(prev.slaughterHRVacancies || [], stateWithTimestamps.slaughterHRVacancies || []),
        ...findDeleted(prev.slaughterSupplyItems || [], stateWithTimestamps.slaughterSupplyItems || []),
        ...findDeleted(prev.slaughterSuppliers || [], stateWithTimestamps.slaughterSuppliers || []),
        ...findDeleted(prev.slaughterSupplyRequests || [], stateWithTimestamps.slaughterSupplyRequests || []),
        ...findDeleted(prev.slaughterPurchaseOrders || [], stateWithTimestamps.slaughterPurchaseOrders || []),
        ...findDeleted(prev.slaughterSupplyInvoices || [], stateWithTimestamps.slaughterSupplyInvoices || []),
        ...findDeleted(prev.harvestLogs || [], stateWithTimestamps.harvestLogs || []),
        ...findDeleted(prev.harvestSchedules || [], stateWithTimestamps.harvestSchedules || []),
        ...findDeleted(prev.batchExpenses || [], stateWithTimestamps.batchExpenses || []),
        ...findDeleted(prev.batchRevenues || [], stateWithTimestamps.batchRevenues || []),
        ...findDeleted(prev.coldStorageLogs || [], stateWithTimestamps.coldStorageLogs || []),
        ...findDeleted(prev.utilityLogs || [], stateWithTimestamps.utilityLogs || []),
        ...findDeleted(prev.coldChambers || [], stateWithTimestamps.coldChambers || []),
        ...findDeleted(prev.protocols, stateWithTimestamps.protocols),
        ...findDeleted(prev.standardCurves || [], stateWithTimestamps.standardCurves || []),
        ...findDeleted(prev.feedingTables || [], stateWithTimestamps.feedingTables || []),
        ...findDeleted(prev.portfolios, stateWithTimestamps.portfolios),
        ...findDeleted(prev.capexProjects, stateWithTimestamps.capexProjects),
        ...findDeleted(prev.capexInvoices, stateWithTimestamps.capexInvoices),
        ...findDeleted(prev.costCenters || [], stateWithTimestamps.costCenters || []),
        ...findDeleted(prev.pcmEquipments || [], stateWithTimestamps.pcmEquipments || []),
        ...findDeleted(prev.pcmStoppageReasons || [], stateWithTimestamps.pcmStoppageReasons || []),
        ...findDeleted(prev.pcmProductionStoppages || [], stateWithTimestamps.pcmProductionStoppages || []),
        ...findDeleted(prev.pcmPlannedImprovements || [], stateWithTimestamps.pcmPlannedImprovements || []),
      ];

      if (deleted.length > 0) {
        const updatedDeletedIds = Array.from(new Set([...(prev.deletedIds || []), ...deleted]));
        return { ...stateWithTimestamps, deletedIds: updatedDeletedIds };
      }
      return stateWithTimestamps;
    });
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    saveSession(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveSession(null);
    setActiveTab('dashboard');
  };

  const handleRegister = useCallback(async (u: User) => {
    // Update local state immediately
    setState(prev => {
      if (!prev) return prev;
      const newState = { ...prev, users: [...prev.users, u] };
      // Manually inject timestamp for the new user
      const usersWithTimestamp = newState.users.map(user => 
        user.id === u.id ? { ...user, updatedAt: Date.now() } : user
      );
      return { ...newState, users: usersWithTimestamp };
    });

    // Force an immediate save to Supabase
    // We fetch the latest state from the ref if possible, or just use what we have
    // Actually, saveState already fetches remote and merges, so it's safe.
    const configToUse = state?.supabaseConfig || currentUser?.supabaseConfig;
    if (configToUse) {
      try {
        // We need the full state to save. 
        // Since setState is async, we'll construct the state to save manually
        const stateToSave = { ...state!, users: [...state!.users, u] };
        await saveState(stateToSave, configToUse);
        console.log('Registro salvo na nuvem com sucesso');
      } catch (err) {
        console.error('Erro ao salvar registro na nuvem:', err);
      }
    }
  }, [state, currentUser]);

  useEffect(() => {
    if (state && currentUser?.isMaster) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const batchesToCleanup = (state.batches || []).filter(b => 
        b.isClosed && b.closedAt && new Date(b.closedAt) < ninetyDaysAgo
      );

      if (batchesToCleanup.length > 0) {
        const batchIdsToRemove = new Set(batchesToCleanup.map(b => b.id));
        
        const newState: AppState = {
          ...state,
          batches: (state.batches || []).filter(b => !batchIdsToRemove.has(b.id)),
          feedingLogs: (state.feedingLogs || []).filter(l => !batchIdsToRemove.has(l.batchId || '')),
          mortalityLogs: (state.mortalityLogs || []).filter(l => !batchIdsToRemove.has(l.batchId || '')),
          biometryLogs: (state.biometryLogs || []).filter(l => !batchIdsToRemove.has(l.batchId || '')),
          harvestLogs: (state.harvestLogs || []).filter(l => !batchIdsToRemove.has(l.batchId)),
          batchExpenses: (state.batchExpenses || []).filter(l => !batchIdsToRemove.has(l.batchId)),
          // Also cleanup logs that might be linked via cage but the batch is gone
          // (Though usually batchId is the primary link for these logs in the cleanup context)
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
        <Login state={state!} onLogin={handleLogin} onRegister={handleRegister} onUpdateState={handleStateUpdate} />
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
