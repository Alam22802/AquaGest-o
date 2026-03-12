
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
import SlaughterHouse from './components/SlaughterHouse.tsx';
import Login from './components/Login.tsx';
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
      const data = await loadState();
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
      const configToUse = currentUser.supabaseConfig || state.supabaseConfig;
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

    const configToUse = currentUser.supabaseConfig || state.supabaseConfig;
    if (!configToUse) return;

    const unsubscribe = subscribeToRemoteChanges(configToUse, (remoteState) => {
      if (isSavingRef.current) return;

      setState(prev => {
        if (!prev) return remoteState;
        // Only update if remote state is actually different
        if (JSON.stringify(remoteState) === JSON.stringify(lastSavedStateRef.current)) return prev;
        
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
      
      saveTimeoutRef.current = setTimeout(() => {
        isSavingRef.current = true;
        const configToUse = currentUser?.supabaseConfig || state.supabaseConfig;
        
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

  const handleStateUpdate = (newState: AppState) => {
    if (!state) return;

    // Optimized timestamp injection: only for items that actually changed
    // and only if the list itself is different by reference
    const injectTimestamps = (oldList: any[], newList: any[]) => {
      if (oldList === newList) return oldList;
      
      const oldMap = new Map(oldList.map(i => [i.id, i]));
      return newList.map(item => {
        const oldItem = oldMap.get(item.id);
        // Shallow comparison is much faster than JSON.stringify
        if (!oldItem) return { ...item, updatedAt: Date.now() };
        
        let hasChanged = false;
        const keys = Object.keys(item) as (keyof typeof item)[];
        for (const key of keys) {
          if (key === 'updatedAt') continue;
          if (item[key] !== oldItem[key]) {
            hasChanged = true;
            break;
          }
        }
        
        if (hasChanged) {
          return { ...item, updatedAt: Date.now() };
        }
        return oldItem; // Keep old reference if unchanged
      });
    };

    const stateWithTimestamps: AppState = {
      ...newState,
      users: injectTimestamps(state.users || [], newState.users || []),
      lines: injectTimestamps(state.lines || [], newState.lines || []),
      batches: injectTimestamps(state.batches || [], newState.batches || []),
      cages: injectTimestamps(state.cages || [], newState.cages || []),
      feedTypes: injectTimestamps(state.feedTypes || [], newState.feedTypes || []),
      feedingLogs: injectTimestamps(state.feedingLogs || [], newState.feedingLogs || []),
      feedStockLogs: injectTimestamps(state.feedStockLogs || [], newState.feedStockLogs || []),
      mortalityLogs: injectTimestamps(state.mortalityLogs || [], newState.mortalityLogs || []),
      biometryLogs: injectTimestamps(state.biometryLogs || [], newState.biometryLogs || []),
      slaughterLogs: injectTimestamps(state.slaughterLogs || [], newState.slaughterLogs || []),
      harvestLogs: injectTimestamps(state.harvestLogs || [], newState.harvestLogs || []),
      protocols: injectTimestamps(state.protocols || [], newState.protocols || []),
      portfolios: injectTimestamps(state.portfolios || [], newState.portfolios || []),
      capexProjects: injectTimestamps(state.capexProjects || [], newState.capexProjects || []),
      capexInvoices: injectTimestamps(state.capexInvoices || [], newState.capexInvoices || []),
    };

    const findDeleted = (oldList: any[], newList: any[]) => {
      if (!oldList || !newList || oldList === newList) return [];
      const newIds = new Set(newList.map(i => i.id));
      return oldList.filter(i => i && i.id && !newIds.has(i.id)).map(i => i.id);
    };

    const deleted = [
      ...findDeleted(state.users || [], stateWithTimestamps.users),
      ...findDeleted(state.lines || [], stateWithTimestamps.lines),
      ...findDeleted(state.batches || [], stateWithTimestamps.batches),
      ...findDeleted(state.cages || [], stateWithTimestamps.cages),
      ...findDeleted(state.feedTypes || [], stateWithTimestamps.feedTypes),
      ...findDeleted(state.feedingLogs || [], stateWithTimestamps.feedingLogs),
      ...findDeleted(state.feedStockLogs || [], stateWithTimestamps.feedStockLogs),
      ...findDeleted(state.mortalityLogs || [], stateWithTimestamps.mortalityLogs),
      ...findDeleted(state.biometryLogs || [], stateWithTimestamps.biometryLogs),
      ...findDeleted(state.slaughterLogs || [], stateWithTimestamps.slaughterLogs),
      ...findDeleted(state.harvestLogs || [], stateWithTimestamps.harvestLogs),
      ...findDeleted(state.protocols || [], stateWithTimestamps.protocols),
      ...findDeleted(state.portfolios || [], stateWithTimestamps.portfolios),
      ...findDeleted(state.capexProjects || [], stateWithTimestamps.capexProjects),
      ...findDeleted(state.capexInvoices || [], stateWithTimestamps.capexInvoices),
    ];

    if (deleted.length > 0) {
      const updatedDeletedIds = Array.from(new Set([...(state.deletedIds || []), ...deleted]));
      setState({ ...stateWithTimestamps, deletedIds: updatedDeletedIds });
    } else {
      setState(stateWithTimestamps);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    saveSession(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveSession(null);
    setActiveTab('dashboard');
  };

  const handleRegister = async (u: User) => {
    if (!state) return;
    const newState = { ...state, users: [...state.users, u] };
    handleStateUpdate(newState);
  };

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
      case 'users': return <UserManagement state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      case 'cloud': return <CloudSettings state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
      default: return <Dashboard state={state} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1f1a] flex flex-col items-center justify-center text-[#e4e4d4]">
        <Loader2 className="w-12 h-12 text-[#e4e4d4] animate-spin mb-4 opacity-40" />
        <h2 className="text-xl font-black tracking-widest uppercase italic opacity-80">AquaGestão</h2>
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
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] bg-white/40 backdrop-blur px-3 py-1 rounded-full shadow-sm border border-emerald-100/50 flex items-center gap-2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Nuvem Ativa</span>
        </div>
      )}
      {activeAlert && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-4 rounded-3xl shadow-2xl border border-red-500 flex items-start gap-4 animate-in slide-in-from-bottom-10 duration-500 max-w-md w-[90%]">
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
          {renderContent()}
        </Layout>
      )}
    </>
  );
};

export default App;
