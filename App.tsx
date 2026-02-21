
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
import WaterQuality from './components/WaterQuality.tsx';
import ProtocolManagement from './components/ProtocolManagement.tsx';
import SlaughterHouse from './components/SlaughterHouse.tsx';
import Login from './components/Login.tsx';
import { loadState, saveState, getSession, saveSession, ensureStateIntegrity, fetchRemoteState } from './store.ts';
import { AppState, User } from './types.ts';
import { Loader2, RefreshCw, AlertTriangle, X } from 'lucide-react';

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

  const initApp = useCallback(async () => {
    try {
      const data = await loadState();
      setState(data);
      const savedUser = getSession();
      if (savedUser) {
        const updatedUser = data.users.find(u => u.id === savedUser.id);
        if (updatedUser && updatedUser.isApproved) {
          setCurrentUser(updatedUser);
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
      const remote = await fetchRemoteState(state.supabaseConfig);
      if (remote) {
        const merged = ensureStateIntegrity(state, remote, 'local');
        setState(merged);
      }
    } catch (err) {
      console.warn('Erro na sincronização de background:', err);
    } finally {
      setIsSyncingBackground(false);
    }
  }, [state, currentUser, isSyncingBackground]);

  useEffect(() => { initApp(); }, [initApp]);

  useEffect(() => {
    if (state && !isLoading) {
      isSavingRef.current = true;
      saveState(state).finally(() => {
        isSavingRef.current = false;
      });

      // Verificar alertas a cada 5 minutos ou quando o estado mudar significativamente
      const now = Date.now();
      if (now - lastAlertCheck > 300000) { // 5 minutos
        const alert = checkAndTriggerAlerts(state);
        if (alert) {
          setActiveAlert(alert);
          setTimeout(() => setActiveAlert(null), 10000);
        }
        setLastAlertCheck(now);
      }
    }
  }, [state, isLoading, lastAlertCheck]);

  useEffect(() => {
    const interval = setInterval(backgroundSync, 30000); 
    return () => clearInterval(interval);
  }, [backgroundSync]);

  const handleStateUpdate = (newState: AppState) => {
    if (!state) return;

    const injectTimestamps = (oldList: any[], newList: any[]) => {
      const oldMap = new Map(oldList.map(i => [i.id, i]));
      return newList.map(item => {
        const oldItem = oldMap.get(item.id);
        if (!oldItem || JSON.stringify({...oldItem, updatedAt: 0}) !== JSON.stringify({...item, updatedAt: 0})) {
          return { ...item, updatedAt: Date.now() };
        }
        return item;
      });
    };

    const stateWithTimestamps: AppState = {
      ...newState,
      users: injectTimestamps(state.users, newState.users),
      lines: injectTimestamps(state.lines, newState.lines),
      batches: injectTimestamps(state.batches, newState.batches),
      cages: injectTimestamps(state.cages, newState.cages),
      feedTypes: injectTimestamps(state.feedTypes, newState.feedTypes),
      feedingLogs: injectTimestamps(state.feedingLogs, newState.feedingLogs),
      mortalityLogs: injectTimestamps(state.mortalityLogs, newState.mortalityLogs),
      biometryLogs: injectTimestamps(state.biometryLogs, newState.biometryLogs),
      waterLogs: injectTimestamps(state.waterLogs, newState.waterLogs),
      slaughterLogs: injectTimestamps(state.slaughterLogs, newState.slaughterLogs),
      protocols: injectTimestamps(state.protocols, newState.protocols),
    };

    const findDeleted = (oldList: any[], newList: any[]) => {
      const newIds = new Set(newList.map(i => i.id));
      return oldList.filter(i => !newIds.has(i.id)).map(i => i.id);
    };

    const deleted = [
      ...findDeleted(state.users, stateWithTimestamps.users),
      ...findDeleted(state.lines, stateWithTimestamps.lines),
      ...findDeleted(state.batches, stateWithTimestamps.batches),
      ...findDeleted(state.cages, stateWithTimestamps.cages),
      ...findDeleted(state.feedTypes, stateWithTimestamps.feedTypes),
      ...findDeleted(state.feedingLogs, stateWithTimestamps.feedingLogs),
      ...findDeleted(state.mortalityLogs, stateWithTimestamps.mortalityLogs),
      ...findDeleted(state.biometryLogs, stateWithTimestamps.biometryLogs),
      ...findDeleted(state.waterLogs, stateWithTimestamps.waterLogs),
      ...findDeleted(state.slaughterLogs, stateWithTimestamps.slaughterLogs),
      ...findDeleted(state.protocols, stateWithTimestamps.protocols),
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
      case 'water': return <WaterQuality state={state} onUpdate={handleStateUpdate} currentUser={currentUser} />;
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-black tracking-widest uppercase italic">AquaGestão</h2>
      </div>
    );
  }

  return (
    <>
      {isSyncingBackground && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow-sm border border-blue-100 flex items-center gap-2 pointer-events-none">
          <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Sincronizando Nuvem...</span>
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
        <Login state={state!} onLogin={handleLogin} onRegister={handleRegister} />
      ) : (
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout} state={state!}>
          {renderContent()}
        </Layout>
      )}
    </>
  );
};

export default App;
